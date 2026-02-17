import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SchedulePhase, GanttTask } from '@/types';

interface PhaseWithTasks {
  phase: SchedulePhase;
  tasks: GanttTask[];
}

interface PrintableScheduleViewProps {
  projectName: string;
  phases: SchedulePhase[];
  tasks: GanttTask[];
}

/**
 * Clean, printable view of the schedule
 * Optimized for PDF export and printing
 */
export default function PrintableScheduleView({
  projectName,
  phases,
  tasks,
}: PrintableScheduleViewProps) {
  // Group tasks by phase
  const phaseGroups: PhaseWithTasks[] = phases.map(phase => ({
    phase,
    tasks: tasks.filter(t => t.phaseId === phase.id).sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    ),
  }));

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateDuration = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.projectName}>{projectName}</Text>
        <Text style={styles.subtitle}>Project Schedule</Text>
        <Text style={styles.printDate}>
          Printed: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {/* Schedule Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.phaseColumn]}>Phase</Text>
          <Text style={[styles.headerCell, styles.taskColumn]}>Task</Text>
          <Text style={[styles.headerCell, styles.dateColumn]}>Start Date</Text>
          <Text style={[styles.headerCell, styles.dateColumn]}>End Date</Text>
          <Text style={[styles.headerCell, styles.durationColumn]}>Duration</Text>
          <Text style={[styles.headerCell, styles.typeColumn]}>Type</Text>
        </View>

        {/* Table Body */}
        {phaseGroups.map(({ phase, tasks: phaseTasks }) => (
          <View key={phase.id}>
            {/* Phase Header Row */}
            <View style={styles.phaseRow}>
              <View style={[styles.colorIndicator, { backgroundColor: phase.color }]} />
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.taskCount}>({phaseTasks.length} tasks)</Text>
            </View>

            {/* Task Rows */}
            {phaseTasks.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No tasks in this phase</Text>
              </View>
            ) : (
              phaseTasks.map((task, index) => (
                <View
                  key={task.id}
                  style={[styles.taskRow, index % 2 === 0 && styles.taskRowEven]}
                >
                  <Text style={[styles.cell, styles.phaseColumn]}></Text>
                  <Text style={[styles.cell, styles.taskColumn]}>{task.category}</Text>
                  <Text style={[styles.cell, styles.dateColumn]}>{formatDate(task.startDate)}</Text>
                  <Text style={[styles.cell, styles.dateColumn]}>{formatDate(task.endDate)}</Text>
                  <Text style={[styles.cell, styles.durationColumn]}>
                    {calculateDuration(task.startDate, task.endDate)} days
                  </Text>
                  <Text style={[styles.cell, styles.typeColumn]}>
                    {task.workType === 'in-house' ? 'In-House' : 'Subcontractor'}
                  </Text>
                </View>
              ))
            )}
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total Phases: {phases.length} | Total Tasks: {tasks.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingBottom: 12,
  },
  projectName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  printDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 2,
    borderBottomColor: '#D1D5DB',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  phaseColumn: {
    width: 120,
  },
  taskColumn: {
    flex: 2,
  },
  dateColumn: {
    width: 100,
  },
  durationColumn: {
    width: 80,
  },
  typeColumn: {
    width: 100,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  colorIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  taskCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  taskRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  taskRowEven: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    fontSize: 12,
    color: '#374151',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  emptyRow: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  summary: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
