import { useState, useEffect } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { X, Clock } from 'lucide-react-native';
import { Appointment, Client, Project } from '@/types';

const APPOINTMENT_TYPES: Appointment['type'][] = ['Estimate', 'Site Visit', 'Follow-Up', 'Client Meeting', 'Project Meeting', 'Other'];

// Generate 30-min slots from 7:00 AM to 6:00 PM
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 18; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 18) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

function formatTime12(val: string): string {
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return val;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>;
  onDelete?: () => void;
  initial?: Appointment;
  clients: Client[];
  projects: Project[];
  companyId: string;
  createdBy?: string;
}

export default function AppointmentFormModal({ visible, onClose, onSave, onDelete, initial, clients, projects, companyId, createdBy }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Appointment['type']>(undefined);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [clientId, setClientId] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setType(initial?.type ?? undefined);
    setDate(initial?.date ?? '');
    setTime(initial?.time ?? '09:00');
    setEndTime(initial?.endTime ?? '10:00');
    setClientId(initial?.clientId);
    setProjectId(initial?.projectId);
    setAddress(initial?.address ?? '');
    setPhone(initial?.phone ?? '');
    setEmail(initial?.email ?? '');
    setNotes(initial?.notes ?? '');
    setTitleError('');
    setDateError('');
    setTimeError('');
    setEmailError('');
    setPhoneError('');
    // Only reset when modal opens — not on `initial` reference changes,
    // which would wipe user input mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isValidDate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
  const isValidTime = (val: string) => val === '' || /^\d{2}:\d{2}$/.test(val);

  const handleSave = async () => {
    const errors: string[] = [];
    setTitleError(''); setDateError(''); setTimeError(''); setEmailError(''); setPhoneError('');

    if (!title.trim()) { setTitleError('Title is required'); errors.push('Please enter a title'); }
    if (!date.trim()) { setDateError('Date is required (YYYY-MM-DD)'); errors.push('Please enter a date'); }
    else if (!isValidDate(date.trim())) { setDateError('Use format YYYY-MM-DD'); errors.push('Please enter a valid date'); }

    // Time validations
    if (time && endTime) {
      if (time === endTime) { setTimeError('Start and end time cannot be the same'); errors.push('Start and end time cannot be the same'); }
      else if (time > endTime) { setTimeError('End time must be after start time'); errors.push('End time must be after start time'); }
    } else if (time && !endTime) {
      setTimeError('Please select an end time'); errors.push('Please select an end time');
    } else if (!time && endTime) {
      setTimeError('Please select a start time'); errors.push('Please select a start time');
    }

    // Email validation
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address'); errors.push('Please enter a valid email');
    }

    // Phone validation (at least 7 digits)
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) {
      setPhoneError('Please enter a valid phone number'); errors.push('Please enter a valid phone number');
    }

    if (errors.length > 0) {
      setErrorModalMessage(errors[0]);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        companyId,
        createdBy,
        clientId,
        projectId,
        title: title.trim(),
        type: type || undefined,
        date: date.trim(),
        time: isValidTime(time.trim()) ? time.trim() || undefined : undefined,
        endTime: isValidTime(endTime.trim()) ? endTime.trim() || undefined : undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete();
  };

  const isEdit = !!initial?.id;

  return (
    <>
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Appointment' : 'New Appointment'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, titleError ? styles.inputError : null]}
              placeholder="e.g. Initial consultation"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={t => { setTitle(t); if (titleError) setTitleError(''); }}
            />
            {!!titleError && <Text style={styles.errorText}>{titleError}</Text>}

            {/* Type */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipWrap}>
              {APPOINTMENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, type === t && styles.chipActive]}
                  onPress={() => setType(type === t ? undefined : t)}
                >
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date */}
            <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, dateError ? styles.inputError : null]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              value={date}
              onChangeText={t => { setDate(t); if (dateError) setDateError(''); }}
              keyboardType="numbers-and-punctuation"
            />
            {!!dateError && <Text style={styles.errorText}>{dateError}</Text>}

            {/* Time (start to end) */}
            <Text style={styles.label}>Time <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={[styles.timeDisplay, time && styles.timeDisplayActive]}
                onPress={() => {
                  if (!time) setTime('09:00');
                }}
              >
                <Clock size={16} color={time ? '#2563EB' : '#9CA3AF'} />
                <Text style={[styles.timeDisplayText, time && styles.timeDisplayTextActive]}>
                  {time ? formatTime12(time) : 'Start'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timeSeparator}>to</Text>
              <TouchableOpacity
                style={[styles.timeDisplay, endTime && styles.timeDisplayActive]}
                onPress={() => {
                  if (!endTime) {
                    // Default to 1 hour after start
                    if (time) {
                      const [h, m] = time.split(':').map(Number);
                      setEndTime(`${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                    } else {
                      setEndTime('10:00');
                    }
                  }
                }}
              >
                <Clock size={16} color={endTime ? '#2563EB' : '#9CA3AF'} />
                <Text style={[styles.timeDisplayText, endTime && styles.timeDisplayTextActive]}>
                  {endTime ? formatTime12(endTime) : 'End'}
                </Text>
              </TouchableOpacity>
              {(time || endTime) && (
                <TouchableOpacity onPress={() => { setTime(''); setEndTime(''); }} style={styles.timeClearBtn}>
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.timeChipsLabel}>Select start time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeChipsScroll}>
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeChip, time === slot && styles.timeChipActive]}
                  onPress={() => {
                    setTime(slot);
                    // Auto-set end time to 1 hour after
                    const [h, m] = slot.split(':').map(Number);
                    const endH = Math.min(h + 1, 18);
                    setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                    if (timeError) setTimeError('');
                  }}
                >
                  <Text style={[styles.timeChipText, time === slot && styles.timeChipTextActive]}>
                    {formatTime12(slot)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {!!timeError && <Text style={styles.errorText}>{timeError}</Text>}

            {/* Client */}
            <Text style={styles.label}>Client <Text style={styles.optional}>(optional)</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, !clientId && styles.chipActive]}
                onPress={() => setClientId(undefined)}
              >
                <Text style={[styles.chipText, !clientId && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {clients.filter(c => c.status !== 'Cold Lead').map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, clientId === c.id && styles.chipActive]}
                  onPress={() => setClientId(clientId === c.id ? undefined : c.id)}
                >
                  <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]} numberOfLines={1}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Address */}
            <Text style={styles.label}>Address <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="123 Main St, City, State"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={setAddress}
            />

            {/* Phone */}
            <Text style={styles.label}>Phone <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, phoneError ? styles.inputError : null]}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={v => { setPhone(v); if (phoneError) setPhoneError(''); }}
              keyboardType="phone-pad"
            />
            {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

            {/* Email */}
            <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              placeholder="client@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={v => { setEmail(v); if (emailError) setEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

            {/* Project */}
            <Text style={styles.label}>Project <Text style={styles.optional}>(optional)</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, !projectId && styles.chipActive]}
                onPress={() => setProjectId(undefined)}
              >
                <Text style={[styles.chipText, !projectId && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {projects.filter(p => p.status === 'active').map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, projectId === p.id && styles.chipActive]}
                  onPress={() => setProjectId(projectId === p.id ? undefined : p.id)}
                >
                  <Text style={[styles.chipText, projectId === p.id && styles.chipTextActive]} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Notes */}
            <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any additional details..."
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <View style={styles.footer}>
            {isEdit && onDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{isEdit ? 'Save' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Error Modal */}
    <Modal visible={!!errorModalMessage} animationType="fade" transparent onRequestClose={() => setErrorModalMessage('')}>
      <View style={styles.errorModalOverlay}>
        <View style={styles.errorModalCard}>
          <Text style={styles.errorModalTitle}>Error</Text>
          <Text style={styles.errorModalMessage}>{errorModalMessage}</Text>
          <View style={styles.errorModalDivider} />
          <TouchableOpacity style={styles.errorModalBtn} onPress={() => setErrorModalMessage('')}>
            <Text style={styles.errorModalBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, maxHeight: '85%', width: '100%', maxWidth: 540 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1E3A5F' },
  body: { paddingHorizontal: 20, paddingTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginTop: 14, marginBottom: 6 },
  required: { color: '#DC2626' },
  optional: { fontWeight: '400', color: '#9CA3AF' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: '#1F2937' },
  inputError: { borderColor: '#DC2626' },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timeDisplayActive: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F0F7FF',
  },
  timeDisplayText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeDisplayTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  timeClearBtn: {
    padding: 4,
  },
  timeSeparator: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  timeChipsLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 6,
  },
  timeChipsScroll: {
    marginBottom: 4,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  timeChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  timeChipTextActive: {
    color: '#FFFFFF',
  },
  chipScroll: { marginBottom: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#FFFFFF' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  deleteButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FEF2F2' },
  deleteButtonText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  saveButton: { flex: 1, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  errorModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 40,
  },
  errorModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  errorModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  errorModalMessage: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  errorModalDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  errorModalBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  errorModalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    overflow: 'hidden',
  },
});
