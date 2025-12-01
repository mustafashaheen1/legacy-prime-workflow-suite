import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Clock, CheckCircle, Coffee, FileText, Calendar, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

import { ClockEntry, Report, EmployeeTimeData } from '@/types';

const WORK_CATEGORIES = [
  'Framing',
  'Drywall',
  'Electrical',
  'Plumbing',
  'Painting',
  'Flooring',
  'Roofing',
  'HVAC',
  'Carpentry',
  'Concrete',
  'Demolition',
  'Site Work',
  'General Labor',
  'Other',
];

interface ClockInOutComponentProps {
  projectId: string;
  projectName: string;
  compact?: boolean;
}

export default function ClockInOutComponent({ projectId, projectName, compact = false }: ClockInOutComponentProps) {
  const { clockEntries, addClockEntry, updateClockEntry, user, updateProject } = useApp();
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showClockOutModal, setShowClockOutModal] = useState<boolean>(false);
  const [workPerformed, setWorkPerformed] = useState<string>('');
  const [showClockInModal, setShowClockInModal] = useState<boolean>(false);
  const [clockInCategory, setClockInCategory] = useState<string>('');
  const [clockInDescription, setClockInDescription] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    requestLocationPermission();
    checkActiveEntry();
  }, [projectId, clockEntries, user]);

  const checkActiveEntry = () => {
    const activeEntry = clockEntries.find(
      (entry) => entry.projectId === projectId && entry.employeeId === user?.id && !entry.clockOut
    );
    if (activeEntry) {
      setCurrentEntry(activeEntry);
    }
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'web') {
      try {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              console.error('Error getting location:', error);
              setLocation({ latitude: 0, longitude: 0 });
            }
          );
        } else {
          setLocation({ latitude: 0, longitude: 0 });
        }
      } catch (error) {
        console.error('Error getting location:', error);
        setLocation({ latitude: 0, longitude: 0 });
      }
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } else {
        setLocation({ latitude: 0, longitude: 0 });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation({ latitude: 0, longitude: 0 });
    }
  };

  const handleClockIn = () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to clock in');
      return;
    }
    setShowClockInModal(true);
  };

  const completeClockIn = () => {
    if (!user || !clockInCategory) return;

    const entry: ClockEntry = {
      id: Date.now().toString(),
      employeeId: user.id,
      projectId,
      clockIn: new Date().toISOString(),
      location: location || { latitude: 0, longitude: 0 },
      category: clockInCategory,
      workPerformed: clockInDescription,
    };

    addClockEntry(entry);
    setCurrentEntry(entry);
    console.log(`[Clock In] ${user.name} clocked in to ${projectName} at ${new Date().toLocaleTimeString()}`);
    console.log(`[Clock In] Category: ${clockInCategory}`);
    console.log(`[Clock In] Description: ${clockInDescription || 'N/A'}`);
    
    setShowClockInModal(false);
    setClockInCategory('');
    setClockInDescription('');
  };

  const handleClockOut = () => {
    if (!currentEntry) return;
    setShowClockOutModal(true);
  };

  const completeClockOut = () => {
    if (!currentEntry) return;

    const clockOutTime = new Date().toISOString();
    const clockInDate = new Date(currentEntry.clockIn);
    const clockOutDate = new Date(clockOutTime);
    let totalMs = clockOutDate.getTime() - clockInDate.getTime();
    
    if (currentEntry.lunchBreaks) {
      currentEntry.lunchBreaks.forEach(lunch => {
        const lunchStart = new Date(lunch.startTime).getTime();
        const lunchEnd = lunch.endTime ? new Date(lunch.endTime).getTime() : clockOutDate.getTime();
        totalMs -= (lunchEnd - lunchStart);
      });
    }
    
    const hoursWorked = totalMs / (1000 * 60 * 60);

    updateClockEntry(currentEntry.id, {
      clockOut: clockOutTime,
      workPerformed,
      category: selectedCategory || 'General Labor',
    });

    updateProject(projectId, {
      hoursWorked: hoursWorked,
    });

    console.log(`[Clock Out] ${user?.name} clocked out from ${projectName}`);
    console.log(`[Clock Out] Hours worked (excluding lunch): ${hoursWorked.toFixed(2)}h`);
    console.log(`[Clock Out] Category: ${selectedCategory || 'General Labor'}`);
    console.log(`[Clock Out] Work performed: ${workPerformed || 'N/A'}`);

    setCurrentEntry(null);
    setWorkPerformed('');
    setSelectedCategory('');
    setShowClockOutModal(false);
    Alert.alert('Success', `Clocked out successfully. Total hours: ${hoursWorked.toFixed(2)}h`);
  };

  const isOnLunch = () => {
    if (!currentEntry?.lunchBreaks) return false;
    return currentEntry.lunchBreaks.some(lunch => !lunch.endTime);
  };

  const handleLunchStart = () => {
    if (!currentEntry) return;
    
    const lunchBreak = {
      startTime: new Date().toISOString(),
    };
    
    const updatedLunchBreaks = [...(currentEntry.lunchBreaks || []), lunchBreak];
    
    updateClockEntry(currentEntry.id, {
      lunchBreaks: updatedLunchBreaks,
    });
    
    setCurrentEntry({
      ...currentEntry,
      lunchBreaks: updatedLunchBreaks,
    });
    
    console.log(`[Lunch] ${user?.name} started lunch break at ${new Date().toLocaleTimeString()}`);
    Alert.alert('Lunch Break', 'Lunch break started. Time won\'t count towards payroll.');
  };

  const handleLunchEnd = () => {
    if (!currentEntry?.lunchBreaks) return;
    
    const activeLunchIndex = currentEntry.lunchBreaks.findIndex(lunch => !lunch.endTime);
    if (activeLunchIndex === -1) return;
    
    const updatedLunchBreaks = [...currentEntry.lunchBreaks];
    updatedLunchBreaks[activeLunchIndex] = {
      ...updatedLunchBreaks[activeLunchIndex],
      endTime: new Date().toISOString(),
    };
    
    updateClockEntry(currentEntry.id, {
      lunchBreaks: updatedLunchBreaks,
    });
    
    setCurrentEntry({
      ...currentEntry,
      lunchBreaks: updatedLunchBreaks,
    });
    
    const lunchStart = new Date(updatedLunchBreaks[activeLunchIndex].startTime);
    const lunchEnd = new Date(updatedLunchBreaks[activeLunchIndex].endTime!);
    const lunchDuration = ((lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60)).toFixed(0);
    
    console.log(`[Lunch] ${user?.name} ended lunch break at ${new Date().toLocaleTimeString()}`);
    console.log(`[Lunch] Duration: ${lunchDuration} minutes`);
    Alert.alert('Back to Work', `Lunch break ended. Duration: ${lunchDuration} minutes`);
  };

  const calculateCurrentHours = () => {
    if (!currentEntry) return 0;
    const start = new Date(currentEntry.clockIn);
    const now = new Date();
    let totalMs = now.getTime() - start.getTime();
    
    if (currentEntry.lunchBreaks) {
      currentEntry.lunchBreaks.forEach(lunch => {
        const lunchStart = new Date(lunch.startTime).getTime();
        const lunchEnd = lunch.endTime ? new Date(lunch.endTime).getTime() : now.getTime();
        totalMs -= (lunchEnd - lunchStart);
      });
    }
    
    return totalMs / (1000 * 60 * 60);
  };

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');

  const getWeekDates = (weeksAgo: number = 0) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff - (weeksAgo * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday.toISOString(), end: sunday.toISOString() };
  };

  const setDateRange = (type: 'current' | 'last' | 'custom') => {
    if (type === 'current') {
      const { start, end } = getWeekDates(0);
      setReportStartDate(start);
      setReportEndDate(end);
    } else if (type === 'last') {
      const { start, end } = getWeekDates(1);
      setReportStartDate(start);
      setReportEndDate(end);
    }
  };

  const generateWeeklyReport = () => {
    if (!reportStartDate || !reportEndDate) {
      Alert.alert('Error', 'Please select a date range');
      return;
    }

    if (!user) return;

    const startDate = new Date(reportStartDate);
    const endDate = new Date(reportEndDate);

    const employeeEntries = clockEntries.filter(entry => {
      const entryDate = new Date(entry.clockIn);
      return entry.employeeId === user.id && 
             entry.projectId === projectId && 
             entryDate >= startDate && 
             entryDate <= endDate;
    });

    const calculateHours = (entry: ClockEntry) => {
      if (!entry.clockOut) return 0;
      const start = new Date(entry.clockIn).getTime();
      const end = new Date(entry.clockOut).getTime();
      let totalMs = end - start;

      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          if (lunch.endTime) {
            const lunchStart = new Date(lunch.startTime).getTime();
            const lunchEnd = new Date(lunch.endTime).getTime();
            totalMs -= (lunchEnd - lunchStart);
          }
        });
      }

      return totalMs / (1000 * 60 * 60);
    };

    const totalHours = employeeEntries.reduce((sum, entry) => sum + calculateHours(entry), 0);
    const regularHours = Math.min(totalHours, 40);
    const overtimeHours = Math.max(0, totalHours - 40);

    const uniqueDays = new Set(
      employeeEntries.map(entry => new Date(entry.clockIn).toDateString())
    ).size;

    const employeeData: EmployeeTimeData = {
      employeeId: user.id,
      employeeName: user.name,
      totalHours: totalHours,
      regularHours: regularHours,
      overtimeHours: overtimeHours,
      totalDays: uniqueDays,
      averageHoursPerDay: uniqueDays > 0 ? totalHours / uniqueDays : 0,
      clockEntries: employeeEntries,
    };

    const report: Report = {
      id: `report-${Date.now()}`,
      name: `Weekly Hours Report - ${user.name} - ${projectName}`,
      type: 'time-tracking',
      generatedDate: new Date().toISOString(),
      projectIds: [projectId],
      dateRange: {
        startDate: reportStartDate,
        endDate: reportEndDate,
      },
      employeeData: [employeeData],
      employeeIds: [user.id],
      totalHours: totalHours,
    };

    addReport(report);

    console.log('[Report] Weekly hours report generated');
    console.log(`  Employee: ${user.name}`);
    console.log(`  Project: ${projectName}`);
    console.log(`  Date Range: ${new Date(reportStartDate).toLocaleDateString()} - ${new Date(reportEndDate).toLocaleDateString()}`);
    console.log(`  Total Hours: ${totalHours.toFixed(2)}h`);
    console.log(`  Regular Hours: ${regularHours.toFixed(2)}h`);
    console.log(`  Overtime Hours: ${overtimeHours.toFixed(2)}h`);
    console.log(`  Days Worked: ${uniqueDays}`);

    Alert.alert(
      'Report Generated',
      `Weekly hours report saved successfully.\n\nTotal Hours: ${totalHours.toFixed(2)}h\nRegular: ${regularHours.toFixed(2)}h\nOvertime: ${overtimeHours.toFixed(2)}h`,
      [{ text: 'OK', onPress: () => setShowReportModal(false) }]
    );
  };

  const todayEntries = clockEntries.filter((entry) => {
    const entryDate = new Date(entry.clockIn).toDateString();
    const today = new Date().toDateString();
    return entryDate === today && entry.projectId === projectId;
  });

  const totalHoursToday = todayEntries.reduce((sum, entry) => {
    const start = new Date(entry.clockIn);
    const end = entry.clockOut ? new Date(entry.clockOut) : new Date();
    let totalMs = end.getTime() - start.getTime();
    
    if (entry.lunchBreaks) {
      entry.lunchBreaks.forEach(lunch => {
        const lunchStart = new Date(lunch.startTime).getTime();
        const lunchEnd = lunch.endTime ? new Date(lunch.endTime).getTime() : new Date().getTime();
        totalMs -= (lunchEnd - lunchStart);
      });
    }
    
    return sum + totalMs / (1000 * 60 * 60);
  }, 0);

  const { addReport } = useApp();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Clock size={24} color="#2563EB" />
          <Text style={styles.compactTitle}>Quick Clock</Text>
        </View>

        {currentEntry ? (
          <View style={styles.activeSession}>
            <View style={styles.activeIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeText}>Active Session</Text>
            </View>
            <Text style={styles.clockedInTime}>
              Clocked in: {new Date(currentEntry.clockIn).toLocaleTimeString()}
            </Text>
            {currentEntry.category && (
              <Text style={styles.categoryBadge}>{currentEntry.category}</Text>
            )}
            {currentEntry.workPerformed && (
              <Text style={styles.workDescription}>{currentEntry.workPerformed}</Text>
            )}
            <Text style={styles.currentHours}>{calculateCurrentHours().toFixed(2)}h elapsed</Text>
            
            <View style={styles.lunchButtonsRow}>
              {isOnLunch() ? (
                <TouchableOpacity style={styles.lunchEndButton} onPress={handleLunchEnd}>
                  <Coffee size={16} color="#FFFFFF" />
                  <Text style={styles.lunchButtonText}>End Lunch</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.lunchStartButton} onPress={handleLunchStart}>
                  <Coffee size={16} color="#FFFFFF" />
                  <Text style={styles.lunchButtonText}>Start Lunch</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.clockOutButtonCompact} onPress={handleClockOut}>
                <Text style={styles.clockOutButtonText}>Clock Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.clockInButtonCompact} onPress={handleClockIn}>
            <Text style={styles.clockInButtonText}>Clock In</Text>
          </TouchableOpacity>
        )}

        <Modal visible={showClockOutModal} animationType="slide" transparent onRequestClose={() => setShowClockOutModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Clock Out Summary</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Work Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {WORK_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>What work was performed?</Text>
                <TextInput
                  style={styles.textArea}
                  value={workPerformed}
                  onChangeText={setWorkPerformed}
                  placeholder="Describe the work completed..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Hours Worked</Text>
                <Text style={styles.summaryValue}>{calculateCurrentHours().toFixed(2)}h</Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowClockOutModal(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, !selectedCategory && styles.confirmButtonDisabled]}
                  onPress={completeClockOut}
                  disabled={!selectedCategory}
                >
                  <Text style={styles.confirmButtonText}>Complete Clock Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Clock size={28} color="#2563EB" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Time Tracking</Text>
            <Text style={styles.headerSubtitle}>{projectName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.employeeCard}>
        <Text style={styles.cardLabel}>Employee</Text>
        <Text style={styles.cardValue}>{user?.name || 'Unknown Employee'}</Text>
      </View>

      {currentEntry ? (
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View style={styles.activeIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeText}>Currently Clocked In</Text>
            </View>
            <Text style={styles.activeTime}>{calculateCurrentHours().toFixed(2)}h</Text>
          </View>
          <Text style={styles.clockedInTime}>Started: {new Date(currentEntry.clockIn).toLocaleTimeString()}</Text>
          {currentEntry.category && (
            <View style={styles.activeInfoRow}>
              <Text style={styles.activeInfoLabel}>Category:</Text>
              <Text style={styles.activeInfoValue}>{currentEntry.category}</Text>
            </View>
          )}
          {currentEntry.workPerformed && (
            <View style={styles.activeInfoRow}>
              <Text style={styles.activeInfoLabel}>Working on:</Text>
              <Text style={styles.activeInfoValue}>{currentEntry.workPerformed}</Text>
            </View>
          )}
          
          {isOnLunch() && (
            <View style={styles.lunchIndicator}>
              <Coffee size={16} color="#F59E0B" />
              <Text style={styles.lunchIndicatorText}>On Lunch Break</Text>
            </View>
          )}
          
          <View style={styles.buttonRow}>
            {isOnLunch() ? (
              <TouchableOpacity style={styles.lunchEndButtonLarge} onPress={handleLunchEnd}>
                <Coffee size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>End Lunch</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.lunchStartButtonLarge} onPress={handleLunchStart}>
                <Coffee size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Start Lunch</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.clockOutButton} onPress={handleClockOut}>
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.clockOutButtonText}>Clock Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.clockInButton} onPress={handleClockIn}>
          <Clock size={24} color="#FFFFFF" />
          <Text style={styles.clockInButtonText}>Clock In</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Today&apos;s Summary</Text>
          <TouchableOpacity 
            style={styles.reportButton}
            onPress={() => setShowReportModal(true)}
          >
            <FileText size={18} color="#2563EB" />
            <Text style={styles.reportButtonText}>Weekly Report</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Hours</Text>
            <Text style={styles.statValue}>{totalHoursToday.toFixed(2)}h</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{todayEntries.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Today&apos;s Clock History</Text>
        {todayEntries.length > 0 ? (
          todayEntries.map((entry) => {
            const start = new Date(entry.clockIn);
            const end = entry.clockOut ? new Date(entry.clockOut) : null;
            const hours = end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60) : 0;

            const lunchMinutes = entry.lunchBreaks?.reduce((sum, lunch) => {
              const lunchStart = new Date(lunch.startTime).getTime();
              const lunchEnd = lunch.endTime ? new Date(lunch.endTime).getTime() : new Date().getTime();
              return sum + (lunchEnd - lunchStart) / (1000 * 60);
            }, 0) || 0;

            return (
              <View key={entry.id} style={styles.historyEntry}>
                <View style={styles.historyTime}>
                  <Text style={styles.historyTimeText}>
                    {start.toLocaleTimeString()} - {end ? end.toLocaleTimeString() : 'Active'}
                  </Text>
                  {entry.clockOut && <Text style={styles.historyHours}>{hours.toFixed(2)}h</Text>}
                </View>
                {entry.category && <Text style={styles.historyCategory}>{entry.category}</Text>}
                {lunchMinutes > 0 && (
                  <Text style={styles.historyLunch}>Lunch: {lunchMinutes.toFixed(0)} min</Text>
                )}
                {entry.workPerformed && <Text style={styles.historyWork}>{entry.workPerformed}</Text>}
                {entry.location && entry.location.latitude !== 0 && entry.location.longitude !== 0 && (
                  <View style={styles.locationContainer}>
                    <View style={styles.locationHeader}>
                      <MapPin size={14} color="#6B7280" />
                      <Text style={styles.locationText}>
                        {entry.location.latitude.toFixed(6)}, {entry.location.longitude.toFixed(6)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.mapContainer}
                      onPress={() => {
                        const mapsUrl = Platform.select({
                          ios: `maps:0,0?q=${entry.location.latitude},${entry.location.longitude}`,
                          android: `geo:0,0?q=${entry.location.latitude},${entry.location.longitude}`,
                          web: `https://www.google.com/maps/search/?api=1&query=${entry.location.latitude},${entry.location.longitude}`,
                        });
                        if (Platform.OS === 'web') {
                          window.open(mapsUrl, '_blank');
                        } else {
                          console.log('[Location] Opening maps:', mapsUrl);
                        }
                      }}
                    >
                      <View style={styles.mapPlaceholder}>
                        <MapPin size={32} color="#2563EB" />
                        <Text style={styles.mapPlaceholderText}>Tap to view on map</Text>
                        <Text style={styles.mapPlaceholderCoords}>
                          {entry.location.latitude.toFixed(4)}, {entry.location.longitude.toFixed(4)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.noDataText}>No clock entries today</Text>
        )}
      </View>

      <Modal visible={showClockInModal} animationType="slide" transparent onRequestClose={() => setShowClockInModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clock In</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Work Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {WORK_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, clockInCategory === category && styles.categoryChipActive]}
                    onPress={() => setClockInCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, clockInCategory === category && styles.categoryChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>What will you be working on?</Text>
              <TextInput
                style={styles.textArea}
                value={clockInDescription}
                onChangeText={setClockInDescription}
                placeholder="Brief description of the work..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowClockInModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !clockInCategory && styles.confirmButtonDisabled]}
                onPress={completeClockIn}
                disabled={!clockInCategory}
              >
                <Text style={styles.confirmButtonText}>Start Clock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClockOutModal} animationType="slide" transparent onRequestClose={() => setShowClockOutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clock Out Summary</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Work Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {WORK_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>What work was performed?</Text>
              <TextInput
                style={styles.textArea}
                value={workPerformed}
                onChangeText={setWorkPerformed}
                placeholder="Describe the work completed..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Hours Worked</Text>
              <Text style={styles.summaryValue}>{calculateCurrentHours().toFixed(2)}h</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowClockOutModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !selectedCategory && styles.confirmButtonDisabled]}
                onPress={completeClockOut}
                disabled={!selectedCategory}
              >
                <Text style={styles.confirmButtonText}>Complete Clock Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Weekly Hours Report</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Time Period</Text>
              <View style={styles.dateRangeButtons}>
                <TouchableOpacity 
                  style={styles.dateRangeButton}
                  onPress={() => setDateRange('current')}
                >
                  <Calendar size={18} color="#2563EB" />
                  <Text style={styles.dateRangeButtonText}>Current Week</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.dateRangeButton}
                  onPress={() => setDateRange('last')}
                >
                  <Calendar size={18} color="#2563EB" />
                  <Text style={styles.dateRangeButtonText}>Last Week</Text>
                </TouchableOpacity>
              </View>
            </View>

            {reportStartDate && reportEndDate && (
              <View style={styles.selectedDateRange}>
                <Text style={styles.selectedDateLabel}>Selected Range:</Text>
                <Text style={styles.selectedDateText}>
                  {new Date(reportStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' - '}
                  {new Date(reportEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                setShowReportModal(false);
                setReportStartDate('');
                setReportEndDate('');
              }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, (!reportStartDate || !reportEndDate) && styles.confirmButtonDisabled]}
                onPress={generateWeeklyReport}
                disabled={!reportStartDate || !reportEndDate}
              >
                <Text style={styles.confirmButtonText}>Generate Report</Text>
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
  },
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  activeCard: {
    backgroundColor: '#DCFCE7',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  activeTime: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  clockedInTime: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  clockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#10B981',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  clockInButtonCompact: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clockInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  clockOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 8,
  },
  clockOutButtonCompact: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  clockOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  historyEntry: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTimeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  historyHours: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  historyCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  historyWork: {
    fontSize: 12,
    color: '#4B5563',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
    textAlign: 'center',
    paddingVertical: 20,
  },
  activeSession: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
  },
  currentHours: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#10B981',
    marginVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  summaryBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  workDescription: {
    fontSize: 12,
    color: '#4B5563',
    marginVertical: 4,
  },
  activeInfoRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  activeInfoLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#059669',
  },
  activeInfoValue: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  lunchButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  lunchStartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
  },
  lunchEndButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
  },
  lunchStartButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 8,
  },
  lunchEndButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
  },
  lunchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  lunchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  lunchIndicatorText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#D97706',
  },
  historyLunch: {
    fontSize: 12,
    color: '#F59E0B',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  dateRangeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dateRangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  dateRangeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  selectedDateRange: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  selectedDateLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 6,
  },
  selectedDateText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  locationContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  mapContainer: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  mapPlaceholderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginTop: 8,
  },
  mapPlaceholderCoords: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
});
