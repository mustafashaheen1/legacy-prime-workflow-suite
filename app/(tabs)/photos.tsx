import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Camera, Upload, Edit2, X, Sparkles, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { photoCategories } from '@/mocks/data';
import { generateText } from '@rork/toolkit-sdk';
import { Photo } from '@/types';
import { useMutation } from '@tanstack/react-query';

export default function PhotosScreen() {
  const { photos, addPhoto, updatePhoto } = useApp();
  const [category, setCategory] = useState<string>('Foundation');
  const [notes, setNotes] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<string>('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
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
      setSelectedImage(result.assets[0].uri);
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

  const handleSave = () => {
    if (!selectedImage) return;

    addPhoto({
      id: Date.now().toString(),
      projectId: '1',
      category,
      notes,
      url: selectedImage,
      date: new Date().toISOString(),
    });

    setSelectedImage(null);
    setNotes('');
    setAiSuggestedCategory(null);
  };

  const handleEditCategory = (photo: Photo) => {
    setEditingPhoto(photo);
    setTempCategory(photo.category);
    setShowCategoryModal(true);
    suggestCategoryMutation.mutate(photo.url);
  };

  const handleSaveCategory = () => {
    if (!editingPhoto) return;
    
    updatePhoto(editingPhoto.id, { category: tempCategory });
    
    setShowCategoryModal(false);
    setEditingPhoto(null);
    setAiSuggestedCategory(null);
    setTempCategory('');
  };

  const handleUseSuggestion = () => {
    if (aiSuggestedCategory) {
      setTempCategory(aiSuggestedCategory);
    }
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
          <Text style={styles.label}>Category</Text>
          <View style={styles.picker}>
            <Text style={styles.pickerText}>{category}</Text>
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add notes about this photo..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          {selectedImage && (
            <View style={styles.previewContainer}>
              <Text style={styles.label}>Preview</Text>
              <Image source={{ uri: selectedImage }} style={styles.preview} contentFit="cover" />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.saveButton, !selectedImage && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={!selectedImage}
          >
            <Text style={styles.saveButtonText}>Save Photo</Text>
          </TouchableOpacity>
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
  picker: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
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
});
