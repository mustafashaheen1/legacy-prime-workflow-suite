import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
// priceListCategories now comes from AppContext
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File } from 'lucide-react-native';
import { generateImageHash, generateOCRFingerprint, getBase64ByteSize } from '@/lib/receipt-duplicate-detection';
import UploaderBadge from '@/components/UploaderBadge';

export default function ExpensesScreen() {
  const { expenses, addExpense, projects, user, refreshExpenses, priceListCategories } = useApp();
  const [expenseType, setExpenseType] = useState<string>('Subcontractor');
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '1');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'image' | 'file' | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showProjectPicker, setShowProjectPicker] = useState<boolean>(false);
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState<boolean>(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);

  // Reload expenses when component mounts
  useEffect(() => {
    refreshExpenses();
  }, [refreshExpenses]);

  // Set first category when loaded
  useEffect(() => {
    if (priceListCategories.length > 0 && !category) {
      setCategory(priceListCategories[0]);
    }
  }, [priceListCategories, category]);

  // Clear validation error when user changes any field
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
  }, [amount, store, expenseType, category]);

  const activeProjects = useMemo(() =>
    projects.filter(p => p.status === 'active'),
    [projects]
  );

  const filteredExpenses = useMemo(() =>
    expenses.filter(e => e.projectId === selectedProjectId),
    [expenses, selectedProjectId]
  );

  const projectExpenseTotal = useMemo(() => 
    filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Check for duplicate receipts
  const checkForDuplicates = async (imageBase64: string, ocrData: any) => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

      const response = await fetch(`${apiUrl}/api/check-duplicate-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.companyId,
          projectId: selectedProjectId,
          imageBase64,
          ocrData: {
            store: ocrData.store,
            amount: ocrData.amount,
            date: ocrData.date,
          },
        }),
      });

      if (!response.ok) {
        console.error('[DuplicateCheck] API error:', response.status);
        // If check fails, allow creation (fail open)
        return { isDuplicate: false, canOverride: true };
      }

      return await response.json();
    } catch (error) {
      console.error('[DuplicateCheck] Error checking for duplicates:', error);
      // If check fails, allow creation (fail open)
      return { isDuplicate: false, canOverride: true };
    }
  };

  const handleSave = async () => {
    setValidationError('');

    const missingFields: string[] = [];

    if (!expenseType) {
      missingFields.push('Expense Type');
    }

    if (expenseType === 'Subcontractor' && !category) {
      missingFields.push('Category');
    }

    if (!amount || amount.trim() === '') {
      missingFields.push('Amount');
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setValidationError('Please enter a valid amount greater than 0');
      return;
    }

    if (!store || store.trim() === '') {
      missingFields.push('Store/Invoice');
    }

    if (!selectedProjectId) {
      missingFields.push('Project');
    }

    if (missingFields.length > 0) {
      setValidationError(`Please fill out all required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      // Generate duplicate detection fields if we have receipt data
      const imageHash = receiptBase64
        ? await generateImageHash(receiptBase64)
        : undefined;

      const ocrFingerprint = store && amount
        ? generateOCRFingerprint(store, parseFloat(amount), new Date().toISOString())
        : undefined;

      const imageSizeBytes = receiptBase64
        ? getBase64ByteSize(receiptBase64)
        : undefined;

      await addExpense({
        id: Date.now().toString(),
        projectId: selectedProjectId,
        type: expenseType,
        subcategory: expenseType === 'Subcontractor' ? category : expenseType,
        amount: parseFloat(amount),
        store,
        date: new Date().toISOString(),
        receiptUrl: receiptImage || undefined,
        imageHash,
        ocrFingerprint,
        imageSizeBytes,
      });

      // Refresh expenses from database to ensure UI is in sync
      await refreshExpenses();

      setAmount('');
      setStore('');
      setReceiptImage(null);
      setReceiptType(null);
      setReceiptFileName(null);
      setReceiptBase64(null);
      setOcrData(null);
      setValidationError('');

      // Show success message
      if (Platform.OS === 'web') {
        window.alert('Expense added successfully!');
      } else {
        Alert.alert('Success', 'Expense added successfully!');
      }
    } catch (error: any) {
      console.error('Error adding expense:', error);

      // Show user-friendly error message
      let errorMessage = error.message || 'Failed to add expense';
      if (errorMessage.includes('Duplicate receipt')) {
        errorMessage = 'This receipt has already been added to your expenses. Please use a different receipt.';
      }

      setValidationError(errorMessage);

      // Also show alert for visibility
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
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

      console.log('[OCR] Initial image data length:', imageData.length);
      console.log('[OCR] Image data format:', imageData.substring(0, 50));

      if (!imageData || imageData.length < 100) {
        throw new Error('Invalid image data - image is too small or corrupted');
      }

      // Compress image if it's too large (> 8MB to leave room for JSON overhead)
      if (imageData.length > 8 * 1024 * 1024) {
        console.log('[OCR] Image too large, compressing...');
        try {
          // Create an image element
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageData;
          });

          // Calculate new dimensions (max 1920px width while maintaining aspect ratio)
          let width = img.width;
          let height = img.height;
          const maxWidth = 1920;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 with quality reduction
          imageData = canvas.toDataURL('image/jpeg', 0.7);
          console.log('[OCR] Compressed image data length:', imageData.length);
        } catch (compressError) {
          console.error('[OCR] Error compressing image:', compressError);
          throw new Error('Failed to compress image');
        }
      }

      console.log('[OCR] Sending request to API...');

      // Call the API endpoint instead of using SDK
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
      const apiResponse = await fetch(`${apiUrl}/api/analyze-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          categories: priceListCategories,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const apiResult = await apiResponse.json();
      console.log('[OCR] API Response:', apiResult);

      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Failed to analyze receipt');
      }

      const result = apiResult.data;

      // Store base64 and OCR data for duplicate detection
      setReceiptBase64(imageData);
      setOcrData(result);

      // Check for duplicates before auto-filling
      console.log('[OCR] Checking for duplicates...');
      const duplicateCheck = await checkForDuplicates(imageData, result);

      if (duplicateCheck.isDuplicate) {
        if (!duplicateCheck.canOverride) {
          // Exact duplicate - block
          const blockMessage = 'This receipt has already been added to your expenses. You cannot add the same receipt image twice.';
          if (Platform.OS === 'web') {
            window.alert(blockMessage);
          } else {
            Alert.alert('Duplicate Receipt', blockMessage);
          }
          setReceiptImage(null);
          setReceiptType(null);
          setReceiptBase64(null);
          setOcrData(null);
          return;
        } else {
          // Similar receipt - show warning
          if (Platform.OS === 'web') {
            const proceed = window.confirm(`${duplicateCheck.message}\n\nDo you want to add this expense anyway?`);
            if (!proceed) {
              setReceiptImage(null);
              setReceiptType(null);
              setReceiptBase64(null);
              setOcrData(null);
              return;
            }
            // User chose to proceed - continue with auto-fill below
          } else {
            Alert.alert(
              'Possible Duplicate Receipt',
              `${duplicateCheck.message}\n\nDo you want to add this expense anyway?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setReceiptImage(null);
                    setReceiptType(null);
                    setReceiptBase64(null);
                    setOcrData(null);
                  },
                },
                {
                  text: 'Add Anyway',
                  onPress: () => {
                    // Continue with auto-fill
                    if (result.store) setStore(result.store);
                    if (result.amount) {
                      setAmount(result.amount.toFixed(2));
                    }
                    if (result.category && priceListCategories.includes(result.category)) {
                      setCategory(result.category);
                    }
                  },
                },
              ]
            );
            return;
          }
        }
      }

      // No duplicate, continue normally
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
        if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Expenses</Text>
            {selectedProject && (
              <Text style={styles.subtitle}>{selectedProject.name}</Text>
            )}
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

        <TouchableOpacity 
          style={styles.projectSelector}
          onPress={() => setShowProjectPicker(true)}
        >
          <View>
            <Text style={styles.projectSelectorLabel}>Project</Text>
            <Text style={styles.projectSelectorValue}>
              {selectedProject?.name || 'Select Project'}
            </Text>
          </View>
          <ChevronDown size={20} color="#6B7280" />
        </TouchableOpacity>



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

          {validationError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.expensesList}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No expenses recorded for this project</Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => (
              <View key={expense.id} style={styles.expenseCard}>
                {/* 🎯 PHASE 5: Show uploader at top of card */}
                {expense.uploader && (
                  <View style={styles.uploaderSection}>
                    <UploaderBadge uploader={expense.uploader} size="small" showName={true} />
                    <Text style={styles.uploadDate}>
                      {new Date(expense.date).toLocaleDateString()}
                    </Text>
                  </View>
                )}

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
                {!expense.uploader && (
                  <Text style={styles.expenseDate}>{new Date(expense.date).toLocaleDateString()}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showProjectPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProjectPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Project</Text>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {activeProjects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.pickerOption,
                    selectedProjectId === project.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedProjectId(project.id);
                    setShowProjectPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedProjectId === project.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
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
  projectSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  projectSelectorLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  projectSelectorValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
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
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // 🎯 PHASE 5: Uploader section styles
  uploaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  uploadDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
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
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
