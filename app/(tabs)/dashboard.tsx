import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { Search, Plus, X, Archive, FileText, CheckSquare, FolderOpen } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { Project, Report, ProjectReportData } from '@/types';

export default function DashboardScreen() {
  const { projects, expenses, clockEntries, addProject, addReport, reports, clients, updateClient, dailyLogs } = useApp();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [showImportOptions, setShowImportOptions] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [projectAddress, setProjectAddress] = useState<string>('');
  const [projectBudget, setProjectBudget] = useState<string>('');
  const [projectEmail, setProjectEmail] = useState<string>('');
  const [projectPhone, setProjectPhone] = useState<string>('');
  const [projectSource, setProjectSource] = useState<string>('');
  const [showReportMenu, setShowReportMenu] = useState<boolean>(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [showReportTypeMenu, setShowReportTypeMenu] = useState<boolean>(false);
  const [reportType, setReportType] = useState<'administrative' | 'expenses' | 'time-tracking' | 'daily-logs'>('administrative');

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const archivedProjects = projects.filter(p => p.status === 'archived');
  const displayProjects = showArchived ? archivedProjects : activeProjects;

  const totalBudget = activeProjects.reduce((sum, p) => sum + p.budget, 0);
  const totalExpenses = activeProjects.reduce((sum, p) => sum + p.expenses, 0);

  const monthlySales = useMemo(() => {
    const months = ['Oct', 'Dec', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const sales = [420000, 350000, 580000, 420000, 480000, 520000, 300000, 720000];
    return months.map((month, index) => ({ month, amount: sales[index] }));
  }, []);

  const maxSale = Math.max(...monthlySales.map(s => s.amount));

  const projectExpenses = useMemo(() => {
    return activeProjects.map(project => ({
      id: project.id,
      name: project.name,
      amount: expenses.filter((e) => e.projectId === project.id).reduce((sum: number, e) => sum + e.amount, 0),
    }));
  }, [activeProjects, expenses]);

  const handleReportRequest = (selectionType: 'all' | 'selected') => {
    if (selectionType === 'selected' && selectedProjects.length === 0) {
      Alert.alert('No Projects Selected', 'Please select at least one project to generate a report.');
      return;
    }

    const projectsToReport = selectionType === 'all' 
      ? activeProjects 
      : activeProjects.filter(p => selectedProjects.includes(p.id));

    if (reportType === 'expenses') {
      const projectsExpensesData = projectsToReport.map(project => {
        const projectExpenses = expenses.filter(e => e.projectId === project.id);
        
        const expensesByCategory: { [category: string]: number } = {};
        projectExpenses.forEach(expense => {
          const category = expense.type || 'Uncategorized';
          expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
        });

        return {
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
      });

      const overallExpensesByCategory: { [category: string]: number } = {};
      projectsExpensesData.forEach(project => {
        Object.entries(project.expensesByCategory).forEach(([category, amount]) => {
          overallExpensesByCategory[category] = (overallExpensesByCategory[category] || 0) + amount;
        });
      });

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Expenses Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'expenses',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        totalExpenses: projectsExpensesData.reduce((sum, p) => sum + p.expenses, 0),
        projects: projectsExpensesData,
        expensesByCategory: overallExpensesByCategory,
      };

      addReport(report);

      console.log('[Report] Generating expenses breakdown report for projects:', projectsToReport.map(p => p.name));
      console.log('[Report] Report includes:');
      console.log(`  - ${projectsToReport.length} projects`);
      console.log(`  - Total Expenses: ${report.totalExpenses?.toLocaleString()}`);
      console.log(`  - Categories:`, Object.keys(overallExpensesByCategory).join(', '));

      Alert.alert(
        'Report Generated',
        `Expenses report saved successfully. ${projectsToReport.length} project(s) included.`,
        [{ text: 'OK', onPress: () => {
          setShowReportMenu(false);
          setShowReportTypeMenu(false);
          setIsSelectMode(false);
          setSelectedProjects([]);
        }}]
      );
      return;
    }

    if (reportType === 'time-tracking') {
      const allClockEntries = clockEntries.filter(entry => 
        projectsToReport.some(p => p.id === entry.projectId)
      );

      const employeeDataMap: { [employeeId: string]: any } = {};
      
      allClockEntries.forEach(entry => {
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
        name: `Time Tracking Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'time-tracking',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        totalHours: employeeData.reduce((sum, emp) => sum + emp.totalHours, 0),
        employeeData,
        employeeIds: employeeData.map(emp => emp.employeeId),
      };

      addReport(report);

      console.log('[Report] Generating time tracking report for projects:', projectsToReport.map(p => p.name));
      console.log('[Report] Report includes:');
      console.log(`  - ${projectsToReport.length} projects`);
      console.log(`  - ${employeeData.length} employees`);
      console.log(`  - Total Hours: ${report.totalHours?.toFixed(2)}`);

      Alert.alert(
        'Report Generated',
        `Time tracking report saved successfully. ${employeeData.length} employee(s), ${report.totalHours?.toFixed(2)} total hours.`,
        [{ text: 'OK', onPress: () => {
          setShowReportMenu(false);
          setShowReportTypeMenu(false);
          setIsSelectMode(false);
          setSelectedProjects([]);
        }}]
      );
      return;
    }

    if (reportType === 'daily-logs') {
      const projectDailyLogs = projectsToReport.map(project => {
        const logs = dailyLogs.filter(log => log.projectId === project.id);
        return {
          projectId: project.id,
          projectName: project.name,
          logs: logs,
        };
      }).filter(p => p.logs.length > 0);

      const totalLogs = projectDailyLogs.reduce((sum, p) => sum + p.logs.length, 0);

      if (totalLogs === 0) {
        Alert.alert('No Daily Logs', 'The selected project(s) have no daily logs to export.');
        return;
      }

      const report: Report = {
        id: `report-${Date.now()}`,
        name: `Daily Logs Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
        type: 'custom',
        generatedDate: new Date().toISOString(),
        projectIds: projectsToReport.map(p => p.id),
        projectsCount: projectsToReport.length,
        notes: JSON.stringify({ dailyLogs: projectDailyLogs }),
      };

      addReport(report);

      console.log('[Report] Generating daily logs report for projects:', projectsToReport.map(p => p.name));
      console.log('[Report] Report includes:');
      console.log(`  - ${projectsToReport.length} projects`);
      console.log(`  - ${totalLogs} daily logs`);
      
      projectDailyLogs.forEach(project => {
        console.log(`\n[Report] ${project.projectName}:`);
        console.log(`  Daily Logs: ${project.logs.length}`);
      });

      Alert.alert(
        'Report Generated',
        `Daily logs report saved successfully. ${totalLogs} log(s) from ${projectDailyLogs.length} project(s) included.`,
        [{ text: 'OK', onPress: () => {
          setShowReportMenu(false);
          setShowReportTypeMenu(false);
          setIsSelectMode(false);
          setSelectedProjects([]);
        }}]
      );
      return;
    }

    const projectsData: ProjectReportData[] = projectsToReport.map(project => {
      const projectExpenses = expenses.filter(e => e.projectId === project.id);
      const projectClockEntries = clockEntries.filter(c => c.projectId === project.id);
      
      const expensesByCategory: { [category: string]: number } = {};
      projectExpenses.forEach(expense => {
        const category = expense.type || 'Uncategorized';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
      });

      return {
        projectId: project.id,
        projectName: project.name,
        budget: project.budget,
        expenses: projectExpenses.reduce((sum, e) => sum + e.amount, 0),
        hoursWorked: project.hoursWorked,
        clockEntries: projectClockEntries.length,
        status: project.status,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate,
        expensesByCategory,
      };
    });

    const report: Report = {
      id: `report-${Date.now()}`,
      name: `Administrative Report - ${selectionType === 'all' ? 'All Projects' : `${projectsToReport.length} Selected Projects`}`,
      type: 'administrative',
      generatedDate: new Date().toISOString(),
      projectIds: projectsToReport.map(p => p.id),
      projectsCount: projectsToReport.length,
      totalBudget: projectsToReport.reduce((sum, p) => sum + p.budget, 0),
      totalExpenses: projectsData.reduce((sum, p) => sum + p.expenses, 0),
      totalHours: projectsToReport.reduce((sum, p) => sum + p.hoursWorked, 0),
      projects: projectsData,
    };

    addReport(report);

    console.log('[Report] Generating administrative report for projects:', projectsToReport.map(p => p.name));
    console.log('[Report] Report includes:');
    console.log(`  - ${projectsToReport.length} projects`);
    console.log(`  - Total Budget: ${report.totalBudget?.toLocaleString()}`);
    console.log(`  - Total Expenses: ${report.totalExpenses?.toLocaleString()}`);
    console.log(`  - Total Hours: ${report.totalHours}`);
    
    projectsData.forEach(project => {
      console.log(`\n[Report] ${project.projectName}:`);
      console.log(`  Budget: ${project.budget.toLocaleString()}`);
      console.log(`  Expenses: ${project.expenses.toLocaleString()}`);
      console.log(`  Hours Worked: ${project.hoursWorked}`);
      console.log(`  Clock Entries: ${project.clockEntries}`);
      console.log(`  Status: ${project.status}`);
    });

    Alert.alert(
      'Report Generated',
      `Administrative report saved successfully. ${projectsToReport.length} project(s) included.`,
      [{ text: 'OK', onPress: () => {
        setShowReportMenu(false);
        setShowReportTypeMenu(false);
        setIsSelectMode(false);
        setSelectedProjects([]);
      }}]
    );
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      }
      return [...prev, projectId];
    });
  };

  const pieChartData = useMemo(() => {
    const total = projectExpenses.reduce((sum, p) => sum + p.amount, 0);
    if (total === 0) return [];

    const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    let currentAngle = -90;

    return projectExpenses.map((proj, index) => {
      const percentage = (proj.amount / total) * 100;
      const angle = (proj.amount / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        id: proj.id,
        name: proj.name,
        amount: proj.amount,
        percentage,
        startAngle,
        angle,
        color: colors[index % colors.length],
      };
    });
  }, [projectExpenses]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Project List</Text>
              <TouchableOpacity
                style={[styles.filterChip, showArchived && styles.filterChipActive]}
                onPress={() => setShowArchived(!showArchived)}
              >
                <Archive size={16} color={showArchived ? '#FFFFFF' : '#6B7280'} />
                <Text style={[styles.filterChipText, showArchived && styles.filterChipTextActive]}>
                  {showArchived ? `Archived (${archivedProjects.length})` : `Active (${activeProjects.length})`}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton}>
                <Search size={20} color="#2563EB" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowImportOptions(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Project</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => setShowReportMenu(!showReportMenu)}
              >
                <FileText size={20} color="#2563EB" />
              </TouchableOpacity>

              {reports.length > 0 && (
                <TouchableOpacity
                  style={styles.reportsLibraryButton}
                  onPress={() => router.push('/reports' as any)}
                >
                  <FolderOpen size={20} color="#10B981" />
                  <View style={styles.reportsBadge}>
                    <Text style={styles.reportsBadgeText}>{reports.length}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {showReportMenu && !showReportTypeMenu && (
          <View style={styles.reportMenu}>
            <View style={styles.reportMenuHeader}>
              <FileText size={20} color="#2563EB" />
              <Text style={styles.reportMenuTitle}>Generate Report</Text>
            </View>
            <View style={styles.reportMenuButtons}>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setReportType('administrative');
                  setShowReportTypeMenu(true);
                }}
              >
                <Text style={styles.reportMenuItemText}>Administrative & Financial</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setReportType('expenses');
                  setShowReportTypeMenu(true);
                }}
              >
                <Text style={styles.reportMenuItemText}>Expenses Breakdown</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setReportType('time-tracking');
                  setShowReportTypeMenu(true);
                }}
              >
                <Text style={styles.reportMenuItemText}>Time Tracking & Clocking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setReportType('daily-logs');
                  setShowReportTypeMenu(true);
                }}
              >
                <Text style={styles.reportMenuItemText}>Daily Logs</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showReportMenu && showReportTypeMenu && (
          <View style={styles.reportMenu}>
            <View style={styles.reportMenuHeader}>
              <FileText size={20} color="#2563EB" />
              <Text style={styles.reportMenuTitle}>
                {reportType === 'administrative' ? 'Administrative & Financial' : 
                 reportType === 'expenses' ? 'Expenses Breakdown' :
                 reportType === 'time-tracking' ? 'Time Tracking & Clocking' : 'Daily Logs'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportTypeMenu(false);
                  setIsSelectMode(false);
                  setSelectedProjects([]);
                }}
                style={{ marginLeft: 'auto' }}
              >
                <Text style={{ color: '#6B7280', fontSize: 14 }}>Back</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reportMenuButtons}>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => handleReportRequest('all')}
              >
                <Text style={styles.reportMenuItemText}>All Active Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportMenuItem}
                onPress={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) {
                    setSelectedProjects([]);
                  }
                }}
              >
                <Text style={styles.reportMenuItemText}>
                  {isSelectMode ? 'Cancel Selection' : 'Select Projects'}
                </Text>
              </TouchableOpacity>
              {isSelectMode && selectedProjects.length > 0 && (
                <TouchableOpacity
                  style={[styles.reportMenuItem, styles.reportMenuItemPrimary]}
                  onPress={() => handleReportRequest('selected')}
                >
                  <Text style={styles.reportMenuItemTextPrimary}>
                    Generate Report ({selectedProjects.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {displayProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Archive size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>
              {showArchived ? 'No archived projects' : 'No active projects'}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={310}
            snapToAlignment="center"
            contentContainerStyle={styles.projectsCarousel}
            style={styles.projectsCarouselContainer}
          >
            {displayProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={[
                  styles.projectCard,
                  isSelectMode && selectedProjects.includes(project.id) && styles.projectCardSelected
                ]}
                onPress={() => {
                  if (isSelectMode) {
                    toggleProjectSelection(project.id);
                  } else {
                    router.push(`/project/${project.id}` as any);
                  }
                }}
              >
                {isSelectMode && (
                  <View style={styles.projectCheckbox}>
                    <CheckSquare
                      size={24}
                      color={selectedProjects.includes(project.id) ? '#10B981' : '#FFFFFF'}
                      fill={selectedProjects.includes(project.id) ? '#10B981' : 'transparent'}
                    />
                  </View>
                )}
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectBudget}>Budget: ${project.budget.toLocaleString()}</Text>
                <Image
                  source={{ uri: project.image }}
                  style={styles.projectImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>total sold</Text>
            <Text style={styles.statValue}>${(1500000).toLocaleString()}</Text>
            <View style={styles.chartContainer}>
              {monthlySales.map((sale, index) => {
                const height = (sale.amount / maxSale) * 100;
                return (
                  <View key={index} style={styles.barWrapper}>
                    <View style={[styles.bar, { height: `${height}%` }]} />
                    <Text style={styles.barLabel}>{sale.month}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.totalBudgetRow}>
              <Text style={styles.totalBudgetLabel}>Total Budget</Text>
              <Text style={styles.totalBudgetValue}>${totalBudget.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Expenses</Text>
            
            {pieChartData.length > 0 ? (
              <View style={styles.pieChartContainer}>
                <Svg width="180" height="180" viewBox="0 0 200 200">
                  <G>
                    {pieChartData.map((slice) => {
                      return (
                        <G key={slice.id}>
                          <Circle
                            cx="100"
                            cy="100"
                            r="90"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="180"
                            strokeDasharray={`${(slice.angle / 360) * 565.48} 565.48`}
                            strokeDashoffset={-565.48 * ((slice.startAngle + 90) / 360)}
                            rotation="-90"
                            origin="100, 100"
                          />
                        </G>
                      );
                    })}
                  </G>
                </Svg>
                
                <View style={styles.legendContainer}>
                  {pieChartData.map((slice) => (
                    <View key={slice.id} style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
                      <View style={styles.legendText}>
                        <Text style={styles.legendName} numberOfLines={1}>{slice.name}</Text>
                        <Text style={styles.legendValue}>
                          ${slice.amount.toLocaleString()} ({slice.percentage.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyExpenses}>
                <Text style={styles.emptyExpensesText}>No expenses yet</Text>
              </View>
            )}
            
            <View style={styles.expenseTotal}>
              <Text style={styles.expenseTotalLabel}>Total Expenses</Text>
              <Text style={styles.expenseTotalValue}>${totalExpenses.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showImportOptions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImportOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importOptionsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Project</Text>
              <TouchableOpacity onPress={() => setShowImportOptions(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.importDescription}>
              Choose how to add your project
            </Text>

            <TouchableOpacity
              style={styles.importOptionCard}
              onPress={() => {
                setShowImportOptions(false);
                setShowCreateModal(true);
              }}
            >
              <View style={styles.importIconContainer}>
                <Plus size={28} color="#2563EB" />
              </View>
              <View style={styles.importOptionContent}>
                <Text style={styles.importOptionTitle}>Create New Project</Text>
                <Text style={styles.importOptionText}>
                  Start from scratch with all project details
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.importOptionCard}
              onPress={() => {
                if (clients.filter(c => c.status === 'Lead').length === 0) {
                  Alert.alert('No Leads Available', 'Add clients to your CRM first to import from there.');
                  return;
                }
                Alert.alert(
                  'Import from CRM',
                  'Select a client from CRM to convert to project',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Go to CRM',
                      onPress: () => {
                        setShowImportOptions(false);
                        router.push('/crm');
                      },
                    },
                  ]
                );
              }}
            >
              <View style={styles.importIconContainer}>
                <FileText size={28} color="#10B981" />
              </View>
              <View style={styles.importOptionContent}>
                <Text style={styles.importOptionTitle}>Import from CRM</Text>
                <Text style={styles.importOptionText}>
                  Convert an existing lead to a project
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Project</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Client/Project Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectName}
                    onChangeText={setProjectName}
                    placeholder="Enter client or project name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Address</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectAddress}
                    onChangeText={setProjectAddress}
                    placeholder="Enter project address"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectEmail}
                    onChangeText={setProjectEmail}
                    placeholder="Enter client email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Phone *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectPhone}
                    onChangeText={setProjectPhone}
                    placeholder="Enter client phone"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Source</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectSource}
                    onChangeText={setProjectSource}
                    placeholder="Google, Referral, Ad, Other"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Budget *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={projectBudget}
                    onChangeText={setProjectBudget}
                    placeholder="Enter budget amount"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={() => {
                    if (!projectName.trim()) {
                      Alert.alert('Error', 'Please enter a client/project name');
                      return;
                    }
                    if (!projectEmail.trim()) {
                      Alert.alert('Error', 'Please enter an email');
                      return;
                    }
                    if (!projectPhone.trim()) {
                      Alert.alert('Error', 'Please enter a phone number');
                      return;
                    }
                    if (!projectBudget.trim()) {
                      Alert.alert('Error', 'Please enter a budget');
                      return;
                    }

                    const newProject: Project = {
                      id: `project-${Date.now()}`,
                      name: projectName,
                      budget: parseFloat(projectBudget),
                      expenses: 0,
                      progress: 0,
                      status: 'active',
                      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
                      hoursWorked: 0,
                      startDate: new Date().toISOString(),
                    };

                    addProject(newProject);

                    const sourceValue = projectSource.trim() || 'Other';
                    const validSources = ['Google', 'Referral', 'Ad', 'Other'];
                    const finalSource = validSources.includes(sourceValue) ? sourceValue as 'Google' | 'Referral' | 'Ad' | 'Other' : 'Other';

                    const existingClient = clients.find(c => 
                      c.email.toLowerCase() === projectEmail.toLowerCase() ||
                      c.phone === projectPhone
                    );

                    if (existingClient) {
                      updateClient(existingClient.id, { status: 'Project' });
                    }

                    setProjectName('');
                    setProjectAddress('');
                    setProjectEmail('');
                    setProjectPhone('');
                    setProjectSource('');
                    setProjectBudget('');
                    setShowCreateModal(false);
                    Alert.alert('Success', 'Project created successfully!');
                  }}
                >
                  <Text style={styles.createButtonText}>Create Project</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsLibraryButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  reportsBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  reportsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  reportMenu: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportMenuTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  reportMenuButtons: {
    gap: 8,
  },
  reportMenuItem: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportMenuItemPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  reportMenuItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center',
  },
  reportMenuItemTextPrimary: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  projectsCarouselContainer: {
    height: 280,
  },
  projectsCarousel: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  projectCard: {
    width: 280,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 16,
    height: 240,
    position: 'relative' as const,
  },
  projectCardSelected: {
    borderWidth: 3,
    borderColor: '#10B981',
  },
  projectCheckbox: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    zIndex: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  projectBudget: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  projectImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  statsContainer: {
    flexDirection: 'column',
    padding: 16,
    gap: 16,
  },
  statCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '80%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 6,
  },
  totalBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalBudgetLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  totalBudgetValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  pieChartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  legendContainer: {
    width: '100%',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    flex: 1,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  legendValue: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExpensesText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  expenseTotal: {
    alignItems: 'center',
  },
  expenseTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  expenseTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalScrollView: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
  },
  importOptionsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
  },
  importDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  importOptionCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  importIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  importOptionContent: {
    flex: 1,
  },
  importOptionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  importOptionText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
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
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  createButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
