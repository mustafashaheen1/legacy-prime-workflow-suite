import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList, Platform, Linking, Dimensions, Modal, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Plus, Trash2, Check, Edit2, Send, FileSignature, Eye, EyeOff, Sparkles, Camera, Mic, Paperclip, Search, X, Square, Image as ImageIcon } from 'lucide-react-native';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { PriceListItem, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { EstimateItem, Estimate, ProjectFile } from '@/types';
import { vanillaClient } from '@/lib/trpc';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as pdfjsLib from 'pdfjs-dist';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

export default function EstimateScreen() {
  const { id, estimateId, clientId: clientIdParam } = useLocalSearchParams();
  const router = useRouter();
  const { projects, clients, addEstimate, estimates, updateEstimate, priceListItems, priceListCategories, addCustomPriceListItem, updateCustomPriceListItem, customCategories, addCustomCategory, deleteCustomCategory, addProjectFile, company } = useApp();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const isWeb = Platform.OS === 'web';
  const isNarrow = screenWidth < 900;
  const isWebWide = isWeb && screenWidth >= 900;

  const [estimateName, setEstimateName] = useState<string>('');
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showUnitsQty, setShowUnitsQty] = useState<boolean>(true);
  const [showBudget, setShowBudget] = useState<boolean>(true);
  const [markupPercent, setMarkupPercent] = useState<string>('0');
  const [taxPercent, setTaxPercent] = useState<string>('8');
  const [showAddTemplateModal, setShowAddTemplateModal] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateUnit, setNewTemplateUnit] = useState<string>('EA');
  const [newTemplatePrice, setNewTemplatePrice] = useState<string>('0');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [draftId, setDraftId] = useState<string>(`draft-${Date.now()}`);
  const [isLoadingDraft, setIsLoadingDraft] = useState<boolean>(true);
  const [showAddSeparatorModal, setShowAddSeparatorModal] = useState<boolean>(false);
  const [newSeparatorLabel, setNewSeparatorLabel] = useState<string>('');
  const [showAIGenerateModal, setShowAIGenerateModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadingImageItemId, setUploadingImageItemId] = useState<string | null>(null);
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null);
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [showEditPriceModal, setShowEditPriceModal] = useState<boolean>(false);

  // Support both project-based and client-based estimate creation
  const clientId = clientIdParam as string | undefined;
  const client = clientId ? clients.find(c => c.id === clientId) : null;
  const project = id !== 'new' ? projects.find(p => p.id === id) : null;

  const allCategories = useMemo(() => {
    return priceListCategories; // Already includes custom categories from AppContext
  }, [priceListCategories]);

  // Set first category when loaded
  useEffect(() => {
    if (priceListCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(priceListCategories[0]);
    }
  }, [priceListCategories, selectedCategory]);

  const loadDraft = useCallback(async () => {
    // Use clientId for drafts if available, otherwise use project id
    const draftKeyId = clientId || id;
    if (!draftKeyId) return;
    try {
      const draftKey = `estimate_draft_${draftKeyId}`;
      const storedDraft = await AsyncStorage.getItem(draftKey);

      if (storedDraft) {
        const draft = JSON.parse(storedDraft);
        console.log('[Draft] Loaded existing draft for:', draftKeyId);
        const entityName = client?.name || project?.name || 'Estimate';
        setEstimateName(draft.estimateName || `${entityName} - Estimate ${new Date().toLocaleDateString()}`);
        setItems(draft.items || []);
        setMarkupPercent(draft.markupPercent || '0');
        setTaxPercent(draft.taxPercent || '8');
        setDraftId(draft.draftId || `draft-${Date.now()}`);
      } else if ((client || project) && !estimateName) {
        const entityName = client?.name || project?.name || 'New';
        const defaultName = `${entityName} - Estimate ${new Date().toLocaleDateString()}`;
        setEstimateName(defaultName);
      }
    } catch (error) {
      console.error('[Draft] Error loading draft:', error);
    } finally {
      setIsLoadingDraft(false);
    }
  }, [id, clientId, client, project, estimateName]);

  useEffect(() => {
    // Load draft if we have a client or project and not editing existing estimate
    if ((client || project) && !estimateId) {
      loadDraft();
    } else if (!client && !project && id === 'new' && !clientId) {
      // No client or project specified for new estimate
      setIsLoadingDraft(false);
    }
  }, [client, project, id, clientId, estimateId, loadDraft]);

  // Load existing estimate when estimateId is provided
  useEffect(() => {
    const loadExistingEstimate = async () => {
      if (!estimateId) return;

      try {
        console.log('[Estimate] Fetching existing estimate from database:', estimateId);
        setIsLoadingDraft(true);

        // Fetch estimate from database
        const response = await fetch(`/api/get-estimate?estimateId=${estimateId}`);
        const result = await response.json();

        if (!result.success || !result.estimate) {
          console.error('[Estimate] Failed to load estimate:', result.error);
          Alert.alert('Error', 'Failed to load estimate');
          setIsLoadingDraft(false);
          return;
        }

        const estimate = result.estimate;
        console.log('[Estimate] Loaded estimate:', estimate.name, 'with', estimate.items?.length || 0, 'items');

        setEstimateName(estimate.name);
        setItems(estimate.items || []);
        setTaxPercent((estimate.taxRate || 0).toString());
        setMarkupPercent('0'); // Reset markup for editing
        setDraftId(estimate.id);
        setSavedEstimateId(estimate.id); // Track for updates instead of creating duplicates
        setIsLoadingDraft(false);
      } catch (error: any) {
        console.error('[Estimate] Error loading estimate:', error);
        Alert.alert('Error', 'Failed to load estimate: ' + error.message);
        setIsLoadingDraft(false);
      }
    };

    loadExistingEstimate();
  }, [estimateId]);

  const saveDraft = useCallback(async () => {
    if (!id || items.length === 0) return;
    
    try {
      const draftKey = `estimate_draft_${id}`;
      const draft = {
        draftId,
        estimateName,
        items,
        markupPercent,
        taxPercent,
        lastSaved: new Date().toISOString(),
      };
      await AsyncStorage.setItem(draftKey, JSON.stringify(draft));
      console.log('[Draft] Auto-saved estimate draft');
    } catch (error) {
      console.error('[Draft] Error saving draft:', error);
    }
  }, [id, draftId, estimateName, items, markupPercent, taxPercent]);

  useEffect(() => {
    if (isLoadingDraft) return;
    const timer = setTimeout(() => {
      saveDraft();
    }, 2000);
    return () => clearTimeout(timer);
  }, [estimateName, items, markupPercent, taxPercent, isLoadingDraft, saveDraft]);

  const clearDraft = async () => {
    const draftKeyId = clientId || id;
    if (!draftKeyId) return;
    try {
      const draftKey = `estimate_draft_${draftKeyId}`;
      await AsyncStorage.removeItem(draftKey);
      console.log('[Draft] Cleared draft for:', draftKeyId);
    } catch (error) {
      console.error('[Draft] Error clearing draft:', error);
    }
  };

  const saveEstimateAsFile = async (estimate: Estimate) => {
    // Only save as file if we have a project context
    if (!project) {
      console.log('[Files] Skipping file save - no project context');
      return;
    }
    try {
      const estimateData = JSON.stringify(estimate, null, 2);
      const file: ProjectFile = {
        id: `file-estimate-${estimate.id}-${Date.now()}`,
        projectId: project.id,
        name: `${estimate.name}.json`,
        category: 'estimates',
        fileType: 'application/json',
        fileSize: new Blob([estimateData]).size,
        uri: `data:application/json;base64,${btoa(estimateData)}`,
        uploadDate: new Date().toISOString(),
        notes: `${estimate.status === 'draft' ? 'Draft' : 'Final'} estimate - Total: ${estimate.total.toFixed(2)}`,
      };
      await addProjectFile(file);
      console.log('[Files] Estimate saved to project files:', file.name);
    } catch (error) {
      console.error('[Files] Error saving estimate as file:', error);
    }
  };

  // Require either client or project for new estimates, allow editing existing estimates
  if (!project && !client && !estimateId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Client or Project not found</Text>
      </View>
    );
  }

  if (isLoadingDraft) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading draft...</Text>
      </View>
    );
  }

  const getCategoryItems = (category: string) => {
    let items = priceListItems.filter(item => item.category === category);

    // Filter out master items if a custom override exists with the same name
    const customItemNames = new Set(
      items.filter(item => item.isCustom).map(item => `${item.category}:${item.name}`)
    );

    items = items.filter(item => {
      if (!item.isCustom) {
        // This is a master item - only show it if no custom override exists
        const key = `${item.category}:${item.name}`;
        return !customItemNames.has(key);
      }
      return true; // Always show custom items
    });

    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.unit.toLowerCase().includes(query)
      );
    }

    return items;
  };

  const addTemplateItem = () => {
    if (!newTemplateName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    const newItem: CustomPriceListItem = {
      id: `custom-template-${Date.now()}`,
      category: selectedCategory,
      name: newTemplateName.trim(),
      description: '',
      unit: newTemplateUnit.trim() || 'EA',
      unitPrice: parseFloat(newTemplatePrice) || 0,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    addCustomPriceListItem(newItem);
    setShowAddTemplateModal(false);
    setNewTemplateName('');
    setNewTemplateUnit('EA');
    setNewTemplatePrice('0');
    Alert.alert('Success', 'Template item added successfully!');
  };

  const addItemToEstimate = (priceListItem: PriceListItem) => {
    const newItem: EstimateItem = {
      id: `item-${Date.now()}`,
      priceListItemId: priceListItem.id,
      quantity: 1,
      unitPrice: priceListItem.unitPrice,
      total: priceListItem.unitPrice,
      notes: '',
    };
    setItems(prev => [...prev, newItem]);
  };

  const addCustomItem = () => {
    const newItem: EstimateItem = {
      id: `custom-${Date.now()}`,
      priceListItemId: 'custom',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      notes: '',
      customName: 'Custom Item',
      customUnit: 'EA',
      customCategory: selectedCategory,
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const price = item.customPrice ?? item.unitPrice;
        const newTotal = quantity * price;
        const budgetUnitPrice = item.budgetUnitPrice ?? 0;
        const totalBudget = quantity * budgetUnitPrice;
        return { ...item, quantity, total: newTotal, budget: totalBudget };
      }
      return item;
    }));
  };

  const updateItemPrice = (itemId: string, customPrice: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newTotal = item.quantity * customPrice;
        return { ...item, customPrice, total: newTotal };
      }
      return item;
    }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, notes } : item
    ));
  };

  const updateItemBudget = (itemId: string, budgetUnitPrice: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const totalBudget = item.quantity * budgetUnitPrice;
        return { ...item, budgetUnitPrice, budget: totalBudget };
      }
      return item;
    }));
  };

  const updateItemImage = (itemId: string, imageUrl: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, imageUrl } : item
    ));
  };

  const removeItemImage = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, imageUrl: undefined } : item
    ));
  };

  const pickItemImage = async (itemId: string, source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access photos');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      console.log('[Estimate] Image selected, local URI:', localUri);

      // Show loading state
      setUploadingImageItemId(itemId);
      updateItemImage(itemId, localUri);

      try {
        // Convert image to base64 for S3 upload
        let base64Data: string;

        if (Platform.OS === 'web') {
          // Web: Fetch blob and convert to base64
          console.log('[Estimate] Converting blob to base64 (web)...');
          const response = await fetch(localUri);
          const blob = await response.blob();
          base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log('[Estimate] Base64 conversion complete, length:', base64Data.length);
        } else {
          // Mobile: Use FileSystem to read as base64
          console.log('[Estimate] Converting to base64 (mobile)...');
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          base64Data = `data:image/jpeg;base64,${base64}`;
          console.log('[Estimate] Base64 conversion complete, length:', base64Data.length);
        }

        // Upload to S3
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
        const fileName = `estimate-item-${itemId}-${Date.now()}.jpg`;
        console.log('[Estimate] Uploading to S3...', { apiUrl, fileName });

        const uploadResponse = await fetch(`${apiUrl}/api/upload-to-s3`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: fileName,
            fileType: 'image/jpeg',
            folder: 'estimate-item-photos',
          }),
        });

        console.log('[Estimate] S3 upload response status:', uploadResponse.status);

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          console.log('[Estimate] Image uploaded to S3 successfully:', result.url);
          updateItemImage(itemId, result.url);
        } else {
          const errorText = await uploadResponse.text();
          console.error('[Estimate] Failed to upload image to S3:', errorText);
          Alert.alert('Upload Failed', 'Could not upload image to cloud storage. Please try again.');
          // Keep the local URI so user can see the image
        }
      } catch (error) {
        console.error('[Estimate] Error uploading image:', error);
        Alert.alert('Upload Error', 'Could not upload image. Please check your connection and try again.');
        // Keep the local URI so user can see the image
      } finally {
        setUploadingImageItemId(null);
      }
    }
  };

  const openEditPriceModal = (priceListItem: PriceListItem) => {
    setEditingPriceItemId(priceListItem.id);
    setEditingPrice(priceListItem.unitPrice.toString());
    setShowEditPriceModal(true);
  };

  const handleUpdatePrice = async () => {
    if (!editingPriceItemId || !company) {
      return;
    }

    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const itemToEdit = priceListItems.find(item => item.id === editingPriceItemId);
    if (!itemToEdit) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    // Close modal immediately
    setShowEditPriceModal(false);
    setEditingPriceItemId(null);
    setEditingPrice('');

    // Update the price in local state IMMEDIATELY for both master and custom items
    updateCustomPriceListItem(editingPriceItemId, { unitPrice: newPrice });

    // Show success immediately
    Alert.alert('Success', 'Price updated to $' + newPrice.toFixed(2));

    // If it's a custom item, update in database
    if (itemToEdit.isCustom) {
      console.log('[Estimate] Updating custom item in database:', itemToEdit.name);

      (async () => {
        try {
          await vanillaClient.priceList.updatePriceListItem.mutate({
            itemId: editingPriceItemId,
            companyId: company.id,
            unitPrice: newPrice,
          });
          console.log('[Estimate] Price updated in database');
        } catch (error) {
          console.error('[Estimate] Error updating price in database:', error);
        }
      })();
    } else {
      // It's a master item - create a company-specific override with same name
      console.log('[Estimate] Creating company override for master item:', itemToEdit.name);

      (async () => {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

          await fetch(`${apiUrl}/api/add-price-item-direct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: company.id,
              category: itemToEdit.category,
              name: itemToEdit.name, // Same name, no "(Custom Price)"
              unit: itemToEdit.unit,
              unitPrice: newPrice,
            }),
            signal: AbortSignal.timeout(8000),
          });
          console.log('[Estimate] Company override created in database');
        } catch (error) {
          console.error('[Estimate] Error creating override:', error);
        }
      })();
    }
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => item.isSeparator ? sum : sum + item.total, 0);
    const totalBudget = items.reduce((sum, item) => item.isSeparator ? sum : sum + (item.budget || 0), 0);
    const markupPercentNum = parseFloat(markupPercent) || 0;
    const taxPercentNum = parseFloat(taxPercent) || 0;
    const markupAmount = subtotal * (markupPercentNum / 100);
    const subtotalWithMarkup = subtotal + markupAmount;
    const taxRate = taxPercentNum / 100;
    const taxAmount = subtotalWithMarkup * taxRate;
    const total = subtotalWithMarkup + taxAmount;
    return { subtotal, totalBudget, markupPercent: markupPercentNum, markupAmount, subtotalWithMarkup, taxRate: taxPercentNum, taxAmount, total };
  };

  const addSeparator = () => {
    const newSeparator: EstimateItem = {
      id: `separator-${Date.now()}`,
      priceListItemId: 'separator',
      quantity: 0,
      unitPrice: 0,
      total: 0,
      isSeparator: true,
      separatorLabel: newSeparatorLabel.trim() || 'Section',
    };
    setItems(prev => [...prev, newSeparator]);
    setShowAddSeparatorModal(false);
    setNewSeparatorLabel('');
  };

  const updateSeparatorLabel = (itemId: string, label: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, separatorLabel: label } : item
    ));
  };

  const validateEstimate = (): { subtotal: number; markupPercent: number; markupAmount: number; subtotalWithMarkup: number; taxRate: number; taxAmount: number; total: number } | null => {
    const actualItems = items.filter(item => !item.isSeparator);
    if (actualItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the estimate');
      return null;
    }

    return calculateTotals();
  };

  const saveEstimate = async () => {
    if (isSaving) return; // Prevent double-clicks

    // Check if any images are still uploading
    if (uploadingImageItemId) {
      Alert.alert('Please Wait', 'An image is still uploading. Please wait for it to complete before saving.');
      return;
    }

    // Check for blob URLs that weren't uploaded to S3
    const hasUnuploadedImages = items.some(item => item.imageUrl?.startsWith('blob:'));
    if (hasUnuploadedImages) {
      Alert.alert('Upload Issue', 'Some images failed to upload to cloud storage. Please remove and re-attach the images before saving.');
      return;
    }

    const totals = validateEstimate();
    if (!totals) return;

    if (!company?.id) {
      Alert.alert('Error', 'Company information not found. Please try again.');
      return;
    }

    // Require clientId for new estimates
    if (!clientId && !client) {
      Alert.alert('Error', 'Client information not found. Please select a client first.');
      return;
    }

    const { subtotal, taxAmount, total } = totals;

    setIsSaving(true);
    try {
      const itemsData = items.map(item => ({
        priceListItemId: item.priceListItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customPrice: item.customPrice,
        total: item.total,
        budget: item.budget,
        budgetUnitPrice: item.budgetUnitPrice,
        notes: item.notes,
        customName: item.customName,
        customUnit: item.customUnit,
        customCategory: item.customCategory,
        isSeparator: item.isSeparator,
        separatorLabel: item.separatorLabel,
        imageUrl: item.imageUrl,
      }));

      let result;

      if (savedEstimateId) {
        // Update existing estimate
        console.log('[Estimate] Updating existing estimate:', savedEstimateId);
        const response = await fetch('/api/update-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimateId: savedEstimateId,
            companyId: company.id,
            clientId: clientId as string,
            name: estimateName,
            items: itemsData,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'draft',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update estimate');
        }
        result = await response.json();
      } else {
        // Create new estimate
        console.log('[Estimate] Creating new estimate...');
        const response = await fetch('/api/create-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            clientId: clientId as string,
            name: estimateName,
            items: itemsData,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'draft',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save estimate');
        }
        result = await response.json();
      }

      console.log('[Estimate] Response result:', result);

      if (result.success && result.estimate) {
        console.log('[Estimate] Estimate saved successfully:', result.estimate.id);

        // Track the saved estimate ID for future updates
        setSavedEstimateId(result.estimate.id);

        // Also add/update local state for immediate UI update
        const savedEstimate: Estimate = {
          id: result.estimate.id,
          clientId: clientId as string,
          name: estimateName,
          items,
          subtotal,
          taxRate: parseFloat(taxPercent) || 0,
          taxAmount,
          total,
          createdDate: new Date().toISOString(),
          status: 'draft',
        };

        if (savedEstimateId) {
          updateEstimate(result.estimate.id, savedEstimate);
        } else {
          addEstimate(savedEstimate);
        }

        // Save as project file for backward compatibility (if project exists)
        if (project) {
          await saveEstimateAsFile(savedEstimate);
        }
        await clearDraft();

        Alert.alert('Success', 'Estimate saved successfully!', [
          {
            text: 'OK',
            onPress: () => {
              console.log('[Estimate] Navigating to CRM page...');
              router.push('/crm');
            }
          }
        ]);
      } else {
        console.error('[Estimate] Invalid response structure:', result);
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('[Estimate] Error saving estimate:', error);
      Alert.alert('Error', `Failed to save estimate: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const sendEstimateAsPDF = async () => {
    // Check if any images are still uploading
    if (uploadingImageItemId) {
      Alert.alert('Please Wait', 'An image is still uploading. Please wait for it to complete before sending.');
      return;
    }

    // Check for blob URLs that weren't uploaded to S3
    const hasUnuploadedImages = items.some(item => item.imageUrl?.startsWith('blob:'));
    if (hasUnuploadedImages) {
      Alert.alert('Upload Issue', 'Some images failed to upload to cloud storage. Please remove and re-attach the images before sending.');
      return;
    }

    const totals = validateEstimate();
    if (!totals) return;

    if (!company?.id) {
      Alert.alert('Error', 'Company information not found. Please try again.');
      return;
    }

    // Determine clientId - use direct clientId param or get from project
    const effectiveClientId = clientId || project?.clientId;
    if (!effectiveClientId) {
      Alert.alert('Error', 'Client information not found. Please select a client.');
      return;
    }

    const { subtotal, markupAmount, subtotalWithMarkup, taxAmount, total } = totals;

    try {
      const itemsData = items.map(item => ({
        priceListItemId: item.priceListItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customPrice: item.customPrice,
        total: item.total,
        budget: item.budget,
        budgetUnitPrice: item.budgetUnitPrice,
        notes: item.notes,
        customName: item.customName,
        customUnit: item.customUnit,
        customCategory: item.customCategory,
        isSeparator: item.isSeparator,
        separatorLabel: item.separatorLabel,
        imageUrl: item.imageUrl,
      }));

      let result;

      if (savedEstimateId) {
        // Update existing estimate with sent status
        console.log('[Estimate] Updating existing estimate as sent:', savedEstimateId);
        const response = await fetch('/api/update-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimateId: savedEstimateId,
            companyId: company.id,
            clientId: effectiveClientId,
            name: estimateName,
            items: itemsData,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'sent',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update estimate');
        }
        result = await response.json();
      } else {
        // Create new estimate with sent status
        console.log('[Estimate] Creating new estimate as sent...');
        const response = await fetch('/api/create-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            clientId: effectiveClientId,
            name: estimateName,
            items: itemsData,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'sent',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save estimate');
        }
        result = await response.json();
      }

      if (!result.success || !result.estimate) {
        throw new Error('Failed to save estimate to database');
      }

      // Track the saved estimate ID for future updates
      setSavedEstimateId(result.estimate.id);

      const sentEstimate: Estimate = {
        id: result.estimate.id,
        clientId: effectiveClientId,
        name: estimateName,
        items,
        subtotal,
        taxRate: parseFloat(taxPercent) || 0,
        taxAmount,
        total,
        createdDate: new Date().toISOString(),
        status: 'sent',
      };

      if (savedEstimateId) {
        updateEstimate(result.estimate.id, sentEstimate);
      } else {
        addEstimate(sentEstimate);
      }
      await saveEstimateAsFile(sentEstimate);
      await clearDraft();

      // Generate PDF matching the Preview modal format
      console.log('[Estimate] Generating PDF...');
      const markupPercentNum = parseFloat(markupPercent) || 0;
      const taxPercentNum = parseFloat(taxPercent) || 0;

      // Build line items HTML (matching Preview modal)
      const itemsHtml = items.map((item, index) => {
        if (item.isSeparator) {
          return `
            <div style="margin: 20px 0; text-align: center; position: relative;">
              <div style="border-top: 2px solid #333; position: absolute; width: 100%; top: 50%;"></div>
              <span style="background: white; padding: 0 20px; position: relative; font-weight: bold; font-size: 14px; color: #333;">
                ${item.separatorLabel?.toUpperCase() || 'SECTION'}
              </span>
            </div>
          `;
        }
        const priceListItem = getPriceListItem(item.priceListItemId);
        const isCustom = item.priceListItemId === 'custom';
        const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
        const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
        const displayPrice = item.customPrice ?? item.unitPrice;
        const notes = item.notes ? `<div style="color: #666; font-size: 12px; margin-top: 4px;">Note: ${item.notes}</div>` : '';
        const imageHtml = item.imageUrl ? `<img src="${item.imageUrl}" style="max-width: 200px; max-height: 150px; margin-top: 8px; border-radius: 4px; display: block;" />` : '';

        return `
          <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
            <div style="font-weight: 500; font-size: 14px; color: #333; margin-bottom: 4px;">
              ${index + 1}. ${itemName}
            </div>
            ${showUnitsQty ? `
              <div style="color: #666; font-size: 13px;">
                Qty: ${item.quantity} ${itemUnit} @ $${displayPrice.toFixed(2)} = $${item.total.toFixed(2)}
              </div>
            ` : `
              <div style="color: #666; font-size: 13px;">$${item.total.toFixed(2)}</div>
            `}
            ${notes}
            ${imageHtml}
          </div>
        `;
      }).join('');

      // Build HTML matching Preview modal exactly
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .company-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .company-logo {
              max-width: 200px;
              max-height: 100px;
              margin-bottom: 10px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
            .company-slogan {
              font-size: 14px;
              color: #666;
              font-style: italic;
            }
            .company-details {
              text-align: center;
              font-size: 12px;
              color: #666;
              margin-bottom: 20px;
              line-height: 1.6;
            }
            .divider {
              border-top: 2px solid #333;
              margin: 20px 0;
            }
            .project-info {
              margin-bottom: 20px;
            }
            .project-name, .estimate-name {
              font-size: 16px;
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
            .date {
              font-size: 13px;
              color: #666;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin: 20px 0 15px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .totals-section {
              margin-top: 30px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .totals-label {
              color: #666;
            }
            .totals-value {
              font-weight: 500;
              color: #333;
            }
            .grand-total {
              border-top: 2px solid #333;
              margin-top: 10px;
              padding-top: 15px;
              font-size: 18px;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 13px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <!-- Company Header -->
          <div class="company-header">
            ${company?.logo ? `<img src="${company.logo}" class="company-logo" alt="Company Logo"/>` : ''}
            <div class="company-name">${company?.name || 'Company Name'}</div>
            ${company?.slogan ? `<div class="company-slogan">${company.slogan}</div>` : ''}
          </div>

          <!-- Company Details -->
          <div class="company-details">
            ${company?.licenseNumber ? `License # ${company.licenseNumber}<br/>` : ''}
            ${company?.officePhone ? `Office: ${company.officePhone}<br/>` : ''}
            ${company?.cellPhone ? `Cell: ${company.cellPhone}<br/>` : ''}
            ${company?.address ? `${company.address}<br/>` : ''}
            ${company?.email ? `Email: ${company.email}<br/>` : ''}
            ${company?.website ? `${company.website}` : ''}
          </div>

          <div class="divider"></div>

          <!-- Project Info -->
          <div class="project-info">
            <div class="project-name">PROJECT: ${project?.name || 'N/A'}</div>
            <div class="estimate-name">ESTIMATE: ${estimateName}</div>
            <div class="date">Date: ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="divider"></div>

          <!-- Line Items -->
          <div class="section-title">Line Items</div>
          ${itemsHtml}

          <div class="divider"></div>

          <!-- Totals -->
          <div class="section-title">Totals</div>
          <div class="totals-section">
            <div class="totals-row">
              <span class="totals-label">Subtotal</span>
              <span class="totals-value">$${subtotal.toFixed(2)}</span>
            </div>
            ${markupPercentNum > 0 ? `
              <div class="totals-row">
                <span class="totals-label">Markup (${markupPercent}%)</span>
                <span class="totals-value">$${markupAmount.toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span class="totals-label">Subtotal w/ Markup</span>
                <span class="totals-value">$${subtotalWithMarkup.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row">
              <span class="totals-label">Tax (${taxPercent}%)</span>
              <span class="totals-value">$${taxAmount.toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span class="totals-label">TOTAL</span>
              <span class="totals-value">$${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Footer -->
          <div class="footer">
            ${company?.estimateTemplate || 'Thank you for your business! Please review and let us know if you have any questions.'}
          </div>
        </body>
        </html>
      `;

      // Handle PDF generation differently for web vs mobile
      if (Platform.OS === 'web') {
        console.log('[Estimate] Web platform - opening print dialog and email client...');

        // Prepare mailto link
        const emailSubject = encodeURIComponent(`Estimate: ${estimateName}`);
        const emailBody = encodeURIComponent(
          `Please find attached the estimate for ${project?.name || 'your project'}.\n\nTotal: $${total.toFixed(2)}\n\nThank you for your business!`
        );

        // On web, open the HTML in a new window and trigger print dialog
        if (typeof window !== 'undefined') {
          // Open print dialog
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();

            // Wait for content to load, then trigger print
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };

            console.log('[Estimate] Print dialog opened');
          }

          // Immediately open email client
          setTimeout(() => {
            console.log('[Estimate] Opening email client...');
            window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
          }, 1000);

          // Show success message and navigate to CRM
          setTimeout(() => {
            if (window.confirm('Estimate saved!\n\nPrint dialog and email client opened.\nSave the PDF and attach it to the email.\n\nClick OK to return to CRM.')) {
              router.push('/crm');
            }
          }, 2000);
        }
      } else {
        // On mobile, generate PDF and open email composer
        console.log('[Estimate] Mobile platform - generating PDF...');
        const { uri } = await Print.printToFileAsync({ html });
        console.log('[Estimate] PDF generated:', uri);

        // Open email composer with PDF attachment
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Error', 'Email is not available on this device');
          return;
        }

        console.log('[Estimate] Opening email composer with attachment...');
        await MailComposer.composeAsync({
          subject: `Estimate: ${estimateName}`,
          body: `Please find attached the estimate for ${project?.name || 'your project'}.\n\nTotal: $${total.toFixed(2)}\n\nThank you for your business!`,
          attachments: [uri],
        });

        console.log('[Estimate] Email composer closed');
        Alert.alert(
          'Success',
          'Estimate saved to database!',
          [{ text: 'OK', onPress: () => router.push('/crm') }]
        );
      }
    } catch (error: any) {
      console.error('[Estimate] Error sending estimate:', error);
      Alert.alert('Error', `Failed to send estimate: ${error.message || 'Unknown error'}`);
    }
  };

  const requestSignature = async () => {
    // Check if any images are still uploading
    if (uploadingImageItemId) {
      Alert.alert('Please Wait', 'An image is still uploading. Please wait for it to complete.');
      return;
    }

    // Check for blob URLs that weren't uploaded to S3
    const hasUnuploadedImages = items.some(item => item.imageUrl?.startsWith('blob:'));
    if (hasUnuploadedImages) {
      Alert.alert('Upload Issue', 'Some images failed to upload to cloud storage. Please remove and re-attach the images.');
      return;
    }

    const totals = validateEstimate();
    if (!totals) return;

    if (!company?.id) {
      Alert.alert('Error', 'Company information not found. Please try again.');
      return;
    }

    // Determine clientId - use direct clientId param or get from project
    const effectiveClientId = clientId || project?.clientId;
    if (!effectiveClientId) {
      Alert.alert('Error', 'Client information not found. Please select a client.');
      return;
    }

    const { subtotal, markupAmount, subtotalWithMarkup, taxAmount, total } = totals;

    try {
      console.log('[Estimate] Saving estimate to Supabase (status: sent)...');

      const itemsPayload = items.map(item => ({
        priceListItemId: item.priceListItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customPrice: item.customPrice,
        total: item.total,
        budget: item.budget,
        budgetUnitPrice: item.budgetUnitPrice,
        notes: item.notes,
        customName: item.customName,
        customUnit: item.customUnit,
        customCategory: item.customCategory,
        isSeparator: item.isSeparator,
        separatorLabel: item.separatorLabel,
        imageUrl: item.imageUrl,
      }));

      let response;
      let estimateId = savedEstimateId;

      if (savedEstimateId) {
        // Update existing estimate
        console.log('[Estimate] Updating existing estimate:', savedEstimateId);
        response = await fetch('/api/update-estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            estimateId: savedEstimateId,
            companyId: company.id,
            clientId: effectiveClientId,
            name: estimateName,
            items: itemsPayload,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'sent',
          }),
        });
      } else {
        // Create new estimate
        console.log('[Estimate] Creating new estimate');
        response = await fetch('/api/create-estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: company.id,
            clientId: effectiveClientId,
            name: estimateName,
            items: itemsPayload,
            subtotal,
            taxRate: parseFloat(taxPercent) || 0,
            taxAmount,
            total,
            status: 'sent',
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save estimate');
      }

      const result = await response.json();

      if (!result.success || !result.estimate) {
        throw new Error('Failed to save estimate to database');
      }

      // Track the saved estimate ID for future updates
      if (!savedEstimateId) {
        setSavedEstimateId(result.estimate.id);
        estimateId = result.estimate.id;
      }

      const newEstimate: Estimate = {
        id: estimateId!,
        clientId: effectiveClientId,
        name: estimateName,
        items,
        subtotal,
        taxRate: parseFloat(taxPercent) || 0,
        taxAmount,
        total,
        createdDate: new Date().toISOString(),
        status: 'sent',
      };

      addEstimate(newEstimate);
      await saveEstimateAsFile(newEstimate);
      await clearDraft();

    const itemsText = items.map((item, index) => {
      if (item.isSeparator) {
        return `\n--- ${item.separatorLabel?.toUpperCase() || 'SECTION'} ---\n`;
      }
      const priceListItem = getPriceListItem(item.priceListItemId);
      const isCustom = item.priceListItemId === 'custom';
      const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
      const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
      const displayPrice = item.customPrice ?? item.unitPrice;
      const notes = item.notes ? ` (${item.notes})` : '';
      
      if (showUnitsQty) {
        return `${index + 1}. ${itemName}\n   Qty: ${item.quantity} ${itemUnit} @ ${displayPrice.toFixed(2)} = ${item.total.toFixed(2)}${notes}`;
      } else {
        return `${index + 1}. ${itemName}\n   ${item.total.toFixed(2)}${notes}`;
      }
    }).join('\n\n');

    const markupPercentNum = parseFloat(markupPercent) || 0;
    const taxPercentNum = parseFloat(taxPercent) || 0;
    let totalsText = `--- TOTALS ---\nSubtotal: ${subtotal.toFixed(2)}`;
    if (markupPercentNum > 0) {
      totalsText += `\nMarkup (${markupPercentNum}%): ${markupAmount.toFixed(2)}\nSubtotal w/ Markup: ${subtotalWithMarkup.toFixed(2)}`;
    }
    totalsText += `\nTax (${taxPercentNum}%): ${taxAmount.toFixed(2)}\nTOTAL: ${total.toFixed(2)}`;

    const emailBody = `Hi,\n\nWe're ready to move forward with your project!\n\nPROJECT: ${project?.name || 'Your Project'}\nESTIMATE: ${estimateName}\n\n--- LINE ITEMS ---\n${itemsText}\n\n${totalsText}\n\nPlease review and sign this estimate to approve the project. Once approved, we'll convert this to an active project and begin work.\n\nClick here to review and sign: [Digital Signature Link]\n\nBest regards,\nLegacy Prime Construction`;
    
    const emailUrl = `mailto:?subject=${encodeURIComponent(`Signature Required: ${estimateName}`)}&body=${encodeURIComponent(emailBody)}`;
    
    if (Platform.OS === 'web') {
      window.open(emailUrl, '_blank');
    } else {
      Linking.openURL(emailUrl).catch(() => {
        Alert.alert('Error', 'Unable to open email client');
      });
    }

      Alert.alert(
        'Success',
        'Estimate saved to database and signature request sent! Your email client should open with the estimate details.',
        [{ text: 'OK', onPress: () => router.push('/crm') }]
      );
    } catch (error: any) {
      console.error('[Estimate] Error requesting signature:', error);
      Alert.alert('Error', `Failed to request signature: ${error.message || 'Unknown error'}`);
    }
  };

  const getPriceListItem = (priceListItemId: string): PriceListItem | undefined => {
    if (priceListItemId === 'custom') return undefined;

    // Check master price list first
    const masterItem = masterPriceList.find(item => item.id === priceListItemId);
    if (masterItem) return masterItem;

    // Then check custom price list items
    const customItem = customPriceListItems.find(item => item.id === priceListItemId);
    return customItem;
  };

  const updateCustomItemName = (itemId: string, name: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, customName: name } : item
    ));
  };

  const updateCustomItemUnit = (itemId: string, unit: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, customUnit: unit } : item
    ));
  };

  const { subtotal, totalBudget, markupAmount, subtotalWithMarkup, taxAmount, total } = calculateTotals();

  const openPreview = () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the estimate');
      return;
    }

    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    try {
      console.log('[Estimate] Exporting estimate as PDF...');

      // Generate HTML for PDF
      const html = generateEstimatePreviewHTML();

      if (Platform.OS === 'web') {
        // Open print dialog for web
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
          Alert.alert('PDF Export', 'Print dialog opened. You can save as PDF from the print options.');
        }
      } else {
        // Mobile: Generate PDF file
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share PDF',
          UTI: 'com.adobe.pdf',
        });
        Alert.alert('Success', 'PDF exported successfully!');
      }

      console.log('[Estimate] PDF export completed');
    } catch (error: any) {
      console.error('[Estimate] Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF. Please try again.');
    }
  };

  const handleExportCSV = async () => {
    try {
      console.log('[Estimate] Exporting estimate as CSV...');

      // Generate CSV content
      let csvContent = 'Item,Description,Quantity,Unit,Unit Price,Total,Notes\n';

      items.forEach((item, index) => {
        if (item.isSeparator) {
          // Add separator as a blank row with label in description
          csvContent += `,"${item.separatorLabel || 'SECTION'}",,,,,\n`;
        } else {
          const priceListItem = getPriceListItem(item.priceListItemId);
          const isCustom = item.priceListItemId === 'custom';
          const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
          const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
          const displayPrice = item.customPrice ?? item.unitPrice;
          const notes = item.notes?.replace(/"/g, '""') || ''; // Escape quotes in notes

          csvContent += `${index + 1},"${itemName}",${item.quantity},"${itemUnit}",${displayPrice.toFixed(2)},${item.total.toFixed(2)},"${notes}"\n`;
        }
      });

      // Add totals section
      csvContent += '\n';
      csvContent += `"Subtotal",,,,,${subtotal.toFixed(2)},\n`;

      if ((parseFloat(markupPercent) || 0) > 0) {
        csvContent += `"Markup (${markupPercent}%)",,,,,${markupAmount.toFixed(2)},\n`;
        csvContent += `"Subtotal w/ Markup",,,,,${subtotalWithMarkup.toFixed(2)},\n`;
      }

      csvContent += `"Tax (${taxPercent}%)",,,,,${taxAmount.toFixed(2)},\n`;
      csvContent += `"TOTAL",,,,,${total.toFixed(2)},\n`;

      // Save CSV file
      if (Platform.OS === 'web') {
        // Web: Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `estimate-${estimateName.replace(/\s+/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', 'CSV file downloaded successfully!');
      } else {
        // Mobile: Save to file system and share
        const fileName = `estimate-${estimateName.replace(/\s+/g, '-')}.csv`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Save or Share CSV',
        });
        Alert.alert('Success', 'CSV exported successfully!');
      }

      console.log('[Estimate] CSV export completed');
    } catch (error: any) {
      console.error('[Estimate] Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV. Please try again.');
    }
  };

  const generateEstimatePreviewHTML = (): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estimate - ${estimateName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1f2937;
      background: white;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .company-info h1 { font-size: 24px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
    .company-info p { font-size: 11px; color: #6b7280; line-height: 1.5; }
    .estimate-info { text-align: right; }
    .estimate-info h2 { font-size: 20px; font-weight: 600; color: #2563eb; margin-bottom: 8px; }
    .estimate-info p { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .project-details {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .project-details h3 { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 10px; }
    .separator-row {
      background: #f3f4f6;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      margin: 10px 0;
      border-left: 3px solid #9ca3af;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    thead { background: #f3f4f6; }
    th {
      padding: 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
    }
    th:last-child, td:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px; font-size: 11px; color: #1f2937; }
    .item-name { font-weight: 500; }
    .item-notes { font-size: 10px; color: #6b7280; font-style: italic; margin-top: 2px; }
    .totals-section {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }
    .totals-table { margin-left: auto; width: 300px; }
    .totals-table td { padding: 6px 8px; font-size: 12px; }
    .totals-table .label { text-align: right; color: #6b7280; font-weight: 500; }
    .totals-table .value { text-align: right; color: #1f2937; font-weight: 600; width: 120px; }
    .total-row { border-top: 2px solid #e5e7eb; font-size: 14px !important; }
    .total-row .label { color: #1f2937; font-weight: 700; }
    .total-row .value { color: #2563eb; font-weight: 700; font-size: 16px; }
    @media print {
      body { padding: 0; }
      .container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Company Name'}</h1>
        ${company?.email ? `<p>${company.email}</p>` : ''}
        ${company?.officePhone ? `<p>${company.officePhone}</p>` : ''}
        ${company?.address ? `<p>${company.address}</p>` : ''}
      </div>
      <div class="estimate-info">
        <h2>ESTIMATE</h2>
        <p><strong>Project:</strong> ${project?.name || 'Project'}</p>
        <p><strong>Estimate:</strong> ${estimateName}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <div class="line-items">
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 40%;">Item</th>
            <th style="width: 15%;">Quantity</th>
            <th style="width: 15%;">Unit Price</th>
            <th style="width: 25%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            if (item.isSeparator) {
              return `<tr><td colspan="5" class="separator-row">${item.separatorLabel || 'SECTION'}</td></tr>`;
            }
            const priceListItem = getPriceListItem(item.priceListItemId);
            const isCustom = item.priceListItemId === 'custom';
            const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
            const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
            const displayPrice = item.customPrice ?? item.unitPrice;

            return `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <div class="item-name">${itemName}</div>
                  ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                </td>
                <td>${item.quantity} ${itemUnit}</td>
                <td>$${displayPrice.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="totals-section">
      <table class="totals-table">
        <tbody>
          <tr>
            <td class="label">Subtotal:</td>
            <td class="value">$${subtotal.toFixed(2)}</td>
          </tr>
          ${(parseFloat(markupPercent) || 0) > 0 ? `
            <tr>
              <td class="label">Markup (${markupPercent}%):</td>
              <td class="value">$${markupAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">Subtotal w/ Markup:</td>
              <td class="value">$${subtotalWithMarkup.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td class="label">Tax (${taxPercent}%):</td>
            <td class="value">$${taxAmount.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">TOTAL:</td>
            <td class="value">$${total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${company?.estimateTemplate ? `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
        ${company.estimateTemplate}
      </div>
    ` : ''}
  </div>
</body>
</html>
    `;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Estimate</Text>
          <TextInput
            style={styles.headerInput}
            value={estimateName}
            onChangeText={setEstimateName}
            placeholder="Estimate name"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={styles.searchContainer}>
          <Search size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items..."
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.categoryBar}>
        <TouchableOpacity
          style={styles.newAssemblyButton}
          onPress={() => setShowAddCategoryModal(true)}
        >
          <Plus size={18} color="#10B981" />
          <Text style={styles.newAssemblyButtonText}>New Assembly</Text>
        </TouchableOpacity>
        <FlatList
          horizontal
          data={allCategories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
          renderItem={({ item: category }) => (
            <TouchableOpacity
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive,
                ]}
                numberOfLines={1}
              >
                {category}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={[styles.mainContent, isNarrow && styles.mainContentNarrow]}>
        <ScrollView style={[
          styles.itemSelectionSection,
          isWeb && !isNarrow && styles.itemSelectionSectionWeb,
          isNarrow && styles.itemSelectionSectionNarrow
        ]} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedCategory}</Text>
            <TouchableOpacity style={styles.addCustomButton} onPress={addCustomItem}>
              <Plus size={16} color="#2563EB" />
              <Text style={styles.addCustomButtonText}>Custom</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.itemsListContent}>
            {getCategoryItems(selectedCategory).map((item) => (
              <View
                key={item.id}
                style={styles.lineItemCard}
              >
                <TouchableOpacity
                  style={styles.lineItemMain}
                  onPress={() => addItemToEstimate(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.lineItemName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.lineItemRight}>
                    <Text style={styles.lineItemUnit}>{item.unit}</Text>
                    <Text style={styles.lineItemPrice}>${item.unitPrice.toFixed(2)}</Text>
                    <TouchableOpacity
                      style={styles.editItemButton}
                      onPress={() => openEditPriceModal(item)}
                    >
                      <Edit2 size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addItemButton}
                      onPress={() => addItemToEstimate(item)}
                    >
                      <Plus size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.addTemplateButton}
              onPress={() => setShowAddTemplateModal(true)}
            >
              <Plus size={20} color="#10B981" />
              <Text style={styles.addTemplateButtonText}>Add Template Item to {selectedCategory}</Text>
            </TouchableOpacity>
            
            {customCategories.some(cat => cat.name === selectedCategory) && (
              <TouchableOpacity
                style={styles.deleteCategoryButton}
                onPress={() => {
                  Alert.alert(
                    'Delete Category',
                    `Are you sure you want to delete "${selectedCategory}"? This will also remove all items in this category.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          const category = customCategories.find(cat => cat.name === selectedCategory);
                          if (category) {
                            deleteCustomCategory(category.id);
                            setSelectedCategory(priceListCategories[0]);
                            Alert.alert('Success', 'Custom category deleted successfully!');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text style={styles.deleteCategoryButtonText}>Delete &quot;{selectedCategory}&quot; Category</Text>
              </TouchableOpacity>
            )}
            <View style={styles.categoryBottomSpace} />
          </View>
        </ScrollView>

        <View style={styles.selectedItemsContainer}>
          <View style={[
            styles.selectedItemsSection,
            isWeb && !isNarrow && styles.selectedItemsSectionWeb,
            isNarrow && styles.selectedItemsSectionNarrow
          ]}>
            <View style={styles.selectedItemsHeader}>
              <Text style={styles.sectionLabel}>Selected Items ({items.filter(i => !i.isSeparator).length})</Text>
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity
                  style={styles.aiGenerateButton}
                  onPress={() => setShowAIGenerateModal(true)}
                >
                  <Sparkles size={16} color="#8B5CF6" />
                  <Text style={styles.aiGenerateButtonText}>Generate with AI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBreakPointButton}
                  onPress={() => setShowAddSeparatorModal(true)}
                >
                  <Plus size={16} color="#374151" />
                  <Text style={styles.addBreakPointButtonText}>Break Point</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={true}>
            {items.map((item) => {
              if (item.isSeparator) {
                return (
                  <View key={item.id} style={styles.separatorItem}>
                    <View style={styles.separatorContent}>
                      <View style={styles.separatorLine} />
                      <TextInput
                        style={styles.separatorLabel}
                        value={item.separatorLabel || ''}
                        onChangeText={(text) => updateSeparatorLabel(item.id, text)}
                        placeholder="Section Name"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.separatorLine} />
                    </View>
                    <TouchableOpacity 
                      onPress={() => removeItem(item.id)}
                      style={styles.separatorDeleteButton}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                );
              }
              const priceListItem = getPriceListItem(item.priceListItemId);
              const isCustom = item.priceListItemId === 'custom';
              const isEditing = editingItemId === item.id;
              const displayPrice = item.customPrice ?? item.unitPrice;
              const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
              const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
              const itemCategory = isCustom ? (item.customCategory || 'Custom') : (priceListItem?.category || '');

              return (
                <View key={item.id} style={styles.estimateItem}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleRow}>
                      {isEditing ? (
                        <TextInput
                          style={styles.itemNameInput}
                          value={itemName}
                          onChangeText={(text) => updateCustomItemName(item.id, text)}
                          placeholder="Item name"
                          placeholderTextColor="#9CA3AF"
                        />
                      ) : (
                        <Text style={styles.itemName}>{itemName}</Text>
                      )}
                      <View style={styles.itemActions}>
                        <TouchableOpacity 
                          onPress={() => setEditingItemId(isEditing ? null : item.id)}
                          style={styles.iconButton}
                        >
                          {isEditing ? (
                            <Check size={18} color="#10B981" />
                          ) : (
                            <Edit2 size={18} color="#2563EB" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => removeItem(item.id)}
                          style={styles.iconButton}
                        >
                          <Trash2 size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemCategory}>{itemCategory}</Text>
                  </View>
                  
                  <View style={[styles.itemDetailsRow, isNarrow && styles.itemDetailsRowNarrow]}>
                    {showUnitsQty && (
                      <>
                        <View style={[styles.quantityControl, isNarrow && styles.quantityControlNarrow]}>
                          <Text style={[styles.itemLabel, isNarrow && styles.itemLabelNarrow]}>Qty</Text>
                          <View style={styles.quantityInput}>
                            <TouchableOpacity 
                              style={[styles.quantityButton, isNarrow && styles.quantityButtonNarrow]}
                              onPress={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                            >
                              <Text style={[styles.quantityButtonText, isNarrow && styles.quantityButtonTextNarrow]}>-</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.quantityTextInput, isNarrow && styles.quantityTextInputNarrow]}
                              value={item.quantity.toString()}
                              onChangeText={(text) => {
                                const qty = parseInt(text) || 1;
                                updateItemQuantity(item.id, Math.max(1, qty));
                              }}
                              keyboardType="number-pad"
                            />
                            <TouchableOpacity 
                              style={[styles.quantityButton, isNarrow && styles.quantityButtonNarrow]}
                              onPress={() => updateItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Text style={[styles.quantityButtonText, isNarrow && styles.quantityButtonTextNarrow]}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={[styles.unitControl, isNarrow && styles.unitControlNarrow]}>
                          <Text style={[styles.itemLabel, isNarrow && styles.itemLabelNarrow]}>Unit</Text>
                          {isEditing ? (
                            <TextInput
                              style={[styles.unitInput, isNarrow && styles.unitInputNarrow]}
                              value={itemUnit}
                              onChangeText={(text) => updateCustomItemUnit(item.id, text)}
                              placeholder="EA"
                              placeholderTextColor="#9CA3AF"
                            />
                          ) : (
                            <Text style={[styles.unitValue, isNarrow && styles.unitValueNarrow]}>{itemUnit}</Text>
                          )}
                        </View>
                      </>
                    )}
                    
                    {showUnitsQty && (
                      <View style={[styles.priceControl, isNarrow && styles.priceControlNarrow]}>
                        <Text style={[styles.itemLabel, isNarrow && styles.itemLabelNarrow]}>Price</Text>
                        {isEditing ? (
                          <View style={[styles.priceEditRow, isNarrow && styles.priceEditRowNarrow]}>
                            <Text style={[styles.dollarSign, isNarrow && styles.dollarSignNarrow]}>$</Text>
                            <TextInput
                              style={[styles.priceInput, isNarrow && styles.priceInputNarrow]}
                              value={displayPrice.toString()}
                              onChangeText={(text) => {
                                const price = parseFloat(text) || 0;
                                updateItemPrice(item.id, price);
                              }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                        ) : (
                          <Text style={[styles.priceValue, isNarrow && styles.priceValueNarrow]}>${displayPrice.toFixed(2)}</Text>
                        )}
                      </View>
                    )}

                    {showBudget && (
                      <View style={[styles.budgetControl, isNarrow && styles.budgetControlNarrow]}>
                        <Text style={[styles.itemLabel, isNarrow && styles.itemLabelNarrow]}>Budget</Text>
                        <View style={[styles.priceEditRow, isNarrow && styles.priceEditRowNarrow]}>
                          <Text style={[styles.dollarSign, isNarrow && styles.dollarSignNarrow]}>$</Text>
                          <TextInput
                            style={[styles.budgetInput, isNarrow && styles.budgetInputNarrow]}
                            value={item.budgetUnitPrice?.toString() || ''}
                            onChangeText={(text) => {
                              const budgetUnitPrice = parseFloat(text) || 0;
                              updateItemBudget(item.id, budgetUnitPrice);
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                      </View>
                    )}

                    <View style={[styles.totalControl, !showUnitsQty && !showBudget && styles.totalControlFull, isNarrow && styles.totalControlNarrow]}>
                      <Text style={[styles.itemLabel, isNarrow && styles.itemLabelNarrow]}>Total</Text>
                      <View>
                        <Text style={[styles.totalValue, isNarrow && styles.totalValueNarrow]}>${item.total.toFixed(2)}</Text>
                        {showBudget && item.budget && item.budget > 0 ? (
                          <Text style={[styles.budgetTotalText, isNarrow && styles.budgetTotalTextNarrow]}>(${item.budget.toFixed(2)})</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.notesSection}>
                    <TextInput
                      style={styles.notesInput}
                      value={item.notes}
                      onChangeText={(text) => updateItemNotes(item.id, text)}
                      placeholder="Add notes (will appear on PDF)..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.itemPhotoSection}>
                    {item.imageUrl ? (
                      <View style={styles.itemPhotoPreview}>
                        <Image source={{ uri: item.imageUrl }} style={styles.itemPhotoThumbnail} />
                        {uploadingImageItemId === item.id && (
                          <View style={styles.uploadingOverlay}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          </View>
                        )}
                        {uploadingImageItemId !== item.id && (
                          <TouchableOpacity onPress={() => removeItemImage(item.id)} style={styles.removePhotoButton}>
                            <X size={14} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={styles.addPhotoButtons}>
                        <TouchableOpacity
                          onPress={() => pickItemImage(item.id, 'camera')}
                          style={styles.addPhotoButton}
                          disabled={uploadingImageItemId !== null}
                        >
                          <Camera size={16} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => pickItemImage(item.id, 'library')}
                          style={styles.addPhotoButton}
                          disabled={uploadingImageItemId !== null}
                        >
                          <ImageIcon size={16} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

          {items.length > 0 && (
            <View style={styles.rightTotalsPanel}>
              <View style={styles.rightPanelContent}>
                <View style={styles.rightPanelTotalItem}>
                  <Text style={styles.rightPanelLabel}>Subtotal</Text>
                  <Text style={styles.rightPanelValue}>${subtotal.toFixed(2)}</Text>
                </View>

                {showBudget && totalBudget > 0 && (
                  <View style={styles.rightPanelTotalItem}>
                    <Text style={styles.rightPanelLabel}>Budget</Text>
                    <Text style={styles.rightPanelBudgetValue}>${totalBudget.toFixed(2)}</Text>
                  </View>
                )}

                <View style={styles.rightPanelEditableItem}>
                  <Text style={styles.rightPanelLabel}>Markup</Text>
                  <View style={styles.rightPanelEditRow}>
                    <TextInput
                      style={styles.rightPanelPercentInput}
                      value={markupPercent}
                      onChangeText={(text) => {
                        if (text === '' || text === '.' || /^\d*\.?\d*$/.test(text)) {
                          const val = parseFloat(text);
                          if (text === '' || text === '.' || (val >= 0 && val <= 100)) {
                            setMarkupPercent(text);
                          }
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.rightPanelPercentSign}>%</Text>
                  </View>
                  <Text style={styles.rightPanelCalculatedValue}>${markupAmount.toFixed(2)}</Text>
                </View>

                <View style={styles.rightPanelEditableItem}>
                  <Text style={styles.rightPanelLabel}>Tax</Text>
                  <View style={styles.rightPanelEditRow}>
                    <TextInput
                      style={styles.rightPanelPercentInput}
                      value={taxPercent}
                      onChangeText={(text) => {
                        if (text === '' || text === '.' || /^\d*\.?\d*$/.test(text)) {
                          const val = parseFloat(text);
                          if (text === '' || text === '.' || (val >= 0 && val <= 100)) {
                            setTaxPercent(text);
                          }
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.rightPanelPercentSign}>%</Text>
                  </View>
                  <Text style={styles.rightPanelCalculatedValue}>${taxAmount.toFixed(2)}</Text>
                </View>

                <View style={styles.rightPanelDivider} />

                <View style={styles.rightPanelGrandTotal}>
                  <Text style={styles.rightPanelGrandTotalLabel}>TOTAL</Text>
                  <Text style={styles.rightPanelGrandTotalValue}>${total.toFixed(2)}</Text>
                </View>

                <View style={styles.rightPanelDivider} />

                <View style={styles.rightPanelToggles}>
                  <TouchableOpacity
                    style={styles.rightPanelToggleButton}
                    onPress={() => setShowUnitsQty(!showUnitsQty)}
                  >
                    {showUnitsQty ? (
                      <Eye size={16} color="#2563EB" />
                    ) : (
                      <EyeOff size={16} color="#6B7280" />
                    )}
                    <Text style={styles.rightPanelToggleText}>
                      {showUnitsQty ? 'Hide' : 'Show'} Units & Qty
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rightPanelToggleButton}
                    onPress={() => setShowBudget(!showBudget)}
                  >
                    {showBudget ? (
                      <Eye size={16} color="#10B981" />
                    ) : (
                      <EyeOff size={16} color="#6B7280" />
                    )}
                    <Text style={styles.rightPanelToggleText}>
                      {showBudget ? 'Hide' : 'Show'} Budget
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {items.length > 0 && (
        <View style={styles.fixedBottomSection}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={saveEstimate}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Check size={16} color="#FFFFFF" />
              )}
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.previewButton}
              onPress={openPreview}
            >
              <Eye size={16} color="#FFFFFF" />
              <Text style={styles.previewButtonText}>Preview</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={sendEstimateAsPDF}
            >
              <Send size={16} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.signatureButton}
              onPress={requestSignature}
            >
              <FileSignature size={16} color="#FFFFFF" />
              <Text style={styles.signatureButtonText}>Sign</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </View>

      {showAddTemplateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Template Item</Text>
            <Text style={styles.modalSubtitle}>Category: {selectedCategory}</Text>
            
            <Text style={styles.modalLabel}>Item Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={newTemplateName}
              onChangeText={setNewTemplateName}
              placeholder="Enter item name"
              placeholderTextColor="#9CA3AF"
            />
            
            <Text style={styles.modalLabel}>Unit</Text>
            <TextInput
              style={styles.modalInput}
              value={newTemplateUnit}
              onChangeText={setNewTemplateUnit}
              placeholder="EA, SF, LF, etc."
              placeholderTextColor="#9CA3AF"
            />
            
            <Text style={styles.modalLabel}>Unit Price</Text>
            <TextInput
              style={styles.modalInput}
              value={newTemplatePrice}
              onChangeText={setNewTemplatePrice}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddTemplateModal(false);
                  setNewTemplateName('');
                  setNewTemplateUnit('EA');
                  setNewTemplatePrice('0');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addTemplateItem}
              >
                <Text style={styles.modalAddButtonText}>Add Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAddCategoryModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Custom Assembly</Text>
            <Text style={styles.modalSubtitle}>Add a new category/assembly to organize your line items</Text>
            
            <Text style={styles.modalLabel}>Assembly Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="e.g., Custom Foundation, Special Assembly"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddCategoryModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={() => {
                  if (!newCategoryName.trim()) {
                    Alert.alert('Error', 'Please enter a category name');
                    return;
                  }
                  
                  if (allCategories.includes(newCategoryName.trim())) {
                    Alert.alert('Error', 'A category with this name already exists');
                    return;
                  }

                  const newCategory: CustomCategory = {
                    id: `custom-category-${Date.now()}`,
                    name: newCategoryName.trim(),
                    createdAt: new Date().toISOString(),
                  };

                  addCustomCategory(newCategory);
                  setSelectedCategory(newCategory.name);
                  setShowAddCategoryModal(false);
                  setNewCategoryName('');
                  Alert.alert('Success', `Custom assembly "${newCategory.name}" created! You can now add line items to it.`);
                }}
              >
                <Text style={styles.modalAddButtonText}>Create Assembly</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAddSeparatorModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Break Point</Text>
            <Text style={styles.modalSubtitle}>Add a category separator to organize your line items</Text>
            
            <Text style={styles.modalLabel}>Section Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={newSeparatorLabel}
              onChangeText={setNewSeparatorLabel}
              placeholder="e.g., Bathroom, Kitchen, Exterior"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddSeparatorModal(false);
                  setNewSeparatorLabel('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addSeparator}
              >
                <Text style={styles.modalAddButtonText}>Add Break Point</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showEditPriceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Price</Text>
            <Text style={styles.modalSubtitle}>
              Update the unit price for this item
            </Text>

            <Text style={styles.modalLabel}>Unit Price *</Text>
            <TextInput
              style={styles.modalInput}
              value={editingPrice}
              onChangeText={(text) => {
                // Only allow digits and decimal point
                const numericText = text.replace(/[^0-9.]/g, '');
                // Prevent multiple decimal points
                const parts = numericText.split('.');
                const sanitized = parts.length > 2
                  ? parts[0] + '.' + parts.slice(1).join('')
                  : numericText;
                setEditingPrice(sanitized);
              }}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditPriceModal(false);
                  setEditingPriceItemId(null);
                  setEditingPrice('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={handleUpdatePrice}
              >
                <Text style={styles.modalAddButtonText}>Update Price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAIGenerateModal && (
        <AIEstimateGenerateModal
          visible={showAIGenerateModal}
          onClose={() => setShowAIGenerateModal(false)}
          onGenerate={(generatedItems, shouldReplace) => {
            if (shouldReplace) {
              setItems(generatedItems);
            } else {
              setItems(prev => [...prev, ...generatedItems]);
            }
            setShowAIGenerateModal(false);
          }}
          projectName={project?.name || 'Unnamed Project'}
          existingItems={items}
        />
      )}

      {showPreview && (
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Estimate Preview</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.previewContent}>
                <View style={styles.previewCompanyHeader}>
                  {company?.logo && (
                    <Image source={{ uri: company.logo }} style={styles.previewCompanyLogo} />
                  )}
                  <View style={styles.previewCompanyInfo}>
                    <Text style={styles.previewCompanyName}>{company?.name || 'Company Name'}</Text>
                    {company?.slogan && (
                      <Text style={styles.previewCompanySlogan}>{company.slogan}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.previewCompanyDetails}>
                  {company?.licenseNumber && (
                    <Text style={styles.previewCompanyDetailText}>License # {company.licenseNumber}</Text>
                  )}
                  {company?.officePhone && (
                    <Text style={styles.previewCompanyDetailText}>Office: {company.officePhone}</Text>
                  )}
                  {company?.cellPhone && (
                    <Text style={styles.previewCompanyDetailText}>Cell: {company.cellPhone}</Text>
                  )}
                  {company?.address && (
                    <Text style={styles.previewCompanyDetailText}>{company.address}</Text>
                  )}
                  {company?.email && (
                    <Text style={styles.previewCompanyDetailText}>Email: {company.email}</Text>
                  )}
                  {company?.website && (
                    <Text style={styles.previewCompanyDetailText}>{company.website}</Text>
                  )}
                </View>

                <View style={styles.previewDivider} />

                <Text style={styles.previewProjectName}>PROJECT: {project?.name || 'Unnamed Project'}</Text>
                <Text style={styles.previewEstimateName}>ESTIMATE: {estimateName}</Text>
                <Text style={styles.previewDate}>Date: {new Date().toLocaleDateString()}</Text>

                <View style={styles.previewDivider} />

                <Text style={styles.previewSectionTitle}>LINE ITEMS</Text>
                
                {items.map((item, index) => {
                  if (item.isSeparator) {
                    return (
                      <View key={item.id} style={styles.previewSeparator}>
                        <View style={styles.previewSeparatorLine} />
                        <Text style={styles.previewSeparatorLabel}>{item.separatorLabel?.toUpperCase() || 'SECTION'}</Text>
                        <View style={styles.previewSeparatorLine} />
                      </View>
                    );
                  }
                  const priceListItem = getPriceListItem(item.priceListItemId);
                  const isCustom = item.priceListItemId === 'custom';
                  const itemName = item.customName || (isCustom ? 'Custom Item' : (priceListItem?.name || ''));
                  const itemUnit = item.customUnit || (isCustom ? 'EA' : (priceListItem?.unit || ''));
                  const displayPrice = item.customPrice ?? item.unitPrice;

                  return (
                    <View key={item.id} style={styles.previewLineItem}>
                      <Text style={styles.previewItemName}>{index + 1}. {itemName}</Text>
                      {showUnitsQty && (
                        <Text style={styles.previewItemDetails}>
                          Qty: {item.quantity} {itemUnit} @ ${displayPrice.toFixed(2)} = ${item.total.toFixed(2)}
                        </Text>
                      )}
                      {!showUnitsQty && (
                        <Text style={styles.previewItemDetails}>${item.total.toFixed(2)}</Text>
                      )}
                      {item.notes ? (
                        <Text style={styles.previewItemNotes}>Note: {item.notes}</Text>
                      ) : null}
                      {item.imageUrl && (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.previewItemImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  );
                })}

                <View style={styles.previewDivider} />

                <Text style={styles.previewSectionTitle}>TOTALS</Text>
                
                <View style={styles.previewTotalsRow}>
                  <Text style={styles.previewTotalLabel}>Subtotal</Text>
                  <Text style={styles.previewTotalValue}>${subtotal.toFixed(2)}</Text>
                </View>

                {(parseFloat(markupPercent) || 0) > 0 && (
                  <>
                    <View style={styles.previewTotalsRow}>
                      <Text style={styles.previewTotalLabel}>Markup ({markupPercent}%)</Text>
                      <Text style={styles.previewTotalValue}>${markupAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewTotalsRow}>
                      <Text style={styles.previewTotalLabel}>Subtotal w/ Markup</Text>
                      <Text style={styles.previewTotalValue}>${subtotalWithMarkup.toFixed(2)}</Text>
                    </View>
                  </>
                )}

                <View style={styles.previewTotalsRow}>
                  <Text style={styles.previewTotalLabel}>Tax ({taxPercent}%)</Text>
                  <Text style={styles.previewTotalValue}>${taxAmount.toFixed(2)}</Text>
                </View>

                <View style={[styles.previewTotalsRow, styles.previewGrandTotal]}>
                  <Text style={styles.previewGrandTotalLabel}>TOTAL</Text>
                  <Text style={styles.previewGrandTotalValue}>${total.toFixed(2)}</Text>
                </View>

                <View style={styles.previewDivider} />

                {company?.estimateTemplate && (
                  <Text style={styles.previewFooter}>
                    {company.estimateTemplate}
                  </Text>
                )}
                {!company?.estimateTemplate && (
                  <Text style={styles.previewFooter}>
                    Thank you for your business! Please review and let us know if you have any questions.
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.previewActionsContainer}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportPDF}
              >
                <Text style={styles.exportButtonText}>📄 Export as PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleExportCSV}
              >
                <Text style={styles.exportButtonText}>📊 Export as CSV</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setShowPreview(false)}
            >
              <Text style={styles.previewCloseButtonText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

interface AIEstimateGenerateModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (items: EstimateItem[], shouldReplace: boolean) => void;
  projectName: string;
  existingItems: EstimateItem[];
}

function AIEstimateGenerateModal({ visible, onClose, onGenerate, projectName, existingItems }: AIEstimateGenerateModalProps) {
  const [textInput, setTextInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{uri: string; type: string; name: string}>>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);

  const handleClearConversation = () => {
    setConversationHistory([]);
    setTextInput('');
    setAttachedFiles([]);
    Alert.alert('Conversation Cleared', 'Starting fresh! The AI will not remember previous requests.');
  };

  const handleMicrophone = async () => {
    try {
      if (isRecording && recording) {
        // Stop recording
        console.log('[AI Estimate] Stopping recording...');
        setIsRecording(false);

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();

        if (!uri) {
          Alert.alert('Error', 'Failed to get recording');
          setRecording(null);
          return;
        }

        console.log('[AI Estimate] Recording saved to:', uri);

        // Convert to base64
        let base64 = '';
        if (Platform.OS === 'web') {
          // On web, fetch the blob and convert to base64
          const response = await fetch(uri);
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64Data = result.includes('base64,')
                ? result.split('base64,')[1]
                : result;
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          // On native, use FileSystem
          base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        // Transcribe with OpenAI Whisper (direct API call to avoid timeout)
        console.log('[AI Estimate] Transcribing audio, base64 length:', base64.length);

        const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
        if (!apiKey) {
          Alert.alert('Error', 'OpenAI API key not configured');
          setRecording(null);
          return;
        }

        // Convert base64 to blob
        const audioBlob = await fetch(`data:audio/m4a;base64,${base64}`).then(r => r.blob());

        // Create FormData for Whisper API
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.m4a');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

        console.log('[AI Estimate] Calling OpenAI Whisper API directly...');
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });

        setRecording(null);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[AI Estimate] Whisper API error:', errorText);
          Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
          return;
        }

        const result = await response.json();
        console.log('[AI Estimate] Transcription result:', result);

        if (result.text) {
          // Append transcribed text to the input
          const newText = textInput ? `${textInput} ${result.text}` : result.text;
          console.log('[AI Estimate] Setting text input to:', newText);
          setTextInput(newText);
          console.log('[AI Estimate] Transcription successful:', result.text);
        } else {
          console.error('[AI Estimate] No text in transcription result:', result);
          Alert.alert('Error', 'Failed to transcribe audio');
        }
      } else {
        // Clean up any existing recording first
        if (recording) {
          console.log('[AI Estimate] Cleaning up existing recording...');
          try {
            await recording.stopAndUnloadAsync();
          } catch (cleanupError) {
            console.warn('[AI Estimate] Error cleaning up existing recording:', cleanupError);
          }
          setRecording(null);
          setIsRecording(false);
        }

        // Start recording
        console.log('[AI Estimate] Requesting microphone permissions...');
        const permission = await Audio.requestPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Permission Required', 'Microphone permission is required for voice input');
          return;
        }

        console.log('[AI Estimate] Starting recording...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        setRecording(newRecording);
        setIsRecording(true);
        console.log('[AI Estimate] Recording started');
      }
    } catch (error) {
      console.error('[AI Estimate] Microphone error:', error);
      setIsRecording(false);

      // Properly clean up the recording on error
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.warn('[AI Estimate] Error during cleanup:', cleanupError);
        }
      }
      setRecording(null);

      Alert.alert('Error', 'Failed to record audio');
    }
  };

  const handleCameraOrFile = async () => {
    console.log('[AI Estimate] Attachment button clicked');

    // On web, use a different approach since Alert.alert with buttons doesn't work well
    if (Platform.OS === 'web') {
      // For web, directly open file picker
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          multiple: true,
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const newFiles = result.assets.map(asset => ({
            uri: asset.uri,
            type: asset.mimeType || 'document',
            name: asset.name,
          }));
          setAttachedFiles(prev => [...prev, ...newFiles]);
          console.log('[AI Estimate] Files attached:', newFiles.length);
        }
      } catch (error) {
        console.error('[AI Estimate] File picker error:', error);
        Alert.alert('Error', 'Failed to select files');
      }
      return;
    }

    // Native platforms
    Alert.alert(
      'Add Media',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

              if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Camera permission is required to take photos');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setAttachedFiles(prev => [...prev, {
                  uri: asset.uri,
                  type: asset.type || 'image',
                  name: `photo-${Date.now()}.jpg`,
                }]);
              }
            } catch (error) {
              console.error('[AI Estimate] Camera error:', error);
              Alert.alert('Error', 'Failed to take photo');
            }
          }
        },
        {
          text: 'Choose Photo',
          onPress: async () => {
            try {
              const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

              if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Media library permission is required to select photos');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
              });

              if (!result.canceled && result.assets.length > 0) {
                const newFiles = result.assets.map((asset, index) => ({
                  uri: asset.uri,
                  type: asset.type || 'image',
                  name: asset.fileName || `image-${Date.now()}-${index}.jpg`,
                }));
                setAttachedFiles(prev => [...prev, ...newFiles]);
              }
            } catch (error) {
              console.error('[AI Estimate] Image picker error:', error);
              Alert.alert('Error', 'Failed to select photos');
            }
          }
        },
        {
          text: 'Choose Document',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                multiple: true,
                copyToCacheDirectory: true,
              });

              if (!result.canceled && result.assets.length > 0) {
                const newFiles = result.assets.map(asset => ({
                  uri: asset.uri,
                  type: asset.mimeType || 'document',
                  name: asset.name,
                }));
                setAttachedFiles(prev => [...prev, ...newFiles]);
              }
            } catch (error) {
              console.error('[AI Estimate] Document picker error:', error);
              Alert.alert('Error', 'Failed to select documents');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleGenerate = async () => {
    if (!textInput.trim() && attachedFiles.length === 0) {
      Alert.alert('Error', 'Please describe the scope of work or attach files');
      return;
    }

    setIsGenerating(true);
    try {
      console.log('[AI Estimate] Generating estimate from description:', textInput);

      // Check if we have any PDFs - if so, use backend API (like takeoff)
      const hasPDFs = attachedFiles.some(file =>
        file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
      );

      // If we have PDFs, use the backend API for document analysis
      if (hasPDFs && Platform.OS === 'web') {
        console.log('[AI Estimate] PDF detected - using backend API (same as takeoff)');

        const pdfFile = attachedFiles.find(file =>
          file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
        );

        if (!pdfFile) {
          throw new Error('PDF file not found');
        }

        try {
          // Import pdf.js dynamically (same as takeoff)
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

          console.log('[AI Estimate] Converting PDF to images...');

          // Fetch PDF as blob
          const response = await fetch(pdfFile.uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          // Load PDF
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const maxPages = Math.min(pdf.numPages, 3); // Limit to 3 pages like takeoff

          console.log(`[AI Estimate] PDF has ${pdf.numPages} pages, converting first ${maxPages}...`);

          // Convert each page to PNG and upload to S3
          const imageUrls: string[] = [];
          const blobs: Blob[] = [];

          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });

            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            if (!context) throw new Error('Failed to get canvas context');

            // Render PDF page to canvas
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            // Convert to PNG blob
            const pageBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error('Failed to convert page to blob'));
                },
                'image/png',
                0.92 // Compression
              );
            });

            blobs.push(pageBlob);
            console.log(`[AI Estimate] Converted page ${pageNum} (${(pageBlob.size / 1024 / 1024).toFixed(2)} MB)`);
          }

          // Upload all pages to S3
          console.log(`[AI Estimate] Uploading ${blobs.length} pages to S3...`);

          for (let i = 0; i < blobs.length; i++) {
            const pageNum = i + 1;

            // Get pre-signed upload URL
            const urlResponse = await fetch('/api/get-s3-upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: `${pdfFile.name}-page-${pageNum}.png`,
                fileType: 'image/png',
              }),
            });

            if (!urlResponse.ok) {
              const error = await urlResponse.json();
              throw new Error(error.error || 'Failed to get upload URL');
            }

            const { uploadUrl, fileUrl } = await urlResponse.json();

            // Upload to S3
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: blobs[i],
              headers: { 'Content-Type': 'image/png' },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload page ${pageNum} to S3`);
            }

            imageUrls.push(fileUrl);
            console.log(`[AI Estimate] Page ${pageNum} uploaded:`, fileUrl);
          }

          console.log(`[AI Estimate] All ${imageUrls.length} pages uploaded, calling backend API...`);

          // Call backend API with image URLs
          const apiResponse = await fetch('/api/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrls,
              documentType: 'pdf',
              priceListItems: masterPriceList,
            }),
          });

          if (!apiResponse.ok) {
            const error = await apiResponse.json();
            console.error('[AI Estimate] Backend API error:', error);
            throw new Error(error.message || error.error || 'Failed to analyze document');
          }

          const result = await apiResponse.json();
          console.log('[AI Estimate] Backend API returned', result.items?.length || 0, 'items');
          if (result.rawResponse) {
            console.log('[AI Estimate] AI raw response:', result.rawResponse.substring(0, 500));
          }

          if (!result.items || result.items.length === 0) {
            const message = result.message || 'The AI could not extract any construction items from this PDF.';
            const suggestion = result.suggestion || 'Try uploading a clearer document, or manually add items.';

            if (Platform.OS === 'web') {
              window.alert(`No Items Found\n\n${message}\n\n${suggestion}`);
            } else {
              Alert.alert(
                'No Items Found',
                `${message}\n\n${suggestion}`,
                [{ text: 'OK' }]
              );
            }
            setIsGenerating(false);
            return;
          }

          // Convert backend API items to estimate items
          const generatedItems: EstimateItem[] = result.items.map((aiItem: any, index: number) => {
            const priceListItem = masterPriceList.find(pl => pl.id === aiItem.priceListItemId);
            if (!priceListItem) {
              console.warn('[AI Estimate] Price list item not found:', aiItem.priceListItemId);
              return null;
            }

            return {
              id: `ai-generated-${Date.now()}-${index}`,
              priceListItemId: priceListItem.id,
              quantity: aiItem.quantity || 1,
              unitPrice: priceListItem.unitPrice,
              total: (aiItem.quantity || 1) * priceListItem.unitPrice,
              notes: aiItem.notes || 'Generated from PDF by AI',
            };
          }).filter(Boolean) as EstimateItem[];

          console.log('[AI Estimate] Generated', generatedItems.length, 'estimate items from PDF');

          // Always replace when analyzing documents
          onGenerate(generatedItems, true);
          setTextInput('');
          setAttachedFiles([]);
          onClose();
          setIsGenerating(false);
          return;
        } catch (error: any) {
          console.error('[AI Estimate] PDF processing error:', error);
          Alert.alert(
            'PDF Processing Failed',
            `Failed to process PDF: ${error.message}\n\nPlease try converting the PDF to images first, or use the Takeoff feature.`,
            [{ text: 'OK' }]
          );
          setIsGenerating(false);
          return;
        }
      } else if (hasPDFs && Platform.OS !== 'web') {
        // PDFs on mobile not supported yet
        Alert.alert(
          'PDF Not Supported',
          'PDF analysis is currently only available on web. Please use the Takeoff feature or convert your PDF to images.',
          [{ text: 'OK' }]
        );
        setIsGenerating(false);
        return;
      }

      // If we have images attached, also use backend API for consistency with takeoff
      if (attachedFiles.length > 0) {
        console.log('[AI Estimate] Images detected - using backend API for consistency with takeoff');

        try {
          // Process all image files
          const imageFile = attachedFiles[0]; // Use first image for now
          let imageData = '';

          // Convert image to base64
          if (Platform.OS === 'web') {
            const response = await fetch(imageFile.uri);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.includes('base64,')
                  ? result.split('base64,')[1]
                  : result;
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Determine mime type
            let mimeType = 'image/jpeg';
            if (imageFile.type.includes('png')) mimeType = 'image/png';
            else if (imageFile.type.includes('webp')) mimeType = 'image/webp';
            else if (imageFile.type.includes('gif')) mimeType = 'image/gif';

            imageData = `data:${mimeType};base64,${base64}`;
          } else {
            const base64 = await FileSystem.readAsStringAsync(imageFile.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            imageData = `data:image/jpeg;base64,${base64}`;
          }

          console.log('[AI Estimate] Calling backend API with image...');

          // Call backend API
          const apiResponse = await fetch('/api/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData,
              documentType: 'image',
              priceListItems: masterPriceList,
            }),
          });

          if (!apiResponse.ok) {
            const error = await apiResponse.json();
            console.error('[AI Estimate] Backend API error:', error);
            throw new Error(error.message || error.error || 'Failed to analyze document');
          }

          const result = await apiResponse.json();
          console.log('[AI Estimate] Backend API returned', result.items?.length || 0, 'items');
          if (result.rawResponse) {
            console.log('[AI Estimate] AI raw response:', result.rawResponse.substring(0, 500));
          }

          if (!result.items || result.items.length === 0) {
            const message = result.message || 'The AI could not extract any construction items from this image.';
            const suggestion = result.suggestion || 'Try uploading a clearer image, or manually add items.';

            if (Platform.OS === 'web') {
              window.alert(`No Items Found\n\n${message}\n\n${suggestion}`);
            } else {
              Alert.alert(
                'No Items Found',
                `${message}\n\n${suggestion}`,
                [{ text: 'OK' }]
              );
            }
            setIsGenerating(false);
            return;
          }

          // Convert backend API items to estimate items
          const generatedItems: EstimateItem[] = result.items.map((aiItem: any, index: number) => {
            const priceListItem = masterPriceList.find(pl => pl.id === aiItem.priceListItemId);
            if (!priceListItem) {
              console.warn('[AI Estimate] Price list item not found:', aiItem.priceListItemId);
              return null;
            }

            return {
              id: `ai-generated-${Date.now()}-${index}`,
              priceListItemId: priceListItem.id,
              quantity: aiItem.quantity || 1,
              unitPrice: priceListItem.unitPrice,
              total: (aiItem.quantity || 1) * priceListItem.unitPrice,
              notes: aiItem.notes || 'Generated from image by AI',
            };
          }).filter(Boolean) as EstimateItem[];

          console.log('[AI Estimate] Generated', generatedItems.length, 'estimate items from image');

          // Always replace when analyzing documents
          onGenerate(generatedItems, true);
          setTextInput('');
          setAttachedFiles([]);
          onClose();
          setIsGenerating(false);
          return;
        } catch (error: any) {
          console.error('[AI Estimate] Image processing error:', error);
          Alert.alert(
            'Image Processing Failed',
            `Failed to process image: ${error.message}`,
            [{ text: 'OK' }]
          );
          setIsGenerating(false);
          return;
        }
      }

      // Text-only generation (no files attached)
      let attachedFilesData: any[] = [];

      // Limit to 50 items to stay within Vercel timeout limits
      // Prioritize common categories for construction estimates
      const commonCategories = ['Labor', 'Materials', 'Equipment', 'Cabinets', 'Countertops', 'Plumbing', 'Electrical', 'Flooring', 'Painting', 'Drywall'];
      const priorityItems = masterPriceList.filter(item =>
        commonCategories.some(cat => item.category.includes(cat))
      );
      const limitedPriceList = [...priorityItems.slice(0, 40), ...masterPriceList.slice(0, 10)].slice(0, 50);

      const priceListContext = limitedPriceList.map(item =>
        `${item.id}|${item.name}|${item.unit}|$${item.unitPrice}`
      ).join('\n');

      // Build existing items context
      let existingItemsContext = '';
      let existingTotal = 0;
      if (existingItems.length > 0) {
        existingTotal = existingItems.reduce((sum, item) => sum + item.total, 0);
        const existingItemsList = existingItems.map(item => {
          const priceListItem = masterPriceList.find(pl => pl.id === item.priceListItemId);
          const itemName = item.customName || priceListItem?.name || 'Unknown';
          return `- ${itemName}: ${item.quantity} × $${item.unitPrice} = $${item.total}`;
        }).join('\n');
        existingItemsContext = `\n\nCURRENT ESTIMATE (Total: $${existingTotal.toFixed(2)}):\n${existingItemsList}`;
      }

      // Use different prompts for document analysis vs budget-based estimation
      const systemPrompt = attachedFilesData.length > 0
        ? `You are a construction estimator analyzing a construction document/blueprint IMAGE.

YOUR TASK:
1. Analyze the images to understand what construction work is proposed
2. Select appropriate items from the PRICE LIST DATABASE below
3. Estimate quantities based on what you see in the documents
4. Return ONLY items that exist in the price list - NO custom items

AVAILABLE PRICE LIST ITEMS:
${priceListContext}

CRITICAL INSTRUCTIONS:
- Look at the images carefully to understand the scope of work
- For each type of work you see, select the most appropriate item from the price list above
- Use the item ID from the price list (shown in format: ID|Name|Unit|Price)
- Estimate realistic quantities based on what you see in the documents
- If you see measurements, use them to calculate quantities
- ONLY use items from the price list above - do NOT invent new items
- If no suitable item exists in the price list for some work, skip it

RESPONSE FORMAT - CRITICAL:
Respond with a JSON object containing replaceExisting flag and items array:

{"replaceExisting": true, "items": [{"priceListItemId":"item-id","quantity":100,"notes":"From document"}]}

Start your response with { and end with }.
NO explanations, NO markdown, NO other text.`
        : `You are a construction estimator. Your PRIMARY GOAL is to create estimates that FIT THE CUSTOMER'S BUDGET.

Items (ID|Name|Unit|Price):
${priceListContext}

ABSOLUTE BUDGET CONSTRAINT (HIGHEST PRIORITY):
- When a budget is specified, the final total MUST NOT exceed it by more than 10%
- NEVER generate estimates that are 2x or 3x the stated budget
- If budget is $5000, total must be $4500-$5500 MAX
- If budget is $10000, total must be $9000-$11000 MAX
- Budget compliance is MORE IMPORTANT than including every possible item

HOW TO FIT BUDGET:
1. Start with ESSENTIAL items only (critical work, materials, labor)
2. Use MINIMUM viable quantities
3. Skip nice-to-have items if they push over budget
4. Calculate running total as you add items
5. Stop adding items when approaching budget limit

UNDERSTANDING USER INTENT:
- "Create estimate for X" or "Generate estimate for X" → REPLACE existing items (replaceExisting: true)
- "Increase budget to $X" or "Change budget to $X" → REPLACE with new budget (replaceExisting: true)
- "Reduce budget to $X" or "Lower to $X" → REPLACE with new budget (replaceExisting: true)
- "Add item X" or "Also include X" → ADD to existing items (replaceExisting: false)

Example: "$5000 bathroom remodel" = Pick 3-5 essential items totaling $4500-$5500, NOT 15 items totaling $14000

CRITICAL - RESPONSE FORMAT:
You MUST respond with ONLY a JSON object. NO explanations, NO questions, NO other text.
Even if you need more info, respond with: {"replaceExisting": true, "items": [], "needsMoreInfo": true, "message": "your question"}

Valid response format:
{"replaceExisting": true, "items": [{"priceListItemId":"pl-1","quantity":2,"notes":"essential item"}]}

NEVER respond with plain text. ALWAYS use JSON format above.`;

      // Call OpenAI directly from client to avoid Vercel timeout issues
      const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

      console.log('[AI Estimate] OpenAI API key present:', !!apiKey);
      console.log('[AI Estimate] Using expo-constants:', !!Constants.expoConfig?.extra?.openaiApiKey);

      if (!apiKey) {
        Alert.alert('Error', 'OpenAI API key not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your environment variables.');
        return;
      }

      console.log('[AI Estimate] Calling OpenAI API with Vision...');
      console.log('[AI Estimate] Text input:', textInput);
      console.log('[AI Estimate] Attached files for vision:', attachedFilesData.length);

      // Build the current user message
      const userPromptText = attachedFilesData.length > 0
        ? `${textInput || 'Analyze the attached construction documents and generate estimate items.'}\n\nGenerate estimate items based on the ${attachedFilesData.length} attached image(s).`
        : `${textInput}\n\n⚠️ CRITICAL INSTRUCTIONS ⚠️\n1. Analyze if user wants to REPLACE existing items or ADD to them\n2. If budget is mentioned, final total MUST be within ±10% of that amount\n3. DO NOT exceed budget by 2x or more\n4. Set replaceExisting=true if user says "change budget", "increase to", "decrease to", or starting fresh\n5. Set replaceExisting=false if user says "add", "also include", "plus"\n\nRespond with JSON object containing replaceExisting flag and items array.`;

      const currentUserMessage = textInput; // Store just text for conversation history

      // Build message content with text and images
      const userMessageContent: any[] = [
        { type: 'text', text: userPromptText },
        ...attachedFilesData,
      ];

      // Build messages array with conversation history
      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        // Add existing items context only in the first message
        ...(conversationHistory.length === 0 && existingItemsContext ? [{
          role: 'system' as const,
          content: existingItemsContext
        }] : []),
        // Add all previous conversation
        ...conversationHistory,
        // Add current user message with vision content
        {
          role: 'user' as const,
          content: conversationHistory.length === 0 ? userMessageContent : currentUserMessage,
        }
      ];

      console.log('[AI Estimate] Conversation history length:', conversationHistory.length);
      console.log('[AI Estimate] Message content items:', userMessageContent.length);
      console.log('[AI Estimate] Sample message structure:', JSON.stringify({
        role: messages[messages.length - 1].role,
        contentType: typeof messages[messages.length - 1].content,
        contentItems: Array.isArray(messages[messages.length - 1].content)
          ? messages[messages.length - 1].content.length
          : 'string',
      }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Use gpt-4o for vision capabilities
          messages: messages,
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });

      console.log('[AI Estimate] OpenAI API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Estimate] OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[AI Estimate] OpenAI API success, processing response...');

      const result = {
        success: true,
        message: data.choices[0]?.message?.content || '',
        usage: data.usage,
      };

      console.log('[AI Estimate] API Response length:', result.message.length);
      console.log('[AI Estimate] API Response preview:', result.message.substring(0, 200));

      if (!result.success) {
        const errorMsg = 'error' in result ? result.error : 'Failed to generate estimate';
        throw new Error(errorMsg);
      }
      
      let aiGeneratedItems = [];
      let shouldReplace = true; // Default to replace for backward compatibility

      try {
        const content = result.message || '';
        console.log('[AI Estimate] Parsing response content...');

        // Try to parse as object with replaceExisting flag first
        const objectMatch = content.match(/\{\s*"replaceExisting"[\s\S]*\}/);
        if (objectMatch) {
          console.log('[AI Estimate] Found object format response');
          const parsed = JSON.parse(objectMatch[0]);
          shouldReplace = parsed.replaceExisting !== false; // Default to true if not specified
          aiGeneratedItems = parsed.items || [];
          console.log('[AI Estimate] Parsed items:', aiGeneratedItems.length, 'shouldReplace:', shouldReplace);

          // Check if AI is requesting more information
          if (parsed.needsMoreInfo && parsed.message) {
            console.log('[AI Estimate] AI requesting more context:', parsed.message);
            console.log('[AI Estimate] Showing alert to user...');
            setTimeout(() => {
              Alert.alert(
                'AI Needs More Details',
                parsed.message + '\n\nNote: The AI should be reading the attached documents. If this keeps happening, the PDF quality might be poor or the AI cannot extract information from it.',
                [{ text: 'OK', onPress: () => console.log('[AI Estimate] User dismissed alert') }]
              );
            }, 100);
            return;
          }
        } else {
          // Fallback to old array format for backward compatibility
          console.log('[AI Estimate] Looking for array format response');
          const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            console.log('[AI Estimate] Found array format response');
            aiGeneratedItems = JSON.parse(arrayMatch[0]);
            shouldReplace = existingItems.length === 0; // Only replace if no existing items
            console.log('[AI Estimate] Parsed items:', aiGeneratedItems.length);
          } else {
            console.error('[AI Estimate] No valid JSON found in response. Content:', content);
            throw new Error('No valid JSON found in response');
          }
        }
      } catch (parseError: any) {
        console.error('[AI Estimate] Failed to parse AI response:', parseError);
        console.error('[AI Estimate] Parse error details:', parseError?.message);
        Alert.alert('Error', `Failed to parse AI response: ${parseError?.message}\n\nThe AI may have returned an unexpected format.`);
        return;
      }

      const generatedItems: EstimateItem[] = [];
      
      for (const aiItem of aiGeneratedItems) {
        if (aiItem.priceListItemId && aiItem.priceListItemId !== 'custom') {
          // Check both master and custom price list items
          let priceListItem = masterPriceList.find(pl => pl.id === aiItem.priceListItemId);
          if (!priceListItem) {
            priceListItem = customPriceListItems.find(pl => pl.id === aiItem.priceListItemId);
          }
          if (priceListItem) {
            const estimateItem: EstimateItem = {
              id: `ai-generated-${Date.now()}-${generatedItems.length}`,
              priceListItemId: priceListItem.id,
              quantity: aiItem.quantity || 1,
              unitPrice: priceListItem.unitPrice,
              total: (aiItem.quantity || 1) * priceListItem.unitPrice,
              notes: aiItem.notes || 'Generated by AI',
            };
            generatedItems.push(estimateItem);
            console.log('[AI Estimate] Added price list item:', priceListItem.name);
          }
        } else if (aiItem.customName) {
          const estimateItem: EstimateItem = {
            id: `ai-generated-${Date.now()}-${generatedItems.length}`,
            priceListItemId: 'custom',
            quantity: aiItem.quantity || 1,
            unitPrice: aiItem.customPrice || 0,
            total: (aiItem.quantity || 1) * (aiItem.customPrice || 0),
            notes: aiItem.notes || 'Custom item generated by AI',
            customName: aiItem.customName,
            customUnit: aiItem.customUnit || 'EA',
            customCategory: 'Custom',
          };
          generatedItems.push(estimateItem);
          console.log('[AI Estimate] Added custom item:', aiItem.customName);
        }
      }

      console.log('[AI Estimate] Processing complete. Generated items count:', generatedItems.length);
      console.log('[AI Estimate] AI returned items count:', aiGeneratedItems.length);

      if (generatedItems.length === 0) {
        console.warn('[AI Estimate] No items were generated from AI response');
        const hasDocuments = attachedFiles.some(f => !f.type.startsWith('image'));
        const suggestion = hasDocuments
          ? 'Since you attached a document, please describe what type of work this is for.\n\nExample: "Kitchen remodel with the attached scope document" or "Bathroom renovation as outlined in the PDF"'
          : 'Please provide more details about the scope of work.\n\nExample: "Replace kitchen cabinets, install granite countertops, paint walls"';

        Alert.alert(
          'Need More Details',
          `The AI couldn't generate any items from your description.\n\n${suggestion}`
        );
        return;
      }

      // Budget validation: Check if estimate exceeds specified budget
      const budgetMatch = textInput.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)?/i);
      if (budgetMatch) {
        let budgetAmount = parseFloat(budgetMatch[1].replace(/,/g, ''));

        // Handle "5k" or "5K" format
        if (/k|thousand/i.test(budgetMatch[0])) {
          budgetAmount *= 1000;
        }

        const estimateTotal = generatedItems.reduce((sum, item) => sum + item.total, 0);
        const maxAllowedTotal = budgetAmount * 1.1; // 10% over budget max

        console.log('[AI Estimate] Budget:', budgetAmount, 'Generated total:', estimateTotal);

        if (estimateTotal > maxAllowedTotal) {
          // Estimate exceeds budget - remove items from end until it fits
          console.log('[AI Estimate] Total exceeds budget, trimming items...');
          let runningTotal = 0;
          const budgetCompliantItems: EstimateItem[] = [];

          for (const item of generatedItems) {
            if (runningTotal + item.total <= maxAllowedTotal) {
              budgetCompliantItems.push(item);
              runningTotal += item.total;
            } else {
              break;
            }
          }

          if (budgetCompliantItems.length > 0) {
            console.log('[AI Estimate] Trimmed to', budgetCompliantItems.length, 'items to fit budget');

            // Update conversation history
            setConversationHistory(prev => [
              ...prev,
              { role: 'user', content: currentUserMessage },
              { role: 'assistant', content: result.message }
            ]);

            onGenerate(budgetCompliantItems, shouldReplace);
            setTextInput('');
            const action = shouldReplace ? 'Replaced estimate with' : 'Added';
            Alert.alert(
              'Estimate Generated',
              `${action} ${budgetCompliantItems.length} items (${generatedItems.length - budgetCompliantItems.length} items removed to fit $${budgetAmount.toLocaleString()} budget). Total: $${runningTotal.toFixed(2)}`
            );
            return;
          }
        }
      }

      console.log('[AI Estimate] Generated', generatedItems.length, 'items, shouldReplace:', shouldReplace);

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: currentUserMessage },
        { role: 'assistant', content: result.message }
      ]);

      onGenerate(generatedItems, shouldReplace);
      setTextInput('');
      const action = shouldReplace ? 'Replaced estimate with' : 'Added';
      Alert.alert('Success', `${action} ${generatedItems.length} line items from your description.`);
    } catch (error: any) {
      console.error('[AI Estimate] Generation error:', error);
      console.error('[AI Estimate] Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert('Error', `Failed to generate estimate: ${errorMessage}\n\nPlease check the console for details.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.aiModalContent]}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Generate Estimate with AI</Text>
              <Text style={styles.modalSubtitle}>
                {conversationHistory.length > 0
                  ? `Conversation active (${conversationHistory.length / 2} messages)`
                  : 'Describe the scope of work and AI will generate line items'}
              </Text>
            </View>
            {conversationHistory.length > 0 && (
              <TouchableOpacity
                style={styles.newChatButton}
                onPress={handleClearConversation}
              >
                <Text style={styles.newChatButtonText}>New Chat</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.modalLabel}>Scope of Work *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.modalInput, styles.aiTextArea, styles.textInputWithActions]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="e.g., Replace 10 linear feet of base cabinets, install new countertop, paint kitchen walls, etc."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={[styles.inputActionButton, isRecording && styles.inputActionButtonActive]}
                onPress={handleMicrophone}
              >
                {isRecording ? (
                  <Square size={24} color="#EF4444" fill="#EF4444" />
                ) : (
                  <Mic size={24} color="#6B7280" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inputActionButton}
                onPress={handleCameraOrFile}
              >
                <Paperclip size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {attachedFiles.length > 0 && (
            <View style={styles.attachedFilesContainer}>
              {attachedFiles.map((file, index) => (
                <View key={index} style={styles.attachedFileChip}>
                  <Camera size={14} color="#2563EB" />
                  <Text style={styles.attachedFileName}>{file.name}</Text>
                  <TouchableOpacity onPress={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}>
                    <Text style={styles.removeFileButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.aiInfoBox}>
            <Sparkles size={16} color="#8B5CF6" />
            <Text style={styles.aiInfoText}>AI will analyze your description and suggest appropriate line items with quantities and pricing from your price list</Text>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={onClose}
              disabled={isGenerating}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.aiGenerateButtonModal, isGenerating && styles.aiGenerateButtonDisabled]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              <Sparkles size={16} color="#FFFFFF" />
              <Text style={styles.aiGenerateButtonModalText}>{isGenerating ? 'Generating...' : 'Generate Estimate'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Platform.select({ web: 10, default: 11 }) as number,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 2,
  },
  headerInput: {
    fontSize: Platform.select({ web: 13, default: 14 }) as number,
    fontWeight: '700' as const,
    color: '#1F2937',
    padding: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    minWidth: 200,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
    outlineStyle: 'none' as any,
  },
  searchClear: {
    padding: 4,
    marginLeft: 4,
  },
  categoryBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  newAssemblyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  newAssemblyButtonText: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  categoryBarContent: {
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  categoryTabActive: {
    backgroundColor: '#2563EB',
  },
  categoryTabText: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    marginRight: 8,
  },
  addCategoryButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContentNarrow: {
    flexDirection: 'column',
  },
  itemSelectionSection: {
    flex: 1,
    minWidth: 280,
    maxWidth: 380,
  },
  itemSelectionSectionWeb: {
    width: '40%',
    minWidth: 320,
  },
  itemSelectionSectionNarrow: {
    maxHeight: 250,
    maxWidth: '100%',
  },
  itemsListContent: {
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  addCustomButtonText: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  selectedItemsSection: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    minWidth: 450,
  },
  selectedItemsSectionWeb: {
    width: '60%',
    minWidth: 450,
  },
  selectedItemsSectionNarrow: {
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flex: 2,
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  rightTotalsPanel: {
    width: 220,
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    paddingVertical: 16,
  },
  rightPanelContent: {
    paddingHorizontal: 16,
  },
  rightPanelTotalItem: {
    marginBottom: 16,
  },
  rightPanelLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500' as const,
  },
  rightPanelValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  rightPanelBudgetValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  rightPanelEditableItem: {
    marginBottom: 16,
  },
  rightPanelEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rightPanelPercentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: '#1F2937',
  },
  rightPanelPercentSign: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  rightPanelCalculatedValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  rightPanelDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  rightPanelGrandTotal: {
    marginBottom: 16,
  },
  rightPanelGrandTotalLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600' as const,
  },
  rightPanelGrandTotalValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  rightPanelToggles: {
    gap: 12,
  },
  rightPanelToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rightPanelToggleText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500' as const,
  },
  selectedItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  aiGenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    flexShrink: 1,
    minWidth: 0,
  },
  aiGenerateButtonText: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#8B5CF6',
    flexShrink: 1,
  },
  lineItemCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginHorizontal: 10,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lineItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineItemName: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '500' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  lineItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineItemUnit: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    color: '#6B7280',
    fontWeight: '500' as const,
    minWidth: 30,
  },
  lineItemPrice: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '700' as const,
    color: '#1F2937',
    minWidth: 60,
    textAlign: 'right',
  },
  editItemButton: {
    backgroundColor: '#F3F4F6',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  addItemButton: {
    backgroundColor: '#2563EB',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedBottomSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 998,
  },
  totalsScrollContainer: {
    maxHeight: 80,
    marginBottom: 8,
  },
  totalsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  compactTotalItem: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 120,
    alignItems: 'center',
  },
  budgetItem: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  compactTotalLabel: {
    fontSize: Platform.select({ web: 10, default: 10 }) as number,
    color: '#6B7280',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  compactTotalValue: {
    fontSize: Platform.select({ web: 13, default: 14 }) as number,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  compactBudgetLabel: {
    fontSize: Platform.select({ web: 10, default: 10 }) as number,
    color: '#10B981',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  compactBudgetValue: {
    fontSize: Platform.select({ web: 13, default: 14 }) as number,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  compactEditableItem: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 120,
    alignItems: 'center',
  },
  compactEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  compactPercentInput: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 36,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
  },
  compactPercentSign: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginLeft: 2,
  },
  compactCalculatedValue: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginTop: 2,
  },
  compactGrandTotalItem: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
  },
  compactGrandTotalLabel: {
    fontSize: Platform.select({ web: 10, default: 11 }) as number,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  compactGrandTotalValue: {
    fontSize: Platform.select({ web: 15, default: 16 }) as number,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#6B7280',
    flexShrink: 0,
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  estimateItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    marginBottom: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  itemNameInput: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    padding: 2,
  },
  itemMetaRow: {
    marginBottom: 3,
  },
  itemCategory: {
    fontSize: Platform.select({ web: 9, default: 10 }) as number,
    color: '#2563EB',
    fontWeight: '500' as const,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  itemDetailsRowNarrow: {
    gap: 8,
  },
  quantityControl: {
    flex: 1.6,
    minWidth: 100,
  },
  quantityControlNarrow: {
    flex: 1.4,
    minWidth: 80,
  },
  unitControl: {
    flex: 0.9,
    minWidth: 60,
  },
  unitControlNarrow: {
    flex: 0.8,
    minWidth: 50,
  },
  priceControl: {
    flex: 1.5,
    minWidth: 90,
  },
  priceControlNarrow: {
    flex: 1.2,
    minWidth: 70,
  },
  budgetControl: {
    flex: 1.5,
    minWidth: 90,
  },
  budgetControlNarrow: {
    flex: 1.2,
    minWidth: 70,
  },
  totalControl: {
    flex: 1.5,
    minWidth: 90,
  },
  totalControlNarrow: {
    flex: 1.2,
    minWidth: 70,
  },
  totalControlFull: {
    flex: 4,
  },
  itemLabel: {
    fontSize: Platform.select({ web: 9, default: 10 }) as number,
    color: '#6B7280',
    marginBottom: 3,
    fontWeight: '500' as const,
  },
  itemLabelNarrow: {
    fontSize: Platform.select({ web: 8, default: 9 }) as number,
    marginBottom: 2,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityButton: {
    width: 24,
    height: 24,
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonNarrow: {
    width: 20,
    height: 20,
  },
  quantityButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  quantityButtonTextNarrow: {
    fontSize: 12,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 24,
    textAlign: 'center',
  },
  quantityTextInput: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 50,
    textAlign: 'center',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quantityTextInputNarrow: {
    fontSize: Platform.select({ web: 10, default: 12 }) as number,
    minWidth: 35,
    padding: 3,
  },
  unitValue: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  unitValueNarrow: {
    fontSize: Platform.select({ web: 9, default: 11 }) as number,
  },
  unitInput: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
  },
  unitInputNarrow: {
    fontSize: 11,
    padding: 2,
  },
  priceValue: {
    fontSize: Platform.select({ web: 12, default: 13 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  priceValueNarrow: {
    fontSize: Platform.select({ web: 9, default: 11 }) as number,
  },
  totalValue: {
    fontSize: Platform.select({ web: 13, default: 14 }) as number,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  totalValueNarrow: {
    fontSize: Platform.select({ web: 10, default: 12 }) as number,
  },
  priceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceEditRowNarrow: {
    gap: 1,
  },
  dollarSign: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginRight: 2,
  },
  dollarSignNarrow: {
    fontSize: 11,
    marginRight: 1,
  },
  priceInput: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
    minWidth: 60,
  },
  priceInputNarrow: {
    fontSize: 12,
    padding: 3,
    minWidth: 45,
  },
  notesSection: {
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    color: '#1F2937',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  itemPhotoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemPhotoPreview: {
    position: 'relative',
  },
  itemPhotoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 2,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    marginTop: 2,
    marginBottom: 10,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
  },
  signatureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
  },
  visibilityToggle: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  toggleButtonText: {
    fontSize: Platform.select({ web: 10, default: 10 }) as number,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  editableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editableInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentInput: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 40,
    textAlign: 'right',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
  },
  percentSign: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  calculatedValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginLeft: 8,
    minWidth: 60,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  categoryBottomSpace: {
    height: 20,
  },
  addTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    gap: 8,
  },
  addTemplateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  deleteCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  deleteCategoryButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  newChatButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  newChatButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalAddButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '95%',
    maxWidth: 600,
    maxHeight: '85%',
    overflow: 'hidden',
    zIndex: 10000,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
  },
  previewCompanyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  previewCompanyLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  previewCompanyInfo: {
    flex: 1,
  },
  previewCompanyName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 2,
  },
  previewCompanySlogan: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  previewCompanyDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewCompanyDetailText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 3,
  },
  previewProjectName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  previewEstimateName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  previewDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#374151',
    marginBottom: 12,
  },
  previewLineItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  previewItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  previewItemDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  previewItemNotes: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  previewItemImage: {
    width: 180,
    height: 120,
    marginTop: 8,
    borderRadius: 4,
  },
  previewTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewTotalLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  previewTotalValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  previewGrandTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#2563EB',
  },
  previewGrandTotalLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  previewGrandTotalValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  previewFooter: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  previewActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewCloseButton: {
    margin: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewCloseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  budgetInput: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
    minWidth: 50,
  },
  budgetInputNarrow: {
    fontSize: 11,
    padding: 2,
    minWidth: 35,
  },
  budgetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  budgetTotalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  budgetTotalValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#10B981',
  },

  budgetTotalText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#10B981',
    marginTop: 2,
  },
  budgetTotalTextNarrow: {
    fontSize: 9,
  },
  separatorItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  separatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  separatorLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#374151',
  },
  separatorLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#374151',
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  separatorDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  addBreakPointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#374151',
    flexShrink: 1,
    minWidth: 0,
  },
  addBreakPointButtonText: {
    fontSize: Platform.select({ web: 11, default: 12 }) as number,
    fontWeight: '600' as const,
    color: '#374151',
    flexShrink: 1,
  },
  previewSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  previewSeparatorLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#374151',
  },
  previewSeparatorLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#374151',
    letterSpacing: 1,
  },
  aiModalContent: {
    maxWidth: 650,
  },
  aiTextArea: {
    minHeight: 150,
    maxHeight: 250,
  },
  aiInfoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    marginBottom: 16,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  aiGenerateButtonModal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  aiGenerateButtonModalText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  aiGenerateButtonDisabled: {
    opacity: 0.6,
  },
  inputContainer: {
    position: 'relative' as const,
    marginBottom: 8,
  },
  textInputWithActions: {
    paddingRight: 100,
    marginBottom: 0,
  },
  inputActions: {
    position: 'absolute' as const,
    right: 8,
    bottom: 24,
    flexDirection: 'row',
    gap: 8,
  },
  inputActionButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputActionButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  attachedFilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  attachedFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  attachedFileName: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500' as const,
  },
  removeFileButton: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
});
