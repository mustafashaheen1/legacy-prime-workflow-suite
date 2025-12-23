import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Lightweight estimate creation endpoint - bypasses tRPC/Hono overhead
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Create Estimate] Starting request...');

  try {
    // Parse request body
    const {
      companyId,
      projectId,
      projectName,
      name,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status = 'draft',
    } = req.body;

    // Validate required fields
    if (!companyId || !projectId || !name || !items || subtotal === undefined || taxRate === undefined || taxAmount === undefined || total === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: companyId, projectId, name, items, subtotal, taxRate, taxAmount, total',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Create Estimate] Supabase not configured');
      return res.status(500).json({
        error: 'Database not configured. Please add Supabase environment variables.',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle project ID - if it's not a UUID, we need to find or create the project in the database
    let dbProjectId = projectId;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

    if (!isUUID) {
      console.log('[Create Estimate] Non-UUID project ID detected:', projectId);
      console.log('[Create Estimate] Looking for project in database...');

      // Try to find existing project by name
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', projectName || 'Unnamed Project')
        .single();

      if (existingProject) {
        console.log('[Create Estimate] Found existing project:', existingProject.id);
        dbProjectId = existingProject.id;
      } else {
        // Create new project in database
        console.log('[Create Estimate] Creating new project in database...');
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            company_id: companyId,
            name: projectName || 'Unnamed Project',
            budget: 0,
            expenses: 0,
            progress: 0,
            status: 'active',
            hours_worked: 0,
          } as any)
          .select('id')
          .single();

        if (projectError || !newProject) {
          console.error('[Create Estimate] Failed to create project:', projectError);
          return res.status(500).json({
            error: `Failed to create project: ${projectError?.message || 'Unknown error'}`,
          });
        }

        console.log('[Create Estimate] Created new project:', newProject.id);
        dbProjectId = newProject.id;
      }
    }

    // 1. Insert the estimate record
    console.log('[Create Estimate] Inserting estimate record with project ID:', dbProjectId);
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        company_id: companyId,
        project_id: dbProjectId,
        name,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        status,
      } as any)
      .select('id, project_id, name, subtotal, tax_rate, tax_amount, total, status, created_date')
      .single() as any;

    console.log('[Create Estimate] Insert completed in', Date.now() - startTime, 'ms');

    if (estimateError) {
      console.error('[Create Estimate] Error creating estimate:', estimateError);
      return res.status(500).json({
        error: `Failed to create estimate: ${estimateError.message}`,
      });
    }

    if (!estimate) {
      return res.status(500).json({
        error: 'No data returned from estimate insert',
      });
    }

    console.log('[Create Estimate] Estimate created successfully:', estimate.id);

    // 2. Insert the estimate items (if any)
    if (items && items.length > 0) {
      console.log('[Create Estimate] Inserting', items.length, 'estimate items...');
      const itemsToInsert = items.map((item: any) => ({
        estimate_id: estimate.id,
        price_list_item_id: item.priceListItemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        custom_price: item.customPrice,
        total: item.total,
        budget: item.budget,
        budget_unit_price: item.budgetUnitPrice,
        notes: item.notes,
        custom_name: item.customName,
        custom_unit: item.customUnit,
        custom_category: item.customCategory,
        is_separator: item.isSeparator || false,
        separator_label: item.separatorLabel,
      }));

      const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsToInsert as any);

      console.log('[Create Estimate] Items insert completed in', Date.now() - startTime, 'ms');

      if (itemsError) {
        console.error('[Create Estimate] Error creating estimate items:', itemsError);
        // Rollback: delete the estimate
        await supabase.from('estimates').delete().eq('id', estimate.id);
        return res.status(500).json({
          error: `Failed to create estimate items: ${itemsError.message}`,
        });
      }

      console.log('[Create Estimate] Estimate items created successfully');
    }

    console.log('[Create Estimate] Total time:', Date.now() - startTime, 'ms');

    // Return success response
    return res.status(200).json({
      success: true,
      estimate: {
        id: estimate.id,
        projectId: estimate.project_id,
        name: estimate.name,
        subtotal: estimate.subtotal,
        taxRate: estimate.tax_rate,
        taxAmount: estimate.tax_amount,
        total: estimate.total,
        status: estimate.status,
        createdDate: estimate.created_date,
        items: items || [],
      },
    });
  } catch (error: any) {
    console.error('[Create Estimate] Unexpected error:', error);
    console.error('[Create Estimate] Error occurred after', Date.now() - startTime, 'ms');
    return res.status(500).json({
      error: error.message || 'Failed to create estimate',
    });
  }
}
