import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, TextInput, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import type { BusinessFileType } from '@/types';

interface BusinessFileUploadProps {
  subcontractorId?: string;
  token?: string;
  type: BusinessFileType;
  label: string;
  allowMultiple?: boolean;
  requireExpiryDate?: boolean;
  onFileUploaded: (file: any) => void;
  onFileDeleted?: (fileId: string) => void;
  uploadedFiles?: any[];
}

export default function BusinessFileUpload({
  subcontractorId,
  token,
  type,
  label,
  allowMultiple = false,
  requireExpiryDate = false,
  onFileUploaded,
  onFileDeleted,
  uploadedFiles = [],
}: BusinessFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showExpiryInput, setShowExpiryInput] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [pendingFile, setPendingFile] = useState<any>(null);

  const pickDocument = async () => {
    console.log('[BusinessFileUpload] pickDocument called - opening file picker...');
    console.log('[BusinessFileUpload] Component props:', { type, label, hasToken: !!token, hasSubcontractorId: !!subcontractorId });

    try {
      console.log('[BusinessFileUpload] Calling DocumentPicker.getDocumentAsync...');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: allowMultiple,
      });

      console.log('[BusinessFileUpload] DocumentPicker result:', { canceled: result.canceled, hasAssets: result.assets?.length });

      if (result.canceled) {
        console.log('[BusinessFileUpload] User canceled file picker');
        return;
      }

      const file = result.assets[0];

      // Validate file size (max 10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size && file.size > maxFileSize) {
        Alert.alert('File Too Large', 'Maximum file size is 10MB. Please choose a smaller file.');
        return;
      }

      // If expiry date is required, show date input first
      if (requireExpiryDate) {
        setPendingFile(file);
        setShowExpiryInput(true);
      } else {
        await uploadFile(file);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async (file: any, expiryDate?: Date) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      console.log('[BusinessFileUpload] Starting upload...', {
        fileName: file.name,
        hasToken: !!token,
        hasSubcontractorId: !!subcontractorId
      });

      // Step 1: Get presigned URL and save metadata
      const requestBody: any = {
        type,
        name: file.name,
        fileType: file.mimeType,
        fileSize: file.size,
      };

      // Add subcontractorId only if it exists
      if (subcontractorId) {
        requestBody.subcontractorId = subcontractorId;
      }

      // Add token if it exists (for registration flow)
      if (token) {
        requestBody.token = token;
      }

      if (expiryDate) {
        requestBody.expiryDate = expiryDate.toISOString().split('T')[0];
      }

      console.log('[BusinessFileUpload] Request body:', requestBody);

      const metadataResponse = await fetch('/api/upload-subcontractor-business-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[BusinessFileUpload] Metadata response status:', metadataResponse.status);

      if (!metadataResponse.ok) {
        const error = await metadataResponse.json();
        console.error('[BusinessFileUpload] Metadata error:', error);
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, ...fileMetadata } = await metadataResponse.json();

      console.log('[BusinessFileUpload] Got upload URL, uploading to S3...');

      setUploadProgress(30);

      // Step 2: Upload file to S3 using presigned URL
      const fileBlob = await fetch(file.uri).then(res => res.blob());

      console.log('[BusinessFileUpload] File blob created, size:', fileBlob.size);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.mimeType,
        },
        body: fileBlob,
      });

      console.log('[BusinessFileUpload] S3 upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      setUploadProgress(100);

      console.log('[BusinessFileUpload] File uploaded successfully:', fileMetadata.id);

      onFileUploaded(fileMetadata);

      Alert.alert('Success', 'File uploaded successfully');
    } catch (error: any) {
      console.error('[BusinessFileUpload] Upload error:', error);
      console.error('[BusinessFileUpload] Error details:', {
        message: error.message,
        stack: error.stack
      });
      Alert.alert(
        'Upload Failed',
        `${error.message || 'Failed to upload file'}. Please check your connection and try again.`
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setPendingFile(null);
    }
  };

  const handleDateConfirm = () => {
    if (!expiryDate) {
      Alert.alert('Error', 'Please enter an expiry date');
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiryDate)) {
      Alert.alert('Error', 'Please enter date in YYYY-MM-DD format (e.g., 2025-12-31)');
      return;
    }

    const date = new Date(expiryDate);
    if (isNaN(date.getTime())) {
      Alert.alert('Error', 'Please enter a valid date');
      return;
    }

    setShowExpiryInput(false);
    if (pendingFile) {
      uploadFile(pendingFile, date);
    }
    setExpiryDate('');
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      Alert.alert(
        'Delete File',
        'Are you sure you want to delete this file?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const queryParams = new URLSearchParams({ id: fileId });
              if (token) {
                queryParams.append('token', token);
              }

              const response = await fetch(`/api/delete-subcontractor-business-file?${queryParams}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete file');
              }

              if (onFileDeleted) {
                onFileDeleted(fileId);
              }

              Alert.alert('Success', 'File deleted successfully');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('[BusinessFileUpload] Delete error:', error);
      Alert.alert('Error', error.message || 'Failed to delete file');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'image';
    } else if (fileType === 'application/pdf') {
      return 'document';
    } else {
      return 'document-text';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={pickDocument}
        disabled={uploading || (!allowMultiple && uploadedFiles.length > 0)}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
        )}
        <Text style={styles.uploadButtonText}>
          {uploading ? 'Uploading...' : 'Choose File'}
        </Text>
      </TouchableOpacity>

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.progressText}>{uploadProgress}%</Text>
        </View>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.map((file) => (
        <View key={file.id} style={styles.fileCard}>
          <View style={styles.fileInfo}>
            <Ionicons
              name={getFileIcon(file.fileType) as any}
              size={32}
              color="#007AFF"
            />
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileSize}>{formatFileSize(file.fileSize)}</Text>
              {file.expiryDate && (
                <Text style={styles.expiryDate}>
                  Expires: {new Date(file.expiryDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>

          {onFileDeleted && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteFile(file.id)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Expiry Date Input */}
      {showExpiryInput && (
        <View style={styles.datePickerContainer}>
          <Text style={styles.datePickerLabel}>Enter Expiry Date</Text>
          <TextInput
            style={styles.dateInput}
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="YYYY-MM-DD (e.g., 2025-12-31)"
            placeholderTextColor="#8E8E93"
          />
          <View style={styles.datePickerButtons}>
            <TouchableOpacity
              style={[styles.datePickerButton, styles.cancelButton]}
              onPress={() => {
                setShowExpiryInput(false);
                setPendingFile(null);
                setExpiryDate('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.datePickerButton, styles.confirmButton]}
              onPress={handleDateConfirm}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    borderStyle: 'dashed',
    backgroundColor: '#F8F9FA',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
    borderColor: '#9CA3AF',
  },
  uploadButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  progressText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginTop: 10,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  expiryDate: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  datePickerContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  datePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  dateInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  datePickerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E5E5EA',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
