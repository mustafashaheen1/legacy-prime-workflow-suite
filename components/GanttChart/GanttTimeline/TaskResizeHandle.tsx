import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

interface TaskResizeHandleProps {
  type: 'left' | 'right';
  position: {
    left?: number;
    right?: number;
    top: number;
    height: number;
  };
  onPressIn?: () => void;
  onPressOut?: () => void;
}

/**
 * Drag handle for resizing tasks
 */
export default function TaskResizeHandle({
  type,
  position,
  onPressIn,
  onPressOut,
}: TaskResizeHandleProps) {
  return (
    <TouchableOpacity
      style={[
        styles.handle,
        type === 'left' ? { left: position.left } : { right: position.right },
        { top: position.top, height: position.height },
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.7}
    >
      <View style={styles.handleIndicator} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  handleIndicator: {
    width: 4,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
