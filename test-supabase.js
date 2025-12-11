#!/usr/bin/env node

// Test Supabase Connection
// Run with: node test-supabase.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Supabase credentials not found in .env file');
  console.error('   Make sure you have:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('✓ Supabase URL:', supabaseUrl);
console.log('✓ Anon Key:', supabaseAnonKey.substring(0, 20) + '...\n');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('📊 Testing database connection...');

    // Test 1: Check companies table
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('count');

    if (companiesError) {
      console.error('❌ Companies table error:', companiesError.message);
      return false;
    }

    console.log('✅ Companies table accessible');

    // Test 2: Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count');

    if (usersError) {
      console.error('❌ Users table error:', usersError.message);
      return false;
    }

    console.log('✅ Users table accessible');

    // Test 3: Check projects table
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('count');

    if (projectsError) {
      console.error('❌ Projects table error:', projectsError.message);
      return false;
    }

    console.log('✅ Projects table accessible');

    // Test 4: List all tables
    console.log('\n📋 Checking all tables...');
    const tables = [
      'companies', 'users', 'projects', 'clients', 'expenses',
      'photos', 'tasks', 'clock_entries', 'estimates', 'estimate_items',
      'daily_logs', 'daily_log_tasks', 'daily_log_photos', 'call_logs',
      'chat_conversations', 'chat_messages', 'reports', 'project_files',
      'payments', 'change_orders', 'subcontractors', 'business_files',
      'estimate_requests', 'subcontractor_proposals', 'notifications',
      'custom_price_list_items', 'custom_categories', 'ai_chat_sessions'
    ];

    let successCount = 0;
    let failedTables = [];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        failedTables.push(table);
      } else {
        successCount++;
      }
    }

    console.log(`\n✅ ${successCount}/${tables.length} tables accessible`);

    if (failedTables.length > 0) {
      console.log('\n❌ Failed tables:', failedTables.join(', '));
      return false;
    }

    // Test 5: Check storage buckets
    console.log('\n📦 Checking storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('❌ Storage error:', bucketsError.message);
    } else {
      console.log('✅ Storage accessible');
      if (buckets.length > 0) {
        console.log('   Buckets found:', buckets.map(b => b.name).join(', '));
      } else {
        console.log('⚠️  No storage buckets created yet');
        console.log('   Run: Create buckets in Supabase dashboard');
      }
    }

    console.log('\n🎉 SUCCESS! Supabase is configured correctly!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
