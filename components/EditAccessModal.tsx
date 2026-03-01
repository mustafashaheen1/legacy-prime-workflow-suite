import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  X,
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  Camera,
  MessageSquare,
  Calendar,
  HardHat,
  Bot,
  FolderOpen,
  BarChart2,
} from 'lucide-react-native';
import { User } from '@/types';
import { FEATURE_TOGGLES, getEffectiveFeatureStates } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

interface EditAccessModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (userId: string, customPermissions: Record<string, boolean>) => void;
}

// Per-feature visual metadata — icon, accent colour, background tint, description.
const FEATURE_META: Record<string, {
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  bg: string;
  description: string;
}> = {
  dashboard: { Icon: LayoutDashboard, color: '#2563EB', bg: '#EFF6FF', description: 'Overview & activity summary' },
  crm:       { Icon: Users,           color: '#7C3AED', bg: '#F5F3FF', description: 'Clients, leads & contacts' },
  clock:     { Icon: Clock,           color: '#16A34A', bg: '#F0FDF4', description: 'Clock in/out & time tracking' },
  expenses:  { Icon: DollarSign,      color: '#D97706', bg: '#FFFBEB', description: 'Log & track job expenses' },
  photos:    { Icon: Camera,          color: '#DB2777', bg: '#FDF2F8', description: 'Upload & view site photos' },
  chat:      { Icon: MessageSquare,   color: '#0D9488', bg: '#F0FDFA', description: 'Team messaging' },
  schedule:  { Icon: Calendar,        color: '#4F46E5', bg: '#EEF2FF', description: 'Project calendar & scheduling' },
  subs:      { Icon: HardHat,         color: '#EA580C', bg: '#FFF7ED', description: 'Subcontractor management' },
  chatbot:   { Icon: Bot,             color: '#6366F1', bg: '#EEFAFF', description: 'AI assistant access' },
  projects:  { Icon: FolderOpen,      color: '#0369A1', bg: '#F0F9FF', description: 'View project details' },
  reports:   { Icon: BarChart2,       color: '#059669', bg: '#ECFDF5', description: 'Financial & activity reports' },
};

const API_BASE =
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://legacy-prime-workflow-suite.vercel.app';

export default function EditAccessModal({
  visible,
  user,
  onClose,
  onSaved,
}: EditAccessModalProps) {
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFeatureStates(getEffectiveFeatureStates(user.role, user.customPermissions));
    }
  }, [user?.id, user?.role, user?.customPermissions, visible]);

  const handleToggle = useCallback((key: string, value: boolean) => {
    setFeatureStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const roleDefaults = getEffectiveFeatureStates(user.role);
      const overrides: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(featureStates)) {
        if (value !== roleDefaults[key]) overrides[key] = value;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/update-user-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, customPermissions: overrides }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      onSaved(user.id, overrides);
      onClose();

      if (Platform.OS === 'web') {
        alert(`Access updated for ${user.name}`);
      } else {
        Alert.alert('Saved', `Access updated for ${user.name}`);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to save permissions';
      if (Platform.OS === 'web') {
        alert(`Error: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const enabledCount = Object.values(featureStates).filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{user.name}</Text>
              <Text style={styles.subtitle}>
                {enabledCount} of {FEATURE_TOGGLES.length} features enabled
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Feature rows */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {FEATURE_TOGGLES.map((feature) => {
              const isOn = featureStates[feature.key] ?? false;
              const meta = FEATURE_META[feature.key];
              const Icon = meta?.Icon;

              return (
                <View key={feature.key} style={[styles.row, !isOn && styles.rowOff]}>
                  {/* Icon chip */}
                  <View style={[styles.iconChip, { backgroundColor: meta?.bg ?? '#F3F4F6' }]}>
                    {Icon && <Icon size={20} color={isOn ? (meta?.color ?? '#6B7280') : '#9CA3AF'} />}
                  </View>

                  {/* Label + description */}
                  <View style={styles.rowText}>
                    <Text style={[styles.featureLabel, !isOn && styles.featureLabelOff]}>
                      {feature.label}
                    </Text>
                    <Text style={styles.featureDesc} numberOfLines={1}>
                      {meta?.description ?? ''}
                    </Text>
                  </View>

                  {/* Toggle */}
                  <Switch
                    value={isOn}
                    onValueChange={(val) => handleToggle(feature.key, val)}
                    trackColor={{ false: '#E5E7EB', true: '#BBF7D0' }}
                    thumbColor={isOn ? '#16A34A' : '#D1D5DB'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Save */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── List ────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rowOff: {
    opacity: 0.65,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  featureLabelOff: {
    color: '#6B7280',
  },
  featureDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
