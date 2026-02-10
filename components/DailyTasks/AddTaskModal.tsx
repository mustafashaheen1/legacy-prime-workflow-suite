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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDailyTaskResponsive } from './hooks/useDailyTaskResponsive';

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
    setShowDatePicker(false);
    setSelectedDate(new Date());
    setIsSubmitting(false);
  };

  const isValidFutureDate = (): boolean => {
    if (!dateString || dateString.length !== 10) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateString >= today;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (date) {
      setSelectedDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setDateString(`${year}-${month}-${day}`);

      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    } else if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert('Error', 'Please enter a task title');
      return;
    }
    if (!isValidFutureDate()) {
      showAlert('Error', 'Please enter a valid date (YYYY-MM-DD format, today or future)');
      return;
    }

    setIsSubmitting(true);
    try {
      const dueDateTime = `${dateString}T${time}:00`;
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
      showAlert('Error', 'Failed to add task');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = title.trim() && isValidFutureDate();

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.content, { maxWidth: responsive.isMobile ? '95%' : 440 }]}>
            {/* Header */}
            <View style={[styles.header, { padding: responsive.sidebarPadding }]}>
              <Text style={[styles.title, { fontSize: responsive.headerFontSize }]}>
                Add New Task
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={{ padding: responsive.sidebarPadding }}
              showsVerticalScrollIndicator={false}
            >
              {/* Task Title */}
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
                />
              </View>

              {/* Due Date */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Due Date <Text style={styles.required}>*</Text>
                </Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.inputWithIcon}>
                    <Calendar size={20} color="#6B7280" />
                    <input
                      type="date"
                      style={{
                        flex: 1,
                        paddingTop: 14,
                        paddingBottom: 14,
                        fontSize: 16,
                        color: '#1F2937',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontFamily:
                          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                      value={dateString}
                      onChange={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        setDateString(value);
                      }}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.inputWithIcon}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Calendar size={20} color="#6B7280" />
                    <Text style={[styles.dateText, !dateString && styles.datePlaceholder]}>
                      {dateString || 'Select a date'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Due Time */}
              <View style={styles.field}>
                <Text style={styles.label}>Due Time</Text>
                <View style={styles.inputWithIcon}>
                  <Clock size={20} color="#6B7280" />
                  <TextInput
                    style={styles.inputInner}
                    placeholder="HH:MM"
                    placeholderTextColor="#9CA3AF"
                    value={time}
                    onChangeText={(text) => {
                      let cleaned = text.replace(/[^0-9:]/g, '');
                      if (cleaned.length === 2 && !cleaned.includes(':')) {
                        cleaned = cleaned + ':';
                      }
                      if (cleaned.length <= 5) {
                        setTime(cleaned);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <View style={styles.timePresets}>
                    <TouchableOpacity
                      style={styles.presetBtn}
                      onPress={() => setTime('09:00')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetText}>9AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetBtn}
                      onPress={() => setTime('12:00')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetText}>12PM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetBtn}
                      onPress={() => setTime('17:00')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetText}>5PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Reminder Toggle */}
              <View style={styles.field}>
                <TouchableOpacity
                  style={styles.reminderRow}
                  onPress={() => setReminder(!reminder)}
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

              {/* Notes */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Notes <Text style={styles.optional}>(Optional)</Text>
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

      {/* Date Picker - Native Only */}
      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </>
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
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
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
    maxHeight: 500,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },

  // Form Fields
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
  },
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
    paddingHorizontal: 16,
    gap: 12,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  dateText: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  datePlaceholder: {
    color: '#9CA3AF',
  },

  // Time Presets
  timePresets: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
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

  // Buttons
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
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
