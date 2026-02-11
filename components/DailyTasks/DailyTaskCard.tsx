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
      {/* Row 1: Checkbox + Content + Delete */}
      <View style={styles.mainRow}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => onToggleComplete(task)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
            {task.completed && <Check size={16} color="#FFF" strokeWidth={3} />}
          </View>
        </TouchableOpacity>

        {/* Content Area */}
        <View style={styles.content}>
          {/* Title */}
          <Text
            style={[styles.title, task.completed && styles.titleCompleted]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          {/* Date & Time */}
          <View style={styles.dateTimeRow}>
            <Calendar size={13} color="#6B7280" strokeWidth={2} />
            <Text style={styles.dateText}>{formatTaskDate(task.dueDate)}</Text>
            {task.dueTime && (
              <>
                <View style={styles.separator} />
                <Clock size={13} color="#6B7280" strokeWidth={2} />
                <Text style={styles.timeText}>{formatTime(task.dueTime)}</Text>
              </>
            )}
          </View>

          {/* Reminder Badge - FORCED on own line */}
          {task.reminder && (
            <View style={styles.reminderContainer}>
              <View style={[styles.reminderBadge, task.reminderSent && styles.reminderBadgeSent]}>
                <Bell size={11} color={task.reminderSent ? '#10B981' : '#F59E0B'} strokeWidth={2} />
                <Text style={[styles.reminderText, task.reminderSent && styles.reminderTextSent]}>
                  {task.reminderSent ? 'Reminder sent' : 'Reminder set'}
                </Text>
              </View>
            </View>
          )}

          {/* Notes */}
          {task.notes && !task.completed && (
            <Text style={styles.notes} numberOfLines={2}>
              {task.notes}
            </Text>
          )}

          {/* Completed timestamp */}
          {task.completed && task.completedAt && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>
                ✓ Completed on {new Date(task.completedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: new Date(task.completedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                })} at {new Date(task.completedAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(task.id)}
          activeOpacity={0.7}
        >
          <Trash2 size={18} color="#EF4444" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card Container
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 14,
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

  // Main Row (Checkbox + Content + Delete)
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Checkbox
  checkboxContainer: {
    marginRight: 10,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
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
    flexDirection: 'column',
  },

  // Title
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 6,
  },
  titleCompleted: {
    color: '#9CA3AF',
  },

  // Date & Time Row
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
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

  // Reminder Container (forces full width)
  reminderContainer: {
    width: '100%',
    marginBottom: 6,
  },

  // Reminder Badge
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
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
    marginBottom: 6,
  },

  // Completed Timestamp
  completedContainer: {
    marginTop: 2,
  },
  completedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    fontStyle: 'italic',
  },

  // Delete Button
  deleteButton: {
    marginLeft: 6,
    padding: 6,
    marginTop: -2,
  },
});
