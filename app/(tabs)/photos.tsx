import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Camera, Upload } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { photoCategories } from '@/mocks/data';

export default function PhotosScreen() {
  const { photos, addPhoto } = useApp();
  const [category, setCategory] = useState<string>('Foundation');
  const [notes, setNotes] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
                <Text style={styles.thumbnailLabel}>{photo.category}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    textAlign: 'center',
  },
});
