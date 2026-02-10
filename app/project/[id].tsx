import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, FlatList, Platform, Dimensions, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import DailyTasksButton from '@/components/DailyTasksButton';
import { Report, ProjectReportData, DailyLog, ChangeOrder, Payment } from '@/types';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, FileText, Clock, DollarSign, Camera, Ruler, Plus, Archive, TrendingUp, Calendar, Users, AlertCircle, UserCheck, CreditCard, Wallet, Coffee, File, FolderOpen, Upload, Folder, Download, Trash2, X, Search, Image as ImageIcon } from 'lucide-react-native';
import ClockInOutComponent from '@/components/ClockInOutComponent';
import RequestEstimateComponent from '@/components/RequestEstimate';
import GlobalAIChatSimple from '@/components/GlobalAIChatSimple';
import { Image } from 'expo-image';
import UploaderBadge from '@/components/UploaderBadge';
import * as ImagePicker from 'expo-image-picker';
import { useState, useMemo, useEffect, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ProjectFile, FileCategory } from '@/types';
import { photoCategories } from '@/mocks/data';

type TabType = 'overview' | 'estimate' | 'change-orders' | 'clock' | 'expenses' | 'photos' | 'videos' | 'files' | 'reports';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, archiveProject, user, company, clockEntries, expenses, estimates, projectFiles, addProjectFile, deleteProjectFile, photos, addPhoto, reports, addReport, refreshReports, dailyLogs = [] } = useApp();

  const changeOrdersQuery = trpc.changeOrders.getChangeOrders.useQuery({ projectId: id as string });
  const paymentsQuery = trpc.payments.getPayments.useQuery({ projectId: id as string });
  const inspectionVideosQuery = trpc.crm.getInspectionVideos.useQuery({
    companyId: company?.id || '',
    status: 'all'
  }, {
    enabled: !!company?.id
  });
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('documentation');
  const [fileNotes, setFileNotes] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhotoImage, setSelectedPhotoImage] = useState<string | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string>('');
  const [photoCategory, setPhotoCategory] = useState<string>('Foundation');
  const [showAIReportModal, setShowAIReportModal] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; category: string; notes?: string; date: string } | null>(null);
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const project = projects.find(p => p.id === id);
  
  const changeOrders = useMemo<ChangeOrder[]>(() => {
    return changeOrdersQuery.data?.changeOrders || [];
  }, [changeOrdersQuery.data]);
  
  const payments = useMemo<Payment[]>(() => {
    return paymentsQuery.data?.payments || [];
  }, [paymentsQuery.data]);

  useEffect(() => {
    if (activeTab === 'estimate') {
      // Show estimate tab content inline (no navigation needed)
      // This allows users to view estimates without leaving the project page
      return;
    }
    if (activeTab === 'expenses') {
      router.push(`/project/${id}/expenses` as any);
    }
    if (activeTab === 'change-orders') {
      router.push(`/project/${id}/change-orders` as any);
    }
    if (activeTab === 'files') {
      router.push(`/project/${id}/files-navigation` as any);
      setActiveTab('overview');
    }
    if (activeTab === 'reports' && company?.id) {
      refreshReports();
    }
  }, [activeTab, id, router, company?.id, refreshReports]);

  // Removed - budgetRemaining and budgetUsedPercentage are now calculated after adjustedProjectTotal and totalJobCost
  
  const daysElapsed = useMemo(() => {
    if (!project) return 0;
    const start = new Date(project.startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [project]);

  const projectExpenses = useMemo(() => {
    return expenses.filter(e => e.projectId === id);
  }, [expenses, id]);

  const expensesByType = useMemo(() => {
    const byType: { [key: string]: number } = {};
    projectExpenses.forEach(expense => {
      const type = expense.type;
      byType[type] = (byType[type] || 0) + expense.amount;
    });
    return byType;
  }, [projectExpenses]);

  const totalJobCost = useMemo(() => {
    return projectExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [projectExpenses]);

  const laborCosts = useMemo(() => {
    return projectExpenses
      .filter(exp => exp.type === 'Labor')
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [projectExpenses]);

  const materialCosts = useMemo(() => {
    return projectExpenses
      .filter(exp => exp.type !== 'Labor')
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [projectExpenses]);

  // Get estimate linked to this project via project.estimateId
  const projectEstimates = useMemo(() => {
    if (!project?.estimateId) return [];
    const linkedEstimate = estimates.find(e => e.id === project.estimateId);
    return linkedEstimate ? [linkedEstimate] : [];
  }, [estimates, project?.estimateId]);

  const currentProjectFiles = useMemo(() => {
    let filtered = projectFiles.filter(f => f.projectId === id);
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.name.toLowerCase().includes(query) || 
        f.notes?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [projectFiles, id, categoryFilter, searchQuery]);

  const projectPhotos = useMemo(() => {
    return photos.filter(p => p.projectId === id);
  }, [photos, id]);

  useEffect(() => {
    projectPhotos.forEach(photo => {
      const existingFile = projectFiles.find(f => 
        f.category === 'photos' && 
        f.uri === photo.url && 
        f.projectId === id
      );
      
      if (!existingFile) {
        const photoFile: ProjectFile = {
          id: `photo-file-${photo.id}`,
          projectId: id as string,
          name: `${photo.category} - ${new Date(photo.date).toLocaleDateString()}`,
          category: 'photos',
          fileType: 'image/jpeg',
          fileSize: 0,
          uri: photo.url,
          uploadDate: photo.date,
          notes: photo.notes || `Category: ${photo.category}`,
        };
        addProjectFile(photoFile);
        console.log('[Files] Auto-synced photo to files:', photoFile.name);
      }
    });
  }, [projectPhotos, projectFiles, id, addProjectFile]);

  const projectReports = useMemo(() => {
    return reports.filter(r => r.projectIds.includes(id as string));
  }, [reports, id]);

  const filesByCategory = useMemo(() => {
    if (!project) return {};

    const byCategory: { [key: string]: ProjectFile[] } = {};
    currentProjectFiles.forEach(file => {
      if (!byCategory[file.category]) {
        byCategory[file.category] = [];
      }
      byCategory[file.category].push(file);
    });

    // Add inspection videos as a 'videos' category
    const allInspectionVideos = inspectionVideosQuery.data?.inspections || [];
    const projectClientName = project.name.split(' - ')[0].trim();
    const clientVideos = allInspectionVideos.filter(v =>
      v.clientName.toLowerCase() === projectClientName.toLowerCase() &&
      v.status === 'completed' &&
      v.videoUrl
    );

    if (clientVideos.length > 0) {
      byCategory['videos'] = clientVideos.map(video => ({
        id: video.id,
        projectId: project.id,
        name: `${video.clientName} - ${new Date(video.completedAt || video.createdAt).toLocaleDateString()}`,
        category: 'videos' as FileCategory,
        fileType: 'video',
        fileSize: video.videoSize || 0,
        uri: video.videoUrl,
        uploadDate: video.completedAt || video.createdAt,
        notes: video.notes || undefined,
      }));
    }

    return byCategory;
  }, [currentProjectFiles, inspectionVideosQuery.data, project]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const file: ProjectFile = {
          id: Date.now().toString(),
          projectId: id as string,
          name: asset.name,
          category: selectedCategory,
          fileType: asset.mimeType || 'unknown',
          fileSize: asset.size || 0,
          uri: asset.uri,
          uploadDate: new Date().toISOString(),
          notes: fileNotes,
        };

        addProjectFile(file);
        setUploadModalVisible(false);
        setFileNotes('');
        Alert.alert('Success', 'File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProjectFile(fileId),
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'receipts': return DollarSign;
      case 'photos': return Camera;
      case 'reports': return FileText;
      case 'plans': return Ruler;
      case 'estimates': return FileText;
      case 'documentation': return File;
      case 'videos': return Camera;
      default: return Folder;
    }
  };

  const getCategoryColor = (category: FileCategory) => {
    switch (category) {
      case 'receipts': return '#10B981';
      case 'photos': return '#3B82F6';
      case 'reports': return '#8B5CF6';
      case 'plans': return '#F59E0B';
      case 'estimates': return '#EC4899';
      case 'documentation': return '#6B7280';
      case 'videos': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const totalBudgetAllowance = useMemo(() => {
    return projectEstimates.reduce((sum, estimate) => {
      const estimateBudget = estimate.items.reduce((itemSum, item) => itemSum + (item.budget || 0), 0);
      return sum + estimateBudget;
    }, 0);
  }, [projectEstimates]);

  const totalChangeOrdersApproved = useMemo(() => {
    return changeOrders
      .filter(co => co.status === 'approved')
      .reduce((sum, co) => sum + co.amount, 0);
  }, [changeOrders]);
  
  const adjustedProjectTotal = useMemo(() => {
    if (!project) return 0;
    return project.budget + totalChangeOrdersApproved;
  }, [project, totalChangeOrdersApproved]);
  
  const totalPaymentsReceived = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const totalLaborCost = useMemo(() => {
    return expensesByType['Labor'] || 0;
  }, [expensesByType]);

  const totalSubcontractorCost = useMemo(() => {
    return expensesByType['Subcontractor'] || 0;
  }, [expensesByType]);

  const totalMaterialCost = useMemo(() => {
    return expensesByType['Material'] || 0;
  }, [expensesByType]);

  const laborHoursCost = useMemo(() => {
    if (!project || project.hoursWorked === 0) return 0;
    return totalLaborCost / project.hoursWorked;
  }, [totalLaborCost, project]);

  const projectClockEntries = useMemo(() => {
    return clockEntries.filter(entry => entry.projectId === id);
  }, [clockEntries, id]);

  const totalLaborHours = useMemo(() => {
    return projectClockEntries.reduce((sum, entry) => {
      if (!entry.clockOut) return sum;
      const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
  }, [projectClockEntries]);

  const pendingBalance = useMemo(() => {
    return adjustedProjectTotal - totalPaymentsReceived;
  }, [adjustedProjectTotal, totalPaymentsReceived]);

  const profitMargin = useMemo(() => {
    return adjustedProjectTotal - totalJobCost;
  }, [adjustedProjectTotal, totalJobCost]);

  const budgetRemaining = useMemo(() => {
    return adjustedProjectTotal - totalJobCost;
  }, [adjustedProjectTotal, totalJobCost]);

  const budgetUsedPercentage = useMemo(() => {
    if (adjustedProjectTotal === 0) return 0;
    return (totalJobCost / adjustedProjectTotal) * 100;
  }, [adjustedProjectTotal, totalJobCost]);

  const estimatedHoursRemaining = useMemo(() => {
    if (!project) return 0;
    if (project.progress === 0) return project.hoursWorked;
    return Math.ceil((project.hoursWorked / project.progress) * (100 - project.progress));
  }, [project]);
  
  const activeClockEntries = useMemo(() => {
    if (!project) return [];
    return clockEntries.filter(entry => entry.projectId === project.id && !entry.clockOut);
  }, [project, clockEntries]);
  
  const getEmployeeName = (employeeId: string) => {
    if (user?.id === employeeId) return user.name;
    return `Employee ${employeeId.slice(0, 4)}`;
  };



  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View style={styles.overviewContent}>
            <Image
              source={{ uri: project.image }}
              style={styles.projectImage}
              contentFit="cover"
            />

            {user?.role !== 'field-employee' && (
              <View style={styles.balancesCard}>
                <View style={styles.cardHeader}>
                  <Wallet size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Financial Overview</Text>
                </View>
                
                <View style={styles.topMetrics}>
                  <View style={styles.topMetricLarge}>
                    <Text style={styles.topMetricLabel}>Job Total Agreement</Text>
                    <Text style={styles.topMetricValue}>${adjustedProjectTotal.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>
                      {totalChangeOrdersApproved > 0 
                        ? `Base: ${project.budget.toLocaleString()} + CO: ${totalChangeOrdersApproved.toLocaleString()}` 
                        : 'Contract Value'}
                    </Text>
                  </View>
                  <View style={styles.topMetricMedium}>
                    <Text style={styles.topMetricLabel}>Total Expenses</Text>
                    <Text style={[styles.topMetricValue, { color: '#EF4444' }]}>${totalJobCost.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>{projectExpenses.length} transactions</Text>
                  </View>
                  <View style={styles.topMetricMedium}>
                    <Text style={styles.topMetricLabel}>Remaining Budget</Text>
                    <Text style={[styles.topMetricValue, { color: budgetRemaining >= 0 ? '#10B981' : '#EF4444' }]}>
                      ${Math.abs(budgetRemaining).toLocaleString()}
                    </Text>
                    <Text style={styles.topMetricSubtext}>
                      {budgetRemaining >= 0 ? 'Available' : 'Over Budget'}
                    </Text>
                  </View>
                </View>

                {/* Cost Breakdown */}
                {(laborCosts > 0 || materialCosts > 0) && (
                  <View style={styles.costBreakdownSection}>
                    <Text style={styles.costBreakdownTitle}>Cost Breakdown</Text>
                    <View style={styles.costBreakdownCard}>
                      {materialCosts > 0 && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Material & Other Costs:</Text>
                          <Text style={styles.costValue}>${materialCosts.toLocaleString()}</Text>
                        </View>
                      )}
                      {laborCosts > 0 && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Labor Costs:</Text>
                          <Text style={styles.costValue}>${laborCosts.toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={styles.costDivider} />
                      <View style={styles.costRow}>
                        <Text style={styles.costLabelBold}>Total Job Cost:</Text>
                        <Text style={styles.costValueBold}>${totalJobCost.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {totalBudgetAllowance > 0 && (
                  <View style={styles.budgetAllowanceSection}>
                    <View style={styles.budgetAllowanceHeader}>
                      <FileText size={16} color="#10B981" />
                      <Text style={styles.budgetAllowanceTitle}>Budget Allowances from Estimates</Text>
                    </View>
                    <View style={styles.budgetAllowanceCard}>
                      <View style={styles.budgetAllowanceRow}>
                        <Text style={styles.budgetAllowanceLabel}>Total Budget Allowances</Text>
                        <Text style={styles.budgetAllowanceValue}>${totalBudgetAllowance.toLocaleString()}</Text>
                      </View>
                      <View style={styles.budgetAllowanceRow}>
                        <Text style={styles.budgetAllowanceLabel}>Allowances Spent</Text>
                        <Text style={[styles.budgetAllowanceValue, { color: '#EF4444' }]}>
                          ${Math.min(totalJobCost, totalBudgetAllowance).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.budgetAllowanceRow}>
                        <Text style={styles.budgetAllowanceLabel}>Allowances Remaining</Text>
                        <Text style={[styles.budgetAllowanceValue, { 
                          color: (totalBudgetAllowance - totalJobCost) >= 0 ? '#10B981' : '#EF4444' 
                        }]}>
                          ${Math.abs(totalBudgetAllowance - totalJobCost).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.budgetAllowanceProgressBar}>
                        <View style={[styles.budgetAllowanceProgressFill, { 
                          width: `${Math.min(100, (totalJobCost / totalBudgetAllowance) * 100)}%`,
                          backgroundColor: (totalJobCost / totalBudgetAllowance) > 1 ? '#EF4444' : '#10B981'
                        }]} />
                      </View>
                      <Text style={styles.budgetAllowanceSubtext}>
                        {((totalJobCost / totalBudgetAllowance) * 100).toFixed(1)}% of budget allowances used
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionSubtitle}>Cost Breakdown</Text>
                <View style={styles.balancesGrid}>
                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#FEE2E2' }]}>
                      <Users size={16} color="#EF4444" />
                    </View>
                    <Text style={styles.balanceLabel}>Subcontractors</Text>
                    <Text style={[styles.balanceValue, { color: '#EF4444', fontSize: 16 }]}>
                      ${totalSubcontractorCost.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#DBEAFE' }]}>
                      <UserCheck size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.balanceLabel}>Labor</Text>
                    <Text style={[styles.balanceValue, { color: '#2563EB', fontSize: 16 }]}>
                      ${totalLaborCost.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#FEF3C7' }]}>
                      <FileText size={16} color="#F59E0B" />
                    </View>
                    <Text style={styles.balanceLabel}>Materials</Text>
                    <Text style={[styles.balanceValue, { color: '#F59E0B', fontSize: 16 }]}>
                      ${totalMaterialCost.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#E9D5FF' }]}>
                      <DollarSign size={16} color="#9333EA" />
                    </View>
                    <Text style={styles.balanceLabel}>Other Costs</Text>
                    <Text style={[styles.balanceValue, { color: '#9333EA', fontSize: 16 }]}>
                      ${((expensesByType['Office'] || 0) + (expensesByType['Others'] || 0)).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionSubtitle}>Payment & Profit Status</Text>
                <View style={styles.paymentGrid}>
                  <View style={styles.paymentMetric}>
                    <View style={styles.paymentMetricHeader}>
                      <CreditCard size={18} color="#10B981" />
                      <Text style={styles.paymentMetricTitle}>Payments Received</Text>
                    </View>
                    <Text style={styles.paymentMetricValue}>${totalPaymentsReceived.toLocaleString()}</Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, { 
                        width: `${Math.min(100, (totalPaymentsReceived / adjustedProjectTotal) * 100)}%`,
                        backgroundColor: '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {((totalPaymentsReceived / adjustedProjectTotal) * 100).toFixed(1)}% of contract • {payments.length} payment(s)
                    </Text>
                  </View>

                  <View style={styles.paymentMetric}>
                    <View style={styles.paymentMetricHeader}>
                      <AlertCircle size={18} color={pendingBalance > 0 ? '#F59E0B' : '#10B981'} />
                      <Text style={styles.paymentMetricTitle}>Pending Balance</Text>
                    </View>
                    <Text style={[styles.paymentMetricValue, { color: pendingBalance > 0 ? '#F59E0B' : '#10B981' }]}>
                      ${pendingBalance.toLocaleString()}
                    </Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, { 
                        width: `${Math.min(100, (pendingBalance / adjustedProjectTotal) * 100)}%`,
                        backgroundColor: pendingBalance > 0 ? '#F59E0B' : '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {((pendingBalance / adjustedProjectTotal) * 100).toFixed(1)}% remaining
                    </Text>
                  </View>
                </View>

                <View style={styles.profitSection}>
                  <View style={styles.profitHeader}>
                    <TrendingUp size={20} color={profitMargin >= 0 ? '#10B981' : '#EF4444'} />
                    <Text style={styles.profitTitle}>Projected Profit</Text>
                  </View>
                  <Text style={[styles.profitAmount, { color: profitMargin >= 0 ? '#10B981' : '#EF4444' }]}>
                    ${Math.abs(profitMargin).toLocaleString()}
                  </Text>
                  <View style={styles.profitBar}>
                    <View style={[styles.profitFill, { 
                      width: `${Math.min(100, Math.abs(profitMargin) / adjustedProjectTotal * 100)}%`,
                      backgroundColor: profitMargin >= 0 ? '#10B981' : '#EF4444'
                    }]} />
                  </View>
                  <Text style={styles.profitSubtext}>
                    {profitMargin >= 0 ? 'Profit Margin' : 'Loss'}: {((profitMargin / adjustedProjectTotal) * 100).toFixed(1)}%
                  </Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionSubtitle}>Labor & Timing Insights</Text>
                <View style={styles.insightsGrid}>
                  <View style={styles.insightCard}>
                    <Clock size={16} color="#6366F1" />
                    <Text style={styles.insightValue}>{totalLaborHours.toFixed(1)}h</Text>
                    <Text style={styles.insightLabel}>Total Labor Hours</Text>
                  </View>
                  <View style={styles.insightCard}>
                    <DollarSign size={16} color="#6366F1" />
                    <Text style={styles.insightValue}>${laborHoursCost.toFixed(2)}/h</Text>
                    <Text style={styles.insightLabel}>Labor Cost Rate</Text>
                  </View>
                  <View style={styles.insightCard}>
                    <Users size={16} color="#6366F1" />
                    <Text style={styles.insightValue}>{activeClockEntries.length}</Text>
                    <Text style={styles.insightLabel}>Active Workers</Text>
                  </View>
                  <View style={styles.insightCard}>
                    <Calendar size={16} color="#6366F1" />
                    <Text style={styles.insightValue}>{daysElapsed}</Text>
                    <Text style={styles.insightLabel}>Days Elapsed</Text>
                  </View>
                </View>
              </View>
            )}

            {activeClockEntries.length > 0 && (
              <View style={styles.clockedInCard}>
                <View style={styles.clockedInHeader}>
                  <UserCheck size={20} color="#10B981" />
                  <Text style={styles.clockedInTitle}>Active Workers</Text>
                  <View style={styles.activeBadgeHeader}>
                    <View style={styles.activePulse} />
                    <Text style={styles.activeBadgeTextHeader}>{activeClockEntries.length} Clocked In</Text>
                  </View>
                </View>
                <View style={styles.clockedInList}>
                  {activeClockEntries.map(entry => {
                    const clockInTime = new Date(entry.clockIn);
                    const now = new Date();
                    const hoursWorked = ((now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)).toFixed(1);
                    const isOnLunch = entry.lunchBreaks?.some(lunch => !lunch.endTime) || false;
                    
                    return (
                      <View key={entry.id} style={styles.clockedInItem}>
                        <View style={styles.clockedInEmployeeAvatar}>
                          <Text style={styles.clockedInEmployeeAvatarText}>
                            {getEmployeeName(entry.employeeId).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.clockedInItemInfo}>
                          <Text style={styles.clockedInEmployeeName} numberOfLines={1}>
                            {getEmployeeName(entry.employeeId)}
                          </Text>
                          <Text style={styles.clockedInClockTime}>
                            {clockInTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </Text>
                          {isOnLunch ? (
                            <View style={styles.clockedInLunchBadge}>
                              <Coffee size={10} color="#F59E0B" />
                              <Text style={styles.clockedInLunchText}>On Lunch</Text>
                            </View>
                          ) : (
                            <>
                              {entry.category && (
                                <View style={styles.clockedInCategoryBadge}>
                                  <Text style={styles.clockedInCategoryText}>{entry.category}</Text>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                        <View style={styles.clockedInHoursContainer}>
                          <Text style={styles.clockedInHoursText}>{hoursWorked}h</Text>
                          <View style={[styles.activeIndicatorSmall, isOnLunch && { backgroundColor: '#F59E0B' }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={[styles.contentRow, dimensions.width < 600 && styles.contentRowVertical]}>
              <View style={styles.mainContent}>
                <View style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <TrendingUp size={20} color="#2563EB" />
                <Text style={styles.cardTitle}>Project Progress</Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${project.progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{project.progress}% Complete</Text>
              </View>
              <View style={styles.progressDetails}>
                <View style={styles.progressDetailItem}>
                  <Text style={styles.progressDetailLabel}>Timeline</Text>
                  <Text style={styles.progressDetailValue}>{daysElapsed} days elapsed</Text>
                </View>
                <View style={styles.progressDetailItem}>
                  <Text style={styles.progressDetailLabel}>Hours</Text>
                  <Text style={styles.progressDetailValue}>{project.hoursWorked}h logged</Text>
                </View>
                <View style={styles.progressDetailItem}>
                  <Text style={styles.progressDetailLabel}>Remaining</Text>
                  <Text style={styles.progressDetailValue}>~{estimatedHoursRemaining}h</Text>
                </View>
              </View>
                </View>

                {user?.role !== 'field-employee' && (
                  <View style={styles.chartCard}>
                    <View style={styles.cardHeader}>
                      <DollarSign size={20} color="#10B981" />
                      <Text style={styles.cardTitle}>Budget Overview</Text>
                    </View>
                    <View style={styles.budgetChart}>
                      <View style={styles.budgetBar}>
                        <View style={[styles.budgetUsed, { width: `${Math.min(budgetUsedPercentage, 100)}%`, backgroundColor: budgetUsedPercentage > 100 ? '#EF4444' : '#10B981' }]} />
                      </View>
                      <View style={styles.budgetLegend}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: budgetUsedPercentage > 100 ? '#EF4444' : '#10B981' }]} />
                          <Text style={styles.legendText}>Spent: ${totalJobCost.toLocaleString()}</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#E5E7EB' }]} />
                          <Text style={styles.legendText}>Budget: ${adjustedProjectTotal.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.budgetStats}>
                      <View style={[styles.budgetStatCard, { backgroundColor: budgetRemaining < 0 ? '#FEE2E2' : '#DCFCE7' }]}>
                        <Text style={styles.budgetStatLabel}>Remaining</Text>
                        <Text style={[styles.budgetStatValue, { color: budgetRemaining < 0 ? '#EF4444' : '#10B981' }]}>
                          ${Math.abs(budgetRemaining).toLocaleString()}
                        </Text>
                        {budgetRemaining < 0 && (
                          <View style={styles.warningBadge}>
                            <AlertCircle size={12} color="#EF4444" />
                            <Text style={styles.warningText}>Over Budget</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.budgetStatCard}>
                        <Text style={styles.budgetStatLabel}>Budget Used</Text>
                        <Text style={styles.budgetStatValue}>{budgetUsedPercentage.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Calendar size={20} color="#8B5CF6" />
                <Text style={styles.statLabel}>Start Date</Text>
                <Text style={styles.statValue}>{new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={styles.statBox}>
                <Clock size={20} color="#F59E0B" />
                <Text style={styles.statLabel}>Days Active</Text>
                <Text style={styles.statValue}>{daysElapsed}</Text>
              </View>
              <View style={styles.statBox}>
                <Users size={20} color="#3B82F6" />
                <Text style={styles.statLabel}>Hours Logged</Text>
                <Text style={styles.statValue}>{project.hoursWorked}h</Text>
              </View>
              <View style={styles.statBox}>
                <View style={[styles.statusDot, { backgroundColor: project.status === 'active' ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>{project.status}</Text>
              </View>
                </View>

                {user?.role !== 'field-employee' && (
                  <View style={styles.chartCard}>
                    <View style={styles.cardHeader}>
                      <FileText size={20} color="#6366F1" />
                      <Text style={styles.cardTitle}>Quick Stats</Text>
                    </View>
                    <View style={styles.quickStatsGrid}>
                      <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>${(project.expenses / project.hoursWorked).toFixed(2)}</Text>
                        <Text style={styles.quickStatLabel}>Cost per Hour</Text>
                      </View>
                      <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{((project.budget - project.expenses) / (100 - project.progress)).toFixed(0)}</Text>
                        <Text style={styles.quickStatLabel}>Budget per % Left</Text>
                      </View>
                      <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{(project.hoursWorked / daysElapsed).toFixed(1)}</Text>
                        <Text style={styles.quickStatLabel}>Avg Hours/Day</Text>
                      </View>
                    </View>
                  </View>
                )}

                    {project.endDate && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>End Date</Text>
                    <Text style={styles.infoValue}>{new Date(project.endDate).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );

      case 'estimate':
        console.log('[Estimate Tab] Debug info:', {
          projectId: project.id,
          projectEstimateId: project.estimateId,
          estimatesCount: estimates.length,
          estimateIds: estimates.map(e => e.id),
        });
        const originalEstimate = project.estimateId ? estimates.find(e => e.id === project.estimateId) : null;
        console.log('[Estimate Tab] Found original estimate:', originalEstimate ? originalEstimate.name : 'NOT FOUND');

        return (
          <View style={styles.estimateTabContent}>
            {originalEstimate && (
              <View style={styles.originalEstimateSection}>
                <View style={styles.originalEstimateHeader}>
                  <FileText size={24} color="#2563EB" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.originalEstimateTitle}>Original Estimate</Text>
                    <Text style={styles.originalEstimateSubtitle}>{originalEstimate.name}</Text>
                  </View>
                  <View style={styles.estimateStatusBadge}>
                    <Text style={styles.estimateStatusText}>{originalEstimate.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.estimateDetailsCard}>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateLabel}>Created</Text>
                    <Text style={styles.estimateValue}>
                      {new Date(originalEstimate.createdDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateLabel}>Items</Text>
                    <Text style={styles.estimateValue}>{originalEstimate.items.length}</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateLabel}>Subtotal</Text>
                    <Text style={styles.estimateValue}>${originalEstimate.subtotal.toLocaleString()}</Text>
                  </View>
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateLabel}>Tax ({(originalEstimate.taxRate * 100).toFixed(1)}%)</Text>
                    <Text style={styles.estimateValue}>${originalEstimate.taxAmount.toLocaleString()}</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateSummaryRow}>
                    <Text style={styles.estimateTotalLabel}>Total</Text>
                    <Text style={styles.estimateTotalValue}>${originalEstimate.total.toLocaleString()}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewFullEstimateButton}
                  onPress={() => router.push(`/project/${id}/estimate?estimateId=${originalEstimate.id}` as any)}
                >
                  <FileText size={20} color="#2563EB" />
                  <Text style={styles.viewFullEstimateButtonText}>View Full Estimate</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.newEstimateSection}>
              <View style={styles.newEstimateDivider}>
                <View style={styles.newEstimateDividerLine} />
                <Text style={styles.newEstimateDividerText}>
                  {originalEstimate ? 'Additional Work' : 'Get Started'}
                </Text>
                <View style={styles.newEstimateDividerLine} />
              </View>

              <Text style={styles.newEstimateTitle}>
                {originalEstimate ? 'Create estimates for change orders or additional work' : 'Create your first estimate'}
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push(`/project/${id}/estimate` as any)}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>New Estimate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => router.push(`/project/${id}/takeoff` as any)}
                >
                  <Ruler size={20} color="#2563EB" />
                  <Text style={styles.secondaryButtonText}>Takeoff Tool</Text>
                </TouchableOpacity>
              </View>

              <View style={{ width: '100%', marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16, textAlign: 'center' }}>Need a Subcontractor Estimate?</Text>
                <RequestEstimateComponent
                  projectId={project.id}
                  projectName={project.name}
                />
              </View>
            </View>
          </View>
        );

      case 'change-orders':
        router.push(`/project/${id}/change-orders` as any);
        return null;

      case 'clock':
        return (
          <View style={styles.clockTabContent}>
            <ClockInOutComponent projectId={project.id} projectName={project.name} />
          </View>
        );

      case 'expenses':
        return (
          <View style={styles.expensesTabContent}>
            <View style={styles.expensesHeader}>
              <Text style={styles.expensesTitle}>Add New Expense</Text>
              <TouchableOpacity
                style={styles.fullExpensesButton}
                onPress={() => router.push(`/project/${id}/expenses` as any)}
              >
                <Upload size={18} color="#2563EB" />
                <Text style={styles.fullExpensesButtonText}>Scan Receipt</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.expensesInfo}>
              <Text style={styles.expensesInfoText}>
                For AI receipt scanning and detailed expense entry, use the full expenses screen.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openExpensesButton}
              onPress={() => router.push(`/project/${id}/expenses` as any)}
            >
              <Text style={styles.openExpensesButtonText}>Open Full Expenses Screen</Text>
            </TouchableOpacity>

            <View style={styles.recentExpensesList}>
              <Text style={styles.recentExpensesTitle}>
                Recent Expenses ({projectExpenses.length})
              </Text>
              {projectExpenses.length === 0 ? (
                <View style={styles.expensesEmptyState}>
                  <DollarSign size={48} color="#D1D5DB" />
                  <Text style={styles.expensesEmptyStateText}>No expenses yet</Text>
                  <Text style={styles.expensesEmptyStateSubtext}>
                    Add your first expense to track project costs
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.recentExpensesScroll}>
                  {projectExpenses.slice(0, 10).map((expense) => (
                    <View key={expense.id} style={styles.recentExpenseCard}>
                      <View style={styles.recentExpenseHeader}>
                        <View style={styles.recentExpenseInfo}>
                          <Text style={styles.recentExpenseType}>{expense.type}</Text>
                          {expense.subcategory && expense.subcategory !== expense.type && (
                            <Text style={styles.recentExpenseSubcategory}>
                              {expense.subcategory}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.recentExpenseAmount}>
                          ${expense.amount.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.recentExpenseStore}>{expense.store}</Text>
                      <Text style={styles.recentExpenseDate}>
                        {new Date(expense.date).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                  {projectExpenses.length > 10 && (
                    <TouchableOpacity
                      style={styles.viewAllExpensesButton}
                      onPress={() => router.push(`/project/${id}/expenses` as any)}
                    >
                      <Text style={styles.viewAllExpensesButtonText}>
                        View All {projectExpenses.length} Expenses
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        );

      case 'photos':
        const pickPhotoImage = async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          });

          if (!result.canceled) {
            setSelectedPhotoImage(result.assets[0].uri);
          }
        };

        const takePhotoImage = async () => {
          if (Platform.OS === 'web') {
            console.log('Camera not available on web');
            return;
          }

          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            console.log('Camera permission denied');
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 1,
          });

          if (!result.canceled) {
            setSelectedPhotoImage(result.assets[0].uri);
          }
        };

        const handlePhotoSave = async () => {
          if (!selectedPhotoImage) return;

          setIsUploadingPhoto(true);
          try {
            console.log('[Photos] Uploading photo to S3...');

            // Convert image to blob for upload
            let blob: Blob;
            if (Platform.OS === 'web') {
              const response = await fetch(selectedPhotoImage);
              blob = await response.blob();
            } else {
              // On mobile, we'll use base64
              const base64 = await fetch(selectedPhotoImage).then(r => r.blob());
              blob = base64;
            }

            // Get pre-signed upload URL
            const fileName = `photo-${Date.now()}-${photoCategory.toLowerCase()}.jpg`;
            const urlResponse = await fetch('/api/get-s3-upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName,
                fileType: 'image/jpeg',
              }),
            });

            if (!urlResponse.ok) {
              const error = await urlResponse.json();
              throw new Error(error.error || 'Failed to get upload URL');
            }

            const { uploadUrl, fileUrl } = await urlResponse.json();
            console.log('[Photos] Got upload URL, uploading to S3...');

            // Upload to S3
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'image/jpeg' },
            });

            if (!uploadResponse.ok) {
              throw new Error('Failed to upload photo to S3');
            }

            console.log('[Photos] Photo uploaded successfully:', fileUrl);

            // Save photo with S3 URL
            const newPhoto = {
              id: Date.now().toString(),
              projectId: id as string,
              category: photoCategory,
              notes: photoNotes,
              url: fileUrl,
              date: new Date().toISOString(),
            };
            addPhoto(newPhoto);

            setSelectedPhotoImage(null);
            setPhotoNotes('');
            setPhotoCategory('Foundation');
            Alert.alert('Success', 'Photo uploaded and saved successfully!');
          } catch (error) {
            console.error('[Photos] Upload error:', error);
            Alert.alert('Error', 'Failed to upload photo. Please try again.');
          } finally {
            setIsUploadingPhoto(false);
          }
        };

        return (
          <View style={styles.photosTabContent}>
            <ScrollView style={styles.photosScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.photosHeader}>
                <Text style={styles.photosTitle}>Photos</Text>
                <View style={styles.photosHeaderButtons}>
                  <TouchableOpacity style={styles.photosHeaderButton} onPress={takePhotoImage}>
                    <Camera size={20} color="#FFFFFF" />
                    <Text style={styles.photosHeaderButtonText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photosHeaderButton} onPress={pickPhotoImage}>
                    <Upload size={20} color="#FFFFFF" />
                    <Text style={styles.photosHeaderButtonText}>Upload Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.photosForm}>
                <Text style={styles.photosLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoCategoryScroll}
                  contentContainerStyle={styles.photoCategoryContent}
                >
                  {photoCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.photoCategoryOption,
                        photoCategory === cat && styles.photoCategoryOptionSelected
                      ]}
                      onPress={() => setPhotoCategory(cat)}
                    >
                      <Text style={[
                        styles.photoCategoryOptionText,
                        photoCategory === cat && styles.photoCategoryOptionTextSelected
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.photosLabel}>Notes</Text>
                <TextInput
                  style={[styles.photosInput, styles.photosTextArea]}
                  placeholder="Add notes about this photo..."
                  placeholderTextColor="#9CA3AF"
                  value={photoNotes}
                  onChangeText={setPhotoNotes}
                  multiline
                  numberOfLines={4}
                />

                {selectedPhotoImage && (
                  <View style={styles.photosPreviewContainer}>
                    <Text style={styles.photosLabel}>Preview</Text>
                    <Image source={{ uri: selectedPhotoImage }} style={styles.photosPreview} contentFit="cover" />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.photosSaveButton, (!selectedPhotoImage || isUploadingPhoto) && styles.photosSaveButtonDisabled]}
                  onPress={handlePhotoSave}
                  disabled={!selectedPhotoImage || isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.photosSaveButtonText, { marginLeft: 8 }]}>Uploading...</Text>
                    </>
                  ) : (
                    <Text style={styles.photosSaveButtonText}>Save Photo</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.photosGallery}>
                <Text style={styles.photosGalleryTitle}>Thumbnail Gallery ({projectPhotos.length})</Text>
                {projectPhotos.length === 0 ? (
                  <View style={styles.photosEmptyState}>
                    <Camera size={48} color="#D1D5DB" />
                    <Text style={styles.photosEmptyStateText}>No photos yet</Text>
                    <Text style={styles.photosEmptyStateSubtext}>Upload or take a photo to get started</Text>
                  </View>
                ) : (
                  <View style={styles.photosGalleryGrid}>
                    {projectPhotos.map((photo) => (
                      <TouchableOpacity
                        key={photo.id}
                        style={styles.photosGalleryItem}
                        onPress={() => setViewingPhoto({ url: photo.url, category: photo.category, notes: photo.notes, date: photo.date })}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: photo.url }} style={styles.photosThumbnail} contentFit="cover" />

                        {/* 🎯 CLIENT DESIGN: Uploader info below image */}
                        <View style={styles.photosThumbnailInfo}>
                          {/* Uploader: Avatar + Name */}
                          <View style={styles.photoUploaderRow}>
                            {photo.uploader ? (
                              <>
                                {photo.uploader.avatar ? (
                                  <Image
                                    source={{ uri: photo.uploader.avatar }}
                                    style={styles.photoUploaderAvatar}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={styles.photoUploaderAvatarPlaceholder}>
                                    <Text style={styles.photoUploaderInitials}>
                                      {photo.uploader.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </Text>
                                  </View>
                                )}
                                <Text style={styles.photoUploaderName} numberOfLines={1}>
                                  {photo.uploader.name}
                                </Text>
                              </>
                            ) : (
                              <>
                                <View style={styles.photoUploaderAvatarPlaceholder}>
                                  <Text style={styles.photoUploaderInitials}>?</Text>
                                </View>
                                <Text style={styles.photoUploaderName}>Unknown</Text>
                              </>
                            )}
                          </View>

                          {/* Category */}
                          <View style={styles.photosCategoryBadge}>
                            <Text style={styles.photosCategoryBadgeText}>{photo.category}</Text>
                          </View>

                          {/* Notes */}
                          {photo.notes && (
                            <Text style={styles.photosThumbnailNotes} numberOfLines={2}>
                              {photo.notes}
                            </Text>
                          )}

                          {/* Date */}
                          <Text style={styles.photosThumbnailDate}>
                            {new Date(photo.date).toLocaleDateString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        );

      case 'files':
        return (
          <View style={styles.filesTabContent}>
            <View style={styles.filesHeaderFixed}>
              <View style={styles.filesHeaderTop}>
                <View>
                  <Text style={styles.filesTitle}>Project Files</Text>
                  <Text style={styles.filesSubtitle}>{currentProjectFiles.length} files • {projectPhotos.length} photos • {filesByCategory['videos']?.length || 0} videos • {projectReports.length} reports</Text>
                </View>
                <View style={styles.filesHeaderButtons}>
                  <TouchableOpacity 
                    style={styles.organizedViewButton}
                    onPress={() => router.push(`/project/${id}/files-navigation` as any)}
                  >
                    <Folder size={18} color="#2563EB" />
                    <Text style={styles.organizedViewButtonText}>Organized</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={() => setUploadModalVisible(true)}
                  >
                    <Upload size={18} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.searchBar}>
                <Search size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search files..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilters}>
                <TouchableOpacity
                  style={[styles.categoryFilterChip, categoryFilter === 'all' && styles.categoryFilterChipActive]}
                  onPress={() => setCategoryFilter('all')}
                >
                  <Text style={[styles.categoryFilterText, categoryFilter === 'all' && styles.categoryFilterTextActive]}>All ({currentProjectFiles.length})</Text>
                </TouchableOpacity>
                {(['receipts', 'photos', 'videos', 'reports', 'plans', 'estimates', 'documentation'] as FileCategory[]).map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryFilterChip, categoryFilter === cat && styles.categoryFilterChipActive]}
                    onPress={() => setCategoryFilter(cat)}
                  >
                    <Text style={[styles.categoryFilterText, categoryFilter === cat && styles.categoryFilterTextActive]}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)} ({filesByCategory[cat]?.length || 0})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView 
              style={styles.filesList}
              showsVerticalScrollIndicator={false}
            >
              {Object.keys(filesByCategory).length === 0 ? (
                <View style={styles.emptyFilesState}>
                  <FolderOpen size={64} color="#D1D5DB" />
                  <Text style={styles.emptyFilesTitle}>No files yet</Text>
                  <Text style={styles.emptyFilesSubtitle}>Upload documents, plans, or receipts to get started</Text>
                  <TouchableOpacity 
                    style={styles.emptyUploadButton}
                    onPress={() => setUploadModalVisible(true)}
                  >
                    <Upload size={20} color="#FFFFFF" />
                    <Text style={styles.emptyUploadButtonText}>Upload First File</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                Object.entries(filesByCategory).map(([category, files]) => {
                  const CategoryIcon = getCategoryIcon(category as FileCategory);
                  const categoryColor = getCategoryColor(category as FileCategory);
                  
                  return (
                    <View key={category} style={styles.categoryFolderSection}>
                      <View style={styles.categoryFolderHeader}>
                        <View style={[styles.categoryFolderIcon, { backgroundColor: `${categoryColor}20` }]}>
                          <CategoryIcon size={20} color={categoryColor} />
                        </View>
                        <Text style={styles.categoryFolderTitle}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                        <View style={[styles.categoryFolderCount, { backgroundColor: `${categoryColor}20` }]}>
                          <Text style={[styles.categoryFolderCountText, { color: categoryColor }]}>
                            {files.length}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.categoryFolderFiles}>
                        {files.map((item) => {
                          const ItemCategoryIcon = getCategoryIcon(item.category);
                          const itemCategoryColor = getCategoryColor(item.category);
                          
                          return (
                            <View key={item.id} style={styles.fileCard}>
                              <View style={styles.fileCardContent}>
                                <View style={[styles.fileIconContainer, { backgroundColor: `${itemCategoryColor}20` }]}>
                                  <ItemCategoryIcon size={24} color={itemCategoryColor} />
                                </View>
                                <View style={styles.fileInfo}>
                                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                                  <View style={styles.fileMetaRow}>
                                    <Text style={styles.fileSize}>{formatFileSize(item.fileSize)}</Text>
                                    <Text style={styles.fileDate}>
                                      {new Date(item.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Text>
                                  </View>
                                  {item.notes && (
                                    <Text style={styles.fileNotes} numberOfLines={2}>{item.notes}</Text>
                                  )}
                                </View>
                              </View>
                              <View style={styles.fileActions}>
                                {Platform.OS === 'web' && (
                                  <TouchableOpacity
                                    style={styles.fileActionButton}
                                    onPress={async () => {
                                      // Special handling for videos - fetch signed URL first
                                      if (item.category === 'videos') {
                                        try {
                                          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                                          const response = await fetch(`${apiUrl}/api/get-video-view-url?videoKey=${encodeURIComponent(item.uri)}`);

                                          if (!response.ok) {
                                            throw new Error('Failed to get video URL');
                                          }

                                          const result = await response.json();
                                          if (result.viewUrl) {
                                            Linking.openURL(result.viewUrl);
                                          }
                                        } catch (error: any) {
                                          console.error('[Files] Error loading video:', error);
                                          Alert.alert('Error', error.message || 'Failed to load video');
                                        }
                                      } else {
                                        // Regular file download
                                        const link = document.createElement('a');
                                        link.href = item.uri;
                                        link.download = item.name;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }
                                    }}
                                  >
                                    <Download size={18} color="#2563EB" />
                                  </TouchableOpacity>
                                )}
                                {item.category !== 'videos' && (
                                  <TouchableOpacity
                                    style={styles.fileActionButton}
                                    onPress={() => handleDeleteFile(item.id, item.name)}
                                  >
                                    <Trash2 size={18} color="#EF4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <Modal
              visible={uploadModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setUploadModalVisible(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setUploadModalVisible(false)}
              >
                <TouchableOpacity 
                  style={styles.uploadModal}
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.uploadModalHeader}>
                    <Text style={styles.uploadModalTitle}>Upload File</Text>
                    <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                      <X size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.uploadModalLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                    {(['receipts', 'photos', 'reports', 'plans', 'estimates', 'documentation', 'other'] as FileCategory[]).map(cat => {
                      const CategoryIcon = getCategoryIcon(cat);
                      const categoryColor = getCategoryColor(cat);
                      
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryOption,
                            selectedCategory === cat && { borderColor: categoryColor, backgroundColor: `${categoryColor}10` }
                          ]}
                          onPress={() => setSelectedCategory(cat)}
                        >
                          <CategoryIcon size={20} color={selectedCategory === cat ? categoryColor : '#9CA3AF'} />
                          <Text style={[
                            styles.categoryOptionText,
                            selectedCategory === cat && { color: categoryColor }
                          ]}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.uploadModalLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.uploadNotesInput}
                    placeholder="Add notes about this file..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    value={fileNotes}
                    onChangeText={setFileNotes}
                    textAlignVertical="top"
                  />

                  <View style={styles.uploadModalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setUploadModalVisible(false);
                        setFileNotes('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.selectFileButton}
                      onPress={handlePickDocument}
                    >
                      <Upload size={18} color="#FFFFFF" />
                      <Text style={styles.selectFileButtonText}>Select File</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </View>
        );

      case 'videos':
        const allInspectionVideos = inspectionVideosQuery.data?.inspections || [];

        // Extract client name from project name (format: "Client Name - Estimate Name")
        const projectClientName = project.name.split(' - ')[0].trim();

        // Filter videos to only show those belonging to this project's client
        const clientVideos = allInspectionVideos.filter(v =>
          v.clientName.toLowerCase() === projectClientName.toLowerCase() &&
          v.status === 'completed' &&
          v.videoUrl
        );

        return (
          <View style={styles.photosTabContent}>
            <ScrollView style={styles.photosScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.photosHeader}>
                <View>
                  <Text style={styles.photosTitle}>Inspection Videos</Text>
                  <Text style={styles.filesSubtitle}>
                    {clientVideos.length} {clientVideos.length === 1 ? 'video' : 'videos'} for {projectClientName}
                  </Text>
                </View>
              </View>

              {inspectionVideosQuery.isLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.loadingText}>Loading videos...</Text>
                </View>
              ) : clientVideos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Camera size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateTitle}>No inspection videos yet</Text>
                  <Text style={styles.emptyStateText}>
                    {projectClientName} hasn't uploaded any inspection videos yet
                  </Text>
                </View>
              ) : (
                <View style={styles.photosGallery}>
                  <Text style={styles.photosGalleryTitle}>Client Videos</Text>
                  <View style={styles.videosGalleryGrid}>
                    {clientVideos.map((video) => (
                      <TouchableOpacity
                        key={video.id}
                        style={styles.videoGalleryItem}
                        onPress={async () => {
                          try {
                            console.log('[Videos] Getting video view URL for:', video.videoUrl);
                            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                            const response = await fetch(`${apiUrl}/api/get-video-view-url?videoKey=${encodeURIComponent(video.videoUrl)}`);

                            if (!response.ok) {
                              throw new Error('Failed to get video URL');
                            }

                            const result = await response.json();
                            console.log('[Videos] Got video view URL');

                            if (result.viewUrl) {
                              Linking.openURL(result.viewUrl);
                            }
                          } catch (error: any) {
                            console.error('[Videos] Error loading video:', error);
                            Alert.alert('Error', error.message || 'Failed to load video');
                          }
                        }}
                      >
                        <View style={styles.videoGalleryThumbnail}>
                          <Camera size={40} color="#FFFFFF" />
                          <View style={styles.videoPlayOverlay}>
                            <View style={styles.videoPlayButton}>
                              <Text style={styles.videoPlayIcon}>▶</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.videoGalleryInfo}>
                          <Text style={styles.videoGalleryClient}>{video.clientName}</Text>
                          <Text style={styles.videoGalleryDate}>
                            {new Date(video.completedAt || video.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                          {video.videoSize && (
                            <Text style={styles.videoGallerySize}>
                              {(video.videoSize / 1024 / 1024).toFixed(1)} MB
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        );

      case 'reports':
        const handleGenerateProjectReport = (type: 'administrative' | 'expenses' | 'time-tracking' | 'daily-logs') => {
          if (!project) return;

          if (type === 'administrative') {
            const projectClockEntries = clockEntries.filter(entry => entry.projectId === project.id);
            const projectExpenses = expenses.filter(e => e.projectId === project.id);
            
            const expensesByCategory: { [category: string]: number } = {};
            projectExpenses.forEach(expense => {
              const category = expense.type || 'Uncategorized';
              expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
            });

            const totalExpenses = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
            const totalLaborHours = projectClockEntries.reduce((sum, entry) => {
              if (!entry.clockOut) return sum;
              const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }, 0);

            const projectData: ProjectReportData = {
              projectId: project.id,
              projectName: project.name,
              budget: project.budget,
              expenses: totalExpenses,
              hoursWorked: totalLaborHours,
              clockEntries: projectClockEntries.length,
              status: project.status,
              progress: project.progress,
              startDate: project.startDate,
              endDate: project.endDate,
              expensesByCategory,
            };

            const adjustedBudget = project.budget + totalChangeOrdersApproved;
            const profitMargin = adjustedBudget - totalExpenses;

            const report: Report = {
              id: `report-${Date.now()}`,
              name: `Admin & Financial Report - ${project.name}`,
              type: 'administrative',
              generatedDate: new Date().toISOString(),
              projectIds: [project.id],
              projectsCount: 1,
              totalBudget: adjustedBudget,
              totalExpenses: totalExpenses,
              totalHours: totalLaborHours,
              projects: [projectData],
              expensesByCategory,
            };

            addReport(report);
            console.log('[Report] Generated administrative & financial report for project:', project.name);
            Alert.alert(
              'Report Generated',
              `Admin & Financial report saved successfully.\n\nTotal Budget: ${adjustedBudget.toLocaleString()}\nTotal Expenses: ${totalExpenses.toLocaleString()}\nProfit: ${profitMargin.toLocaleString()}`
            );
          } else if (type === 'daily-logs') {
            const logs = Array.isArray(dailyLogs) ? dailyLogs.filter(log => log.projectId === project.id) : [];
            
            if (logs.length === 0) {
              Alert.alert('No Daily Logs', 'This project has no daily logs to export.');
              return;
            }

            const report: Report = {
              id: `report-${Date.now()}`,
              name: `Daily Logs - ${project.name}`,
              type: 'custom',
              generatedDate: new Date().toISOString(),
              projectIds: [project.id],
              projectsCount: 1,
              notes: JSON.stringify({ 
                dailyLogs: [{ 
                  projectId: project.id, 
                  projectName: project.name, 
                  logs: logs 
                }] 
              }),
            };

            addReport(report);
            console.log('[Report] Generated daily logs report for project:', project.name);
            console.log('[Report] Included', logs.length, 'daily logs');
            Alert.alert(
              'Report Generated',
              `Daily logs report saved successfully. ${logs.length} log(s) included.`
            );
          } else if (type === 'expenses') {
            const projectExpenses = expenses.filter(e => e.projectId === project.id);
            
            const expensesByCategory: { [category: string]: number } = {};
            projectExpenses.forEach(expense => {
              const category = expense.type || 'Uncategorized';
              expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
            });

            const projectData: ProjectReportData = {
              projectId: project.id,
              projectName: project.name,
              budget: project.budget,
              expenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
              hoursWorked: project.hoursWorked,
              clockEntries: 0,
              status: project.status,
              progress: project.progress,
              startDate: project.startDate,
              endDate: project.endDate,
              expensesByCategory,
            };

            const report: Report = {
              id: `report-${Date.now()}`,
              name: `Expenses Report - ${project.name}`,
              type: 'expenses',
              generatedDate: new Date().toISOString(),
              projectIds: [project.id],
              projectsCount: 1,
              totalExpenses: projectData.expenses,
              projects: [projectData],
              expensesByCategory,
            };

            addReport(report);
            console.log('[Report] Generated expenses report for project:', project.name);
            Alert.alert('Report Generated', 'Expenses breakdown report saved successfully.');
          } else if (type === 'time-tracking') {
            const projectClockEntries = clockEntries.filter(entry => entry.projectId === project.id);

            const employeeDataMap: { [employeeId: string]: any } = {};
            
            projectClockEntries.forEach(entry => {
              if (!employeeDataMap[entry.employeeId]) {
                employeeDataMap[entry.employeeId] = {
                  employeeId: entry.employeeId,
                  employeeName: `Employee ${entry.employeeId.slice(0, 8)}`,
                  totalHours: 0,
                  regularHours: 0,
                  overtimeHours: 0,
                  totalDays: 0,
                  averageHoursPerDay: 0,
                  clockEntries: [],
                };
              }

              if (entry.clockOut) {
                const hours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
                employeeDataMap[entry.employeeId].totalHours += hours;
                
                if (hours > 8) {
                  employeeDataMap[entry.employeeId].regularHours += 8;
                  employeeDataMap[entry.employeeId].overtimeHours += (hours - 8);
                } else {
                  employeeDataMap[entry.employeeId].regularHours += hours;
                }
                
                employeeDataMap[entry.employeeId].clockEntries.push(entry);
              }
            });

            const employeeData = Object.values(employeeDataMap).map((emp: any) => ({
              ...emp,
              totalDays: emp.clockEntries.length,
              averageHoursPerDay: emp.totalHours / (emp.clockEntries.length || 1),
            }));

            const report: Report = {
              id: `report-${Date.now()}`,
              name: `Time Tracking Report - ${project.name}`,
              type: 'time-tracking',
              generatedDate: new Date().toISOString(),
              projectIds: [project.id],
              projectsCount: 1,
              totalHours: employeeData.reduce((sum, emp) => sum + emp.totalHours, 0),
              employeeData,
              employeeIds: employeeData.map(emp => emp.employeeId),
            };

            addReport(report);
            console.log('[Report] Generated time tracking report for project:', project.name);
            Alert.alert('Report Generated', `Time tracking report saved successfully. ${employeeData.length} employee(s), ${report.totalHours?.toFixed(2)} total hours.`);
          }
        };

        return (
          <View style={styles.tabPlaceholder}>
            <FolderOpen size={48} color="#9CA3AF" />
            <Text style={styles.placeholderText}>Generate and view project reports</Text>
            <Text style={styles.placeholderSubtext}>Financial summaries, time tracking, and custom reports</Text>
            
            <TouchableOpacity 
              style={[styles.primaryButton, { marginTop: 24, width: '90%' }]}
              onPress={() => setShowAIReportModal(true)}
            >
              <FileText size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Ask AI for Custom Report</Text>
            </TouchableOpacity>

            <View style={[styles.buttonRow, { marginTop: 16 }]}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => handleGenerateProjectReport('administrative')}
              >
                <FileText size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Admin & Financial</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => handleGenerateProjectReport('expenses')}
              >
                <FileText size={20} color="#2563EB" />
                <Text style={styles.secondaryButtonText}>Expenses</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.buttonRow, { marginTop: 12 }]}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => handleGenerateProjectReport('time-tracking')}
              >
                <FileText size={20} color="#2563EB" />
                <Text style={styles.secondaryButtonText}>Time Tracking</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => handleGenerateProjectReport('daily-logs')}
              >
                <FileText size={20} color="#2563EB" />
                <Text style={styles.secondaryButtonText}>Daily Logs</Text>
              </TouchableOpacity>
            </View>
            
            {projectReports.length > 0 && (
              <View style={styles.projectReportsList}>
                <Text style={styles.projectReportsTitle}>Saved Reports ({projectReports.length})</Text>
                {projectReports.map((report) => (
                  <TouchableOpacity
                    key={report.id}
                    style={styles.projectReportCard}
                    onPress={() => router.push('/reports' as any)}
                  >
                    <FileText size={20} color="#2563EB" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.projectReportName}>{report.name}</Text>
                      <Text style={styles.projectReportDate}>
                        {new Date(report.generatedDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log('[Back Button] Navigating back to dashboard');
            router.push('/(tabs)/dashboard' as any);
          }}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{project.name}</Text>
        <DailyTasksButton />
        {project.status !== 'archived' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              Alert.alert(
                'Complete Project',
                `Are you sure you want to complete "${project.name}"?\n\nThis will archive all project data including:\n• Photos\n• Expenses\n• Time logs\n• Estimates\n• Tasks\n\nThe project will be moved to cloud storage and removed from your active dashboard.`,
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Complete Project',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await archiveProject(project.id);
                        Alert.alert(
                          'Success',
                          'Project completed and archived to cloud storage.',
                          [
                            {
                              text: 'OK',
                              onPress: () => router.back(),
                            },
                          ]
                        );
                      } catch (error) {
                        console.error('Error archiving project:', error);
                        Alert.alert('Error', 'Failed to archive project. Please try again.');
                      }
                    },
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <Archive size={24} color="#10B981" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'estimate' && styles.activeTab]}
            onPress={() => setActiveTab('estimate')}
          >
            <Text style={[styles.tabText, activeTab === 'estimate' && styles.activeTabText]}>
              Estimate
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'change-orders' && styles.activeTab]}
            onPress={() => setActiveTab('change-orders')}
          >
            <Text style={[styles.tabText, activeTab === 'change-orders' && styles.activeTabText]}>
              Change Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'clock' && styles.activeTab]}
            onPress={() => setActiveTab('clock')}
          >
            <Text style={[styles.tabText, activeTab === 'clock' && styles.activeTabText]}>
              Clock
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}
            onPress={() => setActiveTab('expenses')}
          >
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>
              Expenses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'photos' && styles.activeTab]}
            onPress={() => setActiveTab('photos')}
          >
            <Text style={[styles.tabText, activeTab === 'photos' && styles.activeTabText]}>
              Photos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
            onPress={() => setActiveTab('videos')}
          >
            <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>
              Videos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'files' && styles.activeTab]}
            onPress={() => setActiveTab('files')}
          >
            <Text style={[styles.tabText, activeTab === 'files' && styles.activeTabText]}>
              Files
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
            onPress={() => setActiveTab('reports')}
          >
            <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
              Reports
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>
      </View>

      <Modal
        visible={showAIReportModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAIReportModal(false)}
      >
        <View style={styles.aiReportModalContainer}>
          <View style={styles.aiReportHeader}>
            <Text style={styles.aiReportTitle}>AI Custom Report for {project.name}</Text>
            <TouchableOpacity onPress={() => setShowAIReportModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <GlobalAIChatSimple 
            currentPageContext={`Project: ${project.name}, Budget: ${project.budget.toLocaleString()}, Expenses: ${project.expenses.toLocaleString()}, Progress: ${project.progress}%`}
            inline={true}
          />
        </View>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal
        visible={!!viewingPhoto}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerCloseArea}
            activeOpacity={1}
            onPress={() => setViewingPhoto(null)}
          />
          <View style={styles.photoViewerContainer}>
            <View style={styles.photoViewerHeader}>
              <View style={styles.photoViewerHeaderInfo}>
                <View style={styles.photosCategoryBadge}>
                  <Text style={styles.photosCategoryBadgeText}>{viewingPhoto?.category}</Text>
                </View>
                <Text style={styles.photoViewerDate}>
                  {viewingPhoto?.date ? new Date(viewingPhoto.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.photoViewerCloseButton}
                onPress={() => setViewingPhoto(null)}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {viewingPhoto && (
              <Image
                source={{ uri: viewingPhoto.url }}
                style={styles.photoViewerImage}
                contentFit="contain"
              />
            )}
            {viewingPhoto?.notes && (
              <View style={styles.photoViewerNotes}>
                <Text style={styles.photoViewerNotesText}>{viewingPhoto.notes}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
  },
  completeButton: {
    padding: 4,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabs: {
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 90,
  },
  activeTab: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#2563EB',
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
  },
  overviewContent: {
    padding: 20,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  contentRowVertical: {
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
  clockedInCard: {
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
  clockedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  clockedInTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
  },
  activeBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeTextHeader: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
  },
  clockedInList: {
    gap: 12,
  },
  clockedInItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  clockedInEmployeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockedInEmployeeAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  clockedInItemInfo: {
    flex: 1,
    gap: 4,
  },
  clockedInEmployeeName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  clockedInClockTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  clockedInCategoryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  clockedInCategoryText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  clockedInLunchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  clockedInLunchText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600' as const,
  },
  clockedInHoursContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  clockedInHoursText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  activeIndicatorSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  projectImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center',
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressDetailLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  progressDetailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  budgetChart: {
    marginBottom: 16,
  },
  budgetBar: {
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  budgetUsed: {
    height: '100%',
    borderRadius: 12,
  },
  budgetLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  budgetStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  budgetStatCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  budgetStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  budgetStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  warningText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600' as const,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStat: {
    flex: 1,
    minWidth: 0,
    maxWidth: '31%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  tabPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
  clockTabContent: {
    padding: 20,
  },
  employeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  employeeName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  clockInTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  categoryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  clockedInRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hoursWorkedText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  activePulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#059669',
  },
  expensesContent: {
    padding: 20,
  },
  expenseSummaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  expenseSummaryTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  expenseSummaryAmount: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#EF4444',
    marginBottom: 16,
  },
  expenseSummaryStats: {
    flexDirection: 'row',
    gap: 32,
  },
  expenseSummaryStat: {
    alignItems: 'center',
  },
  expenseSummaryStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  expenseSummaryStatValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  balancesCard: {
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
  balancesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  balanceItem: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  balanceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  profitSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  profitBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  profitFill: {
    height: '100%',
    borderRadius: 4,
  },
  profitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  profitInfoDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  profitInfoLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  profitInfoValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  expenseItemCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  expenseItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseItemType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  expenseItemAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  expenseItemSubcategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  expenseItemStore: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  expenseItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseItemDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  receiptBadge: {
    backgroundColor: '#D1FAE5',
    padding: 4,
    borderRadius: 4,
  },
  viewReceiptButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  viewReceiptButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  topMetrics: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  topMetricLarge: {
    flex: 1.5,
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  topMetricMedium: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
  },
  topMetricLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  topMetricValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  topMetricSubtext: {
    fontSize: 7,
    color: '#9CA3AF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paymentMetric: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  paymentMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentMetricTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  paymentMetricValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  paymentProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  paymentProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  paymentMetricSubtext: {
    fontSize: 10,
    color: '#6B7280',
  },
  profitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  profitTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  profitAmount: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  profitSubtext: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  insightLabel: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
  },
  budgetAllowanceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  budgetAllowanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  budgetAllowanceTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  budgetAllowanceCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  budgetAllowanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetAllowanceLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  budgetAllowanceValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  budgetAllowanceProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 8,
  },
  budgetAllowanceProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetAllowanceSubtext: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  filesTabContent: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  filesHeaderFixed: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filesHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  filesHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  organizedViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  organizedViewButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  filesTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  filesSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  categoryFilters: {
    maxHeight: 40,
  },
  categoryFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryFilterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryFilterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  categoryFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  emptyFilesState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyFilesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  emptyFilesSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyUploadButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  filesList: {
    flex: 1,
    padding: 16,
  },
  categoryFolderSection: {
    marginBottom: 24,
  },
  categoryFolderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryFolderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryFolderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
  },
  categoryFolderCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryFolderCountText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  categoryFolderFiles: {
    paddingLeft: 8,
  },
  fileCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fileCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fileCategoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fileCategoryText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  fileSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  fileDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  fileNotes: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileActionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  uploadModalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  categorySelector: {
    marginBottom: 8,
    maxHeight: 120,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    minWidth: 120,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  uploadNotesInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
  },
  uploadModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  selectFileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectFileButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  photosTabContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  photosScrollView: {
    flex: 1,
  },
  photosHeader: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  photosTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  photosHeaderButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  photosHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  photosHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  photosForm: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  photosLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  photoCategoryScroll: {
    marginBottom: 16,
  },
  photoCategoryContent: {
    gap: 8,
    paddingVertical: 4,
  },
  photoCategoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoCategoryOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  photoCategoryOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  photoCategoryOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  photosPicker: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  photosPickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  photosInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
  },
  photosTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photosPreviewContainer: {
    marginBottom: 16,
  },
  photosPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  photosSaveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  photosSaveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  photosSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  photosGallery: {
    padding: 16,
    backgroundColor: '#E5E7EB',
  },
  photosGalleryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  photosGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  photosGalleryItem: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photosThumbnail: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
  },
  photosThumbnailInfo: {
    padding: 12,
  },
  // 🎯 CLIENT DESIGN: Photo uploader row (matches expense design)
  photoUploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  photoUploaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoUploaderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploaderInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  photoUploaderName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
  },
  photosCategoryBadge: {
    backgroundColor: '#3B82F6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  photosCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  photosThumbnailNotes: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 6,
  },
  photosThumbnailDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  photosThumbnailLabel: {
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'center',
  },
  photosEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  photosEmptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 16,
  },
  photosEmptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  projectReportsList: {
    width: '100%',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  projectReportsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  projectReportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  projectReportName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  projectReportDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  aiReportModalContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  aiReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  aiReportTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  videosGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  videoGalleryItem: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  videoGalleryThumbnail: {
    width: '100%',
    height: 140,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  videoPlayIcon: {
    fontSize: 20,
    color: '#2563EB',
    marginLeft: 3,
  },
  videoGalleryInfo: {
    padding: 12,
    gap: 4,
  },
  videoGalleryClient: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  videoGalleryDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  videoGallerySize: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  pendingVideosList: {
    gap: 12,
  },
  pendingVideoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  pendingVideoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingVideoInfo: {
    flex: 1,
    gap: 2,
  },
  pendingVideoClient: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  pendingVideoDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  pendingVideoExpiry: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#D97706',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Estimate tab styles
  estimateTabContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  originalEstimateSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  originalEstimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  originalEstimateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  originalEstimateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  estimateStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
  },
  estimateStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  estimateDetailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  estimateSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  estimateLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  estimateValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  estimateDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  estimateTotalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  estimateTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  viewFullEstimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  viewFullEstimateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  newEstimateSection: {
    padding: 20,
  },
  newEstimateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  newEstimateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  newEstimateDividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  newEstimateTitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  expensesTabContent: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  expensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  expensesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  fullExpensesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  fullExpensesButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  expensesInfo: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  expensesInfoText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  openExpensesButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  openExpensesButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  recentExpensesList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
  },
  recentExpensesTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  recentExpensesScroll: {
    flex: 1,
  },
  recentExpenseCard: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  recentExpenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentExpenseInfo: {
    flex: 1,
  },
  recentExpenseType: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  recentExpenseSubcategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recentExpenseAmount: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  recentExpenseStore: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  recentExpenseDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expensesEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  expensesEmptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 16,
  },
  expensesEmptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  viewAllExpensesButton: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllExpensesButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  // Photo Viewer Modal Styles
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photoViewerContainer: {
    width: '95%',
    maxWidth: 900,
    maxHeight: '90%',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
  },
  photoViewerHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  photoViewerDate: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  photoViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: 500,
    backgroundColor: '#000000',
  },
  photoViewerNotes: {
    padding: 16,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  photoViewerNotesText: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  costBreakdownSection: {
    marginTop: 16,
  },
  costBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  costBreakdownCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  costValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  costLabelBold: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
  },
  costValueBold: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
  },
  costDivider: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: 8,
  },
});
