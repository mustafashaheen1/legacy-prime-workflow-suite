import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform } from 'react-native';
import { Users, Plus, Search, Mail, Phone, Star, X, FileText, UserPlus, FolderOpen, File, Send } from 'lucide-react-native';
import { Subcontractor, Project, ProjectFile, EstimateRequest } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Stack } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';

export default function SubcontractorsScreen() {
  const { subcontractors = [], addSubcontractor, projects, addProjectFile, addNotification, user } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<ProjectFile[]>([]);
  const [requestNotes, setRequestNotes] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    trade: '',
    license: '',
    rating: 0,
    hourlyRate: 0,
    availability: 'available' as const,
    address: '',
    notes: '',
  });

  const trades = ['Electrical', 'Plumbing', 'HVAC', 'Drywall', 'Framing', 'Roofing', 'Painting', 'Flooring'];

  const filteredSubcontractors = subcontractors.filter((sub: Subcontractor) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.trade.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = selectedTrade === 'all' || sub.trade === selectedTrade;
    return matchesSearch && matchesTrade;
  });

  const handleAddSubcontractor = async () => {
    if (!formData.name || !formData.companyName || !formData.email || !formData.phone || !formData.trade) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const newSubcontractor: Subcontractor = {
      id: `sub_${Date.now()}`,
      ...formData,
      certifications: formData.license ? [formData.license] : [],
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    await addSubcontractor(newSubcontractor);
    setShowAddModal(false);
    resetForm();
    Alert.alert('Success', 'Subcontractor added successfully');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      trade: '',
      license: '',
      rating: 0,
      hourlyRate: 0,
      availability: 'available',
      address: '',
      notes: '',
    });
  };

  const handleImportFromContacts = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Contact import is not available on web.');
      return;
    }

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access contacts was denied');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      if (data.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on your device.');
        return;
      }

      const contactNames = data.map(contact => contact.name).filter(Boolean);
      
      const selectedIndex = await new Promise<number>((resolve) => {
        Alert.alert(
          'Select Contact',
          'Choose a contact to import',
          [
            ...contactNames.slice(0, 10).map((name, index) => ({
              text: name || 'Unknown',
              onPress: () => resolve(index),
            })),
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(-1) },
          ],
          { cancelable: true }
        );
      });

      if (selectedIndex >= 0 && selectedIndex < data.length) {
        const contact = data[selectedIndex];
        const phone = contact.phoneNumbers?.[0]?.number || '';
        const email = contact.emails?.[0]?.email || '';
        
        setFormData(prev => ({
          ...prev,
          name: contact.name || '',
          phone,
          email,
        }));
        
        console.log('[Contacts] Imported contact:', contact.name);
      }
    } catch (error) {
      console.error('[Contacts] Error importing contact:', error);
      Alert.alert('Error', 'Failed to import contact');
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return '#10B981';
      case 'busy': return '#F59E0B';
      case 'unavailable': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Subcontractors' }} />

      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subcontractors..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, selectedTrade === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedTrade('all')}
        >
          <Text style={[styles.filterChipText, selectedTrade === 'all' && styles.filterChipTextActive]}>
            All Trades
          </Text>
        </TouchableOpacity>
        {trades.map((trade) => (
          <TouchableOpacity
            key={trade}
            style={[styles.filterChip, selectedTrade === trade && styles.filterChipActive]}
            onPress={() => setSelectedTrade(trade)}
          >
            <Text style={[styles.filterChipText, selectedTrade === trade && styles.filterChipTextActive]}>
              {trade}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list}>
        {filteredSubcontractors.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No subcontractors found</Text>
            <Text style={styles.emptyStateSubtext}>Add your first subcontractor to get started</Text>
          </View>
        ) : (
          filteredSubcontractors.map((sub: Subcontractor) => (
            <TouchableOpacity
              key={sub.id}
              style={styles.card}
              onPress={() => {
                setSelectedSubcontractor(sub);
                setShowDetailsModal(true);
              }}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{sub.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.cardName}>{sub.name}</Text>
                    <Text style={styles.cardCompany}>{sub.companyName}</Text>
                  </View>
                </View>
                <View style={[styles.availabilityBadge, { backgroundColor: getAvailabilityColor(sub.availability) }]}>
                  <Text style={styles.availabilityText}>
                    {sub.availability.charAt(0).toUpperCase() + sub.availability.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.tradeTag}>
                  <Text style={styles.tradeTagText}>{sub.trade}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Mail size={16} color="#6B7280" />
                    <Text style={styles.infoText}>{sub.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Phone size={16} color="#6B7280" />
                    <Text style={styles.infoText}>{sub.phone}</Text>
                  </View>
                </View>

                {sub.rating && sub.rating > 0 && (
                  <View style={styles.ratingContainer}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        color={i < (sub.rating || 0) ? '#F59E0B' : '#D1D5DB'}
                        fill={i < (sub.rating || 0) ? '#F59E0B' : 'transparent'}
                      />
                    ))}
                    <Text style={styles.ratingText}>({sub.rating}.0)</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Subcontractor</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.importButton} onPress={handleImportFromContacts}>
                <UserPlus size={20} color="#2563EB" />
                <Text style={styles.importButtonText}>Import from Contacts</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="John Doe"
            />

            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.companyName}
              onChangeText={(text) => setFormData({ ...formData, companyName: text })}
              placeholder="ABC Construction"
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>License Number</Text>
            <TextInput
              style={styles.input}
              value={formData.license}
              onChangeText={(text) => setFormData({ ...formData, license: text })}
              placeholder="ABC-123456"
            />

            <Text style={styles.label}>Trade *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tradeSelector}>
              {trades.map((trade) => (
                <TouchableOpacity
                  key={trade}
                  style={[styles.tradeOption, formData.trade === trade && styles.tradeOptionActive]}
                  onPress={() => setFormData({ ...formData, trade })}
                >
                  <Text style={[styles.tradeOptionText, formData.trade === trade && styles.tradeOptionTextActive]}>
                    {trade}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Hourly Rate</Text>
            <TextInput
              style={styles.input}
              value={formData.hourlyRate > 0 ? formData.hourlyRate.toString() : ''}
              onChangeText={(text) => setFormData({ ...formData, hourlyRate: parseFloat(text) || 0 })}
              placeholder="75.00"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              placeholder="123 Main St, City, State"
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Additional notes..."
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddSubcontractor}>
              <Text style={styles.submitButtonText}>Add Subcontractor</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showDetailsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          {selectedSubcontractor && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedSubcontractor.name}</Text>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Company</Text>
                  <Text style={styles.detailValue}>{selectedSubcontractor.companyName}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Trade</Text>
                  <Text style={styles.detailValue}>{selectedSubcontractor.trade}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedSubcontractor.email}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{selectedSubcontractor.phone}</Text>
                </View>

                {selectedSubcontractor.hourlyRate && selectedSubcontractor.hourlyRate > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Hourly Rate</Text>
                    <Text style={styles.detailValue}>${selectedSubcontractor.hourlyRate}/hr</Text>
                  </View>
                )}

                {selectedSubcontractor.address && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Address</Text>
                    <Text style={styles.detailValue}>{selectedSubcontractor.address}</Text>
                  </View>
                )}

                {selectedSubcontractor.certifications && selectedSubcontractor.certifications.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>License</Text>
                    <Text style={styles.detailValue}>{selectedSubcontractor.certifications[0]}</Text>
                  </View>
                )}

                {selectedSubcontractor.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text style={styles.detailValue}>{selectedSubcontractor.notes}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Availability</Text>
                  <View style={[styles.availabilityBadge, { backgroundColor: getAvailabilityColor(selectedSubcontractor.availability) }]}>
                    <Text style={styles.availabilityText}>
                      {selectedSubcontractor.availability.charAt(0).toUpperCase() + selectedSubcontractor.availability.slice(1)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.requestEstimateButton}
                  onPress={() => {
                    setShowDetailsModal(false);
                    setShowRequestModal(true);
                  }}
                >
                  <FileText size={20} color="#FFFFFF" />
                  <Text style={styles.requestEstimateButtonText}>Request Estimate</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={showRequestModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Estimate</Text>
            <TouchableOpacity onPress={() => {
              setShowRequestModal(false);
              setSelectedProject(null);
              setSelectedFiles([]);
              setRequestNotes('');
            }}>
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedSubcontractor && (
              <View style={styles.requestSubInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{selectedSubcontractor.name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.requestSubName}>{selectedSubcontractor.name}</Text>
                  <Text style={styles.requestSubTrade}>{selectedSubcontractor.trade} • {selectedSubcontractor.companyName}</Text>
                </View>
              </View>
            )}

            <Text style={styles.requestLabel}>Select Project *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectSelector}>
              {projects.filter(p => p.status === 'active').map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectCard,
                    selectedProject?.id === project.id && styles.projectCardActive,
                  ]}
                  onPress={() => setSelectedProject(project)}
                >
                  <FolderOpen size={20} color={selectedProject?.id === project.id ? '#2563EB' : '#6B7280'} />
                  <Text style={[
                    styles.projectCardName,
                    selectedProject?.id === project.id && styles.projectCardNameActive,
                  ]}>
                    {project.name}
                  </Text>
                  <Text style={styles.projectCardBudget}>${project.budget.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.requestLabel}>Attach Files (Drawings, Scope of Work)</Text>
            <TouchableOpacity 
              style={styles.filePickerButton}
              onPress={async () => {
                if (!selectedProject) {
                  Alert.alert('Select Project', 'Please select a project first');
                  return;
                }

                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: '*/*',
                    copyToCacheDirectory: true,
                    multiple: true,
                  });

                  if (!result.canceled && result.assets) {
                    const newFiles: ProjectFile[] = result.assets.map(asset => ({
                      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      projectId: selectedProject.id,
                      name: asset.name,
                      category: 'plans' as const,
                      fileType: asset.mimeType || 'unknown',
                      fileSize: asset.size || 0,
                      uri: asset.uri,
                      uploadDate: new Date().toISOString(),
                      notes: 'For estimate request',
                    }));

                    setSelectedFiles(prev => [...prev, ...newFiles]);
                    console.log('[Files] Added files for estimate request:', newFiles.length);
                  }
                } catch (error) {
                  console.error('[Files] Error picking files:', error);
                  Alert.alert('Error', 'Failed to pick files');
                }
              }}
            >
              <File size={20} color="#2563EB" />
              <Text style={styles.filePickerButtonText}>Add Files ({selectedFiles.length})</Text>
            </TouchableOpacity>

            {selectedFiles.length > 0 && (
              <View style={styles.selectedFilesList}>
                {selectedFiles.map((file, index) => (
                  <View key={file.id} style={styles.selectedFileItem}>
                    <File size={16} color="#6B7280" />
                    <Text style={styles.selectedFileName} numberOfLines={1}>{file.name}</Text>
                    <TouchableOpacity onPress={() => {
                      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                    }}>
                      <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.requestLabel}>Notes / Scope of Work</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={requestNotes}
              onChangeText={setRequestNotes}
              placeholder="Describe the work needed, timeline, budget expectations..."
              multiline
              numberOfLines={6}
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity 
              style={[
                styles.sendRequestButton,
                (!selectedProject || !selectedSubcontractor) && styles.sendRequestButtonDisabled
              ]}
              disabled={!selectedProject || !selectedSubcontractor}
              onPress={async () => {
                if (!selectedProject || !selectedSubcontractor) {
                  Alert.alert('Missing Information', 'Please select a project');
                  return;
                }

                const estimateRequest: EstimateRequest = {
                  id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  projectId: selectedProject.id,
                  subcontractorId: selectedSubcontractor.id,
                  requestedBy: user?.id || 'user_current',
                  requestDate: new Date().toISOString(),
                  description: requestNotes || 'Estimate request',
                  status: 'pending',
                  attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
                  notes: `Request sent to ${selectedSubcontractor.name} (${selectedSubcontractor.companyName})`,
                  createdAt: new Date().toISOString(),
                };

                for (const file of selectedFiles) {
                  await addProjectFile(file);
                }

                const notification = {
                  id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  userId: user?.id || 'user_current',
                  type: 'general' as const,
                  title: 'Estimate Request Sent',
                  message: `Estimate request sent to ${selectedSubcontractor.name} for ${selectedProject.name}`,
                  data: { estimateRequestId: estimateRequest.id, projectId: selectedProject.id },
                  read: false,
                  createdAt: new Date().toISOString(),
                };

                await addNotification(notification);

                console.log('[EstimateRequest] Request sent:', estimateRequest);
                console.log('[EstimateRequest] Files attached:', selectedFiles.length);

                setShowRequestModal(false);
                setSelectedProject(null);
                setSelectedFiles([]);
                setRequestNotes('');
                
                Alert.alert(
                  'Request Sent',
                  `Estimate request sent to ${selectedSubcontractor.name}. They will reply via ${selectedSubcontractor.email} or ${selectedSubcontractor.phone}.`
                );
              }}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.sendRequestButtonText}>Send Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 50,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  cardHeaderInfo: {
    gap: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  cardCompany: {
    fontSize: 14,
    color: '#6B7280',
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  cardBody: {
    gap: 12,
  },
  tradeTag: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  tradeTagText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2563EB',
  },
  cardInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
  },
  ratingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
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
  tradeSelector: {
    marginBottom: 8,
    maxHeight: 50,
  },
  tradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  tradeOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tradeOptionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  tradeOptionTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  importButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  importButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  requestEstimateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  requestEstimateButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  requestSubInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestSubName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  requestSubTrade: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  requestLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 20,
  },
  projectSelector: {
    marginBottom: 8,
    maxHeight: 140,
  },
  projectCard: {
    width: 140,
    padding: 16,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  projectCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  projectCardName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  projectCardNameActive: {
    color: '#2563EB',
  },
  projectCardBudget: {
    fontSize: 12,
    color: '#6B7280',
  },
  filePickerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  filePickerButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  selectedFilesList: {
    gap: 8,
    marginBottom: 16,
  },
  selectedFileItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedFileName: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  sendRequestButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    marginBottom: 40,
  },
  sendRequestButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendRequestButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
