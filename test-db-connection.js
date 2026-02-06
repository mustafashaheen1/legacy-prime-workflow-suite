#!/usr/bin/env node
/**
 * Database Connection Test Script
 * This safely checks your Supabase database without exposing credentials
 *
 * Usage: node test-db-connection.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 Database Connection Test\n');
console.log('='.repeat(50));

// Step 1: Check environment variables
console.log('\n1️⃣  Checking environment variables...');
if (!supabaseUrl) {
  console.log('   ❌ EXPO_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
} else {
  console.log('   ✅ EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl.substring(0, 30) + '...');
}

if (!supabaseKey) {
  console.log('   ❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
} else {
  console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: [SET - hidden]');
}

// Step 2: Create Supabase client
console.log('\n2️⃣  Creating Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
console.log('   ✅ Client created');

// Step 3: Test basic connection
console.log('\n3️⃣  Testing basic connection...');
(async () => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error) {
      console.log('   ❌ Connection failed:', error.message);
      process.exit(1);
    }
    console.log('   ✅ Connection successful');

    // Step 4: Check if custom_folders table exists
    console.log('\n4️⃣  Checking if custom_folders table exists...');
    const { data: folderData, error: folderError } = await supabase
      .from('custom_folders')
      .select('id')
      .limit(1);

    if (folderError) {
      if (folderError.code === '42P01') {
        console.log('   ❌ Table does NOT exist (error code: 42P01)');
        console.log('   💡 Solution: Run supabase-custom-folders-simple.sql in Supabase SQL Editor');
        console.log('   📍 File location: ./supabase-custom-folders-simple.sql');
      } else {
        console.log('   ❌ Error querying table:', folderError.message);
      }
      process.exit(1);
    }

    console.log('   ✅ Table exists');
    console.log('   📊 Found', folderData?.length || 0, 'folders');

    // Step 5: Test INSERT capability
    console.log('\n5️⃣  Testing INSERT permission...');
    const testProjectId = 'test-' + Date.now();
    const testFolderType = 'test-folder-' + Date.now();

    const insertStart = Date.now();
    const { data: insertData, error: insertError } = await supabase
      .from('custom_folders')
      .insert({
        project_id: testProjectId,
        folder_type: testFolderType,
        name: 'Test Folder',
        color: '#6B7280',
        description: 'Test',
      })
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;

    if (insertError) {
      console.log('   ❌ INSERT failed:', insertError.message);
      console.log('   💡 Check RLS policies or permissions');
      process.exit(1);
    }

    console.log('   ✅ INSERT successful');
    console.log('   ⏱️  Insert took', insertDuration, 'ms');
    console.log('   🆔 Created record:', insertData.id);

    // Step 6: Cleanup test record
    console.log('\n6️⃣  Cleaning up test record...');
    await supabase
      .from('custom_folders')
      .delete()
      .eq('id', insertData.id);
    console.log('   ✅ Cleanup complete');

    // Step 7: Count existing folders
    console.log('\n7️⃣  Checking existing folders...');
    const { count, error: countError } = await supabase
      .from('custom_folders')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log('   📊 Total folders in database:', count || 0);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED! Database is working correctly.');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.log('\n❌ Unexpected error:', error.message);
    console.log(error);
    process.exit(1);
  }
})();
