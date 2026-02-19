import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Trash2, Check } from 'lucide-react-native';
import { GanttTask, ScheduleViewMode } from '@/types';
import { useGanttResponsive } from '../hooks/useGanttResponsive';
import TaskFormFields from './TaskFormFields';

interface TaskDetailModalProps {
  visible: boolean;
  task: GanttTask | null;
  viewMode?: ScheduleViewMode;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<GanttTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onMarkCompleted?: (taskId: string) => Promise<void>;
}

/**
 * Modal for viewing and editing task details.
 * Internal view: full editing, notes, work type, delete, mark-completed.
 * Client view: read-only, hides notes and work type.
 */
export default function TaskDetailModal({
  visible,
  task,
  viewMode = 'internal',
  onClose,
  onSave,
  onDelete,
  onMarkCompleted,
}: TaskDetailModalProps) {
  const responsive = useGanttResponsive();

  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workType, setWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [notes, setNotes] = useState('');
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

  const isReadOnly = viewMode === 'client';

  // Populate form when task changes
  useEffect(() => {
    if (task) {
      setCategory(task.category || '');
      setStartDate(task.startDate || '');
      setEndDate(task.endDate || '');
      setWorkType(task.workType || 'in-house');
      setNotes(task.notes || '');
      setVisibleToClient(task.visibleToClient ?? true);
    }
  }, [task]);

  const computedDuration = (): number => {
    if (!startDate || !endDate) return 0;
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const resetForm = () => {
    setCategory('');
    setStartDate('');
    setEndDate('');
    setWorkType('in-house');
    setNotes('');
    setVisibleToClient(true);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setIsSubmitting(false);
    setIsMarkingComplete(false);
  };

  const handleSave = async () => {
    if (!task) return;

    if (!category.trim()) {
      showAlert('Validation', 'Please enter a task name');
      return;
    }
    if (!startDate || !endDate) {
      showAlert('Validation', 'Please select start and end dates');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showAlert('Validation', 'End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(task.id, {
        category: category.trim(),
        startDate,
        endDate,
        duration: computedDuration(),
        workType,
        notes: notes.trim(),
        visibleToClient,
      });
      resetForm();
      onClose();
    } catch (err) {
      console.error('[TaskModal] Save error:', err);
      showAlert('Error', 'Failed to save task');
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    const doDelete = async () => {
      setIsSubmitting(true);
      try {
        await onDelete(task.id);
        resetForm();
        onClose();
      } catch (err) {
        console.error('[TaskModal] Delete error:', err);
        showAlert('Error', 'Failed to delete task');
        setIsSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this task? This action cannot be undone.')) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Task', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleMarkCompleted = async () => {
    if (!task || !onMarkCompleted) return;
    setIsMarkingComplete(true);
    try {
      await onMarkCompleted(task.id);
      resetForm();
      onClose();
    } catch (err) {
      console.error('[TaskModal] Mark complete error:', err);
      showAlert('Error', 'Failed to mark task as completed');
      setIsMarkingComplete(false);
    }
  };

  if (!task) return null;

  const isFormValid = !!(category.trim() && startDate && endDate);
  const isAlreadyCompleted = !!task.completed;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => { resetForm(); onClose(); }}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { maxWidth: responsive.isMobile ? '95%' : 460 }]}>
          {/* Header */}
          <View style={[styles.header, { padding: responsive.padding }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { fontSize: responsive.headerFontSize }]}>
                {isReadOnly ? 'Task Details' : 'Edit Task'}
              </Text>
              {isAlreadyCompleted && (
                <View style={styles.completedBadge}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.completedBadgeText}>Completed</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { resetForm(); onClose(); }}
              activeOpacity={0.7}
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Duration summary strip */}
          {startDate && endDate && (
            <View style={styles.durationStrip}>
              <Text style={styles.durationText}>
                Duration: <Text style={styles.durationValue}>{computedDuration()} day{computedDuration() !== 1 ? 's' : ''}</Text>
              </Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ padding: responsive.padding }}
            showsVerticalScrollIndicator
          >
            <TaskFormFields
              category={category}
              startDate={startDate}
              endDate={endDate}
              workType={workType}
              notes={notes}
              visibleToClient={visibleToClient}
              onCategoryChange={setCategory}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onWorkTypeChange={setWorkType}
              onNotesChange={setNotes}
              onVisibleToClientChange={setVisibleToClient}
              showStartDatePicker={showStartDatePicker}
              showEndDatePicker={showEndDatePicker}
              onShowStartDatePicker={setShowStartDatePicker}
              onShowEndDatePicker={setShowEndDatePicker}
              readOnly={isReadOnly}
              hideWorkType={isReadOnly}
              hideNotes={isReadOnly}
            />
          </ScrollView>

          {/* Footer */}
          {!isReadOnly && (
            <View style={[styles.footer, { padding: responsive.padding }]}>
              {/* Left: Delete */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={isSubmitting || isMarkingComplete}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>

              {/* Right: Mark Complete + Save */}
              <View style={styles.actionButtons}>
                {/* Mark as Completed */}
                {!isAlreadyCompleted && onMarkCompleted && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={handleMarkCompleted}
                    disabled={isSubmitting || isMarkingComplete}
                    activeOpacity={0.7}
                  >
                    {isMarkingComplete ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Check size={14} color="#10B981" strokeWidth={2.5} />
                        <Text style={styles.completeButtonText}>Complete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Cancel */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => { resetForm(); onClose(); }}
                  disabled={isSubmitting || isMarkingComplete}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!isFormValid || isSubmitting || isMarkingComplete) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!isFormValid || isSubmitting || isMarkingComplete}
                  activeOpacity={0.7}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontWeight: '600',
    color: '#111827',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationStrip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  durationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  durationValue: {
    fontWeight: '600',
    color: '#059669',
  },
  body: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  deleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  actionButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  completeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
