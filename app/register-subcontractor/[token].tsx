import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BusinessFileUpload from '@/components/BusinessFileUpload';
import RegistrationProgressIndicator from '@/components/RegistrationProgressIndicator';

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

export default function SubcontractorRegistrationPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    trade: '',
    licenseNumber: '',
    address: '',
    insuranceExpiry: '',
    notes: '',
    rating: 0,
  });

  const [uploadedFiles, setUploadedFiles] = useState<{
    license: any[];
    insurance: any[];
    w9: any[];
    certificate: any[];
    other: any[];
  }>({
    license: [],
    insurance: [],
    w9: [],
    certificate: [],
    other: [],
  });


  useEffect(() => {
    validateToken();
  }, []);

  const validateToken = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/validate-subcontractor-token?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate token');
      }

      if (!data.valid) {
        if (data.expired) {
          setTokenExpired(true);
        } else if (data.alreadyCompleted) {
          setAlreadyCompleted(true);
        } else {
          Alert.alert('Invalid Link', 'This registration link is invalid.');
        }
        return;
      }

      setTokenValid(true);
      // No pre-filled data - receiver fills everything from scratch
    } catch (error: any) {
      console.error('[Registration] Token validation error:', error);
      Alert.alert('Error', error.message || 'Failed to validate registration link');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploaded = (type: string, file: any) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [type]: [...prev[type as keyof typeof prev], file],
    }));
  };

  const handleFileDeleted = (type: string, fileId: string) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [type]: prev[type as keyof typeof prev].filter((f) => f.id !== fileId),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.companyName || !formData.email || !formData.phone || !formData.trade) {
      Alert.alert('Error', 'Please fill in all required fields marked with *');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/complete-subcontractor-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          subcontractor: {
            name: formData.name,
            companyName: formData.companyName,
            email: formData.email,
            phone: formData.phone,
            trade: formData.trade,
            licenseNumber: formData.licenseNumber || undefined,
            address: formData.address || undefined,
            insuranceExpiry: formData.insuranceExpiry || undefined,
            notes: formData.notes || undefined,
            rating: formData.rating || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete registration');
      }

      console.log('[Registration] Completed successfully:', data.subcontractor.id);

      Alert.alert(
        'Success!',
        'Your registration has been submitted successfully. The contractor will review your information and approve your profile.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (Platform.OS === 'web') {
                window.location.href = '/';
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('[Registration] Error:', error);
      Alert.alert('Error', error.message || 'Failed to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Validating registration link...</Text>
      </View>
    );
  }

  if (tokenExpired) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="time-outline" size={64} color="#FF9500" />
        <Text style={styles.errorTitle}>Link Expired</Text>
        <Text style={styles.errorMessage}>
          This registration link has expired. Please contact the contractor who sent you this link to request a new one.
        </Text>
      </View>
    );
  }

  if (alreadyCompleted) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#34C759" />
        <Text style={styles.errorTitle}>Already Registered</Text>
        <Text style={styles.errorMessage}>
          You have already completed this registration. Your profile is currently being reviewed.
        </Text>
      </View>
    );
  }

  if (!tokenValid) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Invalid Link</Text>
        <Text style={styles.errorMessage}>
          This registration link is invalid. Please contact the contractor who sent you this link.
        </Text>
      </View>
    );
  }

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Personal & Company Information</Text>
      <Text style={styles.stepSubtitle}>Tell us about yourself and your business</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="John Doe"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Company Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.companyName}
          onChangeText={(text) => setFormData({ ...formData, companyName: text })}
          placeholder="ABC Construction LLC"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Trade / Specialty *</Text>
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
        <Text style={styles.label}>License Number</Text>
        <TextInput
          style={styles.input}
          value={formData.licenseNumber}
          onChangeText={(text) => setFormData({ ...formData, licenseNumber: text })}
          placeholder="ABC-123456"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Address</Text>
        <TextInput
          style={styles.input}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="123 Main St, City, State ZIP"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Insurance Expiry Date</Text>
        <TextInput
          style={styles.input}
          value={formData.insuranceExpiry}
          onChangeText={(text) => setFormData({ ...formData, insuranceExpiry: text })}
          placeholder="YYYY-MM-DD (e.g., 2025-12-31)"
          placeholderTextColor="#8E8E93"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Additional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Any additional information about your business..."
          multiline
          numberOfLines={4}
          placeholderTextColor="#8E8E93"
        />
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
        <Text style={styles.nextButtonText}>Continue to Documents</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Business Documents</Text>
      <Text style={styles.stepSubtitle}>Upload required documents for verification</Text>

      <BusinessFileUpload
        token={token}
        type="license"
        label="Business License"
        onFileUploaded={(file) => handleFileUploaded('license', file)}
        onFileDeleted={(fileId) => handleFileDeleted('license', fileId)}
        uploadedFiles={uploadedFiles.license}
      />

      <BusinessFileUpload
        token={token}
        type="insurance"
        label="Insurance Certificate"
        requireExpiryDate={true}
        onFileUploaded={(file) => handleFileUploaded('insurance', file)}
        onFileDeleted={(fileId) => handleFileDeleted('insurance', fileId)}
        uploadedFiles={uploadedFiles.insurance}
      />

      <BusinessFileUpload
        token={token}
        type="w9"
        label="W-9 Form"
        onFileUploaded={(file) => handleFileUploaded('w9', file)}
        onFileDeleted={(fileId) => handleFileDeleted('w9', fileId)}
        uploadedFiles={uploadedFiles.w9}
      />

      <BusinessFileUpload
        token={token}
        type="certificate"
        label="Other Certificates"
        requireExpiryDate={true}
        onFileUploaded={(file) => handleFileUploaded('certificate', file)}
        onFileDeleted={(fileId) => handleFileDeleted('certificate', fileId)}
        uploadedFiles={uploadedFiles.certificate}
      />

      <BusinessFileUpload
        token={token}
        type="other"
        label="Other Documents"
        allowMultiple={true}
        onFileUploaded={(file) => handleFileUploaded('other', file)}
        onFileDeleted={(fileId) => handleFileDeleted('other', fileId)}
        uploadedFiles={uploadedFiles.other}
      />

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
          <Text style={styles.nextButtonText}>Review</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => {
    const totalFiles = Object.values(uploadedFiles).reduce((sum, files) => sum + files.length, 0);

    return (
      <View>
        <Text style={styles.stepTitle}>Review & Submit</Text>
        <Text style={styles.stepSubtitle}>Please review your information before submitting</Text>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Personal Information</Text>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Name:</Text>
            <Text style={styles.reviewValue}>{formData.name}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Company:</Text>
            <Text style={styles.reviewValue}>{formData.companyName}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Email:</Text>
            <Text style={styles.reviewValue}>{formData.email}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Phone:</Text>
            <Text style={styles.reviewValue}>{formData.phone}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Trade:</Text>
            <Text style={styles.reviewValue}>{formData.trade}</Text>
          </View>
          {formData.licenseNumber && (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>License:</Text>
              <Text style={styles.reviewValue}>{formData.licenseNumber}</Text>
            </View>
          )}
          {formData.address && (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Address:</Text>
              <Text style={styles.reviewValue}>{formData.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Uploaded Documents</Text>
          <Text style={styles.reviewFileCount}>{totalFiles} file(s) uploaded</Text>
          {Object.entries(uploadedFiles).map(([type, files]) =>
            files.map((file) => (
              <View key={file.id} style={styles.reviewFileItem}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
                <Text style={styles.reviewFileName}>{file.name}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
            <Ionicons name="arrow-back" size={20} color="#007AFF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.submitButtonText}>Complete Registration</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Subcontractor Registration', headerShown: true }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Our Network</Text>
          <Text style={styles.subtitle}>Complete your registration to start receiving project opportunities</Text>
        </View>

        <RegistrationProgressIndicator currentStep={step} totalSteps={3} />

        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F8F9FA',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#8E8E93',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#C7E0FF',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  tradeSelector: {
    marginTop: 8,
    maxHeight: 50,
  },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginRight: 8,
  },
  tradeChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tradeChipText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tradeChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  reviewSection: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  reviewItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    width: 100,
  },
  reviewValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  reviewFileCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
  },
  reviewFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  reviewFileName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});
