#!/usr/bin/env node

/**
 * Test script to diagnose custom_folders insert performance
 *
 * Usage: node test-custom-folder-performance.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

console.log('🔍 Testing custom_folders insert performance...\n');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testInsertPerformance() {
  const testProjectId = 'test-project-' + Date.now();
  const testFolderType = 'test-folder-' + Date.now();

  console.log('📝 Test data:');
  console.log('   Project ID:', testProjectId);
  console.log('   Folder Type:', testFolderType);
  console.log('');

  // Test 1: Simple connection test
  console.log('🧪 Test 1: Connection speed');
  const connectStart = Date.now();
  const { data: healthCheck, error: healthError } = await supabase
    .from('custom_folders')
    .select('count')
    .limit(1);
  const connectTime = Date.now() - connectStart;

  if (healthError) {
    console.error('   ❌ Connection failed:', healthError.message);
    return;
  }
  console.log('   ✅ Connected in', connectTime, 'ms');
  console.log('');

  // Test 2: Insert performance
  console.log('🧪 Test 2: Insert performance');
  const insertStart = Date.now();
  const { data, error } = await supabase
    .from('custom_folders')
    .insert({
      project_id: testProjectId,
      folder_type: testFolderType,
      name: 'Test Folder',
      color: '#6B7280',
      description: 'Test folder for performance testing',
    })
    .select()
    .single();
  const insertTime = Date.now() - insertStart;

  if (error) {
    console.error('   ❌ Insert failed:', error.message);
    console.error('   Error details:', {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }

  console.log('   ✅ Inserted in', insertTime, 'ms');
  console.log('   Created folder ID:', data.id);
  console.log('');

  // Test 3: Query performance
  console.log('🧪 Test 3: Query performance');
  const queryStart = Date.now();
  const { data: folders, error: queryError } = await supabase
    .from('custom_folders')
    .select('*')
    .eq('project_id', testProjectId);
  const queryTime = Date.now() - queryStart;

  if (queryError) {
    console.error('   ❌ Query failed:', queryError.message);
  } else {
    console.log('   ✅ Queried in', queryTime, 'ms');
    console.log('   Found', folders.length, 'folder(s)');
  }
  console.log('');

  // Cleanup
  console.log('🧹 Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('custom_folders')
    .delete()
    .eq('project_id', testProjectId);

  if (deleteError) {
    console.error('   ❌ Cleanup failed:', deleteError.message);
  } else {
    console.log('   ✅ Cleanup complete');
  }
  console.log('');

  // Results
  console.log('📊 Performance Summary:');
  console.log('   Connection time:', connectTime, 'ms');
  console.log('   Insert time:', insertTime, 'ms', insertTime > 8000 ? '⚠️ TOO SLOW!' : '✓');
  console.log('   Query time:', queryTime, 'ms');
  console.log('');

  if (insertTime > 8000) {
    console.log('⚠️  WARNING: Insert is too slow for Vercel hobby plan (10s limit)');
    console.log('');
    console.log('💡 Possible solutions:');
    console.log('   1. Check if RLS policies are slowing down the insert');
    console.log('   2. Verify database indexes are properly created');
    console.log('   3. Check Supabase region latency');
    console.log('   4. Consider upgrading to Vercel Pro for 60s timeout');
    console.log('');
    console.log('🔧 Try running this SQL to disable RLS temporarily:');
    console.log('   ALTER TABLE custom_folders DISABLE ROW LEVEL SECURITY;');
  } else if (insertTime > 5000) {
    console.log('⚠️  WARNING: Insert is slow but within limits');
    console.log('   Consider optimizing for better user experience');
  } else {
    console.log('✅ Performance is good!');
  }
}

testInsertPerformance()
  .then(() => {
    console.log('✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
