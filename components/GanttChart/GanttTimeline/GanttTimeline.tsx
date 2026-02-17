import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, PanResponder, GestureResponderEvent } from 'react-native';
import { GanttTask, ZoomLevel } from '@/types';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import TaskBar from './TaskBar';

interface GanttTimelineProps {
  tasks: GanttTask[];
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
  resizingTask?: { id: string; type: 'right' | 'bottom' } | null;
  onResizeStart?: (task: GanttTask, type: 'right' | 'bottom', clientX: number, clientY: number) => void;
  onResizeMove?: (clientX: number, clientY: number) => void;
  onResizeEnd?: () => void;
  // Read-only mode
  readOnly?: boolean;
}

/**
 * Right panel showing timeline grid and tasks
 */
export default function GanttTimeline({
  tasks,
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
  readOnly = false,
}: GanttTimelineProps) {
  // Calculate task positions
  const taskPositions = useMemo(() => {
    return tasks.map((task) => {
      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);

      // Find start and end column indices
      const startIndex = dates.findIndex(d =>
        d.toDateString() === startDate.toDateString()
      );
      const endIndex = dates.findIndex(d =>
        d.toDateString() === endDate.toDateString()
      );

      if (startIndex === -1 || endIndex === -1) {
        // Task is outside visible range
        return null;
      }

      const left = startIndex * cellWidth;
      const width = (endIndex - startIndex + 1) * cellWidth;
      const top = (task.row || 0) * rowHeight;
      const height = rowHeight * (task.rowSpan || 1) - 8; // 8px padding

      return {
        task,
        position: { left, top, width, height },
      };
    }).filter(Boolean) as Array<{ task: GanttTask; position: { left: number; top: number; width: number; height: number } }>;
  }, [tasks, dates, cellWidth, rowHeight]);

  const rowCount = Math.max(
    10,
    ...tasks.map(t => (t.row || 0) + (t.rowSpan || 1))
  );

  const totalWidth = dates.length * cellWidth;
  const totalHeight = rowCount * rowHeight;

  // Pan responder for global drag/resize move and end events
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => draggedTaskId !== null || resizingTask !== null,
      onPanResponderMove: (e: GestureResponderEvent) => {
        const touch = e.nativeEvent;
        if (draggedTaskId && onDragMove) {
          onDragMove(touch.pageX, touch.pageY);
        } else if (resizingTask && onResizeMove) {
          onResizeMove(touch.pageX, touch.pageY);
        }
      },
      onPanResponderRelease: () => {
        if (draggedTaskId && onDragEnd) {
          onDragEnd();
        } else if (resizingTask && onResizeEnd) {
          onResizeEnd();
        }
      },
      onPanResponderTerminate: () => {
        if (draggedTaskId && onDragEnd) {
          onDragEnd();
        } else if (resizingTask && onResizeEnd) {
          onResizeEnd();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Header */}
      <TimelineHeader
        dates={dates}
        cellWidth={cellWidth}
        height={headerHeight}
        zoomLevel={zoomLevel}
        fontSize={fontSize}
      />

      {/* Scrollable Timeline */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        horizontal
        showsHorizontalScrollIndicator={true}
        scrollEnabled={!draggedTaskId && !resizingTask}
      >
        <View
          style={{ width: totalWidth, height: totalHeight }}
          {...panResponder.panHandlers}
        >
          {/* Background Grid */}
          <TimelineGrid
            dates={dates}
            rowCount={rowCount}
            cellWidth={cellWidth}
            rowHeight={rowHeight}
          />

          {/* Task Bars */}
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
