import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Alert, Modal, View } from 'react-native';
import { Printer } from 'lucide-react-native';
import { SchedulePhase, GanttTask } from '@/types';
import PrintableScheduleView from './PrintableScheduleView';

interface PrintScheduleButtonProps {
  projectName: string;
  phases: SchedulePhase[];
  tasks: GanttTask[];
}

/**
 * Button to trigger print/PDF export
 * Uses window.print() on web, react-native-print on mobile
 */
export default function PrintScheduleButton({
  projectName,
  phases,
  tasks,
}: PrintScheduleButtonProps) {
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = async () => {
    if (Platform.OS === 'web') {
      // Web: Use window.print()
      setShowPrintPreview(true);
      // Wait for modal to render before printing
      setTimeout(() => {
        window.print();
        setShowPrintPreview(false);
      }, 100);
    } else {
      // Mobile: Show alert (would integrate react-native-print in production)
      Alert.alert(
        'Print Schedule',
        'Mobile print functionality requires react-native-print package. Would you like to export as PDF?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export PDF', onPress: () => handleMobilePrint() },
        ]
      );
    }
  };

  const handleMobilePrint = async () => {
    // Placeholder for react-native-print integration
    // In production, you would use:
    // import * as Print from 'expo-print';
    // const html = renderToStaticMarkup(<PrintableScheduleView ... />);
    // await Print.printAsync({ html });
    console.log('[Print] Mobile print would be triggered here');
    Alert.alert('Success', 'PDF export functionality coming soon');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePrint}
        activeOpacity={0.7}
      >
        <Printer size={18} color="#374151" strokeWidth={2} />
        <Text style={styles.buttonText}>Print</Text>
      </TouchableOpacity>

      {/* Print Preview Modal (Web only) */}
      {Platform.OS === 'web' && (
        <Modal
          visible={showPrintPreview}
          transparent={false}
          animationType="none"
          onRequestClose={() => setShowPrintPreview(false)}
        >
          <View style={styles.printContainer}>
            <PrintableScheduleView
              projectName={projectName}
              phases={phases}
              tasks={tasks}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  printContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
