/**
 * This script reads the price list from mocks/priceList.ts
 * and generates SQL INSERT statements for Supabase
 */

const fs = require('fs');
const path = require('path');

// Read the price list file
const priceListPath = path.join(__dirname, 'mocks', 'priceList.ts');
const fileContent = fs.readFileSync(priceListPath, 'utf8');

// Extract the masterPriceList array using regex
const match = fileContent.match(/export const masterPriceList: PriceListItem\[\] = \[([\s\S]*?)\];/);

if (!match) {
  console.error('Could not find masterPriceList in the file');
  process.exit(1);
}

// Parse the items (simple regex-based parsing)
const itemsText = match[1];
const itemMatches = itemsText.matchAll(/\{[\s\S]*?\}/g);

const items = [];
for (const itemMatch of itemMatches) {
  const itemText = itemMatch[0];

  // Extract fields
  const id = itemText.match(/id:\s*'([^']+)'/)?.[1];
  const category = itemText.match(/category:\s*'([^']+)'/)?.[1];
  const name = itemText.match(/name:\s*'([^']+)'/)?.[1];
  const description = itemText.match(/description:\s*'([^']*)'/)?.[1] || '';
  const unit = itemText.match(/unit:\s*'([^']+)'/)?.[1];
  const unitPrice = itemText.match(/unitPrice:\s*(\d+\.?\d*)/)?.[1];
  const laborCost = itemText.match(/laborCost:\s*(\d+\.?\d*)/)?.[1];
  const materialCost = itemText.match(/materialCost:\s*(\d+\.?\d*)/)?.[1];

  if (id && category && name && unit && unitPrice) {
    items.push({
      id,
      category,
      name,
      description,
      unit,
      unitPrice,
      laborCost,
      materialCost
    });
  }
}

console.log(`Found ${items.length} price list items`);

// Generate SQL INSERT statements
const sqlStatements = [];
sqlStatements.push('-- Insert price list items (master/default items)');
sqlStatements.push('-- These are available to all companies');
sqlStatements.push('');

// Batch insert for better performance (100 items per INSERT)
const batchSize = 50;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  sqlStatements.push('INSERT INTO price_list_items (id, category, name, description, unit, unit_price, labor_cost, material_cost, is_custom) VALUES');

  const values = batch.map((item, index) => {
    const escapedName = item.name.replace(/'/g, "''");
    const escapedDesc = item.description.replace(/'/g, "''");
    const laborCost = item.laborCost ? item.laborCost : 'NULL';
    const materialCost = item.materialCost ? item.materialCost : 'NULL';

    const trailing = index === batch.length - 1 ? ';' : ',';
    return `  ('${item.id}', '${item.category}', '${escapedName}', '${escapedDesc}', '${item.unit}', ${item.unitPrice}, ${laborCost}, ${materialCost}, false)${trailing}`;
  });

  sqlStatements.push(...values);
  sqlStatements.push('');
}

sqlStatements.push('-- Add conflict handling for re-running the migration');
sqlStatements.push('-- If you need to re-run, use this instead:');
sqlStatements.push('-- ON CONFLICT (id) DO UPDATE SET');
sqlStatements.push('--   unit_price = EXCLUDED.unit_price,');
sqlStatements.push('--   labor_cost = EXCLUDED.labor_cost,');
sqlStatements.push('--   material_cost = EXCLUDED.material_cost;');

// Write to file
const outputPath = path.join(__dirname, 'price-list-data-inserts.sql');
fs.writeFileSync(outputPath, sqlStatements.join('\n'), 'utf8');

console.log(`✅ Generated SQL file: ${outputPath}`);
console.log(`📊 Total items: ${items.length}`);
console.log('\nNext steps:');
console.log('1. Run migrate-price-list-to-supabase.sql first (creates tables)');
console.log('2. Run price-list-data-inserts.sql (inserts data)');
console.log('3. Test by querying: SELECT * FROM price_list_items LIMIT 10;');
