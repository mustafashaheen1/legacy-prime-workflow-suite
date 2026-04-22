import { ActivityIndicator, Alert, Keyboard, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SkeletonBox from '@/components/SkeletonBox';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
// priceListCategories now comes from AppContext
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { X, Scan, Image as ImageIcon, ChevronDown, Receipt, Upload, File, Package, Wrench, Truck, HardHat, Fuel, Building, Shield, ShieldCheck, FileCheck, FileText, Layers, Car, Monitor, Paperclip, Zap, Phone, Megaphone, Check, Calculator, Scale, BadgeDollarSign, GraduationCap, Hammer, PlaneTakeoff, Coffee, Shirt, Trash2, Warehouse, MoreHorizontal, Info } from 'lucide-react-native';
import { generateImageHash, generateOCRFingerprint, getBase64ByteSize } from '@/lib/receipt-duplicate-detection';
import UploaderBadge from '@/components/UploaderBadge';
import DocumentScannerModal, { DocumentScanResult } from '@/components/DocumentScannerModal';

export default function ExpensesScreen() {
  const { expenses, addExpense, projects, user, refreshExpenses, priceListCategories, isLoading, isCompanyReloading } = useApp();
  const router = useRouter();

  // Field employees must submit expenses via their project screen, not this dashboard tab.
  useEffect(() => {
    if (user?.role === 'field-employee') {
      router.replace('/(tabs)/more' as any);
    }
  }, [user?.role]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshExpenses();
    setRefreshing(false);
  }, [refreshing, refreshExpenses]);
  const [expenseType, setExpenseType] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '1');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'image' | 'file' | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [showProjectPicker, setShowProjectPicker] = useState<boolean>(false);
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState<boolean>(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  const [serverImageHash, setServerImageHash] = useState<string | null>(null);
  const [showDocumentScanner, setShowDocumentScanner] = useState<boolean>(false);
  const [showWebScannerBanner, setShowWebScannerBanner] = useState<boolean>(false);
  const [isCompanyExpense, setIsCompanyExpense] = useState<boolean>(false);
  const [overheadCategory, setOverheadCategory] = useState<string>('');
  const [showOverheadPicker, setShowOverheadPicker] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);

  const OVERHEAD_CATEGORIES = ['Rent', 'Utilities', 'Insurance', 'Permits & Licenses', 'Office Supplies', 'Tools & Equipment', 'Vehicle & Fuel', 'Accounting & Legal', 'Marketing', 'Miscellaneous'];

  const EXPENSE_CATEGORIES = [
    { name: 'Materials', icon: Package, color: '#0D9488', bg: '#F0FDFA' },
    { name: 'Labor', icon: Wrench, color: '#7C3AED', bg: '#F5F3FF' },
    { name: 'Equipment', icon: Truck, color: '#D97706', bg: '#FFFBEB' },
    { name: 'Subcontractor', icon: HardHat, color: '#B45309', bg: '#FEF3C7' },
    { name: 'Gas / Fuel', icon: Fuel, color: '#DC2626', bg: '#FEF2F2' },
    { name: 'Office', icon: Building, color: '#2563EB', bg: '#EFF6FF' },
    { name: 'Insurance', icon: Shield, color: '#E11D48', bg: '#FFF1F2' },
    { name: 'Workers Comp', icon: ShieldCheck, color: '#DB2777', bg: '#FDF2F8' },
    { name: 'Bond', icon: FileCheck, color: '#6366F1', bg: '#EEF2FF' },
    { name: 'Permit', icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
    { name: 'Overhead', icon: Layers, color: '#7C3AED', bg: '#F5F3FF' },
    { name: 'Rent / Lease', icon: Building, color: '#4B5563', bg: '#F3F4F6' },
    { name: 'Vehicle / Car Payment', icon: Car, color: '#DC2626', bg: '#FEF2F2' },
    { name: 'Electronics / Tech', icon: Monitor, color: '#4B5563', bg: '#F3F4F6' },
    { name: 'Office Supplies', icon: Paperclip, color: '#059669', bg: '#ECFDF5' },
    { name: 'Utilities', icon: Zap, color: '#16A34A', bg: '#F0FDF4' },
    { name: 'Phone / Internet', icon: Phone, color: '#2563EB', bg: '#EFF6FF' },
    { name: 'Software / Subscriptions', icon: Monitor, color: '#2563EB', bg: '#EFF6FF' },
    { name: 'Marketing / Advertising', icon: Megaphone, color: '#E11D48', bg: '#FFF1F2' },
    { name: 'Accounting / CPA', icon: Calculator, color: '#0D9488', bg: '#F0FDFA' },
    { name: 'Legal Fee', icon: Scale, color: '#7C3AED', bg: '#F5F3FF' },
    { name: 'Payroll Taxes', icon: BadgeDollarSign, color: '#DC2626', bg: '#FEF2F2' },
    { name: 'Training / Certifications', icon: GraduationCap, color: '#2563EB', bg: '#EFF6FF' },
    { name: 'Tools', icon: Wrench, color: '#D97706', bg: '#FFFBEB' },
    { name: 'Maintenance / Repairs', icon: Hammer, color: '#B45309', bg: '#FEF3C7' },
    { name: 'Travel / Lodging', icon: PlaneTakeoff, color: '#6366F1', bg: '#EEF2FF' },
    { name: 'Meals / Coffee', icon: Coffee, color: '#059669', bg: '#ECFDF5' },
    { name: 'Uniform / Safety Gear', icon: Shirt, color: '#E11D48', bg: '#FFF1F2' },
    { name: 'Waste / Dumpster', icon: Trash2, color: '#4B5563', bg: '#F3F4F6' },
    { name: 'Storage', icon: Warehouse, color: '#0D9488', bg: '#F0FDFA' },
    { name: 'Miscellaneous', icon: MoreHorizontal, color: '#6B7280', bg: '#F3F4F6' },
  ];

  // Reload expenses when component mounts
  useEffect(() => {
    refreshExpenses();
  }, [refreshExpenses]);

  // Set first category when Subcontractor type is selected and category is empty
  useEffect(() => {
    if (expenseType === 'Subcontractor' && priceListCategories.length > 0 && !category) {
      setCategory(priceListCategories[0]);
    }
  }, [expenseType, priceListCategories, category]);

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

  const { companyExpense } = useLocalSearchParams<{ companyExpense?: string }>();

  // Pre-check Company/Office checkbox when navigated from Business Running Costs screen
  useEffect(() => {
    if (companyExpense === 'true') setIsCompanyExpense(true);
  }, [companyExpense]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.projectId === selectedProjectId);
  }, [expenses, selectedProjectId]);

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
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

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

    if (!category) {
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

    if (!isCompanyExpense && !selectedProjectId) {
      missingFields.push('Project');
    }

    if (missingFields.length > 0) {
      setValidationError(`Please fill out all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSaving(true);
    try {
      // Use server-computed hash (returned by check-duplicate-receipt) — consistent with what's queried on re-upload
      // Falls back to client-side hash only if duplicate check was never called (no receipt attached)
      const imageHash = serverImageHash || (receiptBase64 ? await generateImageHash(receiptBase64) : undefined);

      // Use OCR-extracted date so fingerprint matches what the server checks against
      const ocrDate = ocrData?.date
        ? new Date(ocrData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const ocrFingerprint = store && amount
        ? generateOCRFingerprint(store, parseFloat(amount), ocrDate)
        : undefined;

      const imageSizeBytes = receiptBase64
        ? getBase64ByteSize(receiptBase64)
        : undefined;

      // Upload receipt to S3 so a persistent URL is saved — never write a blob: URL to the DB
      let uploadedReceiptUrl: string | undefined;
      if (receiptImage) {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
          const isPdf = receiptType === 'file';
          const fileType = isPdf ? 'application/pdf' : 'image/jpeg';
          const uploadFileName = receiptFileName || `receipt-${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`;

          if (receiptImage.startsWith('http')) {
            // Already a persisted S3/HTTP URL — use as-is
            uploadedReceiptUrl = receiptImage;
          } else {
            const urlResponse = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: `receipts/${uploadFileName}`, fileType }),
            });
            if (urlResponse.ok) {
              const { uploadUrl, fileUrl } = await urlResponse.json();
              if (Platform.OS === 'web') {
                // receiptBase64 is already a data: URI resolved from the blob — use it directly
                const srcResponse = await fetch(receiptBase64 ?? receiptImage);
                const blob = await srcResponse.blob();
                await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': fileType } });
              } else {
                // Native: XHR streams the file:// URI bytes directly to S3
                await new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('PUT', uploadUrl, true);
                  xhr.setRequestHeader('Content-Type', fileType);
                  xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
                  xhr.onerror = () => reject(new Error('S3 upload network error'));
                  xhr.send({ uri: receiptImage, type: fileType, name: uploadFileName } as any);
                });
              }
              uploadedReceiptUrl = fileUrl;
            }
          }
        } catch (uploadError) {
          console.error('[Expenses] Receipt S3 upload failed, saving without receipt:', uploadError);
          // Fail open — don't block the expense save over a receipt upload failure
        }
      }

      await addExpense({
        id: Date.now().toString(),
        projectId: isCompanyExpense ? undefined : selectedProjectId,
        type: category,
        subcategory: category,
        isCompanyCost: isCompanyExpense,
        isOverhead: isCompanyExpense,
        amount: parseFloat(amount),
        store,
        notes: notes.trim() || undefined,
        date: ocrDate,
        receiptUrl: uploadedReceiptUrl,
        imageHash,
        ocrFingerprint,
        imageSizeBytes,
      });

      // Refresh expenses from database to ensure UI is in sync
      await refreshExpenses();

      setAmount('');
      setStore('');
      setNotes('');
      setExpenseType('');
      setCategory('');
      setIsCompanyExpense(false);
      setOverheadCategory('');
      setReceiptImage(null);
      setReceiptType(null);
      setReceiptFileName(null);
      setReceiptBase64(null);
      setOcrData(null);
      setServerImageHash(null);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleScanReceipt = () => {
    if (Platform.OS === 'web') {
      setShowWebScannerBanner(true);
      setTimeout(() => setShowWebScannerBanner(false), 4000);
      return;
    }
    setShowDocumentScanner(true);
  };

  const handleDocScanCapture = async (result: DocumentScanResult) => {
    setShowDocumentScanner(false);
    await processReceipt(result.uri, result.base64 || undefined);
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

  const processReceipt = async (uri: string, preExtractedBase64?: string) => {
    try {
      setIsScanning(true);
      setReceiptImage(uri);
      setReceiptType('image');

      console.log('[OCR] Processing receipt image...');
      console.log('[OCR] Platform:', Platform.OS);
      console.log('[OCR] Image URI:', uri);

      let imageData = uri;

      if (preExtractedBase64) {
        // Already processed by DocumentScannerModal — skip the file re-read
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

      // Store base64 and OCR data for duplicate detection
      setReceiptBase64(imageData);
      setOcrData(result);

      // Check for duplicates before auto-filling
      console.log('[OCR] Checking for duplicates...');
      const duplicateCheck = await checkForDuplicates(imageData, result);
      // Use the server-computed hash — avoids client-side/server-side encoding mismatch on iOS
      if (duplicateCheck.imageHash) {
        setServerImageHash(duplicateCheck.imageHash);
        console.log('[DuplicateCheck] Server hash received:', duplicateCheck.imageHash.substring(0, 16) + '...');
      }
      console.log('[DuplicateCheck] Result:', JSON.stringify({ isDuplicate: duplicateCheck.isDuplicate, duplicateType: duplicateCheck.duplicateType, canOverride: duplicateCheck.canOverride }));

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
          setServerImageHash(null);
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
              setServerImageHash(null);
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
                    setServerImageHash(null);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.title}>Expenses</Text>
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

        <View style={styles.addExpenseHeader}>
          <Text style={styles.addExpenseTitle}>Add Expense</Text>
          <Text style={styles.addExpenseSubtitle}>Submit a new expense entry</Text>
        </View>

        {!isCompanyExpense && (
          <TouchableOpacity
            style={styles.projectSelector}
            onPress={() => setShowProjectPicker(true)}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.projectSelectorLabel}>Project</Text>
              <Text style={styles.projectSelectorValue} numberOfLines={1}>
                {selectedProject?.name || 'Select Project'}
              </Text>
            </View>
            <ChevronDown size={20} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Company / Office Expense checkbox */}
        <TouchableOpacity
          style={styles.companyExpenseRow}
          onPress={() => setIsCompanyExpense(!isCompanyExpense)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isCompanyExpense && styles.checkboxChecked]}>
            {isCompanyExpense && <Check size={16} color="#FFFFFF" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyExpenseLabel}>Company / Office Expense</Text>
            <Text style={styles.companyExpenseDesc}>Not tied to a specific project</Text>
          </View>
        </TouchableOpacity>



        <View style={styles.form}>
          {showWebScannerBanner && (
            <View style={styles.webScannerBanner}>
              <Monitor size={18} color="#2563EB" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.webScannerBannerTitle}>Receipt scanner not available on web</Text>
                <Text style={styles.webScannerBannerText}>To scan receipts with your camera, please use the mobile app. You can still upload receipt images manually.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWebScannerBanner(false)}>
                <X size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}
          {/* Prominent AI Scanner — shown when no receipt has been captured yet */}
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
                  setReceiptBase64(null);
                  setOcrData(null);
                  setServerImageHash(null);
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
                  setReceiptBase64(null);
                  setOcrData(null);
                  setServerImageHash(null);
                }}
              >
                <X size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.categoryPicker}
            onPress={() => setShowCategoryPicker(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {category ? (
                <>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB', marginRight: 10 }} />
                  <Text style={styles.pickerText}>{category}</Text>
                </>
              ) : (
                <Text style={[styles.pickerText, { color: '#9CA3AF' }]}>Select category...</Text>
              )}
            </View>
            <ChevronDown size={16} color="#6B7280" />
          </TouchableOpacity>

          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Store / Invoice</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter store or invoice details"
            placeholderTextColor="#9CA3AF"
            value={store}
            onChangeText={setStore}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Add any notes about this expense..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {validationError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, (isSaving || isScanning) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving || isScanning}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Expense</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.expensesList}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {(isLoading || isCompanyReloading) && expenses.length === 0 ? (
            <View>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: 12, gap: 12 }}>
                  <SkeletonBox width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1 }}>
                    <SkeletonBox width="55%" height={14} borderRadius={4} />
                    <SkeletonBox width="35%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
                  </View>
                  <SkeletonBox width={60} height={16} borderRadius={4} />
                </View>
              ))}
            </View>
          ) : filteredExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No expenses recorded for this project</Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => (
              <View key={expense.id} style={styles.expenseCard}>
                {/* 🎯 CLIENT DESIGN: Large avatar on left, name + amount on first line */}
                <View style={styles.expenseMainRow}>
                  {/* Left: Avatar + Name + Category */}
                  <View style={styles.expenseLeftSection}>
                    {expense.uploader ? (
                      /* Show uploader avatar */
                      expense.uploader.avatar ? (
                        <Image
                          source={{ uri: expense.uploader.avatar }}
                          style={styles.expenseAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        /* Show initials */
                        <View style={styles.expenseAvatarPlaceholder}>
                          <Text style={styles.expenseAvatarInitials}>
                            {expense.uploader.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Text>
                        </View>
                      )
                    ) : (
                      /* No uploader - show default icon */
                      <View style={styles.expenseAvatarPlaceholder}>
                        <Text style={styles.expenseAvatarInitials}>?</Text>
                      </View>
                    )}

                    <View style={styles.expenseNameSection}>
                      <Text style={styles.expenseUploaderName} numberOfLines={1}>
                        {expense.uploader ? expense.uploader.name : 'Unknown'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.expenseType}>{expense.subcategory || expense.type}</Text>
                        {expense.isCompanyCost && (
                          <View style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '600' }}>Business</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Right: Amount */}
                  <Text style={styles.expenseAmount}>${expense.amount.toLocaleString()}</Text>
                </View>

                {/* Employees see type + amount only — no receipt images or store details */}
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
              <Text style={styles.modalTitle} numberOfLines={1}>Select Project</Text>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView
          keyboardDismissMode="on-drag"
        >
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

      {/* Unified Category Picker */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} keyboardDismissMode="on-drag">
              {EXPENSE_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.categoryOptionRow, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      setCategory(cat.name);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={[styles.categoryIconCircle, { backgroundColor: cat.bg }]}>
                      <IconComponent size={20} color={cat.color} />
                    </View>
                    <Text style={[styles.categoryOptionText, isSelected && styles.pickerOptionTextSelected]}>
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <Check size={20} color="#2563EB" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
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

      <DocumentScannerModal
        visible={showDocumentScanner}
        onCapture={handleDocScanCapture}
        onClose={() => setShowDocumentScanner(false)}
        title="Scan Receipt"
      />
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
  // 🎯 CLIENT DESIGN: Main row with avatar, name, and amount
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
  // ── AI Scanner button (prominent, in form body) ──────────────────────────
  aiScannerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 16,
  },
  aiScannerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  formDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 16,
  },
  formDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  formDividerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  addExpenseHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  addExpenseTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  addExpenseSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  companyExpenseRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  companyExpenseLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  companyExpenseDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  amountInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  amountPrefix: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  categoryOptionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#1F2937',
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
    flex: 1,
    marginRight: 12,
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
  webScannerBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  webScannerBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1E40AF',
    marginBottom: 2,
  },
  webScannerBannerText: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
});
