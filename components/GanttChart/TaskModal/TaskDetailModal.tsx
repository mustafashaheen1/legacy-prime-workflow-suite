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
import { X, Trash2 } from 'lucide-react-native';
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
}

/**
 * Modal for viewing and editing task details
 * Adapts to view mode (internal vs client)
 */
export default function TaskDetailModal({
  visible,
  task,
  viewMode = 'internal',
  onClose,
  onSave,
  onDelete,
}: TaskDetailModalProps) {
  const responsive = useGanttResponsive();

  // Form state
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workType, setWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [notes, setNotes] = useState('');
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const showAlert = (alertTitle: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${alertTitle}: ${message}`);
    } else {
      Alert.alert(alertTitle, message);
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
  };

  const handleSave = async () => {
    if (!task) return;

    if (!category.trim()) {
      showAlert('Error', 'Please enter a category/name');
      return;
    }

    if (!startDate || !endDate) {
      showAlert('Error', 'Please select start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      showAlert('Error', 'End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate duration in days
      const durationMs = end.getTime() - start.getTime();
      const duration = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

      await onSave(task.id, {
        category: category.trim(),
        startDate,
        endDate,
        duration,
        workType,
        notes: notes.trim(),
        visibleToClient,
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      showAlert('Error', 'Failed to save task');
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    if (Platform.OS === 'web') {
      const confirmed = confirm('Are you sure you want to delete this task?');
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Delete Task',
        'Are you sure you want to delete this task?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsSubmitting(true);
              try {
                await onDelete(task.id);
                resetForm();
                onClose();
              } catch (error) {
                console.error('Error deleting task:', error);
                showAlert('Error', 'Failed to delete task');
                setIsSubmitting(false);
              }
            },
          },
        ]
      );
      return; // Exit early for mobile - deletion happens in Alert callback
    }

    // Web deletion (after confirm)
    setIsSubmitting(true);
    try {
      await onDelete(task.id);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      showAlert('Error', 'Failed to delete task');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!task) return null;

  const isFormValid = category.trim() && startDate && endDate;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { maxWidth: responsive.isMobile ? '95%' : 440 }]}>
          {/* Header */}
          <View style={[styles.header, { padding: responsive.padding }]}>
            <Text style={[styles.title, { fontSize: responsive.headerFontSize }]}>
              {isReadOnly ? 'Task Details' : 'Edit Task'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ padding: responsive.padding }}
            showsVerticalScrollIndicator={true}
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
            />
          </ScrollView>

          {/* Footer */}
          {!isReadOnly && (
            <View style={[styles.footer, { padding: responsive.padding }]}>
              {/* Delete Button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!isFormValid || isSubmitting) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!isFormValid || isSubmitting}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  title: {
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
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
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
