import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

interface TimelineGridProps {
  dates: Date[];
  rowCount: number;
  cellWidth: number;
  rowHeight: number;
  /** Called when the user taps an empty cell. rowIndex is 0-based. */
  onCellPress?: (dateIndex: number, rowIndex: number) => void;
  /** When true, disable cell press (read-only / during drag) */
  readOnly?: boolean;
}

/**
 * Background grid for the timeline.
 * Each cell is tappable to create a task at that date + row.
 * Weekends get a subtle highlight in day view.
 */
export default function TimelineGrid({
  dates,
  rowCount,
  cellWidth,
  rowHeight,
  onCellPress,
  readOnly = false,
}: TimelineGridProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { height: rowHeight }]}>
          {dates.map((date, colIndex) => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <TouchableOpacity
                key={colIndex}
                style={[
                  styles.cell,
                  { width: cellWidth },
                  isWeekend && styles.weekendCell,
                ]}
                onPress={() => !readOnly && onCellPress?.(colIndex, rowIndex)}
                activeOpacity={readOnly || !onCellPress ? 1 : 0.5}
                disabled={readOnly || !onCellPress}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  weekendCell: {
    backgroundColor: '#F9FAFB',
  },
});
