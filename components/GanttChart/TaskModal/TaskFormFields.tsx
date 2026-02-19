import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Switch,
} from 'react-native';
import { Calendar, User } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TaskFormFieldsProps {
  category: string;
  startDate: string;
  endDate: string;
  workType: 'in-house' | 'subcontractor';
  notes: string;
  visibleToClient: boolean;
  onCategoryChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onWorkTypeChange: (value: 'in-house' | 'subcontractor') => void;
  onNotesChange: (value: string) => void;
  onVisibleToClientChange: (value: boolean) => void;
  showStartDatePicker: boolean;
  showEndDatePicker: boolean;
  onShowStartDatePicker: (show: boolean) => void;
  onShowEndDatePicker: (show: boolean) => void;
  readOnly?: boolean;
  /** Client view: hide work type toggle */
  hideWorkType?: boolean;
  /** Client view: hide internal notes */
  hideNotes?: boolean;
}

/**
 * Reusable form fields for task details.
 * hideWorkType and hideNotes are used in client view.
 */
export default function TaskFormFields({
  category,
  startDate,
  endDate,
  workType,
  notes,
  visibleToClient,
  onCategoryChange,
  onStartDateChange,
  onEndDateChange,
  onWorkTypeChange,
  onNotesChange,
  onVisibleToClientChange,
  showStartDatePicker,
  showEndDatePicker,
  onShowStartDatePicker,
  onShowEndDatePicker,
  readOnly = false,
  hideWorkType = false,
  hideNotes = false,
}: TaskFormFieldsProps) {
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleStartDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') onShowStartDatePicker(false);
    if (date) {
      onStartDateChange(date.toISOString());
      if (Platform.OS === 'ios') onShowStartDatePicker(false);
    }
  };

  const handleEndDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') onShowEndDatePicker(false);
    if (date) {
      onEndDateChange(date.toISOString());
      if (Platform.OS === 'ios') onShowEndDatePicker(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Category / Name */}
      <View style={styles.field}>
        <Text style={styles.label}>Task Name</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={onCategoryChange}
          placeholder="e.g., Foundation, Framing, Electrical"
          placeholderTextColor="#9CA3AF"
          editable={!readOnly}
        />
      </View>

      {/* Date Range */}
      <View style={styles.row}>
        <View style={[styles.field, styles.halfWidth]}>
          <Text style={styles.label}>Start Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => !readOnly && onShowStartDatePicker(true)}
            disabled={readOnly}
          >
            <Calendar size={16} color="#6B7280" />
            <Text style={styles.dateText}>
              {startDate ? formatDateForDisplay(startDate) : 'Select date'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.field, styles.halfWidth]}>
          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => !readOnly && onShowEndDatePicker(true)}
            disabled={readOnly}
          >
            <Calendar size={16} color="#6B7280" />
            <Text style={styles.dateText}>
              {endDate ? formatDateForDisplay(endDate) : 'Select date'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Work Type — hidden in client view */}
      {!hideWorkType && (
        <View style={styles.field}>
          <Text style={styles.label}>Work Type</Text>
          <View style={styles.workTypeSelector}>
            <TouchableOpacity
              style={[styles.workTypeButton, workType === 'in-house' && styles.workTypeButtonActive]}
              onPress={() => !readOnly && onWorkTypeChange('in-house')}
              disabled={readOnly}
              activeOpacity={0.7}
            >
              <User size={16} color={workType === 'in-house' ? '#FFFFFF' : '#6B7280'} strokeWidth={2} />
              <Text style={[styles.workTypeText, workType === 'in-house' && styles.workTypeTextActive]}>
                In-House
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.workTypeButton, workType === 'subcontractor' && styles.workTypeButtonActive]}
              onPress={() => !readOnly && onWorkTypeChange('subcontractor')}
              disabled={readOnly}
              activeOpacity={0.7}
            >
              <User size={16} color={workType === 'subcontractor' ? '#FFFFFF' : '#6B7280'} strokeWidth={2} />
              <Text style={[styles.workTypeText, workType === 'subcontractor' && styles.workTypeTextActive]}>
                Subcontractor
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notes — hidden in client view */}
      {!hideNotes && (
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Add internal notes..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!readOnly}
          />
        </View>
      )}

      {/* Visible to Client toggle — only in internal view */}
      {!hideWorkType && (
        <View style={styles.field}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Visible to Client</Text>
              <Text style={styles.hint}>Show this task in client-facing schedule</Text>
            </View>
            <Switch
              value={visibleToClient}
              onValueChange={onVisibleToClientChange}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={visibleToClient ? '#10B981' : '#F3F4F6'}
              disabled={readOnly}
            />
          </View>
        </View>
      )}

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate ? new Date(endDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    fontSize: 14,
    color: '#374151',
  },
  workTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  workTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  workTypeButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  workTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  workTypeTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
