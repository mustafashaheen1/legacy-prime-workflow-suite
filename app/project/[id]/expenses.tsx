import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
// priceListCategories now comes from AppContext
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { ArrowLeft, X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File, Check, Edit3, Clock, Info } from 'lucide-react-native';
import { generateImageHash, generateOCRFingerprint, getBase64ByteSize } from '@/lib/receipt-duplicate-detection';

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
  const { expenses, addExpense, projects, user, company, priceListCategories } = useApp();
  const [expenseType, setExpenseType] = useState<string>('Subcontractor');
  const [category, setCategory] = useState<string>('');
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

  // Receipt viewer state
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState<boolean>(false);

  // Duplicate detection state
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<any>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState<boolean>(false);
  const [pendingExpenseData, setPendingExpenseData] = useState<any>(null);

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

  // Set first category when loaded
  useEffect(() => {
    if (priceListCategories.length > 0 && !category) {
      setCategory(priceListCategories[0]);
    }
  }, [priceListCategories, category]);

  // Upload file to S3 using presigned URL (handles large files like PDFs)
  const uploadToS3 = async (fileData: string | Blob, fileName: string, fileType: string): Promise<string> => {
    console.log('[S3] Uploading receipt to S3 using presigned URL...');

    const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

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

    // Step 2: Convert base64 to Blob if needed
    let uploadData: Blob;
    if (typeof fileData === 'string') {
      // It's base64 data
      const base64Content = fileData.replace(/^data:.+;base64,/, '');
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      uploadData = new Blob([byteArray], { type: fileType });
    } else {
      uploadData = fileData;
    }

    // Step 3: Upload directly to S3 using presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: uploadData,
      headers: {
        'Content-Type': fileType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    console.log('[S3] Upload successful:', fileUrl);
    return fileUrl;
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
    console.log('[OpenAI] Has error field:', !!result.error, 'Error value:', result.error);

    // Check if the API returned an error message (even with success: true)
    // This happens when OpenAI couldn't parse the image properly
    if (result.error) {
      console.log('[OpenAI] Returning isValidReceipt: false due to error field');
      return {
        data: null,
        isValidReceipt: false,
        message: result.error || 'Could not analyze this image. Please upload a photo of a receipt or invoice.',
      };
    }

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

  // Check for duplicate receipts
  const checkForDuplicates = async (imageBase64: string, ocrData: any) => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');

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

      // Generate duplicate detection fields
      const imageHash = extractedExpense.imageBase64
        ? await generateImageHash(extractedExpense.imageBase64)
        : undefined;

      const ocrFingerprint = modalStore && modalAmount
        ? generateOCRFingerprint(modalStore, parseFloat(modalAmount), extractedExpense.date || new Date().toISOString())
        : undefined;

      const imageSizeBytes = extractedExpense.imageBase64
        ? getBase64ByteSize(extractedExpense.imageBase64)
        : undefined;

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
        imageHash,
        ocrFingerprint,
        imageSizeBytes,
      });

      console.log('[Expenses] Expense saved from modal successfully');

      // Close modal and reset state
      setShowConfirmModal(false);
      setExtractedExpense(null);
      setEditingInModal(false);
      setModalStore('');
      setModalAmount('');
      setModalCategory('');

      if (Platform.OS === 'web') {
        window.alert('Expense saved successfully!');
      } else {
        Alert.alert('Success', 'Expense saved successfully!');
      }
    } catch (error: any) {
      console.error('[Expenses] Error saving expense from modal:', error);

      // Show user-friendly error message
      let errorMessage = error.message || 'Failed to save expense';
      if (errorMessage.includes('Duplicate receipt')) {
        errorMessage = 'This receipt has already been added to your expenses. Please use a different receipt.';
      }

      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
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
        // Check for duplicates
        setScanningMessage('Checking for duplicates...');
        const duplicateCheck = await checkForDuplicates(imageData, result.data);

        if (duplicateCheck.isDuplicate) {
          if (!duplicateCheck.canOverride) {
            // Exact duplicate - block
            setIsScanning(false);
            Alert.alert('Duplicate Receipt', duplicateCheck.message);
            return;
          } else {
            // Similar receipt - show warning modal
            setDuplicateCheckResult(duplicateCheck);
            setPendingExpenseData({ imageUri: uri, imageData, extractedData: result.data });
            setIsScanning(false);
            setShowDuplicateWarning(true);
            return;
          }
        }

        // No duplicate, continue normally
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
        console.log('[Receipt] Analysis failed, showing alert:', result.message);
        if (Platform.OS === 'web') {
          window.alert(result.message || 'Could not extract expense information from this image. Please upload a photo of a receipt or invoice.');
        } else {
          Alert.alert(
            'Not a Receipt',
            result.message || 'Could not extract expense information from this image. Please upload a photo of a receipt or invoice.',
            [{ text: 'OK' }]
          );
        }
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

              {/* Info message for labor expenses */}
              {filteredExpenses.some(exp => exp.type === 'Labor' && exp.clockEntryId) && (
                <View style={styles.infoBox}>
                  <Info size={16} color="#3B82F6" />
                  <Text style={styles.infoText}>
                    Labor expenses are automatically created when employees clock out. To modify, adjust the clock entry or employee's hourly rate.
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
                    <View key={expense.id} style={styles.expenseCard}>
                      {/* 🎯 CLIENT DESIGN: Avatar + Name + Amount on first row */}
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
                          {expense.receiptUrl && (
                            <TouchableOpacity
                              style={styles.receiptBadge}
                              onPress={() => handleViewReceipt(expense.receiptUrl!)}
                            >
                              <ImageIcon size={12} color="#10B981" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                      </View>
                      <Text style={styles.expenseStore}>{expense.store}</Text>
                      <Text style={styles.expenseDate}>{new Date(expense.date).toLocaleDateString()}</Text>
                    </View>
                  );
                })
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

        {/* Duplicate Warning Modal */}
        <Modal
          visible={showDuplicateWarning}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDuplicateWarning(false)}
        >
          <View style={styles.confirmModalOverlay}>
            <View style={styles.confirmModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Possible Duplicate Receipt</Text>
                <TouchableOpacity onPress={() => {
                  setShowDuplicateWarning(false);
                  setDuplicateCheckResult(null);
                  setPendingExpenseData(null);
                }}>
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.confirmModalBody}>
                <View style={styles.duplicateWarningBox}>
                  <Text style={styles.duplicateWarningText}>
                    {duplicateCheckResult?.message}
                  </Text>
                </View>

                {duplicateCheckResult?.matchedExpense && (
                  <View style={styles.matchedExpenseBox}>
                    <Text style={styles.matchedExpenseTitle}>Previous Expense:</Text>
                    <View style={styles.matchedExpenseRow}>
                      <Text style={styles.matchedExpenseLabel}>Store:</Text>
                      <Text style={styles.matchedExpenseValue}>{duplicateCheckResult.matchedExpense.store}</Text>
                    </View>
                    <View style={styles.matchedExpenseRow}>
                      <Text style={styles.matchedExpenseLabel}>Amount:</Text>
                      <Text style={styles.matchedExpenseValue}>${duplicateCheckResult.matchedExpense.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.matchedExpenseRow}>
                      <Text style={styles.matchedExpenseLabel}>Date:</Text>
                      <Text style={styles.matchedExpenseValue}>
                        {new Date(duplicateCheckResult.matchedExpense.date).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.duplicateQuestionText}>
                  Do you want to add this expense anyway?
                </Text>
              </ScrollView>

              <View style={styles.confirmModalButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setShowDuplicateWarning(false);
                    setDuplicateCheckResult(null);
                    setPendingExpenseData(null);
                  }}
                >
                  <Text style={styles.editButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmSaveButton}
                  onPress={() => {
                    // Proceed with confirmation flow
                    setShowDuplicateWarning(false);
                    if (pendingExpenseData) {
                      const { extractedData, imageUri, imageData } = pendingExpenseData;
                      extractedData.imageUri = imageUri;
                      extractedData.imageBase64 = imageData;
                      setExtractedExpense(extractedData);
                      setModalStore(extractedData.store || '');
                      setModalAmount(extractedData.amount ? extractedData.amount.toFixed(2) : '');
                      setModalCategory(extractedData.category || priceListCategories[0]);
                      setEditingInModal(false);
                      setShowConfirmModal(true);
                    }
                    setDuplicateCheckResult(null);
                    setPendingExpenseData(null);
                  }}
                >
                  <Text style={styles.confirmSaveButtonText}>Add Anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // 🎯 CLIENT DESIGN: Uploader styles
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
  // Duplicate Warning Styles
  duplicateWarningBox: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  duplicateWarningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  matchedExpenseBox: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  matchedExpenseTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  matchedExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchedExpenseLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  matchedExpenseValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  duplicateQuestionText: {
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
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
});
