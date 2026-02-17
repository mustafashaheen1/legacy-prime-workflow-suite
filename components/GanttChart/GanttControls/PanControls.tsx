import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';

interface PanControlsProps {
  onPanLeft: () => void;
  onPanRight: () => void;
  onPanStart: () => void;
  onPanEnd: () => void;
}

/**
 * Pan controls for navigating the timeline
 */
export default function PanControls({
  onPanLeft,
  onPanRight,
  onPanStart,
  onPanEnd,
}: PanControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.panButton}
        onPress={onPanStart}
        activeOpacity={0.7}
      >
        <ChevronsLeft size={18} color="#374151" strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.panButton}
        onPress={onPanLeft}
        activeOpacity={0.7}
      >
        <ChevronLeft size={18} color="#374151" strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.panButton}
        onPress={onPanRight}
        activeOpacity={0.7}
      >
        <ChevronRight size={18} color="#374151" strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.panButton}
        onPress={onPanEnd}
        activeOpacity={0.7}
      >
        <ChevronsRight size={18} color="#374151" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  panButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
