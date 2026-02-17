import React, { useState, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { SchedulePhase, GanttTask, ScheduleViewMode } from '@/types';
import { useGanttState } from './hooks/useGanttState';
import { useGanttResponsive } from './hooks/useGanttResponsive';
import { useGanttZoom } from './hooks/useGanttZoom';
import { useGanttDrag } from './hooks/useGanttDrag';
import { useGanttResize } from './hooks/useGanttResize';
import GanttSidebar from './GanttSidebar/GanttSidebar';
import GanttTimeline from './GanttTimeline/GanttTimeline';
import GanttControls from './GanttControls/GanttControls';
import TaskDetailModal from './TaskModal/TaskDetailModal';

interface GanttScheduleProps {
  projectId: string | null;
  projectName?: string;
  viewMode?: ScheduleViewMode;
  onTaskClick?: (task: GanttTask) => void;
  onPhaseClick?: (phase: SchedulePhase) => void;
}

/**
 * Main Gantt Chart component
 * Orchestrates sidebar, timeline, and controls
 */
export default function GanttSchedule({
  projectId,
  projectName,
  viewMode = 'internal',
  onTaskClick,
  onPhaseClick,
}: GanttScheduleProps) {
  const responsive = useGanttResponsive();
  const { cellWidth, zoomLevel, zoomIn, zoomOut, setZoomLevel } = useGanttZoom(
    responsive.defaultCellWidth,
    responsive.minCellWidth,
    responsive.maxCellWidth
  );

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
    setPhases,
    setTasks,
  } = useGanttState({ projectId });

  // Local UI state
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Drag and resize hooks
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

  // Filter phases and tasks based on view mode
  const visiblePhases = useMemo(() => {
    if (viewMode === 'internal') return phases;
    return phases.filter(p => p.visibleToClient);
  }, [phases, viewMode]);

  const visibleTasks = useMemo(() => {
    if (viewMode === 'internal') return tasks;
    return tasks.filter(t => t.visibleToClient);
  }, [tasks, viewMode]);

  // Build hierarchical phase structure
  const phaseHierarchy = useMemo(() => {
    const mainPhases = visiblePhases.filter(p => !p.parentPhaseId);
    return mainPhases.map(main => ({
      ...main,
      isExpanded: expandedPhases.has(main.id),
      subPhases: visiblePhases
        .filter(p => p.parentPhaseId === main.id)
        .map(sub => ({
          ...sub,
          isExpanded: expandedPhases.has(sub.id),
        })),
    }));
  }, [visiblePhases, expandedPhases]);

  // Generate date range for timeline (e.g., next 6 months)
  const dateRange = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 1); // Start 1 month ago
    const end = new Date(today);
    end.setMonth(end.getMonth() + 6); // End 6 months from now
    return { start, end };
  }, []);

  // Generate visible dates based on zoom level
  const visibleDates = useMemo(() => {
    const dates: Date[] = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      dates.push(new Date(current));

      // Increment based on zoom level
      switch (zoomLevel) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return dates;
  }, [dateRange, zoomLevel]);

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // Handle task click
  const handleTaskClick = (task: GanttTask) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    onTaskClick?.(task);
  };

  // Handle task save
  const handleTaskSave = async (taskId: string, updates: Partial<GanttTask>) => {
    await updateTask(taskId, updates);
  };

  // Handle task delete
  const handleTaskDelete = async (taskId: string) => {
    await deleteTask(taskId);
  };

  // Pan controls
  const panStart = () => {
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  };

  const panLeft = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const panRight = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const panEnd = () => {
    const maxScroll = visibleDates.length * cellWidth;
    scrollRef.current?.scrollTo({ x: maxScroll, animated: true });
  };

  // Loading state
  if (isLoadingPhases || isLoadingTasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  // Empty state
  if (!projectId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select a project to view schedule</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Control Bar */}
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

      {/* Main Split Layout: Sidebar + Timeline */}
      <View style={styles.mainLayout}>
        {/* Left Sidebar */}
        <GanttSidebar
          phases={phaseHierarchy}
          onTogglePhase={togglePhase}
          onPhasePress={onPhaseClick}
          width={responsive.sidebarWidth}
          rowHeight={responsive.rowHeight}
          headerHeight={responsive.headerHeight}
          fontSize={responsive.bodyFontSize}
          readOnly={viewMode === 'client'}
        />

        {/* Right Timeline */}
        <GanttTimeline
          tasks={visibleTasks}
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
          readOnly={viewMode === 'client'}
        />
      </View>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={showTaskModal}
        task={selectedTask}
        viewMode={viewMode}
        onClose={() => setShowTaskModal(false)}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
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
