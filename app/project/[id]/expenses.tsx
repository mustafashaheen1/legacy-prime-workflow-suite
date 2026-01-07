import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { priceListCategories } from '@/mocks/priceList';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { ArrowLeft, X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File, Check, Edit3 } from 'lucide-react-native';

interface ExtractedExpense {
  store: string;
  amount: number;
  date: string;
  category: string;
  items: string;
  confidence: number;
  imageUri: string;
  imageBase64: string;
}

export default function ProjectExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { expenses, addExpense, projects, user, company } = useApp();
  const [expenseType, setExpenseType] = useState<string>('Subcontractor');
  const [category, setCategory] = useState<string>(priceListCategories[0]);
  const [amount, setAmount] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'image' | 'file' | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanningMessage, setScanningMessage] = useState<string>('Processing...');
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState<boolean>(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [extractedExpense, setExtractedExpense] = useState<ExtractedExpense | null>(null);
  const [editingInModal, setEditingInModal] = useState<boolean>(false);
  const [modalStore, setModalStore] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<string>('');
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);

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

  // Upload image to S3
  const uploadToS3 = async (base64Data: string, fileName: string, fileType: string): Promise<string> => {
    console.log('[S3] Uploading receipt to S3...');

    const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

    const response = await fetch(`${apiUrl}/api/upload-to-s3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: base64Data,
        fileName: `receipts/${Date.now()}-${fileName}`,
        fileType,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to upload to S3');
    }

    const result = await response.json();
    console.log('[S3] Upload successful:', result.url);
    return result.url;
  };

  // Analyze receipt with OpenAI
  const analyzeReceiptWithOpenAI = async (imageData: string): Promise<{ data: ExtractedExpense | null; isValidReceipt: boolean; message?: string }> => {
    console.log('[OpenAI] Analyzing receipt...');

    const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

    const response = await fetch(`${apiUrl}/api/analyze-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData,
        categories: priceListCategories,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to analyze receipt');
    }

    const result = await response.json();
    console.log('[OpenAI] Analysis result:', result);

    if (result.success && result.data) {
      const { store, amount, confidence } = result.data;

      // Check if this looks like a valid receipt
      // If confidence is very low or no store/amount found, it's probably not a receipt
      const hasStore = store && store.trim().length > 0;
      const hasAmount = amount && amount > 0;
      const hasGoodConfidence = confidence && confidence >= 20;

      if (!hasStore && !hasAmount) {
        return {
          data: null,
          isValidReceipt: false,
          message: 'This image does not appear to be a receipt or invoice. Please upload a photo of a receipt with visible store name and total amount.',
        };
      }

      if (!hasGoodConfidence && !hasAmount) {
        return {
          data: null,
          isValidReceipt: false,
          message: 'Could not identify this as a receipt. Please upload a clearer photo of a receipt or invoice.',
        };
      }

      return {
        data: {
          ...result.data,
          imageUri: '',
          imageBase64: imageData,
        },
        isValidReceipt: true,
      };
    }

    return {
      data: null,
      isValidReceipt: false,
      message: 'Failed to analyze the image. Please try again or enter details manually.',
    };
  };

  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const handleSave = async () => {
    if (!amount || !store) {
      Alert.alert('Missing Information', 'Please enter amount and store/invoice details.');
      return;
    }

    setIsSavingManual(true);

    try {
      console.log('[Expenses] Saving expense:', { amount, store, type: expenseType });

      let receiptUrl: string | undefined;

      // Upload receipt to S3 if present
      if (receiptImage) {
        try {
          console.log('[Expenses] Uploading receipt to S3...');

          // Determine file type
          const isPdf = receiptType === 'file' || receiptImage.includes('.pdf') || receiptImage.includes('application/pdf');
          const fileType = isPdf ? 'application/pdf' : 'image/jpeg';
          const fileName = isPdf
            ? (receiptFileName || `receipt-${Date.now()}.pdf`)
            : `receipt-${Date.now()}.jpg`;

          // Convert to base64
          let base64Data: string;
          if (isPdf) {
            // For PDFs, read directly
            if (Platform.OS !== 'web' && receiptImage.startsWith('file://')) {
              const base64 = await FileSystem.readAsStringAsync(receiptImage, {
                encoding: 'base64' as any,
              });
              base64Data = `data:application/pdf;base64,${base64}`;
            } else {
              const response = await fetch(receiptImage);
              const blob = await response.blob();
              base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          } else {
            // For images, use existing compression function
            base64Data = await convertToBase64(receiptImage);
          }

          receiptUrl = await uploadToS3(base64Data, fileName, fileType);
          console.log('[Expenses] Receipt uploaded to S3:', receiptUrl);
        } catch (uploadError) {
          console.error('[Expenses] S3 upload failed, continuing without receipt URL:', uploadError);
          // Continue without receipt URL if upload fails
        }
      }

      await addExpense({
        id: Date.now().toString(),
        projectId: id as string,
        type: expenseType,
        subcategory: expenseType === 'Subcontractor' ? category : expenseType,
        amount: parseFloat(amount),
        store,
        date: new Date().toISOString(),
        receiptUrl,
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
    } finally {
      setIsSavingManual(false);
    }
  };

  // Save expense from confirmation modal
  const handleSaveFromModal = async () => {
    if (!extractedExpense || !modalAmount || !modalStore) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsSavingExpense(true);

    try {
      // Upload receipt to S3
      let receiptUrl: string | undefined;

      if (extractedExpense.imageBase64) {
        setScanningMessage('Uploading receipt...');
        try {
          receiptUrl = await uploadToS3(
            extractedExpense.imageBase64,
            `receipt-${Date.now()}.jpg`,
            'image/jpeg'
          );
        } catch (uploadError) {
          console.error('[Expenses] S3 upload failed, continuing without receipt URL:', uploadError);
          // Continue without receipt URL if upload fails
        }
      }

      // Save the expense
      await addExpense({
        id: Date.now().toString(),
        projectId: id as string,
        type: 'Subcontractor',
        subcategory: modalCategory || priceListCategories[0],
        amount: parseFloat(modalAmount),
        store: modalStore,
        date: extractedExpense.date || new Date().toISOString(),
        receiptUrl,
      });

      console.log('[Expenses] Expense saved from modal successfully');

      // Close modal and reset state
      setShowConfirmModal(false);
      setExtractedExpense(null);
      setEditingInModal(false);
      setModalStore('');
      setModalAmount('');
      setModalCategory('');

      Alert.alert('Success', 'Expense saved successfully!');
    } catch (error: any) {
      console.error('[Expenses] Error saving expense from modal:', error);
      Alert.alert('Error', `Failed to save expense: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Compress image on web using canvas
  const compressImageOnWeb = async (uri: string, maxWidth: number = 1024, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        const base64 = canvas.toDataURL('image/jpeg', quality);
        console.log('[Image] Compressed from', img.width, 'x', img.height, 'to', width, 'x', height);
        console.log('[Image] Base64 length:', base64.length);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = uri;
    });
  };

  // Convert image URI to base64 with compression
  const convertToBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS !== 'web' && uri.startsWith('file://')) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    } else if (Platform.OS === 'web') {
      // On web, compress the image to reduce size
      try {
        // If it's a blob URL, convert to object URL first
        if (uri.startsWith('blob:')) {
          const compressed = await compressImageOnWeb(uri, 1024, 0.7);
          return compressed;
        } else if (!uri.startsWith('data:')) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const compressed = await compressImageOnWeb(objectUrl, 1024, 0.7);
          URL.revokeObjectURL(objectUrl);
          return compressed;
        } else {
          // Already a data URL, try to compress it
          const compressed = await compressImageOnWeb(uri, 1024, 0.7);
          return compressed;
        }
      } catch (error) {
        console.error('[Image] Compression failed, falling back to original:', error);
        // Fall back to original method if compression fails
        const response = await fetch(uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return base64;
      }
    }
    return uri;
  };

  // Process receipt (image or PDF)
  const processReceipt = async (uri: string, isPdf: boolean = false, fileName?: string) => {
    try {
      setIsScanning(true);
      setScanningMessage('Processing image...');

      console.log('[Receipt] Processing:', { uri: uri.substring(0, 50), isPdf, fileName });

      // Convert to base64
      setScanningMessage('Converting image...');
      let imageData: string;

      if (isPdf) {
        // For PDFs, we need to handle differently
        // OpenAI can analyze PDF images if we convert them
        if (Platform.OS !== 'web' && uri.startsWith('file://')) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64' as any,
          });
          imageData = `data:application/pdf;base64,${base64}`;
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        imageData = await convertToBase64(uri);
      }

      if (!imageData || imageData.length < 100) {
        throw new Error('Invalid file data');
      }

      // Analyze with OpenAI
      setScanningMessage('Analyzing with AI...');
      const result = await analyzeReceiptWithOpenAI(imageData);

      if (result.isValidReceipt && result.data) {
        // Set up modal data
        result.data.imageUri = uri;
        result.data.imageBase64 = imageData;

        setExtractedExpense(result.data);
        setModalStore(result.data.store || '');
        setModalAmount(result.data.amount ? result.data.amount.toFixed(2) : '');
        setModalCategory(result.data.category || priceListCategories[0]);
        setEditingInModal(false);
        setShowConfirmModal(true);
      } else {
        // Show user-friendly message explaining why analysis failed
        Alert.alert(
          'Not a Receipt',
          result.message || 'Could not extract expense information from this image. Please upload a photo of a receipt or invoice.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[Receipt] Processing error:', error);

      let errorMessage = 'Failed to process receipt. Please try again or enter details manually.';
      if (error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsScanning(false);
      setScanningMessage('Processing...');
    }
  };

  // Button 1: Scan Receipt (Camera)
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
      Alert.alert('Error', 'Failed to access camera. Please try again.');
    }
  };

  // Button 2: Receipt (also camera, same as scan)
  const handleReceiptButton = async () => {
    await handleScanReceipt();
  };

  // Button 3: Upload Receipt (Photo Library)
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
      Alert.alert('Error', 'Failed to access photo library. Please try again.');
    }
  };

  // Button 4: Upload File (PDF or Image)
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
      console.log('[File] Selected:', { name: file.name, type: file.mimeType });

      if (file.mimeType?.startsWith('image/')) {
        await processReceipt(file.uri, false, file.name);
      } else if (file.mimeType === 'application/pdf') {
        // PDFs cannot be analyzed by OpenAI Vision API directly
        // Set the PDF as receipt for manual entry immediately
        console.log('[File] Setting PDF receipt:', file.uri);
        setReceiptImage(file.uri);
        setReceiptType('file');
        setReceiptFileName(file.name || 'document.pdf');

        // Show informational alert
        Alert.alert(
          'PDF Uploaded',
          'PDF files cannot be analyzed automatically by AI. Please enter the expense details manually using the form below.',
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

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10B981';
    if (confidence >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
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
              onPress={handleReceiptButton}
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

            <TouchableOpacity
              style={[styles.saveButton, isSavingManual && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSavingManual}
            >
              {isSavingManual ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
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

        {/* Expense Type Picker Modal */}
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

        {/* Subcategory Picker Modal */}
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

        {/* Expense Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.confirmModalOverlay}>
            <View style={styles.confirmModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Expense</Text>
                <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.confirmModalBody}>
                {/* Receipt Preview */}
                {extractedExpense?.imageUri && (
                  <View style={styles.modalReceiptPreview}>
                    <Image
                      source={{ uri: extractedExpense.imageUri }}
                      style={styles.modalReceiptImage}
                      contentFit="cover"
                    />
                  </View>
                )}

                {/* Confidence Badge */}
                {extractedExpense && (
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(extractedExpense.confidence) + '20' }]}>
                    <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(extractedExpense.confidence) }]} />
                    <Text style={[styles.confidenceText, { color: getConfidenceColor(extractedExpense.confidence) }]}>
                      {getConfidenceLabel(extractedExpense.confidence)} Confidence ({extractedExpense.confidence}%)
                    </Text>
                    <TouchableOpacity onPress={() => setEditingInModal(!editingInModal)}>
                      <Edit3 size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Items Description */}
                {extractedExpense?.items && (
                  <View style={styles.itemsBox}>
                    <Text style={styles.itemsLabel}>Items Detected</Text>
                    <Text style={styles.itemsText}>{extractedExpense.items}</Text>
                  </View>
                )}

                {/* Form Fields */}
                <View style={styles.modalFormGroup}>
                  <Text style={styles.modalLabel}>Store/Vendor</Text>
                  {editingInModal ? (
                    <TextInput
                      style={styles.modalInput}
                      value={modalStore}
                      onChangeText={setModalStore}
                      placeholder="Enter store name"
                      placeholderTextColor="#9CA3AF"
                    />
                  ) : (
                    <Text style={styles.modalValue}>{modalStore || 'Not detected'}</Text>
                  )}
                </View>

                <View style={styles.modalFormGroup}>
                  <Text style={styles.modalLabel}>Amount</Text>
                  {editingInModal ? (
                    <TextInput
                      style={styles.modalInput}
                      value={modalAmount}
                      onChangeText={setModalAmount}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.modalValueLarge}>${modalAmount || '0.00'}</Text>
                  )}
                </View>

                <View style={styles.modalFormGroup}>
                  <Text style={styles.modalLabel}>Category</Text>
                  {editingInModal ? (
                    <TextInput
                      style={styles.modalInput}
                      value={modalCategory}
                      onChangeText={setModalCategory}
                      placeholder="Select category"
                      placeholderTextColor="#9CA3AF"
                    />
                  ) : (
                    <Text style={styles.modalValue}>{modalCategory || 'Not detected'}</Text>
                  )}
                </View>

                {extractedExpense?.date && (
                  <View style={styles.modalFormGroup}>
                    <Text style={styles.modalLabel}>Date</Text>
                    <Text style={styles.modalValue}>
                      {new Date(extractedExpense.date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.confirmModalButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditingInModal(!editingInModal)}
                >
                  <Edit3 size={18} color="#2563EB" />
                  <Text style={styles.editButtonText}>{editingInModal ? 'Done Editing' : 'Edit'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmSaveButton, isSavingExpense && styles.buttonDisabled]}
                  onPress={handleSaveFromModal}
                  disabled={isSavingExpense}
                >
                  {isSavingExpense ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.confirmSaveButtonText}>Save Expense</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Loading Overlay */}
        {isScanning && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>{scanningMessage}</Text>
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
  // Confirmation Modal Styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  confirmModalBody: {
    padding: 20,
    maxHeight: 500,
  },
  modalReceiptPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modalReceiptImage: {
    width: '100%',
    height: '100%',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  itemsBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemsText: {
    fontSize: 14,
    color: '#1F2937',
  },
  modalFormGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 6,
  },
  modalValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  modalValueLarge: {
    fontSize: 24,
    color: '#2563EB',
    fontWeight: '700' as const,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  confirmModalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  confirmSaveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
