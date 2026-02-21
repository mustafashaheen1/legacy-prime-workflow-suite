import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, X, DollarSign, FileText, Clock, CheckCircle, XCircle, AlertCircle, Download, History } from 'lucide-react-native';
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { ChangeOrder } from '@/types';
import { useApp } from '@/contexts/AppContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { generateChangeOrderHtml } from '@/utils/generateChangeOrderPdf';

export default function ChangeOrdersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, projects, clients, updateProject, user } = useApp();

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedChangeOrderForHistory, setSelectedChangeOrderForHistory] = useState<ChangeOrder | null>(null);
  
  const changeOrdersQuery = trpc.changeOrders.getChangeOrders.useQuery({ projectId: id as string });
  const addChangeOrderMutation = trpc.changeOrders.addChangeOrder.useMutation({
    onSuccess: () => {
      changeOrdersQuery.refetch();
      setModalVisible(false);
      setDescription('');
      setAmount('');
      setNotes('');
      Alert.alert('Success', 'Change order added successfully!');
    },
    onError: (error) => {
      console.error('[Change Order] Full error:', error);
      console.error('[Change Order] Error message:', error.message);
      console.error('[Change Order] Error data:', error.data);
      const errorMessage = error.message || 'Failed to add change order. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  });

  const updateChangeOrderMutation = trpc.changeOrders.updateChangeOrder.useMutation({
    onSuccess: () => {
      changeOrdersQuery.refetch();
      Alert.alert('Success', 'Change order updated successfully!');
    },
    onError: (error) => {
      console.error('[Change Order] Update error:', error);
      Alert.alert('Error', error.message || 'Failed to update change order');
    },
  });
  
  const changeOrders = useMemo<ChangeOrder[]>(() => {
    return changeOrdersQuery.data?.changeOrders || [];
  }, [changeOrdersQuery.data]);
  
  const totalChangeOrdersAmount = useMemo(() => {
    return changeOrders
      .filter(co => co.status === 'approved')
      .reduce((sum, co) => sum + co.amount, 0);
  }, [changeOrders]);
  
  const pendingChangeOrders = useMemo(() => {
    return changeOrders.filter(co => co.status === 'pending');
  }, [changeOrders]);
  
  const approvedChangeOrders = useMemo(() => {
    return changeOrders.filter(co => co.status === 'approved');
  }, [changeOrders]);
  
  const rejectedChangeOrders = useMemo(() => {
    return changeOrders.filter(co => co.status === 'rejected');
  }, [changeOrders]);
  
  const handleAddChangeOrder = () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!company?.id) {
      Alert.alert('Error', 'Company information not found');
      return;
    }

    const mutationData = {
      companyId: company.id,
      projectId: id as string,
      description: description.trim(),
      amount: amountValue,
      date: new Date().toISOString(),
      status: 'pending' as const,
      notes: notes.trim() || undefined,
    };

    console.log('[Change Order] Submitting mutation with data:', mutationData);
    addChangeOrderMutation.mutate(mutationData);
  };

  const handleApprove = (changeOrder: ChangeOrder) => {
    const project = projects.find(p => p.id === id);
    const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
    const currentContract = project?.contractAmount ?? 0;
    const newContract = currentContract + changeOrder.amount;

    const doApprove = () => {
      updateChangeOrderMutation.mutate({
        id: changeOrder.id,
        status: 'approved',
        approvedDate: new Date().toISOString(),
      });
    };

    const doApproveAndUpdateContract = () => {
      updateChangeOrderMutation.mutate({
        id: changeOrder.id,
        status: 'approved',
        approvedDate: new Date().toISOString(),
      });
      if (project) {
        updateProject(project.id, { contractAmount: newContract });
      }
    };

    if (isAdmin && project) {
      const contractLine = currentContract > 0
        ? `\n\nContract: $${currentContract.toLocaleString()} → $${newContract.toLocaleString()}`
        : `\n\nThis sets the contract amount to $${newContract.toLocaleString()}`;

      Alert.alert(
        'Approve Change Order',
        `"${changeOrder.description}" • $${changeOrder.amount.toLocaleString()}${contractLine}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve Only', onPress: doApprove },
          { text: 'Approve + Update Contract', style: 'default', onPress: doApproveAndUpdateContract },
        ]
      );
    } else {
      Alert.alert(
        'Approve Change Order',
        `Approve "${changeOrder.description}" for $${changeOrder.amount.toLocaleString()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve', style: 'default', onPress: doApprove },
        ]
      );
    }
  };

  const handleReject = (changeOrder: ChangeOrder) => {
    Alert.alert(
      'Reject Change Order',
      `Reject "${changeOrder.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            updateChangeOrderMutation.mutate({
              id: changeOrder.id,
              status: 'rejected',
            });
          },
        },
      ]
    );
  };

  const handleExportPdf = async (changeOrder: ChangeOrder) => {
    try {
      const project = projects.find(p => p.id === changeOrder.projectId);
      const client = clients.find(c => c.id === project?.clientId);

      const html = generateChangeOrderHtml({
        changeOrder,
        project,
        client,
        company,
      });

      if (Platform.OS === 'web') {
        // Web: Open print dialog
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
        }
      } else {
        // Mobile: Generate PDF and share
        const { uri } = await Print.printToFileAsync({ html });

        Alert.alert(
          'Export Options',
          'How would you like to share this change order?',
          [
            {
              text: 'Email',
              onPress: async () => {
                const canSendMail = await MailComposer.isAvailableAsync();
                if (canSendMail) {
                  await MailComposer.composeAsync({
                    recipients: client?.email ? [client.email] : [],
                    subject: `Change Order - ${project?.name}`,
                    body: `Please find attached the change order for ${changeOrder.description}.`,
                    attachments: [uri],
                  });
                } else {
                  Alert.alert('Error', 'Email is not available on this device');
                }
              },
            },
            {
              text: 'Share',
              onPress: async () => {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  await Sharing.shareAsync(uri);
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    }
  };

  const getStatusIcon = (status: ChangeOrder['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={20} color="#10B981" />;
      case 'rejected':
        return <XCircle size={20} color="#EF4444" />;
      case 'pending':
        return <AlertCircle size={20} color="#F59E0B" />;
    }
  };
  
  const getStatusColor = (status: ChangeOrder['status']) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'rejected':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
    }
  };
  
  const getStatusBgColor = (status: ChangeOrder['status']) => {
    switch (status) {
      case 'approved':
        return '#D1FAE5';
      case 'rejected':
        return '#FEE2E2';
      case 'pending':
        return '#FEF3C7';
    }
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
          <Text style={styles.headerTitle}>Change Orders</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <DollarSign size={24} color="#10B981" />
              <Text style={styles.summaryTitle}>Total Approved Change Orders</Text>
            </View>
            <Text style={styles.summaryAmount}>${totalChangeOrdersAmount.toLocaleString()}</Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{approvedChangeOrders.length}</Text>
                <Text style={styles.summaryStatLabel}>Approved</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, { color: '#F59E0B' }]}>{pendingChangeOrders.length}</Text>
                <Text style={styles.summaryStatLabel}>Pending</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, { color: '#EF4444' }]}>{rejectedChangeOrders.length}</Text>
                <Text style={styles.summaryStatLabel}>Rejected</Text>
              </View>
            </View>
          </View>

          {changeOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <FileText size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Change Orders Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Track additional work and contract modifications by adding change orders
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={() => setModalVisible(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.emptyStateButtonText}>Add First Change Order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.changeOrdersList}>
              {changeOrders.map((changeOrder) => (
                <View key={changeOrder.id} style={styles.changeOrderCard}>
                  <View style={styles.changeOrderHeader}>
                    <View style={styles.changeOrderHeaderLeft}>
                      {getStatusIcon(changeOrder.status)}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(changeOrder.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(changeOrder.status) }]}>
                          {changeOrder.status.charAt(0).toUpperCase() + changeOrder.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.changeOrderAmount}>${changeOrder.amount.toLocaleString()}</Text>
                  </View>
                  
                  <Text style={styles.changeOrderDescription}>{changeOrder.description}</Text>
                  
                  {changeOrder.notes && (
                    <View style={styles.changeOrderNotes}>
                      <FileText size={14} color="#6B7280" />
                      <Text style={styles.changeOrderNotesText}>{changeOrder.notes}</Text>
                    </View>
                  )}
                  
                  <View style={styles.changeOrderFooter}>
                    <View style={styles.changeOrderFooterLeft}>
                      <View style={styles.changeOrderDate}>
                        <Clock size={14} color="#9CA3AF" />
                        <Text style={styles.changeOrderDateText}>
                          {new Date(changeOrder.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>

                      {changeOrder.status === 'approved' && changeOrder.approvedDate && (
                        <Text style={styles.approvedDateText}>
                          Approved {new Date(changeOrder.approvedDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.exportButton}
                      onPress={() => handleExportPdf(changeOrder)}
                    >
                      <Download size={16} color="#2563EB" />
                      <Text style={styles.exportButtonText}>Export PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {changeOrder.status === 'pending' && (
                    <View style={styles.approvalActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApprove(changeOrder)}
                        disabled={updateChangeOrderMutation.isPending}
                      >
                        <CheckCircle size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(changeOrder)}
                        disabled={updateChangeOrderMutation.isPending}
                      >
                        <XCircle size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {changeOrder.history && changeOrder.history.length > 0 && (
                    <TouchableOpacity
                      style={styles.historyButton}
                      onPress={() => setSelectedChangeOrderForHistory(changeOrder)}
                    >
                      <History size={14} color="#6B7280" />
                      <Text style={styles.historyButtonText}>View History ({changeOrder.history.length})</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity 
              style={styles.modal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Change Order</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalLabel}>Description *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Additional bathroom fixtures"
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={styles.modalLabel}>Amount *</Text>
                <View style={styles.amountInputContainer}>
                  <DollarSign size={20} color="#6B7280" />
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                </View>

                <Text style={styles.modalLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Add any additional details..."
                  placeholderTextColor="#9CA3AF"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setModalVisible(false);
                      setDescription('');
                      setAmount('');
                      setNotes('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, addChangeOrderMutation.isPending && styles.submitButtonDisabled]}
                    onPress={handleAddChangeOrder}
                    disabled={addChangeOrderMutation.isPending}
                  >
                    <Text style={styles.submitButtonText}>
                      {addChangeOrderMutation.isPending ? 'Adding...' : 'Add Change Order'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={selectedChangeOrderForHistory !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedChangeOrderForHistory(null)}
        >
          <View style={styles.historyModalOverlay}>
            <View style={styles.historyModalContent}>
              <View style={styles.historyModalHeader}>
                <Text style={styles.historyModalTitle}>Change Order History</Text>
                <TouchableOpacity onPress={() => setSelectedChangeOrderForHistory(null)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {selectedChangeOrderForHistory && (
                <>
                  <View style={styles.historyOrderInfo}>
                    <Text style={styles.historyOrderDescription}>
                      {selectedChangeOrderForHistory.description}
                    </Text>
                    <Text style={styles.historyOrderAmount}>
                      ${selectedChangeOrderForHistory.amount.toLocaleString()}
                    </Text>
                  </View>

                  <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                    {selectedChangeOrderForHistory.history && selectedChangeOrderForHistory.history.length > 0 ? (
                      selectedChangeOrderForHistory.history.map((entry, index) => (
                        <View key={entry.id} style={styles.historyEntry}>
                          <View style={styles.historyEntryHeader}>
                            <View style={styles.historyEntryLeft}>
                              {entry.action === 'created' && <Plus size={16} color="#6B7280" />}
                              {entry.action === 'approved' && <CheckCircle size={16} color="#10B981" />}
                              {entry.action === 'rejected' && <XCircle size={16} color="#EF4444" />}
                              {entry.action === 'updated' && <Clock size={16} color="#F59E0B" />}
                              <Text style={[styles.historyAction, {
                                color: entry.action === 'approved' ? '#10B981' :
                                       entry.action === 'rejected' ? '#EF4444' :
                                       entry.action === 'created' ? '#6B7280' : '#F59E0B'
                              }]}>
                                {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                              </Text>
                            </View>
                            <Text style={styles.historyTimestamp}>
                              {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </Text>
                          </View>

                          <Text style={styles.historyUser}>By {entry.userName}</Text>

                          {entry.previousStatus && entry.newStatus && (
                            <View style={styles.historyStatusChange}>
                              <View style={[styles.historyStatusBadge, {
                                backgroundColor: entry.previousStatus === 'pending' ? '#FEF3C7' :
                                                entry.previousStatus === 'approved' ? '#D1FAE5' : '#FEE2E2'
                              }]}>
                                <Text style={[styles.historyStatusText, {
                                  color: entry.previousStatus === 'pending' ? '#92400E' :
                                        entry.previousStatus === 'approved' ? '#065F46' : '#991B1B'
                                }]}>
                                  {entry.previousStatus}
                                </Text>
                              </View>
                              <ArrowLeft size={12} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
                              <View style={[styles.historyStatusBadge, {
                                backgroundColor: entry.newStatus === 'pending' ? '#FEF3C7' :
                                                entry.newStatus === 'approved' ? '#D1FAE5' : '#FEE2E2'
                              }]}>
                                <Text style={[styles.historyStatusText, {
                                  color: entry.newStatus === 'pending' ? '#92400E' :
                                        entry.newStatus === 'approved' ? '#065F46' : '#991B1B'
                                }]}>
                                  {entry.newStatus}
                                </Text>
                              </View>
                            </View>
                          )}

                          {entry.notes && (
                            <Text style={styles.historyNotes}>{entry.notes}</Text>
                          )}

                          {index < selectedChangeOrderForHistory.history!.length - 1 && (
                            <View style={styles.historyDivider} />
                          )}
                        </View>
                      ))
                    ) : (
                      <View style={styles.historyEmpty}>
                        <History size={32} color="#D1D5DB" />
                        <Text style={styles.historyEmptyText}>No history available</Text>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: '#10B981',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#10B981',
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  changeOrdersList: {
    gap: 12,
  },
  changeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  changeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  changeOrderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  changeOrderAmount: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  changeOrderDescription: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  changeOrderNotes: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  changeOrderNotesText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  changeOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  changeOrderFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  changeOrderDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeOrderDateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  approvedDateText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500' as const,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        marginHorizontal: 'auto',
        maxWidth: 600,
        width: '100%',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'flex-start',
  },
  historyButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        marginHorizontal: 'auto',
        maxWidth: 600,
        width: '100%',
      },
    }),
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  historyOrderInfo: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyOrderDescription: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  historyOrderAmount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600' as const,
  },
  historyList: {
    padding: 20,
  },
  historyEntry: {
    marginBottom: 16,
  },
  historyEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyUser: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  historyStatusChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
  },
  historyNotes: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
  },
  historyEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
