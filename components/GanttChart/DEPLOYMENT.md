# Gantt Chart Deployment Guide

Step-by-step deployment process for rolling out the new Gantt Chart UI.

## Pre-Deployment

### 1. Code Review

- [ ] Review all component code
- [ ] Review all hooks
- [ ] Review database migrations
- [ ] Review API endpoints
- [ ] Review type definitions
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`

### 2. Database Backup

**CRITICAL: Always backup before running migrations!**

```bash
# Backup Supabase database
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use Supabase Dashboard:
# 1. Go to Database → Backups
# 2. Click "Create Backup"
# 3. Wait for completion
# 4. Download backup file
```

### 3. Testing Environment Setup

```bash
# Clone production data to staging
# (Use Supabase branching or manual copy)

# Set staging environment
export EXPO_PUBLIC_SUPABASE_URL="https://staging.supabase.co"
export EXPO_PUBLIC_ENABLE_GANTT_V2="true"

# Test migrations on staging
psql -f supabase/migrations/20260217_create_schedule_phases.sql
psql -f supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql
psql -f supabase/migrations/20260217_add_rls_policies.sql
```

## Deployment Phases

### Phase 1: Database Migration (Staging)

**Timeline: Day 1**

1. **Run migrations on staging database:**

```bash
# Connect to staging database
psql postgresql://postgres:[PASSWORD]@db.staging.supabase.co:5432/postgres

# Run migrations in order
\i supabase/migrations/20260217_create_schedule_phases.sql
\i supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql
\i supabase/migrations/20260217_add_rls_policies.sql

# Verify
\dt schedule_phases
\dt scheduled_tasks
```

2. **Verify data migration:**

```sql
-- Check that phases were created
SELECT COUNT(*) FROM schedule_phases;

-- Check that tasks are linked
SELECT COUNT(*) FROM scheduled_tasks WHERE phase_id IS NOT NULL;
SELECT COUNT(*) FROM scheduled_tasks WHERE phase_id IS NULL;
-- Should be 0 nulls

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('schedule_phases', 'scheduled_tasks');
```

3. **Test RLS policies:**

```sql
-- Set a test user context
SET request.jwt.claim.sub = 'test-user-id';

-- Try to access data
SELECT * FROM schedule_phases LIMIT 1;
-- Should work for user's company only
```

### Phase 2: Code Deployment (Staging)

**Timeline: Day 2**

1. **Deploy code to staging:**

```bash
# Build app
npm run build

# Deploy to staging (method depends on hosting)
# Example: Vercel
vercel --prod --env EXPO_PUBLIC_ENABLE_GANTT_V2=true

# Example: EAS for mobile
eas build --platform all --profile staging
```

2. **Verify deployment:**

- [ ] App loads successfully
- [ ] No console errors
- [ ] Feature flag is active
- [ ] Gantt Chart renders
- [ ] Legacy schedule still works (toggle flag)

### Phase 3: Staging Testing

**Timeline: Days 3-7 (1 week)**

Run full test suite (see TESTING.md):

- [ ] Functional testing complete
- [ ] Cross-platform testing complete
- [ ] Performance testing complete
- [ ] Security testing complete
- [ ] No critical bugs found

**User Acceptance Testing (UAT):**

- [ ] Internal team tested (5 users)
- [ ] Beta users tested (10 users)
- [ ] Feedback collected and addressed

### Phase 4: Production Migration Prep

**Timeline: Day 8**

1. **Final production backup:**

```bash
# Full database backup
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --clean --if-exists --create \
  > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file size
ls -lh prod_backup_*.sql
```

2. **Prepare rollback plan:**

```sql
-- Save rollback script
-- Drop new tables and policies
DROP TABLE IF EXISTS schedule_phases CASCADE;
ALTER TABLE scheduled_tasks DROP COLUMN IF EXISTS phase_id;
ALTER TABLE scheduled_tasks DROP COLUMN IF EXISTS visible_to_client;
DROP POLICY IF EXISTS "Users can view their company's scheduled tasks" ON scheduled_tasks;
-- ... (continue for all policies)
```

3. **Schedule maintenance window:**

- Announce to users: "Scheduled maintenance on [DATE] at [TIME]"
- Expected downtime: 30 minutes (migrations are fast, but plan for buffer)
- Send email/Slack notification 48 hours in advance

### Phase 5: Production Migration

**Timeline: Day 9 (during maintenance window)**

**Pre-Migration Checklist:**

- [ ] Backup completed and verified
- [ ] Rollback script ready
- [ ] Team on standby
- [ ] Monitoring dashboard open
- [ ] Communication channels ready

**Migration Steps:**

```bash
# 1. Put app in maintenance mode (if possible)
# Update Vercel/hosting with maintenance page

# 2. Connect to production database
psql postgresql://postgres:[PASSWORD]@db.prod.supabase.co:5432/postgres

# 3. Run migrations
\timing on  -- Show execution time
\i supabase/migrations/20260217_create_schedule_phases.sql
\i supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql
\i supabase/migrations/20260217_add_rls_policies.sql

# 4. Verify migrations
SELECT COUNT(*) FROM schedule_phases;
SELECT COUNT(*) FROM scheduled_tasks WHERE phase_id IS NULL;
-- Should be 0

# 5. Exit maintenance mode
# Deploy updated code with flag DISABLED initially
```

**Post-Migration Verification:**

- [ ] App loads normally
- [ ] No database errors in logs
- [ ] Legacy schedule works
- [ ] Test with 3 different users
- [ ] Monitor error tracking (Sentry, Bugsnag, etc.)

### Phase 6: Gradual Rollout

**Timeline: Days 10-16 (1 week)**

Enable feature flag gradually:

**Day 10: Internal Team Only (5%)**

```bash
# Enable for specific user IDs or companies
# Add server-side flag check:
const isInternalUser = ['user-1', 'user-2', 'user-3'].includes(user.id);
const USE_GANTT_V2 = process.env.EXPO_PUBLIC_ENABLE_GANTT_V2 === 'true' && isInternalUser;
```

- [ ] Internal team testing in production
- [ ] Monitor for errors
- [ ] Collect feedback

**Day 11: Beta Users (10%)**

```bash
# Expand to beta user group
const isBetaUser = user.betaProgram === true;
const USE_GANTT_V2 = process.env.EXPO_PUBLIC_ENABLE_GANTT_V2 === 'true' && isBetaUser;
```

- [ ] Beta users testing
- [ ] Monitor performance metrics
- [ ] Address any issues

**Day 13: 50% Rollout**

```bash
# Random 50% of users
const USE_GANTT_V2 = process.env.EXPO_PUBLIC_ENABLE_GANTT_V2 === 'true' &&
  Math.random() > 0.5;
```

- [ ] Monitor system load
- [ ] Check database performance
- [ ] Verify no RLS bottlenecks

**Day 15: 100% Rollout**

```bash
# All users
const USE_GANTT_V2 = process.env.EXPO_PUBLIC_ENABLE_GANTT_V2 === 'true';
```

- [ ] Full production deployment
- [ ] Intensive monitoring for 48 hours
- [ ] Team on-call for issues

### Phase 7: Stabilization

**Timeline: Days 17-23 (1 week)**

- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Address non-critical bugs
- [ ] Update documentation based on feedback

### Phase 8: Legacy Cleanup (Optional)

**Timeline: Day 30+ (after 2 weeks stable)**

Once new Gantt is stable:

1. **Remove feature flag:**

```typescript
// Before:
const USE_GANTT_V2 = process.env.EXPO_PUBLIC_ENABLE_GANTT_V2 === 'true';
if (USE_GANTT_V2) {
  return <GanttSchedule />;
}
return <LegacySchedule />;

// After:
return <GanttSchedule />;
```

2. **Delete legacy code:**

```bash
# Move old schedule code to archive
git mv app/(tabs)/schedule.tsx app/(tabs)/schedule.legacy.tsx.bak

# Or delete completely
# (Keep in git history for reference)
```

3. **Remove old constants:**

```typescript
// Remove these from schedule.tsx:
const DAY_WIDTH = 80;
const ROW_HEIGHT = 80;
const HOUR_HEIGHT = 80;
const LEFT_MARGIN = 60;
```

## Rollback Procedures

### Immediate Rollback (if critical issues found)

**Disable Feature Flag:**

```bash
# Fastest rollback - just disable flag
export EXPO_PUBLIC_ENABLE_GANTT_V2=false

# Redeploy
vercel --prod --env EXPO_PUBLIC_ENABLE_GANTT_V2=false
```

- Takes effect immediately
- Users see legacy schedule
- No data loss
- Investigate issue before re-enabling

### Database Rollback (if migrations failed)

**ONLY if absolutely necessary:**

```bash
# Restore from backup
psql postgresql://... < prod_backup_YYYYMMDD_HHMMSS.sql

# Or run rollback script
psql postgresql://... < rollback_script.sql
```

**WARNING:** This will lose any data created after migration!

## Monitoring

### Key Metrics to Watch

**Application Metrics:**

- Error rate (should be < 0.1%)
- Response time (API calls < 500ms)
- Client-side crashes
- JavaScript errors

**Database Metrics:**

- Query performance (slow queries?)
- Connection pool usage
- RLS policy performance
- Disk usage (growing as expected?)

**User Metrics:**

- Feature adoption rate
- User session duration
- Task completion rate
- User feedback sentiment

### Monitoring Tools

```bash
# Supabase Dashboard
# - Database → Performance
# - Check slow queries
# - Monitor RLS overhead

# Vercel Analytics
# - Check page load times
# - Monitor function duration
# - Track Web Vitals

# Error Tracking (Sentry/Bugsnag)
# - Monitor error rate
# - Group similar errors
# - Track error trends
```

### Alerts to Configure

```yaml
# Example alert rules
alerts:
  - name: High Error Rate
    condition: error_rate > 1%
    action: Notify on-call engineer

  - name: Slow Database Queries
    condition: query_duration > 1000ms
    action: Log to Slack

  - name: RLS Policy Overhead
    condition: rls_overhead > 100ms
    action: Review policy optimization
```

## Post-Deployment

### Success Criteria

After 2 weeks in production:

- [ ] Error rate < 0.1%
- [ ] No critical bugs
- [ ] User satisfaction score > 4/5
- [ ] Performance metrics within targets
- [ ] No security incidents
- [ ] Feature adoption > 80%

### Documentation Updates

- [ ] Update user guide with Gantt features
- [ ] Create video tutorials
- [ ] Update API documentation
- [ ] Document known issues/limitations
- [ ] Update internal wiki

### Team Training

- [ ] Train support team on new features
- [ ] Document common issues and solutions
- [ ] Create troubleshooting guide
- [ ] Update onboarding materials

## Troubleshooting Guide

### Issue: Migration fails with "relation already exists"

**Solution:**
```sql
-- Migrations are idempotent, but if you need to reset:
DROP TABLE IF EXISTS schedule_phases CASCADE;
ALTER TABLE scheduled_tasks DROP COLUMN IF EXISTS phase_id;
-- Then re-run migrations
```

### Issue: RLS policies too slow

**Solution:**
```sql
-- Check policy performance
EXPLAIN ANALYZE SELECT * FROM schedule_phases WHERE project_id = 'xxx';

-- Optimize if needed
CREATE INDEX idx_projects_company_id ON projects(company_id);
```

### Issue: Users see "Permission denied" error

**Solution:**
```sql
-- Verify user context
SELECT auth.uid();

-- Check company_id is set
SELECT company_id FROM users WHERE id = auth.uid();

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'schedule_phases';
```

## Communication Templates

### Pre-Deployment Announcement

```
Subject: Upcoming Schedule Feature Enhancement

Hi Team,

We're excited to announce a major upgrade to the Schedule feature!

**What's New:**
- Hierarchical project phases
- Drag & drop task scheduling
- Improved timeline views
- Better mobile experience

**When:**
- Rollout starts: [DATE]
- Expected completion: [DATE + 1 week]

**Impact:**
- No downtime expected
- All existing data preserved
- You can switch between old and new views

Questions? Reply to this email or check our help docs.

Thanks!
[Your Name]
```

### Post-Deployment Announcement

```
Subject: New Schedule Features Now Live!

Hi Team,

The new Schedule features are now live for all users! 🎉

**Key Features:**
- Organize tasks into phases
- Drag tasks to reschedule
- Zoom in/out on timeline
- Print clean schedules

**Getting Started:**
- Check out our video tutorial: [link]
- Read the user guide: [link]
- Contact support if you have questions

We'd love your feedback!
[Feedback Form Link]

Thanks!
[Your Name]
```

## Sign-Off

Before considering deployment complete:

- [ ] Technical lead approval
- [ ] Product manager approval
- [ ] QA sign-off
- [ ] Security review complete
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Training materials ready
- [ ] Support team trained
- [ ] Monitoring configured
- [ ] Rollback plan tested
- [ ] Success metrics defined
- [ ] Post-mortem scheduled (2 weeks post-launch)

---

**Deployment Owner:** _________________
**Date:** _________________
**Signature:** _________________
