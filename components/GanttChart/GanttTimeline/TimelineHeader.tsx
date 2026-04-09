import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Platform } from 'react-native';
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
 * - Web: uses onMouseDown + document mouse events (works inside ScrollView)
 * - Native: uses PanResponder with capture
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

  // ── Native: PanResponder ────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:        () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        console.log('[ColResize] grant native pageX:', e.nativeEvent.pageX);
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

  // ── Web: mouse events on document (works inside overflow scroll containers) ──
  const handleMouseDown = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    console.log('[ColResize] mousedown clientX:', e.clientX);
    onResizeStartRef.current?.();

    const onMouseMove = (ev: MouseEvent) => {
      if (startXRef.current === null) return;
      const delta = ev.clientX - startXRef.current;
      startXRef.current = ev.clientX;
      console.log('[ColResize] mousemove delta:', delta);
      onResizeDeltaRef.current?.(delta);
    };

    const onMouseUp = () => {
      console.log('[ColResize] mouseup');
      startXRef.current = null;
      onResizeEndRef.current?.();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const webProps = Platform.OS === 'web'
    ? { onMouseDown: handleMouseDown }
    : {};

  return (
    <View
      style={styles.resizeHandle}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      {...webProps}
    >
      <View style={styles.resizeLine} />
      <View style={styles.resizeLine} />
    </View>
  );
}

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
  console.log('[TimelineHeader] render — onColumnResizeDelta:', typeof onColumnResizeDelta, '| cellWidth:', cellWidth);

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
    right: -5,
    top: 6,
    bottom: 6,
    width: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    zIndex: 30,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
    cursor: 'col-resize',
  },
  resizeLine: {
    width: 2,
    height: 10,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
});
