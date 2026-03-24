import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, BookOpen, Plus, Trash2, FileText, ChevronRight } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

const SOURCE_TYPES = [
  { value: 'manual', label: 'General Knowledge' },
  { value: 'sop', label: 'SOP / Process' },
  { value: 'policy', label: 'Company Policy' },
  { value: 'pricing', label: 'Pricing Guide' },
  { value: 'codes', label: 'Building Codes' },
];

interface KnowledgeSource {
  name: string;
  type: string;
  chunkCount: number;
  createdAt: string;
}

export default function KnowledgeBaseScreen() {
  const { user, company } = useApp();

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState('manual');
  const [content, setContent] = useState('');

  // Guard — admins only
  if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Admin access required.</Text>
      </View>
    );
  }

  const fetchSources = useCallback(async () => {
    if (!company?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/get-knowledge-sources?companyId=${company.id}`);
      const data = await res.json();
      if (data.success) setSources(data.sources);
    } catch (err) {
      console.error('[KnowledgeBase] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id]);

  useFocusEffect(useCallback(() => { fetchSources(); }, [fetchSources]));

  const handleIngest = async () => {
    if (!sourceName.trim()) {
      const msg = 'Please enter a source name.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }
    if (!content.trim() || content.trim().length < 20) {
      const msg = 'Please enter at least 20 characters of content.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setIsIngesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/ingest-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company?.id,
          sourceName: sourceName.trim(),
          sourceType,
          text: content.trim(),
          createdBy: user?.id,
        }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to ingest');

      const msg = `"${sourceName}" saved — ${data.chunks} chunk${data.chunks !== 1 ? 's' : ''} indexed.`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Saved', msg);

      setSourceName('');
      setSourceType('manual');
      setContent('');
      setShowAddForm(false);
      await fetchSources();
    } catch (err: any) {
      const msg = err.message || 'Failed to save knowledge.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDelete = async (name: string) => {
    const confirmed = Platform.OS === 'web'
      ? confirm(`Delete "${name}"? This cannot be undone.`)
      : await new Promise<boolean>(resolve =>
          Alert.alert('Delete Source', `Delete "${name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ])
        );

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/delete-knowledge-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id, sourceName: name }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchSources();
    } catch (err: any) {
      const msg = err.message || 'Failed to delete.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    }
  };

  const typeLabel = (type: string) =>
    SOURCE_TYPES.find(t => t.value === type)?.label || type;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(v => !v)}
        >
          <Plus size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <BookOpen size={18} color="#2563EB" />
          <Text style={styles.infoText}>
            Alex searches this knowledge base on every message and injects relevant
            content into answers — no extra prompting needed.
          </Text>
        </View>

        {/* Add form */}
        {showAddForm && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Knowledge Source</Text>

            <Text style={styles.label}>Source Name *</Text>
            <TextInput
              style={styles.input}
              value={sourceName}
              onChangeText={setSourceName}
              placeholder="e.g. California Building Codes 2025"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
              {SOURCE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, sourceType === t.value && styles.typeChipActive]}
                  onPress={() => setSourceType(t.value)}
                >
                  <Text style={[styles.typeChipText, sourceType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Content *</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Paste your text here — SOPs, building codes, pricing guides, company policies..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.hint}>{content.length} characters · ~{Math.ceil(content.length / 800)} chunks</Text>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isIngesting && styles.saveBtnDisabled]}
                onPress={handleIngest}
                disabled={isIngesting}
              >
                {isIngesting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save & Index</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sources list */}
        <Text style={styles.sectionTitle}>
          {sources.length > 0 ? `${sources.length} Source${sources.length !== 1 ? 's' : ''}` : 'No sources yet'}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 32 }} />
        ) : sources.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No knowledge sources</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to add your first source. Once indexed, Alex will automatically
              reference it when answering relevant questions.
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddForm(true)}>
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyAddBtnText}>Add First Source</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sources.map(source => (
            <View key={source.name} style={styles.sourceItem}>
              <View style={styles.sourceIcon}>
                <BookOpen size={20} color="#2563EB" />
              </View>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName} numberOfLines={1}>{source.name}</Text>
                <Text style={styles.sourceMeta}>
                  {typeLabel(source.type)} · {source.chunkCount} chunk{source.chunkCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(source.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#DC2626', fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addButton: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 19 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  typeRow: { flexGrow: 0 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    marginRight: 8,
  },
  typeChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  typeChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  typeChipTextActive: { color: '#2563EB', fontWeight: '600' },
  contentInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827', minHeight: 180,
  },
  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#2563EB', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginTop: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 10, marginTop: 8,
  },
  emptyAddBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  sourceItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  sourceIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sourceMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  deleteBtn: { padding: 4 },
});
