import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, TextInput, Image, Platform, ActivityIndicator, Clipboard } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { User, UserRole } from '@/types';
import { getRoleDisplayName, getAvailableRolesForManagement } from '@/lib/permissions';
import { Users, Shield, ChevronRight, X, Building2, Copy, LogOut, Upload, Edit3, Wrench, DollarSign } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

// Validation helpers
const isValidUSPhone = (phone: string): boolean => {
  if (!phone || phone.trim() === '') return true; // Empty is valid (optional field)
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // US phone numbers should have 10 digits (or 11 if starts with 1)
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

const isValidWebsite = (url: string): boolean => {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  // Add protocol if missing for validation
  const urlToTest = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;
  try {
    const parsedUrl = new URL(urlToTest);
    // Check for valid domain with TLD
    return parsedUrl.hostname.includes('.') && parsedUrl.hostname.split('.').pop()!.length >= 2;
  } catch {
    return false;
  }
};

const formatUSPhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 if present
  const normalized = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  if (normalized.length !== 10) return phone; // Return original if not valid
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
};

// Filter phone input to only allow digits, max 10 characters
const filterPhoneInput = (text: string): string => {
  return text.replace(/\D/g, '').slice(0, 10);
};

export default function SettingsScreen() {
  const { user: currentUser, company, setCompany, logout } = useApp();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const { t } = useTranslation();
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [showCompanyProfileModal, setShowCompanyProfileModal] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [companyForm, setCompanyForm] = useState({
    name: company?.name || '',
    logo: company?.logo || '',
    licenseNumber: company?.licenseNumber || '',
    officePhone: company?.officePhone || '',
    cellPhone: company?.cellPhone || '',
    address: company?.address || '',
    email: company?.email || currentUser?.email || '', // Use admin's email
    website: company?.website || '',
    slogan: company?.slogan || '',
    estimateTemplate: company?.estimateTemplate || '',
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<{
    officePhone?: string;
    cellPhone?: string;
    website?: string;
  }>({});
  const [showRateChangeModal, setShowRateChangeModal] = useState<boolean>(false);
  const [requestedRate, setRequestedRate] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState<boolean>(false);

  // Helper to get API base URL
  const getApiBaseUrl = () => {
    const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    if (rorkApi) return rorkApi;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:8081';
  };

  // Fetch users from Vercel backend
  const fetchUsers = async () => {
    if (!company?.id) return;

    setIsLoadingUsers(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-users?companyId=${company.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (error: any) {
      console.error('[Settings] Error fetching users:', error);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch users on mount and when company changes
  useEffect(() => {
    fetchUsers();
  }, [company?.id]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (newRole === 'employee' || newRole === 'field-employee' || newRole === 'salesperson' || newRole === 'admin') {
      setIsUpdatingUser(true);
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/update-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            updates: { role: newRole },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error('Failed to update user');
        }

        // Refresh users list
        await fetchUsers();

        if (Platform.OS === 'web') {
          alert('User updated successfully');
        } else {
          Alert.alert('Success', 'User updated successfully');
        }
        setShowRoleModal(false);
        setSelectedUser(null);
      } catch (error: any) {
        console.error('[Settings] Error updating user:', error);
        if (Platform.OS === 'web') {
          alert(`Error: ${error.message}`);
        } else {
          Alert.alert('Error', error.message);
        }
      } finally {
        setIsUpdatingUser(false);
      }
    }
  };

  const availableRoles = currentUser ? getAvailableRolesForManagement(currentUser.role) : [];

  const handleRequestRateChange = async () => {
    const rate = parseFloat(requestedRate);
    if (isNaN(rate) || rate < 0) {
      if (Platform.OS === 'web') {
        alert('Please enter a valid hourly rate');
      } else {
        Alert.alert('Invalid Rate', 'Please enter a valid hourly rate');
      }
      return;
    }

    if (!currentUser) return;

    try {
      // Update user with rate change request via Vercel API
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/update-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          updates: {
            rateChangeRequest: {
              newRate: rate,
              requestDate: new Date().toISOString(),
              status: 'pending',
            }
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to submit rate change request');
      }

      setShowRateChangeModal(false);
      setRequestedRate('');

      if (Platform.OS === 'web') {
        alert('Rate change request submitted successfully');
      } else {
        Alert.alert('Success', 'Rate change request submitted successfully');
      }
    } catch (error: any) {
      console.error('[RateChange] Error:', error);
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to submit rate change request');
      } else {
        Alert.alert('Error', error.message || 'Failed to submit rate change request');
      }
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Employee Settings View (for non-admin users)
  if (!isAdmin && !isSuperAdmin) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield size={24} color="#2563EB" />
              <Text style={styles.sectionTitle}>My Profile</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.profileValue}>{currentUser?.name || 'N/A'}</Text>

              <Text style={[styles.infoLabel, { marginTop: 12 }]}>Email</Text>
              <Text style={styles.profileValue}>{currentUser?.email || 'N/A'}</Text>

              <Text style={[styles.infoLabel, { marginTop: 12 }]}>Role</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{getRoleDisplayName(currentUser?.role || 'field-employee')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={24} color="#2563EB" />
              <Text style={styles.sectionTitle}>Hourly Rate</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.rateContainer}>
                <DollarSign size={20} color="#6B7280" />
                <Text style={styles.rateText}>
                  {currentUser?.hourlyRate ? `$${currentUser.hourlyRate.toFixed(2)}/hour` : 'Not set'}
                </Text>
              </View>

              {currentUser?.rateChangeRequest?.status === 'pending' && (
                <View style={[styles.pendingBadge, { marginTop: 12 }]}>
                  <Text style={styles.pendingText}>
                    Rate change request pending: ${currentUser.rateChangeRequest.newRate}/hour
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.requestButton}
                onPress={() => setShowRateChangeModal(true)}
              >
                <Text style={styles.requestButtonText}>Request Rate Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <LogOut size={20} color="#DC2626" />
                  <Text style={styles.logoutButtonText}>{t('settings.logout') || 'Logout'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Rate Change Request Modal */}
        <Modal
          visible={showRateChangeModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowRateChangeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Rate Change</Text>
                <TouchableOpacity onPress={() => setShowRateChangeModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.formLabel}>Current Hourly Rate</Text>
                <Text style={styles.currentRateDisplay}>
                  {currentUser?.hourlyRate ? `$${currentUser.hourlyRate.toFixed(2)}/hour` : 'Not set'}
                </Text>

                <Text style={[styles.formLabel, { marginTop: 16 }]}>Requested Hourly Rate</Text>
                <TextInput
                  style={styles.formInput}
                  value={requestedRate}
                  onChangeText={(text) => {
                    // Only allow numbers and decimal point
                    const filtered = text.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = filtered.split('.');
                    if (parts.length > 2) return;
                    setRequestedRate(filtered);
                  }}
                  placeholder="25.50"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />

                <View style={styles.formButtonsContainer}>
                  <TouchableOpacity
                    style={styles.formCancelButton}
                    onPress={() => {
                      setShowRateChangeModal(false);
                      setRequestedRate('');
                    }}
                  >
                    <Text style={styles.formCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.formSaveButton}
                    onPress={handleRequestRateChange}
                  >
                    <Text style={styles.formSaveButtonText}>Submit Request</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const handleCopyCompanyCode = () => {
    if (company?.companyCode) {
      // Copy to clipboard
      if (Platform.OS === 'web') {
        // Use web clipboard API
        if (navigator.clipboard) {
          navigator.clipboard.writeText(company.companyCode);
          setCodeCopied(true);
          setTimeout(() => setCodeCopied(false), 2000);
        } else {
          // Fallback for older browsers
          Alert.alert(t('settings.companyCode'), company.companyCode);
        }
      } else {
        // Use React Native clipboard for mobile
        Clipboard.setString(company.companyCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      }
    } else {
      Alert.alert(t('common.error'), 'Company code not found. Please contact support.');
    }
  };

  const handleLogoUpload = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        if (Platform.OS === 'web') {
          alert('Permission to access photos is required');
        } else {
          Alert.alert('Permission Required', 'Permission to access photos is required');
        }
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedImage = result.assets[0];
      setIsUploadingLogo(true);

      // Get presigned URL from API
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/upload-company-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company?.id,
          fileType: selectedImage.mimeType || 'image/jpeg',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, logoUrl } = await response.json();

      // Upload image to S3
      if (Platform.OS === 'web') {
        const imageResponse = await fetch(selectedImage.uri);
        const blob = await imageResponse.blob();
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': selectedImage.mimeType || 'image/jpeg' },
        });
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image to S3');
        }
      } else {
        // For native, use FileSystem
        const FileSystem = require('expo-file-system');
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, selectedImage.uri, {
          httpMethod: 'PUT',
          headers: { 'Content-Type': selectedImage.mimeType || 'image/jpeg' },
        });
        if (uploadResult.status !== 200) {
          throw new Error('Failed to upload image to S3');
        }
      }

      // Update form with new logo URL
      setCompanyForm({ ...companyForm, logo: logoUrl });

      if (Platform.OS === 'web') {
        alert('Logo uploaded successfully!');
      } else {
        Alert.alert('Success', 'Logo uploaded successfully!');
      }
    } catch (error: any) {
      console.error('[Logo Upload] Error:', error);
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to upload logo');
      } else {
        Alert.alert('Error', error.message || 'Failed to upload logo');
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const validateCompanyForm = (): boolean => {
    const errors: { officePhone?: string; cellPhone?: string; website?: string } = {};

    if (!isValidUSPhone(companyForm.officePhone)) {
      errors.officePhone = 'Please enter a valid US phone number';
    }

    if (!isValidUSPhone(companyForm.cellPhone)) {
      errors.cellPhone = 'Please enter a valid US phone number';
    }

    if (!isValidWebsite(companyForm.website)) {
      errors.website = 'Please enter a valid website URL';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCompanyProfile = async () => {
    if (!company?.id) return;

    // Validate form
    if (!validateCompanyForm()) {
      const errorMsg = 'Please fix the validation errors before saving';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Validation Error', errorMsg);
      }
      return;
    }

    // Always use admin's email for company email
    // Format phone numbers before saving
    const updatesWithAdminEmail = {
      ...companyForm,
      email: currentUser?.email || companyForm.email,
      officePhone: formatUSPhone(companyForm.officePhone),
      cellPhone: formatUSPhone(companyForm.cellPhone),
    };

    setIsSavingProfile(true);

    try {
      // Use Vercel API endpoint (works in production)
      const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

      console.log('[Settings] Updating company via:', `${baseUrl}/api/update-company`);

      const response = await fetch(`${baseUrl}/api/update-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          updates: updatesWithAdminEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.company) {
        throw new Error('Invalid response from server');
      }

      // Update local state with the returned company data
      setCompany(data.company);

      if (Platform.OS === 'web') {
        alert('Company profile updated successfully!');
      } else {
        Alert.alert('Success', 'Company profile updated successfully!');
      }
      setShowCompanyProfileModal(false);
    } catch (error: any) {
      console.error('[Settings] Error updating company:', error);
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to update company profile');
      } else {
        Alert.alert('Error', error.message || 'Failed to update company profile');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openCompanyProfileModal = () => {
    setCompanyForm({
      name: company?.name || '',
      logo: company?.logo || '',
      licenseNumber: company?.licenseNumber || '',
      officePhone: company?.officePhone || '',
      cellPhone: company?.cellPhone || '',
      address: company?.address || '',
      email: company?.email || currentUser?.email || '', // Use admin's email
      website: company?.website || '',
      slogan: company?.slogan || '',
      estimateTemplate: company?.estimateTemplate || '',
    });
    setValidationErrors({}); // Clear any previous validation errors
    setShowCompanyProfileModal(true);
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
              style={[styles.codeContainer, codeCopied && styles.codeContainerCopied]}
              onPress={handleCopyCompanyCode}
            >
              <Text style={styles.codeText}>{company?.companyCode || 'No code available'}</Text>
              <Copy size={18} color={codeCopied ? "#16A34A" : "#6B7280"} />
            </TouchableOpacity>
            {codeCopied ? (
              <Text style={styles.copiedHint}>✓ Copied to clipboard!</Text>
            ) : (
              <Text style={styles.codeHint}>{t('settings.shareCodeHint')}</Text>
            )}
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

          {isLoadingUsers ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : users && users.length > 0 ? (
            <View style={styles.usersList}>
              {users.map((user: User) => (
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
                      {!user.isActive && user.id !== currentUser?.id && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingText}>Pending Approval</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.userRight}>
                    {!user.isActive && user.id !== currentUser?.id && (isAdmin || isSuperAdmin) && user.role !== 'admin' && user.role !== 'super-admin' ? (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={async () => {
                            console.log('[Settings] Reject button clicked for:', user.id, user.name);
                            const confirmed = Platform.OS === 'web'
                              ? confirm(`Are you sure you want to reject ${user.name}? This will permanently delete their account.`)
                              : await new Promise(resolve => {
                                  Alert.alert(
                                    'Reject Employee',
                                    `Are you sure you want to reject ${user.name}? This will permanently delete their account.`,
                                    [
                                      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                                      { text: 'Reject', style: 'destructive', onPress: () => resolve(true) },
                                    ]
                                  );
                                });

                            if (confirmed) {
                              (async () => {
                                try {
                                  console.log('[Settings] Deleting user via API:', user.id);

                                  const baseUrl = getApiBaseUrl();
                                  const response = await fetch(`${baseUrl}/api/delete-user`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: user.id }),
                                  });

                                  if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                    throw new Error(errorData.error || `HTTP ${response.status}`);
                                  }

                                  const data = await response.json();

                                  if (!data.success) {
                                    throw new Error('Failed to delete user');
                                  }

                                  console.log('[Settings] User deleted, refetching...');
                                  await fetchUsers();

                                  alert('Employee account rejected and deleted');
                                } catch (error: any) {
                                  console.error('[Settings] Error:', error);
                                  alert(`Error: ${error.message}`);
                                }
                              })();
                            }
                          }}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={async () => {
                            try {
                              console.log('[Settings] Approving user via API:', user.id, user.name);

                              const baseUrl = getApiBaseUrl();
                              const response = await fetch(`${baseUrl}/api/approve-user`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: user.id }),
                              });

                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(errorData.error || `HTTP ${response.status}`);
                              }

                              const data = await response.json();

                              if (!data.success) {
                                throw new Error('Failed to approve user');
                              }

                              console.log('[Settings] User approved, refetching...');
                              await fetchUsers();

                              alert('User approved successfully');
                            } catch (error: any) {
                              console.error('[Settings] Error:', error);
                              alert(`Error: ${error.message}`);
                            }
                          }}
                        >
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={[styles.roleChip, { backgroundColor: getRoleColor(user.role) }]}>
                          <Text style={styles.roleChipText}>{getRoleDisplayName(user.role)}</Text>
                        </View>
                        {availableRoles.length > 0 && user.id !== currentUser?.id && (
                          <ChevronRight size={20} color="#9CA3AF" />
                        )}
                      </>
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
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <LogOut size={20} color="#DC2626" />
                <Text style={styles.logoutButtonText}>{t('settings.logout') || 'Logout'}</Text>
              </>
            )}
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
          <View style={[styles.modalContent, { height: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Company Profile</Text>
              <TouchableOpacity onPress={() => setShowCompanyProfileModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.companyFormScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.formLabel}>Company Logo</Text>
              <View style={styles.logoUploadSection}>
                {companyForm.logo ? (
                  <Image source={{ uri: companyForm.logo }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.logoPreviewPlaceholder}>
                    <Building2 size={48} color="#9CA3AF" />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.uploadButton, isUploadingLogo && styles.uploadButtonDisabled]}
                  onPress={handleLogoUpload}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <>
                      <ActivityIndicator size="small" color="#2563EB" />
                      <Text style={styles.uploadButtonText}>Uploading...</Text>
                    </>
                  ) : (
                    <>
                      <Upload size={16} color="#2563EB" />
                      <Text style={styles.uploadButtonText}>Upload Logo</Text>
                    </>
                  )}
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

              <Text style={styles.formLabel}>Office Phone (10 digits only)</Text>
              <TextInput
                style={[styles.formInput, validationErrors.officePhone && styles.formInputError]}
                value={companyForm.officePhone}
                onChangeText={(text) => {
                  setCompanyForm({ ...companyForm, officePhone: filterPhoneInput(text) });
                  if (validationErrors.officePhone) {
                    setValidationErrors({ ...validationErrors, officePhone: undefined });
                  }
                }}
                placeholder="5555555555"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
              />
              {validationErrors.officePhone && (
                <Text style={styles.formErrorText}>{validationErrors.officePhone}</Text>
              )}

              <Text style={styles.formLabel}>Cell Phone (10 digits only)</Text>
              <TextInput
                style={[styles.formInput, validationErrors.cellPhone && styles.formInputError]}
                value={companyForm.cellPhone}
                onChangeText={(text) => {
                  setCompanyForm({ ...companyForm, cellPhone: filterPhoneInput(text) });
                  if (validationErrors.cellPhone) {
                    setValidationErrors({ ...validationErrors, cellPhone: undefined });
                  }
                }}
                placeholder="5555555555"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
              />
              {validationErrors.cellPhone && (
                <Text style={styles.formErrorText}>{validationErrors.cellPhone}</Text>
              )}

              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 60 }]}
                value={companyForm.address}
                onChangeText={(text) => setCompanyForm({ ...companyForm, address: text })}
                placeholder="Street address, City, State, ZIP"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.formLabel}>Email (Admin's email - cannot be changed)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputDisabled]}
                value={companyForm.email || currentUser?.email || ''}
                editable={false}
                placeholder="contact@company.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Website</Text>
              <TextInput
                style={[styles.formInput, validationErrors.website && styles.formInputError]}
                value={companyForm.website}
                onChangeText={(text) => {
                  setCompanyForm({ ...companyForm, website: text });
                  if (validationErrors.website) {
                    setValidationErrors({ ...validationErrors, website: undefined });
                  }
                }}
                placeholder="www.yourcompany.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              {validationErrors.website && (
                <Text style={styles.formErrorText}>{validationErrors.website}</Text>
              )}

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
                  style={[styles.formSaveButton, isSavingProfile && styles.formSaveButtonDisabled]}
                  onPress={handleSaveCompanyProfile}
                  disabled={isSavingProfile}
                >
                  <Text style={styles.formSaveButtonText}>
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
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
                      disabled={isUpdatingUser}
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
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  actionButtons: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
  codeContainerCopied: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  copiedHint: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600' as const,
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
  formInputDisabled: {
    backgroundColor: '#E5E7EB',
    color: '#6B7280',
  },
  formInputError: {
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  formErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
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
  uploadButtonDisabled: {
    opacity: 0.7,
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
  profileValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500' as const,
  },
  rateContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
  },
  rateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  requestButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  requestButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  currentRateDisplay: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
