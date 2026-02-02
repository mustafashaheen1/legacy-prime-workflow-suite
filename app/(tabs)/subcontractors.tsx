import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, Linking, ActivityIndicator } from 'react-native';
import { Users, Plus, Search, Mail, Phone, Star, X, FileText, UserPlus, FolderOpen, File, Send, CheckSquare, Square, MessageSquare, Building2, FileCheck, TrendingUp, Check, Loader } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Subcontractor, Project, ProjectFile, EstimateRequest } from '@/types';
import { useApp } from '@/contexts/AppContext';
import DailyTasksButton from '@/components/DailyTasksButton';
import { Stack, router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { compressImage } from '@/lib/upload-utils';

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
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<{[key: string]: string}>({});
  const [selectedSubcontractors, setSelectedSubcontractors] = useState<Set<string>>(new Set());
  const [showStatsWidget, setShowStatsWidget] = useState<boolean>(false);
  const [customTrade, setCustomTrade] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [sendingInvitation, setSendingInvitation] = useState<boolean>(false);

  // Invite method selection
  const [showInviteMethodModal, setShowInviteMethodModal] = useState<boolean>(false);
  const [showSmsPhoneModal, setShowSmsPhoneModal] = useState<boolean>(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState<string>('');
  const [smsPhoneError, setSmsPhoneError] = useState<string>('');
  const [sendingSms, setSendingSms] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    trade: '',
    license: '',
    rating: 0,
    availability: 'available' as const,
    address: '',
    notes: '',
  });

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

  // Function to upload file to S3 and generate short link
  const uploadFileToS3AndGenerateLink = async (file: ProjectFile) => {
    setUploadingFiles(prev => new Set(prev).add(file.id));

    try {
      console.log('[Upload] Starting upload for:', file.name);

      // Check if file is an image that needs compression
      const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
      const isImage = imageTypes.some(type => file.fileType.toLowerCase().includes(type.split('/')[1]));

      let base64Data: string;
      let actualFileSize: number = file.fileSize;

      if (Platform.OS === 'web') {
        // Web: Handle file reading with compression for images
        const response = await fetch(file.uri);
        const blob = await response.blob();

        if (isImage && blob.size > 1 * 1024 * 1024) { // Compress if > 1MB
          console.log('[Upload] Compressing image on web...');
          // For web, we'll use canvas API for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();

          base64Data = await new Promise((resolve, reject) => {
            img.onload = () => {
              // Calculate new dimensions (max 1920px)
              const maxSize = 1920;
              let width = img.width;
              let height = img.height;

              if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }

              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);

              // Convert to JPEG with 0.8 quality
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              actualFileSize = Math.ceil((dataUrl.length - 22) * 0.75); // Estimate actual size
              console.log('[Upload] Web compression complete, new size:', actualFileSize);
              resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
        } else {
          // Non-image or small image: read as-is
          const reader = new FileReader();
          base64Data = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // Mobile: Use compressImage utility for images
        if (isImage && file.fileSize > 1 * 1024 * 1024) { // Compress if > 1MB
          console.log('[Upload] Compressing image on mobile...');
          const compressed = await compressImage(file.uri, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8,
          });
          base64Data = `data:image/jpeg;base64,${compressed.base64}`;
          actualFileSize = compressed.base64.length;
          console.log('[Upload] Mobile compression complete, new size:', actualFileSize);
        } else {
          // Non-image or small image: read as-is
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          base64Data = `data:${file.fileType};base64,${base64}`;
        }
      }

      console.log('[Upload] File prepared, base64 size:', base64Data.length);

      // Check if file is still too large (Vercel has ~6MB limit for body)
      const estimatedBodySize = base64Data.length;
      const maxBodySize = 5 * 1024 * 1024; // 5MB to be safe
      if (estimatedBodySize > maxBodySize) {
        throw new Error(
          `File is too large to upload (${(estimatedBodySize / 1024 / 1024).toFixed(1)}MB). ` +
          `Maximum size is ${(maxBodySize / 1024 / 1024).toFixed(1)}MB. ` +
          `Please try a smaller file or lower resolution image.`
        );
      }

      // Upload to S3 and generate short link
      const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : process.env.EXPO_PUBLIC_API_URL || '';

      const response = await fetch(`${baseUrl}/api/upload-estimate-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: file.name,
          fileType: isImage ? 'image/jpeg' : file.fileType, // Use JPEG for compressed images
          fileSize: actualFileSize,
          companyId: user?.companyId,
          projectId: selectedProject?.id,
          subcontractorId: selectedSubcontractor?.id,
          userId: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('File is too large. Please try a smaller file or contact support.');
        }
        throw new Error(data.error || 'Upload failed');
      }

      // Store short URL
      setUploadedFiles(prev => ({
        ...prev,
        [file.id]: data.shortUrl,
      }));

      console.log('[Upload] File uploaded successfully:', file.name, '-> Short URL:', data.shortUrl);
    } catch (error: any) {
      console.error('[Upload] Error uploading file:', error);

      // Show user-friendly error message
      const errorMessage = error.message || 'Upload failed';
      Alert.alert('Upload Error', `Failed to upload ${file.name}:\n\n${errorMessage}`);

      // Remove failed file from list
      setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  const filteredSubcontractors = subcontractors.filter((sub: Subcontractor) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.trade.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = selectedTrade === 'all' || sub.trade === selectedTrade;
    return matchesSearch && matchesTrade;
  });

  // Email validation regex - requires proper format like user@domain.com
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation - US phone number (10 digits, allows formatting)
  const isValidUSPhone = (phone: string): boolean => {
    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, '');
    // US phone numbers should have 10 digits (or 11 if starting with 1)
    return digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const digitsOnly = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length <= 3) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    } else {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits and formatting characters
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleAddSubcontractor = async () => {
    // Clear previous errors
    setFormError('');
    const errors: {[key: string]: string} = {};

    // Check required fields (original validation)
    if (!formData.name) {
      errors.name = 'Name is required';
    }
    if (!formData.companyName) {
      errors.companyName = 'Company name is required';
    }
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email (e.g., name@company.com)';
    }
    if (!formData.phone) {
      errors.phone = 'Phone number is required';
    } else if (!isValidUSPhone(formData.phone)) {
      errors.phone = 'Please enter a valid US phone number (10 digits)';
    }
    if (!formData.trade) {
      errors.trade = 'Trade is required';
    }

    // If there are any errors, set them and show alert for mobile
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorMessage = Object.values(errors).join('\n');
      setFormError(errorMessage);
      if (Platform.OS !== 'web') {
        Alert.alert('Validation Error', errorMessage);
      }
      return;
    }

    // Clear field errors on successful validation
    setFieldErrors({});

    const newSubcontractor: Subcontractor = {
      id: `sub_${Date.now()}`,
      ...formData,
      certifications: formData.license ? [formData.license] : [],
      createdAt: new Date().toISOString(),
      isActive: true,
      approved: false,
      businessFiles: [],
    };

    try {
      await addSubcontractor(newSubcontractor);
      setShowAddModal(false);
      resetForm();
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Subcontractor added successfully');
      }
    } catch (error) {
      const errorMsg = 'Failed to save subcontractor. Please try again.';
      setFormError(errorMsg);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const handleSendInvite = () => {
    if (!user) {
      Alert.alert('Error', 'User information not found');
      return;
    }
    setShowInviteMethodModal(true);
  };

  const handleSendInviteViaEmail = async () => {
    setShowInviteMethodModal(false);
    setSendingInvitation(true);

    try {
      const response = await fetch('/api/send-subcontractor-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: user?.companyId,
          invitedBy: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate invitation');
      }

      const mailtoUrl = `mailto:?subject=${encodeURIComponent(data.emailSubject)}&body=${encodeURIComponent(data.emailBody)}`;

      if (Platform.OS === 'web') {
        window.location.href = mailtoUrl;
      } else {
        await Linking.openURL(mailtoUrl);
      }

      Alert.alert(
        'Email Client Opened',
        'Your email client has been opened with the invitation link. Enter the recipient\'s email address and send.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Send Invitation] Error:', error);
      Alert.alert('Error', error.message || 'Failed to generate invitation. Please try again.');
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleChooseSms = () => {
    setShowInviteMethodModal(false);
    setSmsPhoneNumber('');
    setSmsPhoneError('');
    setTimeout(() => setShowSmsPhoneModal(true), 200);
  };

  const validateUsPhoneNumber = (phone: string): boolean => {
    // Remove any non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length === 10 && /^\d{10}$/.test(digitsOnly);
  };

  const formatPhoneInput = (text: string): string => {
    // Only allow digits
    return text.replace(/\D/g, '').slice(0, 10);
  };

  const handleSendInviteViaSms = async () => {
    // Validate phone number
    if (!smsPhoneNumber) {
      setSmsPhoneError('Please enter a phone number');
      return;
    }

    if (!validateUsPhoneNumber(smsPhoneNumber)) {
      setSmsPhoneError('Please enter a valid 10-digit US phone number');
      return;
    }

    setSmsPhoneError('');
    setSendingSms(true);

    try {
      const response = await fetch('/api/send-subcontractor-invitation-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: user?.companyId,
          invitedBy: user?.id,
          phoneNumber: `+1${smsPhoneNumber}`, // Add US country code
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Create detailed error message
        let errorMsg = data.error || 'Failed to send SMS invitation';
        if (data.message) {
          errorMsg += `: ${data.message}`;
        }
        if (data.details) {
          console.error('[SMS Error Details]:', data.details);
          errorMsg += ` (${data.details})`;
        }
        throw new Error(errorMsg);
      }

      setShowSmsPhoneModal(false);
      setSmsPhoneNumber('');

      Alert.alert(
        'SMS Sent!',
        `Invitation link has been sent to (${smsPhoneNumber.slice(0, 3)}) ${smsPhoneNumber.slice(3, 6)}-${smsPhoneNumber.slice(6, 10)}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('[Send SMS Invitation] Error:', error);
      const errorMessage = error.message || 'Failed to send SMS. Please try again.';
      setSmsPhoneError(errorMessage);

      // Also show alert for better visibility
      Alert.alert('SMS Error', errorMessage);
    } finally {
      setSendingSms(false);
    }
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
      availability: 'available',
      address: '',
      notes: '',
    });
    setFormError('');
    setFieldErrors({});
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

  const toggleSubcontractorSelection = (subId: string) => {
    const newSelection = new Set(selectedSubcontractors);
    if (newSelection.has(subId)) {
      newSelection.delete(subId);
    } else {
      newSelection.add(subId);
    }
    setSelectedSubcontractors(newSelection);
  };

  const selectAllSubcontractors = () => {
    if (selectedSubcontractors.size === filteredSubcontractors.length) {
      setSelectedSubcontractors(new Set());
    } else {
      setSelectedSubcontractors(new Set(filteredSubcontractors.map(s => s.id)));
    }
  };

  const openMessageModal = (type: 'email' | 'sms', subId?: string) => {
    const recipients = subId 
      ? [subcontractors.find(s => s.id === subId)!]
      : subcontractors.filter(s => selectedSubcontractors.has(s.id));

    if (recipients.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one subcontractor.');
      return;
    }

    if (type === 'email') {
      const emails = recipients.map(r => r.email).join(',');
      const emailUrl = `mailto:${emails}`;
      
      if (Platform.OS === 'web') {
        window.open(emailUrl, '_blank');
      } else {
        Linking.openURL(emailUrl).catch(() => {
          Alert.alert('Error', 'Unable to open email client');
        });
      }
    } else {
      recipients.forEach(recipient => {
        const smsUrl = `sms:${recipient.phone}`;
        Linking.openURL(smsUrl).catch(() => {
          Alert.alert('Error', 'Unable to open messaging app');
        });
      });
    }
  };

  const totalSubcontractors = subcontractors.length;
  const availableSubcontractors = subcontractors.filter(s => s.availability === 'available').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const avgRating = subcontractors.length > 0 
    ? (subcontractors.reduce((sum, s) => sum + (s.rating || 0), 0) / subcontractors.length).toFixed(1)
    : '0.0';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Subcontractors Directory' }} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Subcontractor Directory</Text>
          <View style={styles.headerActions}>
            <DailyTasksButton />
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Subcontractor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteHeaderButton} onPress={handleSendInvite}>
              <Mail size={20} color="#FFFFFF" />
              <Text style={styles.inviteHeaderButtonText}>Send Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, company, or trade..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterChip, selectedTrade === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedTrade('all')}
          >
            <Text style={[styles.filterChipText, selectedTrade === 'all' && styles.filterChipTextActive]}>
              All Trades ({subcontractors.length})
            </Text>
          </TouchableOpacity>
          {trades.map((trade) => {
            const count = subcontractors.filter(s => s.trade === trade).length;
            return (
              <TouchableOpacity
                key={trade}
                style={[styles.filterChip, selectedTrade === trade && styles.filterChipActive]}
                onPress={() => setSelectedTrade(trade)}
              >
                <Text style={[styles.filterChipText, selectedTrade === trade && styles.filterChipTextActive]}>
                  {trade} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.content}>
          <View style={styles.listHeader}>
            <View style={styles.leftActions}>
              <Text style={styles.sectionTitle}>Subcontractor List</Text>
              {selectedSubcontractors.size > 0 && (
                <View>
                  <Text style={styles.selectedCount}>{selectedSubcontractors.size} selected</Text>
                </View>
              )}
            </View>
            <View style={styles.rightActions}>
              <TouchableOpacity 
                style={styles.selectAllButton}
                onPress={selectAllSubcontractors}
              >
                {selectedSubcontractors.size === filteredSubcontractors.length ? (
                  <CheckSquare size={20} color="#2563EB" />
                ) : (
                  <Square size={20} color="#6B7280" />
                )}
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              {selectedSubcontractors.size > 0 && (
                <>
                  <TouchableOpacity 
                    style={styles.bulkActionButton}
                    onPress={() => openMessageModal('email')}
                  >
                    <Mail size={18} color="#FFFFFF" />
                    <Text style={styles.bulkActionText}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.bulkActionButton, styles.smsButton]}
                    onPress={() => openMessageModal('sms')}
                  >
                    <MessageSquare size={18} color="#FFFFFF" />
                    <Text style={styles.bulkActionText}>SMS</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          {filteredSubcontractors.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No subcontractors found</Text>
              <Text style={styles.emptyStateSubtext}>Add your first subcontractor to get started</Text>
            </View>
          ) : (
            filteredSubcontractors.map((sub: Subcontractor) => (
              <View key={sub.id} style={styles.subcontractorRow}>
                <View style={styles.subRowHeader}>
                  <TouchableOpacity 
                    style={styles.checkbox}
                    onPress={() => toggleSubcontractorSelection(sub.id)}
                  >
                    {selectedSubcontractors.has(sub.id) ? (
                      <CheckSquare size={24} color="#2563EB" />
                    ) : (
                      <Square size={24} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                  <View style={styles.subInfo}>
                    <View style={styles.subNameRow}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      {sub.availability && (
                        <View style={[styles.availabilityBadge, { backgroundColor: getAvailabilityColor(sub.availability) }]}>
                          <Text style={styles.availabilityText}>
                            {sub.availability.charAt(0).toUpperCase() + sub.availability.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.subCompanyRow}>
                      <Building2 size={14} color="#6B7280" />
                      <Text style={styles.subCompany}>{sub.companyName}</Text>
                    </View>
                    <View style={styles.tradeTag}>
                      <Text style={styles.tradeTagText}>{sub.trade}</Text>
                    </View>
                    <Text style={styles.subEmail}>{sub.email}</Text>
                    <Text style={styles.subPhone}>{sub.phone}</Text>
                    {sub.rating && sub.rating > 0 && (
                      <View style={styles.ratingContainer}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            color={i < (sub.rating || 0) ? '#F59E0B' : '#D1D5DB'}
                            fill={i < (sub.rating || 0) ? '#F59E0B' : 'transparent'}
                          />
                        ))}
                        <Text style={styles.ratingText}>({sub.rating}.0)</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.subActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => openMessageModal('email', sub.id)}
                  >
                    <Mail size={16} color="#2563EB" />
                    <Text style={styles.actionButtonText}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => openMessageModal('sms', sub.id)}
                  >
                    <MessageSquare size={16} color="#059669" />
                    <Text style={styles.actionButtonText}>SMS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.estimateButton}
                    onPress={() => {
                      setSelectedSubcontractor(sub);
                      setShowRequestModal(true);
                    }}
                  >
                    <FileText size={16} color="#FFFFFF" />
                    <Text style={styles.estimateButtonText}>Request Estimate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.viewButton}
                    onPress={() => {
                      router.push(`/subcontractor/${sub.id}`);
                    }}
                  >
                    <FileCheck size={16} color="#8B5CF6" />
                    <Text style={styles.viewButtonText}>View Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <View style={styles.statsWidget}>
            <View style={styles.statsHeader}>
              <View style={styles.statsHeaderLeft}>
                <TrendingUp size={20} color="#2563EB" />
                <Text style={styles.statsHeaderTitle}>Directory Stats</Text>
              </View>
            </View>
            <View style={styles.statsContent}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Users size={24} color="#2563EB" />
                  <Text style={styles.statValue}>{totalSubcontractors}</Text>
                  <Text style={styles.statLabel}>Total Subs</Text>
                </View>
                <View style={styles.statCard}>
                  <CheckSquare size={24} color="#10B981" />
                  <Text style={styles.statValue}>{availableSubcontractors}</Text>
                  <Text style={styles.statLabel}>Available</Text>
                </View>
                <View style={styles.statCard}>
                  <Star size={24} color="#F59E0B" />
                  <Text style={styles.statValue}>{avgRating}</Text>
                  <Text style={styles.statLabel}>Avg Rating</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
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
            {/* Error Banner for Web */}
            {formError && Platform.OS === 'web' && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            )}

            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.importButton} onPress={handleImportFromContacts}>
                <UserPlus size={20} color="#2563EB" />
                <Text style={styles.importButtonText}>Import from Contacts</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, fieldErrors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="John Doe"
            />
            {fieldErrors.name && <Text style={styles.fieldError}>{fieldErrors.name}</Text>}

            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={[styles.input, fieldErrors.companyName && styles.inputError]}
              value={formData.companyName}
              onChangeText={(text) => {
                setFormData({ ...formData, companyName: text });
                if (fieldErrors.companyName) setFieldErrors(prev => ({ ...prev, companyName: '' }));
              }}
              placeholder="ABC Construction"
            />
            {fieldErrors.companyName && <Text style={styles.fieldError}>{fieldErrors.companyName}</Text>}

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, fieldErrors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}

            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={[styles.input, fieldErrors.phone && styles.inputError]}
              value={formData.phone}
              onChangeText={(text) => {
                handlePhoneChange(text);
                if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
              }}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              maxLength={14}
            />
            {fieldErrors.phone && <Text style={styles.fieldError}>{fieldErrors.phone}</Text>}

            <Text style={styles.label}>License Number</Text>
            <TextInput
              style={styles.input}
              value={formData.license}
              onChangeText={(text) => setFormData({ ...formData, license: text })}
              placeholder="ABC-123456"
            />

            <Text style={styles.label}>Trade *</Text>
            {fieldErrors.trade && <Text style={styles.fieldError}>{fieldErrors.trade}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tradeSelector, fieldErrors.trade && styles.tradeSelectorError]}>
              {trades.map((trade) => (
                <TouchableOpacity
                  key={trade}
                  style={[styles.tradeOption, formData.trade === trade && styles.tradeOptionActive]}
                  onPress={() => {
                    setFormData({ ...formData, trade });
                    setCustomTrade('');
                    if (fieldErrors.trade) setFieldErrors(prev => ({ ...prev, trade: '' }));
                  }}
                >
                  <Text style={[styles.tradeOptionText, formData.trade === trade && styles.tradeOptionTextActive]}>
                    {trade}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Or Enter Custom Trade</Text>
            <View style={styles.customTradeContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={customTrade}
                onChangeText={setCustomTrade}
                placeholder="Enter custom trade (e.g., 'Solar Panel Installation')..."
                placeholderTextColor="#9CA3AF"
              />
              {customTrade.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.addCustomTradeButton}
                  onPress={() => {
                    if (customTrade.trim()) {
                      setFormData({ ...formData, trade: customTrade.trim() });
                      setCustomTrade('');
                    }
                  }}
                >
                  <Text style={styles.addCustomTradeButtonText}>Use This</Text>
                </TouchableOpacity>
              )}
            </View>
            {formData.trade && !trades.includes(formData.trade) && (
              <View style={styles.customTradePreview}>
                <Text style={styles.customTradePreviewText}>Custom trade: {formData.trade}</Text>
              </View>
            )}



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

                {selectedSubcontractor.availability && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Availability</Text>
                    <View style={[styles.availabilityBadge, { backgroundColor: getAvailabilityColor(selectedSubcontractor.availability) }]}>
                      <Text style={styles.availabilityText}>
                        {selectedSubcontractor.availability.charAt(0).toUpperCase() + selectedSubcontractor.availability.slice(1)}
                      </Text>
                    </View>
                  </View>
                )}

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

                    // Upload each file immediately to S3 and generate short link
                    for (const file of newFiles) {
                      uploadFileToS3AndGenerateLink(file);
                    }
                  }
                } catch (error) {
                  console.error('[Files] Error picking files:', error);
                  Alert.alert('Error', 'Failed to pick files');
                }
              }}
            >
              <File size={20} color="#2563EB" />
              <Text style={styles.filePickerButtonText}>
                Add Files ({selectedFiles.length})
                {uploadingFiles.size > 0 && ` (Uploading ${uploadingFiles.size}...)`}
              </Text>
            </TouchableOpacity>

            {selectedFiles.length > 0 && (
              <View style={styles.selectedFilesList}>
                {selectedFiles.map((file, index) => {
                  const isUploading = uploadingFiles.has(file.id);
                  const hasShortUrl = !!uploadedFiles[file.id];

                  return (
                    <View key={file.id} style={styles.selectedFileItem}>
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#F59E0B" />
                      ) : hasShortUrl ? (
                        <Check size={16} color="#10B981" />
                      ) : (
                        <File size={16} color="#6B7280" />
                      )}
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.selectedFileName} numberOfLines={1}>{file.name}</Text>
                        {isUploading && (
                          <Text style={styles.uploadingText}>Uploading...</Text>
                        )}
                        {hasShortUrl && (
                          <Text style={styles.uploadedText}>Ready to send</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => {
                        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                        setUploadedFiles(prev => {
                          const newUploaded = { ...prev };
                          delete newUploaded[file.id];
                          return newUploaded;
                        });
                      }}>
                        <X size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
                (!selectedProject || !selectedSubcontractor || uploadingFiles.size > 0) && styles.sendRequestButtonDisabled
              ]}
              disabled={!selectedProject || !selectedSubcontractor || uploadingFiles.size > 0}
              onPress={async () => {
                if (!selectedProject || !selectedSubcontractor) {
                  Alert.alert('Missing Information', 'Please select a project');
                  return;
                }

                if (uploadingFiles.size > 0) {
                  Alert.alert('Upload In Progress', 'Please wait for files to finish uploading');
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

                // Compose email with short links (use \r\n for proper email line breaks)
                const emailSubject = encodeURIComponent(
                  `Estimate Request - ${selectedProject.name}`
                );

                let emailBody = `Hello ${selectedSubcontractor.name},\r\n\r\n`;
                emailBody += `We would like to request an estimate for the following project:\r\n\r\n`;
                emailBody += `Project: ${selectedProject.name}\r\n`;
                emailBody += `Budget: $${selectedProject.budget.toLocaleString()}\r\n\r\n`;

                if (requestNotes) {
                  emailBody += `Additional Details:\r\n${requestNotes}\r\n\r\n`;
                }

                if (selectedFiles.length > 0) {
                  emailBody += `Attached Files:\r\n`;
                  selectedFiles.forEach((file, index) => {
                    const shortUrl = uploadedFiles[file.id];
                    if (shortUrl) {
                      emailBody += `${index + 1}. ${file.name}\r\n   ${shortUrl}\r\n\r\n`;
                    }
                  });
                }

                emailBody += `\r\nPlease review the files and provide your estimate at your earliest convenience.\r\n\r\n`;
                emailBody += `Best regards,\r\n${user?.name || 'Legacy Prime Construction'}`;

                const mailtoUrl = `mailto:${selectedSubcontractor.email}?subject=${emailSubject}&body=${encodeURIComponent(emailBody)}`;

                // Open email client
                try {
                  if (Platform.OS === 'web') {
                    window.location.href = mailtoUrl;
                  } else {
                    await Linking.openURL(mailtoUrl);
                  }

                  setShowRequestModal(false);
                  setSelectedProject(null);
                  setSelectedFiles([]);
                  setUploadedFiles({});
                  setRequestNotes('');

                  Alert.alert(
                    'Email Client Opened',
                    `Your email client has been opened with the estimate request for ${selectedSubcontractor.name}. The email includes short links to all attached files. Please review and send.`
                  );
                } catch (error) {
                  console.error('[Email] Error opening email client:', error);
                  Alert.alert('Error', 'Failed to open email client');
                }
              }}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.sendRequestButtonText}>
                {uploadingFiles.size > 0 ? 'Uploading...' : 'Send Request'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Invite Method Selection Modal */}
      <Modal
        visible={showInviteMethodModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowInviteMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteMethodModal}>
            <View style={styles.inviteMethodHeader}>
              <Text style={styles.inviteMethodTitle}>Send Invitation</Text>
              <TouchableOpacity
                style={styles.inviteMethodCloseBtn}
                onPress={() => setShowInviteMethodModal(false)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteMethodSubtitle}>
              How would you like to send the subcontractor invitation?
            </Text>

            <View style={styles.inviteMethodOptions}>
              <TouchableOpacity
                style={styles.inviteMethodOption}
                onPress={handleSendInviteViaEmail}
                disabled={sendingInvitation}
              >
                <View style={[styles.inviteMethodIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Mail size={28} color="#2563EB" />
                </View>
                <Text style={styles.inviteMethodOptionTitle}>Email</Text>
                <Text style={styles.inviteMethodOptionDesc}>
                  Opens your email client with the invitation link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inviteMethodOption}
                onPress={handleChooseSms}
              >
                <View style={[styles.inviteMethodIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <MessageSquare size={28} color="#10B981" />
                </View>
                <Text style={styles.inviteMethodOptionTitle}>SMS</Text>
                <Text style={styles.inviteMethodOptionDesc}>
                  Send invitation link via text message
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.inviteMethodCancelBtn}
              onPress={() => setShowInviteMethodModal(false)}
            >
              <Text style={styles.inviteMethodCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SMS Phone Number Modal */}
      <Modal
        visible={showSmsPhoneModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSmsPhoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smsPhoneModal}>
            <View style={styles.smsPhoneHeader}>
              <Text style={styles.smsPhoneTitle}>Send SMS Invitation</Text>
              <TouchableOpacity
                style={styles.smsPhoneCloseBtn}
                onPress={() => setShowSmsPhoneModal(false)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.smsPhoneSubtitle}>
              Enter the subcontractor's phone number to send them the registration link via SMS.
            </Text>

            <View style={styles.smsPhoneInputContainer}>
              <Text style={styles.smsPhoneLabel}>Phone Number</Text>
              <View style={styles.smsPhoneInputWrapper}>
                <Text style={styles.smsPhonePrefix}>+1</Text>
                <TextInput
                  style={styles.smsPhoneInput}
                  value={smsPhoneNumber}
                  onChangeText={(text) => {
                    setSmsPhoneNumber(formatPhoneInput(text));
                    setSmsPhoneError('');
                  }}
                  placeholder="(555) 123-4567"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {smsPhoneError ? (
                <Text style={styles.smsPhoneErrorText}>{smsPhoneError}</Text>
              ) : (
                <Text style={styles.smsPhoneHint}>Enter 10-digit US phone number</Text>
              )}
            </View>

            {/* Phone number preview */}
            {smsPhoneNumber.length === 10 && (
              <View style={styles.smsPhonePreview}>
                <Phone size={16} color="#10B981" />
                <Text style={styles.smsPhonePreviewText}>
                  +1 ({smsPhoneNumber.slice(0, 3)}) {smsPhoneNumber.slice(3, 6)}-{smsPhoneNumber.slice(6, 10)}
                </Text>
              </View>
            )}

            <View style={styles.smsPhoneActions}>
              <TouchableOpacity
                style={styles.smsPhoneCancelBtn}
                onPress={() => {
                  setShowSmsPhoneModal(false);
                  setSmsPhoneNumber('');
                  setSmsPhoneError('');
                }}
              >
                <Text style={styles.smsPhoneCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.smsPhoneSendBtn,
                  (!validateUsPhoneNumber(smsPhoneNumber) || sendingSms) && styles.smsPhoneSendBtnDisabled
                ]}
                onPress={handleSendInviteViaSms}
                disabled={!validateUsPhoneNumber(smsPhoneNumber) || sendingSms}
              >
                {sendingSms ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text style={styles.smsPhoneSendText}>Send SMS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
    marginTop: 12,
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  inviteHeaderButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  inviteHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  inviteDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F9FAFB',
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
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxHeight: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  content: {
    padding: 20,
  },
  listHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  leftActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  selectedCount: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  rightActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  selectAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  selectAllText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500' as const,
  },
  bulkActionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  smsButton: {
    backgroundColor: '#059669',
  },
  bulkActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600' as const,
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
  subcontractorRow: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  subRowHeader: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  subInfo: {
    flex: 1,
  },
  subNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
  },
  subName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  subCompanyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
  },
  subCompany: {
    fontSize: 14,
    color: '#4B5563',
  },
  subEmail: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  subPhone: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
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
  tradeTag: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    marginBottom: 8,
  },
  tradeTagText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  ratingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  subActions: {
    flexDirection: 'row' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  estimateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  estimateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  viewButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewButtonText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  statsWidget: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden' as const,
  },
  statsHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  statsHeaderTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  statsContent: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 4,
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
  inputError: {
    borderColor: '#DC2626',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#1E40AF',
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top' as const,
  },
  tradeSelector: {
    marginBottom: 8,
    maxHeight: 50,
  },
  tradeSelectorError: {
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 4,
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
  modalButtonGroup: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  inviteButton: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  inviteButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  inviteButtonText: {
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
  uploadingText: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
  },
  uploadedText: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
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
  customTradeContainer: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  addCustomTradeButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addCustomTradeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  customTradePreview: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  customTradePreviewText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#16A34A',
  },

  // Invite Method Modal Styles
  inviteMethodModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  inviteMethodHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  inviteMethodTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  inviteMethodCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inviteMethodSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  inviteMethodOptions: {
    flexDirection: 'row' as const,
    gap: 16,
    marginBottom: 20,
  },
  inviteMethodOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  inviteMethodIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  inviteMethodOptionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  inviteMethodOptionDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  inviteMethodCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  inviteMethodCancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600' as const,
  },

  // SMS Phone Modal Styles
  smsPhoneModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 420,
  },
  smsPhoneHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  smsPhoneTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  smsPhoneCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  smsPhoneSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  smsPhoneInputContainer: {
    marginBottom: 16,
  },
  smsPhoneLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  smsPhoneInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  smsPhonePrefix: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginRight: 8,
  },
  smsPhoneInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '500' as const,
    letterSpacing: 1,
  },
  smsPhoneHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
  },
  smsPhoneErrorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 6,
  },
  smsPhonePreview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  smsPhonePreviewText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  smsPhoneActions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  smsPhoneCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
  },
  smsPhoneCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  smsPhoneSendBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  smsPhoneSendBtnDisabled: {
    opacity: 0.5,
  },
  smsPhoneSendText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
