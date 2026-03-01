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
import { X, Shield } from 'lucide-react-native';
import { User } from '@/types';
import { FEATURE_TOGGLES, getEffectiveFeatureStates } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

interface EditAccessModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh its user list. */
  onSaved: (userId: string, customPermissions: Record<string, boolean>) => void;
}

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

  // Initialise toggle states whenever the modal opens or the target user changes.
  useEffect(() => {
    if (user) {
      setFeatureStates(
        getEffectiveFeatureStates(user.role, user.customPermissions)
      );
    }
  }, [user?.id, user?.role, user?.customPermissions, visible]);

  const handleToggle = useCallback((key: string, value: boolean) => {
    setFeatureStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Compute only the keys that differ from role defaults so we store a
      // minimal diff rather than a full snapshot.
      const roleDefaults = getEffectiveFeatureStates(user.role);
      const overrides: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(featureStates)) {
        if (value !== roleDefaults[key]) {
          overrides[key] = value;
        }
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Shield size={20} color="#2563EB" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Edit Access</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {user.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Toggle features on or off for this team member. Changes override their role defaults.
          </Text>

          {/* Feature toggles */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {FEATURE_TOGGLES.map((feature, index) => {
              const isOn = featureStates[feature.key] ?? false;
              return (
                <View
                  key={feature.key}
                  style={[
                    styles.row,
                    index < FEATURE_TOGGLES.length - 1 && styles.rowBorder,
                  ]}
                >
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                  <Switch
                    value={isOn}
                    onValueChange={(val) => handleToggle(feature.key, val)}
                    trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                    thumbColor={isOn ? '#2563EB' : '#9CA3AF'}
                    ios_backgroundColor="#D1D5DB"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Save button */}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    height: '72%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureLabel: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
