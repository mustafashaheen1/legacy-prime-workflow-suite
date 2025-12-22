# Price List Migration to Supabase - Complete Guide

This guide will walk you through migrating the price list from hardcoded dummy data to Supabase database.

## Overview

We've created:
- ✅ Database schema for `price_list_items` and `price_list_categories` tables
- ✅ Script to generate SQL INSERT statements (336 items)
- ✅ tRPC routes to fetch price list data
- ✅ tRPC router integration

## Step-by-Step Migration

### Step 1: Run the Database Migrations

Execute these SQL files in your Supabase SQL editor in this exact order:

#### 1.1 Create Tables and Categories
```sql
-- File: migrate-price-list-to-supabase.sql
-- This creates the tables and inserts the categories
```

Run this file first in Supabase SQL Editor.

#### 1.2 Insert Price List Data
```bash
# First, generate the INSERT statements:
node generate-price-list-inserts.js

# This creates: price-list-data-inserts.sql
# Then run that file in Supabase SQL Editor
```

#### 1.3 Verify the Data
```sql
-- Check that everything was inserted
SELECT COUNT(*) FROM price_list_items;
-- Should return 336

SELECT COUNT(*) FROM price_list_categories;
-- Should return 29

-- View sample items
SELECT * FROM price_list_items LIMIT 10;
```

### Step 2: Test the tRPC Routes

The backend routes are already created and registered:
- `trpc.priceList.getPriceList.query()` - Fetch all items (optionally filtered by category)
- `trpc.priceList.getCategories.query()` - Fetch all categories

Test them:
```typescript
// In your frontend code, you can now use:
const { data } = trpc.priceList.getPriceList.useQuery();
const { data: categories } = trpc.priceList.getCategories.useQuery();
```

### Step 3: Update the Estimate Page

Now you need to update `app/project/[id]/estimate.tsx` to fetch from Supabase instead of using the mock data.

#### Current code (lines 7-14):
```typescript
import { masterPriceList, PriceListItem, priceListCategories, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { EstimateItem, Estimate, ProjectFile } from '@/types';
import { trpcClient } from '@/lib/trpc';

export default function EstimateScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, addEstimate, customPriceListItems, addCustomPriceListItem, customCategories, addCustomCategory, deleteCustomCategory, addProjectFile, company } = useApp();
```

#### Update to:
```typescript
import { PriceListItem, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { EstimateItem, Estimate, ProjectFile } from '@/types';
import { trpc, trpcClient } from '@/lib/trpc';

export default function EstimateScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, addEstimate, customPriceListItems, addCustomPriceListItem, customCategories, addCustomCategory, deleteCustomCategory, addProjectFile, company } = useApp();

  // Add these hooks to fetch from Supabase
  const { data: priceListData } = trpc.priceList.getPriceList.useQuery(
    company?.id ? { companyId: company.id } : undefined
  );
  const { data: categoriesData } = trpc.priceList.getCategories.useQuery();

  const masterPriceList = priceListData?.items || [];
  const priceListCategories = categoriesData?.categories || [];
```

#### Update the filtered items logic (around line 157):
```typescript
// Old:
const masterItems = masterPriceList.filter(item => item.category === category);

// Keep the same - it will work with the fetched data
const masterItems = masterPriceList.filter(item => item.category === category);
```

### Step 4: Handle Loading States

Add loading states while fetching:

```typescript
const { data: priceListData, isLoading: isLoadingPriceList } = trpc.priceList.getPriceList.useQuery(
  company?.id ? { companyId: company.id } : undefined
);
const { data: categoriesData, isLoading: isLoadingCategories } = trpc.priceList.getCategories.useQuery();

// Show loading indicator
if (isLoadingPriceList || isLoadingCategories) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text>Loading price list...</Text>
    </View>
  );
}
```

### Step 5: (Optional) Add Company-Specific Items

If you want to allow companies to add their own custom price list items to the database (not just AsyncStorage):

Create a new tRPC route: `backend/trpc/routes/price-list/add-custom-item/route.ts`

```typescript
import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const addCustomItemProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      category: z.string().min(1),
      description: z.string().optional(),
      unit: z.string().min(1),
      unitPrice: z.number().min(0),
      laborCost: z.number().optional(),
      materialCost: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { data, error } = await supabase
      .from('price_list_items')
      .insert({
        company_id: input.companyId,
        name: input.name,
        category: input.category,
        description: input.description || '',
        unit: input.unit,
        unit_price: input.unitPrice,
        labor_cost: input.laborCost,
        material_cost: input.materialCost,
        is_custom: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { success: true, item: data };
  });
```

## Database Schema Details

### `price_list_items` Table
```sql
- id: TEXT (primary key) - e.g., 'pl-1', 'pl-2', etc.
- category: TEXT - Category name
- name: TEXT - Item name/description
- description: TEXT - Additional description
- unit: TEXT - Unit of measurement (EA, SF, LF, HR, etc.)
- unit_price: DECIMAL - Price per unit
- labor_cost: DECIMAL (optional) - Labor cost component
- material_cost: DECIMAL (optional) - Material cost component
- company_id: UUID (optional) - For company-specific items
- is_custom: BOOLEAN - True for company-added items
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `price_list_categories` Table
```sql
- id: TEXT (primary key)
- name: TEXT (unique) - Category name
- sort_order: INTEGER - Display order
- created_at: TIMESTAMPTZ
```

## Benefits of This Migration

1. **Centralized Data** - All companies can share the same master price list
2. **Customizable** - Companies can add their own items without affecting others
3. **Updatable** - Update prices in one place instead of redeploying code
4. **Scalable** - Easy to add new items, categories, or fields
5. **Searchable** - Can add full-text search in the future
6. **Reportable** - Can query which items are most used, revenue by category, etc.

## Rollback Plan

If you need to roll back:

1. Revert the estimate page changes (remove tRPC hooks, restore import)
2. Keep the database tables - they won't hurt anything
3. The app will work with the old mock data

## Next Steps

After migration:
1. Consider adding a UI to manage price list items
2. Add search functionality
3. Add price history tracking
4. Add bulk import/export features
5. Add per-company price overrides

## Files Created

- ✅ `migrate-price-list-to-supabase.sql` - Creates tables and categories
- ✅ `generate-price-list-inserts.js` - Generates INSERT statements
- ✅ `price-list-data-inserts.sql` - Generated SQL inserts (336 items)
- ✅ `backend/trpc/routes/price-list/get-price-list/route.ts` - Fetch items
- ✅ `backend/trpc/routes/price-list/get-categories/route.ts` - Fetch categories
- ✅ `backend/trpc/app-router.ts` - Updated with priceList router

## Questions?

If you encounter any issues:
1. Check Supabase logs for database errors
2. Check browser console for tRPC errors
3. Verify the tables were created with correct schema
4. Ensure all 336 items were inserted
