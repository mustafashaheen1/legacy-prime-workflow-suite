import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ZoomLevel, SchedulePhase, GanttTask } from '@/types';
import ZoomControls from './ZoomControls';
import PanControls from './PanControls';
import PrintScheduleButton from '../PrintExport/PrintScheduleButton';

interface GanttControlsProps {
  zoomLevel: ZoomLevel;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoomLevel: (level: ZoomLevel) => void;
  onPanLeft: () => void;
  onPanRight: () => void;
  onPanStart: () => void;
  onPanEnd: () => void;
  projectName?: string;
  // Print/export
  phases?: SchedulePhase[];
  tasks?: GanttTask[];
}

/**
 * Control bar for Gantt chart
 * Contains zoom and pan controls
 */
export default function GanttControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onSetZoomLevel,
  onPanLeft,
  onPanRight,
  onPanStart,
  onPanEnd,
  projectName,
  phases = [],
  tasks = [],
}: GanttControlsProps) {
  return (
    <View style={styles.container}>
      {/* Project Name */}
      {projectName && (
        <View style={styles.titleSection}>
          <Text style={styles.projectName} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={styles.subtitle}>Project Schedule</Text>
        </View>
      )}

      {/* Right Side Controls */}
      <View style={styles.controls}>
        {/* Print Button */}
        {projectName && (
          <>
            <PrintScheduleButton
              projectName={projectName}
              phases={phases}
              tasks={tasks}
            />
            <View style={styles.divider} />
          </>
        )}

        {/* Pan Controls */}
        <PanControls
          onPanLeft={onPanLeft}
          onPanRight={onPanRight}
          onPanStart={onPanStart}
          onPanEnd={onPanEnd}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Zoom Controls */}
        <ZoomControls
          zoomLevel={zoomLevel}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onSetZoomLevel={onSetZoomLevel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleSection: {
    flex: 1,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
});
