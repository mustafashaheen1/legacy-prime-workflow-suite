import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Camera, Upload, Edit2, X, Check, Plus, Trash2, Settings } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Photo } from '@/types';
import { compressImage, getFileSize, validateFileForUpload, getMimeType } from '@/lib/upload-utils';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { supabase } from '@/lib/supabase';

export default function PhotosScreen() {
  const { photos, addPhoto, updatePhoto, photoCategories, addPhotoCategory, updatePhotoCategory, deletePhotoCategory, company, projects, refreshPhotos } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPhotos();
    setRefreshing(false);
  }, [refreshPhotos]);
  const [category, setCategory] = useState<string>(photoCategories[0] || 'Other');
  const [notes, setNotes] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editedCategoryValue, setEditedCategoryValue] = useState<string>('');
  const [tempCategory, setTempCategory] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewNotes, setPreviewNotes] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectPickerModal, setShowProjectPickerModal] = useState<boolean>(false);

  // Upload progress state
  const uploadProgress = useUploadProgress();

  // Auto-select first active project on mount
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const firstActiveProject = projects.find(p => p.status === 'active');
      if (firstActiveProject) {
        setSelectedProjectId(firstActiveProject.id);
      }
    }
  }, [projects, selectedProjectId]);

  const pickImage = async () => {
    if (!selectedProjectId) {
      Alert.alert('No Project Selected', 'Please select a project before uploading photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);
      setPreviewNotes('');
      setTempCategory(category);
      setShowPreviewModal(true);
    }
  };

  const takePhoto = async () => {
    if (!selectedProjectId) {
      Alert.alert('No Project Selected', 'Please select a project before uploading photos');
      return;
    }

    if (Platform.OS === 'web') {
      console.log('Camera not available on web');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.log('Camera permission denied');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);
      setPreviewNotes('');
      setTempCategory(category);
      setShowPreviewModal(true);
    }
  };

  const handleSaveFromPreview = async () => {
    if (!selectedImage || !company) {
      Alert.alert('Error', 'No image selected or company not found');
      return;
    }

    if (!selectedProjectId) {
      Alert.alert('No Project Selected', 'Please select a project before uploading photos');
      return;
    }

    try {
      uploadProgress.reset();
      uploadProgress.startCompression();

      // 1. Get file size and validate
      const fileSize = await getFileSize(selectedImage);
      const validation = validateFileForUpload({ fileSize, type: 'image' });

      if (!validation.valid) {
        Alert.alert('File Too Large', validation.error || 'File exceeds size limit');
        uploadProgress.reset();
        return;
      }

      console.log('[Photos] Original file size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');

      // 2. Compress image
      uploadProgress.setPhase('compressing');
      uploadProgress.setProgress(20);

      const compressed = await compressImage(selectedImage, {
        maxWidth: 1920,
        quality: 0.8,
      });

      const compressedSize = compressed.base64.length;
      const reduction = ((1 - compressedSize / fileSize) * 100).toFixed(1);
      console.log('[Photos] Compressed size:', (compressedSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('[Photos] Size reduction:', reduction + '%');

      uploadProgress.setProgress(40);

      // 3. Set MIME type (ImageManipulator always outputs JPEG)
      const mimeType = 'image/jpeg';
      const fileName = `photo-${Date.now()}.jpg`;

      // 4. Upload to S3 via backend API (using direct endpoint to avoid TRPC timeout)
      uploadProgress.startUpload();
      uploadProgress.setProgress(50);

      // 🎯 PHASE 2B: Get JWT token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.warn('[Photos] No auth token available for photo upload');
        throw new Error('You must be logged in to upload photos');
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/add-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 🎯 PHASE 2B: Attach Authorization header
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          // 🎯 SECURITY: Remove companyId - comes from JWT
          projectId: selectedProjectId,
          category: tempCategory,
          notes: previewNotes,
          fileData: compressed.base64,
          fileName,
          mimeType,
          fileSize: compressedSize,
          date: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload photo');
      }

      const result = await response.json();

      uploadProgress.setProgress(90);

      if (result.success && result.photo) {
        // Add to local state
        addPhoto(result.photo);

        uploadProgress.complete();

        // Close modal and reset
        setSelectedImage(null);
        setPreviewNotes('');
        setShowPreviewModal(false);
        setTempCategory('');

        // Reset progress after a delay
        setTimeout(() => {
          uploadProgress.reset();
        }, 1000);

        Alert.alert('Success', 'Photo uploaded successfully!');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('[Photos] Upload error:', error);
      uploadProgress.setError(error.message || 'Failed to upload photo');
      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload photo. Please try again.',
        [
          {
            text: 'Retry',
            onPress: handleSaveFromPreview,
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => uploadProgress.reset(),
          },
        ]
      );
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    if (photoCategories.includes(newCategoryName.trim())) {
      Alert.alert('Error', 'This category already exists');
      return;
    }
    addPhotoCategory(newCategoryName.trim());
    setNewCategoryName('');
  };

  const handleUpdateCategory = (oldName: string) => {
    if (!editedCategoryValue.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    if (photoCategories.includes(editedCategoryValue.trim()) && oldName !== editedCategoryValue.trim()) {
      Alert.alert('Error', 'This category already exists');
      return;
    }
    updatePhotoCategory(oldName, editedCategoryValue.trim());
    setEditingCategoryName(null);
    setEditedCategoryValue('');
  };

  const handleDeleteCategory = (categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This won\'t delete the photos, but they will keep their current category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePhotoCategory(categoryName),
        },
      ]
    );
  };

  const handleEditCategory = (photo: Photo) => {
    setEditingPhoto(photo);
    setTempCategory(photo.category);
    setShowCategoryModal(true);
  };

  const handleOpenCategoryModal = () => {
    setTempCategory(category);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
    if (editingPhoto) {
      updatePhoto(editingPhoto.id, { category: tempCategory });
      setEditingPhoto(null);
    } else {
      setCategory(tempCategory);
    }
    
    setShowCategoryModal(false);
    setTempCategory('');
  };

  const handleCancelPreview = () => {
    setShowPreviewModal(false);
    setSelectedImage(null);
    setPreviewNotes('');
    setTempCategory('');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Photos</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={takePhoto}>
              <Camera size={20} color="#FFFFFF" />
              <Text style={styles.headerButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={pickImage}>
              <Upload size={20} color="#FFFFFF" />
              <Text style={styles.headerButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.categoryHeader}>
            <Text style={styles.label}>Default Category</Text>
            <TouchableOpacity 
              onPress={() => setShowManageCategoriesModal(true)}
              style={styles.manageCategoriesButton}
            >
              <Settings size={16} color="#2563EB" />
              <Text style={styles.manageCategoriesText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.picker}
            onPress={handleOpenCategoryModal}
          >
            <Text style={styles.pickerText}>{category}</Text>
            <Edit2 size={16} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.helperText}>This is the default category for new photos. You can change it when adding a photo.</Text>
        </View>

        <View style={styles.projectSection}>
          <Text style={styles.sectionLabel}>Project</Text>
          <TouchableOpacity
            style={styles.projectPicker}
            onPress={() => setShowProjectPickerModal(true)}
          >
            <Text style={styles.projectPickerText}>
              {selectedProjectId
                ? projects.find(p => p.id === selectedProjectId)?.name || 'Select a project'
                : 'Select a project'
              }
            </Text>
            <Edit2 size={16} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.helperText}>Photos will be saved to this project</Text>
        </View>

        <View style={styles.gallery}>
          <Text style={styles.galleryTitle}>Thumbnail Gallery</Text>
          <View style={styles.galleryGrid}>
            {photos
              .filter(photo => !selectedProjectId || photo.projectId === selectedProjectId)
              .map((photo) => (
              <View key={photo.id} style={styles.galleryItem}>
                <Image source={{ uri: photo.url }} style={styles.thumbnail} contentFit="cover" />

                {/* 🎯 CLIENT DESIGN: Uploader info with avatar + name */}
                <View style={styles.thumbnailFooter}>
                  <View style={styles.uploaderRow}>
                    {photo.uploader ? (
                      <>
                        {photo.uploader.avatar ? (
                          <Image
                            source={{ uri: photo.uploader.avatar }}
                            style={styles.uploaderAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.uploaderAvatarPlaceholder}>
                            <Text style={styles.uploaderInitials}>
                              {photo.uploader.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.uploaderName} numberOfLines={1}>
                          {photo.uploader.name}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.uploaderAvatarPlaceholder}>
                          <Text style={styles.uploaderInitials}>?</Text>
                        </View>
                        <Text style={styles.uploaderName}>Unknown</Text>
                      </>
                    )}
                  </View>

                  <View style={styles.categoryRow}>
                    <Text style={styles.thumbnailLabel}>{photo.category}</Text>
                    <TouchableOpacity
                      onPress={() => handleEditCategory(photo)}
                      style={styles.editButton}
                    >
                      <Edit2 size={14} color="#2563EB" />
                    </TouchableOpacity>
                  </View>

                  {photo.notes && (
                    <Text style={styles.photoNotes} numberOfLines={2}>{photo.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {editingPhoto && (
              <Image 
                source={{ uri: editingPhoto.url }} 
                style={styles.modalImage} 
                contentFit="cover" 
              />
            )}

            <Text style={styles.modalLabel}>Select Category</Text>
            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
              {photoCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    tempCategory === cat && styles.categoryOptionSelected
                  ]}
                  onPress={() => setTempCategory(cat)}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    tempCategory === cat && styles.categoryOptionTextSelected
                  ]}>
                    {cat}
                  </Text>
                  {tempCategory === cat && (
                    <Check size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalSaveButton}
              onPress={handleSaveCategory}
            >
              <Text style={styles.modalSaveButtonText}>Save Category</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showManageCategoriesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageCategoriesModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowManageCategoriesModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Categories</Text>
              <TouchableOpacity onPress={() => setShowManageCategoriesModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.addCategorySection}>
              <TextInput
                style={styles.categoryInput}
                placeholder="Enter new category name..."
                placeholderTextColor="#9CA3AF"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <TouchableOpacity 
                style={styles.addCategoryButton}
                onPress={handleAddCategory}
              >
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Existing Categories</Text>
            <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
              {photoCategories.map((cat) => (
                <View key={cat} style={styles.categoryManageItem}>
                  {editingCategoryName === cat ? (
                    <View style={styles.editCategoryRow}>
                      <TextInput
                        style={styles.editCategoryInput}
                        value={editedCategoryValue}
                        onChangeText={setEditedCategoryValue}
                        autoFocus
                      />
                      <TouchableOpacity 
                        onPress={() => handleUpdateCategory(cat)}
                        style={styles.editCategoryAction}
                      >
                        <Check size={20} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          setEditingCategoryName(null);
                          setEditedCategoryValue('');
                        }}
                        style={styles.editCategoryAction}
                      >
                        <X size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.categoryManageText}>{cat}</Text>
                      <View style={styles.categoryManageActions}>
                        <TouchableOpacity 
                          onPress={() => {
                            setEditingCategoryName(cat);
                            setEditedCategoryValue(cat);
                          }}
                          style={styles.categoryActionButton}
                        >
                          <Edit2 size={16} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleDeleteCategory(cat)}
                          style={styles.categoryActionButton}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowManageCategoriesModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelPreview}
      >
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.previewModalHeader}>
              <Text style={styles.previewModalTitle}>Preview Photo</Text>
              <TouchableOpacity onPress={handleCancelPreview}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewModalScroll} showsVerticalScrollIndicator={false}>
              {selectedImage && (
                <View style={styles.previewImageContainer}>
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.previewModalImage}
                    contentFit="contain"
                  />
                </View>
              )}

              <View style={styles.previewFormSection}>
                <Text style={styles.previewLabel}>Category</Text>
                <TextInput
                  style={styles.previewCategoryInput}
                  value={tempCategory}
                  onChangeText={setTempCategory}
                  placeholder="Enter or edit category..."
                  placeholderTextColor="#9CA3AF"
                />
                
                <Text style={styles.previewLabel}>Quick Select</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.quickCategoriesScroll}
                >
                  {photoCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.quickCategoryChip,
                        tempCategory === cat && styles.quickCategoryChipSelected
                      ]}
                      onPress={() => setTempCategory(cat)}
                    >
                      <Text style={[
                        styles.quickCategoryChipText,
                        tempCategory === cat && styles.quickCategoryChipTextSelected
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.previewLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.previewInput, styles.previewTextArea]}
                  placeholder="Add notes about this photo..."
                  placeholderTextColor="#9CA3AF"
                  value={previewNotes}
                  onChangeText={setPreviewNotes}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.previewModalActions}>
              <TouchableOpacity 
                style={styles.previewCancelButton}
                onPress={handleCancelPreview}
              >
                <Text style={styles.previewCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.previewSaveButton}
                onPress={handleSaveFromPreview}
              >
                <Text style={styles.previewSaveButtonText}>Save Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        visible={uploadProgress.isUploading}
        transparent
        animationType="fade"
      >
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadModal}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.uploadTitle}>
              {uploadProgress.phase === 'compressing' && 'Compressing image...'}
              {uploadProgress.phase === 'uploading' && 'Uploading to cloud...'}
              {uploadProgress.phase === 'complete' && 'Upload complete!'}
            </Text>
            <Text style={styles.uploadProgress}>{uploadProgress.progress}%</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${uploadProgress.progress}%` }
                ]}
              />
            </View>
            {uploadProgress.error && (
              <Text style={styles.uploadError}>{uploadProgress.error}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Project Picker Modal */}
      <Modal
        visible={showProjectPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectPickerModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowProjectPickerModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Project</Text>
              <TouchableOpacity onPress={() => setShowProjectPickerModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {projects
                .filter(p => p.status === 'active' || p.status === 'on-hold')
                .map(project => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.projectOption,
                      selectedProjectId === project.id && styles.projectOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedProjectId(project.id);
                      setShowProjectPickerModal(false);
                    }}
                  >
                    <View style={styles.projectOptionContent}>
                      <Text style={styles.projectOptionName}>{project.name}</Text>
                      <Text style={styles.projectOptionBudget}>
                        Budget: ${project.budget.toLocaleString()}
                      </Text>
                    </View>
                    {selectedProjectId === project.id && (
                      <Check size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </Pressable>
        </Pressable>
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
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  form: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  manageCategoriesText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  picker: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  previewContainer: {
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  gallery: {
    padding: 16,
    backgroundColor: '#E5E7EB',
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  galleryItem: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  thumbnailLabel: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600' as const,
    flex: 1,
  },
  thumbnailFooter: {
    marginTop: 4,
  },
  // 🎯 CLIENT DESIGN: Uploader row styles
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploaderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploaderInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  uploaderName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginLeft: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 4,
  },
  editButton: {
    padding: 4,
  },
  photoNotes: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 16,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  categoryList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  categoryOptionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  categoryOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  modalSaveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  aiSuggestionContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiSuggestionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8B5CF6',
    textTransform: 'uppercase' as const,
  },
  aiSuggestionButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiSuggestionCategory: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  aiSuggestionHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  aiSuggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 16,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  addCategorySection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  categoryInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
  },
  addCategoryButton: {
    backgroundColor: '#2563EB',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesList: {
    maxHeight: 320,
    marginBottom: 16,
  },
  categoryManageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryManageText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500' as const,
    flex: 1,
  },
  categoryManageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryActionButton: {
    padding: 4,
  },
  editCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editCategoryInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  editCategoryAction: {
    padding: 4,
  },
  modalCloseButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  previewModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  previewModalScroll: {
    flex: 1,
  },
  previewImageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalImage: {
    width: '100%',
    height: '100%',
  },
  previewFormSection: {
    padding: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 12,
  },
  previewCategoryInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600' as const,
  },
  quickCategoriesScroll: {
    marginBottom: 8,
  },
  quickCategoryChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickCategoryChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  quickCategoryChipText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  quickCategoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  previewInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
  },
  previewTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  previewModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  previewCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  previewCancelButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  previewSaveButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  previewSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // Upload Progress Modal Styles
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '80%',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadProgress: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  uploadError: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  projectSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  projectPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  projectPickerText: {
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  projectOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  projectOptionContent: {
    flex: 1,
  },
  projectOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  projectOptionBudget: {
    fontSize: 14,
    color: '#6B7280',
  },
});
