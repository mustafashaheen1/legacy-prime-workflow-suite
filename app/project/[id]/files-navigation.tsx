import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Folder, Image as ImageIcon, Receipt, FileText, FileCheck, FileSignature, File as FileIcon, ArrowLeft, Plus, Upload, X, Camera, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { FileCategory, ProjectFile } from '@/types';

type FolderType = 'photos' | 'receipts' | 'permit-files' | 'inspections' | 'agreements';

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
    name: 'Fotos',
    icon: ImageIcon,
    color: '#3B82F6',
    description: 'Fotografías del proyecto',
  },
  {
    type: 'receipts',
    name: 'Recibos',
    icon: Receipt,
    color: '#10B981',
    description: 'Recibos y gastos',
  },
  {
    type: 'permit-files',
    name: 'Permit Files',
    icon: FileCheck,
    color: '#F59E0B',
    description: 'Documentos de permisos',
  },
  {
    type: 'inspections',
    name: 'Inspections',
    icon: FileSignature,
    color: '#8B5CF6',
    description: 'Reportes de inspección',
  },
  {
    type: 'agreements',
    name: 'Agreements',
    icon: FileText,
    color: '#EF4444',
    description: 'Contratos y acuerdos',
  },
];

interface FolderWithData extends FolderConfig {
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
  const [fileNotes, setFileNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newFolderModalVisible, setNewFolderModalVisible] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [customFolders, setCustomFolders] = useState<FolderConfig[]>([]);

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
        categories = count > 0 ? ['Todos los Permisos'] : [];
      } else if (folderConfig.type === 'inspections') {
        const files = currentProjectFiles.filter(f => f.category === 'inspections');
        count = files.length;
        categories = count > 0 ? ['Todas las Inspecciones'] : [];
      } else if (folderConfig.type === 'agreements') {
        const files = currentProjectFiles.filter(f => f.category === 'agreements');
        count = files.length;
        categories = count > 0 ? ['Todos los Contratos'] : [];
      }

      return {
        ...folderConfig,
        count,
        categories,
      };
    });
  }, [projectPhotos, projectExpenses, currentProjectFiles, customFolders]);

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
      Alert.alert('Éxito', '¡Foto agregada correctamente!');
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No Disponible', 'La cámara no está disponible en web');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se requiere acceso a la cámara');
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
      Alert.alert('Éxito', '¡Foto agregada correctamente!');
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
        
        let category: FileCategory = 'documentation';
        if (selectedFolder === 'permit-files') category = 'permits';
        else if (selectedFolder === 'inspections') category = 'inspections';
        else if (selectedFolder === 'agreements') category = 'agreements';
        
        const file: ProjectFile = {
          id: Date.now().toString(),
          projectId: id as string,
          name: asset.name,
          category,
          fileType: asset.mimeType || 'unknown',
          fileSize: asset.size || 0,
          uri: asset.uri,
          uploadDate: new Date().toISOString(),
          notes: fileNotes,
        };

        addProjectFile(file);
        setFileNotes('');
        setUploadModalVisible(false);
        Alert.alert('Éxito', '¡Archivo subido correctamente!');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo subir el archivo. Intenta de nuevo.');
    }
  };

  const handleCreateNewFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el folder');
      return;
    }

    const newFolder: FolderConfig = {
      type: newFolderName.toLowerCase().replace(/\s+/g, '-') as FolderType,
      name: newFolderName.trim(),
      icon: Folder,
      color: '#6B7280',
      description: 'Folder personalizado',
    };

    setCustomFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderModalVisible(false);
    Alert.alert('Éxito', '¡Folder creado correctamente!');
  };

  const handleDeleteFolder = (folderType: FolderType) => {
    Alert.alert(
      'Eliminar Folder',
      '¿Estás seguro que deseas eliminar este folder?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setCustomFolders(prev => prev.filter(f => f.type !== folderType));
            Alert.alert('Éxito', 'Folder eliminado');
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
              <Text style={[styles.folderName, { color: '#6B7280' }]}>Nuevo Folder</Text>
              <Text style={styles.folderCount}>Crear</Text>
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
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          
          {!hasCategories ? (
            <View style={styles.emptyFolderState}>
              <Folder size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>Folder vacío</Text>
              <Text style={styles.emptyStateText}>
                Aún no hay archivos en este folder. Toca "Agregar" para comenzar.
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
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setUploadModalVisible(true)}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Agregar</Text>
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
            } else if (folder.type === 'receipts') {
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
                <Text style={styles.modalTitle}>Agregar a {selectedCategory || folders.find(f => f.type === selectedFolder)?.name}</Text>
                <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Notas (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Agregar notas..."
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
                      <Text style={styles.modalActionButtonText}>Tomar Foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalActionButton}
                      onPress={handlePickPhoto}
                    >
                      <Upload size={20} color="#FFFFFF" />
                      <Text style={styles.modalActionButtonText}>Subir Foto</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalActionButton, { flex: 1 }]}
                    onPress={handleUploadDocument}
                  >
                    <Upload size={20} color="#FFFFFF" />
                    <Text style={styles.modalActionButtonText}>Subir Archivo</Text>
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
                <Text style={styles.modalTitle}>Crear Nuevo Folder</Text>
                <TouchableOpacity onPress={() => setNewFolderModalVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Nombre del Folder</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Planos, Reportes Diarios, etc."
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
                <Text style={styles.modalActionButtonText}>Crear Folder</Text>
              </TouchableOpacity>
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
});
