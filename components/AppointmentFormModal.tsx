import { useState, useEffect } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Appointment, Client, Project } from '@/types';

const APPOINTMENT_TYPES: Appointment['type'][] = ['Estimate', 'Site Visit', 'Follow-Up', 'Client Meeting', 'Project Meeting', 'Other'];

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

  useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setType(initial?.type ?? undefined);
      setDate(initial?.date ?? '');
      setTime(initial?.time ?? '');
      setEndTime(initial?.endTime ?? '');
      setClientId(initial?.clientId);
      setProjectId(initial?.projectId);
      setAddress(initial?.address ?? '');
      setPhone(initial?.phone ?? '');
      setEmail(initial?.email ?? '');
      setNotes(initial?.notes ?? '');
      setTitleError('');
      setDateError('');
    }
  }, [visible, initial]);

  const isValidDate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
  const isValidTime = (val: string) => val === '' || /^\d{2}:\d{2}$/.test(val);

  const formatTimeInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const handleSave = async () => {
    let valid = true;
    if (!title.trim()) { setTitleError('Title is required'); valid = false; }
    if (!date.trim()) { setDateError('Date is required (YYYY-MM-DD)'); valid = false; }
    else if (!isValidDate(date.trim())) { setDateError('Use format YYYY-MM-DD'); valid = false; }
    if (!valid) return;

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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
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
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="09:00"
                placeholderTextColor="#9CA3AF"
                value={time}
                onChangeText={(raw) => setTime(formatTimeInput(raw))}
                keyboardType="number-pad"
                maxLength={5}
              />
              <Text style={styles.timeSeparator}>to</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="10:00"
                placeholderTextColor="#9CA3AF"
                value={endTime}
                onChangeText={(raw) => setEndTime(formatTimeInput(raw))}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>

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
              style={styles.input}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* Email */}
            <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="client@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

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
    </Modal>
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
  timeInput: { flex: 1 },
  timeSeparator: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
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
});
