import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Check } from 'lucide-react-native';
import { GanttTask } from '@/types';

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
  onResizeStart?: (task: GanttTask, type: 'right', clientX: number, clientY: number) => void;
}

const COMPLETED_COLOR = '#10B981'; // Green for completed tasks

/**
 * Task bar visualization in the timeline.
 * - Turns green when task.completed = true
 * - Right-edge resize handle
 * - Distinguishes drag vs tap by movement threshold / time
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
  const dragStartedRef = useRef(false);

  const barColor = task.completed ? COMPLETED_COLOR : task.color;

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (!onDragStart) return;
    const touch = e.nativeEvent;
    touchStartRef.current = { x: touch.pageX, y: touch.pageY, time: Date.now() };
    dragStartedRef.current = false;
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!onDragStart || !touchStartRef.current || dragStartedRef.current) return;
    const touch = e.nativeEvent;
    const dx = Math.abs(touch.pageX - touchStartRef.current.x);
    const dy = Math.abs(touch.pageY - touchStartRef.current.y);
    if (dx > 6 || dy > 6) {
      dragStartedRef.current = true;
      onDragStart(task, touch.pageX, touch.pageY);
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const elapsed = Date.now() - touchStartRef.current.time;
    if (elapsed < 250 && !dragStartedRef.current) {
      onPress?.();
    }
    touchStartRef.current = null;
    dragStartedRef.current = false;
  };

  const handleResizeRightStart = (e: GestureResponderEvent) => {
    if (!onResizeStart) return;
    e.stopPropagation();
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
          backgroundColor: barColor,
        },
        task.completed && styles.completedBar,
        isDragging && styles.dragging,
        isResizing && styles.resizing,
      ]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Completion checkmark */}
      {task.completed && (
        <View style={styles.checkIcon}>
          <Check size={10} color="#FFFFFF" strokeWidth={3} />
        </View>
      )}

      <Text style={[styles.taskText, { fontSize }]} numberOfLines={1}>
        {task.category}
      </Text>

      {/* Subcontractor badge (internal only — parent filters if client view) */}
      {task.workType === 'subcontractor' && (
        <View style={styles.subcontractorBadge}>
          <Text style={styles.badgeText}>SUB</Text>
        </View>
      )}

      {/* Right resize handle */}
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedBar: {
    opacity: 0.9,
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
  checkIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskText: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  subcontractorBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 3,
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
    width: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeIndicator: {
    width: 3,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 2,
  },
});
