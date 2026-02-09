import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Send, X, FileText } from 'lucide-react-native';
import { Subcontractor } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';

interface RequestEstimateProps {
  projectId: string;
  projectName: string;
}

export default function RequestEstimateComponent({ projectId, projectName }: RequestEstimateProps) {
  const { subcontractors, addNotification, user } = useApp();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [description, setDescription] = useState<string>('');
  const [requiredBy, setRequiredBy] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // tRPC mutation
  const requestMutation = trpc.subcontractors.requestEstimate.useMutation();

  const handleSendRequest = async () => {
    // Validation
    if (!selectedSubcontractor) {
      Alert.alert('Error', 'Please select a subcontractor');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters');
      return;
    }

    try {
      // Call backend API
      const result = await requestMutation.mutateAsync({
        projectId,
        subcontractorId: selectedSubcontractor.id,
        description: description.trim(),
        requiredBy: requiredBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      console.log('[EstimateRequest] Request sent successfully:', result.id);

      // Create local notification
      await addNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: user?.id || '',
        type: 'general',
        title: 'Estimate Request Sent',
        message: `Estimate request sent to ${selectedSubcontractor.name} for ${projectName}`,
        data: {
          estimateRequestId: result.id,
          projectId,
          status: result.status
        },
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Success feedback with notification details
      const notificationDetails = [];
      if (result.notifications?.sms?.sent) {
        notificationDetails.push('✓ SMS sent');
      } else if (result.notifications?.sms?.available) {
        notificationDetails.push('✗ SMS failed');
      }

      if (result.notifications?.email?.sent) {
        notificationDetails.push('✓ Email sent');
      } else if (result.notifications?.email?.available) {
        notificationDetails.push('✗ Email failed');
      }

      const notificationMessage = notificationDetails.length > 0
        ? '\n\n' + notificationDetails.join('\n')
        : '\n\nNotifications will be sent shortly.';

      Alert.alert(
        'Success',
        `Estimate request sent to ${selectedSubcontractor.name}!${notificationMessage}`,
        [{ text: 'OK' }]
      );

      // Close modal and reset
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      console.error('[EstimateRequest] Error:', error);

      // User-friendly error messages
      let errorMessage = 'Failed to send estimate request. Please try again.';

      if (error.message?.includes('at least 10 characters')) {
        errorMessage = 'Description must be at least 10 characters';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Project or subcontractor not found';
      } else if (error.message?.includes('not currently active')) {
        errorMessage = 'This subcontractor is not currently active';
      }

      Alert.alert('Error', errorMessage);
    }
  };

  const resetForm = () => {
    setSelectedSubcontractor(null);
    setDescription('');
    setRequiredBy('');
    setNotes('');
  };

  const availableSubcontractors = subcontractors.filter(sub => sub.isActive);

  return (
    <View>
      <TouchableOpacity
        style={styles.requestButton}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <FileText size={20} color="#2563EB" />
        <Text style={styles.requestButtonText}>Request Estimate</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Estimate</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Select Subcontractor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subcontractorList}>
              {availableSubcontractors.length === 0 ? (
                <Text style={styles.emptyText}>No subcontractors available. Add subcontractors first.</Text>
              ) : (
                availableSubcontractors.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.subcontractorCard,
                      selectedSubcontractor?.id === sub.id && styles.subcontractorCardActive,
                    ]}
                    onPress={() => setSelectedSubcontractor(sub)}
                  >
                    <View style={styles.subcontractorAvatar}>
                      <Text style={styles.subcontractorAvatarText}>{sub.name.charAt(0)}</Text>
                    </View>
                    <Text style={styles.subcontractorName}>{sub.name}</Text>
                    <Text style={styles.subcontractorTrade}>{sub.trade}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the work you need estimated..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Required By</Text>
            <TextInput
              style={styles.input}
              value={requiredBy}
              onChangeText={setRequiredBy}
              placeholder="MM/DD/YYYY (optional)"
            />

            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional information..."
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                requestMutation.isLoading && styles.sendButtonDisabled
              ]}
              onPress={handleSendRequest}
              disabled={requestMutation.isLoading}
              activeOpacity={0.8}
            >
              {requestMutation.isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Sending...</Text>
                </>
              ) : (
                <>
                  <Send size={20} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Request</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Platform-specific spacing */}
            <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  requestButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  subcontractorList: {
    marginBottom: 20,
    maxHeight: 140,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  subcontractorCard: {
    width: 100,
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center' as const,
  },
  subcontractorCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  subcontractorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  subcontractorAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  subcontractorName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  subcontractorTrade: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top' as const,
  },
  sendButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
