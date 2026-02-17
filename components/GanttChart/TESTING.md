# Gantt Chart Testing Guide

Comprehensive testing checklist for cross-platform deployment.

## Pre-Deployment Checklist

### Database

- [ ] **Migrations executed successfully**
  ```bash
  psql -f supabase/migrations/20260217_create_schedule_phases.sql
  psql -f supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql
  psql -f supabase/migrations/20260217_add_rls_policies.sql
  ```

- [ ] **Verify table structure**
  ```sql
  \d schedule_phases
  \d scheduled_tasks
  ```

- [ ] **Verify indexes exist**
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename = 'schedule_phases';
  SELECT indexname FROM pg_indexes WHERE tablename = 'scheduled_tasks';
  ```

- [ ] **Verify RLS enabled**
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' AND tablename IN ('schedule_phases', 'scheduled_tasks');
  ```

- [ ] **Test data migration**
  ```sql
  -- Check that existing tasks have phase_id
  SELECT COUNT(*) FROM scheduled_tasks WHERE phase_id IS NULL;
  -- Should be 0

  -- Check that phases were created
  SELECT COUNT(*) FROM schedule_phases;
  -- Should match number of unique (category, project_id) combinations
  ```

### API Endpoints

Test with curl or Postman:

- [ ] **GET /api/get-schedule-phases?projectId=XXX**
  - Returns 200 status
  - Returns phases array
  - Phases ordered by `order_index`

- [ ] **POST /api/save-schedule-phase**
  - Creates new phase
  - Returns created phase with ID
  - Validates required fields

- [ ] **PUT /api/update-schedule-phase**
  - Updates existing phase
  - Returns updated phase
  - Validates phase exists

- [ ] **DELETE /api/delete-schedule-phase?id=XXX**
  - Deletes phase
  - Cascades to child phases (if any)
  - Cascades to tasks (if any)

- [ ] **Updated task endpoints include phase_id**
  - GET returns `phase_id` and `visible_to_client`
  - POST accepts `phase_id` and `visible_to_client`
  - PUT accepts `phase_id` and `visible_to_client`

### Environment

- [ ] **Feature flag configured**
  ```bash
  # In .env
  EXPO_PUBLIC_ENABLE_GANTT_V2=true
  ```

- [ ] **Environment variables loaded**
  ```bash
  npm run start -- --clear
  ```

- [ ] **Verify flag is active**
  ```typescript
  console.log('USE_GANTT_V2:', process.env.EXPO_PUBLIC_ENABLE_GANTT_V2);
  ```

## Functional Testing

### Phase Management

**Create Main Phase:**
1. Open schedule screen
2. Click "Add Phase" button
3. Enter name: "Foundation"
4. Select color: Red (#EF4444)
5. Leave "Visible to Client" ON
6. Click Save
7. ✅ Phase appears in sidebar
8. ✅ Phase saved to database

**Create Sub-Phase:**
1. Click on "Foundation" phase
2. Click "Add Sub-Phase" (if implemented)
3. Enter name: "Footings"
4. Select color: Dark Red
5. Click Save
6. ✅ Sub-phase appears indented under "Foundation"
7. ✅ `parent_phase_id` set correctly in database

**Edit Phase:**
1. Click phase row
2. Change name to "Foundation Work"
3. Toggle "Visible to Client" OFF
4. Click Save
5. ✅ Name updated in sidebar
6. ✅ Phase hidden in client view
7. ✅ Database updated

**Delete Phase:**
1. Click phase row
2. Click Delete button
3. Confirm deletion
4. ✅ Phase removed from sidebar
5. ✅ Tasks in phase also deleted (cascade)
6. ✅ Database record deleted

**Expand/Collapse:**
1. Click chevron icon on phase with sub-phases
2. ✅ Sub-phases appear/disappear
3. ✅ Icon changes (chevron right → down)
4. ✅ Accordion animation smooth

### Task Management

**Create Task:**
1. Click "Add Task" or double-click grid cell
2. Fill form:
   - Category: "Pour Concrete"
   - Start Date: Today
   - End Date: Today + 3 days
   - Work Type: In-House
   - Notes: "Order ready-mix"
   - Visible to Client: ON
3. Click Save
4. ✅ Task appears in timeline
5. ✅ Task saved to database
6. ✅ Duration calculated correctly (4 days)

**Edit Task:**
1. Click task bar
2. Modal opens with current values
3. Change end date to +5 days
4. Change work type to Subcontractor
5. Add note: "Confirmed with vendor"
6. Click Save
7. ✅ Task bar extends to new end date
8. ✅ "SUB" badge appears
9. ✅ Database updated

**Delete Task:**
1. Click task bar
2. Click Delete button (trash icon)
3. Confirm deletion
4. ✅ Task removed from timeline
5. ✅ Database record deleted

**Toggle Client Visibility:**
1. Edit task
2. Toggle "Visible to Client" OFF
3. Save
4. Switch to client view
5. ✅ Task hidden in client view
6. ✅ Still visible in internal view

### Drag & Drop

**Drag Task Horizontally:**
1. Touch and hold task bar
2. Drag right 3 cells (3 days)
3. Release
4. ✅ Task moves to new date
5. ✅ Start/end dates updated
6. ✅ Database saved
7. ✅ Smooth animation (60fps)

**Drag Task Vertically:**
1. Touch and hold task bar
2. Drag down 2 rows
3. Release
4. ✅ Task moves to new row
5. ✅ Row value updated in database
6. ✅ No overlap with other tasks

**Collision Detection:**
1. Create two overlapping tasks on same row
2. Drag one task over the other
3. ✅ Dragged task auto-shifts to next available row
4. ✅ Console logs collision detection
5. ✅ Final position has no overlap

**Drag Across Phases:**
1. Drag task from "Foundation" row to "Framing" row
2. Release
3. ✅ Task moves to new phase
4. ✅ `phase_id` updated in database

### Resize

**Extend Task Duration:**
1. Touch right edge of task bar (white handle)
2. Drag right 2 cells
3. Release
4. ✅ Task extends by 2 days
5. ✅ Duration increased by 2
6. ✅ End date updated
7. ✅ Database saved

**Shorten Task Duration:**
1. Touch right edge of task bar
2. Drag left 1 cell
3. Release
4. ✅ Task shortens by 1 day
5. ✅ Minimum duration = 1 day enforced
6. ✅ Database saved

**Resize Performance:**
1. Resize task rapidly (drag back and forth)
2. ✅ No lag or jank
3. ✅ Maintains 60fps
4. ✅ Final state saves correctly

### Zoom & Pan

**Zoom In:**
1. Click "+" button
2. ✅ Cell width increases (+20px)
3. ✅ Timeline expands
4. ✅ Task bars grow proportionally
5. ✅ Max zoom enforced (120px)

**Zoom Out:**
1. Click "-" button
2. ✅ Cell width decreases (-20px)
3. ✅ Timeline shrinks
4. ✅ Task bars shrink proportionally
5. ✅ Min zoom enforced (40px)

**Switch Zoom Levels:**
1. Click "Day" button
2. ✅ Each cell = 1 day, 80px wide
3. Click "Week" button
4. ✅ Each cell = 1 week, 48px wide
5. Click "Month" button
6. ✅ Each cell = 1 month, 32px wide

**Pan Controls:**
1. Click left arrow
2. ✅ Timeline scrolls left smoothly
3. Click right arrow
4. ✅ Timeline scrolls right smoothly
5. Click "⟨⟨" (pan to start)
6. ✅ Scrolls to beginning
7. Click "⟩⟩" (pan to end)
8. ✅ Scrolls to end

### Role-Based Views

**Internal View:**
1. Log in as admin/employee
2. Open schedule
3. ✅ All tasks visible (including `visible_to_client = false`)
4. ✅ Can drag/resize/edit tasks
5. ✅ Work type visible
6. ✅ Notes visible
7. ✅ "Add Phase" button visible

**Client View:**
1. Log in as client user
2. Open schedule
3. ✅ Only tasks with `visible_to_client = true` shown
4. ✅ Cannot drag/resize tasks (read-only)
5. ✅ Work type hidden
6. ✅ Notes hidden
7. ✅ "Add Phase" button hidden
8. ✅ Task modal shows limited fields

### Print/Export

**Print Preview (Web):**
1. Click "Print" button
2. ✅ Print preview modal opens
3. ✅ Clean table layout (no timeline grid)
4. ✅ All phases grouped
5. ✅ Task details visible (name, dates, duration, type)
6. ✅ Project name in header
7. ✅ Print date shown
8. ✅ Summary stats at bottom

**Print to PDF (Web):**
1. In print preview, select "Save as PDF"
2. ✅ PDF generates successfully
3. ✅ Layout is clean and readable
4. ✅ Page breaks sensible
5. ✅ Colors preserved

**Mobile Print:**
1. Click "Print" button on mobile
2. ✅ Alert appears (react-native-print not yet integrated)
3. ✅ Placeholder message shown

## Responsive Testing

### Mobile (< 768px)

- [ ] **iPhone 13 (390x844)**
  - Sidebar: 120px wide
  - Row height: 60px
  - Font sizes reduced
  - Touch targets: ≥ 44x44px

- [ ] **Galaxy S21 (360x800)**
  - All content visible
  - No horizontal scroll (except timeline)
  - Buttons accessible

- [ ] **Gestures work**
  - Tap task → modal opens
  - Long press → drag starts
  - Pinch zoom → disabled (use zoom buttons)

### Tablet (768-1024px)

- [ ] **iPad Air (820x1180)**
  - Sidebar: 180px wide
  - Row height: 80px
  - Comfortable touch targets

- [ ] **Landscape mode**
  - More timeline visible
  - Controls fit in header

### Desktop (> 1024px)

- [ ] **MacBook (1440x900)**
  - Sidebar: 220px wide
  - Row height: 80px
  - Mouse interactions work

- [ ] **Large monitor (1920x1080)**
  - Layout scales appropriately
  - No excessive white space

## Cross-Platform Testing

### iOS

- [ ] **iPhone SE (iOS 15)**
  - App loads
  - Gantt renders
  - Drag works
  - No crashes

- [ ] **iPhone 14 Pro (iOS 17)**
  - Safe area insets respected
  - Dynamic Island not obscured
  - Gestures smooth

- [ ] **iPad (iPadOS 16)**
  - Split view supported
  - Keyboard shortcuts work (future)

### Android

- [ ] **Pixel 5 (Android 12)**
  - App loads
  - Gantt renders
  - Drag works
  - No crashes

- [ ] **Samsung S22 (Android 13)**
  - One UI compatible
  - Gestures smooth

- [ ] **Low-end device (Android 10)**
  - Performance acceptable
  - No lag during drag

### Web

- [ ] **Chrome (latest)**
  - Full functionality
  - Print works
  - No console errors

- [ ] **Safari (latest)**
  - Full functionality
  - Date pickers work
  - No webkit issues

- [ ] **Firefox (latest)**
  - Full functionality
  - No rendering issues

- [ ] **Edge (latest)**
  - Full functionality

## Performance Testing

### Load Testing

- [ ] **10 tasks, 5 phases**
  - Initial load: < 1s
  - Drag response: 60fps

- [ ] **50 tasks, 20 phases**
  - Initial load: < 2s
  - Drag response: 60fps

- [ ] **100 tasks, 30 phases**
  - Initial load: < 3s
  - Drag response: ≥ 30fps
  - Consider virtualization

### Memory Testing

- [ ] **Open Gantt for 5 minutes**
  - Memory stable (no leaks)
  - Heap size constant

- [ ] **Drag 50 times**
  - Memory stable
  - No accumulation

- [ ] **Switch projects 10 times**
  - Memory released
  - No zombie listeners

### Network Testing

- [ ] **Fast 4G (20ms latency)**
  - Acceptable load time
  - Optimistic updates feel instant

- [ ] **Slow 3G (500ms latency)**
  - Loading indicator shown
  - Optimistic updates still instant
  - Error handling on timeout

- [ ] **Offline**
  - Cached data shown
  - Mutations queued (future enhancement)
  - Error message on save failure

## Security Testing

### Authentication

- [ ] **Unauthenticated user**
  - Cannot access API endpoints
  - Gets 401/403 errors

- [ ] **Authenticated user**
  - Can access own company's data
  - Cannot access other company's data

### Authorization (RLS)

- [ ] **User A (Company 1) tries to:**
  - View Company 2's phases → Blocked by RLS
  - Edit Company 2's tasks → Blocked by RLS
  - Delete Company 2's data → Blocked by RLS

- [ ] **SQL injection attempts**
  - API validates input
  - Supabase parameterizes queries
  - No SQL injection possible

### Data Validation

- [ ] **Create task with invalid dates**
  - End before start → Rejected
  - Missing required fields → Rejected

- [ ] **Create phase with invalid data**
  - Empty name → Rejected
  - Invalid color → Rejected (or default used)

## Regression Testing

After any code changes, verify:

- [ ] Legacy schedule still works (flag = false)
- [ ] New Gantt works (flag = true)
- [ ] Can switch between views
- [ ] Database migrations idempotent (safe to re-run)
- [ ] No broken imports
- [ ] No TypeScript errors
- [ ] Build succeeds: `npm run build`

## Accessibility Testing

(Future enhancement - not yet implemented)

- [ ] **Screen reader support**
  - Task bars have labels
  - Buttons have aria-labels

- [ ] **Keyboard navigation**
  - Tab through controls
  - Enter to activate
  - Arrows to navigate

- [ ] **Color contrast**
  - WCAG AA compliant
  - Text readable on all backgrounds

- [ ] **Focus indicators**
  - Visible focus ring
  - High contrast mode supported

## Bug Report Template

When filing a bug, include:

```markdown
**Environment:**
- Platform: iOS / Android / Web
- Device: iPhone 14 / Galaxy S21 / Chrome Desktop
- OS Version: iOS 17.1 / Android 13 / macOS 14
- App Version: 1.2.3

**Steps to Reproduce:**
1. Open schedule screen
2. Drag task to new date
3. Release

**Expected Behavior:**
Task should move to new date and save.

**Actual Behavior:**
Task snaps back to original position.

**Screenshots/Video:**
[Attach here]

**Console Logs:**
```
[Error] Failed to update task: 500 Internal Server Error
```

**Additional Context:**
Only happens with tasks in "Foundation" phase.
```

## Sign-Off Checklist

Before deploying to production:

- [ ] All functional tests pass
- [ ] All cross-platform tests pass
- [ ] All performance benchmarks met
- [ ] Security audit completed
- [ ] No critical bugs
- [ ] Stakeholders approved
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Team trained on new features
- [ ] Documentation updated
- [ ] Release notes written
