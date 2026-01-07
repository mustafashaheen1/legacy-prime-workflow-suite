import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { priceListCategories } from '@/mocks/priceList';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { Image } from 'expo-image';
import { ArrowLeft, X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File } from 'lucide-react-native';

export default function ProjectExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { expenses, addExpense, projects, user } = useApp();
  const [expenseType, setExpenseType] = useState<string>('Subcontractor');
  const [category, setCategory] = useState<string>(priceListCategories[0]);
  const [amount, setAmount] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'image' | 'file' | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState<boolean>(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');

  const project = useMemo(() => 
    projects.find(p => p.id === id),
    [projects, id]
  );

  const filteredExpenses = useMemo(() => 
    expenses.filter(e => e.projectId === id),
    [expenses, id]
  );

  const projectExpenseTotal = useMemo(() => 
    filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const handleSave = async () => {
    if (!amount || !store) {
      Alert.alert('Missing Information', 'Please enter amount and store/invoice details.');
      return;
    }

    try {
      console.log('[Expenses] Saving expense:', { amount, store, type: expenseType });

      await addExpense({
        id: Date.now().toString(),
        projectId: id as string,
        type: expenseType,
        subcategory: expenseType === 'Subcontractor' ? category : expenseType,
        amount: parseFloat(amount),
        store,
        date: new Date().toISOString(),
        receiptUrl: receiptImage || undefined,
      });

      console.log('[Expenses] Expense saved successfully');

      setAmount('');
      setStore('');
      setReceiptImage(null);
      setReceiptType(null);
      setReceiptFileName(null);
      Alert.alert('Success', 'Expense added successfully!');
    } catch (error: any) {
      console.error('[Expenses] Error saving expense:', error);
      Alert.alert('Error', `Failed to save expense: ${error.message || 'Unknown error'}`);
    }
  };

  const handleScanReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to scan receipts.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processReceipt(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error scanning receipt:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    }
  };

  const handleUploadReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library access is required to upload receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processReceipt(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      Alert.alert('Error', 'Failed to upload receipt. Please try again.');
    }
  };

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      console.log('[FILE] Selected file:', file);

      if (file.mimeType?.startsWith('image/')) {
        await processReceipt(file.uri);
      } else if (file.mimeType === 'application/pdf') {
        setReceiptImage(file.uri);
        setReceiptType('file');
        setReceiptFileName(file.name);
        Alert.alert(
          'PDF Uploaded',
          'PDF file uploaded successfully. Please enter expense details manually.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Unsupported File', 'Please upload an image or PDF file.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file. Please try again.');
    }
  };

  const processReceipt = async (uri: string) => {
    try {
      setIsScanning(true);
      setReceiptImage(uri);
      setReceiptType('image');

      console.log('[OCR] Processing receipt image...');
      console.log('[OCR] Platform:', Platform.OS);
      console.log('[OCR] Image URI:', uri);

      let imageData = uri;

      if (Platform.OS !== 'web' && uri.startsWith('file://')) {
        console.log('[OCR] Reading local file as base64...');
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64' as any,
          });
          const mimeType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
          imageData = `data:${mimeType};base64,${base64}`;
          console.log('[OCR] Image converted to base64');
        } catch (conversionError) {
          console.error('[OCR] Error converting image:', conversionError);
          throw new Error('Failed to convert image to base64');
        }
      } else if (Platform.OS === 'web' && !uri.startsWith('data:')) {
        console.log('[OCR] Converting web image to base64...');
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imageData = base64;
          console.log('[OCR] Image converted to base64');
        } catch (conversionError) {
          console.error('[OCR] Error converting image:', conversionError);
          throw new Error('Failed to convert image to base64');
        }
      }

      console.log('[OCR] Sending request to AI...');
      console.log('[OCR] Image data length:', imageData.length);
      console.log('[OCR] Image data format:', imageData.substring(0, 50));

      if (!imageData || imageData.length < 100) {
        throw new Error('Invalid image data - image is too small or corrupted');
      }

      const ReceiptSchema = z.object({
        store: z.string().describe('The name of the store or vendor from the receipt'),
        amount: z.number().describe('The total amount from the receipt as a number'),
        date: z.string().optional().describe('The date from the receipt in ISO format if available'),
        category: z.string().describe(`The most appropriate construction expense category from: ${priceListCategories.join(', ')}`),
        items: z.string().optional().describe('Brief description of items purchased if visible'),
        confidence: z.number().min(0).max(100).describe('Confidence level in the extraction (0-100)')
      });

      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: imageData,
              },
              {
                type: 'text',
                text: `Analyze this receipt image and extract key information. Identify the store/vendor, total amount, date, and items if visible. Based on the items and store, intelligently categorize this expense into the most appropriate construction category. Consider:
- Hardware stores (Home Depot, Lowe's, etc.) → categorize by what was purchased (lumber, electrical, plumbing, etc.)
- Material suppliers → specific material categories
- Service providers → appropriate service category
- Office/general supplies → PRE-CONSTRUCTION

Be intelligent about the categorization based on the actual items purchased, not just the store name.`,
              },
            ],
          },
        ],
        schema: ReceiptSchema,
      });

      console.log('[OCR] AI Response:', result);

      if (result.store) setStore(result.store);
      if (result.amount) {
        setAmount(result.amount.toFixed(2));
      }
      if (result.category && priceListCategories.includes(result.category)) {
        setCategory(result.category);
      } else if (result.category) {
        console.log('[OCR] Category not found in list, using first category');
      }

      console.log('[OCR] Successfully extracted receipt data');
      
      const confidenceMsg = result.confidence >= 80 
        ? 'High confidence extraction' 
        : result.confidence >= 60 
        ? 'Medium confidence extraction' 
        : 'Low confidence extraction';
      
      Alert.alert(
        '✓ Receipt Analyzed',
        `${confidenceMsg}. Fields have been auto-filled. Please review and edit if needed, then tap Save.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[OCR] Error processing receipt:', error);
      
      let errorMessage = 'Could not extract receipt information. Please enter details manually.';
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Network error: Unable to connect to AI service. Please check your internet connection and try again.';
        } else if (error.message.includes('base64')) {
          errorMessage = 'Image processing error: Could not read the image file. Please try a different photo.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      Alert.alert(
        'Processing Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
    }
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Expenses</Text>
            <Text style={styles.headerSubtitle}>{project.name}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleScanReceipt}
            >
              <Scan size={20} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleScanReceipt}
            >
              <Receipt size={20} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleUploadReceipt}
            >
              <Upload size={20} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleUploadFile}
            >
              <File size={20} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {receiptImage && receiptType === 'image' && (
              <View style={styles.receiptPreview}>
                <Image
                  source={{ uri: receiptImage }}
                  style={styles.receiptImage}
                  contentFit="cover"
                />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => {
                    setReceiptImage(null);
                    setReceiptType(null);
                    setReceiptFileName(null);
                  }}
                >
                  <X size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {receiptImage && receiptType === 'file' && (
              <View style={styles.filePreview}>
                <View style={styles.fileInfo}>
                  <File size={40} color="#2563EB" />
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>{receiptFileName || 'Document'}</Text>
                    <Text style={styles.fileType}>PDF</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.removeFileButton}
                  onPress={() => {
                    setReceiptImage(null);
                    setReceiptType(null);
                    setReceiptFileName(null);
                  }}
                >
                  <X size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>Expense Type</Text>
            <TouchableOpacity 
              style={styles.categoryPicker}
              onPress={() => setShowExpenseTypePicker(true)}
            >
              <Text style={styles.pickerText}>{expenseType}</Text>
              <ChevronDown size={16} color="#6B7280" />
            </TouchableOpacity>

            {expenseType === 'Subcontractor' && (
              <>
                <Text style={styles.label}>Category</Text>
                <TouchableOpacity 
                  style={styles.categoryPicker}
                  onPress={() => setShowSubcategoryPicker(true)}
                >
                  <Text style={styles.pickerText}>{category}</Text>
                  <ChevronDown size={16} color="#6B7280" />
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="138"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Store/Invoice</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter store or invoice details"
              placeholderTextColor="#9CA3AF"
              value={store}
              onChangeText={setStore}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          {user?.role === 'admin' && (
            <View style={styles.expensesList}>
              <Text style={styles.sectionTitle}>Recent Expenses</Text>
              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No expenses recorded for this project</Text>
                </View>
              ) : (
                filteredExpenses.map((expense) => (
                  <View key={expense.id} style={styles.expenseCard}>
                    <View style={styles.expenseHeader}>
                      <View style={styles.expenseInfo}>
                        <View>
                          <Text style={styles.expenseType}>{expense.type}</Text>
                          {expense.subcategory && expense.subcategory !== expense.type && (
                            <Text style={styles.expenseSubcategory}>{expense.subcategory}</Text>
                          )}
                        </View>
                        {expense.receiptUrl && (
                          <View style={styles.receiptBadge}>
                            <ImageIcon size={12} color="#10B981" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.expenseStore}>{expense.store}</Text>
                    <Text style={styles.expenseDate}>{new Date(expense.date).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        <Modal
          visible={showExpenseTypePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowExpenseTypePicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowExpenseTypePicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Expense Type</Text>
                <TouchableOpacity onPress={() => setShowExpenseTypePicker(false)}>
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.categoryList}>
                {['Subcontractor', 'Labor', 'Material', 'Office', 'Others'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      expenseType === type && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setExpenseType(type);
                      setShowExpenseTypePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        expenseType === type && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showSubcategoryPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSubcategoryPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSubcategoryPicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowSubcategoryPicker(false)}>
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
              <View style={styles.customCategoryInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Or type custom category..."
                  placeholderTextColor="#9CA3AF"
                  value={customCategory}
                  onChangeText={setCustomCategory}
                />
                {customCategory.trim() !== '' && (
                  <TouchableOpacity
                    style={styles.addCustomButton}
                    onPress={() => {
                      setCategory(customCategory.trim());
                      setCustomCategory('');
                      setShowSubcategoryPicker(false);
                    }}
                  >
                    <Text style={styles.addCustomButtonText}>Add &quot;{customCategory.trim()}&quot;</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.categoryList}>
                {priceListCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerOption,
                      category === cat && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setCustomCategory('');
                      setShowSubcategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        category === cat && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {isScanning && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Processing receipt...</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
  },
  form: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  categoryPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  pickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 20,
    padding: 6,
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
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  expensesList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  expenseCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
    color: '#2563EB',
  },
  expenseSubcategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptBadge: {
    backgroundColor: '#D1FAE5',
    padding: 4,
    borderRadius: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
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
    maxHeight: '80%',
  },
  categoryList: {
    maxHeight: 400,
  },
  customCategoryInput: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  addCustomButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  pickerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  pickerOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600' as const,
  },
  filePreview: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 12,
    color: '#6B7280',
  },
  removeFileButton: {
    padding: 8,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
});
