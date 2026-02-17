import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SchedulePhase } from '@/types';
import PhaseRow from './PhaseRow';

interface PhaseWithExpansion extends SchedulePhase {
  isExpanded?: boolean;
  subPhases?: PhaseWithExpansion[];
}

interface PhaseAccordionProps {
  phase: PhaseWithExpansion;
  onToggle: (phaseId: string) => void;
  onPhasePress?: (phase: SchedulePhase) => void;
  rowHeight: number;
  fontSize: number;
}

/**
 * Expandable phase accordion
 * Shows main phase and optionally its sub-phases
 */
export default function PhaseAccordion({
  phase,
  onToggle,
  onPhasePress,
  rowHeight,
  fontSize,
}: PhaseAccordionProps) {
  const hasSubPhases = phase.subPhases && phase.subPhases.length > 0;

  return (
    <View style={styles.container}>
      {/* Main Phase */}
      <PhaseRow
        phase={phase}
        isExpanded={phase.isExpanded}
        hasChildren={hasSubPhases}
        depth={0}
        onToggle={() => onToggle(phase.id)}
        onPress={() => onPhasePress?.(phase)}
        rowHeight={rowHeight}
        fontSize={fontSize}
      />

      {/* Sub-Phases (if expanded) */}
      {phase.isExpanded && hasSubPhases && (
        <View style={styles.subPhases}>
          {phase.subPhases!.map((subPhase) => (
            <PhaseRow
              key={subPhase.id}
              phase={subPhase}
              isExpanded={subPhase.isExpanded}
              hasChildren={false}
              depth={1}
              onPress={() => onPhasePress?.(subPhase)}
              rowHeight={rowHeight}
              fontSize={fontSize}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  subPhases: {
    backgroundColor: '#F9FAFB',
  },
});
