import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { Appointment, Client } from '@/types';

interface Props {
  appointments: Appointment[];
  clients: Client[];
  onAddAppointment: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${FULL_DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function CRMCalendar({ appointments, clients, onAddAppointment, onEditAppointment }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(today.getFullYear(), today.getMonth(), today.getDate()));
  const [calendarView, setCalendarView] = useState<'month' | 'day'>('month');

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const apptsByDate: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    if (!apptsByDate[a.date]) apptsByDate[a.date] = [];
    apptsByDate[a.date].push(a);
  }

  const selectedAppts = apptsByDate[selectedDate] ?? [];
  const selectedClient = (appt: Appointment) => clients.find(c => c.id === appt.clientId);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const prevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toYMD(d.getFullYear(), d.getMonth(), d.getDate()));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const nextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toYMD(d.getFullYear(), d.getMonth(), d.getDate()));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.container}>
      {/* Month/Day navigation */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={calendarView === 'month' ? prevMonth : prevDay} style={styles.navBtn}>
          <ChevronLeft size={20} color="#1E3A5F" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {calendarView === 'month'
            ? `${MONTHS[viewMonth]} ${viewYear}`
            : formatFullDate(selectedDate)
          }
        </Text>
        <TouchableOpacity onPress={calendarView === 'month' ? nextMonth : nextDay} style={styles.navBtn}>
          <ChevronRight size={20} color="#1E3A5F" />
        </TouchableOpacity>
      </View>

      {/* Toggle row: Month/Day on left, + New on right */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, calendarView === 'month' && styles.toggleBtnActive]}
            onPress={() => setCalendarView('month')}
          >
            <Text style={[styles.toggleText, calendarView === 'month' && styles.toggleTextActive]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, calendarView === 'day' && styles.toggleBtnActive]}
            onPress={() => setCalendarView('day')}
          >
            <Text style={[styles.toggleText, calendarView === 'day' && styles.toggleTextActive]}>Day</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => onAddAppointment(selectedDate)}>
          <Plus size={14} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {calendarView === 'month' ? (
        <>
          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={styles.cell} />;
              const dateStr = toYMD(viewYear, viewMonth, day);
              const apptCount = apptsByDate[dateStr]?.length ?? 0;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected, isToday && !isSelected && styles.cellTextToday]}>
                    {day}
                  </Text>
                  {apptCount > 0 && (
                    <View style={[styles.apptCountBadge, isSelected && styles.apptCountBadgeSelected]}>
                      <Text style={[styles.apptCountText, isSelected && styles.apptCountTextSelected]}>{apptCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Selected day appointments */}
      <View style={styles.daySection}>
        {calendarView === 'month' && (
          <Text style={styles.daySectionTitle}>
            {selectedDate === todayStr ? 'Today' : formatFullDate(selectedDate)}
          </Text>
        )}

        {selectedAppts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No appointments on {formatFullDate(selectedDate)}
            </Text>
            <TouchableOpacity style={styles.addAppointmentBtn} onPress={() => onAddAppointment(selectedDate)}>
              <Plus size={14} color="#2563EB" />
              <Text style={styles.addAppointmentBtnText}>Add Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedAppts.map(appt => {
              const client = selectedClient(appt);
              return (
                <TouchableOpacity key={appt.id} style={styles.apptRow} onPress={() => onEditAppointment(appt)}>
                  <View style={styles.apptTimeCol}>
                    <Text style={styles.apptTime}>{appt.time ?? '—'}</Text>
                    {appt.endTime && <Text style={styles.apptEndTime}>{appt.endTime}</Text>}
                  </View>
                  <View style={styles.apptInfo}>
                    <Text style={styles.apptTitle} numberOfLines={1}>{appt.title}</Text>
                    {appt.type && <Text style={styles.apptType} numberOfLines={1}>{appt.type}</Text>}
                    {client && <Text style={styles.apptClient} numberOfLines={1}>{client.name}</Text>}
                    {appt.notes && <Text style={styles.apptNotes} numberOfLines={1}>{appt.notes}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addAppointmentBtn} onPress={() => onAddAppointment(selectedDate)}>
              <Plus size={14} color="#2563EB" />
              <Text style={styles.addAppointmentBtnText}>Add Appointment</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#1E3A5F' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6 },
  toggleBtnActive: { backgroundColor: '#2563EB', borderRadius: 8 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#FFFFFF' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  newBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94A3B8', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: '#2563EB', borderRadius: 20 },
  cellToday: { backgroundColor: '#EFF6FF', borderRadius: 20 },
  cellText: { fontSize: 13, color: '#1F2937', fontWeight: '500' },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  cellTextToday: { color: '#2563EB', fontWeight: '700' },
  apptCountBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, marginTop: 2 },
  apptCountBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  apptCountText: { fontSize: 9, fontWeight: '700', color: '#2563EB' },
  apptCountTextSelected: { color: '#FFFFFF' },
  daySection: { borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16 },
  daySectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A5F', marginBottom: 10 },
  emptyContainer: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 12 },
  addAppointmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  addAppointmentBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  apptRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 6 },
  apptTimeCol: { width: 48, marginRight: 10 },
  apptTime: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  apptEndTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  apptInfo: { flex: 1 },
  apptTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  apptType: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  apptClient: { fontSize: 12, color: '#2563EB', marginTop: 2 },
  apptNotes: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
