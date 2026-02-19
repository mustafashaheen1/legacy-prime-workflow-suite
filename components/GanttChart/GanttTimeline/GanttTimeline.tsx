import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, PanResponder, GestureResponderEvent } from 'react-native';
import { GanttTask, ZoomLevel, SchedulePhase } from '@/types';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import TaskBar from './TaskBar';

export interface GanttRow {
  phase: SchedulePhase;
  depth: number;
}

interface GanttTimelineProps {
  tasks: GanttTask[];
  visibleRows: GanttRow[];
  dates: Date[];
  cellWidth: number;
  rowHeight: number;
  headerHeight: number;
  zoomLevel: ZoomLevel;
  fontSize: number;
  onTaskPress?: (task: GanttTask) => void;
  scrollRef?: React.RefObject<ScrollView>;
  // Drag interactions
  draggedTaskId?: string | null;
  onDragStart?: (task: GanttTask, clientX: number, clientY: number) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
  // Resize interactions
  resizingTask?: { id: string; type: 'right' } | null;
  onResizeStart?: (task: GanttTask, type: 'right', clientX: number, clientY: number) => void;
  onResizeMove?: (clientX: number, clientY: number) => void;
  onResizeEnd?: () => void;
  // Cell click to create task
  onCellPress?: (phaseId: string, date: Date) => void;
  // Read-only mode (client view)
  readOnly?: boolean;
  // Scroll position callback so parent can track x for pan buttons
  onScrollX?: (x: number) => void;
}

/**
 * Right panel: horizontally scrollable timeline grid with phase-aligned rows.
 *
 * Architecture:
 * - TimelineHeader is INSIDE the horizontal ScrollView so dates stay in sync.
 * - Each row corresponds to a phase in `visibleRows` (same order as sidebar).
 * - Tasks are positioned by `phaseId → rowIndex` lookup, not by the `row` field.
 * - PanResponder uses refs to avoid stale-closure bugs with drag/resize state.
 */
export default function GanttTimeline({
  tasks,
  visibleRows,
  dates,
  cellWidth,
  rowHeight,
  headerHeight,
  zoomLevel,
  fontSize,
  onTaskPress,
  scrollRef,
  draggedTaskId,
  onDragStart,
  onDragMove,
  onDragEnd,
  resizingTask,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onCellPress,
  readOnly = false,
  onScrollX,
}: GanttTimelineProps) {
  // ── Refs for PanResponder (avoid stale closures) ────────────────────────────
  const draggedIdRef = useRef(draggedTaskId);
  const resizingRef = useRef(resizingTask);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const onResizeMoveRef = useRef(onResizeMove);
  const onResizeEndRef = useRef(onResizeEnd);

  useEffect(() => { draggedIdRef.current = draggedTaskId; }, [draggedTaskId]);
  useEffect(() => { resizingRef.current = resizingTask; }, [resizingTask]);
  useEffect(() => { onDragMoveRef.current = onDragMove; }, [onDragMove]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onResizeMoveRef.current = onResizeMove; }, [onResizeMove]);
  useEffect(() => { onResizeEndRef.current = onResizeEnd; }, [onResizeEnd]);

  // ── Phase → row index map ───────────────────────────────────────────────────
  const phaseRowMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleRows.forEach((row, idx) => map.set(row.phase.id, idx));
    return map;
  }, [visibleRows]);

  // ── Task positions (phase-aligned) ─────────────────────────────────────────
  const taskPositions = useMemo(() => {
    return tasks.flatMap(task => {
      const rowIndex = phaseRowMap.get(task.phaseId);
      if (rowIndex === undefined) return []; // phase not visible

      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);

      // Find exact match first, then closest
      let sIdx = dates.findIndex(d => d.toDateString() === startDate.toDateString());
      let eIdx = dates.findIndex(d => d.toDateString() === endDate.toDateString());

      // If exact match not found, use range-based clamping
      if (sIdx === -1) {
        sIdx = dates.findIndex(d => d > startDate);
        if (sIdx === -1) return []; // before visible range
        sIdx = Math.max(0, sIdx - 1);
      }
      if (eIdx === -1) {
        eIdx = dates.findIndex(d => d > endDate);
        if (eIdx === -1) eIdx = dates.length - 1;
        else eIdx = Math.max(0, eIdx - 1);
      }
      if (sIdx > eIdx) return [];

      const left = sIdx * cellWidth;
      const width = Math.max(cellWidth, (eIdx - sIdx + 1) * cellWidth);
      const top = rowIndex * rowHeight + 4;
      const height = rowHeight - 10;

      return [{ task, position: { left, top, width, height } }];
    });
  }, [tasks, dates, cellWidth, rowHeight, phaseRowMap]);

  const rowCount = Math.max(1, visibleRows.length);
  const totalWidth = dates.length * cellWidth;
  const totalHeight = rowCount * rowHeight;

  // ── PanResponder for drag/resize (reads from refs, never stale) ─────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () =>
        !!draggedIdRef.current || !!resizingRef.current,
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
        if (draggedIdRef.current) {
          onDragMoveRef.current?.(pageX, pageY);
        } else if (resizingRef.current) {
          onResizeMoveRef.current?.(pageX, pageY);
        }
      },
      onPanResponderRelease: () => {
        if (draggedIdRef.current) {
          onDragEndRef.current?.();
        } else if (resizingRef.current) {
          onResizeEndRef.current?.();
        }
      },
      onPanResponderTerminate: () => {
        if (draggedIdRef.current) {
          onDragEndRef.current?.();
        } else if (resizingRef.current) {
          onResizeEndRef.current?.();
        }
      },
    })
  ).current;

  // ── Cell press → resolve phase and call onCellPress ─────────────────────────
  const handleCellPress = (dateIndex: number, rowIndex: number) => {
    const row = visibleRows[rowIndex];
    if (!row || !onCellPress) return;
    onCellPress(row.phase.id, dates[dateIndex]);
  };

  return (
    <View style={styles.container}>
      {/* Horizontal ScrollView — header AND grid both scroll together */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        horizontal
        showsHorizontalScrollIndicator
        scrollEnabled={!draggedTaskId && !resizingTask}
        bounces={false}
        onScroll={onScrollX ? (e) => onScrollX(e.nativeEvent.contentOffset.x) : undefined}
        scrollEventThrottle={16}
      >
        <View style={{ width: totalWidth }}>
          {/* Date header — inside scroll so it stays synced */}
          <TimelineHeader
            dates={dates}
            cellWidth={cellWidth}
            height={headerHeight}
            zoomLevel={zoomLevel}
            fontSize={fontSize}
          />

          {/* Task area */}
          <View
            style={{ width: totalWidth, height: totalHeight }}
            {...panResponder.panHandlers}
          >
            {/* Background grid (clickable cells) */}
            <TimelineGrid
              dates={dates}
              rowCount={rowCount}
              cellWidth={cellWidth}
              rowHeight={rowHeight}
              onCellPress={!readOnly ? handleCellPress : undefined}
              readOnly={readOnly || !!draggedTaskId || !!resizingTask}
            />

            {/* Task bars */}
            {taskPositions.map(({ task, position }) => (
              <TaskBar
                key={task.id}
                task={task}
                position={position}
                onPress={() => onTaskPress?.(task)}
                fontSize={fontSize}
                isDragging={draggedTaskId === task.id}
                isResizing={resizingTask?.id === task.id}
                onDragStart={!readOnly ? onDragStart : undefined}
                onResizeStart={!readOnly ? onResizeStart : undefined}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
});
