import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, Bell, Trash2, Check, Clock } from 'lucide-react-native';
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

  return (
    <View style={[styles.card, task.completed && styles.cardCompleted]}>
      {/* Left: Checkbox */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggleComplete(task)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
          {task.completed && <Check size={16} color="#FFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>

      {/* Center: Content */}
      <View style={styles.content}>
        {/* Title - Remove strikethrough for better readability */}
        <Text
          style={[styles.title, task.completed && styles.titleCompleted]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {/* Date & Time Row */}
        <View style={styles.infoRow}>
          <View style={styles.dateTimeContainer}>
            <Calendar size={14} color="#6B7280" strokeWidth={2} />
            <Text style={styles.dateText}>{formatTaskDate(task.dueDate)}</Text>
            {task.dueTime && (
              <>
                <Clock size={14} color="#6B7280" strokeWidth={2} />
                <Text style={styles.timeText}>{formatTime(task.dueTime)}</Text>
              </>
            )}
          </View>

          {/* Reminder Badge */}
          {task.reminder && (
            <View style={[styles.reminderBadge, task.reminderSent && styles.reminderBadgeSent]}>
              <Bell size={12} color={task.reminderSent ? '#10B981' : '#F59E0B'} strokeWidth={2} />
              <Text style={[styles.reminderText, task.reminderSent && styles.reminderTextSent]}>
                {task.reminderSent ? 'Sent' : 'Reminder'}
              </Text>
            </View>
          )}
        </View>

        {/* Notes - Only show if present */}
        {task.notes && !task.completed && (
          <Text style={styles.notes} numberOfLines={2}>
            {task.notes}
          </Text>
        )}

        {/* Completed timestamp - Only for completed tasks */}
        {task.completed && task.completedAt && (
          <Text style={styles.completedText}>
            Completed {new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        )}
      </View>

      {/* Right: Delete button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(task.id)}
        activeOpacity={0.7}
      >
        <Trash2 size={18} color="#EF4444" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card Container
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },

  // Checkbox
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  // Content Area
  content: {
    flex: 1,
    gap: 8,
  },

  // Title
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  titleCompleted: {
    color: '#9CA3AF',
  },

  // Info Row (Date, Time, Reminder)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Date & Time
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Reminder Badge
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  reminderBadgeSent: {
    backgroundColor: '#D1FAE5',
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  reminderTextSent: {
    color: '#10B981',
  },

  // Notes
  notes: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // Completed Timestamp
  completedText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },

  // Delete Button
  deleteButton: {
    marginLeft: 8,
    padding: 4,
    marginTop: 2,
  },
});
