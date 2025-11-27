import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, ActivityIndicator } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { FileText, Calendar, Trash2, X, BarChart, Folder, Download, FileSpreadsheet } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Report, DailyLog } from '@/types';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ReportsScreen() {
  const { reports, deleteReport } = useApp();
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
      case 'expenses':
        return '#EF4444';
      case 'custom':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const exportToCSV = async (report: Report) => {
    try {
      setIsExporting(true);
      let csvContent = '';

      if (report.type === 'expenses' && report.expensesByCategory) {
        csvContent = 'EXPENSES REPORT\n\n';
        csvContent += `Report Name,${report.name}\n`;
        csvContent += `Generated Date,${formatDate(report.generatedDate)}\n`;
        csvContent += `Total Projects,${report.projectsCount}\n`;
        csvContent += `Total Expenses,${(report.totalExpenses ?? 0).toLocaleString()}\n\n`;
        
        csvContent += 'EXPENSES BY CATEGORY\n';
        csvContent += 'Category,Amount\n';
        Object.entries(report.expensesByCategory).forEach(([category, amount]) => {
          csvContent += `${category},${(amount ?? 0).toLocaleString()}\n`;
        });
        
        if (report.projects) {
          csvContent += '\nPROJECT BREAKDOWN\n';
          csvContent += 'Project Name,Budget,Expenses,Status,Progress\n';
          report.projects.forEach(project => {
            csvContent += `${project.projectName},${project.budget.toLocaleString()},${project.expenses.toLocaleString()},${project.status},${project.progress}%\n`;
          });
        }
      } else if (report.type === 'time-tracking' && report.employeeData) {
        csvContent = 'TIME TRACKING REPORT\n\n';
        csvContent += `Report Name,${report.name}\n`;
        csvContent += `Generated Date,${formatDate(report.generatedDate)}\n`;
        csvContent += `Total Projects,${report.projectsCount}\n`;
        csvContent += `Total Hours,${report.totalHours?.toFixed(2)}h\n`;
        csvContent += `Total Employees,${report.employeeData.length}\n\n`;
        
        csvContent += 'EMPLOYEE TIME TRACKING\n';
        csvContent += 'Employee Name,Total Hours,Regular Hours,Overtime Hours,Days Worked,Avg Hours/Day,Entries\n';
        report.employeeData.forEach(emp => {
          csvContent += `${emp.employeeName},${emp.totalHours.toFixed(2)},${emp.regularHours.toFixed(2)},${emp.overtimeHours.toFixed(2)},${emp.totalDays},${emp.averageHoursPerDay.toFixed(2)},${emp.clockEntries.length}\n`;
        });
      } else if (report.type === 'custom') {
        try {
          const data = JSON.parse(report.notes || '{}') as { dailyLogs?: Array<{ projectId: string; projectName: string; logs: DailyLog[] }> };
          if (data.dailyLogs) {
            csvContent = 'DAILY LOGS REPORT\n\n';
            csvContent += `Report Name,${report.name}\n`;
            csvContent += `Generated Date,${formatDate(report.generatedDate)}\n\n`;
            
            data.dailyLogs.forEach(projectLogs => {
              csvContent += `\nPROJECT: ${projectLogs.projectName}\n`;
              csvContent += 'Date,Work Performed,Issues,Notes\n';
              projectLogs.logs.forEach(log => {
                const date = new Date(log.logDate).toLocaleDateString();
                const work = (log.workPerformed || '').replace(/,/g, ';');
                const issues = (log.issues || '').replace(/,/g, ';');
                const notes = (log.generalNotes || '').replace(/,/g, ';');
                csvContent += `${date},"${work}","${issues}","${notes}"\n`;
              });
            });
          } else {
            csvContent = 'CUSTOM AI REPORT\n\n';
            csvContent += `Report Name,${report.name}\n`;
            csvContent += `Generated Date,${formatDate(report.generatedDate)}\n\n`;
            csvContent += 'REPORT CONTENT\n';
            csvContent += report.notes || '';
          }
        } catch {
          csvContent = 'CUSTOM AI REPORT\n\n';
          csvContent += `Report Name,${report.name}\n`;
          csvContent += `Generated Date,${formatDate(report.generatedDate)}\n\n`;
          csvContent += 'REPORT CONTENT\n';
          csvContent += report.notes || '';
        }
      } else {
        csvContent = 'PROJECT REPORT\n\n';
        csvContent += `Report Name,${report.name}\n`;
        csvContent += `Generated Date,${formatDate(report.generatedDate)}\n`;
        csvContent += `Total Projects,${report.projectsCount}\n`;
        csvContent += `Total Budget,${(report.totalBudget ?? 0).toLocaleString()}\n`;
        csvContent += `Total Expenses,${(report.totalExpenses ?? 0).toLocaleString()}\n`;
        csvContent += `Total Hours,${report.totalHours ?? 0}h\n\n`;
        
        if (report.projects) {
          csvContent += 'PROJECT DETAILS\n';
          csvContent += 'Project Name,Budget,Expenses,Hours,Status,Progress\n';
          report.projects.forEach(project => {
            csvContent += `${project.projectName},${project.budget.toLocaleString()},${project.expenses.toLocaleString()},${project.hoursWorked}h,${project.status},${project.progress}%\n`;
          });
        }
      }

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${report.name.replace(/[^a-z0-9]/gi, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', 'Report exported successfully!');
      } else {
        const fileName = `${report.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
        const file = new File(Paths.cache, fileName);
        file.write(csvContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri);
        } else {
          Alert.alert('Success', `Report saved to: ${file.uri}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToHTML = async (report: Report) => {
    try {
      setIsExporting(true);
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1F2937;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #F3F4F6;
    }
    .header {
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      margin: 5px 0;
      opacity: 0.9;
    }
    .section {
      background: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #2563EB;
      font-size: 20px;
      margin: 0 0 16px 0;
      padding-bottom: 12px;
      border-bottom: 2px solid #E5E7EB;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #F9FAFB;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #2563EB;
    }
    .stat-label {
      font-size: 13px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #1F2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th {
      background: #F3F4F6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #E5E7EB;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    tr:hover {
      background: #F9FAFB;
    }
    .project-card {
      background: #F9FAFB;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 4px solid #10B981;
    }
    .project-card h3 {
      margin: 0 0 12px 0;
      color: #1F2937;
    }
    .project-detail {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      padding: 6px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    .project-detail:last-child {
      border-bottom: none;
    }
    .daily-log {
      background: #FFFBEB;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 4px solid #F59E0B;
    }
    .daily-log h4 {
      margin: 0 0 8px 0;
      color: #92400E;
    }
    .daily-log p {
      margin: 8px 0;
      color: #78350F;
    }
    .footer {
      text-align: center;
      color: #6B7280;
      font-size: 13px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    @media print {
      body { background: white; }
      .section { box-shadow: none; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.name}</h1>
    <p><strong>Generated:</strong> ${formatDate(report.generatedDate)}</p>
    <p><strong>Projects Included:</strong> ${report.projectsCount}</p>
  </div>
`;

      if (report.type === 'expenses' && report.expensesByCategory) {
        htmlContent += `
  <div class="section">
    <h2>Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Expenses</div>
        <div class="stat-value">${(report.totalExpenses ?? 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Projects</div>
        <div class="stat-value">${report.projectsCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Categories</div>
        <div class="stat-value">${Object.keys(report.expensesByCategory).length}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Expenses by Category</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: right;">Amount</th>
          <th style="text-align: right;">Percentage</th>
        </tr>
      </thead>
      <tbody>
`;
        const totalExpenses = report.totalExpenses ?? 0;
        Object.entries(report.expensesByCategory).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).forEach(([category, amount]) => {
          const percentage = totalExpenses > 0 ? ((amount ?? 0) / totalExpenses * 100).toFixed(1) : '0';
          htmlContent += `
        <tr>
          <td><strong>${category}</strong></td>
          <td style="text-align: right;">${(amount ?? 0).toLocaleString()}</td>
          <td style="text-align: right;">${percentage}%</td>
        </tr>
`;
        });
        htmlContent += `
      </tbody>
    </table>
  </div>
`;

        if (report.projects && report.projects.length > 0) {
          htmlContent += `
  <div class="section">
    <h2>Project Breakdown (${report.projects.length} Projects)</h2>
`;
          report.projects.forEach(project => {
            const budgetRemaining = project.budget - project.expenses;
            const budgetUsedPercent = project.budget > 0 ? (project.expenses / project.budget * 100).toFixed(1) : '0';
            htmlContent += `
    <div class="project-card">
      <h3>${project.projectName}</h3>
      <div class="project-detail">
        <span>Budget:</span>
        <strong>${project.budget.toLocaleString()}</strong>
      </div>
      <div class="project-detail">
        <span>Expenses:</span>
        <strong style="color: #EF4444;">${project.expenses.toLocaleString()}</strong>
      </div>
      <div class="project-detail">
        <span>Budget Remaining:</span>
        <strong style="color: ${budgetRemaining >= 0 ? '#10B981' : '#EF4444'};">${budgetRemaining.toLocaleString()}</strong>
      </div>
      <div class="project-detail">
        <span>Budget Used:</span>
        <strong>${budgetUsedPercent}%</strong>
      </div>
      <div class="project-detail">
        <span>Status:</span>
        <strong>${project.status}</strong>
      </div>
      <div class="project-detail">
        <span>Progress:</span>
        <strong>${project.progress}%</strong>
      </div>
`;
            if (project.expensesByCategory && Object.keys(project.expensesByCategory).length > 0) {
              htmlContent += `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #E5E7EB;">
        <strong style="font-size: 14px; color: #6B7280;">Category Breakdown:</strong>
        <div style="margin-top: 8px;">
`;
              Object.entries(project.expensesByCategory).forEach(([cat, amt]) => {
                htmlContent += `
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #6B7280;">${cat}:</span>
            <span style="font-weight: 600;">${(amt ?? 0).toLocaleString()}</span>
          </div>
`;
              });
              htmlContent += `
        </div>
      </div>
`;
            }
            htmlContent += `
    </div>
`;
          });
          htmlContent += `
  </div>
`;
        }
      } else if (report.type === 'time-tracking' && report.employeeData) {
        htmlContent += `
  <div class="section">
    <h2>Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Hours</div>
        <div class="stat-value">${report.totalHours?.toFixed(2)}h</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Employees</div>
        <div class="stat-value">${report.employeeData.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Hours/Employee</div>
        <div class="stat-value">${(report.totalHours! / report.employeeData.length).toFixed(2)}h</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Overtime</div>
        <div class="stat-value" style="color: #EF4444;">${report.employeeData.reduce((sum, emp) => sum + emp.overtimeHours, 0).toFixed(2)}h</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Employee Time Details</h2>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th style="text-align: right;">Total Hours</th>
          <th style="text-align: right;">Regular</th>
          <th style="text-align: right;">Overtime</th>
          <th style="text-align: right;">Days</th>
          <th style="text-align: right;">Avg/Day</th>
          <th style="text-align: right;">Entries</th>
        </tr>
      </thead>
      <tbody>
`;
        report.employeeData.forEach(emp => {
          htmlContent += `
        <tr>
          <td><strong>${emp.employeeName}</strong></td>
          <td style="text-align: right;">${emp.totalHours.toFixed(2)}h</td>
          <td style="text-align: right;">${emp.regularHours.toFixed(2)}h</td>
          <td style="text-align: right; color: #EF4444; font-weight: 600;">${emp.overtimeHours.toFixed(2)}h</td>
          <td style="text-align: right;">${emp.totalDays}</td>
          <td style="text-align: right;">${emp.averageHoursPerDay.toFixed(2)}h</td>
          <td style="text-align: right;">${emp.clockEntries.length}</td>
        </tr>
`;
        });
        htmlContent += `
      </tbody>
    </table>
  </div>
`;
      } else if (report.type === 'custom') {
        try {
          const data = JSON.parse(report.notes || '{}') as { dailyLogs?: Array<{ projectId: string; projectName: string; logs: DailyLog[] }> };
          if (data.dailyLogs) {
            htmlContent += `
  <div class="section">
    <h2>Daily Logs Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Projects</div>
        <div class="stat-value">${data.dailyLogs.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Log Entries</div>
        <div class="stat-value">${data.dailyLogs.reduce((sum, p) => sum + p.logs.length, 0)}</div>
      </div>
    </div>
  </div>
`;
            data.dailyLogs.forEach(projectLogs => {
              htmlContent += `
  <div class="section">
    <h2>${projectLogs.projectName}</h2>
    <p style="color: #6B7280; margin-bottom: 20px;">${projectLogs.logs.length} log entries</p>
`;
              projectLogs.logs.forEach(log => {
                const logDate = new Date(log.logDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                htmlContent += `
    <div class="daily-log">
      <h4>${logDate}</h4>
`;
                if (log.workPerformed) {
                  htmlContent += `
      <p><strong style="color: #92400E;">Work Performed:</strong><br>${log.workPerformed.replace(/\n/g, '<br>')}</p>
`;
                }
                if (log.issues) {
                  htmlContent += `
      <p><strong style="color: #92400E;">Issues/Notes:</strong><br>${log.issues.replace(/\n/g, '<br>')}</p>
`;
                }
                if (log.generalNotes) {
                  htmlContent += `
      <p><strong style="color: #92400E;">Additional Notes:</strong><br>${log.generalNotes.replace(/\n/g, '<br>')}</p>
`;
                }
                if (log.tasks && log.tasks.length > 0) {
                  htmlContent += `
      <div style="margin-top: 12px;">
        <strong style="color: #92400E;">Tasks:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
`;
                  log.tasks.forEach(task => {
                    htmlContent += `
          <li style="color: #78350F; ${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
            ${task.completed ? '✓' : '○'} ${task.description}
          </li>
`;
                  });
                  htmlContent += `
        </ul>
      </div>
`;
                }
                htmlContent += `
    </div>
`;
              });
              htmlContent += `
  </div>
`;
            });
          } else {
            htmlContent += `
  <div class="section">
    <h2>AI Generated Report</h2>
    <div style="line-height: 1.8; white-space: pre-wrap;">${(report.notes || '').replace(/\n/g, '<br>')}</div>
  </div>
`;
          }
        } catch {
          htmlContent += `
  <div class="section">
    <h2>AI Generated Report</h2>
    <div style="line-height: 1.8; white-space: pre-wrap;">${(report.notes || '').replace(/\n/g, '<br>')}</div>
  </div>
`;
        }
      } else {
        htmlContent += `
  <div class="section">
    <h2>Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Projects</div>
        <div class="stat-value">${report.projectsCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Budget</div>
        <div class="stat-value">${(report.totalBudget ?? 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Expenses</div>
        <div class="stat-value">${(report.totalExpenses ?? 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Hours</div>
        <div class="stat-value">${report.totalHours ?? 0}h</div>
      </div>
    </div>
  </div>
`;

        if (report.projects && report.projects.length > 0) {
          htmlContent += `
  <div class="section">
    <h2>Project Details</h2>
`;
          report.projects.forEach(project => {
            htmlContent += `
    <div class="project-card">
      <h3>${project.projectName}</h3>
      <div class="project-detail">
        <span>Budget:</span>
        <strong>${project.budget.toLocaleString()}</strong>
      </div>
      <div class="project-detail">
        <span>Expenses:</span>
        <strong>${project.expenses.toLocaleString()}</strong>
      </div>
      <div class="project-detail">
        <span>Hours Worked:</span>
        <strong>${project.hoursWorked}h</strong>
      </div>
      <div class="project-detail">
        <span>Status:</span>
        <strong>${project.status}</strong>
      </div>
      <div class="project-detail">
        <span>Progress:</span>
        <strong>${project.progress}%</strong>
      </div>
    </div>
`;
          });
          htmlContent += `
  </div>
`;
        }
      }

      htmlContent += `
  <div class="footer">
    <p>Report generated on ${formatDate(report.generatedDate)}</p>
    <p>Construction Management System</p>
  </div>
</body>
</html>
`;

      if (Platform.OS === 'web') {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${report.name.replace(/[^a-z0-9]/gi, '_')}.html`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', 'Report exported as HTML successfully! You can open it in a browser and print to PDF.');
      } else {
        const fileName = `${report.name.replace(/[^a-z0-9]/gi, '_')}.html`;
        const file = new File(Paths.cache, fileName);
        file.write(htmlContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri);
        } else {
          Alert.alert('Success', `Report saved to: ${file.uri}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
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
              <View style={styles.modalHeaderActions}>
                {isExporting ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 12 }} />
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.exportButton}
                      onPress={() => selectedReport && exportToCSV(selectedReport)}
                      disabled={isExporting}
                    >
                      <FileSpreadsheet size={20} color="#10B981" />
                      <Text style={styles.exportButtonText}>Excel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.exportButton}
                      onPress={() => selectedReport && exportToHTML(selectedReport)}
                      disabled={isExporting}
                    >
                      <Download size={20} color="#2563EB" />
                      <Text style={styles.exportButtonText}>PDF</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedReport && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{selectedReport.name}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.type === 'custom' ? 'Daily Logs' : 
                       selectedReport.type === 'time-tracking' ? 'Time Tracking' :
                       selectedReport.type.charAt(0).toUpperCase() + selectedReport.type.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Generated:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedReport.generatedDate)}
                    </Text>
                  </View>
                </View>

                {selectedReport.type === 'expenses' && selectedReport.expensesByCategory ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Expenses by Category</Text>
                    <View style={styles.expensesCategoryBreakdown}>
                      {Object.entries(selectedReport.expensesByCategory).map(([category, amount]) => (
                        <View key={category} style={styles.expensesCategoryRow}>
                          <Text style={styles.expensesCategoryLabel}>{category}:</Text>
                          <Text style={styles.expensesCategoryValue}>
                            ${(amount ?? 0).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.expensesTotalRow}>
                      <Text style={styles.expensesTotalLabel}>Total Expenses:</Text>
                      <Text style={styles.expensesTotalValue}>
                        ${(selectedReport.totalExpenses ?? 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ) : selectedReport.type === 'time-tracking' && selectedReport.employeeData ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Employee Time Tracking</Text>
                    <View style={styles.employeeTimeSection}>
                      <View style={styles.timeTrackingSummary}>
                        <View style={styles.timeTrackingStat}>
                          <Text style={styles.timeTrackingStatLabel}>Total Hours</Text>
                          <Text style={styles.timeTrackingStatValue}>{selectedReport.totalHours?.toFixed(2)}h</Text>
                        </View>
                        <View style={styles.timeTrackingStat}>
                          <Text style={styles.timeTrackingStatLabel}>Employees</Text>
                          <Text style={styles.timeTrackingStatValue}>{selectedReport.employeeData.length}</Text>
                        </View>
                      </View>

                      {selectedReport.employeeData.map((employee) => (
                        <View key={employee.employeeId} style={styles.employeeCard}>
                          <Text style={styles.employeeName}>{employee.employeeName}</Text>
                          <View style={styles.employeeStatsGrid}>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Total Hours</Text>
                              <Text style={styles.employeeStatValue}>{employee.totalHours.toFixed(2)}h</Text>
                            </View>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Regular</Text>
                              <Text style={styles.employeeStatValue}>{employee.regularHours.toFixed(2)}h</Text>
                            </View>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Overtime</Text>
                              <Text style={[styles.employeeStatValue, { color: '#EF4444' }]}>
                                {employee.overtimeHours.toFixed(2)}h
                              </Text>
                            </View>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Days Worked</Text>
                              <Text style={styles.employeeStatValue}>{employee.totalDays}</Text>
                            </View>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Avg Hours/Day</Text>
                              <Text style={styles.employeeStatValue}>
                                {employee.averageHoursPerDay.toFixed(2)}h
                              </Text>
                            </View>
                            <View style={styles.employeeStat}>
                              <Text style={styles.employeeStatLabel}>Entries</Text>
                              <Text style={styles.employeeStatValue}>{employee.clockEntries.length}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : selectedReport.type === 'custom' && selectedReport.notes ? (
                  <View style={styles.detailSection}>
                    {(() => {
                      try {
                        const data = JSON.parse(selectedReport.notes) as { dailyLogs: Array<{ projectId: string; projectName: string; logs: DailyLog[] }> };
                        return (
                          <>
                            <Text style={styles.detailSectionTitle}>Daily Logs</Text>
                            {data.dailyLogs.map((projectLogs) => (
                          <View key={projectLogs.projectId} style={styles.projectLogsSection}>
                            <Text style={styles.projectLogsTitle}>{projectLogs.projectName}</Text>
                            <Text style={styles.projectLogsCount}>{projectLogs.logs.length} log(s)</Text>
                            {projectLogs.logs.map((log) => (
                              <View key={log.id} style={styles.dailyLogCard}>
                                <Text style={styles.dailyLogDate}>
                                  {new Date(log.logDate).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </Text>
                                {log.workPerformed && (
                                  <View style={styles.dailyLogSection}>
                                    <Text style={styles.dailyLogSectionTitle}>Work Performed:</Text>
                                    <Text style={styles.dailyLogText}>{log.workPerformed}</Text>
                                  </View>
                                )}
                                {log.issues && (
                                  <View style={styles.dailyLogSection}>
                                    <Text style={styles.dailyLogSectionTitle}>Issues/Notes:</Text>
                                    <Text style={styles.dailyLogText}>{log.issues}</Text>
                                  </View>
                                )}
                                {log.generalNotes && (
                                  <View style={styles.dailyLogSection}>
                                    <Text style={styles.dailyLogSectionTitle}>Additional Notes:</Text>
                                    <Text style={styles.dailyLogText}>{log.generalNotes}</Text>
                                  </View>
                                )}
                                {log.tasks && log.tasks.length > 0 && (
                                  <View style={styles.dailyLogSection}>
                                    <Text style={styles.dailyLogSectionTitle}>Tasks:</Text>
                                    {log.tasks.map((task) => (
                                      <View key={task.id} style={styles.reminderRow}>
                                        <Text style={styles.reminderStatus}>{task.completed ? '✓' : '○'}</Text>
                                        <View style={{ flex: 1 }}>
                                          <Text style={[styles.reminderText, task.completed && styles.reminderTextCompleted]}>
                                            {task.description}
                                          </Text>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        ))}
                          </>
                        );
                      } catch {
                        return (
                          <>
                            <Text style={styles.detailSectionTitle}>AI Generated Report</Text>
                            <View style={styles.aiReportContent}>
                              <Text style={styles.aiReportText}>{selectedReport.notes}</Text>
                            </View>
                          </>
                        );
                      }
                    })()}
                  </View>
                ) : (
                  <>
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
                  </>
                )}
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
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
  projectLogsSection: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  projectLogsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  projectLogsCount: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  dailyLogCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  dailyLogDate: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  dailyLogRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dailyLogLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
    width: 90,
  },
  dailyLogValue: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  dailyLogSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dailyLogSectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  dailyLogText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  reminderStatus: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700' as const,
    marginTop: 2,
  },
  reminderText: {
    fontSize: 13,
    color: '#1F2937',
  },
  reminderTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  reminderTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    padding: 20,
  },
  expensesCategoryBreakdown: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  expensesTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  expensesTotalLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  expensesTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  employeeTimeSection: {
    gap: 12,
  },
  timeTrackingSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeTrackingStat: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeTrackingStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timeTrackingStatValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  employeeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  employeeStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  employeeStat: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  employeeStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  employeeStatValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  aiReportContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiReportText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
  },
});
