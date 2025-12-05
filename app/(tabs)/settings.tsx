import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, TextInput, Image } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { User, UserRole } from '@/types';
import { getRoleDisplayName, getAvailableRolesForManagement } from '@/lib/permissions';
import { Users, Shield, ChevronRight, X, Building2, Copy, LogOut, Upload, Edit3, Wrench } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user: currentUser, company, setCompany, logout } = useApp();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [showCompanyProfileModal, setShowCompanyProfileModal] = useState<boolean>(false);
  const [companyForm, setCompanyForm] = useState({
    name: company?.name || '',
    logo: company?.logo || '',
    licenseNumber: company?.licenseNumber || '',
    officePhone: company?.officePhone || '',
    cellPhone: company?.cellPhone || '',
    address: company?.address || '',
    email: company?.email || '',
    website: company?.website || '',
    slogan: company?.slogan || '',
    estimateTemplate: company?.estimateTemplate || '',
  });

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

  const updateCompanyMutation = trpc.companies.updateCompany.useMutation({
    onSuccess: async (data) => {
      await setCompany(data.company);
      Alert.alert('Success', 'Company profile updated successfully!');
      setShowCompanyProfileModal(false);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update company profile');
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

  const handleLogoUpload = () => {
    Alert.prompt(
      'Logo URL',
      'Enter image URL for company logo (or paste base64 data)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (url?: string) => {
            if (url) {
              setCompanyForm({ ...companyForm, logo: url });
            }
          },
        },
      ],
      'plain-text',
      companyForm.logo
    );
  };

  const handleSaveCompanyProfile = async () => {
    if (!company?.id) return;
    
    updateCompanyMutation.mutate({
      companyId: company.id,
      updates: companyForm,
    });
  };

  const openCompanyProfileModal = () => {
    setCompanyForm({
      name: company?.name || '',
      logo: company?.logo || '',
      licenseNumber: company?.licenseNumber || '',
      officePhone: company?.officePhone || '',
      cellPhone: company?.cellPhone || '',
      address: company?.address || '',
      email: company?.email || '',
      website: company?.website || '',
      slogan: company?.slogan || '',
      estimateTemplate: company?.estimateTemplate || '',
    });
    setShowCompanyProfileModal(true);
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
            <View style={styles.companyHeaderRow}>
              {company?.logo ? (
                <Image source={{ uri: company.logo }} style={styles.companyLogo} />
              ) : (
                <View style={styles.companyLogoPlaceholder}>
                  <Building2 size={32} color="#9CA3AF" />
                </View>
              )}
              <View style={styles.companyHeaderInfo}>
                <Text style={styles.companyName}>{company?.name}</Text>
                {company?.slogan && (
                  <Text style={styles.companySlogan}>{company.slogan}</Text>
                )}
              </View>
            </View>
            
            {company?.licenseNumber && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>License #:</Text>
                <Text style={styles.companyDetailValue}>{company.licenseNumber}</Text>
              </View>
            )}
            
            {company?.officePhone && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>Office:</Text>
                <Text style={styles.companyDetailValue}>{company.officePhone}</Text>
              </View>
            )}
            
            {company?.cellPhone && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>Cell:</Text>
                <Text style={styles.companyDetailValue}>{company.cellPhone}</Text>
              </View>
            )}
            
            {company?.address && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>Address:</Text>
                <Text style={styles.companyDetailValue}>{company.address}</Text>
              </View>
            )}
            
            {company?.email && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>Email:</Text>
                <Text style={styles.companyDetailValue}>{company.email}</Text>
              </View>
            )}
            
            {company?.website && (
              <View style={styles.companyDetailRow}>
                <Text style={styles.companyDetailLabel}>Website:</Text>
                <Text style={styles.companyDetailValue}>{company.website}</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={openCompanyProfileModal}
            >
              <Edit3 size={16} color="#2563EB" />
              <Text style={styles.editProfileButtonText}>Edit Company Profile</Text>
            </TouchableOpacity>
            
            <Text style={[styles.infoLabel, { marginTop: 16 }]}>{t('settings.companyCode')}</Text>
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
          <View style={styles.sectionHeader}>
            <Wrench size={24} color="#2563EB" />
            <Text style={styles.sectionTitle}>Developer Tools</Text>
          </View>

          <TouchableOpacity 
            style={styles.devToolButton}
            onPress={() => router.push('/api-test')}
          >
            <View style={styles.devToolContent}>
              <Text style={styles.devToolTitle}>API Connection Test</Text>
              <Text style={styles.devToolDescription}>Test backend API connectivity</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#DC2626" />
            <Text style={styles.logoutButtonText}>{t('settings.logout') || 'Logout'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showCompanyProfileModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCompanyProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Company Profile</Text>
              <TouchableOpacity onPress={() => setShowCompanyProfileModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.companyFormScroll} showsVerticalScrollIndicator>
              <Text style={styles.formLabel}>Company Logo</Text>
              <View style={styles.logoUploadSection}>
                {companyForm.logo ? (
                  <Image source={{ uri: companyForm.logo }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.logoPreviewPlaceholder}>
                    <Building2 size={48} color="#9CA3AF" />
                  </View>
                )}
                <TouchableOpacity style={styles.uploadButton} onPress={handleLogoUpload}>
                  <Upload size={16} color="#2563EB" />
                  <Text style={styles.uploadButtonText}>Upload Logo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Company Name *</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.name}
                onChangeText={(text) => setCompanyForm({ ...companyForm, name: text })}
                placeholder="Enter company name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>Slogan</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.slogan}
                onChangeText={(text) => setCompanyForm({ ...companyForm, slogan: text })}
                placeholder="Your company slogan"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>License Number</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.licenseNumber}
                onChangeText={(text) => setCompanyForm({ ...companyForm, licenseNumber: text })}
                placeholder="e.g., LEGACCG860QR"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>Office Phone</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.officePhone}
                onChangeText={(text) => setCompanyForm({ ...companyForm, officePhone: text })}
                placeholder="(555) 555-5555"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Cell Phone</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.cellPhone}
                onChangeText={(text) => setCompanyForm({ ...companyForm, cellPhone: text })}
                placeholder="(555) 555-5555"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 60 }]}
                value={companyForm.address}
                onChangeText={(text) => setCompanyForm({ ...companyForm, address: text })}
                placeholder="Street address, City, State, ZIP"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.email}
                onChangeText={(text) => setCompanyForm({ ...companyForm, email: text })}
                placeholder="contact@company.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Website</Text>
              <TextInput
                style={styles.formInput}
                value={companyForm.website}
                onChangeText={(text) => setCompanyForm({ ...companyForm, website: text })}
                placeholder="www.yourcompany.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Estimate Template (footer note)</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 80 }]}
                value={companyForm.estimateTemplate}
                onChangeText={(text) => setCompanyForm({ ...companyForm, estimateTemplate: text })}
                placeholder="Thank you for your business! This estimate is valid for 30 days. Please contact us with any questions."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.formButtonsContainer}>
                <TouchableOpacity
                  style={styles.formCancelButton}
                  onPress={() => setShowCompanyProfileModal(false)}
                >
                  <Text style={styles.formCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formSaveButton, updateCompanyMutation.isPending && styles.formSaveButtonDisabled]}
                  onPress={handleSaveCompanyProfile}
                  disabled={updateCompanyMutation.isPending}
                >
                  <Text style={styles.formSaveButtonText}>
                    {updateCompanyMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  companyHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    gap: 16,
  },
  companyLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  companyLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  companyHeaderInfo: {
    flex: 1,
  },
  companySlogan: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  companyDetailRow: {
    flexDirection: 'row' as const,
    marginBottom: 8,
    gap: 8,
  },
  companyDetailLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    minWidth: 80,
  },
  companyDetailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  editProfileButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  companyFormScroll: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  logoUploadSection: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    marginBottom: 8,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoPreviewPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  formButtonsContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  formCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  formCancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  formSaveButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  formSaveButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  formSaveButtonDisabled: {
    opacity: 0.6,
  },
  devToolButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  devToolContent: {
    flex: 1,
  },
  devToolTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  devToolDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
});
