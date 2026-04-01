import { ActivityIndicator, Alert, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
// priceListCategories now comes from AppContext
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { ArrowLeft, X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File, Clock, Info } from 'lucide-react-native';
import { generateImageHash, generateOCRFingerprint, getBase64ByteSize } from '@/lib/receipt-duplicate-detection';
import DocumentScannerModal, { DocumentScanResult } from '@/components/DocumentScannerModal';

export default function ProjectExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { expenses, addExpense, projects, user, company, priceListCategories, refreshExpenses } = useApp();
  const [expenseType, setExpenseType] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'image' | 'file' | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanningMessage] = useState<string>('Processing...');
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState<boolean>(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');

  const [showDocumentScanner, setShowDocumentScanner] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);

  // Receipt viewer state
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState<boolean>(false);

  // Expense detail modal state
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState<boolean>(false);

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

  // Refresh expenses on mount so admin always sees the latest data from all users
  useEffect(() => {
    refreshExpenses();
  }, []);

  // Set first category when Subcontractor type is selected and category is empty
  useEffect(() => {
    if (expenseType === 'Subcontractor' && priceListCategories.length > 0 && !category) {
      setCategory(priceListCategories[0]);
    }
  }, [expenseType, priceListCategories, category]);

  // Upload file to S3 using presigned URL (handles large files like PDFs)
  const uploadToS3 = async (fileData: string, fileName: string, fileType: string): Promise<string> => {
    console.log('[S3] Uploading receipt to S3 using presigned URL...');

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

    // Step 1: Get presigned URL from API
    const urlResponse = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: `receipts/${fileName}`,
        fileType,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { uploadUrl, fileUrl } = await urlResponse.json();
    console.log('[S3] Got presigned URL, uploading directly to S3...');

    if (Platform.OS !== 'web') {
      // React Native / Hermes: XHR with { uri } reads the file natively and sends
      // raw bytes — avoids "Creating blobs from ArrayBufferView not supported" error.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', fileType);
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`S3 upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error('S3 upload network error'));
        // { uri, type, name } is React Native's native file-upload pattern
        xhr.send({ uri: fileData, type: fileType, name: fileName } as any);
      });
    } else {
      // Web: Blob is supported — decode base64 and upload via fetch
      const base64Content = fileData.replace(/^data:.+;base64,/, '');
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType });
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': fileType },
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to S3');
      }
    }

    console.log('[S3] Upload successful:', fileUrl);
    return fileUrl;
  };

  // Check for duplicate receipts
  const checkForDuplicates = async (imageBase64: string, ocrData: any) => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

      const response = await fetch(`${apiUrl}/api/check-duplicate-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company?.id,
          projectId: id,
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

  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

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

    if (missingFields.length > 0) {
      setValidationError(`Please fill out all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSavingManual(true);

    try {
      console.log('[Expenses] Saving expense:', { amount, store, type: expenseType });

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

      let receiptUrl: string | undefined;

      // Upload receipt to S3 if present
      if (receiptImage) {
        try {
          console.log('[Expenses] Uploading receipt to S3...');

          const isPdf = receiptType === 'file' || receiptImage.includes('.pdf') || receiptImage.includes('application/pdf');
          const fileType = isPdf ? 'application/pdf' : 'image/jpeg';
          const fileName = isPdf
            ? (receiptFileName || `receipt-${Date.now()}.pdf`)
            : `receipt-${Date.now()}.jpg`;

          if (Platform.OS !== 'web') {
            receiptUrl = await uploadToS3(receiptImage, fileName, fileType);
          } else {
            let base64Data: string;
            if (isPdf) {
              const response = await fetch(receiptImage);
              const blob = await response.blob();
              base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } else {
              base64Data = receiptBase64 ?? await convertToBase64(receiptImage);
            }
            receiptUrl = await uploadToS3(base64Data, fileName, fileType);
          }
          console.log('[Expenses] Receipt uploaded to S3:', receiptUrl);
        } catch (uploadError) {
          console.error('[Expenses] S3 upload failed, continuing without receipt URL:', uploadError);
        }
      }

      addExpense({
        id: Date.now().toString(),
        projectId: id as string,
        type: expenseType,
        subcategory: expenseType === 'Subcontractor' ? category : expenseType,
        amount: parseFloat(amount),
        store,
        date: new Date().toISOString(),
        receiptUrl,
        imageHash,
        ocrFingerprint,
        imageSizeBytes,
      });

      await refreshExpenses();

      console.log('[Expenses] Expense saved successfully');

      setAmount('');
      setStore('');
      setExpenseType('');
      setCategory('');
      setReceiptImage(null);
      setReceiptType(null);
      setReceiptFileName(null);
      setReceiptBase64(null);
      setValidationError('');

      if (Platform.OS === 'web') {
        window.alert('Expense added successfully!');
      } else {
        Alert.alert('Success', 'Expense added successfully!');
      }
    } catch (error: any) {
      console.error('[Expenses] Error saving expense:', error);
      let errorMessage = error.message || 'Failed to save expense';
      if (errorMessage.includes('Duplicate receipt')) {
        errorMessage = 'This receipt has already been added to your expenses. Please use a different receipt.';
      }
      setValidationError(errorMessage);
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsSavingManual(false);
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

  // Process receipt — inline-fill version (no confirmation modal)
  const processReceipt = async (uri: string, preExtractedBase64?: string) => {
    try {
      setIsScanning(true);
      setReceiptImage(uri);
      setReceiptType('image');

      console.log('[OCR] Processing receipt image...');

      let imageData = uri;

      if (preExtractedBase64) {
        imageData = `data:image/jpeg;base64,${preExtractedBase64}`;
        console.log('[OCR] Using pre-extracted base64 from scanner');
      } else if (Platform.OS !== 'web' && uri.startsWith('file://')) {
        console.log('[OCR] Reading local file as base64...');
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64' as any,
          });
          const mimeType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
          imageData = `data:${mimeType};base64,${base64}`;
        } catch (conversionError) {
          console.error('[OCR] Error converting image:', conversionError);
          throw new Error('Failed to convert image to base64');
        }
      } else if (Platform.OS === 'web' && !uri.startsWith('data:')) {
        console.log('[OCR] Converting web image to base64...');
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (conversionError) {
          console.error('[OCR] Error converting image:', conversionError);
          throw new Error('Failed to convert image to base64');
        }
      }

      if (!imageData || imageData.length < 100) {
        throw new Error('Invalid image data - image is too small or corrupted');
      }

      // Compress if too large
      if (imageData.length > 8 * 1024 * 1024) {
        console.log('[OCR] Image too large, compressing...');
        try {
          const recompressed = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          imageData = `data:image/jpeg;base64,${recompressed.base64 ?? ''}`;
          console.log('[OCR] Re-compressed image');
        } catch (compressErr) {
          console.warn('[OCR] Re-compression failed, proceeding with original:', compressErr);
        }
      }

      console.log('[OCR] Sending request to API...');

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
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

      // Store base64 for duplicate detection
      setReceiptBase64(imageData);

      // Check for duplicates before auto-filling
      const duplicateCheck = await checkForDuplicates(imageData, result);

      if (duplicateCheck.isDuplicate) {
        if (!duplicateCheck.canOverride) {
          const blockMessage = 'This receipt has already been added to your expenses. You cannot add the same receipt image twice.';
          if (Platform.OS === 'web') {
            window.alert(blockMessage);
          } else {
            Alert.alert('Duplicate Receipt', blockMessage);
          }
          setReceiptImage(null);
          setReceiptType(null);
          setReceiptBase64(null);
          return;
        } else {
          if (Platform.OS === 'web') {
            const proceed = window.confirm(`${duplicateCheck.message}\n\nDo you want to add this expense anyway?`);
            if (!proceed) {
              setReceiptImage(null);
              setReceiptType(null);
              setReceiptBase64(null);
              return;
            }
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
                  },
                },
                {
                  text: 'Add Anyway',
                  onPress: () => {
                    if (result.store) setStore(result.store);
                    if (result.amount) setAmount(result.amount.toFixed(2));
                    if (result.category && priceListCategories.includes(result.category)) setCategory(result.category);
                  },
                },
              ]
            );
            return;
          }
        }
      }

      // No duplicate — auto-fill the form inline
      if (result.store) setStore(result.store);
      if (result.amount) setAmount(result.amount.toFixed(2));
      if (result.category && priceListCategories.includes(result.category)) setCategory(result.category);

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

      Alert.alert('Processing Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsScanning(false);
    }
  };

  // Button 1: Scan Receipt (Document Scanner)
  const handleScanReceipt = () => {
    setShowDocumentScanner(true);
  };

  const handleDocScanCapture = async (result: DocumentScanResult) => {
    setShowDocumentScanner(false);
    await processReceipt(result.uri, result.base64 || undefined);
  };

  // Button 2: Receipt (same as scan)
  const handleReceiptButton = () => {
    handleScanReceipt();
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
        await processReceipt(file.uri);
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

  // View receipt handler
  const handleViewReceipt = (receiptUrl: string) => {
    const isPdf = receiptUrl.toLowerCase().includes('.pdf');

    if (isPdf && Platform.OS === 'web') {
      // Open PDF in new tab on web
      window.open(receiptUrl, '_blank');
    } else {
      // Show image in modal
      setViewingReceiptUrl(receiptUrl);
      setShowReceiptViewer(true);
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

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <View style={styles.form}>
            {/* Prominent AI scanner — shown to all roles when no receipt captured yet */}
            {!receiptImage && (
              <>
                <TouchableOpacity style={styles.aiScannerBtn} onPress={handleScanReceipt}>
                  <Scan size={22} color="#FFFFFF" />
                  <Text style={styles.aiScannerBtnText}>Scan Receipt with AI</Text>
                </TouchableOpacity>
                <View style={styles.formDivider}>
                  <View style={styles.formDividerLine} />
                  <Text style={styles.formDividerText}>or enter manually</Text>
                  <View style={styles.formDividerLine} />
                </View>
              </>
            )}

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
              <Text style={[styles.pickerText, !expenseType && { color: '#9CA3AF' }]}>{expenseType || 'Select expense type...'}</Text>
              <ChevronDown size={16} color="#6B7280" />
            </TouchableOpacity>

            {expenseType === 'Subcontractor' && (
              <>
                <Text style={styles.label}>Category</Text>
                <TouchableOpacity
                  style={styles.categoryPicker}
                  onPress={() => setShowSubcategoryPicker(true)}
                >
                  <Text style={[styles.pickerText, !category && { color: '#9CA3AF' }]}>{category || 'Select category...'}</Text>
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

            {validationError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorInlineText}>{validationError}</Text>
              </View>
            ) : null}

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

              {/* Info message for labor expenses */}
              {filteredExpenses.some(exp => exp.type === 'Labor' && exp.clockEntryId) && (
                <View style={styles.infoBox}>
                  <Info size={16} color="#3B82F6" />
                  <Text style={styles.infoText}>
                    Labor expenses are auto-created when employees clock out. To modify, adjust the clock entry or hourly rate in the employee profile.
                  </Text>
                </View>
              )}

              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No expenses recorded for this project</Text>
                </View>
              ) : (
                filteredExpenses.map((expense) => {
                  const isLaborExpense = expense.type === 'Labor' && expense.clockEntryId;

                  return (
                    <TouchableOpacity
                      key={expense.id}
                      style={styles.expenseCard}
                      activeOpacity={0.75}
                      onPress={() => { setSelectedExpense(expense); setShowExpenseDetail(true); }}
                    >
                      {/* CLIENT DESIGN: Avatar + Name + Amount on first row */}
                      <View style={styles.expenseMainRow}>
                        {/* Left: Avatar + Name + Category */}
                        <View style={styles.expenseLeftSection}>
                          {expense.uploader ? (
                            expense.uploader.avatar ? (
                              <Image
                                source={{ uri: expense.uploader.avatar }}
                                style={styles.expenseAvatar}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.expenseAvatarPlaceholder}>
                                <Text style={styles.expenseAvatarInitials}>
                                  {expense.uploader.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </Text>
                              </View>
                            )
                          ) : (
                            <View style={styles.expenseAvatarPlaceholder}>
                              <Text style={styles.expenseAvatarInitials}>?</Text>
                            </View>
                          )}

                          <View style={styles.expenseNameSection}>
                            <Text style={styles.expenseUploaderName}>
                              {expense.uploader ? expense.uploader.name : 'Unknown'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.expenseType}>{expense.type}</Text>
                              {isLaborExpense && (
                                <View style={styles.laborBadge}>
                                  <Clock size={12} color="#8B5CF6" />
                                  <Text style={styles.laborBadgeText}>Auto</Text>
                                </View>
                              )}
                            </View>
                            {expense.subcategory && expense.subcategory !== expense.type && (
                              <Text style={styles.expenseSubcategory}>{expense.subcategory}</Text>
                            )}
                            {expense.notes && isLaborExpense && (
                              <Text style={styles.expenseNotes}>{expense.notes}</Text>
                            )}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                        </View>
                      </View>
                      <Text style={styles.expenseStore}>{expense.store}</Text>
                      <Text style={styles.expenseDate}>{new Date(expense.date).toLocaleDateString()}</Text>

                      {/* Inline receipt image/PDF — admin sees actual receipt (skip ephemeral blob: URLs) */}
                      {expense.receiptUrl && !expense.receiptUrl.startsWith('blob:') && !expense.receiptUrl.toLowerCase().includes('.pdf') && (
                        <TouchableOpacity
                          style={styles.receiptThumb}
                          onPress={() => handleViewReceipt(expense.receiptUrl!)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: expense.receiptUrl }}
                            style={styles.receiptThumbImage}
                            contentFit="cover"
                          />
                          <View style={styles.receiptThumbOverlay}>
                            <ImageIcon size={13} color="#FFFFFF" />
                            <Text style={styles.receiptThumbText}>Tap to view</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {expense.receiptUrl && !expense.receiptUrl.startsWith('blob:') && expense.receiptUrl.toLowerCase().includes('.pdf') && (
                        <TouchableOpacity
                          style={styles.pdfReceiptBadge}
                          onPress={() => handleViewReceipt(expense.receiptUrl!)}
                        >
                          <File size={14} color="#DC2626" />
                          <Text style={styles.pdfReceiptBadgeText}>PDF Receipt — Tap to open</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* Employee view: uploader name + amount only — no receipt images */}
          {user?.role !== 'admin' && user?.role !== 'super-admin' && (
            <View style={styles.expensesList}>
              <View style={styles.employeeTotalCard}>
                <Text style={styles.employeeTotalLabel}>Project Total</Text>
                <Text style={styles.employeeTotalAmount}>${projectExpenseTotal.toLocaleString()}</Text>
              </View>

              <Text style={styles.sectionTitle}>Expenses</Text>

              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No expenses recorded for this project</Text>
                </View>
              ) : (
                filteredExpenses.map((expense) => (
                  <View key={expense.id} style={styles.expenseCard}>
                    <View style={styles.expenseMainRow}>
                      <View style={styles.expenseLeftSection}>
                        {expense.uploader?.avatar ? (
                          <Image
                            source={{ uri: expense.uploader.avatar }}
                            style={styles.expenseAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.expenseAvatarPlaceholder}>
                            <Text style={styles.expenseAvatarInitials}>
                              {expense.uploader
                                ? expense.uploader.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                                : '?'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.expenseUploaderName}>
                          {expense.uploader ? expense.uploader.name : 'Unknown'}
                        </Text>
                      </View>
                      <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                    </View>
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
              <ScrollView style={styles.categoryList}
          keyboardDismissMode="on-drag"
        >
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
              <ScrollView style={styles.categoryList}
          keyboardDismissMode="on-drag"
        >
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

        {/* Receipt Viewer Modal */}
        <Modal
          visible={showReceiptViewer}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReceiptViewer(false)}
        >
          <View style={styles.receiptViewerOverlay}>
            <View style={styles.receiptViewerContent}>
              <View style={styles.receiptViewerHeader}>
                <Text style={styles.receiptViewerTitle}>Receipt</Text>
                <TouchableOpacity
                  style={styles.receiptViewerClose}
                  onPress={() => setShowReceiptViewer(false)}
                >
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
              {viewingReceiptUrl && (
                viewingReceiptUrl.toLowerCase().includes('.pdf') ? (
                  <View style={styles.pdfViewerContainer}>
                    <File size={60} color="#2563EB" />
                    <Text style={styles.pdfViewerText}>PDF Document</Text>
                    <TouchableOpacity
                      style={styles.openPdfButton}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(viewingReceiptUrl, '_blank');
                        }
                        setShowReceiptViewer(false);
                      }}
                    >
                      <Text style={styles.openPdfButtonText}>Open PDF</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Image
                    source={{ uri: viewingReceiptUrl }}
                    style={styles.receiptViewerImage}
                    contentFit="contain"
                  />
                )
              )}
            </View>
          </View>
        </Modal>

        {/* Expense Detail Modal */}
        <Modal
          visible={showExpenseDetail}
          transparent
          animationType="slide"
          onRequestClose={() => setShowExpenseDetail(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
            <View style={styles.detailSheet}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Expense Details</Text>
                <TouchableOpacity onPress={() => setShowExpenseDetail(false)} style={styles.iconBtn}>
                  <X size={22} color="#1F2937" />
                </TouchableOpacity>
              </View>

              {selectedExpense && (
                <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
                  {/* Amount */}
                  <View style={styles.detailAmountRow}>
                    <Text style={styles.detailAmount}>${Number(selectedExpense.amount).toLocaleString()}</Text>
                    {selectedExpense.receiptUrl && (
                      <TouchableOpacity
                        style={styles.detailReceiptBtn}
                        onPress={() => { setShowExpenseDetail(false); handleViewReceipt(selectedExpense.receiptUrl!); }}
                      >
                        <ImageIcon size={14} color="#10B981" />
                        <Text style={styles.detailReceiptBtnText}>View Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Added by */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Added by</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {selectedExpense.uploader ? (
                        selectedExpense.uploader.avatar ? (
                          <Image source={{ uri: selectedExpense.uploader.avatar }} style={styles.detailAvatar} contentFit="cover" />
                        ) : (
                          <View style={[styles.detailAvatar, { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                              {selectedExpense.uploader.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </Text>
                          </View>
                        )
                      ) : null}
                      <Text style={styles.detailValue}>
                        {selectedExpense.uploader?.name ?? 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Store */}
                  {selectedExpense.store ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Store / Invoice</Text>
                      <Text style={styles.detailValue}>{selectedExpense.store}</Text>
                    </View>
                  ) : null}

                  {/* Date */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {selectedExpense.date ? new Date(selectedExpense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </Text>
                  </View>

                  {/* Type */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{selectedExpense.type}</Text>
                  </View>

                  {/* Category */}
                  {selectedExpense.subcategory && selectedExpense.subcategory !== selectedExpense.type ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category</Text>
                      <Text style={styles.detailValue}>{selectedExpense.subcategory}</Text>
                    </View>
                  ) : null}

                  {/* Notes */}
                  {selectedExpense.notes ? (
                    <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                      <Text style={styles.detailLabel}>Notes</Text>
                      <Text style={[styles.detailValue, { flex: 1 }]}>{selectedExpense.notes}</Text>
                    </View>
                  ) : null}

                  {/* Receipt image preview — skip blob: URLs (ephemeral web object URLs) */}
                  {selectedExpense.receiptUrl && !selectedExpense.receiptUrl.startsWith('blob:') && !selectedExpense.receiptUrl.toLowerCase().includes('.pdf') && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => { setShowExpenseDetail(false); handleViewReceipt(selectedExpense.receiptUrl!); }}
                    >
                      <Image
                        source={{ uri: selectedExpense.receiptUrl }}
                        style={styles.detailReceiptPreview}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 32 }} />
                </ScrollView>
              )}
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

        <DocumentScannerModal
          visible={showDocumentScanner}
          onCapture={handleDocScanCapture}
          onClose={() => setShowDocumentScanner(false)}
          title="Scan Receipt"
        />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // CLIENT DESIGN: Uploader styles
  expenseMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  expenseLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  expenseAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  expenseAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  expenseNameSection: {
    flex: 1,
  },
  expenseUploaderName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  receiptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  receiptText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500' as const,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseType: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: '#6B7280',
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  expenseSubcategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  expenseStore: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '400' as const,
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
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
  // Admin: inline receipt thumbnail
  receiptThumb: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden' as const,
    height: 120,
    width: '100%' as any,
    position: 'relative' as const,
  },
  receiptThumbImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
  receiptThumbOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  receiptThumbText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  pdfReceiptBadge: {
    marginTop: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  pdfReceiptBadgeText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500' as const,
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
  // Receipt Viewer Styles
  receiptViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptViewerContent: {
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  receiptViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  receiptViewerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  receiptViewerClose: {
    padding: 4,
  },
  receiptViewerImage: {
    width: '100%',
    height: 500,
  },
  pdfViewerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfViewerText: {
    fontSize: 16,
    color: '#6B7280',
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
    fontWeight: '600' as const,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  laborBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  laborBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#7C3AED',
  },
  expenseNotes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic' as const,
  },

  // Expense detail bottom sheet
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  detailHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  detailAmountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 20,
  },
  detailAmount: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  detailReceiptBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailReceiptBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  detailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
    textAlign: 'right' as const,
    flexShrink: 1,
  },
  detailAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  detailReceiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 20,
    backgroundColor: '#F3F4F6',
  },
  // AI scanner button + divider (shown in form body for all roles)
  aiScannerBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  aiScannerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  formDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    gap: 8,
  },
  formDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  formDividerText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  // Employee-only totals card
  employeeTotalCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  employeeTotalLabel: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600' as const,
  },
  employeeTotalAmount: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1D4ED8',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorInlineText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
