# Gantt Chart Performance Guide

## Performance Optimizations Implemented

### 1. Memoization Strategy

All expensive computations are memoized to prevent unnecessary re-renders:

```typescript
// Phase hierarchy (only recalculates when phases or expandedPhases change)
const phaseHierarchy = useMemo(() => {
  const mainPhases = visiblePhases.filter(p => !p.parentPhaseId);
  return mainPhases.map(main => ({
    ...main,
    isExpanded: expandedPhases.has(main.id),
    subPhases: visiblePhases.filter(p => p.parentPhaseId === main.id),
  }));
}, [visiblePhases, expandedPhases]);

// Date range (only recalculates on zoom level change)
const visibleDates = useMemo(() => {
  // ... date generation logic
}, [dateRange, zoomLevel]);

// Task positions (only recalculates when tasks, dates, or cell width change)
const taskPositions = useMemo(() => {
  return tasks.map(task => ({ task, position: calculatePosition(task) }));
}, [tasks, dates, cellWidth, rowHeight]);
```

### 2. Optimistic Updates

All mutations use optimistic updates for instant UI feedback:

```typescript
const updateTaskMutation = async (id: string, updates: Partial<GanttTask>) => {
  // 1. Immediately update local state
  setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

  // 2. Save to database
  await fetch('/api/update-scheduled-task', { ... });

  // 3. On error, rollback and refetch
  // (handled in useGanttState hook)
};
```

### 3. Virtualization (Future Enhancement)

For projects with 100+ tasks, consider adding virtualization:

```typescript
// Install: expo install react-native-virtualized-view
import { VirtualizedList } from 'react-native';

// In GanttTimeline.tsx, replace ScrollView with VirtualizedList
<VirtualizedList
  data={taskPositions}
  getItem={(data, index) => data[index]}
  getItemCount={data => data.length}
  keyExtractor={item => item.task.id}
  renderItem={({ item }) => <TaskBar {...item} />}
/>
```

### 4. Date Range Limiting

Timeline only renders ±6 months from current date:

```typescript
const dateRange = useMemo(() => {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1); // Start 1 month ago
  const end = new Date(today);
  end.setMonth(end.getMonth() + 6); // End 6 months from now
  return { start, end };
}, []);
```

**Adjustment for larger projects:**
- Change to ±12 months if project spans longer
- Add "Load More" buttons at timeline edges

### 5. Gesture Performance

Using refs to avoid stale closures in drag/resize handlers:

```typescript
// Store drag state in ref (not state)
const activeDragRef = useRef<DragState | null>(null);

// Use functional setState to access latest state
setTasks(prevTasks => {
  const task = prevTasks.find(t => t.id === drag.taskId);
  // ... perform drag logic
  return updatedTasks;
});
```

This ensures 60fps during drag operations by avoiding re-renders.

### 6. Component Splitting

Large components are split into smaller, focused components:
- `GanttSchedule` → orchestration only
- `GanttSidebar` → phase tree
- `GanttTimeline` → grid + tasks
- `TaskBar` → individual task (can be memo'd)

### 7. Conditional Rendering

Only render what's visible:

```typescript
// In GanttTimeline, skip tasks outside visible date range
const taskPositions = useMemo(() => {
  return tasks.map(task => {
    const startIndex = dates.findIndex(d => d.toDateString() === task.startDate);
    if (startIndex === -1) return null; // Task not in visible range
    // ... calculate position
  }).filter(Boolean);
}, [tasks, dates]);
```

## Performance Benchmarks

Target performance metrics:

- **Initial Load**: < 2 seconds (50 tasks, 20 phases)
- **Drag Response**: < 16ms per frame (60fps)
- **Zoom Change**: < 100ms (recalculate positions)
- **Task Save**: < 500ms (API round-trip)
- **Memory Usage**: < 100MB (typical project)

## Monitoring Performance

### React DevTools Profiler

1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click "Record" → Interact with Gantt → Stop
4. Look for:
   - Components rendering too frequently
   - Long render times (> 50ms)
   - Unnecessary re-renders

### Chrome Performance Tab

1. Open DevTools → Performance tab
2. Click "Record" → Interact with Gantt → Stop
3. Look for:
   - Frame drops (should maintain 60fps)
   - Long tasks (> 50ms blocks main thread)
   - Memory leaks (increasing heap size)

### React Native Performance Monitor

On mobile:
1. Shake device → Enable "Show Perf Monitor"
2. Look for:
   - JS frame rate (should be 60fps)
   - UI frame rate (should be 60fps)
   - Memory usage (should be stable)

## Common Performance Issues

### Issue: Drag is laggy

**Cause**: Too many re-renders during drag
**Solution**: Ensure using refs + functional setState pattern

```typescript
// ❌ Bad: causes re-render on every drag move
const [draggedTask, setDraggedTask] = useState<GanttTask | null>(null);

// ✅ Good: only update ref, no re-render
const draggedTaskRef = useRef<GanttTask | null>(null);
```

### Issue: Zoom change is slow

**Cause**: Recalculating all task positions
**Solution**: Add debouncing to zoom controls

```typescript
const debouncedZoomIn = useMemo(() =>
  debounce(() => zoomIn(), 100),
  [zoomIn]
);
```

### Issue: Timeline scrolling is janky

**Cause**: Too many tasks rendering at once
**Solution**: Implement virtualization (see section 3 above)

### Issue: Memory leak when switching projects

**Cause**: Listeners not cleaned up
**Solution**: Ensure cleanup in useEffect

```typescript
useEffect(() => {
  const listener = addGestureListener();

  return () => {
    listener.remove(); // Cleanup on unmount
  };
}, []);
```

## Production Optimizations

### 1. Enable Production Mode

In `.env.production`:
```bash
# Disable debug logs
EXPO_PUBLIC_DEBUG=false

# Enable production optimizations
NODE_ENV=production
```

### 2. Code Splitting (Web)

```typescript
// Lazy load Gantt Chart for web
const GanttSchedule = lazy(() => import('@/components/GanttChart'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <GanttSchedule {...props} />
</Suspense>
```

### 3. Image Optimization

If using images in task bars:
```typescript
// Use expo-image for better performance
import { Image } from 'expo-image';

<Image
  source={{ uri: task.imageUrl }}
  contentFit="cover"
  cachePolicy="memory-disk"
/>
```

### 4. Database Indexing

Ensure indexes exist on:
- `scheduled_tasks.project_id`
- `scheduled_tasks.phase_id`
- `scheduled_tasks.start_date`
- `schedule_phases.project_id`
- `schedule_phases.parent_phase_id`

(Already created in migrations)

## Scaling Guidelines

### Small Projects (< 50 tasks)
- Use default configuration
- No virtualization needed
- Full date range rendering OK

### Medium Projects (50-200 tasks)
- Limit date range to ±6 months
- Consider phase grouping
- Monitor memory usage

### Large Projects (200+ tasks)
- **Must** implement virtualization
- Limit date range to ±3 months
- Add "Load More" pagination
- Consider backend filtering by date range

### Enterprise (1000+ tasks)
- Backend-side filtering required
- Virtualization mandatory
- Paginated phase loading
- Consider alternative views (table, list)
- Add search/filter UI

## Performance Checklist

Before deploying to production:

- [ ] Run React DevTools Profiler - no unnecessary re-renders
- [ ] Test with 100+ tasks - maintains 60fps during drag
- [ ] Test zoom changes - completes in < 100ms
- [ ] Test on low-end devices - iPhone 8, Android mid-range
- [ ] Monitor memory usage - no leaks over 5 min usage
- [ ] Test offline mode - works without network
- [ ] Test with slow 3G - acceptable load times
- [ ] Profile with Chrome DevTools - no long tasks
- [ ] Check bundle size - Gantt components < 200KB gzipped
- [ ] Verify memoization - only expected components re-render

## Future Enhancements

1. **Web Workers** (web only)
   - Offload date calculations to worker thread
   - Calculate task positions in background

2. **Incremental Rendering**
   - Render visible tasks first
   - Lazy load off-screen tasks

3. **Caching Layer**
   - Cache computed positions in IndexedDB/AsyncStorage
   - Invalidate on data change

4. **Smart Updates**
   - Only re-render changed tasks
   - Use React.memo() with custom comparison

5. **Progressive Enhancement**
   - Basic table view loads first
   - Upgrade to interactive Gantt after hydration
