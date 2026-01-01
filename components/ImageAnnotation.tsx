import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  Dimensions,
  Modal,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';
import {
  X,
  Check,
  Pencil,
  Type,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  Trash2,
  Undo,
  RotateCcw,
} from 'lucide-react-native';

type DrawingTool = 'pen' | 'text' | 'rectangle' | 'circle' | 'arrow';
type DrawingElement = {
  type: DrawingTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
  id: string;
};

interface ImageAnnotationProps {
  visible: boolean;
  imageUri: string;
  onSave: (uri: string) => void;
  onCancel: () => void;
}

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#1F2937', '#FFFFFF'];

export default function ImageAnnotation({
  visible,
  imageUri,
  onSave,
  onCancel,
}: ImageAnnotationProps) {
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        if (selectedTool === 'text') {
          setTextPosition({ x: locationX, y: locationY });
          setShowTextInput(true);
        } else if (selectedTool === 'pen') {
          setCurrentPath([{ x: locationX, y: locationY }]);
        } else {
          setStartPoint({ x: locationX, y: locationY });
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        if (selectedTool === 'pen') {
          setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
        }
      },
      onPanResponderRelease: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        if (selectedTool === 'pen' && currentPath.length > 0) {
          const newElement: DrawingElement = {
            type: 'pen',
            color: selectedColor,
            strokeWidth,
            points: [...currentPath, { x: locationX, y: locationY }],
            id: Date.now().toString(),
          };
          setElements((prev) => [...prev, newElement]);
          setCurrentPath([]);
        } else if (selectedTool !== 'pen' && selectedTool !== 'text' && startPoint) {
          const newElement: DrawingElement = {
            type: selectedTool,
            color: selectedColor,
            strokeWidth,
            startPoint,
            endPoint: { x: locationX, y: locationY },
            id: Date.now().toString(),
          };
          setElements((prev) => [...prev, newElement]);
          setStartPoint(null);
        }
      },
    })
  ).current;

  const handleTextSubmit = () => {
    if (textInput.trim() && textPosition) {
      const newElement: DrawingElement = {
        type: 'text',
        color: selectedColor,
        strokeWidth,
        startPoint: textPosition,
        text: textInput,
        id: Date.now().toString(),
      };
      setElements((prev) => [...prev, newElement]);
      setTextInput('');
      setTextPosition(null);
      setShowTextInput(false);
    }
  };

  const handleUndo = () => {
    if (elements.length > 0) {
      setElements((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all annotations?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setElements([]) },
      ]
    );
  };

  const handleSave = () => {
    onSave(imageUri);
  };

  const renderElement = (element: DrawingElement) => {
    switch (element.type) {
      case 'pen':
        if (!element.points || element.points.length < 2) return null;
        const pathData = element.points
          .map((point, index) => (index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`))
          .join(' ');
        return (
          <Path
            key={element.id}
            d={pathData}
            stroke={element.color}
            strokeWidth={element.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'rectangle':
        if (!element.startPoint || !element.endPoint) return null;
        const width = element.endPoint.x - element.startPoint.x;
        const height = element.endPoint.y - element.startPoint.y;
        return (
          <Rect
            key={element.id}
            x={element.startPoint.x}
            y={element.startPoint.y}
            width={width}
            height={height}
            stroke={element.color}
            strokeWidth={element.strokeWidth}
            fill="none"
          />
        );

      case 'circle':
        if (!element.startPoint || !element.endPoint) return null;
        const dx = element.endPoint.x - element.startPoint.x;
        const dy = element.endPoint.y - element.startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        return (
          <Circle
            key={element.id}
            cx={element.startPoint.x}
            cy={element.startPoint.y}
            r={radius}
            stroke={element.color}
            strokeWidth={element.strokeWidth}
            fill="none"
          />
        );

      case 'arrow':
        if (!element.startPoint || !element.endPoint) return null;
        const angle = Math.atan2(
          element.endPoint.y - element.startPoint.y,
          element.endPoint.x - element.startPoint.x
        );
        const arrowSize = 15;
        const arrowAngle = Math.PI / 6;
        const arrowX1 = element.endPoint.x - arrowSize * Math.cos(angle - arrowAngle);
        const arrowY1 = element.endPoint.y - arrowSize * Math.sin(angle - arrowAngle);
        const arrowX2 = element.endPoint.x - arrowSize * Math.cos(angle + arrowAngle);
        const arrowY2 = element.endPoint.y - arrowSize * Math.sin(angle + arrowAngle);
        
        return (
          <React.Fragment key={element.id}>
            <Line
              x1={element.startPoint.x}
              y1={element.startPoint.y}
              x2={element.endPoint.x}
              y2={element.endPoint.y}
              stroke={element.color}
              strokeWidth={element.strokeWidth}
            />
            <Path
              d={`M ${element.endPoint.x} ${element.endPoint.y} L ${arrowX1} ${arrowY1} M ${element.endPoint.x} ${element.endPoint.y} L ${arrowX2} ${arrowY2}`}
              stroke={element.color}
              strokeWidth={element.strokeWidth}
            />
          </React.Fragment>
        );

      case 'text':
        if (!element.startPoint || !element.text) return null;
        return (
          <SvgText
            key={element.id}
            x={element.startPoint.x}
            y={element.startPoint.y}
            fill={element.color}
            fontSize={20}
            fontWeight="bold"
          >
            {element.text}
          </SvgText>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <X size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Annotate</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
            <Check size={24} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <View
          style={styles.imageContainer}
          {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
          {...(Platform.OS === 'web' ? {
            onMouseDown: (e: any) => {
              console.log('[Annotation] Mouse down on tool:', selectedTool);
              const containerRect = e.currentTarget.getBoundingClientRect();
              const startX = e.clientX - containerRect.left;
              const startY = e.clientY - containerRect.top;

              console.log('[Annotation] Start coordinates:', startX, startY);

              if (selectedTool === 'text') {
                setTextPosition({ x: startX, y: startY });
                setShowTextInput(true);
                return;
              }

              let pathPoints: { x: number; y: number }[] = [];
              if (selectedTool === 'pen') {
                pathPoints = [{ x: startX, y: startY }];
                setCurrentPath(pathPoints);
              } else {
                setStartPoint({ x: startX, y: startY });
              }

              const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
                const moveX = moveEvent.clientX - containerRect.left;
                const moveY = moveEvent.clientY - containerRect.top;

                if (selectedTool === 'pen') {
                  pathPoints.push({ x: moveX, y: moveY });
                  setCurrentPath([...pathPoints]);
                  console.log('[Annotation] Drawing pen, points:', pathPoints.length);
                }
              };

              const handleGlobalMouseUp = (upEvent: MouseEvent) => {
                console.log('[Annotation] Mouse up');
                const endX = upEvent.clientX - containerRect.left;
                const endY = upEvent.clientY - containerRect.top;

                if (selectedTool === 'pen' && pathPoints.length > 0) {
                  pathPoints.push({ x: endX, y: endY });
                  const newElement: DrawingElement = {
                    type: 'pen',
                    color: selectedColor,
                    strokeWidth,
                    points: pathPoints,
                    id: Date.now().toString(),
                  };
                  console.log('[Annotation] Creating pen element with', pathPoints.length, 'points, color:', selectedColor);
                  setElements((prev) => [...prev, newElement]);
                  setCurrentPath([]);
                } else if (selectedTool !== 'pen' && selectedTool !== 'text') {
                  const newElement: DrawingElement = {
                    type: selectedTool,
                    color: selectedColor,
                    strokeWidth,
                    startPoint: { x: startX, y: startY },
                    endPoint: { x: endX, y: endY },
                    id: Date.now().toString(),
                  };
                  console.log('[Annotation] Creating', selectedTool, 'element, color:', selectedColor);
                  setElements((prev) => [...prev, newElement]);
                  setStartPoint(null);
                }

                window.removeEventListener('mousemove', handleGlobalMouseMove);
                window.removeEventListener('mouseup', handleGlobalMouseUp);
              };

              window.addEventListener('mousemove', handleGlobalMouseMove);
              window.addEventListener('mouseup', handleGlobalMouseUp);
            }
          } : {})}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            onLoad={(e) => {
              const { width, height } = e.source;
              setImageSize({ width, height });
            }}
          />

          <Svg
            style={styles.svgOverlay}
            width="100%"
            height="100%"
            viewBox={`0 0 ${screenWidth} ${screenHeight}`}
            pointerEvents="none"
          >
            {elements.map((element) => renderElement(element))}
            {selectedTool === 'pen' && currentPath.length > 0 && (
              <Path
                d={currentPath
                  .map((point, index) => (index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`))
                  .join(' ')}
                stroke={selectedColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.toolsRow}>
            <TouchableOpacity
              style={[styles.tool, selectedTool === 'pen' && styles.toolActive]}
              onPress={() => setSelectedTool('pen')}
            >
              <Pencil size={20} color={selectedTool === 'pen' ? '#2563EB' : '#6B7280'} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, selectedTool === 'text' && styles.toolActive]}
              onPress={() => setSelectedTool('text')}
            >
              <Type size={20} color={selectedTool === 'text' ? '#2563EB' : '#6B7280'} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, selectedTool === 'rectangle' && styles.toolActive]}
              onPress={() => setSelectedTool('rectangle')}
            >
              <Square size={20} color={selectedTool === 'rectangle' ? '#2563EB' : '#6B7280'} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, selectedTool === 'circle' && styles.toolActive]}
              onPress={() => setSelectedTool('circle')}
            >
              <CircleIcon size={20} color={selectedTool === 'circle' ? '#2563EB' : '#6B7280'} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tool, selectedTool === 'arrow' && styles.toolActive]}
              onPress={() => setSelectedTool('arrow')}
            >
              <ArrowRight size={20} color={selectedTool === 'arrow' ? '#2563EB' : '#6B7280'} />
            </TouchableOpacity>

            <View style={styles.separator} />
            
            <TouchableOpacity style={styles.tool} onPress={handleUndo} disabled={elements.length === 0}>
              <Undo size={20} color={elements.length === 0 ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.tool} onPress={handleClear} disabled={elements.length === 0}>
              <RotateCcw size={20} color={elements.length === 0 ? '#D1D5DB' : '#EF4444'} />
            </TouchableOpacity>
          </View>

          <View style={styles.colorsRow}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorButtonActive,
                  color === '#FFFFFF' && styles.colorButtonWhite,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>

          <View style={styles.strokeWidthRow}>
            <Text style={styles.strokeLabel}>Thickness:</Text>
            {[2, 3, 5, 8].map((width) => (
              <TouchableOpacity
                key={width}
                style={[
                  styles.strokeButton,
                  strokeWidth === width && styles.strokeButtonActive,
                ]}
                onPress={() => setStrokeWidth(width)}
              >
                <View
                  style={[
                    styles.strokePreview,
                    { width: width * 2, height: width * 2, borderRadius: width },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Modal
          visible={showTextInput}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTextInput(false)}
        >
          <View style={styles.textInputModal}>
            <View style={styles.textInputContainer}>
              <Text style={styles.textInputTitle}>Add Text</Text>
              <View style={styles.textInputWrapper}>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={styles.nativeTextInput}
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="Enter text..."
                    placeholderTextColor="#9CA3AF"
                    onSubmitEditing={handleTextSubmit}
                    autoFocus
                  />
                ) : (
                  <TextInput
                    style={styles.nativeTextInput}
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="Enter text..."
                    placeholderTextColor="#9CA3AF"
                    onSubmitEditing={handleTextSubmit}
                    autoFocus
                  />
                )}
              </View>
              <View style={styles.textInputActions}>
                <TouchableOpacity
                  style={styles.textInputCancel}
                  onPress={() => {
                    setShowTextInput(false);
                    setTextInput('');
                    setTextPosition(null);
                  }}
                >
                  <Text style={styles.textInputCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.textInputSubmit}
                  onPress={handleTextSubmit}
                  disabled={!textInput.trim()}
                >
                  <Text style={styles.textInputSubmitText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  imageContainer: {
    flex: 1,
    position: 'relative' as const,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  svgOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  toolbar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tool: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#1F2937',
    borderWidth: 3,
  },
  colorButtonWhite: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  strokeWidthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  strokeLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  strokeButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  strokeButtonActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  strokePreview: {
    backgroundColor: '#1F2937',
  },
  textInputModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  textInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  textInputTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  textInputWrapper: {
    marginBottom: 16,
  },
  nativeTextInput: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    color: '#1F2937',
    width: '100%',
  },
  textInputActions: {
    flexDirection: 'row',
    gap: 12,
  },
  textInputCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  textInputCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  textInputSubmit: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  textInputSubmitText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
