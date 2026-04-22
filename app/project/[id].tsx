import { ActivityIndicator, Alert, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import DailyTasksButton from '@/components/DailyTasksButton';
import { Report, ProjectReportData, DailyLog, ChangeOrder, Payment, ScheduledTask } from '@/types';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Clock, DollarSign, Camera, Ruler, Plus, Archive, TrendingUp, Calendar, Users, AlertCircle, UserCheck, CreditCard, Wallet, Coffee, File, FolderOpen, Upload, Folder, Download, Trash2, X, Search, Image as ImageIcon, PlayCircle, PauseCircle, Monitor } from 'lucide-react-native';
import ClockInOutComponent from '@/components/ClockInOutComponent';
import CustomDatePicker from '@/components/DailyTasks/CustomDatePicker';
import { generateUUID } from '@/utils/uuid';
import RequestEstimateComponent from '@/components/RequestEstimate';
import GlobalAIChatSimple from '@/components/GlobalAIChatSimple';
import { Image } from 'expo-image';
import UploaderBadge from '@/components/UploaderBadge';
import * as ImagePicker from 'expo-image-picker';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ProjectFile, FileCategory } from '@/types';
import { photoCategories } from '@/mocks/data';
import { compressImage, uriToBase64 } from '@/lib/upload-utils';
import * as FileSystem from 'expo-file-system/legacy';

type TabType = 'overview' | 'schedule' | 'estimate' | 'change-orders' | 'clock' | 'expenses' | 'photos' | 'videos' | 'files' | 'reports';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, archiveProject, deleteProject, user, company, clockEntries, expenses, estimates, projectFiles, addProjectFile, deleteProjectFile, photos, addPhoto, deletePhoto, reports, addReport, refreshReports, dailyLogs = [], scheduledTasks, loadScheduledTasks, updateProject, addNotification, refreshClockEntries } = useApp();

  const [changeOrdersData, setChangeOrdersData] = useState<ChangeOrder[]>([]);
  const [paymentsData, setPaymentsData] = useState<Payment[]>([]);
  const [userRatesMap, setUserRatesMap] = useState<Map<string, number>>(new Map());
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());
  const [inspectionVideosData, setInspectionVideosData] = useState<any[]>([]);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const fetchPayments = useCallback(() => {
    if (!id) return;
    supabase.from('payments').select('*').eq('project_id', id as string).order('date', { ascending: false })
      .then(({ data }) => setPaymentsData((data || []).map((r: any) => ({
        id: r.id, projectId: r.project_id, amount: Number(r.amount), date: r.date,
        clientId: r.client_id ?? undefined, clientName: r.client_name,
        method: r.method, notes: r.notes ?? undefined, receiptUrl: r.receipt_url ?? undefined,
        createdAt: r.created_at,
      }))));
  }, [id]);

  // Re-fetch user rates every time this screen comes into focus so rate changes
  // approved by the admin are reflected in the Labor Costs card immediately.
  const fetchUserRates = useCallback(() => {
    supabase.from('users').select('id, name, hourly_rate').then(({ data }) => {
      const rates = new Map<string, number>();
      const names = new Map<string, string>();
      (data || []).forEach((u: any) => {
        if (u.hourly_rate) rates.set(u.id, Number(u.hourly_rate));
        if (u.name) names.set(u.id, u.name);
      });
      setUserRatesMap(rates);
      setUserNamesMap(names);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    fetchUserRates();
    refreshClockEntries();
  }, [fetchUserRates, refreshClockEntries]));

  // Tick every 30s so active-entry elapsed hours/costs update in real-time.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase.from('change_orders').select('*').eq('project_id', id as string).order('created_at', { ascending: false })
      .then(({ data }) => setChangeOrdersData((data || []).map((r: any) => ({
        id: r.id, projectId: r.project_id, description: r.description, amount: r.amount,
        date: r.date, status: r.status, approvedBy: r.approved_by, approvedDate: r.approved_date,
        notes: r.notes, createdAt: r.created_at, history: [],
      }))));
    fetchPayments();
  }, [id, fetchPayments]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('project_files')
      .select('*')
      .eq('project_id', id as string)
      .order('upload_date', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setDbProjectFiles(data.map((r: any) => ({
            id: r.id,
            projectId: r.project_id,
            name: r.name,
            category: r.category as FileCategory,
            fileType: r.file_type,
            fileSize: r.file_size,
            uri: r.uri,
            uploadDate: r.upload_date,
            notes: r.notes ?? undefined,
          })));
        }
      });
  }, [id]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from('inspection_videos').select('*').eq('company_id', company.id).order('created_at', { ascending: false })
      .then(({ data }) => setInspectionVideosData((data || []).map((item: any) => ({
        id: item.id, token: item.token, clientId: item.client_id, companyId: item.company_id,
        projectId: item.project_id, clientName: item.client_name, clientEmail: item.client_email,
        status: item.status, videoUrl: item.video_url, videoDuration: item.video_duration,
        videoSize: item.video_size, notes: item.notes, createdAt: item.created_at,
        completedAt: item.completed_at, expiresAt: item.expires_at,
      }))));
  }, [company?.id]);
  const [dbProjectFiles, setDbProjectFiles] = useState<ProjectFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
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
  const [showWebCameraBanner, setShowWebCameraBanner] = useState<boolean>(false);
  const isUploadingPhotoRef = useRef(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; category: string; notes?: string; date: string } | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [contractAmountInput, setContractAmountInput] = useState('');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<Payment['method']>('cash');
  const [paymentClientNameInput, setPaymentClientNameInput] = useState('');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Responsive size tokens — recomputed when screen rotates or window changes.
  // small  = iPhone 12 mini (360), SE (375)
  // medium = iPhone 12/13/14 (390)
  // large  = iPhone 14 Pro / Plus (393+)
  const rs = useMemo(() => {
    const w = dimensions.width;
    const small  = w <= 375;
    const medium = w < 393;
    return {
      contentPadding:     small ? 12  : medium ? 16 : 20,
      cardPadding:        small ? 12  : medium ? 14 : 20,
      bannerPaddingH:     small ? 10  : medium ? 12 : 16,
      bannerGap:          small ? 8   : medium ? 10 : 16,
      bannerIconSize:     small ? 30  : 36,
      metricGap:          small ? 4   : medium ? 5  : 6,
      metricPadding:      small ? 5   : medium ? 6  : 8,
      metricValueSize:    small ? 11  : medium ? 12 : 14,
      imageHeight:        small ? 160 : medium ? 180 : 200,
      balanceValueSize:   small ? 13  : medium ? 14 : 16,
      paymentValueSize:    small ? 16  : medium ? 18 : 22,
      profitBoxValueSize:  small ? 14  : medium ? 17 : 20,
      insightValueSize:    small ? 13  : medium ? 14 : 16,
      insightCardPadding:  small ? 8   : medium ? 10 : 12,
    };
  }, [dimensions.width]);

  const project = projects.find(p => p.id === id);
  
  const changeOrders = changeOrdersData;
  const payments = paymentsData;

  useEffect(() => {
    if (activeTab === 'reports' && company?.id) {
      refreshReports();
    }
    if (activeTab === 'schedule' && id) {
      loadScheduledTasks(id as string);
    }
  }, [activeTab, company?.id, id, refreshReports, loadScheduledTasks]);

  // Removed - budgetRemaining and budgetUsedPercentage are now calculated after adjustedProjectTotal and totalJobCost
  
  const daysElapsed = useMemo(() => {
    if (!project?.startDate) return 0;
    const startMs = new Date(project.startDate).getTime();
    if (isNaN(startMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)));
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


  // Get estimate linked to this project via project.estimateId
  const projectEstimates = useMemo(() => {
    if (!project?.estimateId) return [];
    const linkedEstimate = estimates.find(e => e.id === project.estimateId);
    return linkedEstimate ? [linkedEstimate] : [];
  }, [estimates, project?.estimateId]);

  const currentProjectFiles = useMemo(() => {
    // Merge DB-persisted files with local AsyncStorage files.
    // DB files take precedence; local-only entries (e.g. auto-synced photo stubs) fill in the gaps.
    const dbIds = new Set(dbProjectFiles.map(f => f.id));
    const localOnly = projectFiles.filter(f => f.projectId === id && !dbIds.has(f.id));
    let merged = [...dbProjectFiles, ...localOnly];

    if (categoryFilter !== 'all') {
      merged = merged.filter(f => f.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      merged = merged.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.notes?.toLowerCase().includes(query)
      );
    }

    return merged;
  }, [projectFiles, dbProjectFiles, id, categoryFilter, searchQuery]);

  const projectPhotos = useMemo(() => {
    return photos.filter(p => p.projectId === id);
  }, [photos, id]);


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
    const allInspectionVideos = inspectionVideosData;
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
  }, [currentProjectFiles, inspectionVideosData, project]);

  const handlePickDocument = async () => {
    if (!company?.id) {
      Alert.alert('Error', 'Company information not available. Please try again.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // Close modal immediately so the user sees upload progress feedback
        setUploadModalVisible(false);
        setIsUploadingFile(true);

        try {
          const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

          // Read the file as base64 (expo-file-system, works on iOS & Android)
          const base64 = await uriToBase64(asset.uri);

          const uploadResponse = await fetch(`${API_BASE}/api/upload-project-file-direct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64,
              fileName: asset.name,
              fileType: asset.mimeType || 'application/octet-stream',
              fileSize: asset.size || 0,
              companyId: company.id,
              projectId: id as string,
              category: selectedCategory,
              notes: fileNotes,
            }),
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResponse.ok || !uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed');
          }

          // Add the DB-persisted file (S3 URL) to local state so it shows immediately
          addProjectFile(uploadResult.file);
          // Also add to dbProjectFiles so it survives the next DB refresh
          setDbProjectFiles(prev => [uploadResult.file, ...prev]);

          setFileNotes('');
          Alert.alert('Success', 'File uploaded successfully!');
        } catch (uploadError: any) {
          console.error('[Files] Upload error:', uploadError);
          Alert.alert('Error', uploadError.message || 'Failed to upload file. Please try again.');
        } finally {
          setIsUploadingFile(false);
        }
      }
    } catch (error) {
      console.error('[Files] Error picking document:', error);
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

  // Planned profit: what the owner expects to earn before any work begins.
  // Contract Amount (client pays) − Project Budget (we plan to spend).
  const plannedProfit = useMemo(() => {
    if (!project) return 0;
    return (project.contractAmount ?? 0) - project.budget;
  }, [project]);

  // Actual profit: live margin as expenses come in.
  // Contract Amount − actual expenses to date.
  const actualProfit = useMemo(() => {
    if (!project) return 0;
    return (project.contractAmount ?? 0) - totalJobCost;
  }, [project, totalJobCost]);
  
  const totalPaymentsReceived = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const projectClockEntries = useMemo(() => {
    return clockEntries.filter(entry => entry.projectId === id);
  }, [clockEntries, id]);

  const totalLaborCost = useMemo(() => {
    return projectClockEntries.reduce((sum, entry) => {
      if (!entry.clockIn) return sum;
      // Only count entries with a snapshotted rate. Legacy entries (hourlyRate = null)
      // are excluded so a rate change never retroactively alters historical cost.
      if (entry.hourlyRate == null) return sum;
      const rate = entry.hourlyRate;
      if (!rate) return sum;
      const clockInMs = new Date(entry.clockIn).getTime();
      const clockOutMs = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
      let totalMs = clockOutMs - clockInMs;
      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          const ls = new Date(lunch.startTime).getTime();
          const le = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutMs;
          if (!isNaN(ls) && !isNaN(le)) totalMs -= (le - ls);
        });
      }
      return sum + Math.max(0, (totalMs / 3_600_000) * rate);
    }, 0);
  }, [projectClockEntries, userRatesMap, nowMs]);

  const totalSubcontractorCost = useMemo(() => {
    return expensesByType['Subcontractor'] || 0;
  }, [expensesByType]);

  const totalMaterialCost = useMemo(() => {
    return expensesByType['Material'] || 0;
  }, [expensesByType]);

  const totalLaborHours = useMemo(() => {
    return projectClockEntries.reduce((sum, entry) => {
      if (!entry.clockOut || !entry.clockIn) return sum;
      const clockInMs = new Date(entry.clockIn).getTime();
      const clockOutMs = new Date(entry.clockOut).getTime();
      if (isNaN(clockInMs) || isNaN(clockOutMs)) return sum;
      let totalMs = clockOutMs - clockInMs;
      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          const lunchStart = new Date(lunch.startTime).getTime();
          const lunchEnd = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutMs;
          if (!isNaN(lunchStart) && !isNaN(lunchEnd)) {
            totalMs -= (lunchEnd - lunchStart);
          }
        });
      }
      return sum + Math.max(0, totalMs / (1000 * 60 * 60));
    }, 0);
  }, [projectClockEntries]);

  const laborHoursCost = useMemo(() => {
    if (!totalLaborHours || !isFinite(totalLaborHours)) return 0;
    if (!totalLaborCost || !isFinite(totalLaborCost)) return 0;
    return totalLaborCost / totalLaborHours;
  }, [totalLaborCost, totalLaborHours]);

  // Per-employee labor breakdown — hours worked, rate, cost, and active status.
  // Uses the rate snapshotted at clock-in time (entry.hourlyRate) so historical
  // entries remain accurate after rate changes. Falls back to current rate for
  // legacy entries that predate the snapshot column.
  const laborBreakdown = useMemo(() => {
    // Per-employee: group entries, track distinct rates (for rate-change detection),
    // and detect legacy entries (hourlyRate = null) that fall back to current rate.
    const map = new Map<string, {
      name: string;
      hours: number;
      cost: number;
      isActive: boolean;
      sessionCount: number;
      rateSet: Set<number>;       // distinct snapshotted rates seen
      hasLegacyEntries: boolean;  // true if any entry lacks a rate snapshot
      // For "Varies" rows: per-rate-segment breakdown for tooltip/sub-rows
      rateSegments: Map<number, { hours: number; cost: number }>;
    }>();
    const now = nowMs;
    projectClockEntries.forEach(entry => {
      if (!entry.clockIn) return;
      const clockInMs = new Date(entry.clockIn).getTime();
      const clockOutMs = entry.clockOut ? new Date(entry.clockOut).getTime() : now;
      let ms = clockOutMs - clockInMs;
      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          const ls = new Date(lunch.startTime).getTime();
          const le = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutMs;
          if (!isNaN(ls) && !isNaN(le)) ms -= (le - ls);
        });
      }
      const hours = Math.max(0, ms / 3_600_000);
      const isLegacy = entry.hourlyRate == null;
      // Skip legacy entries entirely — no rate snapshot means no cost contribution.
      // This prevents a rate change from retroactively repricing historical hours.
      if (isLegacy) return;
      const rate = entry.hourlyRate;
      const cost = rate ? hours * rate : 0;
      const name = userNamesMap.get(entry.employeeId)
        || entry.employeeName
        || `Employee ${entry.employeeId.slice(0, 4)}`;
      const isActive = !entry.clockOut;
      const existing = map.get(entry.employeeId);
      if (existing) {
        existing.hours += hours;
        existing.cost += cost;
        existing.isActive = existing.isActive || isActive;
        existing.sessionCount += 1;
        if (isLegacy) existing.hasLegacyEntries = true;
        if (rate) {
          existing.rateSet.add(rate);
          const seg = existing.rateSegments.get(rate);
          if (seg) { seg.hours += hours; seg.cost += cost; }
          else existing.rateSegments.set(rate, { hours, cost });
        }
      } else {
        const rateSet = new Set<number>();
        const rateSegments = new Map<number, { hours: number; cost: number }>();
        if (rate) {
          rateSet.add(rate);
          rateSegments.set(rate, { hours, cost });
        }
        map.set(entry.employeeId, {
          name, hours, cost, isActive, sessionCount: 1,
          rateSet, hasLegacyEntries: isLegacy, rateSegments,
        });
      }
    });
    return Array.from(map.entries())
      .map(([employeeId, { rateSet, rateSegments, ...d }]) => ({
        employeeId,
        ...d,
        // rate: single value if uniform; -1 signals "varies" (rate changed mid-project); null = no rate
        rate: rateSet.size === 1 ? [...rateSet][0] : rateSet.size > 1 ? -1 : null,
        rateCount: rateSet.size,
        // Sub-rows sorted by rate desc — shown when rate === -1 (Varies)
        segments: rateSet.size > 1
          ? [...rateSegments.entries()]
              .map(([r, s]) => ({ rate: r, hours: s.hours, cost: s.cost }))
              .sort((a, b) => b.rate - a.rate)
          : [],
      }))
      .sort((a, b) => b.cost - a.cost || b.hours - a.hours);
  }, [projectClockEntries, userRatesMap, userNamesMap, nowMs]);

  // Payment baseline: what the client agreed to pay (contract amount).
  // Falls back to budget if no contract has been set yet.
  const paymentBaseline = useMemo(() => {
    if (!project) return 0;
    return (project.contractAmount ?? 0) > 0 ? (project.contractAmount ?? 0) : project.budget;
  }, [project]);

  const pendingBalance = useMemo(() => {
    return paymentBaseline - totalPaymentsReceived;
  }, [paymentBaseline, totalPaymentsReceived]);

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
    if (!project || project.progress === 0) return 0;
    return Math.ceil((totalLaborHours / project.progress) * (100 - project.progress));
  }, [project, totalLaborHours]);
  
  const activeClockEntries = useMemo(() => {
    if (!project) return [];
    return clockEntries.filter(entry => entry.projectId === project.id && !entry.clockOut);
  }, [project, clockEntries]);
  
  const getEmployeeName = (employeeId: string, employeeName?: string) => {
    if (employeeName) return employeeName;
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
          <View style={[styles.overviewContent, { padding: rs.contentPadding }]}>
            {/* Budget Banner — admin/super-admin: tappable edit; everyone else: view-only */}
            {(() => {
              const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
              const hasContract = (project.contractAmount ?? 0) > 0;
              const bannerStyle = {
                flexDirection: 'column' as const,
                backgroundColor: hasContract ? '#F0FDF4' : '#FFFBEB',
                borderRadius: 14,
                paddingHorizontal: rs.bannerPaddingH,
                paddingVertical: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: hasContract ? '#BBFCDA' : '#FCD34D',
              };
              const innerContent = (
                <>
                  {/* ── Header row: icon + title + Edit ── */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                    <View style={{
                      width: 26, height: 26, borderRadius: 13,
                      backgroundColor: hasContract ? '#D1FAE5' : '#FEF3C7',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <DollarSign size={13} color={hasContract ? '#10B981' : '#F59E0B'} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Budget Summary
                    </Text>
                    {isAdmin && (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981', letterSpacing: 0.3 }}>
                        Edit
                      </Text>
                    )}
                  </View>

                  {/* ── Values: full-width 3-col grid ── */}
                  <View style={{ flexDirection: 'row', gap: 1 }}>
                    {/* Contract Amount */}
                    <View style={{ flex: 1, paddingRight: 12, borderRightWidth: hasContract ? 1 : 0, borderRightColor: hasContract ? '#BBFCDA' : 'transparent' }}>
                      <Text style={{ fontSize: 9, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Contract
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: hasContract ? '#1E40AF' : '#D97706', letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {hasContract ? `$${(project.contractAmount!).toLocaleString()}` : 'Not set'}
                      </Text>
                    </View>

                    {/* Project Budget */}
                    <View style={{ flex: 1, paddingHorizontal: 12, borderRightWidth: hasContract ? 1 : 0, borderRightColor: hasContract ? '#BBFCDA' : 'transparent' }}>
                      <Text style={{ fontSize: 9, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Budget
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#064E3B', letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        ${project.budget.toLocaleString()}
                      </Text>
                    </View>

                    {/* Planned Profit — only if contractAmount is set */}
                    {hasContract && (
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <Text style={{ fontSize: 9, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                          Profit
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: plannedProfit >= 0 ? '#10B981' : '#EF4444', letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                          {plannedProfit >= 0 ? '+' : '-'}${Math.abs(plannedProfit).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 9, color: plannedProfit >= 0 ? '#059669' : '#EF4444', fontWeight: '600', marginTop: 2 }}>
                          {((plannedProfit / (project.contractAmount ?? 1)) * 100).toFixed(1)}% margin
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              );
              if (isAdmin) {
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setBudgetInput(project.budget.toString());
                      setContractAmountInput(project.contractAmount?.toString() ?? '');
                      setShowBudgetModal(true);
                    }}
                    style={bannerStyle}
                  >
                    {innerContent}
                  </TouchableOpacity>
                );
              }
              return <View style={bannerStyle}>{innerContent}</View>;
            })()}

            <View style={styles.coverPhotoContainer}>
              <Image
                source={{ uri: project.image }}
                style={[styles.projectImage, { height: rs.imageHeight }]}
                contentFit="cover"
              />
              {project.status !== 'completed' && project.status !== 'archived' && (
                <TouchableOpacity
                  style={styles.changeCoverPhotoButton}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      aspect: [16, 9],
                      quality: 0.8,
                    });
                    if (result.canceled || !result.assets[0]) return;

                    const uri = result.assets[0].uri;
                    try {
                      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                      // Get S3 presigned upload URL
                      const urlRes = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          fileName: `project-cover-${project.id}-${Date.now()}.jpg`,
                          fileType: 'image/jpeg',
                          companyId: company?.id,
                        }),
                      });
                      const urlData = await urlRes.json();
                      if (!urlData.uploadUrl) throw new Error('Failed to get upload URL');

                      // Compress and upload
                      const compressed = await compressImage(uri, { maxWidth: 1200, quality: 0.8 });
                      const blob = await fetch(compressed.uri).then(r => r.blob());
                      await fetch(urlData.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });

                      // Save URL to project
                      updateProject(project.id, { image: urlData.fileUrl });
                      Alert.alert('Done', 'Cover photo updated!');
                    } catch (e: any) {
                      Alert.alert('Error', e.message || 'Failed to upload cover photo');
                    }
                  }}
                >
                  <Camera size={18} color="#FFFFFF" />
                  <Text style={styles.changeCoverPhotoText}>Change Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {user?.role !== 'field-employee' && (
              <View style={[styles.balancesCard, { padding: rs.cardPadding }]}>
                <View style={styles.cardHeader}>
                  <Wallet size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Financial Overview</Text>
                </View>

                {/* Row 1 — Contract Amount | Project Budget | Planned Profit */}
                <View style={styles.topMetrics}>
                  <View style={[styles.topMetricLarge, { borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Contract</Text>
                    <Text style={[styles.topMetricValue, { color: (project.contractAmount ?? 0) > 0 ? '#1E40AF' : '#9CA3AF', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {(project.contractAmount ?? 0) > 0 ? `$${project.contractAmount!.toLocaleString()}` : '—'}
                    </Text>
                    <Text style={styles.topMetricSubtext}>Client agreed</Text>
                  </View>
                  <View style={[styles.topMetricMedium, { borderRightWidth: (project.contractAmount ?? 0) > 0 ? 1 : 0, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Budget</Text>
                    <Text style={[styles.topMetricValue, { color: '#064E3B', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${project.budget.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>
                      {totalChangeOrdersApproved > 0 ? `+$${totalChangeOrdersApproved.toLocaleString()} COs` : 'Planned spend'}
                    </Text>
                  </View>
                  {(project.contractAmount ?? 0) > 0 && (
                    <View style={styles.topMetricMedium}>
                      <Text style={styles.topMetricLabel}>Profit</Text>
                      <Text style={[styles.topMetricValue, { color: plannedProfit >= 0 ? '#10B981' : '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {`${plannedProfit >= 0 ? '+' : '-'}$${Math.abs(plannedProfit).toLocaleString()}`}
                      </Text>
                      <Text style={styles.topMetricSubtext}>
                        {`${((plannedProfit / (project.contractAmount ?? 1)) * 100).toFixed(1)}% margin`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Row 2 — Total Expenses | Remaining Budget | Budget Used */}
                <View style={[styles.topMetrics, { marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
                  <View style={[styles.topMetricMedium, { paddingLeft: 0, borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Expenses</Text>
                    <Text style={[styles.topMetricValue, { color: '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${totalJobCost.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>{projectExpenses.length} transactions</Text>
                  </View>
                  <View style={[styles.topMetricMedium, { borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Remaining</Text>
                    <Text style={[styles.topMetricValue, { color: budgetRemaining >= 0 ? '#10B981' : '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      ${Math.abs(budgetRemaining).toLocaleString()}
                    </Text>
                    <Text style={styles.topMetricSubtext}>
                      {budgetRemaining >= 0 ? 'Available' : 'Over Budget'}
                    </Text>
                  </View>
                  <View style={styles.topMetricMedium}>
                    <Text style={styles.topMetricLabel}>Used</Text>
                    <Text style={[styles.topMetricValue, { color: budgetUsedPercentage > 100 ? '#EF4444' : '#F59E0B', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {budgetUsedPercentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.topMetricSubtext}>of budget</Text>
                  </View>
                </View>

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
                      <Users size={15} color="#EF4444" />
                    </View>
                    <Text style={styles.balanceLabel}>Subcontractors</Text>
                    <Text style={[styles.balanceValue, { color: '#EF4444' }]}>${totalSubcontractorCost.toLocaleString()}</Text>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#DBEAFE' }]}>
                      <UserCheck size={15} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.balanceLabel, { flex: 0 }]}>Labor</Text>
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>See breakdown ↓</Text>
                    </View>
                    <Text style={[styles.balanceValue, { color: '#2563EB' }]}>${totalLaborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#FEF3C7' }]}>
                      <FileText size={15} color="#F59E0B" />
                    </View>
                    <Text style={styles.balanceLabel}>Materials</Text>
                    <Text style={[styles.balanceValue, { color: '#F59E0B' }]}>${totalMaterialCost.toLocaleString()}</Text>
                  </View>

                  <View style={[styles.balanceItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#E9D5FF' }]}>
                      <DollarSign size={15} color="#9333EA" />
                    </View>
                    <Text style={styles.balanceLabel}>Other Costs</Text>
                    <Text style={[styles.balanceValue, { color: '#9333EA' }]}>${Math.max(0, totalJobCost - totalSubcontractorCost - totalLaborCost - totalMaterialCost).toLocaleString()}</Text>
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
                    <Text style={[styles.paymentMetricValue, { fontSize: rs.paymentValueSize }]}>${totalPaymentsReceived.toLocaleString()}</Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, { 
                        width: `${Math.min(100, paymentBaseline > 0 ? (totalPaymentsReceived / paymentBaseline) * 100 : 0)}%`,
                        backgroundColor: '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {(paymentBaseline > 0 ? (totalPaymentsReceived / paymentBaseline) * 100 : 0).toFixed(1)}% of contract • {payments.length} payment(s)
                    </Text>
                  </View>

                  <View style={styles.paymentMetric}>
                    <View style={styles.paymentMetricHeader}>
                      <AlertCircle size={18} color={pendingBalance > 0 ? '#F59E0B' : '#10B981'} />
                      <Text style={styles.paymentMetricTitle}>Pending Balance</Text>
                    </View>
                    <Text style={[styles.paymentMetricValue, { color: pendingBalance > 0 ? '#F59E0B' : '#10B981', fontSize: rs.paymentValueSize }]}>
                      ${pendingBalance.toLocaleString()}
                    </Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, {
                        width: `${Math.min(100, paymentBaseline > 0 ? (pendingBalance / paymentBaseline) * 100 : 0)}%`,
                        backgroundColor: pendingBalance > 0 ? '#F59E0B' : '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {(paymentBaseline > 0 ? (pendingBalance / paymentBaseline) * 100 : 0).toFixed(1)}% remaining
                    </Text>
                  </View>
                </View>

                {/* Record Payment button — admin only */}
                {(user?.role === 'admin' || user?.role === 'super-admin') && (
                  <TouchableOpacity
                    onPress={() => {
                      setPaymentAmountInput('');
                      setPaymentDateInput(new Date().toISOString().split('T')[0]);
                      setPaymentMethodInput('cash');
                      setPaymentClientNameInput('');
                      setPaymentNotesInput('');
                      setShowPaymentDatePicker(false);
                      setShowAddPaymentModal(true);
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, paddingVertical: 13, borderRadius: 12, marginBottom: 14,
                      backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
                    }}
                  >
                    <Plus size={16} color="#10B981" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#10B981' }}>Record Payment</Text>
                  </TouchableOpacity>
                )}

                {/* Payment history list */}
                {payments.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Payment History
                    </Text>
                    {payments.map((payment) => (
                      <View key={payment.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                          <CreditCard size={14} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>{payment.clientName}</Text>
                          <Text style={{ fontSize: 11, color: '#6B7280' }}>
                            {payment.method.replace('-', ' ')} · {payment.date ? new Date(String(payment.date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </Text>
                          {!!payment.notes && (
                            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }} numberOfLines={1}>{payment.notes}</Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>+${payment.amount.toLocaleString()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.profitSection}>
                  <View style={styles.profitHeader}>
                    <TrendingUp size={20} color="#6366F1" />
                    <Text style={styles.profitTitle}>Profit Analysis</Text>
                  </View>

                  {(project.contractAmount ?? 0) > 0 ? (
                    <>
                      {/* Planned vs Actual columns */}
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                        {/* Planned Profit */}
                        <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBFCDA' }}>
                          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                            Planned
                          </Text>
                          <Text style={{ fontSize: rs.profitBoxValueSize, fontWeight: '700', color: plannedProfit >= 0 ? '#10B981' : '#EF4444', marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {plannedProfit >= 0 ? '+' : '-'}${Math.abs(plannedProfit).toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#6B7280' }}>Contract − Budget</Text>
                          <Text style={{ fontSize: 10, color: '#059669', fontWeight: '600', marginTop: 2 }}>
                            {((plannedProfit / project.contractAmount!) * 100).toFixed(1)}% margin
                          </Text>
                        </View>

                        {/* Actual Profit */}
                        <View style={{ flex: 1, backgroundColor: actualProfit >= 0 ? '#EFF6FF' : '#FEF2F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: actualProfit >= 0 ? '#BFDBFE' : '#FECACA' }}>
                          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                            Actual (Live)
                          </Text>
                          <Text style={{ fontSize: rs.profitBoxValueSize, fontWeight: '700', color: actualProfit >= 0 ? '#1E40AF' : '#EF4444', marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {actualProfit >= 0 ? '+' : '-'}${Math.abs(actualProfit).toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#6B7280' }}>Contract − Expenses</Text>
                          <Text style={{ fontSize: 10, color: actualProfit >= 0 ? '#1E40AF' : '#EF4444', fontWeight: '600', marginTop: 2 }}>
                            {((actualProfit / project.contractAmount!) * 100).toFixed(1)}% margin
                          </Text>
                        </View>
                      </View>

                      {/* Margin erosion bar — only meaningful if planned profit > 0 */}
                      {plannedProfit > 0 && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>Profit intact</Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: actualProfit < plannedProfit * 0.25 ? '#EF4444' : '#6B7280' }}>
                              ${totalJobCost.toLocaleString()} spent so far
                            </Text>
                          </View>
                          <View style={styles.profitBar}>
                            <View style={[styles.profitFill, {
                              width: `${Math.min(100, Math.max(0, (actualProfit / plannedProfit) * 100))}%`,
                              backgroundColor: actualProfit >= plannedProfit * 0.5 ? '#10B981' : actualProfit > 0 ? '#F59E0B' : '#EF4444',
                            }]} />
                          </View>
                          <Text style={styles.profitSubtext}>
                            {actualProfit >= 0
                              ? `${((actualProfit / plannedProfit) * 100).toFixed(0)}% of planned profit remaining`
                              : `Expenses exceeded contract — $${Math.abs(actualProfit).toLocaleString()} net loss`}
                          </Text>
                        </>
                      )}
                    </>
                  ) : (
                    /* Fallback: no contract amount set */
                    <>
                      <Text style={[styles.profitAmount, { color: profitMargin >= 0 ? '#10B981' : '#EF4444' }]}>
                        ${Math.abs(profitMargin).toLocaleString()}
                      </Text>
                      <View style={styles.profitBar}>
                        <View style={[styles.profitFill, {
                          width: `${Math.min(100, adjustedProjectTotal > 0 ? Math.abs(profitMargin) / adjustedProjectTotal * 100 : 0)}%`,
                          backgroundColor: profitMargin >= 0 ? '#10B981' : '#EF4444'
                        }]} />
                      </View>
                      <Text style={styles.profitSubtext}>
                        {profitMargin >= 0 ? 'Budget remaining' : 'Over budget'}: {adjustedProjectTotal > 0 ? ((profitMargin / adjustedProjectTotal) * 100).toFixed(1) : '0'}%{'\n'}
                        Set a contract amount to see full profit analysis
                      </Text>
                    </>
                  )}
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionSubtitle}>Labor & Timing Insights</Text>
                <View style={styles.insightsGrid}>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Clock size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{totalLaborHours.toFixed(1)}h</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Total Labor Hours</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <DollarSign size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${laborHoursCost.toFixed(2)}/h</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Labor Cost Rate</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Users size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{activeClockEntries.length}</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Active Workers</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Calendar size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{daysElapsed}</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Days Elapsed</Text>
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
                            {getEmployeeName(entry.employeeId, entry.employeeName).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.clockedInItemInfo}>
                          <Text style={styles.clockedInEmployeeName} numberOfLines={1}>
                            {getEmployeeName(entry.employeeId, entry.employeeName)}
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

            {/* ── Labor Costs Breakdown ── */}
            <View style={styles.laborCard}>
              <View style={styles.laborCardHeader}>
                <UserCheck size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.laborCardTitle}>Labor Costs</Text>
                  <Text style={styles.laborCardSubtitle}>All-time project hours · wages locked at clock-in rate</Text>
                </View>
                <View style={styles.laborTotalBadge}>
                  <Text style={styles.laborTotalBadgeText}>
                    ${totalLaborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
                  </Text>
                </View>
              </View>

              {laborBreakdown.length === 0 ? (
                <View style={styles.laborEmptyState}>
                  <Clock size={32} color="#D1D5DB" />
                  <Text style={styles.laborEmptyText}>No clock entries yet</Text>
                  <Text style={styles.laborEmptySubtext}>Labor costs appear once employees clock in to this project</Text>
                </View>
              ) : (
                <>
                  {/* Column headers */}
                  <View style={styles.laborTableHeader}>
                    <Text style={[styles.laborTableHeaderText, { flex: 1 }]}>Employee</Text>
                    <Text style={[styles.laborTableHeaderText, styles.laborColHours]}>Hours</Text>
                    <Text style={[styles.laborTableHeaderText, styles.laborColRate]}>Rate</Text>
                    <Text style={[styles.laborTableHeaderText, styles.laborColCost]}>Cost</Text>
                  </View>

                  {laborBreakdown.map((row) => (
                    <View key={row.employeeId}>
                      <View style={[styles.laborRow, row.isActive && styles.laborRowActive]}>
                        {/* Avatar */}
                        <View style={[styles.laborAvatar, row.isActive && styles.laborAvatarActive]}>
                          <Text style={styles.laborAvatarText}>
                            {row.name.charAt(0).toUpperCase()}
                          </Text>
                          {row.isActive && <View style={styles.laborActiveDot} />}
                        </View>

                        {/* Name + sessions */}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.laborEmployeeName} numberOfLines={1}>{row.name}</Text>
                          <Text style={styles.laborSessionCount}>
                            {row.sessionCount} session{row.sessionCount !== 1 ? 's' : ''}
                            {row.isActive ? ' · ' : ''}
                            {row.isActive && <Text style={styles.laborLiveLabel}>● Live</Text>}
                          </Text>
                        </View>

                        {/* Hours */}
                        <Text style={[styles.laborColHours, styles.laborCellValue]}>
                          {row.hours.toFixed(1)}h
                        </Text>

                        {/* Rate — "Varies" when rate changed mid-project */}
                        <Text style={[styles.laborColRate, styles.laborCellValue, (!row.rate || row.rate < 0) && styles.laborCellMuted]}>
                          {row.rate === -1 ? 'Varies' : row.rate ? `$${row.rate.toFixed(0)}/h` : '—'}
                          {row.hasLegacyEntries && row.rate !== -1 ? '*' : ''}
                        </Text>

                        {/* Cost */}
                        <Text style={[styles.laborColCost, styles.laborCellValue, row.cost > 0 ? styles.laborCostValue : styles.laborCellMuted]}>
                          {row.cost > 0 ? `$${row.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'No rate'}
                          {row.hasLegacyEntries ? '*' : ''}
                        </Text>
                      </View>

                      {/* Rate-segment sub-rows — only shown when rate changed mid-project */}
                      {row.rate === -1 && row.segments.map((seg) => (
                        <View key={seg.rate} style={styles.laborSegmentRow}>
                          <Text style={styles.laborSegmentLabel}>
                            ↳ ${seg.rate.toFixed(0)}/h · {seg.hours.toFixed(1)}h
                          </Text>
                          <Text style={styles.laborSegmentCost}>
                            ${seg.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}

                  {/* Totals row */}
                  <View style={styles.laborTotalsRow}>
                    <Text style={[{ flex: 1 }, styles.laborTotalLabel]}>Total</Text>
                    <Text style={[styles.laborColHours, styles.laborTotalLabel]}>
                      {totalLaborHours.toFixed(1)}h
                    </Text>
                    <Text style={styles.laborColRate} />
                    <Text style={[styles.laborColCost, styles.laborTotalCost]}>
                      ${totalLaborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>

                  {laborBreakdown.some(r => !r.rate) && (
                    <Text style={styles.laborRateWarning}>
                      Employees without a rate set are excluded from the cost total. Set their rate in Employee Management.
                    </Text>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.laborReportButton}
                onPress={() => router.push(`/project/${id}/labor` as any)}
              >
                <UserCheck size={16} color="#2563EB" />
                <Text style={styles.laborReportButtonText}>View Full Labor Report</Text>
              </TouchableOpacity>
            </View>

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
                  <Text style={styles.progressDetailValue}>{totalLaborHours.toFixed(1)}h logged</Text>
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
                <Text style={styles.statValue}>{totalLaborHours.toFixed(1)}h</Text>
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
                        <Text style={styles.quickStatValue}>{totalLaborHours > 0 ? `$${(totalJobCost / totalLaborHours).toFixed(2)}` : '—'}</Text>
                        <Text style={styles.quickStatLabel}>Cost per Hour</Text>
                      </View>
                      <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{project.progress < 100 ? `$${(budgetRemaining / (100 - project.progress)).toFixed(0)}` : '—'}</Text>
                        <Text style={styles.quickStatLabel}>Budget per % Left</Text>
                      </View>
                      <View style={styles.quickStat}>
                        <Text style={styles.quickStatValue}>{daysElapsed > 0 && totalLaborHours > 0 ? (totalLaborHours / daysElapsed).toFixed(1) : '—'}</Text>
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

            {/* Project Status Actions — admin only */}
            {(user?.role === 'admin' || user?.role === 'super-admin') && (
              <View style={{ marginTop: 8, marginBottom: 16, gap: 10 }}>
                {project.status === 'active' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 12, paddingVertical: 14 }}
                    onPress={() => updateProject(project.id, { status: 'completed', endDate: new Date().toISOString() })}
                  >
                    <Archive size={18} color="#16A34A" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#16A34A' }}>Mark as Complete</Text>
                  </TouchableOpacity>
                )}
                {project.status === 'active' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, paddingVertical: 14 }}
                    onPress={() => updateProject(project.id, { status: 'on-hold' })}
                  >
                    <PauseCircle size={18} color="#F59E0B" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#F59E0B' }}>Hold Project</Text>
                  </TouchableOpacity>
                )}
                {project.status === 'active' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14 }}
                    onPress={() => updateProject(project.id, { status: 'archived' })}
                  >
                    <Archive size={18} color="#6B7280" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>Archive Project</Text>
                  </TouchableOpacity>
                )}
                {(user?.role === 'admin' || user?.role === 'super-admin') && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 14 }}
                    onPress={() => {
                      Alert.alert(
                        'Delete Project',
                        `Are you sure you want to permanently delete "${project.name}"? This cannot be undone.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteProject(project.id);
                              router.replace('/(tabs)/dashboard');
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={18} color="#DC2626" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Delete Project</Text>
                  </TouchableOpacity>
                )}
                {project.status === 'on-hold' && (
                  <>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 12, paddingVertical: 14 }}
                      onPress={() => updateProject(project.id, { status: 'active' })}
                    >
                      <PlayCircle size={18} color="#16A34A" />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#16A34A' }}>Resume Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14 }}
                      onPress={() => updateProject(project.id, { status: 'archived' })}
                    >
                      <Archive size={18} color="#6B7280" />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>Archive Project</Text>
                    </TouchableOpacity>
                  </>
                )}
                {project.status === 'completed' && (
                  <>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, paddingVertical: 14 }}
                      onPress={() => updateProject(project.id, { status: 'active', endDate: undefined })}
                    >
                      <TrendingUp size={18} color="#F59E0B" />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#F59E0B' }}>Reactivate Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14 }}
                      onPress={() => updateProject(project.id, { status: 'archived' })}
                    >
                      <Archive size={18} color="#6B7280" />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>Archive Project</Text>
                    </TouchableOpacity>
                  </>
                )}
                {project.status === 'archived' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, paddingVertical: 14 }}
                    onPress={() => updateProject(project.id, { status: 'active', endDate: undefined })}
                  >
                    <TrendingUp size={18} color="#F59E0B" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#F59E0B' }}>Unarchive Project</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );

      case 'schedule': {
        const projectScheduleTasks = scheduledTasks.filter(t => t.projectId === id);
        const todaySched = new Date(); todaySched.setHours(0, 0, 0, 0);
        const completedCount = projectScheduleTasks.filter(t => t.completed).length;

        const fmtSchedDate = (dateStr: string) => {
          if (!dateStr) return '—';
          const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
          if (isNaN(d.getTime())) return '—';
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        const getTaskStatus = (task: ScheduledTask): 'completed' | 'overdue' | 'inprogress' => {
          if (task.completed === true || (task.completed as any) === 1 || (task.completed as any) === 'true') return 'completed';
          if (!task.endDate) return 'inprogress';
          const end = task.endDate.includes('T') ? new Date(task.endDate) : new Date(task.endDate + 'T12:00:00');
          if (!isNaN(end.getTime()) && end < todaySched) return 'overdue';
          return 'inprogress';
        };

        return (
          <View style={[styles.overviewContent, { padding: rs.contentPadding }]}>
            {/* ── Financial Overview ── */}
            {user?.role !== 'field-employee' && (
              <View style={[styles.balancesCard, { padding: rs.cardPadding }]}>
                <View style={styles.cardHeader}>
                  <Wallet size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Financial Overview</Text>
                </View>
                {/* Row 1 — Contract Amount | Project Budget | Planned Profit */}
                <View style={styles.topMetrics}>
                  <View style={[styles.topMetricLarge, { borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Contract</Text>
                    <Text style={[styles.topMetricValue, { color: (project.contractAmount ?? 0) > 0 ? '#1E40AF' : '#9CA3AF', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {(project.contractAmount ?? 0) > 0 ? `$${project.contractAmount!.toLocaleString()}` : '—'}
                    </Text>
                    <Text style={styles.topMetricSubtext}>Client agreed</Text>
                  </View>
                  <View style={[styles.topMetricMedium, { borderRightWidth: (project.contractAmount ?? 0) > 0 ? 1 : 0, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Budget</Text>
                    <Text style={[styles.topMetricValue, { color: '#064E3B', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${project.budget.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>
                      {totalChangeOrdersApproved > 0 ? `+$${totalChangeOrdersApproved.toLocaleString()} COs` : 'Planned spend'}
                    </Text>
                  </View>
                  {(project.contractAmount ?? 0) > 0 && (
                    <View style={styles.topMetricMedium}>
                      <Text style={styles.topMetricLabel}>Profit</Text>
                      <Text style={[styles.topMetricValue, { color: plannedProfit >= 0 ? '#10B981' : '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {`${plannedProfit >= 0 ? '+' : '-'}$${Math.abs(plannedProfit).toLocaleString()}`}
                      </Text>
                      <Text style={styles.topMetricSubtext}>
                        {`${((plannedProfit / (project.contractAmount ?? 1)) * 100).toFixed(1)}% margin`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Row 2 — Total Expenses | Remaining Budget | Budget Used */}
                <View style={[styles.topMetrics, { marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
                  <View style={[styles.topMetricMedium, { paddingLeft: 0, borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Expenses</Text>
                    <Text style={[styles.topMetricValue, { color: '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${totalJobCost.toLocaleString()}</Text>
                    <Text style={styles.topMetricSubtext}>{projectExpenses.length} transactions</Text>
                  </View>
                  <View style={[styles.topMetricMedium, { borderRightWidth: 1, borderRightColor: '#F0F0F0' }]}>
                    <Text style={styles.topMetricLabel}>Remaining</Text>
                    <Text style={[styles.topMetricValue, { color: budgetRemaining >= 0 ? '#10B981' : '#EF4444', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      ${Math.abs(budgetRemaining).toLocaleString()}
                    </Text>
                    <Text style={styles.topMetricSubtext}>
                      {budgetRemaining >= 0 ? 'Available' : 'Over Budget'}
                    </Text>
                  </View>
                  <View style={styles.topMetricMedium}>
                    <Text style={styles.topMetricLabel}>Used</Text>
                    <Text style={[styles.topMetricValue, { color: budgetUsedPercentage > 100 ? '#EF4444' : '#F59E0B', fontSize: rs.metricValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {budgetUsedPercentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.topMetricSubtext}>of budget</Text>
                  </View>
                </View>

                {/* Cost Breakdown grid */}
                <View style={styles.divider} />
                <Text style={styles.sectionSubtitle}>Cost Breakdown</Text>
                <View style={styles.balancesGrid}>
                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#FEE2E2' }]}>
                      <Users size={15} color="#EF4444" />
                    </View>
                    <Text style={styles.balanceLabel}>Subcontractors</Text>
                    <Text style={[styles.balanceValue, { color: '#EF4444' }]}>${totalSubcontractorCost.toLocaleString()}</Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#DBEAFE' }]}>
                      <UserCheck size={15} color="#2563EB" />
                    </View>
                    <Text style={styles.balanceLabel}>Labor</Text>
                    <Text style={[styles.balanceValue, { color: '#2563EB' }]}>${totalLaborCost.toLocaleString()}</Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#FEF3C7' }]}>
                      <FileText size={15} color="#F59E0B" />
                    </View>
                    <Text style={styles.balanceLabel}>Materials</Text>
                    <Text style={[styles.balanceValue, { color: '#F59E0B' }]}>${totalMaterialCost.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.balanceItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.balanceIconContainer, { backgroundColor: '#E9D5FF' }]}>
                      <DollarSign size={15} color="#9333EA" />
                    </View>
                    <Text style={styles.balanceLabel}>Other Costs</Text>
                    <Text style={[styles.balanceValue, { color: '#9333EA' }]}>
                      ${Math.max(0, totalJobCost - totalSubcontractorCost - totalLaborCost - totalMaterialCost).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Payment & Profit */}
                <View style={styles.divider} />
                <Text style={styles.sectionSubtitle}>Payment & Profit Status</Text>
                <View style={styles.paymentGrid}>
                  <View style={styles.paymentMetric}>
                    <View style={styles.paymentMetricHeader}>
                      <CreditCard size={18} color="#10B981" />
                      <Text style={styles.paymentMetricTitle}>Payments Received</Text>
                    </View>
                    <Text style={[styles.paymentMetricValue, { fontSize: rs.paymentValueSize, letterSpacing: -0.5 }]}>${totalPaymentsReceived.toLocaleString()}</Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, {
                        width: `${Math.min(100, paymentBaseline > 0 ? (totalPaymentsReceived / paymentBaseline) * 100 : 0)}%`,
                        backgroundColor: '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {(paymentBaseline > 0 ? (totalPaymentsReceived / paymentBaseline) * 100 : 0).toFixed(1)}% of contract • {payments.length} payment(s)
                    </Text>
                  </View>
                  <View style={styles.paymentMetric}>
                    <View style={styles.paymentMetricHeader}>
                      <AlertCircle size={18} color={pendingBalance > 0 ? '#F59E0B' : '#10B981'} />
                      <Text style={styles.paymentMetricTitle}>Pending Balance</Text>
                    </View>
                    <Text style={[styles.paymentMetricValue, { color: pendingBalance > 0 ? '#F59E0B' : '#10B981', fontSize: rs.paymentValueSize, letterSpacing: -0.5 }]}>
                      ${pendingBalance.toLocaleString()}
                    </Text>
                    <View style={styles.paymentProgressBar}>
                      <View style={[styles.paymentProgressFill, {
                        width: `${Math.min(100, paymentBaseline > 0 ? (pendingBalance / paymentBaseline) * 100 : 0)}%`,
                        backgroundColor: pendingBalance > 0 ? '#F59E0B' : '#10B981'
                      }]} />
                    </View>
                    <Text style={styles.paymentMetricSubtext}>
                      {(paymentBaseline > 0 ? (pendingBalance / paymentBaseline) * 100 : 0).toFixed(1)}% remaining
                    </Text>
                  </View>
                </View>

                <View style={styles.profitSection}>
                  <View style={styles.profitHeader}>
                    <TrendingUp size={20} color="#6366F1" />
                    <Text style={styles.profitTitle}>Profit Analysis</Text>
                  </View>

                  {(project.contractAmount ?? 0) > 0 ? (
                    <>
                      {/* Planned vs Actual columns */}
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                        {/* Planned Profit */}
                        <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBFCDA' }}>
                          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                            Planned
                          </Text>
                          <Text style={{ fontSize: rs.profitBoxValueSize, fontWeight: '700', color: plannedProfit >= 0 ? '#10B981' : '#EF4444', marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {plannedProfit >= 0 ? '+' : '-'}${Math.abs(plannedProfit).toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#6B7280' }}>Contract − Budget</Text>
                          <Text style={{ fontSize: 10, color: '#059669', fontWeight: '600', marginTop: 2 }}>
                            {((plannedProfit / project.contractAmount!) * 100).toFixed(1)}% margin
                          </Text>
                        </View>

                        {/* Actual Profit */}
                        <View style={{ flex: 1, backgroundColor: actualProfit >= 0 ? '#EFF6FF' : '#FEF2F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: actualProfit >= 0 ? '#BFDBFE' : '#FECACA' }}>
                          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                            Actual (Live)
                          </Text>
                          <Text style={{ fontSize: rs.profitBoxValueSize, fontWeight: '700', color: actualProfit >= 0 ? '#1E40AF' : '#EF4444', marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {actualProfit >= 0 ? '+' : '-'}${Math.abs(actualProfit).toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#6B7280' }}>Contract − Expenses</Text>
                          <Text style={{ fontSize: 10, color: actualProfit >= 0 ? '#1E40AF' : '#EF4444', fontWeight: '600', marginTop: 2 }}>
                            {((actualProfit / project.contractAmount!) * 100).toFixed(1)}% margin
                          </Text>
                        </View>
                      </View>

                      {/* Margin erosion bar */}
                      {plannedProfit > 0 && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>Profit intact</Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: actualProfit < plannedProfit * 0.25 ? '#EF4444' : '#6B7280' }}>
                              ${totalJobCost.toLocaleString()} spent so far
                            </Text>
                          </View>
                          <View style={styles.profitBar}>
                            <View style={[styles.profitFill, {
                              width: `${Math.min(100, Math.max(0, (actualProfit / plannedProfit) * 100))}%`,
                              backgroundColor: actualProfit >= plannedProfit * 0.5 ? '#10B981' : actualProfit > 0 ? '#F59E0B' : '#EF4444',
                            }]} />
                          </View>
                          <Text style={styles.profitSubtext}>
                            {actualProfit >= 0
                              ? `${((actualProfit / plannedProfit) * 100).toFixed(0)}% of planned profit remaining`
                              : `Expenses exceeded contract — $${Math.abs(actualProfit).toLocaleString()} net loss`}
                          </Text>
                        </>
                      )}
                    </>
                  ) : (
                    /* Fallback: no contract amount set */
                    <>
                      <Text style={[styles.profitAmount, { color: profitMargin >= 0 ? '#10B981' : '#EF4444' }]}>
                        ${Math.abs(profitMargin).toLocaleString()}
                      </Text>
                      <View style={styles.profitBar}>
                        <View style={[styles.profitFill, {
                          width: `${Math.min(100, adjustedProjectTotal > 0 ? Math.abs(profitMargin) / adjustedProjectTotal * 100 : 0)}%`,
                          backgroundColor: profitMargin >= 0 ? '#10B981' : '#EF4444'
                        }]} />
                      </View>
                      <Text style={styles.profitSubtext}>
                        {profitMargin >= 0 ? 'Budget remaining' : 'Over budget'}: {adjustedProjectTotal > 0 ? ((profitMargin / adjustedProjectTotal) * 100).toFixed(1) : '0'}%{'\n'}
                        Set a contract amount to see full profit analysis
                      </Text>
                    </>
                  )}
                </View>

                {/* Labor Insights */}
                <View style={styles.divider} />
                <Text style={styles.sectionSubtitle}>Labor & Timing Insights</Text>
                <View style={styles.insightsGrid}>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Clock size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{totalLaborHours.toFixed(1)}h</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Total Labor Hours</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <DollarSign size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${laborHoursCost.toFixed(2)}/h</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Labor Cost Rate</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Users size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{activeClockEntries.length}</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Active Workers</Text>
                  </View>
                  <View style={[styles.insightCard, { padding: rs.insightCardPadding }]}>
                    <Calendar size={16} color="#6366F1" />
                    <Text style={[styles.insightValue, { fontSize: rs.insightValueSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{daysElapsed}</Text>
                    <Text style={styles.insightLabel} numberOfLines={2}>Days Elapsed</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Project Progress ── */}
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
                  <Text style={styles.progressDetailValue}>{totalLaborHours.toFixed(1)}h logged</Text>
                </View>
                <View style={styles.progressDetailItem}>
                  <Text style={styles.progressDetailLabel}>Remaining</Text>
                  <Text style={styles.progressDetailValue}>~{estimatedHoursRemaining}h</Text>
                </View>
              </View>
            </View>

            {/* ── Budget Overview ── */}
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

            {/* ── Stats Grid ── */}
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
                <Text style={styles.statValue}>{totalLaborHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.statBox}>
                <View style={[styles.statusDot, { backgroundColor: project.status === 'active' ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>{project.status}</Text>
              </View>
            </View>

            {/* ── Quick Stats ── */}
            {user?.role !== 'field-employee' && (
              <View style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <FileText size={20} color="#6366F1" />
                  <Text style={styles.cardTitle}>Quick Stats</Text>
                </View>
                <View style={styles.quickStatsGrid}>
                  <View style={styles.quickStat}>
                    <Text style={styles.quickStatValue}>{totalLaborHours > 0 ? `$${(totalJobCost / totalLaborHours).toFixed(2)}` : '—'}</Text>
                    <Text style={styles.quickStatLabel}>Cost per Hour</Text>
                  </View>
                  <View style={styles.quickStat}>
                    <Text style={styles.quickStatValue}>{project.progress < 100 ? `$${(budgetRemaining / (100 - project.progress)).toFixed(0)}` : '—'}</Text>
                    <Text style={styles.quickStatLabel}>Budget per % Left</Text>
                  </View>
                  <View style={styles.quickStat}>
                    <Text style={styles.quickStatValue}>{daysElapsed > 0 && totalLaborHours > 0 ? (totalLaborHours / daysElapsed).toFixed(1) : '—'}</Text>
                    <Text style={styles.quickStatLabel}>Avg Hours/Day</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Project Schedule Section ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Project Schedule</Text>
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  {projectScheduleTasks.length} phase{projectScheduleTasks.length !== 1 ? 's' : ''} · {completedCount} completed
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/schedule')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
              >
                <Calendar size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Full Schedule</Text>
              </TouchableOpacity>
            </View>

            {projectScheduleTasks.length === 0 ? (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Calendar size={44} color="#CBD5E1" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#475569', marginTop: 14 }}>No Schedule Yet</Text>
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 4, textAlign: 'center' }}>
                  Open the full schedule to add phases and tasks for this project.
                </Text>
              </View>
            ) : (
              <>
                {projectScheduleTasks.map(task => {
                  const status = getTaskStatus(task);
                  return (
                    <View key={task.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: task.color }} />
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 }}>{task.category}</Text>
                        </View>
                        {status === 'overdue' && (
                          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>Overdue</Text>
                          </View>
                        )}
                        {status === 'completed' && (
                          <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#16A34A' }}>Completed</Text>
                          </View>
                        )}
                        {status === 'inprogress' && (
                          <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>In Progress</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 14 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#4F46E5' }}>
                          {task.workType === 'subcontractor' ? 'Subcontractor' : 'In-House'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Start</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>{fmtSchedDate(task.startDate)}</Text>
                        </View>
                        <Text style={{ fontSize: 18, color: '#CBD5E1', marginHorizontal: 8 }}>→</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>End</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>{fmtSchedDate(task.endDate)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Duration</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>{task.duration}d</Text>
                        </View>
                      </View>
                      {!!task.notes && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Notes</Text>
                          <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19 }}>{task.notes}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Footer CTA */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', marginTop: 6, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 14 }}>
                Open full schedule for editing, adding new phases, and detailed timeline view
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/schedule')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#2563EB' }}
              >
                <Calendar size={16} color="#2563EB" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>Open Full Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

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

            {/* #5 — Auto-link: estimate approved/paid but no contract amount set yet */}
            {originalEstimate &&
              (originalEstimate.status === 'approved' || originalEstimate.status === 'paid') &&
              !(project.contractAmount && project.contractAmount > 0) &&
              (user?.role === 'admin' || user?.role === 'super-admin') && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1,
                borderColor: '#BFDBFE', padding: 14,
                marginHorizontal: 16, marginBottom: 16,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <DollarSign size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 1 }}>
                    Estimate {originalEstimate.status === 'paid' ? 'Paid' : 'Approved'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#3B82F6', lineHeight: 17 }}>
                    Use ${originalEstimate.total.toLocaleString()} as the contract amount?
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setContractAmountInput(originalEstimate.total.toString());
                    setBudgetInput(project.budget.toString());
                    setShowBudgetModal(true);
                  }}
                  style={{
                    backgroundColor: '#2563EB', borderRadius: 8,
                    paddingHorizontal: 14, paddingVertical: 9,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Set</Text>
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
        return (
          <View style={styles.changeOrdersTabContent}>
            <View style={styles.changeOrdersHeader}>
              <View>
                <Text style={styles.changeOrdersTitle}>Change Orders</Text>
                <Text style={styles.changeOrdersSubtitle}>
                  {changeOrders.length} {changeOrders.length === 1 ? 'order' : 'orders'} •
                  ${changeOrders.reduce((sum, co) => sum + co.amount, 0).toLocaleString()} total
                </Text>
              </View>
              <TouchableOpacity
                style={styles.manageChangeOrdersButton}
                onPress={() => router.push(`/project/${id}/change-orders` as any)}
              >
                <Text style={styles.manageChangeOrdersButtonText}>Manage All</Text>
              </TouchableOpacity>
            </View>

            {changeOrders.length === 0 ? (
              <View style={styles.changeOrdersEmpty}>
                <FileText size={48} color="#9CA3AF" />
                <Text style={styles.changeOrdersEmptyTitle}>No Change Orders</Text>
                <Text style={styles.changeOrdersEmptyText}>
                  Change orders will appear here when added
                </Text>
                <TouchableOpacity
                  style={styles.addChangeOrderButton}
                  onPress={() => router.push(`/project/${id}/change-orders` as any)}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.addChangeOrderButtonText}>Add Change Order</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.changeOrdersList}
          keyboardDismissMode="on-drag"
        >
                {changeOrders.map((co) => (
                  <TouchableOpacity
                    key={co.id}
                    style={styles.changeOrderCard}
                    onPress={() => router.push(`/project/${id}/change-orders` as any)}
                  >
                    <View style={styles.changeOrderHeader}>
                      <Text style={styles.changeOrderDescription}>{co.description}</Text>
                      <View style={[
                        styles.changeOrderStatusBadge,
                        co.status === 'approved' && styles.changeOrderStatusApproved,
                        co.status === 'rejected' && styles.changeOrderStatusRejected,
                      ]}>
                        <Text style={styles.changeOrderStatusText}>{co.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.changeOrderDetails}>
                      <Text style={styles.changeOrderAmount}>${co.amount.toLocaleString()}</Text>
                      <Text style={styles.changeOrderDate}>
                        {new Date(co.date).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );

      case 'clock':
        if (project.status === 'completed' || project.status === 'archived') {
          return (
            <View style={styles.lockedTabContainer}>
              <Clock size={48} color="#9CA3AF" />
              <Text style={styles.lockedTabTitle}>Project {project.status === 'archived' ? 'Archived' : 'Completed'}</Text>
              <Text style={styles.lockedTabText}>Clock-in is disabled for {project.status} projects. {project.status === 'archived' ? 'Unarchive' : 'Reactivate'} the project to resume time tracking.</Text>
            </View>
          );
        }
        return (
          <View style={styles.clockTabContent}>
            <ClockInOutComponent projectId={project.id} projectName={project.name} />
          </View>
        );

      case 'expenses':
        if (project.status === 'completed' || project.status === 'archived') {
          return (
            <View style={styles.lockedTabContainer}>
              <DollarSign size={48} color="#9CA3AF" />
              <Text style={styles.lockedTabTitle}>Project {project.status === 'archived' ? 'Archived' : 'Completed'}</Text>
              <Text style={styles.lockedTabText}>Adding expenses is disabled for {project.status} projects. {project.status === 'archived' ? 'Unarchive' : 'Reactivate'} the project to add expenses.</Text>
            </View>
          );
        }
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
                <ScrollView style={styles.recentExpensesScroll}
          keyboardDismissMode="on-drag"
        >
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
        if (project.status === 'completed' || project.status === 'archived') {
          return (
            <View style={styles.lockedTabContainer}>
              <Camera size={48} color="#9CA3AF" />
              <Text style={styles.lockedTabTitle}>Project {project.status === 'archived' ? 'Archived' : 'Completed'}</Text>
              <Text style={styles.lockedTabText}>Photo uploads are disabled for {project.status} projects. {project.status === 'archived' ? 'Unarchive' : 'Reactivate'} the project to add new photos.</Text>
            </View>
          );
        }
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
            setShowWebCameraBanner(true);
            setTimeout(() => setShowWebCameraBanner(false), 4000);
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
          if (!selectedPhotoImage || isUploadingPhotoRef.current) return;
          isUploadingPhotoRef.current = true;
          setIsUploadingPhoto(true);
          try {
            console.log('[Photos] Uploading photo to S3...');

            const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

            // Compress the image and get reliable base64 (works on iOS, Android, and Web).
            // This avoids the unreliable fetch().blob() path on iOS photo-picker URIs.
            const compressed = await compressImage(selectedPhotoImage, { quality: 0.8 });

            // Get pre-signed upload URL (absolute URL — required on native iOS)
            const fileName = `photo-${Date.now()}-${photoCategory.toLowerCase().replace(/\s+/g, '-')}.jpg`;
            const urlResponse = await fetch(`${API_BASE}/api/get-s3-upload-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName, fileType: 'image/jpeg' }),
            });

            if (!urlResponse.ok) {
              const errBody = await urlResponse.json();
              throw new Error(errBody.error || 'Failed to get upload URL');
            }

            const { uploadUrl, fileUrl } = await urlResponse.json();
            console.log('[Photos] Got upload URL, uploading to S3...');

            // Upload to S3.
            // On native: use FileSystem.uploadAsync which reads the file natively and sends
            // raw bytes — avoids the Blob/ArrayBuffer limitation in Hermes.
            // On web: Blob is fully supported so we fetch → blob → PUT.
            if (Platform.OS === 'web') {
              const resp = await fetch(compressed.uri);
              const blob = await resp.blob();
              const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg' },
              });
              if (!uploadResponse.ok) throw new Error('Failed to upload photo to S3');
            } else {
              const uploadResult = await FileSystem.uploadAsync(uploadUrl, compressed.uri, {
                httpMethod: 'PUT',
                headers: { 'Content-Type': 'image/jpeg' },
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              });
              if (uploadResult.status < 200 || uploadResult.status >= 300) {
                throw new Error('Failed to upload photo to S3');
              }
            }

            console.log('[Photos] Photo uploaded successfully:', fileUrl);

            // Save photo metadata — await so we know it persisted before showing success
            const newPhoto = {
              id: generateUUID(),
              projectId: id as string,
              category: photoCategory,
              notes: photoNotes,
              url: fileUrl,
              date: new Date().toISOString(),
            };
            await addPhoto(newPhoto);

            setSelectedPhotoImage(null);
            setPhotoNotes('');
            setPhotoCategory('Foundation');
            Alert.alert('Success', 'Photo uploaded and saved successfully!');
          } catch (error) {
            console.error('[Photos] Upload error:', error);
            Alert.alert('Error', 'Failed to upload photo. Please try again.');
          } finally {
            isUploadingPhotoRef.current = false;
            setIsUploadingPhoto(false);
          }
        };

        return (
          <View style={styles.photosTabContent}>
            <ScrollView style={styles.photosScrollView} showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
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

              {showWebCameraBanner && (
                <View style={styles.webCameraBanner}>
                  <Monitor size={18} color="#2563EB" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.webCameraBannerTitle}>Camera not available on web</Text>
                    <Text style={styles.webCameraBannerText}>To take photos, please use the mobile app on your phone or tablet.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowWebCameraBanner(false)}>
                    <X size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.photosForm}>
                <Text style={styles.photosLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoCategoryScroll}
                  contentContainerStyle={styles.photoCategoryContent}
                
          keyboardDismissMode="on-drag"
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
                      <View key={photo.id} style={[styles.photosGalleryItem, { position: 'relative' }]}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
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

                        {project?.status !== 'completed' && photo.uploadedBy === user?.id && (
                          <TouchableOpacity
                            style={styles.photosGalleryDeleteBtn}
                            onPress={() => {
                              if (Platform.OS === 'web') {
                                if (!window.confirm('Delete this photo?')) return;
                                deletePhoto(photo.id).catch((err: any) => window.alert(err.message || 'Failed to delete photo'));
                                return;
                              }
                              Alert.alert('Delete Photo', 'Are you sure?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deletePhoto(photo.id) },
                              ]);
                            }}
                          >
                            <Trash2 size={13} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        );

      case 'files':
        // Files tab navigates directly to the organized files-navigation screen.
        // The tab button (below) calls router.push so this case is never rendered.
        return null;
      case '__files_dead__':
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilters}
          keyboardDismissMode="on-drag"
        >
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
            
          keyboardDismissMode="on-drag"
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
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}
          keyboardDismissMode="on-drag"
        >
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
                      style={[styles.selectFileButton, isUploadingFile && { opacity: 0.6 }]}
                      onPress={handlePickDocument}
                      disabled={isUploadingFile}
                    >
                      {isUploadingFile
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <Upload size={18} color="#FFFFFF" />
                      }
                      <Text style={styles.selectFileButtonText}>
                        {isUploadingFile ? 'Uploading...' : 'Select File'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
              </KeyboardAvoidingView>
            </Modal>
          </View>
        );

      case 'videos':
        const allInspectionVideos = inspectionVideosData;

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
            <ScrollView style={styles.photosScrollView} showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
              <View style={styles.photosHeader}>
                <View>
                  <Text style={styles.photosTitle}>Inspection Videos</Text>
                  <Text style={styles.filesSubtitle}>
                    {clientVideos.length} {clientVideos.length === 1 ? 'video' : 'videos'} for {projectClientName}
                  </Text>
                </View>
              </View>

              {false ? (
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
              if (!entry.clockOut || !entry.clockIn) return sum;
              const inMs = new Date(entry.clockIn).getTime();
              const outMs = new Date(entry.clockOut).getTime();
              if (isNaN(inMs) || isNaN(outMs)) return sum;
              return sum + Math.max(0, (outMs - inMs) / (1000 * 60 * 60));
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
          <ArrowLeft size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{project.name}</Text>
        <DailyTasksButton />
        {project.status === 'active' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => updateProject(project.id, { status: 'completed', endDate: new Date().toISOString() })}
          >
            <Archive size={24} color="#10B981" />
          </TouchableOpacity>
        )}
        {project.status === 'on-hold' && (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: '#FFF7ED' }]}
            onPress={() => updateProject(project.id, { status: 'active' })}
          >
            <PlayCircle size={24} color="#F59E0B" />
          </TouchableOpacity>
        )}
        {project.status === 'completed' && (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: '#FEF3C7' }]}
            onPress={() => updateProject(project.id, { status: 'active', endDate: undefined })}
          >
            <TrendingUp size={24} color="#F59E0B" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}
          keyboardDismissMode="on-drag"
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'schedule' && styles.activeTab]}
            onPress={() => setActiveTab('schedule')}
          >
            <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>
              Schedule
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
            style={styles.tab}
            onPress={() => router.push(`/project/${id}/files-navigation` as any)}
          >
            <Text style={styles.tabText}>
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

      {(project.status === 'completed' || project.status === 'archived') && (
        <View style={[styles.completedBanner, project.status === 'archived' && { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}>
          <Text style={styles.completedBannerText}>
            {project.status === 'archived'
              ? '📦 Project Archived — All editing is locked. Go to Overview to unarchive.'
              : '✓ Project Completed — Clock-in, Photos & Expenses are locked. Go to Overview to reactivate.'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
        {renderTabContent()}
      </ScrollView>
      </View>

      {/* ── Record Payment Modal ── */}
      <Modal
        visible={showAddPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          {/* Backdrop */}
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={() => setShowAddPaymentModal(false)}
          />
          {/* Sheet */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 16, maxHeight: '92%' }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} color="#10B981" />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Record Payment</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{project?.name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAddPaymentModal(false)} style={{ padding: 4 }}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
              {/* Amount */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Amount Received *
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 10, backgroundColor: '#F0FDF4', marginBottom: 14, paddingHorizontal: 14 }}>
                <Text style={{ fontSize: 20, color: '#10B981', fontWeight: '700', marginRight: 4 }}>$</Text>
                <TextInput
                  value={paymentAmountInput}
                  onChangeText={setPaymentAmountInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  style={{ flex: 1, fontSize: 20, fontWeight: '600', color: '#064E3B', paddingVertical: 13 }}
                />
              </View>

              {/* Date */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Payment Date *
              </Text>
              <TouchableOpacity
                onPress={() => setShowPaymentDatePicker(p => !p)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: showPaymentDatePicker ? '#10B981' : '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: showPaymentDatePicker ? '#F0FDF4' : '#F9FAFB', marginBottom: 6 }}
                activeOpacity={0.7}
              >
                <Calendar size={18} color={showPaymentDatePicker ? '#10B981' : '#6B7280'} />
                <Text style={{ flex: 1, fontSize: 15, color: paymentDateInput ? '#111827' : '#9CA3AF' }}>
                  {paymentDateInput
                    ? new Date(paymentDateInput + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Select payment date'}
                </Text>
                {paymentDateInput ? (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); setPaymentDateInput(''); setShowPaymentDatePicker(false); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <X size={15} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              {showPaymentDatePicker && (
                <CustomDatePicker
                  value={paymentDateInput}
                  onChange={(date) => { setPaymentDateInput(date); setShowPaymentDatePicker(false); }}
                />
              )}
              <View style={{ marginBottom: 8 }} />

              {/* Payment Method */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Payment Method *
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {(['cash', 'check', 'credit-card', 'wire-transfer', 'other'] as Payment['method'][]).map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPaymentMethodInput(m)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: paymentMethodInput === m ? '#10B981' : '#F3F4F6', borderWidth: 1, borderColor: paymentMethodInput === m ? '#10B981' : '#E5E7EB' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: paymentMethodInput === m ? '#FFFFFF' : '#374151' }}>
                      {m === 'credit-card' ? 'Card' : m === 'wire-transfer' ? 'Wire' : m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Client Name */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Client Name *
              </Text>
              <TextInput
                value={paymentClientNameInput}
                onChangeText={setPaymentClientNameInput}
                placeholder="Enter client name"
                placeholderTextColor="#9CA3AF"
                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 14 }}
              />

              {/* Notes */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Notes (optional)
              </Text>
              <TextInput
                value={paymentNotesInput}
                onChangeText={setPaymentNotesInput}
                placeholder="e.g. Invoice #123, partial payment..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 20, minHeight: 70, textAlignVertical: 'top' }}
              />

              {/* Save */}
              <TouchableOpacity
                disabled={isAddingPayment}
                onPress={async () => {
                  const amount = parseFloat(paymentAmountInput.replace(/,/g, ''));
                  if (isNaN(amount) || amount <= 0) {
                    Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than $0.');
                    return;
                  }
                  if (!paymentDateInput.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDateInput.trim())) {
                    Alert.alert('Date Required', 'Please select the payment date.');
                    return;
                  }
                  if (!paymentClientNameInput.trim()) {
                    Alert.alert('Client Name Required', 'Please enter the client name.');
                    return;
                  }
                  setIsAddingPayment(true);
                  try {
                    const base = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
                      (typeof window !== 'undefined' && window.location?.origin) ||
                      'https://legacy-prime-workflow-suite.vercel.app';
                    const { data: { session: paymentSession } } = await supabase.auth.getSession();
                    const res = await fetch(`${base}/api/add-payment`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(paymentSession?.access_token ? { 'Authorization': `Bearer ${paymentSession.access_token}` } : {}),
                      },
                      body: JSON.stringify({
                        projectId: id as string,
                        amount,
                        date: paymentDateInput.trim(),
                        clientName: paymentClientNameInput.trim(),
                        method: paymentMethodInput,
                        notes: paymentNotesInput.trim() || undefined,
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: res.statusText }));
                      throw new Error(err.error || `HTTP ${res.status}`);
                    }
                    const saved = await res.json().catch(() => ({}));
                    addNotification({
                      id:        generateUUID(),
                      userId:    user?.id || '',
                      companyId: company?.id || '',
                      type:      'payment-received',
                      title:     'Payment Recorded',
                      message:   `$${amount.toLocaleString()} payment recorded${project ? ` for ${project.name}` : ''}`,
                      data:      { paymentId: saved?.id, projectId: id },
                      read:      false,
                      createdAt: new Date().toISOString(),
                    });
                    fetchPayments();
                    setShowAddPaymentModal(false);
                    Alert.alert('Payment Recorded', `$${amount.toLocaleString()} received from ${paymentClientNameInput.trim()} has been recorded.`);
                  } catch (err: any) {
                    Alert.alert('Error', err.message || 'Failed to record payment. Please try again.');
                  } finally {
                    setIsAddingPayment(false);
                  }
                }}
                style={{ paddingVertical: 14, borderRadius: 12, backgroundColor: isAddingPayment ? '#9CA3AF' : '#10B981', alignItems: 'center', marginBottom: 8 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                  {isAddingPayment ? 'Saving...' : 'Record Payment'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Budget Edit Modal ── */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setShowBudgetModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: 340,
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Edit Budget</Text>
              <TouchableOpacity onPress={() => setShowBudgetModal(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Total Contract Amount */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Contract Amount
            </Text>
            <TextInput
              value={contractAmountInput}
              onChangeText={setContractAmountInput}
              keyboardType="numeric"
              placeholder={project.contractAmount ? project.contractAmount.toLocaleString() : 'e.g. 300000'}
              placeholderTextColor="#9CA3AF"
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 11, fontSize: 16,
                color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16,
              }}
              autoFocus
            />

            {/* Project Budget */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Project Budget
            </Text>
            <TextInput
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder={project.budget ? project.budget.toLocaleString() : 'e.g. 250000'}
              placeholderTextColor="#9CA3AF"
              style={{
                borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 11, fontSize: 16,
                color: '#064E3B', backgroundColor: '#F0FDF4', marginBottom: 20,
              }}
            />

            {/* Save / Cancel */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setShowBudgetModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const updates: Partial<import('@/types').Project> = {};
                  if (budgetInput.trim()) {
                    const v = parseFloat(budgetInput.replace(/,/g, ''));
                    if (isNaN(v) || v < 0) { Alert.alert('Invalid Budget', 'Enter a valid project budget.'); return; }
                    updates.budget = v;
                  }
                  if (contractAmountInput.trim()) {
                    const v = parseFloat(contractAmountInput.replace(/,/g, ''));
                    if (isNaN(v) || v < 0) { Alert.alert('Invalid Amount', 'Enter a valid contract amount.'); return; }
                    updates.contractAmount = v;
                  }
                  if (Object.keys(updates).length > 0) updateProject(project.id, updates);
                  setShowBudgetModal(false);
                  Alert.alert('Saved', 'Budget information updated successfully.');
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Save</Text>
              </TouchableOpacity>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
    flex: 1,
  },
  completeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 70,
  },
  activeTab: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 13,
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
  // ── Labor Cost Card ────────────────────────────────────────────────────────
  laborCard: {
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
  laborCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  laborCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  laborCardSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  laborTotalBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  laborTotalBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  laborEmptyState: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    gap: 8,
  },
  laborEmptyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  laborEmptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    paddingHorizontal: 16,
  },
  laborTableHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 4,
  },
  laborTableHeaderText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    textAlign: 'right' as const,
  },
  laborColHours: {
    width: 52,
    textAlign: 'right' as const,
  },
  laborColRate: {
    width: 52,
    textAlign: 'right' as const,
  },
  laborColCost: {
    width: 68,
    textAlign: 'right' as const,
  },
  laborRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  laborRowActive: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderBottomWidth: 0,
    marginBottom: 2,
    paddingHorizontal: 8,
  },
  laborAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  laborAvatarActive: {
    backgroundColor: '#D1FAE5',
  },
  laborAvatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#374151',
  },
  laborActiveDot: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  laborEmployeeName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  laborSessionCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  laborLiveLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600' as const,
  },
  laborSegmentRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 52,
    paddingVertical: 3,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    marginBottom: 2,
  },
  laborSegmentLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  laborSegmentCost: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  laborCellValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500' as const,
  },
  laborCellMuted: {
    color: '#9CA3AF',
  },
  laborCostValue: {
    color: '#2563EB',
    fontWeight: '700' as const,
  },
  laborTotalsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingTop: 10,
    paddingHorizontal: 4,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  laborTotalLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  laborTotalCost: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2563EB',
    textAlign: 'right' as const,
    width: 68,
  },
  laborRateWarning: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 10,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  laborReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  laborReportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  // ── End Labor Cost Card ────────────────────────────────────────────────────
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
  coverPhotoContainer: {
    position: 'relative' as const,
    width: '100%',
    marginBottom: 20,
  },
  changeCoverPhotoButton: {
    position: 'absolute' as const,
    bottom: 28,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  changeCoverPhotoText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
    flexDirection: 'column',
    marginBottom: 8,
  },
  balanceItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  balanceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  balanceLabel: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500' as const,
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
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
    marginBottom: 16,
  },
  topMetricLarge: {
    flex: 1.5,
    paddingRight: 12,
  },
  topMetricMedium: {
    flex: 1,
    paddingLeft: 12,
  },
  topMetricLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  topMetricValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  topMetricSubtext: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 18,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 14,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  paymentMetric: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentMetricTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  paymentMetricValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1F2937',
    marginBottom: 10,
    letterSpacing: -0.5,
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
    gap: 8,
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
  webCameraBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  webCameraBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1E40AF',
    marginBottom: 2,
  },
  webCameraBannerText: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
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
  photosGalleryDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 14,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  changeOrdersTabContent: {
    padding: 20,
  },
  changeOrdersHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  changeOrdersTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  changeOrdersSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  manageChangeOrdersButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageChangeOrdersButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  changeOrdersEmpty: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 60,
  },
  changeOrdersEmptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  changeOrdersEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center' as const,
  },
  addChangeOrderButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  addChangeOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  changeOrdersList: {
    flex: 1,
  },
  changeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  changeOrderHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  changeOrderDescription: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  changeOrderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FEF3C7',
  },
  changeOrderStatusApproved: {
    backgroundColor: '#D1FAE5',
  },
  changeOrderStatusRejected: {
    backgroundColor: '#FEE2E2',
  },
  changeOrderStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  changeOrderDetails: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  changeOrderAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  changeOrderDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 48,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#374151',
    textAlign: 'center' as const,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  completedBanner: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  completedBannerText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  lockedTabContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 48,
    gap: 16,
  },
  lockedTabTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#374151',
    textAlign: 'center' as const,
  },
  lockedTabText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
