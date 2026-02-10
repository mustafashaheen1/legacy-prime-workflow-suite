#!/bin/bash

# Quick script to check the most recent call log
# Run this to verify your test call with "Bilal" was captured

echo "🔍 Checking Recent Call Logs..."
echo "================================"
echo ""

# Get company ID from environment
if [ -f ".env.local" ]; then
    source .env.local
fi

# Check if Supabase is configured
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Supabase not configured"
    echo "Please check your .env.local file"
    exit 1
fi

echo "✅ Supabase configured"
echo ""

# Get the project domain
if [ -f ".vercel/project.json" ]; then
    DOMAIN=$(cat .vercel/project.json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    echo "📍 Project: $DOMAIN.vercel.app"
else
    echo "⚠️  Not deployed to Vercel, using localhost"
    DOMAIN="localhost:8081"
fi

echo ""
echo "📋 To check your call with 'Bilal':"
echo ""
echo "1. Open CRM: https://legacy-prime-workflow-suite.vercel.app/crm"
echo "2. Click 'Call Logs' button (top right)"
echo "3. Look for most recent call with name 'Bilal'"
echo ""
echo "OR"
echo ""
echo "Open Supabase Dashboard:"
echo "  URL: $EXPO_PUBLIC_SUPABASE_URL"
echo "  Go to: Table Editor → call_logs"
echo "  Sort by: call_date (descending)"
echo "  Look for: caller_name = 'Bilal'"
echo ""
echo "================================"
