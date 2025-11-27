import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { User, UserRole } from '@/types';
import { getRoleDisplayName, getAvailableRolesForManagement } from '@/lib/permissions';
import { Users, Shield, ChevronRight, X, Building2, Copy, LogOut } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user: currentUser, company, logout } = useApp();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);

  const usersQuery = trpc.users.getUsers.useQuery(
    { companyId: company?.id },
    { enabled: !!company?.id }
  );

  const updateUserMutation = trpc.users.updateUser.useMutation({
    onSuccess: () => {
      Alert.alert(t('common.success'), t('settings.roleUpdated'));
      usersQuery.refetch();
      setShowRoleModal(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error.message);
    },
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (newRole === 'employee' || newRole === 'field-employee' || newRole === 'salesperson' || newRole === 'admin') {
      updateUserMutation.mutate({
        userId,
        updates: { role: newRole },
      });
    }
  };

  const availableRoles = currentUser ? getAvailableRolesForManagement(currentUser.role) : [];

  if (!isAdmin && !isSuperAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.noAccess}>
          <Shield size={48} color="#9CA3AF" />
          <Text style={styles.noAccessText}>{t('settings.noAccess')}</Text>
        </View>
      </View>
    );
  }

  const handleCopyCompanyCode = () => {
    if (company?.id) {
      Alert.alert(t('settings.companyCode'), company.id);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout') || 'Logout',
      t('settings.logoutConfirm') || 'Are you sure you want to logout?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout') || 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={24} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t('settings.companyInfo')}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.companyName')}</Text>
            <Text style={styles.companyName}>{company?.name}</Text>
            
            <Text style={[styles.infoLabel, { marginTop: 12 }]}>{t('settings.companyCode')}</Text>
            <TouchableOpacity 
              style={styles.codeContainer}
              onPress={handleCopyCompanyCode}
            >
              <Text style={styles.codeText}>{company?.id}</Text>
              <Copy size={18} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.codeHint}>{t('settings.shareCodeHint')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={24} color="#2563EB" />
            <Text style={styles.sectionTitle}>{t('settings.teamManagement')}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.yourRole')}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{getRoleDisplayName(currentUser?.role || 'field-employee')}</Text>
            </View>
          </View>

          <Text style={styles.subsectionTitle}>{t('settings.teamMembers')}</Text>

          {usersQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : usersQuery.data?.users && usersQuery.data.users.length > 0 ? (
            <View style={styles.usersList}>
              {usersQuery.data.users.map((user: User) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userItem}
                  onPress={() => {
                    if (availableRoles.length > 0 && user.id !== currentUser?.id) {
                      setSelectedUser(user);
                      setShowRoleModal(true);
                    }
                  }}
                  disabled={availableRoles.length === 0 || user.id === currentUser?.id}
                >
                  <View style={styles.userInfo}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                  </View>
                  <View style={styles.userRight}>
                    <View style={[styles.roleChip, { backgroundColor: getRoleColor(user.role) }]}>
                      <Text style={styles.roleChipText}>{getRoleDisplayName(user.role)}</Text>
                    </View>
                    {availableRoles.length > 0 && user.id !== currentUser?.id && (
                      <ChevronRight size={20} color="#9CA3AF" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('settings.noUsers')}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#DC2626" />
            <Text style={styles.logoutButtonText}>{t('settings.logout') || 'Logout'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showRoleModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowRoleModal(false);
          setSelectedUser(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.changeRole')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View>
                <View style={styles.modalUserInfo}>
                  <Text style={styles.modalUserName}>{selectedUser.name}</Text>
                  <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                  <View style={styles.currentRoleBadge}>
                    <Text style={styles.currentRoleLabel}>{t('settings.currentRole')}</Text>
                    <Text style={styles.currentRoleValue}>{getRoleDisplayName(selectedUser.role)}</Text>
                  </View>
                </View>

                <Text style={styles.rolesListTitle}>{t('settings.selectNewRole')}</Text>
                <View style={styles.rolesList}>
                  {availableRoles.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        selectedUser.role === role && styles.roleOptionCurrent,
                      ]}
                      onPress={() => {
                        if (selectedUser.role !== role) {
                          Alert.alert(
                            t('settings.confirmRoleChange'),
                            t('settings.confirmRoleChangeMessage', {
                              name: selectedUser.name,
                              role: getRoleDisplayName(role)
                            }),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.confirm'),
                                onPress: () => handleRoleChange(selectedUser.id, role),
                              },
                            ]
                          );
                        }
                      }}
                      disabled={updateUserMutation.isPending}
                    >
                      <View style={[styles.roleColorDot, { backgroundColor: getRoleColor(role) }]} />
                      <View style={styles.roleOptionContent}>
                        <Text style={styles.roleOptionName}>{getRoleDisplayName(role)}</Text>
                        <Text style={styles.roleOptionDescription}>{getRoleDescription(role, t)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    'super-admin': '#DC2626',
    'admin': '#2563EB',
    'salesperson': '#16A34A',
    'field-employee': '#9333EA',
    'employee': '#F59E0B',
  };
  return colors[role];
}

function getRoleDescription(role: UserRole, t: any): string {
  const descriptions: Record<UserRole, string> = {
    'super-admin': t('settings.roleDescriptions.superAdmin'),
    'admin': t('settings.roleDescriptions.admin'),
    'salesperson': t('settings.roleDescriptions.salesperson'),
    'field-employee': t('settings.roleDescriptions.fieldEmployee'),
    'employee': t('settings.roleDescriptions.employee'),
  };
  return descriptions[role];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  usersList: {
    gap: 8,
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  noAccess: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalUserInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  currentRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentRoleLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  currentRoleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rolesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  rolesList: {
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  roleOptionCurrent: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  roleColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roleOptionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  codeContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#111827',
    fontFamily: 'monospace',
  },
  codeHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
});
