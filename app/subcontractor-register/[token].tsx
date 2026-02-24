import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Building2, User, Mail, Phone, Briefcase, FileText, MapPin, Calendar, Upload, CheckCircle2, Send } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

interface BusinessFileUpload {
  id: string;
  type: 'license' | 'insurance' | 'w9' | 'certificate' | 'other';
  name: string;
  fileType: string;
  fileSize: number;
  uri: string;
}

const trades = [
  'Pre-Construction',
  'Foundation and Waterproofing',
  'Storm drainage & footing drainage',
  'Lumber and hardware material',
  'Frame Labor only',
  'Roof material & labor',
  'Windows and exterior doors',
  'Siding',
  'Plumbing',
  'Fire sprinklers',
  'Fire Alarm',
  'Mechanical/HVAC',
  'Electrical',
  'Insulation',
  'Drywall',
  'Flooring & Carpet & Tile',
  'Interior Doors',
  'Mill/Trim Work',
  'Painting',
  'Kitchen',
  'Bathroom',
  'Appliances',
  'Deck and Exterior Railing',
  'Tree Removals',
  'Exterior Finish Ground Work/Pavers/Concrete/Gravel',
  'Landscaping',
  'Fencing',
  'Mitigation',
  'Dumpster',
  'Asphalt',
];

export default function SubcontractorRegisterScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [step, setStep] = useState<number>(1);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    trade: '',
    license: '',
    address: '',
    insuranceExpiry: '',
    notes: '',
  });

  const [files, setFiles] = useState<BusinessFileUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

  const handlePickFile = async (type: 'license' | 'insurance' | 'w9' | 'certificate' | 'other') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile: BusinessFileUpload = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type,
          name: asset.name,
          fileType: asset.mimeType || 'unknown',
          fileSize: asset.size || 0,
          uri: asset.uri,
        };

        setFiles(prev => [...prev, newFile]);
        Alert.alert('Success', `${asset.name} added successfully`);
      }
    } catch (error) {
      console.error('[DocumentPicker] Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.companyName || !formData.email || !formData.phone || !formData.trade) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const regRes = await fetch(`${apiUrl}/api/complete-subcontractor-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || '', subcontractor: formData }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || 'Failed to complete registration');
      const subcontractor = regData.subcontractor;

      for (const file of files) {
        await fetch(`${apiUrl}/api/upload-subcontractor-business-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subcontractorId: subcontractor.id,
            type: file.type,
            name: file.name,
            fileType: file.fileType,
            fileSize: file.fileSize,
          }),
        });
      }

      Alert.alert(
        'Success!',
        'Your registration has been submitted successfully. The contractor will review your information and approve your profile.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (Platform.OS === 'web') {
                window.location.href = 'https://rork.app';
              }
            },
          },
        ]
      );

      console.log('[Registration] Completed successfully:', subcontractor.name);
    } catch (error) {
      console.error('[Registration] Error:', error);
      Alert.alert('Error', 'Failed to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Personal & Company Information</Text>
        <Text style={styles.stepSubtitle}>Tell us about yourself and your business</Text>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <User size={18} color="#2563EB" />
          <Text style={styles.label}>Full Name *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="John Doe"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Building2 size={18} color="#2563EB" />
          <Text style={styles.label}>Company Name *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.companyName}
          onChangeText={(text) => setFormData({ ...formData, companyName: text })}
          placeholder="ABC Construction LLC"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Mail size={18} color="#2563EB" />
          <Text style={styles.label}>Email *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Phone size={18} color="#2563EB" />
          <Text style={styles.label}>Phone Number *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Briefcase size={18} color="#2563EB" />
          <Text style={styles.label}>Trade / Specialty *</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tradeSelector}>
          {trades.map((trade) => (
            <TouchableOpacity
              key={trade}
              style={[styles.tradeChip, formData.trade === trade && styles.tradeChipActive]}
              onPress={() => setFormData({ ...formData, trade })}
            >
              <Text style={[styles.tradeChipText, formData.trade === trade && styles.tradeChipTextActive]}>
                {trade}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <FileText size={18} color="#2563EB" />
          <Text style={styles.label}>License Number</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.license}
          onChangeText={(text) => setFormData({ ...formData, license: text })}
          placeholder="ABC-123456"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <MapPin size={18} color="#2563EB" />
          <Text style={styles.label}>Business Address</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="123 Main St, City, State"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Calendar size={18} color="#2563EB" />
          <Text style={styles.label}>Insurance Expiry Date</Text>
        </View>
        <TextInput
          style={styles.input}
          value={formData.insuranceExpiry}
          onChangeText={(text) => setFormData({ ...formData, insuranceExpiry: text })}
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <FileText size={18} color="#2563EB" />
          <Text style={styles.label}>Additional Notes</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Any additional information about your business..."
          multiline
          numberOfLines={4}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
        <Text style={styles.nextButtonText}>Continue to Documents</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Business Documents</Text>
        <Text style={styles.stepSubtitle}>Upload required documents for verification</Text>
      </View>

      <View style={styles.docSection}>
        <Text style={styles.docTitle}>Required Documents:</Text>
        <Text style={styles.docSubtitle}>These documents help us verify your business</Text>
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickFile('license')}>
        <Upload size={20} color="#2563EB" />
        <Text style={styles.uploadButtonText}>Upload License</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickFile('insurance')}>
        <Upload size={20} color="#2563EB" />
        <Text style={styles.uploadButtonText}>Upload Insurance Certificate</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickFile('w9')}>
        <Upload size={20} color="#2563EB" />
        <Text style={styles.uploadButtonText}>Upload W-9 Form</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.uploadButton} onPress={() => handlePickFile('certificate')}>
        <Upload size={20} color="#2563EB" />
        <Text style={styles.uploadButtonText}>Upload Other Certificates</Text>
      </TouchableOpacity>

      {files.length > 0 && (
        <View style={styles.uploadedFilesSection}>
          <Text style={styles.uploadedFilesTitle}>Uploaded Files ({files.length})</Text>
          {files.map((file) => (
            <View key={file.id} style={styles.uploadedFile}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.uploadedFileName}>{file.name}</Text>
              <Text style={styles.uploadedFileType}>{file.type}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Send size={20} color="#FFFFFF" />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Complete Registration'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Subcontractor Registration' }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Our Network</Text>
          <Text style={styles.subtitle}>Complete your registration to start receiving project bids</Text>
        </View>

        <View style={styles.stepsIndicator}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
              <Text style={[styles.stepCircleText, step >= 1 && styles.stepCircleTextActive]}>1</Text>
            </View>
            <Text style={styles.stepLabel}>Information</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepIndicator}>
            <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
              <Text style={[styles.stepCircleText, step >= 2 && styles.stepCircleTextActive]}>2</Text>
            </View>
            <Text style={styles.stepLabel}>Documents</Text>
          </View>
        </View>

        <View style={styles.content}>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#BFDBFE',
    textAlign: 'center' as const,
  },
  stepsIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepIndicator: {
    alignItems: 'center' as const,
    gap: 8,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  stepCircleActive: {
    backgroundColor: '#2563EB',
  },
  stepCircleText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#6B7280',
  },
  stepCircleTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  stepLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  content: {
    padding: 20,
  },
  stepHeader: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top' as const,
  },
  tradeSelector: {
    marginTop: 8,
    maxHeight: 50,
  },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  tradeChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tradeChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  tradeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  nextButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  docSection: {
    marginBottom: 20,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  docSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  uploadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderStyle: 'dashed' as const,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  uploadedFilesSection: {
    marginTop: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  uploadedFilesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#166534',
    marginBottom: 12,
  },
  uploadedFile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
  uploadedFileType: {
    fontSize: 11,
    color: '#16A34A',
    textTransform: 'uppercase' as const,
    fontWeight: '600' as const,
  },
  buttonGroup: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
