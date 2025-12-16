#!/bin/bash
# Add environment variables to Vercel

npx vercel env add STRIPE_SECRET_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY production
npx vercel env add EXPO_PUBLIC_SUPABASE_URL production
npx vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY production

echo "Environment variables added! Now redeploy with: npx vercel --prod"
