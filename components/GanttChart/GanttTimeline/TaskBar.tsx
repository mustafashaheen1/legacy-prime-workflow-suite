import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { GanttTask } from '@/types';
import TaskResizeHandle from './TaskResizeHandle';

interface TaskBarProps {
  task: GanttTask;
  position: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  onPress?: () => void;
  fontSize: number;
  isDragging?: boolean;
  isResizing?: boolean;
  onDragStart?: (task: GanttTask, clientX: number, clientY: number) => void;
  onResizeStart?: (task: GanttTask, type: 'right' | 'bottom', clientX: number, clientY: number) => void;
}

/**
 * Task bar visualization in the timeline
 * Supports drag and resize interactions
 */
export default function TaskBar({
  task,
  position,
  onPress,
  fontSize,
  isDragging = false,
  isResizing = false,
  onDragStart,
  onResizeStart,
}: TaskBarProps) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (!onDragStart) return;

    const touch = e.nativeEvent;
    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      time: Date.now(),
    };
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!onDragStart || !touchStartRef.current) return;

    const touch = e.nativeEvent;
    const deltaX = Math.abs(touch.pageX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.pageY - touchStartRef.current.y);

    // Start drag if moved more than 5px
    if (deltaX > 5 || deltaY > 5) {
      onDragStart(task, touch.pageX, touch.pageY);
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (!touchStartRef.current) return;

    const timeSinceStart = Date.now() - touchStartRef.current.time;

    // If it was a quick tap (< 200ms), treat as click
    if (timeSinceStart < 200) {
      onPress?.();
    }

    touchStartRef.current = null;
  };

  const handleResizeRightStart = (e: GestureResponderEvent) => {
    if (!onResizeStart) return;
    const touch = e.nativeEvent;
    onResizeStart(task, 'right', touch.pageX, touch.pageY);
  };

  return (
    <View
      style={[
        styles.container,
        {
          left: position.left,
          top: position.top,
          width: position.width,
          height: position.height,
          backgroundColor: task.color,
        },
        isDragging && styles.dragging,
        isResizing && styles.resizing,
      ]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Text
        style={[styles.taskText, { fontSize }]}
        numberOfLines={1}
      >
        {task.category}
      </Text>

      {/* Work type indicator */}
      {task.workType === 'subcontractor' && (
        <View style={styles.subcontractorBadge}>
          <Text style={styles.badgeText}>SUB</Text>
        </View>
      )}

      {/* Resize handle (right edge) */}
      {onResizeStart && (
        <TouchableOpacity
          style={styles.resizeHandle}
          onPressIn={handleResizeRightStart}
          activeOpacity={0.7}
        >
          <View style={styles.resizeIndicator} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dragging: {
    opacity: 0.7,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  resizing: {
    opacity: 0.9,
  },
  taskText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subcontractorBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeIndicator: {
    width: 4,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    opacity: 0.8,
  },
});
