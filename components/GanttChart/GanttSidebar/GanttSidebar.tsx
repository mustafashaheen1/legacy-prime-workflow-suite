import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SchedulePhase } from '@/types';
import PhaseAccordion from './PhaseAccordion';
import AddPhaseButton from './AddPhaseButton';

interface PhaseWithExpansion extends SchedulePhase {
  isExpanded?: boolean;
  subPhases?: PhaseWithExpansion[];
}

interface GanttSidebarProps {
  phases: PhaseWithExpansion[];
  onTogglePhase: (phaseId: string) => void;
  onPhasePress?: (phase: SchedulePhase) => void;
  onAddPhase?: () => void;
  onAddSubPhase?: (parentPhaseId: string) => void;
  width: number;
  rowHeight: number;
  headerHeight: number;
  fontSize: number;
  readOnly?: boolean;
}

/**
 * Left sidebar: hierarchical list of phases with accordion expand/collapse.
 * Each main phase row shows a "+" button to add a sub-phase.
 */
export default function GanttSidebar({
  phases,
  onTogglePhase,
  onPhasePress,
  onAddPhase,
  onAddSubPhase,
  width,
  rowHeight,
  headerHeight,
  fontSize,
  readOnly = false,
}: GanttSidebarProps) {
  return (
    <View style={[styles.container, { width }]}>
      {/* Header */}
      <View style={[styles.header, { height: headerHeight }]}>
        <Text style={[styles.headerText, { fontSize }]}>Phases</Text>
      </View>

      {/* Phase List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        {phases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No phases yet</Text>
            <Text style={styles.emptyHint}>Tap "Add Phase" to get started</Text>
          </View>
        ) : (
          phases.map(phase => (
            <PhaseAccordion
              key={phase.id}
              phase={phase}
              onToggle={onTogglePhase}
              onPhasePress={onPhasePress}
              onAddSubPhase={!readOnly ? onAddSubPhase : undefined}
              rowHeight={rowHeight}
              fontSize={fontSize}
              readOnly={readOnly}
            />
          ))
        )}

        {/* Add Phase Button — internal view only */}
        {!readOnly && onAddPhase && (
          <AddPhaseButton onPress={onAddPhase} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  header: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerText: {
    fontWeight: '600',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  emptyHint: {
    fontSize: 12,
    color: '#D1D5DB',
  },
});
