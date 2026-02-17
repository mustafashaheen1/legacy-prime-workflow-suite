import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ZoomLevel } from '@/types';

interface TimelineHeaderProps {
  dates: Date[];
  cellWidth: number;
  height: number;
  zoomLevel: ZoomLevel;
  fontSize: number;
}

/**
 * Timeline header showing date labels
 */
export default function TimelineHeader({
  dates,
  cellWidth,
  height,
  zoomLevel,
  fontSize,
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
        <View
          key={index}
          style={[styles.cell, { width: cellWidth }]}
        >
          <Text style={[styles.dateText, { fontSize }]} numberOfLines={1}>
            {formatDate(date, zoomLevel)}
          </Text>
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
});
