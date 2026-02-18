# 🚀 Manual Deployment Instructions

Since I can't login to Vercel automatically, please follow these steps:

## Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to:** https://vercel.com/dashboard
2. **Select:** legacy-prime-workflow-suite
3. **Click:** Deployments tab
4. **Click:** Latest deployment → "..." → **Redeploy**
5. **Wait:** 2-3 minutes
6. **Done!** ✅

## Option 2: Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

## Option 3: Trigger from GitHub

Since your code is already pushed to GitHub, Vercel should auto-deploy!

**Check if auto-deploy happened:**
1. Go to: https://vercel.com/dashboard
2. Look for recent deployment from GitHub push
3. If you see one, just wait for it to finish!

---

## After Deployment:

### Add Environment Variable (CRITICAL!)

**You MUST add this environment variable for the new Gantt to show:**

1. Vercel Dashboard → Settings → Environment Variables
2. Add New:
   - Key: `EXPO_PUBLIC_ENABLE_GANTT_V2`
   - Value: `true`
   - Environments: All ✅
3. Save
4. **Redeploy** (Deployments → Latest → Redeploy)

---

## Test:

Visit: https://legacy-prime-workflow-suite.vercel.app/schedule

You should see the new Gantt Chart matching your screenshot! 🎉
