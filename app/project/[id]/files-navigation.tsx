import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Folder, Image as ImageIcon, Receipt, File as FileIcon, ArrowLeft, Plus, Upload, X, Camera, Search } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { FileCategory, ProjectFile } from '@/types';

type FolderType = 'photos' | 'expenses' | 'documents' | 'plans' | 'reports' | 'other';

interface FolderData {
  type: FolderType;
  name: string;
  icon: any;
  color: string;
  count: number;
  categories: string[];
}

export default function FilesNavigationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, projectFiles, photos, expenses, addProjectFile, addPhoto, addExpense, photoCategories } = useApp();
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<'photo' | 'document' | 'receipt'>('document');
  const [fileNotes, setFileNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const project = projects.find(p => p.id === id);

  const projectPhotos = useMemo(() => {
    return photos.filter(p => p.projectId === id);
  }, [photos, id]);

  const projectExpenses = useMemo(() => {
    return expenses.filter(e => e.projectId === id);
  }, [expenses, id]);

  const currentProjectFiles = useMemo(() => {
    return projectFiles.filter(f => f.projectId === id);
  }, [projectFiles, id]);

  const folders = useMemo((): FolderData[] => {
    const foldersData: FolderData[] = [];

    // Photos folder
    const photosByCategory = projectPhotos.reduce((acc, photo) => {
      if (!acc[photo.category]) acc[photo.category] = 0;
      acc[photo.category]++;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(photosByCategory).length > 0) {
      foldersData.push({
        type: 'photos',
        name: 'Photos',
        icon: ImageIcon,
        color: '#3B82F6',
        count: projectPhotos.length,
        categories: Object.keys(photosByCategory),
      });
    }

    // Expenses folder
    const expensesByCategory = projectExpenses.reduce((acc, expense) => {
      const category = expense.subcategory || expense.type;
      if (!acc[category]) acc[category] = 0;
      acc[category]++;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(expensesByCategory).length > 0) {
      foldersData.push({
        type: 'expenses',
        name: 'Receipts',
        icon: Receipt,
        color: '#10B981',
        count: projectExpenses.length,
        categories: Object.keys(expensesByCategory),
      });
    }

    // Documents folder (files categorized as documentation)
    const documentFiles = currentProjectFiles.filter(f => 
      f.category === 'documentation' || f.category === 'other'
    );
    const docsByType = documentFiles.reduce((acc, file) => {
      const type = file.fileType.includes('pdf') ? 'PDF' : 
                   file.fileType.includes('image') ? 'Images' : 
                   file.fileType.includes('word') ? 'Documents' : 'Other';
      if (!acc[type]) acc[type] = 0;
      acc[type]++;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(docsByType).length > 0) {
      foldersData.push({
        type: 'documents',
        name: 'Documents',
        icon: FileIcon,
        color: '#6B7280',
        count: documentFiles.length,
        categories: Object.keys(docsByType),
      });
    }

    // Plans folder
    const planFiles = currentProjectFiles.filter(f => f.category === 'plans');
    if (planFiles.length > 0) {
      foldersData.push({
        type: 'plans',
        name: 'Plans',
        icon: FileIcon,
        color: '#F59E0B',
        count: planFiles.length,
        categories: ['All Plans'],
      });
    }

    // Reports folder
    const reportFiles = currentProjectFiles.filter(f => f.category === 'reports');
    if (reportFiles.length > 0) {
      foldersData.push({
        type: 'reports',
        name: 'Reports',
        icon: FileIcon,
        color: '#8B5CF6',
        count: reportFiles.length,
        categories: ['All Reports'],
      });
    }

    return foldersData;
  }, [projectPhotos, projectExpenses, currentProjectFiles]);

  const getFilesForCategory = (folderType: FolderType, category: string) => {
    if (folderType === 'photos') {
      return projectPhotos.filter(p => p.category === category);
    } else if (folderType === 'expenses') {
      return projectExpenses.filter(e => {
        const expenseCategory = e.subcategory || e.type;
        return expenseCategory === category;
      });
    } else if (folderType === 'documents') {
      return currentProjectFiles.filter(f => {
        if (f.category !== 'documentation' && f.category !== 'other') return false;
        const type = f.fileType.includes('pdf') ? 'PDF' : 
                     f.fileType.includes('image') ? 'Images' : 
                     f.fileType.includes('word') ? 'Documents' : 'Other';
        return type === category;
      });
    } else if (folderType === 'plans') {
      return currentProjectFiles.filter(f => f.category === 'plans');
    } else if (folderType === 'reports') {
      return currentProjectFiles.filter(f => f.category === 'reports');
    }
    return [];
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newPhoto = {
        id: Date.now().toString(),
        projectId: id as string,
        category: selectedCategory || photoCategories[0] || 'Other',
        notes: fileNotes,
        url: result.assets[0].uri,
        date: new Date().toISOString(),
      };
      addPhoto(newPhoto);
      setFileNotes('');
      setUploadModalVisible(false);
      Alert.alert('Success', 'Photo added successfully!');
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Camera is not available on web');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newPhoto = {
        id: Date.now().toString(),
        projectId: id as string,
        category: selectedCategory || photoCategories[0] || 'Other',
        notes: fileNotes,
        url: result.assets[0].uri,
        date: new Date().toISOString(),
      };
      addPhoto(newPhoto);
      setFileNotes('');
      setUploadModalVisible(false);
      Alert.alert('Success', 'Photo added successfully!');
    }
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const file: ProjectFile = {
          id: Date.now().toString(),
          projectId: id as string,
          name: asset.name,
          category: selectedFolder === 'plans' ? 'plans' : 
                   selectedFolder === 'reports' ? 'reports' : 'documentation',
          fileType: asset.mimeType || 'unknown',
          fileSize: asset.size || 0,
          uri: asset.uri,
          uploadDate: new Date().toISOString(),
          notes: fileNotes,
        };

        addProjectFile(file);
        setFileNotes('');
        setUploadModalVisible(false);
        Alert.alert('Success', 'File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const renderFolderView = () => {
    if (!selectedFolder) {
      return (
        <View style={styles.foldersGrid}>
          {folders.length === 0 ? (
            <View style={styles.emptyState}>
              <Folder size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No files yet</Text>
              <Text style={styles.emptyStateText}>
                Start uploading photos, receipts, or documents to organize your project files
              </Text>
            </View>
          ) : (
            folders.map((folder) => {
              const FolderIcon = folder.icon;
              return (
                <TouchableOpacity
                  key={folder.type}
                  style={styles.folderCard}
                  onPress={() => setSelectedFolder(folder.type)}
                >
                  <View style={[styles.folderIconContainer, { backgroundColor: `${folder.color}20` }]}>
                    <FolderIcon size={32} color={folder.color} />
                  </View>
                  <Text style={styles.folderName}>{folder.name}</Text>
                  <Text style={styles.folderCount}>{folder.count} items</Text>
                  <View style={styles.folderCategoriesPreview}>
                    {folder.categories.slice(0, 3).map((cat, idx) => (
                      <Text key={idx} style={styles.folderCategoryChip} numberOfLines={1}>
                        {cat}
                      </Text>
                    ))}
                    {folder.categories.length > 3 && (
                      <Text style={styles.folderCategoryMore}>
                        +{folder.categories.length - 3} more
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      );
    }

    const folder = folders.find(f => f.type === selectedFolder);
    if (!folder) return null;

    if (!selectedCategory) {
      return (
        <View style={styles.categoriesView}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>Categories in {folder.name}</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setUploadModalVisible(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
            {folder.categories.map((category) => {
              const files = getFilesForCategory(folder.type, category);
              return (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryCard}
                  onPress={() => setSelectedCategory(category)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: `${folder.color}20` }]}>
                    <Folder size={24} color={folder.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category}</Text>
                    <Text style={styles.categoryCount}>{files.length} items</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    const files = getFilesForCategory(folder.type, selectedCategory);
    return (
      <View style={styles.filesView}>
        <View style={styles.filesHeader}>
          <View>
            <Text style={styles.filesTitle}>{selectedCategory}</Text>
            <Text style={styles.filesSubtitle}>{files.length} items</Text>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setUploadModalVisible(true)}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.filesList} showsVerticalScrollIndicator={false}>
          {files.map((file: any) => {
            if (folder.type === 'photos') {
              return (
                <View key={file.id} style={styles.photoCard}>
                  <Image source={{ uri: file.url }} style={styles.photoThumbnail} contentFit="cover" />
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoCategory}>{file.category}</Text>
                    <Text style={styles.photoDate}>
                      {new Date(file.date).toLocaleDateString()}
                    </Text>
                    {file.notes && (
                      <Text style={styles.photoNotes} numberOfLines={2}>{file.notes}</Text>
                    )}
                  </View>
                </View>
              );
            } else if (folder.type === 'expenses') {
              return (
                <View key={file.id} style={styles.expenseCard}>
                  <View style={styles.expenseHeader}>
                    <Text style={styles.expenseType}>{file.type}</Text>
                    <Text style={styles.expenseAmount}>${file.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.expenseStore}>{file.store}</Text>
                  <Text style={styles.expenseDate}>
                    {new Date(file.date).toLocaleDateString()}
                  </Text>
                </View>
              );
            } else {
              return (
                <View key={file.id} style={styles.documentCard}>
                  <View style={[styles.documentIcon, { backgroundColor: `${folder.color}20` }]}>
                    <FileIcon size={24} color={folder.color} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.documentDate}>
                      {new Date(file.uploadDate).toLocaleDateString()}
                    </Text>
                    {file.notes && (
                      <Text style={styles.documentNotes} numberOfLines={2}>{file.notes}</Text>
                    )}
                  </View>
                </View>
              );
            }
          })}
        </ScrollView>
      </View>
    );
  };

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        headerShown: true,
        title: 'Files',
        headerLeft: () => (
          <TouchableOpacity onPress={() => {
            if (selectedCategory) {
              setSelectedCategory(null);
            } else if (selectedFolder) {
              setSelectedFolder(null);
            } else {
              router.back();
            }
          }}>
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
        ),
      }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.projectName}>{project.name}</Text>
            <Text style={styles.breadcrumb}>
              Files
              {selectedFolder && ` > ${folders.find(f => f.type === selectedFolder)?.name}`}
              {selectedCategory && ` > ${selectedCategory}`}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderFolderView()}
        </ScrollView>

        <Modal
          visible={uploadModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setUploadModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add to {selectedCategory || selectedFolder}</Text>
                <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Add notes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={fileNotes}
                onChangeText={setFileNotes}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                {selectedFolder === 'photos' ? (
                  <>
                    <TouchableOpacity
                      style={styles.modalActionButton}
                      onPress={handleTakePhoto}
                    >
                      <Camera size={20} color="#FFFFFF" />
                      <Text style={styles.modalActionButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalActionButton}
                      onPress={handlePickPhoto}
                    >
                      <Upload size={20} color="#FFFFFF" />
                      <Text style={styles.modalActionButtonText}>Upload Photo</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalActionButton, { flex: 1 }]}
                    onPress={handleUploadDocument}
                  >
                    <Upload size={20} color="#FFFFFF" />
                    <Text style={styles.modalActionButtonText}>Upload File</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  breadcrumb: {
    fontSize: 13,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  foldersGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  folderCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  folderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  folderCount: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  folderCategoriesPreview: {
    gap: 6,
  },
  folderCategoryChip: {
    fontSize: 11,
    color: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  folderCategoryMore: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600' as const,
    marginTop: 4,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  categoriesView: {
    flex: 1,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  categoriesList: {
    flex: 1,
    padding: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  filesView: {
    flex: 1,
  },
  filesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  filesSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  filesList: {
    flex: 1,
    padding: 16,
  },
  photoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  photoInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  photoCategory: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  photoDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  photoNotes: {
    fontSize: 13,
    color: '#6B7280',
  },
  expenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  expenseStore: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  documentCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  documentNotes: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
