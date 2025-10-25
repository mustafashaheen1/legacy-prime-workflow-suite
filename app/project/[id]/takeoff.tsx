import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, Upload, Plus, Trash2, Check, X, Ruler, Square, MapPin, Save, Sparkles, Tag, ZoomIn, ZoomOut, Download, Settings, Grid3x3, Edit3 } from 'lucide-react-native';
import { useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { masterPriceList, PriceListItem, priceListCategories } from '@/mocks/priceList';
import { TakeoffMeasurement, TakeoffPlan, EstimateItem, Estimate } from '@/types';
import Svg, { Circle, Polygon, Path, Line, Text as SvgText } from 'react-native-svg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MEASUREMENT_COLORS = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

const ARCHITECTURAL_SCALES = [
  { label: '1/128" = 1\'', ratio: 1536, description: '1:1536' },
  { label: '1/64" = 1\'', ratio: 768, description: '1:768' },
  { label: '1/32" = 1\'', ratio: 384, description: '1:384' },
  { label: '1/16" = 1\'', ratio: 192, description: '1:192' },
  { label: '3/32" = 1\'', ratio: 128, description: '1:128' },
  { label: '1/8" = 1\'', ratio: 96, description: '1:96' },
  { label: '3/16" = 1\'', ratio: 64, description: '1:64' },
  { label: '1/4" = 1\'', ratio: 48, description: '1:48 (Common)' },
  { label: '3/8" = 1\'', ratio: 32, description: '1:32' },
  { label: '1/2" = 1\'', ratio: 24, description: '1:24' },
  { label: '3/4" = 1\'', ratio: 16, description: '1:16' },
  { label: '1" = 1\'', ratio: 12, description: '1:12' },
  { label: '1-1/2" = 1\'', ratio: 8, description: '1:8' },
  { label: '3" = 1\'', ratio: 4, description: '1:4' },
  { label: '6" = 1\'', ratio: 2, description: '1:2' },
  { label: '12" = 1\'', ratio: 1, description: '1:1' },
];

export default function TakeoffScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, addEstimate } = useApp();
  const insets = useSafeAreaInsets();

  const [plans, setPlans] = useState<TakeoffPlan[]>([]);
  const [activePlanIndex, setActivePlanIndex] = useState<number>(0);
  const [measurementMode, setMeasurementMode] = useState<'count' | 'length' | 'area' | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [showItemPicker, setShowItemPicker] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(priceListCategories[0]);
  const [scale, setScale] = useState<number>(1);
  const [scaleDialogVisible, setScaleDialogVisible] = useState<boolean>(false);
  const [scaleInput, setScaleInput] = useState<string>('');
  const [overheadPercent, setOverheadPercent] = useState<number>(20);
  const [salesTaxPercent, setSalesTaxPercent] = useState<number>(10.5);
  const [showTotalsPanel, setShowTotalsPanel] = useState<boolean>(true);
  const [estimateName, setEstimateName] = useState<string>('');
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  const activePlan = plans[activePlanIndex];

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const newPlan: TakeoffPlan = {
        id: `plan-${Date.now()}`,
        uri: result.assets[0].uri,
        name: `Plan ${plans.length + 1}`,
        measurements: [],
        scale: 1,
      };
      setPlans(prev => [...prev, newPlan]);
      setActivePlanIndex(plans.length);
    }
  };

  const handleImagePress = (event: any) => {
    if (!measurementMode || !activePlan || !imageLayout) return;

    const { locationX, locationY } = event.nativeEvent;
    const relativeX = locationX / imageLayout.width;
    const relativeY = locationY / imageLayout.height;

    const newPoint = { x: relativeX, y: relativeY };
    setCurrentPoints(prev => [...prev, newPoint]);

    if (measurementMode === 'count') {
      setShowItemPicker(true);
    }
  };

  const finishMeasurement = () => {
    if (currentPoints.length < 2 && measurementMode !== 'count') {
      Alert.alert('Error', 'Need at least 2 points for this measurement');
      return;
    }
    setShowItemPicker(true);
  };

  const cancelMeasurement = () => {
    setCurrentPoints([]);
    setMeasurementMode(null);
  };

  const addMeasurementWithItem = (priceListItem: PriceListItem) => {
    if (!activePlan) return;

    let quantity = 1;
    
    if (measurementMode === 'length' && currentPoints.length >= 2) {
      let totalLength = 0;
      for (let i = 0; i < currentPoints.length - 1; i++) {
        const dx = currentPoints[i + 1].x - currentPoints[i].x;
        const dy = currentPoints[i + 1].y - currentPoints[i].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
      quantity = Math.round(totalLength * 1000 * scale);
    } else if (measurementMode === 'area' && currentPoints.length >= 3) {
      let area = 0;
      for (let i = 0; i < currentPoints.length; i++) {
        const j = (i + 1) % currentPoints.length;
        area += currentPoints[i].x * currentPoints[j].y;
        area -= currentPoints[j].x * currentPoints[i].y;
      }
      area = Math.abs(area / 2);
      quantity = Math.round(area * 1000000 * scale * scale);
    }

    const colorIndex = activePlan.measurements.length % MEASUREMENT_COLORS.length;
    const newMeasurement: TakeoffMeasurement = {
      id: `meas-${Date.now()}`,
      type: measurementMode!,
      points: currentPoints,
      quantity,
      priceListItemId: priceListItem.id,
      color: MEASUREMENT_COLORS[colorIndex],
    };

    setPlans(prev => prev.map((plan, idx) => 
      idx === activePlanIndex 
        ? { ...plan, measurements: [...plan.measurements, newMeasurement] }
        : plan
    ));

    setCurrentPoints([]);
    setMeasurementMode(null);
    setShowItemPicker(false);
  };

  const removeMeasurement = (measurementId: string) => {
    if (!activePlan) return;
    setPlans(prev => prev.map((plan, idx) => 
      idx === activePlanIndex 
        ? { ...plan, measurements: plan.measurements.filter(m => m.id !== measurementId) }
        : plan
    ));
  };

  const calculateTotals = () => {
    const allMeasurements = plans.flatMap(plan => plan.measurements);
    
    const subtotal = allMeasurements.reduce((sum, measurement) => {
      const priceListItem = masterPriceList.find(item => item.id === measurement.priceListItemId);
      if (!priceListItem) return sum;
      return sum + (measurement.quantity * priceListItem.unitPrice);
    }, 0);

    const overheadAmount = subtotal * (overheadPercent / 100);
    const subtotalWithOverhead = subtotal + overheadAmount;
    const taxAmount = subtotalWithOverhead * (salesTaxPercent / 100);
    const total = subtotalWithOverhead + taxAmount;

    return { subtotal, overheadAmount, subtotalWithOverhead, taxAmount, total };
  };

  const generateEstimate = () => {
    if (!estimateName.trim()) {
      Alert.alert('Error', 'Please enter an estimate name');
      return;
    }

    const allMeasurements = plans.flatMap(plan => plan.measurements);
    
    if (allMeasurements.length === 0) {
      Alert.alert('Error', 'Please add at least one measurement');
      return;
    }

    const items: EstimateItem[] = allMeasurements.map(measurement => {
      const priceListItem = masterPriceList.find(item => item.id === measurement.priceListItemId);
      if (!priceListItem) return null;

      return {
        id: `item-${measurement.id}`,
        priceListItemId: priceListItem.id,
        quantity: measurement.quantity,
        unitPrice: priceListItem.unitPrice,
        total: measurement.quantity * priceListItem.unitPrice,
        notes: measurement.notes || `From takeoff - ${measurement.type}`,
      };
    }).filter(Boolean) as EstimateItem[];

    const { subtotal, overheadAmount, taxAmount, total } = calculateTotals();

    const newEstimate: Estimate = {
      id: `estimate-${Date.now()}`,
      projectId: id as string,
      name: estimateName,
      items,
      subtotal,
      taxRate: salesTaxPercent / 100,
      taxAmount,
      total,
      createdDate: new Date().toISOString(),
      status: 'draft',
    };

    addEstimate(newEstimate);
    Alert.alert('Success', 'Estimate created from takeoff measurements', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleSetScale = () => {
    const scaleValue = parseFloat(scaleInput);
    if (scaleValue && scaleValue > 0) {
      setScale(scaleValue);
      setScaleDialogVisible(false);
      Alert.alert('Scale Set', `Scale set to 1:${scaleValue}`);
    } else {
      Alert.alert('Error', 'Please enter a valid scale value');
    }
  };

  const renderMeasurements = () => {
    if (!activePlan || !imageLayout) return null;

    return (
      <>
        {activePlan.measurements.map(measurement => {
          if (measurement.type === 'count') {
            return measurement.points.map((point, idx) => (
              <Circle
                key={`${measurement.id}-${idx}`}
                cx={point.x * imageLayout.width}
                cy={point.y * imageLayout.height}
                r={8}
                fill={measurement.color}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ));
          } else if (measurement.type === 'length') {
            const pathData = measurement.points.map((point, idx) => 
              `${idx === 0 ? 'M' : 'L'} ${point.x * imageLayout.width} ${point.y * imageLayout.height}`
            ).join(' ');
            return (
              <Path
                key={measurement.id}
                d={pathData}
                stroke={measurement.color}
                strokeWidth={3}
                fill="none"
              />
            );
          } else if (measurement.type === 'area') {
            const points = measurement.points.map(p => 
              `${p.x * imageLayout.width},${p.y * imageLayout.height}`
            ).join(' ');
            return (
              <Polygon
                key={measurement.id}
                points={points}
                fill={`${measurement.color}40`}
                stroke={measurement.color}
                strokeWidth={3}
              />
            );
          }
          return null;
        })}

        {currentPoints.map((point, idx) => (
          <Circle
            key={`current-${idx}`}
            cx={point.x * imageLayout.width}
            cy={point.y * imageLayout.height}
            r={6}
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        ))}

        {currentPoints.length > 1 && measurementMode === 'length' && (
          <Path
            d={currentPoints.map((point, idx) => 
              `${idx === 0 ? 'M' : 'L'} ${point.x * imageLayout.width} ${point.y * imageLayout.height}`
            ).join(' ')}
            stroke="#3B82F6"
            strokeWidth={3}
            fill="none"
          />
        )}
      </>
    );
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
            <Text style={styles.headerTitle}>Takeoff Tool</Text>
            <TextInput
              style={styles.headerInput}
              value={estimateName}
              onChangeText={setEstimateName}
              placeholder="Estimate name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={generateEstimate}
          >
            <Save size={20} color="#10B981" />
          </TouchableOpacity>
        </View>

        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Upload size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Upload construction plans to start takeoff</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Upload size={20} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload Plans from Device or Cloud</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.planTabs}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planTabsContent}>
                {plans.map((plan, index) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planTab, activePlanIndex === index && styles.activePlanTab]}
                    onPress={() => setActivePlanIndex(index)}
                  >
                    <Text style={[styles.planTabText, activePlanIndex === index && styles.activePlanTabText]}>
                      {plan.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addPlanButton} onPress={pickImage}>
                  <Plus size={16} color="#2563EB" />
                </TouchableOpacity>
              </ScrollView>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
              <View style={styles.toolbarContent}>
                <TouchableOpacity
                  style={styles.toolButtonPrimary}
                  onPress={() => setScaleDialogVisible(true)}
                >
                  <Ruler size={18} color="#FFFFFF" />
                  <Text style={styles.toolButtonPrimaryText}>Set Scale</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolButton, measurementMode === 'area' && styles.activeToolButton]}
                  onPress={() => {
                    setMeasurementMode('area');
                    setCurrentPoints([]);
                  }}
                >
                  <Square size={18} color={measurementMode === 'area' ? '#FFFFFF' : '#2563EB'} />
                  <Text style={[styles.toolButtonText, measurementMode === 'area' && styles.activeToolButtonText]}>
                    Draw Areas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolButton, measurementMode === 'count' && styles.activeToolButton]}
                  onPress={() => {
                    setMeasurementMode('count');
                    setCurrentPoints([]);
                  }}
                >
                  <MapPin size={18} color={measurementMode === 'count' ? '#FFFFFF' : '#2563EB'} />
                  <Text style={[styles.toolButtonText, measurementMode === 'count' && styles.activeToolButtonText]}>
                    Count Items
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolButton, measurementMode === 'length' && styles.activeToolButton]}
                  onPress={() => {
                    setMeasurementMode('length');
                    setCurrentPoints([]);
                  }}
                >
                  <Edit3 size={18} color={measurementMode === 'length' ? '#FFFFFF' : '#2563EB'} />
                  <Text style={[styles.toolButtonText, measurementMode === 'length' && styles.activeToolButtonText]}>
                    Trace Segments
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolButton}>
                  <Sparkles size={18} color="#2563EB" />
                  <Text style={styles.toolButtonText}>Takeoff with AI</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolButton}>
                  <Tag size={18} color="#2563EB" />
                  <Text style={styles.toolButtonText}>Anotate</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolButton}>
                  <Download size={18} color="#2563EB" />
                  <Text style={styles.toolButtonText}>Export</Text>
                </TouchableOpacity>

                {measurementMode && (
                  <>
                    {(measurementMode === 'length' || measurementMode === 'area') && currentPoints.length >= 2 && (
                      <TouchableOpacity style={styles.finishButton} onPress={finishMeasurement}>
                        <Check size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.cancelButtonToolbar} onPress={cancelMeasurement}>
                      <X size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.imageContainer}>
              <View
                style={styles.imageWrapper}
                onLayout={(event) => {
                  const { width, height, x, y } = event.nativeEvent.layout;
                  setImageLayout({ width, height, x, y });
                }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleImagePress}
                  disabled={!measurementMode}
                  style={styles.imageTouchable}
                >
                  <Image
                    source={{ uri: activePlan.uri }}
                    style={styles.planImage}
                    contentFit="contain"
                  />
                  {imageLayout && (
                    <Svg
                      style={StyleSheet.absoluteFill}
                      width={imageLayout.width}
                      height={imageLayout.height}
                    >
                      {renderMeasurements()}
                    </Svg>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {showTotalsPanel && (
              <View style={styles.totalsPanel}>
                <View style={styles.totalsPanelHeader}>
                  <Text style={styles.totalsPanelTitle}>Takeoff Summary</Text>
                  <TouchableOpacity onPress={() => setShowTotalsPanel(false)}>
                    <X size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.totalsScrollView} showsVerticalScrollIndicator={false}>
                  <View style={styles.totalsTable}>
                    <View style={styles.totalsTableHeader}>
                      <Text style={[styles.totalsTableHeaderText, { flex: 2 }]}>Description</Text>
                      <Text style={[styles.totalsTableHeaderText, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
                      <Text style={[styles.totalsTableHeaderText, { flex: 0.8, textAlign: 'right' }]}>Unit</Text>
                      <Text style={[styles.totalsTableHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
                    </View>

                    {activePlan.measurements.map(measurement => {
                      const priceListItem = masterPriceList.find(item => item.id === measurement.priceListItemId);
                      if (!priceListItem) return null;

                      return (
                        <View key={measurement.id} style={styles.totalsTableRow}>
                          <View style={[styles.colorIndicator, { backgroundColor: measurement.color }]} />
                          <Text style={[styles.totalsTableCell, { flex: 2 }]} numberOfLines={2}>
                            {priceListItem.name}
                          </Text>
                          <Text style={[styles.totalsTableCell, { flex: 0.8, textAlign: 'center' }]}>
                            {measurement.quantity}
                          </Text>
                          <Text style={[styles.totalsTableCell, { flex: 0.8, textAlign: 'right' }]}>
                            {priceListItem.unitPrice.toFixed(0)}
                          </Text>
                          <View style={{ flex: 1, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.totalsTableCellBold, { textAlign: 'right' }]}>
                              {(measurement.quantity * priceListItem.unitPrice).toFixed(0)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => removeMeasurement(measurement.id)}
                              style={{ marginLeft: 4 }}
                            >
                              <Trash2 size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.totalsSummary}>
                    <View style={styles.totalsSummaryRow}>
                      <Text style={styles.totalsSummaryLabel}>SubTotal</Text>
                      <Text style={styles.totalsSummaryValue}>
                        ${calculateTotals().subtotal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.totalsSummaryRow}>
                      <Text style={styles.totalsSummaryLabel}>Over head & profit</Text>
                      <Text style={styles.totalsSummaryValue}>{overheadPercent}%</Text>
                    </View>
                    <View style={styles.totalsSummaryRow}>
                      <Text style={styles.totalsSummaryLabel}>Sales taxes</Text>
                      <Text style={styles.totalsSummaryValue}>{salesTaxPercent}%</Text>
                    </View>
                    <View style={[styles.totalsSummaryRow, styles.totalsSummaryRowFinal]}>
                      <Text style={styles.totalsSummaryLabelFinal}>Grand Total</Text>
                      <Text style={styles.totalsSummaryValueFinal}>
                        ${calculateTotals().total.toFixed(2)}
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.confirmTotalsButton}
                      onPress={generateEstimate}
                    >
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.confirmTotalsButtonText}>Confirm Totals</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}

            {!showTotalsPanel && (
              <TouchableOpacity 
                style={styles.showTotalsButton}
                onPress={() => setShowTotalsPanel(true)}
              >
                <Text style={styles.showTotalsButtonText}>Show Totals Panel</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Modal
          visible={showItemPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowItemPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Item</Text>
                <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {priceListCategories.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, selectedCategory === category && styles.activeCategoryChip]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, selectedCategory === category && styles.activeCategoryChipText]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView style={styles.itemsList}>
                {masterPriceList
                  .filter(item => item.category === selectedCategory)
                  .map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      onPress={() => addMeasurementWithItem(item)}
                    >
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemUnit}>{item.unit}</Text>
                        <Text style={styles.itemPrice}>${item.unitPrice.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={scaleDialogVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setScaleDialogVisible(false)}
        >
          <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <View style={styles.scaleDialog}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Set Scale</Text>
                <TouchableOpacity onPress={() => setScaleDialogVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.scaleDialogDescription}>
                Select a common architectural scale or enter a custom ratio
              </Text>
              
              <ScrollView style={styles.scalePresetsScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.scalePresetsTitle}>Common Scales</Text>
                <View style={styles.scalePresetsGrid}>
                  {ARCHITECTURAL_SCALES.map((scaleOption, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.scalePresetButton,
                        scale === scaleOption.ratio && styles.scalePresetButtonActive,
                      ]}
                      onPress={() => {
                        setScale(scaleOption.ratio);
                        setScaleInput(scaleOption.ratio.toString());
                      }}
                    >
                      <Text style={[
                        styles.scalePresetLabel,
                        scale === scaleOption.ratio && styles.scalePresetLabelActive,
                      ]}>
                        {scaleOption.label}
                      </Text>
                      <Text style={[
                        styles.scalePresetDescription,
                        scale === scaleOption.ratio && styles.scalePresetDescriptionActive,
                      ]}>
                        {scaleOption.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={[styles.scalePresetsTitle, { marginTop: 20 }]}>Custom Scale</Text>
                <View style={styles.scaleInputRow}>
                  <Text style={styles.scaleInputLabel}>1 :</Text>
                  <TextInput
                    style={styles.scaleInput}
                    value={scaleInput}
                    onChangeText={setScaleInput}
                    placeholder="100"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </ScrollView>
              
              <View style={styles.scaleDialogFooter}>
                <Text style={styles.scaleCurrentText}>
                  Current: 1:{scale}
                </Text>
                <TouchableOpacity 
                  style={styles.scaleDialogButton}
                  onPress={handleSetScale}
                >
                  <Text style={styles.scaleDialogButtonText}>Apply Scale</Text>
                </TouchableOpacity>
              </View>
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
  saveButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  planTabs: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  planTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  planTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  activePlanTab: {
    backgroundColor: '#2563EB',
  },
  planTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activePlanTabText: {
    color: '#FFFFFF',
  },
  addPlanButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 60,
  },
  toolbarContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  toolButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  toolButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  activeToolButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
    whiteSpace: 'nowrap' as const,
  },
  activeToolButtonText: {
    color: '#FFFFFF',
  },
  finishButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  cancelButtonToolbar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  imageWrapper: {
    flex: 1,
  },
  imageTouchable: {
    flex: 1,
  },
  planImage: {
    width: '100%',
    height: '100%',
  },
  totalsPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  totalsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  totalsPanelTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  totalsScrollView: {
    flex: 1,
  },
  totalsTable: {
    padding: 16,
  },
  totalsTableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  totalsTableHeaderText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6B7280',
  },
  totalsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  colorIndicator: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 8,
  },
  totalsTableCell: {
    fontSize: 13,
    color: '#1F2937',
  },
  totalsTableCellBold: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  totalsSummary: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalsSummaryRowFinal: {
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 12,
  },
  totalsSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalsSummaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  totalsSummaryLabelFinal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  totalsSummaryValueFinal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  confirmTotalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  confirmTotalsButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  showTotalsButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  showTotalsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  scaleDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 420,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  scaleDialogDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  scalePresetsScroll: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  scalePresetsTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scalePresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  scalePresetButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minWidth: '31%',
    alignItems: 'center',
  },
  scalePresetButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2563EB',
  },
  scalePresetLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  scalePresetLabelActive: {
    color: '#2563EB',
  },
  scalePresetDescription: {
    fontSize: 11,
    color: '#6B7280',
  },
  scalePresetDescriptionActive: {
    color: '#2563EB',
  },
  scaleDialogFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginTop: 16,
  },
  scaleCurrentText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600' as const,
  },
  scaleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scaleInputLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginRight: 12,
  },
  scaleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  scaleDialogButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  scaleDialogButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  categoryScroll: {
    maxHeight: 48,
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  activeCategoryChip: {
    backgroundColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activeCategoryChipText: {
    color: '#FFFFFF',
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemUnit: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
});
