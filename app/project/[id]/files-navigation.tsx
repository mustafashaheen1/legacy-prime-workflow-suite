import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Folder, Image as ImageIcon, Receipt, FileText, FileCheck, FileSignature, File as FileIcon, ArrowLeft, Plus, Upload, X, Camera, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { FileCategory, ProjectFile } from '@/types';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import { Linking } from 'react-native';

type FolderType = 'photos' | 'receipts' | 'permit-files' | 'inspections' | 'agreements' | 'videos';

interface FolderConfig {
  type: FolderType;
  name: string;
  icon: any;
  color: string;
  description: string;
}

const PREDEFINED_FOLDERS: FolderConfig[] = [
  {
    type: 'photos',
    name: 'Photos',
    icon: ImageIcon,
    color: '#3B82F6',
    description: 'Project photographs',
  },
  {
    type: 'receipts',
    name: 'Receipts',
    icon: Receipt,
    color: '#10B981',
    description: 'Receipts and expenses',
  },
  {
    type: 'permit-files',
    name: 'Permit Files',
    icon: FileCheck,
    color: '#F59E0B',
    description: 'Permit documents',
  },
  {
    type: 'inspections',
    name: 'Inspections',
    icon: FileSignature,
    color: '#8B5CF6',
    description: 'Inspection reports',
  },
  {
    type: 'agreements',
    name: 'Agreements',
    icon: FileText,
    color: '#EF4444',
    description: 'Contracts and agreements',
  },
  {
    type: 'videos',
    name: 'Videos',
    icon: Camera,
    color: '#EC4899',
    description: 'Inspection videos',
  },
];

interface FolderWithData extends FolderConfig {
  count: number;
  categories: string[];
}

export default function FilesNavigationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, projectFiles, photos, expenses, addProjectFile, addPhoto, addExpense, photoCategories, company } = useApp();

  const inspectionVideosQuery = trpc.crm.getInspectionVideos.useQuery({
    companyId: company?.id || '',
    status: 'all'
  }, {
    enabled: !!company?.id
  });
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
  const [fileNotes, setFileNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newFolderModalVisible, setNewFolderModalVisible] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [customFolders, setCustomFolders] = useState<FolderConfig[]>([]);
  const [viewingFile, setViewingFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [s3ProjectFiles, setS3ProjectFiles] = useState<ProjectFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);

  const project = projects.find(p => p.id === id);

  // Load project files from S3/database
  const loadProjectFiles = useCallback(async () => {
    if (!company?.id || !id) return;

    try {
      setIsLoadingFiles(true);
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/get-project-files?projectId=${id}&companyId=${company.id}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.files) {
          setS3ProjectFiles(result.files);
        }
      }
    } catch (error) {
      console.error('[Files] Error loading project files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [company?.id, id]);

  useEffect(() => {
    loadProjectFiles();
  }, [loadProjectFiles]);

  const projectPhotos = useMemo(() => {
    return photos.filter(p => p.projectId === id);
  }, [photos, id]);

  const projectExpenses = useMemo(() => {
    return expenses.filter(e => e.projectId === id);
  }, [expenses, id]);

  // Combine local and S3 project files
  const currentProjectFiles = useMemo(() => {
    const localFiles = projectFiles.filter(f => f.projectId === id);
    // Merge, preferring S3 files (they have actual URLs)
    const s3FileIds = new Set(s3ProjectFiles.map(f => f.id));
    const uniqueLocalFiles = localFiles.filter(f => !s3FileIds.has(f.id));
    return [...s3ProjectFiles, ...uniqueLocalFiles];
  }, [projectFiles, s3ProjectFiles, id]);

  const folders = useMemo((): FolderWithData[] => {
    const allFolders = [...PREDEFINED_FOLDERS, ...customFolders];
    
    return allFolders.map(folderConfig => {
      let count = 0;
      let categories: string[] = [];

      if (folderConfig.type === 'photos') {
        count = projectPhotos.length;
        const photosByCategory = projectPhotos.reduce((acc, photo) => {
          if (!acc[photo.category]) acc[photo.category] = 0;
          acc[photo.category]++;
          return acc;
        }, {} as Record<string, number>);
        categories = Object.keys(photosByCategory).sort();
      } else if (folderConfig.type === 'receipts') {
        count = projectExpenses.length;
        const expensesByCategory = projectExpenses.reduce((acc, expense) => {
          const category = expense.subcategory || expense.type;
          if (!acc[category]) acc[category] = 0;
          acc[category]++;
          return acc;
        }, {} as Record<string, number>);
        categories = Object.keys(expensesByCategory).sort();
      } else if (folderConfig.type === 'permit-files') {
        const files = currentProjectFiles.filter(f => f.category === 'permits');
        count = files.length;
        categories = count > 0 ? ['All Permits'] : [];
      } else if (folderConfig.type === 'inspections') {
        const files = currentProjectFiles.filter(f => f.category === 'inspections');
        count = files.length;
        categories = count > 0 ? ['All Inspections'] : [];
      } else if (folderConfig.type === 'agreements') {
        const files = currentProjectFiles.filter(f => f.category === 'agreements');
        count = files.length;
        categories = count > 0 ? ['All Agreements'] : [];
      } else if (folderConfig.type === 'videos') {
        const allVideos = inspectionVideosQuery.data?.inspections || [];
        const projectClientName = project?.name.split(' - ')[0].trim() || '';
        const clientVideos = allVideos.filter(v =>
          v.clientName.toLowerCase() === projectClientName.toLowerCase() &&
          v.status === 'completed' &&
          v.videoUrl
        );
        count = clientVideos.length;
        categories = count > 0 ? ['Client Videos'] : [];
      }

      return {
        ...folderConfig,
        count,
        categories,
      };
    });
  }, [projectPhotos, projectExpenses, currentProjectFiles, customFolders, inspectionVideosQuery.data, project]);

  const getFilesForCategory = (folderType: FolderType, category: string) => {
    if (folderType === 'photos') {
      return projectPhotos.filter(p => p.category === category);
    } else if (folderType === 'receipts') {
      return projectExpenses.filter(e => {
        const expenseCategory = e.subcategory || e.type;
        return expenseCategory === category;
      });
    } else if (folderType === 'permit-files') {
      return currentProjectFiles.filter(f => f.category === 'permits');
    } else if (folderType === 'inspections') {
      return currentProjectFiles.filter(f => f.category === 'inspections');
    } else if (folderType === 'agreements') {
      return currentProjectFiles.filter(f => f.category === 'agreements');
    } else if (folderType === 'videos') {
      const allVideos = inspectionVideosQuery.data?.inspections || [];
      const projectClientName = project?.name.split(' - ')[0].trim() || '';
      return allVideos.filter(v =>
        v.clientName.toLowerCase() === projectClientName.toLowerCase() &&
        v.status === 'completed' &&
        v.videoUrl
      );
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
    if (!company?.id) {
      Alert.alert('Error', 'Company not found. Please sign in again.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        setIsUploading(true);
        console.log('[Files] Starting file upload:', asset.name);

        let category: FileCategory = 'documentation';
        if (selectedFolder === 'permit-files') category = 'permits';
        else if (selectedFolder === 'inspections') category = 'inspections';
        else if (selectedFolder === 'agreements') category = 'agreements';

        try {
          // Step 1: Get pre-signed S3 upload URL
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
          console.log('[Files] Getting S3 upload URL...');

          const urlResponse = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: asset.name,
              fileType: asset.mimeType || 'application/octet-stream',
              projectId: id,
              fileCategory: category,
            }),
          });

          if (!urlResponse.ok) {
            const error = await urlResponse.json();
            throw new Error(error.error || 'Failed to get upload URL');
          }

          const { uploadUrl, fileUrl, key } = await urlResponse.json();
          console.log('[Files] Got S3 upload URL, uploading file...');

          // Step 2: Upload file to S3
          if (Platform.OS === 'web') {
            // On web, fetch the file and upload as blob
            const fileResponse = await fetch(asset.uri);
            const blob = await fileResponse.blob();

            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: {
                'Content-Type': asset.mimeType || 'application/octet-stream',
              },
            });

            if (!uploadResponse.ok) {
              throw new Error('Failed to upload file to S3');
            }
          } else {
            // On native, use fetch with the file URI
            const fileData = await fetch(asset.uri);
            const blob = await fileData.blob();

            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: {
                'Content-Type': asset.mimeType || 'application/octet-stream',
              },
            });

            if (!uploadResponse.ok) {
              throw new Error('Failed to upload file to S3');
            }
          }

          console.log('[Files] File uploaded to S3:', fileUrl);

          // Step 3: Save file metadata to database
          console.log('[Files] Saving file metadata to database...');

          const saveResponse = await fetch(`${apiUrl}/api/save-project-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              projectId: id,
              name: asset.name,
              category,
              fileType: asset.mimeType || 'unknown',
              fileSize: asset.size || 0,
              url: fileUrl,
              s3Key: key,
              notes: fileNotes,
            }),
          });

          if (!saveResponse.ok) {
            const error = await saveResponse.json();
            throw new Error(error.error || 'Failed to save file metadata');
          }

          const saveResult = await saveResponse.json();
          console.log('[Files] File saved successfully:', saveResult.file?.id);

          // Add to local state
          setS3ProjectFiles(prev => [saveResult.file, ...prev]);

          setFileNotes('');
          setUploadModalVisible(false);
          Alert.alert('Success', 'File uploaded successfully!');

        } catch (uploadError: any) {
          console.error('[Files] Upload error:', uploadError);
          Alert.alert('Upload Failed', uploadError.message || 'Could not upload file. Please try again.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Could not select file. Please try again.');
      setIsUploading(false);
    }
  };

  const handleCreateNewFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    const newFolder: FolderConfig = {
      type: newFolderName.toLowerCase().replace(/\s+/g, '-') as FolderType,
      name: newFolderName.trim(),
      icon: Folder,
      color: '#6B7280',
      description: 'Custom folder',
    };

    setCustomFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderModalVisible(false);
    Alert.alert('Success', 'Folder created successfully!');
  };

  const handleDeleteFolder = (folderType: FolderType) => {
    Alert.alert(
      t('projects.files.deleteFolder'),
      'Are you sure you want to delete this folder?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setCustomFolders(prev => prev.filter(f => f.type !== folderType));
            Alert.alert(t('common.success'), 'Folder deleted');
          },
        },
      ]
    );
  };

  const renderFolderView = () => {
    if (!selectedFolder) {
      return (
        <View style={styles.foldersContainer}>
          <View style={styles.foldersGrid}>
            {folders.map((folder) => {
              const FolderIcon = Folder;
              const isCustomFolder = !PREDEFINED_FOLDERS.find(f => f.type === folder.type);
              
              return (
                <View key={folder.type} style={styles.folderWrapper}>
                  <TouchableOpacity
                    style={styles.folderCard}
                    onPress={() => setSelectedFolder(folder.type)}
                  >
                    <View style={[styles.folderIconContainer, { backgroundColor: `${folder.color}20` }]}>
                      <FolderIcon size={48} color={folder.color} />
                    </View>
                    <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                    <Text style={styles.folderCount}>
                      {folder.count} {folder.count === 1 ? 'item' : 'items'}
                    </Text>
                  </TouchableOpacity>
                  {isCustomFolder && (
                    <TouchableOpacity
                      style={styles.deleteFolderButton}
                      onPress={() => handleDeleteFolder(folder.type)}
                    >
                      <X size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            
            <TouchableOpacity
              style={[styles.folderCard, styles.addFolderCard]}
              onPress={() => setNewFolderModalVisible(true)}
            >
              <View style={[styles.folderIconContainer, { backgroundColor: '#F3F4F620' }]}>
                <Plus size={48} color="#9CA3AF" />
              </View>
              <Text style={[styles.folderName, { color: '#6B7280' }]}>{t('projects.files.createNewFolder')}</Text>
              <Text style={styles.folderCount}>{t('projects.files.create')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const folder = folders.find(f => f.type === selectedFolder);
    if (!folder) return null;

    if (!selectedCategory) {
      const hasCategories = folder.categories.length > 0;
      
      return (
        <View style={styles.categoriesView}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>{folder.name}</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setUploadModalVisible(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {!hasCategories ? (
            <View style={styles.emptyFolderState}>
              <Folder size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>Empty Folder</Text>
              <Text style={styles.emptyStateText}>
                No files in this folder yet. Tap &quot;Add&quot; to get started.
              </Text>
            </View>
          ) : (
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
          )}
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
          {folder.type !== 'videos' && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setUploadModalVisible(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView style={styles.filesList} showsVerticalScrollIndicator={false}>
          {files.map((file: any) => {
            if (folder.type === 'photos') {
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.photoCard}
                  onPress={() => setViewingFile({ uri: file.url, name: file.category, type: 'image' })}
                  activeOpacity={0.8}
                >
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
                </TouchableOpacity>
              );
            } else if (folder.type === 'receipts') {
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.expenseCard}
                  onPress={() => {
                    if (file.receiptUrl) {
                      // Detect if it's a PDF or image
                      const isPdf = file.receiptUrl.toLowerCase().includes('.pdf') ||
                                   file.receiptUrl.toLowerCase().includes('application/pdf');
                      setViewingFile({
                        uri: file.receiptUrl,
                        name: `${file.store} - $${file.amount.toFixed(2)}`,
                        type: isPdf ? 'pdf' : 'image'
                      });
                    } else {
                      Alert.alert('No Receipt', 'This expense does not have a receipt image attached.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.expenseHeader}>
                    <Text style={styles.expenseType}>{file.type}</Text>
                    <Text style={styles.expenseAmount}>${file.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.expenseStore}>{file.store}</Text>
                  <Text style={styles.expenseDate}>
                    {new Date(file.date).toLocaleDateString()}
                  </Text>
                  {file.receiptUrl && (
                    <View style={styles.receiptIndicator}>
                      <Receipt size={14} color="#10B981" />
                      <Text style={styles.receiptIndicatorText}>Tap to view receipt</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            } else if (folder.type === 'videos') {
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentCard}
                  onPress={async () => {
                    try {
                      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                      const response = await fetch(`${apiUrl}/api/get-video-view-url?videoKey=${encodeURIComponent(file.videoUrl)}`);

                      if (!response.ok) {
                        throw new Error('Failed to get video URL');
                      }

                      const result = await response.json();
                      if (result.viewUrl) {
                        Linking.openURL(result.viewUrl);
                      }
                    } catch (error: any) {
                      console.error('[Videos] Error loading video:', error);
                      Alert.alert('Error', error.message || 'Failed to load video');
                    }
                  }}
                >
                  <View style={[styles.documentIcon, { backgroundColor: `${folder.color}20` }]}>
                    <Camera size={24} color={folder.color} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>{file.clientName}</Text>
                    <Text style={styles.documentDate}>
                      {new Date(file.completedAt || file.createdAt).toLocaleDateString()}
                    </Text>
                    {file.videoSize && (
                      <Text style={styles.documentNotes}>
                        {(file.videoSize / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            } else {
              const isImage = file.fileType?.startsWith('image/');
              const isPdf = file.fileType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
              // S3 files have 'url' property, local files have 'uri'
              const fileUrl = file.url || file.uri;
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentCard}
                  onPress={() => {
                    if (isImage) {
                      setViewingFile({ uri: fileUrl, name: file.name, type: 'image' });
                    } else if (isPdf && Platform.OS === 'web') {
                      // On web, open PDF in new tab
                      window.open(fileUrl, '_blank');
                    } else {
                      // Try to open the file with the system viewer
                      Linking.openURL(fileUrl).catch(() => {
                        Alert.alert('Cannot Open', 'Unable to open this file type on this device.');
                      });
                    }
                  }}
                  activeOpacity={0.8}
                >
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
                </TouchableOpacity>
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
                <Text style={styles.modalTitle}>Add to {selectedCategory || folders.find(f => f.type === selectedFolder)?.name}</Text>
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
                    style={[styles.modalActionButton, { flex: 1 }, isUploading && styles.modalActionButtonDisabled]}
                    onPress={handleUploadDocument}
                    disabled={isUploading}
                  >
                    <Upload size={20} color="#FFFFFF" />
                    <Text style={styles.modalActionButtonText}>
                      {isUploading ? 'Uploading...' : 'Upload File'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={newFolderModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setNewFolderModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projects.files.createNewFolder')}</Text>
                <TouchableOpacity onPress={() => setNewFolderModalVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Folder Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Plans, Daily Reports, etc."
                placeholderTextColor="#9CA3AF"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.modalActionButton, { flex: 1 }]}
                onPress={handleCreateNewFolder}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.modalActionButtonText}>{t('projects.files.createFolder')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* File Viewer Modal */}
        <Modal
          visible={!!viewingFile}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setViewingFile(null)}
        >
          <View style={styles.fileViewerOverlay}>
            <TouchableOpacity
              style={styles.fileViewerCloseArea}
              activeOpacity={1}
              onPress={() => setViewingFile(null)}
            />
            <View style={styles.fileViewerContainer}>
              <View style={styles.fileViewerHeader}>
                <Text style={styles.fileViewerTitle} numberOfLines={1}>
                  {viewingFile?.name}
                </Text>
                <TouchableOpacity
                  style={styles.fileViewerCloseButton}
                  onPress={() => setViewingFile(null)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {viewingFile?.type === 'image' && (
                <Image
                  source={{ uri: viewingFile.uri }}
                  style={styles.fileViewerImage}
                  contentFit="contain"
                />
              )}
              {viewingFile?.type === 'pdf' && (
                <View style={styles.pdfViewerContainer}>
                  <FileIcon size={64} color="#9CA3AF" />
                  <Text style={styles.pdfViewerText}>PDF Receipt</Text>
                  <TouchableOpacity
                    style={styles.openPdfButton}
                    onPress={() => {
                      if (viewingFile?.uri) {
                        Linking.openURL(viewingFile.uri);
                      }
                    }}
                  >
                    <Text style={styles.openPdfButtonText}>Open in Browser</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  foldersContainer: {
    flex: 1,
  },
  foldersGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  folderWrapper: {
    width: '47%',
    position: 'relative',
  },
  folderCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  addFolderCard: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  folderIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  folderCount: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  deleteFolderButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 20,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyFolderState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
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
  receiptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  receiptIndicatorText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
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
    flex: 1,
    marginRight: 12,
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
  modalActionButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  // File Viewer Styles
  fileViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileViewerCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fileViewerContainer: {
    width: '95%',
    maxWidth: 900,
    maxHeight: '90%',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    overflow: 'hidden',
  },
  fileViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
  },
  fileViewerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginRight: 16,
  },
  fileViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileViewerImage: {
    width: '100%',
    height: 500,
    backgroundColor: '#000000',
  },
  pdfViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
  },
  pdfViewerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
  },
  openPdfButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  openPdfButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
