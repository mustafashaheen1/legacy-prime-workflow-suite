import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TimelineGridProps {
  dates: Date[];
  rowCount: number;
  cellWidth: number;
  rowHeight: number;
}

/**
 * Background grid for the timeline
 */
export default function TimelineGrid({
  dates,
  rowCount,
  cellWidth,
  rowHeight,
}: TimelineGridProps) {
  return (
    <View style={styles.container}>
      {/* Render grid rows */}
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { height: rowHeight }]}>
          {/* Render grid cells */}
          {dates.map((_, colIndex) => (
            <View
              key={colIndex}
              style={[
                styles.cell,
                { width: cellWidth },
                // Highlight weekends (for day view)
                colIndex % 7 === 5 || colIndex % 7 === 6 ? styles.weekendCell : null,
              ]}
            />
          ))}
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
