import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { X, Calendar, Bell, Clock, Plus } from 'lucide-react-native';
import { useDailyTaskResponsive } from './hooks/useDailyTaskResponsive';
import CustomDatePicker from './CustomDatePicker';
import CustomTimePicker from './CustomTimePicker';

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    dueDate: string;
    dueTime: string;
    dueDateTime: string;
    reminder: boolean;
    notes: string;
  }) => Promise<void>;
}

export default function AddTaskModal({ visible, onClose, onSubmit }: AddTaskModalProps) {
  const responsive = useDailyTaskResponsive();

  // Form state
  const [title, setTitle] = useState('');
  const [dateString, setDateString] = useState('');
  const [time, setTime] = useState('09:00');
  const [reminder, setReminder] = useState(false);
  const [notes, setNotes] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showAlert = (alertTitle: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${alertTitle}: ${message}`);
    } else {
      Alert.alert(alertTitle, message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDateString('');
    setTime('09:00');
    setReminder(false);
    setNotes('');
    setShowCalendar(false);
    setShowTimePicker(false);
    setIsSubmitting(false);
  };

  const isValidFutureDate = (): boolean => {
    if (!dateString || dateString.length !== 10) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateString >= today;
  };

  const formatTimeDisplay = (t: string): string => {
    if (!t) return '9:00 AM';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const formatDisplayDate = (str: string): string => {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateSelect = (selectedDate: string) => {
    setDateString(selectedDate);
    setShowCalendar(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert('Error', 'Please enter a task title');
      return;
    }
    if (!isValidFutureDate()) {
      showAlert('Error', 'Please select a valid date (today or in the future)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse as local time (no timezone suffix = local per ECMAScript spec)
      // then convert to UTC ISO string so the cron's now.toISOString() comparison is correct.
      const dueDateTime = new Date(`${dateString}T${time}:00`).toISOString();
      await onSubmit({
        title: title.trim(),
        dueDate: dateString,
        dueTime: time,
        dueDateTime,
        reminder,
        notes: notes.trim(),
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
      showAlert('Error', 'Failed to add task. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = title.trim().length > 0 && isValidFutureDate();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { maxWidth: responsive.isMobile ? '95%' : 480 }]}>

          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: responsive.sidebarPadding, paddingVertical: 16 }]}>
            <Text style={[styles.headerTitle, { fontSize: responsive.headerFontSize }]}>
              Add New Task
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Scrollable form body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ padding: responsive.sidebarPadding, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Task Title ── */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Task Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="What needs to be done?"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
                autoFocus={true}
                returnKeyType="next"
              />
            </View>

            {/* ── Due Date ── */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Due Date <Text style={styles.required}>*</Text>
              </Text>

              {/* Date trigger row */}
              <TouchableOpacity
                style={[styles.inputWithIcon, showCalendar && styles.inputWithIconActive]}
                onPress={() => { setShowTimePicker(false); setShowCalendar(prev => !prev); }}
                activeOpacity={0.7}
              >
                <Calendar size={20} color={showCalendar ? '#10B981' : '#6B7280'} />
                <Text style={[styles.inputText, !dateString && styles.inputPlaceholder]}>
                  {dateString ? formatDisplayDate(dateString) : 'Select a date'}
                </Text>
                {dateString && (
                  <TouchableOpacity
                    onPress={() => { setDateString(''); setShowCalendar(false); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Custom calendar — pure RN, no native bridge, works on iPad */}
              {showCalendar && (
                <CustomDatePicker
                  value={dateString}
                  onChange={handleDateSelect}
                  minimumDate={new Date()}
                />
              )}

              {!isValidFutureDate() && dateString.length > 0 && (
                <Text style={styles.fieldError}>Must be today or a future date</Text>
              )}
            </View>

            {/* ── Due Time ── */}
            <View style={styles.field}>
              <Text style={styles.label}>Due Time <Text style={styles.optional}>(optional)</Text></Text>

              {/* Time trigger row */}
              <TouchableOpacity
                style={[styles.inputWithIcon, showTimePicker && styles.inputWithIconActive]}
                onPress={() => { setShowCalendar(false); setShowTimePicker(prev => !prev); }}
                activeOpacity={0.7}
              >
                <Clock size={20} color={showTimePicker ? '#10B981' : '#6B7280'} />
                <Text style={styles.inputText}>{formatTimeDisplay(time)}</Text>
              </TouchableOpacity>

              {/* Custom time picker — pure RN, works on iPad */}
              {showTimePicker && (
                <CustomTimePicker
                  value={time}
                  onChange={setTime}
                />
              )}
            </View>

            {/* ── Reminder Toggle ── */}
            <View style={styles.field}>
              <TouchableOpacity
                style={styles.reminderRow}
                onPress={() => setReminder(r => !r)}
                activeOpacity={0.7}
              >
                <View style={[styles.reminderIcon, reminder && styles.reminderIconActive]}>
                  <Bell size={20} color={reminder ? '#F59E0B' : '#9CA3AF'} />
                </View>
                <View style={styles.reminderText}>
                  <Text style={styles.reminderLabel}>Set Reminder</Text>
                  <Text style={styles.reminderHint}>Get notified when task is due</Text>
                </View>
                <View style={[styles.toggle, reminder && styles.toggleActive]}>
                  <View style={[styles.toggleKnob, reminder && styles.toggleKnobActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* ── Notes ── */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any additional details..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { padding: responsive.sidebarPadding }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!isFormValid || isSubmitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.7}
              disabled={!isFormValid || isSubmitting}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Adding...' : 'Add Task'}
              </Text>
            </TouchableOpacity>
          </View>

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
    padding: 20,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: {
    flexShrink: 1,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },

  // Fields
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  optional: {
    color: '#9CA3AF',
    fontWeight: '400',
    fontSize: 13,
  },
  fieldError: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  // Text inputs
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputWithIconActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputText: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  inputPlaceholder: {
    color: '#9CA3AF',
  },
  inputInner: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },

  // Time presets
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetBtnActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  presetTextActive: {
    color: '#059669',
  },

  // Reminder
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderIconActive: {
    backgroundColor: '#FEF3C7',
  },
  reminderText: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  reminderHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },

  // Footer buttons
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
