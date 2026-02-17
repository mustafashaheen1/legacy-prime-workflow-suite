import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ZoomIn, ZoomOut, Calendar } from 'lucide-react-native';
import { ZoomLevel } from '@/types';

interface ZoomControlsProps {
  zoomLevel: ZoomLevel;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoomLevel: (level: ZoomLevel) => void;
}

/**
 * Zoom controls for adjusting timeline scale
 */
export default function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onSetZoomLevel,
}: ZoomControlsProps) {
  const zoomLevels: ZoomLevel[] = ['day', 'week', 'month'];

  return (
    <View style={styles.container}>
      {/* Zoom Buttons */}
      <View style={styles.zoomButtons}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={onZoomOut}
          activeOpacity={0.7}
        >
          <ZoomOut size={18} color="#374151" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.zoomButton}
          onPress={onZoomIn}
          activeOpacity={0.7}
        >
          <ZoomIn size={18} color="#374151" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Zoom Level Selector */}
      <View style={styles.levelSelector}>
        {zoomLevels.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.levelButton,
              zoomLevel === level && styles.levelButtonActive,
            ]}
            onPress={() => onSetZoomLevel(level)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.levelText,
                zoomLevel === level && styles.levelTextActive,
              ]}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  levelSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 2,
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  levelButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  levelTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
});
