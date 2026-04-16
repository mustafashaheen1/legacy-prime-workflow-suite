import { useState, useEffect } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Appointment, Client } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>;
  onDelete?: () => void;
  initial?: Appointment;
  clients: Client[];
  companyId: string;
  createdBy?: string;
}

export default function AppointmentFormModal({ visible, onClose, onSave, onDelete, initial, clients, companyId, createdBy }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setDate(initial?.date ?? '');
      setTime(initial?.time ?? '');
      setNotes(initial?.notes ?? '');
      setClientId(initial?.clientId);
      setTitleError('');
      setDateError('');
    }
  }, [visible, initial]);

  const isValidDate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
  const isValidTime = (val: string) => val === '' || /^\d{2}:\d{2}$/.test(val);

  const handleSave = async () => {
    let valid = true;
    if (!title.trim()) { setTitleError('Title is required'); valid = false; }
    if (!date.trim()) { setDateError('Date is required (YYYY-MM-DD)'); valid = false; }
    else if (!isValidDate(date.trim())) { setDateError('Use format YYYY-MM-DD'); valid = false; }
    if (!valid) return;

    setIsSaving(true);
    try {
      await onSave({ companyId, createdBy, clientId, title: title.trim(), date: date.trim(), time: isValidTime(time.trim()) ? time.trim() : undefined, notes: notes.trim() || undefined });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{initial ? 'Edit Appointment' : 'New Appointment'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, titleError ? styles.inputError : null]}
              placeholder="e.g. Initial consultation"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={t => { setTitle(t); if (titleError) setTitleError(''); }}
            />
            {!!titleError && <Text style={styles.errorText}>{titleError}</Text>}

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

            <Text style={styles.label}>Time <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="09:30"
              placeholderTextColor="#9CA3AF"
              value={time}
              onChangeText={(raw) => {
                const digits = raw.replace(/\D/g, '').slice(0, 4);
                if (digits.length <= 2) setTime(digits);
                else setTime(`${digits.slice(0, 2)}:${digits.slice(2)}`);
              }}
              keyboardType="number-pad"
              maxLength={5}
            />

            <Text style={styles.label}>Link to Client <Text style={styles.optional}>(optional)</Text></Text>
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
            {initial && onDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
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
  chipScroll: { marginBottom: 4 },
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
