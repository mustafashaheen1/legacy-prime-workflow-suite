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
  onAddSubPhase?: (parentPhaseId: string) => void;
  rowHeight: number;
  fontSize: number;
  readOnly?: boolean;
}

/**
 * Expandable phase accordion.
 * Shows main phase row and, when expanded, all sub-phase rows.
 */
export default function PhaseAccordion({
  phase,
  onToggle,
  onPhasePress,
  onAddSubPhase,
  rowHeight,
  fontSize,
  readOnly = false,
}: PhaseAccordionProps) {
  const hasSubPhases = !!(phase.subPhases && phase.subPhases.length > 0);

  return (
    <View style={styles.container}>
      {/* Main Phase Row */}
      <PhaseRow
        phase={phase}
        isExpanded={phase.isExpanded}
        hasChildren={hasSubPhases}
        depth={0}
        onToggle={() => onToggle(phase.id)}
        onPress={() => onPhasePress?.(phase)}
        onAddSubPhase={onAddSubPhase ? () => onAddSubPhase(phase.id) : undefined}
        rowHeight={rowHeight}
        fontSize={fontSize}
        readOnly={readOnly}
      />

      {/* Sub-Phases (visible only when expanded) */}
      {phase.isExpanded && hasSubPhases && (
        <View style={styles.subPhases}>
          {phase.subPhases!.map(subPhase => (
            <PhaseRow
              key={subPhase.id}
              phase={subPhase}
              isExpanded={false}
              hasChildren={false}
              depth={1}
              onPress={() => onPhasePress?.(subPhase)}
              rowHeight={rowHeight}
              fontSize={fontSize}
              readOnly={readOnly}
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
