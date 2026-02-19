import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { SchedulePhase, GanttTask, ScheduleViewMode } from '@/types';
import { useGanttState } from './hooks/useGanttState';
import { useGanttResponsive } from './hooks/useGanttResponsive';
import { useGanttZoom } from './hooks/useGanttZoom';
import { useGanttDrag } from './hooks/useGanttDrag';
import { useGanttResize } from './hooks/useGanttResize';
import GanttSidebar from './GanttSidebar/GanttSidebar';
import GanttTimeline, { GanttRow } from './GanttTimeline/GanttTimeline';
import GanttControls from './GanttControls/GanttControls';
import TaskDetailModal from './TaskModal/TaskDetailModal';
import AddPhaseModal from './AddPhaseModal/AddPhaseModal';

interface GanttScheduleProps {
  projectId: string | null;
  projectName?: string;
  /** 'internal' (default) or 'client' — controls visibility and editability */
  viewMode?: ScheduleViewMode;
  /** Convenience alias: true = client read-only view */
  isClientView?: boolean;
  onTaskClick?: (task: GanttTask) => void;
  onPhaseClick?: (phase: SchedulePhase) => void;
}

/**
 * Main Gantt Chart orchestrator.
 *
 * Split layout:
 *   Left  → sticky phase sidebar with accordion expand/collapse
 *   Right → horizontally scrollable timeline with date header + task bars
 *
 * Features:
 *   - Zoom in/out (Day / Week / Month)
 *   - Pan left/right via buttons (timeline also natively scrollable by drag)
 *   - Click empty cell → create task in that phase at that date
 *   - Drag task bar horizontally → move start/end date
 *   - Drag right edge of task bar → extend duration
 *   - Task Detail Modal: edit dates, work type, notes, visibility, mark completed
 *   - Add Phase / Add Sub-Phase with color picker
 *   - Client view: read-only, hides notes/work-type/internal tasks
 */
export default function GanttSchedule({
  projectId,
  projectName,
  viewMode,
  isClientView = false,
  onTaskClick,
  onPhaseClick,
}: GanttScheduleProps) {
  // ── Resolve effective view mode ─────────────────────────────────────────────
  const effectiveViewMode: ScheduleViewMode =
    viewMode ?? (isClientView ? 'client' : 'internal');

  // ── Responsive config ───────────────────────────────────────────────────────
  const responsive = useGanttResponsive();

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const { cellWidth, zoomLevel, zoomIn, zoomOut, setZoomLevel } = useGanttZoom(
    responsive.defaultCellWidth,
    responsive.minCellWidth,
    responsive.maxCellWidth
  );

  // ── Data ─────────────────────────────────────────────────────────────────────
  const {
    phases,
    tasks,
    isLoadingPhases,
    isLoadingTasks,
    createPhase,
    createTask,
    updateTask,
    deleteTask,
    setTasks,
  } = useGanttState({ projectId });

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Add Phase modal
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [addPhaseParentId, setAddPhaseParentId] = useState<string | null>(null);
  const addPhaseParentName = useMemo(() => {
    if (!addPhaseParentId) return undefined;
    return phases.find(p => p.id === addPhaseParentId)?.name;
  }, [addPhaseParentId, phases]);

  // Scroll position tracking for button-based pan
  const scrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);

  // ── Date range ───────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 6);
    return { start, end };
  }, []);

  // ── Visible dates (depends on zoom level) ────────────────────────────────────
  const visibleDates = useMemo(() => {
    const dates: Date[] = [];
    const current = new Date(dateRange.start);
    while (current <= dateRange.end) {
      dates.push(new Date(current));
      switch (zoomLevel) {
        case 'day':   current.setDate(current.getDate() + 1); break;
        case 'week':  current.setDate(current.getDate() + 7); break;
        case 'month': current.setMonth(current.getMonth() + 1); break;
      }
    }
    return dates;
  }, [dateRange, zoomLevel]);

  // ── Filter by view mode ───────────────────────────────────────────────────────
  const visiblePhases = useMemo(() =>
    effectiveViewMode === 'internal' ? phases : phases.filter(p => p.visibleToClient),
    [phases, effectiveViewMode]
  );

  const visibleTasks = useMemo(() =>
    effectiveViewMode === 'internal' ? tasks : tasks.filter(t => t.visibleToClient),
    [tasks, effectiveViewMode]
  );

  // ── Phase hierarchy ───────────────────────────────────────────────────────────
  const phaseHierarchy = useMemo(() => {
    const mainPhases = visiblePhases
      .filter(p => !p.parentPhaseId)
      .sort((a, b) => a.order - b.order);

    return mainPhases.map(main => ({
      ...main,
      isExpanded: expandedPhases.has(main.id),
      subPhases: visiblePhases
        .filter(p => p.parentPhaseId === main.id)
        .sort((a, b) => a.order - b.order)
        .map(sub => ({ ...sub, isExpanded: false })),
    }));
  }, [visiblePhases, expandedPhases]);

  // ── Visible rows (flattened for timeline phase-row alignment) ─────────────────
  const visibleRows = useMemo((): GanttRow[] => {
    const rows: GanttRow[] = [];
    phaseHierarchy.forEach(main => {
      rows.push({ phase: main, depth: 0 });
      if (main.isExpanded) {
        main.subPhases.forEach(sub => rows.push({ phase: sub, depth: 1 }));
      }
    });
    return rows;
  }, [phaseHierarchy]);

  // ── Drag / Resize hooks (must come AFTER visibleDates and visibleTasks) ───────
  const {
    draggedTaskId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useGanttDrag({
    cellWidth,
    rowHeight: responsive.rowHeight,
    dates: visibleDates,
    tasks: visibleTasks,
    onUpdateTask: updateTask,
    setTasks,
  });

  const {
    resizingTask,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  } = useGanttResize({
    cellWidth,
    rowHeight: responsive.rowHeight,
    tasks: visibleTasks,
    onUpdateTask: updateTask,
    setTasks,
  });

  // ── Toggle phase accordion ────────────────────────────────────────────────────
  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  }, []);

  // ── Task interactions ─────────────────────────────────────────────────────────
  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    onTaskClick?.(task);
  }, [onTaskClick]);

  const handleTaskSave = useCallback(async (taskId: string, updates: Partial<GanttTask>) => {
    await updateTask(taskId, updates);
  }, [updateTask]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
    setShowTaskModal(false);
    setSelectedTask(null);
  }, [deleteTask]);

  const handleMarkCompleted = useCallback(async (taskId: string) => {
    await updateTask(taskId, {
      completed: true,
      completedAt: new Date().toISOString(),
    });
    setShowTaskModal(false);
    setSelectedTask(null);
  }, [updateTask]);

  // ── Grid cell click → create task ────────────────────────────────────────────
  const handleCellPress = useCallback(async (phaseId: string, date: Date) => {
    if (!projectId) return;

    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 2); // Default 3-day task

    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    await createTask({
      projectId,
      phaseId,
      category: phase.name,
      startDate: date.toISOString(),
      endDate: endDate.toISOString(),
      duration: 3,
      workType: 'in-house',
      color: phase.color,
      visibleToClient: true,
      completed: false,
      row: 0,
      rowSpan: 1,
    });
  }, [projectId, phases, createTask]);

  // ── Phase creation ────────────────────────────────────────────────────────────
  const handleAddPhase = useCallback(() => {
    setAddPhaseParentId(null);
    setShowAddPhaseModal(true);
  }, []);

  const handleAddSubPhase = useCallback((parentPhaseId: string) => {
    setAddPhaseParentId(parentPhaseId);
    setShowAddPhaseModal(true);
  }, []);

  const handleSavePhase = useCallback(async (name: string, color: string) => {
    if (!projectId) return;
    await createPhase({
      projectId,
      name,
      color,
      parentPhaseId: addPhaseParentId ?? undefined,
      order: phases.filter(p => p.parentPhaseId === (addPhaseParentId ?? undefined)).length,
      visibleToClient: true,
    });

    // Auto-expand parent if creating sub-phase
    if (addPhaseParentId) {
      setExpandedPhases(prev => new Set(prev).add(addPhaseParentId));
    }
  }, [projectId, addPhaseParentId, phases, createPhase]);

  // ── Pan button controls (track scroll position via onScroll) ─────────────────
  const PAN_STEP = cellWidth * 7; // scroll 7 cells at a time

  const panStart = () => scrollRef.current?.scrollTo({ x: 0, animated: true });
  const panEnd   = () => scrollRef.current?.scrollTo({ x: visibleDates.length * cellWidth, animated: true });
  const panLeft  = () => scrollRef.current?.scrollTo({ x: Math.max(0, scrollXRef.current - PAN_STEP), animated: true });
  const panRight = () => scrollRef.current?.scrollTo({ x: scrollXRef.current + PAN_STEP, animated: true });

  // ── Render ────────────────────────────────────────────────────────────────────
  if (isLoadingPhases || isLoadingTasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (!projectId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select a project to view schedule</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top control bar */}
      <GanttControls
        zoomLevel={zoomLevel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onSetZoomLevel={setZoomLevel}
        onPanLeft={panLeft}
        onPanRight={panRight}
        onPanStart={panStart}
        onPanEnd={panEnd}
        projectName={projectName}
        phases={visiblePhases}
        tasks={visibleTasks}
      />

      {/* Split layout */}
      <View style={styles.mainLayout}>
        {/* Left: sticky phase sidebar */}
        <GanttSidebar
          phases={phaseHierarchy}
          onTogglePhase={togglePhase}
          onPhasePress={onPhaseClick}
          onAddPhase={effectiveViewMode === 'internal' ? handleAddPhase : undefined}
          onAddSubPhase={effectiveViewMode === 'internal' ? handleAddSubPhase : undefined}
          width={responsive.sidebarWidth}
          rowHeight={responsive.rowHeight}
          headerHeight={responsive.headerHeight}
          fontSize={responsive.bodyFontSize}
          readOnly={effectiveViewMode === 'client'}
        />

        {/* Right: scrollable timeline */}
        <GanttTimeline
          tasks={visibleTasks}
          visibleRows={visibleRows}
          dates={visibleDates}
          cellWidth={cellWidth}
          rowHeight={responsive.rowHeight}
          headerHeight={responsive.headerHeight}
          zoomLevel={zoomLevel}
          fontSize={responsive.bodyFontSize}
          onTaskPress={handleTaskClick}
          scrollRef={scrollRef}
          draggedTaskId={draggedTaskId}
          resizingTask={resizingTask}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onResizeStart={handleResizeStart}
          onResizeMove={handleResizeMove}
          onResizeEnd={handleResizeEnd}
          onCellPress={effectiveViewMode === 'internal' ? handleCellPress : undefined}
          readOnly={effectiveViewMode === 'client'}
          onScrollX={(x) => { scrollXRef.current = x; }}
        />
      </View>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={showTaskModal}
        task={selectedTask}
        viewMode={effectiveViewMode}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
        onMarkCompleted={effectiveViewMode === 'internal' ? handleMarkCompleted : undefined}
      />

      {/* Add Phase / Sub-Phase Modal */}
      <AddPhaseModal
        visible={showAddPhaseModal}
        parentPhaseName={addPhaseParentName}
        onClose={() => setShowAddPhaseModal(false)}
        onSave={handleSavePhase}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
});
