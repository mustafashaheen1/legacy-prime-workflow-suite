# Gantt Chart Component Library

Professional, hierarchical project schedule visualization for React Native and Web.

## Features

✅ **Hierarchical Phase Organization** - Main phases with expandable sub-phases
✅ **Interactive Drag & Drop** - Move tasks to new dates/rows with collision detection
✅ **Resize Tasks** - Drag edges to adjust duration
✅ **Zoom Controls** - Day/Week/Month timeline scales
✅ **Pan Controls** - Navigate timeline with arrow buttons
✅ **Task Detail Modal** - Full CRUD with all task fields
✅ **Role-Based Views** - Internal vs Client visibility controls
✅ **Print/PDF Export** - Clean table layout for printing
✅ **Responsive Design** - Mobile, Tablet, Desktop breakpoints
✅ **Optimistic Updates** - Instant UI feedback with database sync
✅ **Cross-Platform** - Works on iOS, Android, and Web

## Installation

The Gantt Chart is already integrated into the codebase. To enable it:

### 1. Run Database Migrations

```bash
# Connect to your Supabase database
psql postgresql://[your-connection-string]

# Run migrations in order
\i supabase/migrations/20260217_create_schedule_phases.sql
\i supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql
\i supabase/migrations/20260217_add_rls_policies.sql
```

### 2. Enable Feature Flag

Add to your `.env` file:

```bash
# Enable new Gantt Chart UI (default: false)
EXPO_PUBLIC_ENABLE_GANTT_V2=true
```

### 3. Restart Development Server

```bash
npm run start -- --clear
```

## Usage

### Basic Example

```typescript
import { GanttSchedule } from '@/components/GanttChart';

export default function MyScheduleScreen() {
  return (
    <GanttSchedule
      projectId="project-123"
      projectName="Construction Project"
      viewMode="internal"
    />
  );
}
```

### Advanced Example

```typescript
import { GanttSchedule } from '@/components/GanttChart';
import { GanttTask, SchedulePhase } from '@/types';

export default function MyScheduleScreen() {
  const handleTaskClick = (task: GanttTask) => {
    console.log('Task clicked:', task.category);
  };

  const handlePhaseClick = (phase: SchedulePhase) => {
    console.log('Phase clicked:', phase.name);
  };

  return (
    <GanttSchedule
      projectId="project-123"
      projectName="Construction Project"
      viewMode="internal"
      onTaskClick={handleTaskClick}
      onPhaseClick={handlePhaseClick}
    />
  );
}
```

## Component API

### GanttSchedule Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `projectId` | `string \| null` | Yes | - | ID of the project to display |
| `projectName` | `string` | No | - | Project name (shown in header) |
| `viewMode` | `'internal' \| 'client'` | No | `'internal'` | View mode for role-based filtering |
| `onTaskClick` | `(task: GanttTask) => void` | No | - | Callback when task is clicked |
| `onPhaseClick` | `(phase: SchedulePhase) => void` | No | - | Callback when phase is clicked |

### State Management

The component uses custom hooks for state management:

```typescript
// Centralized data fetching and CRUD
const {
  phases,
  tasks,
  isLoadingPhases,
  isLoadingTasks,
  createPhase,
  updatePhase,
  deletePhase,
  createTask,
  updateTask,
  deleteTask,
} = useGanttState({ projectId });

// Responsive breakpoints
const {
  isMobile,
  isTablet,
  isDesktop,
  sidebarWidth,
  rowHeight,
  // ... more responsive values
} = useGanttResponsive();

// Zoom controls
const {
  cellWidth,
  zoomLevel,
  zoomIn,
  zoomOut,
  setZoomLevel,
} = useGanttZoom(defaultCellWidth, minCellWidth, maxCellWidth);

// Drag interactions
const {
  draggedTaskId,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
} = useGanttDrag({ ... });

// Resize interactions
const {
  resizingTask,
  handleResizeStart,
  handleResizeMove,
  handleResizeEnd,
} = useGanttResize({ ... });
```

## Architecture

### Component Structure

```
/components/GanttChart/
├── GanttSchedule.tsx           # Main container
├── GanttSidebar/
│   ├── GanttSidebar.tsx       # Phase list container
│   ├── PhaseAccordion.tsx     # Expandable phase group
│   ├── PhaseRow.tsx           # Individual phase row
│   └── AddPhaseButton.tsx     # "+" button
├── GanttTimeline/
│   ├── GanttTimeline.tsx      # Timeline container
│   ├── TimelineHeader.tsx     # Date labels
│   ├── TimelineGrid.tsx       # Background grid
│   ├── TaskBar.tsx            # Task visualization
│   └── TaskResizeHandle.tsx   # Drag handles
├── GanttControls/
│   ├── GanttControls.tsx      # Control bar
│   ├── ZoomControls.tsx       # +/- zoom buttons
│   └── PanControls.tsx        # Navigation arrows
├── TaskModal/
│   ├── TaskDetailModal.tsx    # Edit modal
│   └── TaskFormFields.tsx     # Form inputs
├── PrintExport/
│   ├── PrintScheduleButton.tsx   # Print button
│   └── PrintableScheduleView.tsx # Print layout
└── hooks/
    ├── useGanttState.ts       # State management
    ├── useGanttResponsive.ts  # Breakpoints
    ├── useGanttZoom.ts        # Zoom controls
    ├── useGanttDrag.ts        # Drag logic
    └── useGanttResize.ts      # Resize logic
```

### Data Flow

1. **User Interaction** → Component (e.g., TaskBar)
2. **Component** → Hook (e.g., useGanttDrag)
3. **Hook** → Optimistic Update (setState)
4. **Hook** → API Call (fetch)
5. **API** → Database (Supabase)
6. **Success** → Hook refreshes data
7. **Error** → Hook rolls back optimistic update

### Database Schema

```sql
-- Hierarchical phases
schedule_phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_phase_id TEXT, -- NULL for main phases
  order_index INTEGER,
  color TEXT,
  visible_to_client BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Tasks linked to phases
scheduled_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  duration INTEGER,
  work_type TEXT, -- 'in-house' | 'subcontractor'
  notes TEXT,
  color TEXT,
  row INTEGER,
  row_span INTEGER,
  phase_id TEXT, -- FK to schedule_phases
  visible_to_client BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Features in Detail

### 1. Hierarchical Phases

Create a main phase:
1. Click "Add Phase" button in sidebar
2. Enter phase name and color
3. Choose whether visible to clients

Create a sub-phase:
1. Click on a main phase to select it
2. Click "Add Sub-Phase"
3. Sub-phase appears indented under parent

### 2. Drag & Drop Tasks

Move a task:
1. Touch and hold task bar
2. Drag to new date/row
3. Release to drop
4. Auto-saves to database

**Features:**
- Grid snapping (tasks snap to day/row boundaries)
- Collision detection (auto-shifts to next available row)
- Visual feedback (opacity change during drag)

### 3. Resize Tasks

Extend task duration:
1. Drag the right edge of task bar
2. Task duration updates in real-time
3. Release to save

**Note:** Only horizontal resize (duration) is implemented. Vertical resize (rowSpan) can be added if needed.

### 4. Zoom Controls

Three zoom levels:
- **Day**: Each cell = 1 day (80px wide)
- **Week**: Each cell = 1 week (48px wide)
- **Month**: Each cell = 1 month (32px wide)

Manual zoom:
- Use +/- buttons to adjust cell width
- Range: 40px (min) to 120px (max)

### 5. Role-Based Views

**Internal View** (role !== 'client'):
- See all phases and tasks
- Can edit, drag, resize, delete
- See internal notes and work type

**Client View** (role === 'client'):
- Only see tasks/phases where `visible_to_client = true`
- Read-only (cannot edit or drag)
- Internal notes hidden

### 6. Print/Export

Print schedule:
1. Click "Print" button in control bar
2. Clean table layout opens
3. Browser print dialog appears (web)
4. Export as PDF using browser print-to-PDF

**Printable view includes:**
- Project name and print date
- All phases grouped
- Task details (name, dates, duration, type)
- Summary stats

## Keyboard Shortcuts

(Future enhancement - not yet implemented)

- `←` `→` Pan left/right
- `+` `-` Zoom in/out
- `Esc` Close modal
- `Delete` Delete selected task

## Migration from Legacy Schedule

### Backward Compatible

The new Gantt Chart is **fully backward compatible**:

1. **Existing tasks migrate automatically**
   - Migration creates phases from existing categories
   - Links tasks to generated phases
   - No data loss

2. **Feature flag allows gradual rollout**
   - Old UI still works when flag is `false`
   - Test new UI on staging first
   - Switch production when ready

3. **Dual API support**
   - New endpoints: `/api/*-schedule-phase`
   - Updated endpoints: `/api/*-scheduled-task` (now include `phase_id`)
   - Old endpoints still work

### Migration Steps

1. **Backup database** (always backup before migrations!)
2. **Run migrations** on dev/staging first
3. **Enable flag** on staging: `EXPO_PUBLIC_ENABLE_GANTT_V2=true`
4. **Test thoroughly** (see Testing Guide below)
5. **Monitor** for 1 week on staging
6. **Enable flag** on production
7. **Monitor** for 1 week on production
8. **Remove old code** after stable (optional)

## Testing Guide

### Manual Testing Checklist

**Phase Management:**
- [ ] Create main phase
- [ ] Create sub-phase
- [ ] Rename phase
- [ ] Delete phase (verify cascade deletes tasks)
- [ ] Reorder phases (drag to change order)
- [ ] Toggle phase visibility to client

**Task Management:**
- [ ] Create task in phase
- [ ] Edit task (change dates, notes, work type)
- [ ] Delete task
- [ ] Toggle task visibility to client

**Interactions:**
- [ ] Drag task to new date
- [ ] Drag task to new row
- [ ] Drag task across phases
- [ ] Resize task (extend duration)
- [ ] Verify collision detection (auto-shift)

**Zoom/Pan:**
- [ ] Zoom in (+)
- [ ] Zoom out (-)
- [ ] Switch to day view
- [ ] Switch to week view
- [ ] Switch to month view
- [ ] Pan left/right with arrows
- [ ] Pan to start/end

**Role-Based:**
- [ ] Internal view shows all tasks
- [ ] Client view hides internal tasks
- [ ] Client view is read-only

**Print:**
- [ ] Print button opens preview
- [ ] Printable view is clean
- [ ] Exports as PDF

**Responsive:**
- [ ] Test on mobile (< 768px)
- [ ] Test on tablet (768-1024px)
- [ ] Test on desktop (> 1024px)

**Cross-Platform:**
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Works on Web Chrome
- [ ] Works on Web Safari
- [ ] Works on Web Firefox

### Automated Testing

(Future enhancement - test suite not yet implemented)

```typescript
// Example: __tests__/GanttSchedule.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { GanttSchedule } from '@/components/GanttChart';

describe('GanttSchedule', () => {
  it('renders project schedule', () => {
    const { getByText } = render(
      <GanttSchedule projectId="test-123" projectName="Test Project" />
    );
    expect(getByText('Test Project')).toBeTruthy();
  });

  it('allows dragging tasks', () => {
    // Test drag interaction
  });

  it('filters tasks in client view', () => {
    // Test role-based filtering
  });
});
```

## Troubleshooting

### Issue: Gantt Chart not showing

**Check:**
1. Feature flag enabled: `EXPO_PUBLIC_ENABLE_GANTT_V2=true`
2. Migrations run successfully
3. Project ID is valid
4. No console errors

### Issue: Tasks not saving

**Check:**
1. API endpoints responding (check Network tab)
2. Supabase credentials configured
3. RLS policies allow access
4. User is authenticated

### Issue: Drag is laggy

**Fix:**
1. Reduce number of visible tasks (limit date range)
2. Check for expensive re-renders (use React DevTools)
3. Ensure using production build, not dev

### Issue: Client view showing internal tasks

**Check:**
1. Task `visible_to_client = true` in database
2. User role is correctly set to 'client'
3. ViewMode prop is 'client'

## Performance

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed performance guide.

**Key metrics:**
- Initial load: < 2s (50 tasks)
- Drag response: 60fps
- Memory usage: < 100MB

## Contributing

### Adding New Features

1. Create new component in appropriate subfolder
2. Export from `index.ts`
3. Update this README
4. Add to PERFORMANCE.md if impacts performance
5. Test on all platforms

### Code Style

- Use TypeScript strict mode
- Follow existing component patterns
- Add JSDoc comments for public APIs
- Use meaningful variable names
- Keep components small (< 300 lines)

## License

Proprietary - Part of Prime Workflow Suite

## Support

For issues or questions:
1. Check this README
2. Check PERFORMANCE.md
3. Check existing GitHub issues
4. Create new issue with reproduction steps
