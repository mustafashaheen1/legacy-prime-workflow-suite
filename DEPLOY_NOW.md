# 🚀 Deploy Gantt Chart - Quick Start

## ✅ Step 1: Code Committed ✓

Your code is committed with hash: `1f936a2`

```
40 files changed, 6588 insertions(+)
✅ All Gantt Chart components
✅ API endpoints
✅ Database migrations
✅ Documentation
```

## ✅ Step 2: Feature Flag Enabled ✓

Added to `.env.local`:
```bash
EXPO_PUBLIC_ENABLE_GANTT_V2=true
```

## 🔄 Step 3: Run Database Migrations

**Easiest method: Use Supabase Dashboard**

1. Open: https://supabase.com/dashboard/project/qwzhaexlnlfovrwzamop/sql

2. Copy and run each migration file (in order):
   - `supabase/migrations/20260217_create_schedule_phases.sql`
   - `supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql`
   - `supabase/migrations/20260217_add_rls_policies.sql`

3. Verify with this query:
   ```sql
   SELECT COUNT(*) FROM schedule_phases;
   ```

**See RUN_MIGRATIONS.md for detailed instructions**

## 🔄 Step 4: Restart Dev Server

After running migrations:

```bash
# Stop current server (Ctrl+C)

# Clear cache and restart
npm run start -- --clear

# Or just restart
npm start
```

## 🎉 Step 5: Test New Gantt Chart

1. Open your app (web or mobile)
2. Navigate to **Schedule** tab
3. You should see the new Gantt Chart UI with:
   - Phase sidebar on left
   - Timeline grid on right
   - Zoom controls at top
   - Drag & drop tasks

### If you see the old schedule:

Check:
- [ ] `.env.local` has `EXPO_PUBLIC_ENABLE_GANTT_V2=true`
- [ ] Dev server was restarted after adding flag
- [ ] No console errors (open dev tools)

### Quick toggle to test:

To switch back to old schedule:
```bash
# In .env.local, change to:
EXPO_PUBLIC_ENABLE_GANTT_V2=false

# Restart server
npm run start -- --clear
```

---

## 📋 Quick Test Checklist

Once Gantt Chart loads:

- [ ] **Phase sidebar** appears on left
- [ ] **Timeline grid** appears on right
- [ ] **Control bar** at top with zoom buttons
- [ ] **Project tabs** show at top
- [ ] Click a project tab - phases/tasks load
- [ ] Click "Add Phase" button - modal opens
- [ ] Try zooming in/out - grid adjusts
- [ ] Click a task bar - modal opens
- [ ] Try dragging a task - moves smoothly

---

## 🐛 Troubleshooting

### "Table schedule_phases already exists"
✅ Migrations already ran! This is fine.

### "Cannot read property 'map' of undefined"
❌ Migrations not run yet. Complete Step 3 above.

### Old schedule still shows
❌ Check feature flag and restart server.

### Console errors about auth
❌ Check Supabase credentials in `.env.local`

---

## 📱 Testing on Mobile

After testing on web:

```bash
# iOS
npm run ios

# Android
npm run android
```

---

## 🎯 What to Test

### Basic Functionality (5 min)
1. ✅ Schedule screen loads
2. ✅ Phases appear in sidebar
3. ✅ Tasks appear in timeline
4. ✅ Can click tasks to view details
5. ✅ Zoom controls work

### Advanced Functionality (10 min)
1. ✅ Drag task to new date
2. ✅ Resize task duration
3. ✅ Create new task
4. ✅ Edit existing task
5. ✅ Delete task
6. ✅ Print schedule
7. ✅ Works on mobile

---

## 📊 Success Metrics

Your deployment is successful when:

- [ ] New Gantt Chart loads without errors
- [ ] All phases from old schedule migrated
- [ ] All tasks from old schedule migrated
- [ ] Drag & drop works smoothly (60fps)
- [ ] Can create/edit/delete tasks
- [ ] Works on iOS, Android, Web
- [ ] No security errors (RLS policies working)

---

## 🆘 Need Help?

Check documentation:
- `components/GanttChart/README.md` - Full component docs
- `components/GanttChart/TESTING.md` - Test plan
- `components/GanttChart/PERFORMANCE.md` - Performance guide
- `GANTT_IMPLEMENTATION_SUMMARY.md` - Complete overview

---

## 🎉 Next Steps After Testing

Once you've verified everything works:

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Deploy to Vercel** (auto-deploys on push if configured)

3. **Monitor** for 24-48 hours

4. **Collect feedback** from team

5. **Iterate** on any issues

---

**Status: Ready to Deploy! 🚀**

Run migrations → Restart server → Test → Ship it!
