import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Camera, Upload, Edit2, X, Sparkles, Check, Plus, Trash2, Settings } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { generateText } from '@rork-ai/toolkit-sdk';
import { Photo } from '@/types';
import { useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { compressImage, getFileSize, validateFileForUpload, getMimeType } from '@/lib/upload-utils';
import { useUploadProgress } from '@/hooks/useUploadProgress';

export default function PhotosScreen() {
  const { photos, addPhoto, updatePhoto, photoCategories, addPhotoCategory, updatePhotoCategory, deletePhotoCategory, company } = useApp();
  const [category, setCategory] = useState<string>(photoCategories[0] || 'Other');
  const [notes, setNotes] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editedCategoryValue, setEditedCategoryValue] = useState<string>('');
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewNotes, setPreviewNotes] = useState<string>('');

  // Upload progress state
  const uploadProgress = useUploadProgress();

  const pickImage = async () => {
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
      suggestCategoryMutation.mutate(imageUri);
    }
  };

  const takePhoto = async () => {
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
      suggestCategoryMutation.mutate(imageUri);
    }
  };

  const suggestCategoryMutation = useMutation({
    mutationFn: async (imageUri: string) => {
      console.log('[AI] Suggesting category for image...');
      const prompt = `Analyze this construction image and suggest the most appropriate category from this list: ${photoCategories.join(', ')}. Only respond with the category name, nothing else.`;
      
      const base64 = await fetch(imageUri)
        .then(res => res.blob())
        .then(blob => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }));
      
      const suggestion = await generateText({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: base64 }
            ]
          }
        ]
      });
      
      const cleanSuggestion = suggestion.trim();
      const matchedCategory = photoCategories.find(
        cat => cat.toLowerCase() === cleanSuggestion.toLowerCase()
      );
      
      console.log('[AI] Suggested category:', matchedCategory || cleanSuggestion);
      return matchedCategory || cleanSuggestion;
    },
    onSuccess: (suggestedCat) => {
      setAiSuggestedCategory(suggestedCat);
    },
    onError: (error) => {
      console.error('[AI] Error suggesting category:', error);
      Alert.alert('Error', 'Could not get AI suggestion. Please select manually.');
    }
  });

  const handleSaveFromPreview = async () => {
    if (!selectedImage || !company) {
      Alert.alert('Error', 'No image selected or company not found');
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

      // 3. Get MIME type
      const mimeType = getMimeType(selectedImage);
      const fileName = `photo-${Date.now()}.jpg`;

      // 4. Upload to S3 via backend
      uploadProgress.startUpload();
      uploadProgress.setProgress(50);

      const result = await trpc.photos.addPhoto.mutate({
        companyId: company.id,
        projectId: '1', // TODO: Get actual project ID
        category: tempCategory,
        notes: previewNotes,
        fileData: compressed.base64,
        fileName,
        mimeType,
        fileSize: compressedSize,
        date: new Date().toISOString(),
      });

      uploadProgress.setProgress(90);

      if (result.success && result.photo) {
        // Add to local state
        addPhoto(result.photo);

        uploadProgress.complete();

        // Close modal and reset
        setSelectedImage(null);
        setPreviewNotes('');
        setAiSuggestedCategory(null);
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
    suggestCategoryMutation.mutate(photo.url);
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
    setAiSuggestedCategory(null);
    setTempCategory('');
  };

  const handleUseSuggestion = () => {
    if (aiSuggestedCategory) {
      setTempCategory(aiSuggestedCategory);
    }
  };

  const handleCancelPreview = () => {
    setShowPreviewModal(false);
    setSelectedImage(null);
    setPreviewNotes('');
    setAiSuggestedCategory(null);
    setTempCategory('');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

        <View style={styles.gallery}>
          <Text style={styles.galleryTitle}>Thumbnail Gallery</Text>
          <View style={styles.galleryGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.galleryItem}>
                <Image source={{ uri: photo.url }} style={styles.thumbnail} contentFit="cover" />
                <View style={styles.thumbnailFooter}>
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

            {suggestCategoryMutation.isPending && (
              <View style={styles.aiSuggestionLoading}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.aiSuggestionText}>AI is analyzing the image...</Text>
              </View>
            )}

            {aiSuggestedCategory && !suggestCategoryMutation.isPending && (
              <View style={styles.aiSuggestionContainer}>
                <View style={styles.aiSuggestionHeader}>
                  <Sparkles size={16} color="#8B5CF6" />
                  <Text style={styles.aiSuggestionTitle}>AI Suggestion</Text>
                </View>
                <TouchableOpacity 
                  style={styles.aiSuggestionButton}
                  onPress={handleUseSuggestion}
                >
                  <Text style={styles.aiSuggestionCategory}>{aiSuggestedCategory}</Text>
                  {tempCategory === aiSuggestedCategory && (
                    <Check size={16} color="#10B981" />
                  )}
                </TouchableOpacity>
                <Text style={styles.aiSuggestionHint}>Tap to use this suggestion</Text>
              </View>
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
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.previewModalImage} 
                  contentFit="cover" 
                />
              )}

              {suggestCategoryMutation.isPending && (
                <View style={styles.aiSuggestionLoading}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.aiSuggestionText}>AI is analyzing the image...</Text>
                </View>
              )}

              {aiSuggestedCategory && !suggestCategoryMutation.isPending && (
                <View style={styles.aiSuggestionContainer}>
                  <View style={styles.aiSuggestionHeader}>
                    <Sparkles size={16} color="#8B5CF6" />
                    <Text style={styles.aiSuggestionTitle}>AI Suggestion</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.aiSuggestionButton}
                    onPress={handleUseSuggestion}
                  >
                    <Text style={styles.aiSuggestionCategory}>{aiSuggestedCategory}</Text>
                    {tempCategory === aiSuggestedCategory && (
                      <Check size={16} color="#10B981" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.aiSuggestionHint}>Tap to use this suggestion</Text>
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
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  thumbnailLabel: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
  },
  thumbnailFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  editButton: {
    padding: 4,
  },
  photoNotes: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
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
  previewModalImage: {
    width: '100%',
    height: 250,
    marginBottom: 16,
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
});
