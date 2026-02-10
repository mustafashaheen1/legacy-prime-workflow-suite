import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, Bell, Trash2, Check } from 'lucide-react-native';
import { DailyTask } from '@/types';
import { useDailyTaskResponsive } from './hooks/useDailyTaskResponsive';

interface DailyTaskCardProps {
  task: DailyTask;
  onToggleComplete: (task: DailyTask) => void;
  onDelete: (taskId: string) => void;
}

export default function DailyTaskCard({ task, onToggleComplete, onDelete }: DailyTaskCardProps) {
  const responsive = useDailyTaskResponsive();

  const formatTaskDate = (dateString: string): string => {
    if (!dateString) return '';
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateString === today) return 'Today';
    if (dateString === tomorrow) return 'Tomorrow';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatTimestamp = (isoString: string): string => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <View style={[styles.card, task.completed && styles.cardCompleted]}>
      {/* Checkbox - Fixed width, top-aligned */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggleComplete(task)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            { width: responsive.checkboxSize, height: responsive.checkboxSize },
            task.completed && styles.checkboxChecked,
          ]}
        >
          {task.completed && <Check size={14} color="#FFF" />}
        </View>
      </TouchableOpacity>

      {/* Content - Flexible, constrained */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { fontSize: responsive.bodyFontSize },
            task.completed && styles.titleCompleted,
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {task.title}
        </Text>

        {/* Meta row - Date and reminder */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Calendar size={responsive.metaFontSize} color="#9CA3AF" />
            <Text style={[styles.metaText, { fontSize: responsive.metaFontSize }]} numberOfLines={1}>
              {formatTaskDate(task.dueDate)}
              {task.dueTime && ` • ${formatTime(task.dueTime)}`}
            </Text>
          </View>
          {task.reminder && (
            <View style={styles.metaItem}>
              <Bell size={responsive.metaFontSize} color="#F59E0B" />
              <Text style={[styles.metaText, { fontSize: responsive.metaFontSize, color: '#F59E0B' }]}>
                {task.reminderSent ? 'Sent' : 'Set'}
              </Text>
            </View>
          )}
        </View>

        {/* Timestamps - Constrained width to prevent overflow */}
        {(task.createdAt || (task.completed && task.completedAt)) && (
          <View style={styles.timestamps}>
            {task.createdAt && (
              <Text
                style={[styles.timestamp, { fontSize: responsive.timestampFontSize }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Created: {formatTimestamp(task.createdAt)}
              </Text>
            )}
            {task.completed && task.completedAt && (
              <Text
                style={[styles.timestamp, { fontSize: responsive.timestampFontSize }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Completed: {formatTimestamp(task.completedAt)}
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        {task.notes && (
          <Text style={styles.notes} numberOfLines={2} ellipsizeMode="tail">
            {task.notes}
          </Text>
        )}
      </View>

      {/* Delete button - Fixed width, top-aligned */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(task.id)}
        activeOpacity={0.7}
      >
        <Trash2 size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  cardCompleted: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },

  // Checkbox - Fixed width column
  checkboxContainer: {
    paddingTop: 2, // Align with first line of text
    paddingRight: 12,
  },
  checkbox: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  // Content - Flexible column with constraints
  content: {
    flex: 1,
    minWidth: 0, // Critical: allows flex child to shrink below content size
    paddingRight: 8,
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 6,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },

  // Meta row - Horizontally scrollable if needed
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    color: '#9CA3AF',
    flexShrink: 1,
  },

  // Timestamps - Constrained to prevent overflow
  timestamps: {
    gap: 3,
    marginBottom: 6,
  },
  timestamp: {
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 14,
  },

  // Notes
  notes: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Delete button - Fixed width column
  deleteButton: {
    paddingTop: 2, // Align with first line of text
    paddingLeft: 4,
    width: 28,
    alignItems: 'center',
  },
});
