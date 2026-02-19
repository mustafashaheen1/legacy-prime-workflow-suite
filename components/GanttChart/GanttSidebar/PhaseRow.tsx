import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react-native';
import { SchedulePhase } from '@/types';

interface PhaseRowProps {
  phase: SchedulePhase;
  isExpanded?: boolean;
  hasChildren?: boolean;
  depth?: number;
  onToggle?: () => void;
  onPress?: () => void;
  onAddSubPhase?: () => void;
  rowHeight: number;
  fontSize: number;
  readOnly?: boolean;
}

/**
 * Individual phase row in the sidebar.
 * Shows phase name with expand/collapse icon if it has children.
 * Main phases (depth=0) show a "+" button to add sub-phases.
 */
export default function PhaseRow({
  phase,
  isExpanded = false,
  hasChildren = false,
  depth = 0,
  onToggle,
  onPress,
  onAddSubPhase,
  rowHeight,
  fontSize,
  readOnly = false,
}: PhaseRowProps) {
  const indentWidth = depth * 20;
  const isMainPhase = depth === 0;

  return (
    <TouchableOpacity
      style={[styles.row, { height: rowHeight, paddingLeft: 12 + indentWidth }]}
      onPress={hasChildren ? onToggle : onPress}
      activeOpacity={0.7}
    >
      {/* Expand/Collapse Icon — only when there are children */}
      {hasChildren && (
        <View style={styles.iconContainer}>
          {isExpanded ? (
            <ChevronDown size={16} color="#6B7280" strokeWidth={2} />
          ) : (
            <ChevronRight size={16} color="#6B7280" strokeWidth={2} />
          )}
        </View>
      )}

      {/* Color Indicator */}
      <View style={[styles.colorIndicator, { backgroundColor: phase.color }]} />

      {/* Phase Name */}
      <Text
        style={[
          styles.phaseName,
          { fontSize },
          depth > 0 && styles.subPhaseName,
        ]}
        numberOfLines={1}
      >
        {phase.name}
      </Text>

      {/* Add Sub-Phase button — main phases only, internal view */}
      {isMainPhase && !readOnly && onAddSubPhase && (
        <TouchableOpacity
          style={styles.addSubPhaseBtn}
          onPress={(e) => {
            e.stopPropagation();
            onAddSubPhase();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Plus size={14} color="#10B981" strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    marginRight: 8,
  },
  colorIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  phaseName: {
    flex: 1,
    fontWeight: '600',
    color: '#111827',
  },
  subPhaseName: {
    fontWeight: '500',
    color: '#4B5563',
  },
  addSubPhaseBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});
