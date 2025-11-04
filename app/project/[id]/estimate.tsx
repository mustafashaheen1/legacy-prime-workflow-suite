import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList, Platform, Linking, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Plus, Trash2, Check, Edit2, Send, FileSignature, Eye, EyeOff } from 'lucide-react-native';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { masterPriceList, PriceListItem, priceListCategories, CustomPriceListItem, CustomCategory } from '@/mocks/priceList';
import { EstimateItem, Estimate, ProjectFile } from '@/types';

export default function EstimateScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, addEstimate, customPriceListItems, addCustomPriceListItem, customCategories, addCustomCategory, deleteCustomCategory, addProjectFile } = useApp();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const isNarrow = screenWidth < 800;
  
  const [estimateName, setEstimateName] = useState<string>('');
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(priceListCategories[0]);
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

  const project = projects.find(p => p.id === id);

  const allCategories = useMemo(() => {
    return [...priceListCategories, ...customCategories.map(cat => cat.name)];
  }, [customCategories]);

  const loadDraft = useCallback(async () => {
    if (!id) return;
    try {
      const draftKey = `estimate_draft_${id}`;
      const storedDraft = await AsyncStorage.getItem(draftKey);
      
      if (storedDraft) {
        const draft = JSON.parse(storedDraft);
        console.log('[Draft] Loaded existing draft for project:', id);
        setEstimateName(draft.estimateName || `${project?.name} - Estimate ${new Date().toLocaleDateString()}`);
        setItems(draft.items || []);
        setMarkupPercent(draft.markupPercent || '0');
        setTaxPercent(draft.taxPercent || '8');
        setDraftId(draft.draftId || `draft-${Date.now()}`);
      } else if (project && !estimateName) {
        const defaultName = `${project.name} - Estimate ${new Date().toLocaleDateString()}`;
        setEstimateName(defaultName);
      }
    } catch (error) {
      console.error('[Draft] Error loading draft:', error);
    } finally {
      setIsLoadingDraft(false);
    }
  }, [id, project, estimateName]);

  useEffect(() => {
    if (project && id) {
      loadDraft();
    }
  }, [project, id, loadDraft]);

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
    if (!id) return;
    try {
      const draftKey = `estimate_draft_${id}`;
      await AsyncStorage.removeItem(draftKey);
      console.log('[Draft] Cleared draft for project:', id);
    } catch (error) {
      console.error('[Draft] Error clearing draft:', error);
    }
  };

  const saveEstimateAsFile = async (estimate: Estimate) => {
    try {
      const estimateData = JSON.stringify(estimate, null, 2);
      const file: ProjectFile = {
        id: `file-estimate-${estimate.id}-${Date.now()}`,
        projectId: id as string,
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

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
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
    const masterItems = masterPriceList.filter(item => item.category === category);
    const customItems = customPriceListItems.filter(item => item.category === category);
    return [...masterItems, ...customItems];
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
    const totals = validateEstimate();
    if (!totals) return;

    const { subtotal, taxAmount, total } = totals;

    const newEstimate: Estimate = {
      id: `estimate-${Date.now()}`,
      projectId: id as string,
      name: estimateName,
      items,
      subtotal,
      taxRate: parseFloat(taxPercent) || 0,
      taxAmount,
      total,
      createdDate: new Date().toISOString(),
      status: 'draft',
    };

    addEstimate(newEstimate);
    await saveEstimateAsFile(newEstimate);
    await clearDraft();
    
    Alert.alert('Success', 'Estimate saved successfully and stored in project files', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const sendEstimateAsPDF = async () => {
    const totals = validateEstimate();
    if (!totals) return;

    const { subtotal, markupAmount, subtotalWithMarkup, taxAmount, total } = totals;

    const newEstimate: Estimate = {
      id: `estimate-${Date.now()}`,
      projectId: id as string,
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
      const itemName = isCustom ? (item.customName || 'Custom Item') : (priceListItem?.name || '');
      const itemUnit = isCustom ? (item.customUnit || 'EA') : (priceListItem?.unit || '');
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

    const emailBody = `Hi,\n\nPlease find your estimate for ${estimateName}.\n\nPROJECT: ${project.name}\n\n--- LINE ITEMS ---\n${itemsText}\n\n${totalsText}\n\nPlease review and let us know if you have any questions.\n\nBest regards,\nLegacy Prime Construction`;
    
    const emailUrl = `mailto:?subject=${encodeURIComponent(`Estimate: ${estimateName}`)}&body=${encodeURIComponent(emailBody)}`;
    
    if (Platform.OS === 'web') {
      window.open(emailUrl, '_blank');
    } else {
      Linking.openURL(emailUrl).catch(() => {
        Alert.alert('Error', 'Unable to open email client');
      });
    }

    Alert.alert(
      'Success', 
      'Estimate saved to project files and email prepared! Your email client should open with the estimate details.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const requestSignature = async () => {
    const totals = validateEstimate();
    if (!totals) return;

    const { subtotal, markupAmount, subtotalWithMarkup, taxAmount, total } = totals;

    const newEstimate: Estimate = {
      id: `estimate-${Date.now()}`,
      projectId: id as string,
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
      const itemName = isCustom ? (item.customName || 'Custom Item') : (priceListItem?.name || '');
      const itemUnit = isCustom ? (item.customUnit || 'EA') : (priceListItem?.unit || '');
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

    const emailBody = `Hi,\n\nWe're ready to move forward with your project!\n\nPROJECT: ${project.name}\nESTIMATE: ${estimateName}\n\n--- LINE ITEMS ---\n${itemsText}\n\n${totalsText}\n\nPlease review and sign this estimate to approve the project. Once approved, we'll convert this to an active project and begin work.\n\nClick here to review and sign: [Digital Signature Link]\n\nBest regards,\nLegacy Prime Construction`;
    
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
      'Estimate saved to project files and signature request sent! Your email client should open with the estimate details.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const getPriceListItem = (priceListItemId: string): PriceListItem | undefined => {
    if (priceListItemId === 'custom') return undefined;
    return masterPriceList.find(item => item.id === priceListItemId);
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
        <ScrollView style={[styles.itemSelectionSection, isNarrow && styles.itemSelectionSectionNarrow]} showsVerticalScrollIndicator={false}>
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

        <View style={[styles.selectedItemsSection, isNarrow && styles.selectedItemsSectionNarrow]}>
          <View style={styles.selectedItemsHeader}>
            <Text style={styles.sectionLabel}>Selected Items ({items.filter(i => !i.isSeparator).length})</Text>
            <TouchableOpacity 
              style={styles.addBreakPointButton}
              onPress={() => setShowAddSeparatorModal(true)}
            >
              <Plus size={16} color="#F59E0B" />
              <Text style={styles.addBreakPointButtonText}>Break Point</Text>
            </TouchableOpacity>
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
              const itemName = isCustom ? (item.customName || 'Custom Item') : (priceListItem?.name || '');
              const itemUnit = isCustom ? (item.customUnit || 'EA') : (priceListItem?.unit || '');
              const itemCategory = isCustom ? (item.customCategory || 'Custom') : (priceListItem?.category || '');

              return (
                <View key={item.id} style={styles.estimateItem}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleRow}>
                      {isCustom && isEditing ? (
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
                          {isCustom && isEditing ? (
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
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {items.length > 0 && (
        <View style={styles.fixedBottomSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            style={styles.totalsScrollContainer}
            contentContainerStyle={styles.totalsScrollContent}
          >
            <View style={styles.compactTotalItem}>
              <Text style={styles.compactTotalLabel}>Subtotal</Text>
              <Text style={styles.compactTotalValue}>${subtotal.toFixed(2)}</Text>
            </View>
            
            {showBudget && totalBudget > 0 && (
              <View style={[styles.compactTotalItem, styles.budgetItem]}>
                <Text style={styles.compactBudgetLabel}>Budget</Text>
                <Text style={styles.compactBudgetValue}>${totalBudget.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.compactEditableItem}>
              <Text style={styles.compactTotalLabel}>Markup</Text>
              <View style={styles.compactEditRow}>
                <TextInput
                  style={styles.compactPercentInput}
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
                <Text style={styles.compactPercentSign}>%</Text>
              </View>
              <Text style={styles.compactCalculatedValue}>${markupAmount.toFixed(2)}</Text>
            </View>
            
            <View style={styles.compactEditableItem}>
              <Text style={styles.compactTotalLabel}>Tax</Text>
              <View style={styles.compactEditRow}>
                <TextInput
                  style={styles.compactPercentInput}
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
                <Text style={styles.compactPercentSign}>%</Text>
              </View>
              <Text style={styles.compactCalculatedValue}>${taxAmount.toFixed(2)}</Text>
            </View>
            
            <View style={styles.compactGrandTotalItem}>
              <Text style={styles.compactGrandTotalLabel}>TOTAL</Text>
              <Text style={styles.compactGrandTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </ScrollView>

          <View style={styles.visibilityToggle}>
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setShowUnitsQty(!showUnitsQty)}
            >
              {showUnitsQty ? (
                <Eye size={16} color="#2563EB" />
              ) : (
                <EyeOff size={16} color="#6B7280" />
              )}
              <Text style={styles.toggleButtonText}>
                {showUnitsQty ? 'Hide' : 'Show'} Units & Qty
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setShowBudget(!showBudget)}
            >
              {showBudget ? (
                <Eye size={16} color="#10B981" />
              ) : (
                <EyeOff size={16} color="#6B7280" />
              )}
              <Text style={styles.toggleButtonText}>
                {showBudget ? 'Hide' : 'Show'} Budget
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={saveEstimate}
            >
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save</Text>
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
                <Text style={styles.previewCompanyName}>Legacy Prime Construction</Text>
                <Text style={styles.previewProjectName}>PROJECT: {project.name}</Text>
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
                  const itemName = isCustom ? (item.customName || 'Custom Item') : (priceListItem?.name || '');
                  const itemUnit = isCustom ? (item.customUnit || 'EA') : (priceListItem?.unit || '');
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

                <Text style={styles.previewFooter}>
                  Thank you for your business! Please review and let us know if you have any questions.
                </Text>
              </View>
            </ScrollView>

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
    paddingVertical: 12,
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
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 4,
  },
  headerInput: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    padding: 0,
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
    fontSize: 13,
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
    fontSize: 13,
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
    minWidth: 320,
  },
  itemSelectionSectionNarrow: {
    maxHeight: 250,
  },
  itemsListContent: {
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
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
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  selectedItemsSection: {
    flex: 1.5,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    minWidth: 400,
  },
  selectedItemsSectionNarrow: {
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flex: 2,
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
  },
  lineItemCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginHorizontal: 12,
    marginTop: 8,
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
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  lineItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineItemUnit: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500' as const,
    minWidth: 30,
  },
  lineItemPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
    minWidth: 60,
    textAlign: 'right',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  compactTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  compactBudgetLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  compactBudgetValue: {
    fontSize: 16,
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
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginLeft: 2,
  },
  compactCalculatedValue: {
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  compactGrandTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  estimateItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  itemNameInput: {
    fontSize: 15,
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
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  itemMetaRow: {
    marginBottom: 8,
  },
  itemCategory: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500' as const,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
    fontWeight: '500' as const,
  },
  itemLabelNarrow: {
    fontSize: 10,
    marginBottom: 3,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonNarrow: {
    width: 22,
    height: 22,
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  quantityButtonTextNarrow: {
    fontSize: 14,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 24,
    textAlign: 'center',
  },
  quantityTextInput: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    minWidth: 50,
    textAlign: 'center',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quantityTextInputNarrow: {
    fontSize: 12,
    minWidth: 35,
    padding: 3,
  },
  unitValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  unitValueNarrow: {
    fontSize: 11,
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
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  priceValueNarrow: {
    fontSize: 11,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  totalValueNarrow: {
    fontSize: 12,
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
    fontSize: 15,
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
    fontSize: 13,
    color: '#1F2937',
    minHeight: 56,
    textAlignVertical: 'top',
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
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 10,
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
  previewCompanyName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
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
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
  },
  separatorLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F59E0B',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  addBreakPointButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#F59E0B',
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
    backgroundColor: '#F59E0B',
  },
  previewSeparatorLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#F59E0B',
    letterSpacing: 1,
  },
});
