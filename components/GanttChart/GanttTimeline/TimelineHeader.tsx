import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { ZoomLevel } from '@/types';

interface TimelineHeaderProps {
  dates: Date[];
  cellWidth: number;
  height: number;
  zoomLevel: ZoomLevel;
  fontSize: number;
  onColumnResizeStart?: () => void;
  onColumnResizeDelta?: (delta: number) => void;
  onColumnResizeEnd?: () => void;
}

/**
 * Drag handle on the right edge of each date column.
 * Uses PanResponder with capture so it wins over the parent ScrollView.
 */
function ColumnResizeHandle({
  onResizeStart,
  onResizeDelta,
  onResizeEnd,
}: {
  onResizeStart?: () => void;
  onResizeDelta?: (delta: number) => void;
  onResizeEnd?: () => void;
}) {
  const startXRef = useRef<number | null>(null);

  // Keep callbacks in refs so PanResponder (created once) never goes stale
  const onResizeStartRef = useRef(onResizeStart);
  const onResizeDeltaRef = useRef(onResizeDelta);
  const onResizeEndRef   = useRef(onResizeEnd);
  useEffect(() => { onResizeStartRef.current = onResizeStart; }, [onResizeStart]);
  useEffect(() => { onResizeDeltaRef.current = onResizeDelta; }, [onResizeDelta]);
  useEffect(() => { onResizeEndRef.current   = onResizeEnd;   }, [onResizeEnd]);

  const panResponder = useRef(
    PanResponder.create({
      // Capture immediately so ScrollView never gets this gesture
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:        () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (e) => {
        startXRef.current = e.nativeEvent.pageX;
        onResizeStartRef.current?.();
      },
      onPanResponderMove: (e) => {
        if (startXRef.current === null) return;
        const delta = e.nativeEvent.pageX - startXRef.current;
        startXRef.current = e.nativeEvent.pageX;
        onResizeDeltaRef.current?.(delta);
      },
      onPanResponderRelease: () => {
        startXRef.current = null;
        onResizeEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        startXRef.current = null;
        onResizeEndRef.current?.();
      },
    })
  ).current;

  return (
    <View style={styles.resizeHandle} {...panResponder.panHandlers}>
      <View style={styles.resizeLine} />
      <View style={styles.resizeLine} />
    </View>
  );
}

/**
 * Timeline header showing date labels with drag-to-resize column handles.
 */
export default function TimelineHeader({
  dates,
  cellWidth,
  height,
  zoomLevel,
  fontSize,
  onColumnResizeStart,
  onColumnResizeDelta,
  onColumnResizeEnd,
}: TimelineHeaderProps) {
  const formatDate = (date: Date, level: ZoomLevel): string => {
    switch (level) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.getDate()}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      {dates.map((date, index) => (
        <View key={index} style={[styles.cell, { width: cellWidth }]}>
          <Text style={[styles.dateText, { fontSize }]} numberOfLines={1}>
            {formatDate(date, zoomLevel)}
          </Text>
          {onColumnResizeDelta && (
            <ColumnResizeHandle
              onResizeStart={onColumnResizeStart}
              onResizeDelta={onColumnResizeDelta}
              onResizeEnd={onColumnResizeEnd}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  dateText: {
    fontWeight: '600',
    color: '#374151',
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  resizeLine: {
    width: 2,
    height: 14,
    backgroundColor: '#9CA3AF',
    borderRadius: 1,
  },
});
