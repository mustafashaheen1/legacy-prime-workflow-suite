import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { FileText, Calendar, Trash2, X, BarChart, Folder } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Report } from '@/types';

export default function ReportsScreen() {
  const { reports, deleteReport } = useApp();
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  };

  const handleDeleteReport = (reportId: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteReport(reportId);
            if (selectedReport?.id === reportId) {
              setShowDetailsModal(false);
              setSelectedReport(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'administrative':
        return '#2563EB';
      case 'financial':
        return '#10B981';
      case 'time-tracking':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Saved Reports',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Folder size={24} color="#2563EB" />
            <Text style={styles.headerTitle}>Reports Library</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} saved
          </Text>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Reports Yet</Text>
            <Text style={styles.emptyStateText}>
              Generate reports from the dashboard to see them here
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.back()}
            >
              <Text style={styles.emptyStateButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {reports.map((report) => (
              <TouchableOpacity
                key={report.id}
                style={styles.reportCard}
                onPress={() => handleViewReport(report)}
              >
                <View style={styles.reportCardHeader}>
                  <View
                    style={[
                      styles.reportTypeIcon,
                      { backgroundColor: `${getTypeColor(report.type)}15` },
                    ]}
                  >
                    <FileText size={20} color={getTypeColor(report.type)} />
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteReport(report.id)}
                  >
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.reportName}>{report.name}</Text>

                <View style={styles.reportMeta}>
                  <View style={styles.reportMetaRow}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.reportMetaText}>
                      {formatDate(report.generatedDate)}
                    </Text>
                  </View>
                  <View style={styles.reportMetaRow}>
                    <BarChart size={14} color="#6B7280" />
                    <Text style={styles.reportMetaText}>
                      {report.projectsCount} {report.projectsCount === 1 ? 'project' : 'projects'}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportStats}>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatLabel}>Budget</Text>
                    <Text style={styles.reportStatValue}>
                      ${(report.totalBudget ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatLabel}>Expenses</Text>
                    <Text style={styles.reportStatValue}>
                      ${(report.totalExpenses ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatLabel}>Hours</Text>
                    <Text style={styles.reportStatValue}>
                      {report.totalHours ?? 0}h
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{selectedReport.name}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.type.charAt(0).toUpperCase() + selectedReport.type.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Generated:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedReport.generatedDate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Summary</Text>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Projects</Text>
                      <Text style={styles.summaryValue}>{selectedReport.projectsCount}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Total Budget</Text>
                      <Text style={styles.summaryValue}>
                        ${(selectedReport.totalBudget ?? 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Total Expenses</Text>
                      <Text style={styles.summaryValue}>
                        ${(selectedReport.totalExpenses ?? 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Total Hours</Text>
                      <Text style={styles.summaryValue}>{selectedReport.totalHours ?? 0}h</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Projects</Text>
                  {selectedReport.projects?.map((project) => (
                    <View key={project.projectId} style={styles.projectDetail}>
                      <Text style={styles.projectDetailName}>{project.projectName}</Text>
                      <View style={styles.projectDetailRow}>
                        <Text style={styles.projectDetailLabel}>Budget:</Text>
                        <Text style={styles.projectDetailValue}>
                          ${project.budget.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.projectDetailRow}>
                        <Text style={styles.projectDetailLabel}>Expenses:</Text>
                        <Text style={styles.projectDetailValue}>
                          ${project.expenses.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.projectDetailRow}>
                        <Text style={styles.projectDetailLabel}>Hours Worked:</Text>
                        <Text style={styles.projectDetailValue}>{project.hoursWorked}h</Text>
                      </View>
                      <View style={styles.projectDetailRow}>
                        <Text style={styles.projectDetailLabel}>Status:</Text>
                        <Text style={styles.projectDetailValue}>{project.status}</Text>
                      </View>
                      <View style={styles.projectDetailRow}>
                        <Text style={styles.projectDetailLabel}>Progress:</Text>
                        <Text style={styles.projectDetailValue}>{project.progress}%</Text>
                      </View>

                      {project.expensesByCategory && Object.keys(project.expensesByCategory).length > 0 && (
                        <View style={styles.expensesCategorySection}>
                          <Text style={styles.expensesCategoryTitle}>Expenses by Category:</Text>
                          {Object.entries(project.expensesByCategory).map(([category, amount]) => (
                            <View key={category} style={styles.expensesCategoryRow}>
                              <Text style={styles.expensesCategoryLabel}>{category}:</Text>
                              <Text style={styles.expensesCategoryValue}>
                                ${(amount ?? 0).toLocaleString()}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 36,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  reportsList: {
    padding: 16,
    gap: 16,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  reportMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  reportStats: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reportStat: {
    flex: 1,
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  reportStatValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
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
    maxHeight: '90%',
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
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600' as const,
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  projectDetail: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  projectDetailName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  projectDetailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  projectDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 110,
  },
  projectDetailValue: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  expensesCategorySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expensesCategoryTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  expensesCategoryRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  expensesCategoryLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 120,
  },
  expensesCategoryValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600' as const,
    flex: 1,
  },
});
