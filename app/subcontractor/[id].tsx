import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Building2, Mail, Phone, MapPin, FileText, CheckCircle2, XCircle, Upload, Shield, User, Check, X, Download, Eye } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { BusinessFile, Subcontractor } from '@/types';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';

export default function SubcontractorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { subcontractors = [], user, updateSubcontractor } = useApp();
  const subcontractor = subcontractors.find(s => s.id === id);

  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  const approveSubcontractorMutation = trpc.subcontractors.approveSubcontractor.useMutation();

  // Local state for business files fetched from database
  const [businessFiles, setBusinessFiles] = useState<BusinessFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);

  // Fetch business files from database on mount
  useEffect(() => {
    if (subcontractor?.id) {
      fetchBusinessFiles();
    }
  }, [subcontractor?.id]);

  const fetchBusinessFiles = async () => {
    if (!subcontractor?.id) return;

    try {
      setIsLoadingFiles(true);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/get-business-files?subcontractorId=${subcontractor.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      if (data.success && data.files) {
        setBusinessFiles(data.files);
        // Also update local context state
        await updateSubcontractor(subcontractor.id, { businessFiles: data.files });
      }
    } catch (error) {
      console.error('[BusinessFiles] Error fetching:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  if (!subcontractor) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Subcontractor Not Found' }} />
        <View style={styles.emptyState}>
          <User size={64} color="#D1D5DB" />
          <Text style={styles.emptyStateText}>Subcontractor not found</Text>
        </View>
      </View>
    );
  }

  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileUpload = async (type: 'license' | 'insurance' | 'w9' | 'certificate' | 'other') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploading(true);

        console.log('[Upload] Starting upload for:', asset.name);

        // Step 1: Get presigned URL from direct API endpoint (faster than tRPC)
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const response = await fetch(`${baseUrl}/api/upload-business-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subcontractorId: subcontractor.id,
            type,
            name: asset.name,
            fileType: asset.mimeType || 'application/octet-stream',
            fileSize: asset.size || 0,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const uploadResponse = await response.json();
        console.log('[Upload] Got presigned URL, uploading to S3...');

        // Step 2: Upload file to S3 using presigned URL
        if (Platform.OS === 'web') {
          // Web: Fetch the file and upload
          const fileResponse = await fetch(asset.uri);
          const blob = await fileResponse.blob();

          const s3Response = await fetch(uploadResponse.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': asset.mimeType || 'application/octet-stream',
            },
          });

          if (!s3Response.ok) {
            throw new Error(`S3 upload failed: ${s3Response.status}`);
          }
        } else {
          // Native: Use FileSystem to upload
          const uploadResult = await FileSystem.uploadAsync(uploadResponse.uploadUrl, asset.uri, {
            httpMethod: 'PUT',
            headers: {
              'Content-Type': asset.mimeType || 'application/octet-stream',
            },
          });

          if (uploadResult.status !== 200) {
            throw new Error(`S3 upload failed: ${uploadResult.status}`);
          }
        }

        console.log('[Upload] S3 upload successful');

        // Step 3: Update local state with the new file
        const newBusinessFile: BusinessFile = {
          id: uploadResponse.id,
          subcontractorId: uploadResponse.subcontractorId,
          type: uploadResponse.type as BusinessFile['type'],
          name: uploadResponse.name,
          fileType: uploadResponse.fileType,
          fileSize: uploadResponse.fileSize,
          uri: uploadResponse.uri,
          uploadDate: uploadResponse.uploadDate,
          expiryDate: uploadResponse.expiryDate,
          verified: uploadResponse.verified,
          notes: uploadResponse.notes,
        };

        const updatedFiles = [...businessFiles, newBusinessFile];
        setBusinessFiles(updatedFiles);
        await updateSubcontractor(subcontractor.id, { businessFiles: updatedFiles });

        setIsUploading(false);
        Alert.alert('Success', 'File uploaded successfully to cloud storage');
        setShowUploadModal(false);
      }
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      setIsUploading(false);
      Alert.alert('Error', error.message || 'Failed to upload file');
    }
  };

  const handleViewFile = async (file: BusinessFile) => {
    try {
      // Open the file URL in browser/viewer
      if (Platform.OS === 'web') {
        window.open(file.uri, '_blank');
      } else {
        await Linking.openURL(file.uri);
      }
    } catch (error) {
      console.error('[ViewFile] Error:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const handleVerifyFile = async (file: BusinessFile, verified: boolean) => {
    try {
      setIsVerifying(file.id);

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/verify-business-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          verified,
          verifiedBy: user?.id || 'user_current',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      // Update local state with verified file
      const updatedFiles = businessFiles.map(f =>
        f.id === file.id ? {
          ...f,
          verified: result.verified,
          verifiedBy: result.verifiedBy,
          verifiedDate: result.verifiedDate
        } : f
      );
      setBusinessFiles(updatedFiles);
      await updateSubcontractor(subcontractor.id, { businessFiles: updatedFiles });

      Alert.alert('Success', `File ${verified ? 'verified' : 'unverified'} successfully`);
    } catch (error: any) {
      console.error('[Verify] Error:', error);
      Alert.alert('Error', error.message || 'Failed to verify file');
    } finally {
      setIsVerifying(null);
    }
  };

  const handleApproveSubcontractor = async (approved: boolean) => {
    try {
      console.log('[Subcontractor] Approving subcontractor:', subcontractor.id, subcontractor.name);

      // Update directly with Supabase to bypass backend timeout
      const { error } = await supabase
        .from('subcontractors')
        .update({
          approved,
          approved_by: user?.id || 'user_current',
          approved_date: new Date().toISOString()
        })
        .eq('id', subcontractor.id);

      if (error) throw error;

      // Update local state
      await updateSubcontractor(subcontractor.id, {
        approved,
        approvedBy: user?.id || 'user_current',
        approvedDate: new Date().toISOString()
      });

      Alert.alert('Success', `Subcontractor ${approved ? 'approved' : 'rejected'} successfully`);
      setShowApproveModal(false);
    } catch (error: any) {
      console.error('[Approve] Error:', error);
      Alert.alert('Error', error.message || 'Failed to update approval status');
    }
  };

  const verifiedFilesCount = businessFiles.filter(f => f.verified).length;
  const allFilesVerified = businessFiles.length > 0 && verifiedFilesCount === businessFiles.length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: subcontractor.name }} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{subcontractor.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{subcontractor.name}</Text>
          <Text style={styles.company}>{subcontractor.companyName}</Text>
          <View style={styles.tradeBadge}>
            <Text style={styles.tradeBadgeText}>{subcontractor.trade}</Text>
          </View>

          <View style={styles.approvalStatus}>
            {subcontractor.approved ? (
              <View style={styles.approvedBadge}>
                <CheckCircle2 size={18} color="#10B981" />
                <Text style={styles.approvedText}>Approved</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <XCircle size={18} color="#F59E0B" />
                <Text style={styles.pendingText}>Pending Approval</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#2563EB" />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Mail size={16} color="#6B7280" />
              <Text style={styles.infoText}>{subcontractor.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.infoText}>{subcontractor.phone}</Text>
            </View>
            {subcontractor.address && (
              <View style={styles.infoRow}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.infoText}>{subcontractor.address}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color="#2563EB" />
            <Text style={styles.sectionTitle}>Business Files</Text>
            <TouchableOpacity
              style={styles.uploadHeaderButton}
              onPress={() => setShowUploadModal(true)}
            >
              <Upload size={16} color="#2563EB" />
              <Text style={styles.uploadHeaderButtonText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {isLoadingFiles ? (
            <View style={styles.loadingFiles}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingFilesText}>Loading files...</Text>
            </View>
          ) : businessFiles.length === 0 ? (
            <View style={styles.emptyFiles}>
              <FileText size={48} color="#D1D5DB" />
              <Text style={styles.emptyFilesText}>No business files uploaded yet</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => setShowUploadModal(true)}
              >
                <Upload size={18} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Upload Files</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.filesProgress}>
                <Text style={styles.filesProgressText}>
                  {verifiedFilesCount} of {businessFiles.length} files verified
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(verifiedFilesCount / businessFiles.length) * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {businessFiles.map((file) => (
                <View key={file.id} style={styles.fileCard}>
                  <View style={styles.fileHeader}>
                    <View style={styles.fileInfo}>
                      <FileText size={20} color="#2563EB" />
                      <View style={styles.fileDetails}>
                        <Text style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileType}>{file.type.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.fileActions}>
                      <TouchableOpacity
                        style={styles.viewFileButton}
                        onPress={() => handleViewFile(file)}
                      >
                        <Eye size={18} color="#2563EB" />
                      </TouchableOpacity>
                      {isVerifying === file.id ? (
                        <View style={styles.verifyingButton}>
                          <ActivityIndicator size="small" color="#6B7280" />
                        </View>
                      ) : file.verified ? (
                        <TouchableOpacity
                          style={styles.verifiedBadgeButton}
                          onPress={() => handleVerifyFile(file, false)}
                        >
                          <CheckCircle2 size={16} color="#10B981" />
                          <Text style={styles.verifiedBadgeText}>Verified</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.verifyActionButton}
                          onPress={() => handleVerifyFile(file, true)}
                        >
                          <CheckCircle2 size={16} color="#FFFFFF" />
                          <Text style={styles.verifyActionButtonText}>Verify</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {file.expiryDate && (
                    <Text style={styles.fileExpiry}>Expires: {file.expiryDate}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {!subcontractor.approved && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.approveButton, !allFilesVerified && styles.approveButtonDisabled]}
              onPress={() => setShowApproveModal(true)}
              disabled={!allFilesVerified}
            >
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.approveButtonText}>Approve Subcontractor</Text>
            </TouchableOpacity>
            {!allFilesVerified && (
              <Text style={styles.approveNote}>
                Verify all business files before approving
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showUploadModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Business File</Text>
            <TouchableOpacity onPress={() => !isUploading && setShowUploadModal(false)} disabled={isUploading}>
              <X size={24} color={isUploading ? '#9CA3AF' : '#1F2937'} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <Text style={styles.uploadingText}>Uploading file to cloud storage...</Text>
                <Text style={styles.uploadingSubtext}>Please wait, this may take a moment</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>Select the type of document to upload</Text>

                <TouchableOpacity
                  style={styles.uploadOptionButton}
                  onPress={() => handleFileUpload('license')}
                >
                  <FileText size={24} color="#2563EB" />
                  <View style={styles.uploadOptionText}>
                    <Text style={styles.uploadOptionTitle}>License</Text>
                    <Text style={styles.uploadOptionSubtitle}>Contractor license document</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadOptionButton}
                  onPress={() => handleFileUpload('insurance')}
                >
                  <Shield size={24} color="#2563EB" />
                  <View style={styles.uploadOptionText}>
                    <Text style={styles.uploadOptionTitle}>Insurance</Text>
                    <Text style={styles.uploadOptionSubtitle}>Insurance certificate</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadOptionButton}
                  onPress={() => handleFileUpload('w9')}
                >
                  <FileText size={24} color="#2563EB" />
                  <View style={styles.uploadOptionText}>
                    <Text style={styles.uploadOptionTitle}>W-9 Form</Text>
                    <Text style={styles.uploadOptionSubtitle}>Tax form W-9</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadOptionButton}
                  onPress={() => handleFileUpload('certificate')}
                >
                  <FileText size={24} color="#2563EB" />
                  <View style={styles.uploadOptionText}>
                    <Text style={styles.uploadOptionTitle}>Certificate</Text>
                    <Text style={styles.uploadOptionSubtitle}>Other certificates</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadOptionButton}
                  onPress={() => handleFileUpload('other')}
                >
                  <FileText size={24} color="#2563EB" />
                  <View style={styles.uploadOptionText}>
                    <Text style={styles.uploadOptionTitle}>Other</Text>
                    <Text style={styles.uploadOptionSubtitle}>Other documents</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showApproveModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.approveModal}>
            <Text style={styles.approveModalTitle}>Approve Subcontractor?</Text>
            <Text style={styles.approveModalText}>
              This will allow {subcontractor.name} to receive estimate requests from you.
            </Text>
            <View style={styles.approveModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowApproveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleApproveSubcontractor(true)}
              >
                <Text style={styles.confirmButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  company: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  tradeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    marginBottom: 16,
  },
  tradeBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  approvalStatus: {
    marginTop: 8,
  },
  approvedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
  },
  approvedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  pendingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  uploadHeaderButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  uploadHeaderButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
  },
  emptyFiles: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyFilesText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  filesProgress: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filesProgressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4B5563',
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  fileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  fileActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  viewFileButton: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  verifyActionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  verifyActionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  verifiedBadgeButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  verifyingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingFiles: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 12,
  },
  loadingFilesText: {
    fontSize: 15,
    color: '#6B7280',
  },
  fileExpiry: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  approveButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  approveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  approveNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
  },
  uploadOptionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  uploadOptionText: {
    flex: 1,
  },
  uploadOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  uploadOptionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  uploadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  uploadingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  uploadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  approveModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  approveModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  approveModalText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  approveModalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center' as const,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
