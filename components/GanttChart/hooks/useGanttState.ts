import { useState, useCallback, useEffect } from 'react';
import { SchedulePhase, GanttTask } from '@/types';

// Helper function to get API base URL for both web and mobile
const getApiBaseUrl = () => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (rorkApi) {
    return rorkApi;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8081';
};

interface UseGanttStateProps {
  projectId: string | null;
}

interface UseGanttStateReturn {
  // Data
  phases: SchedulePhase[];
  tasks: GanttTask[];
  // Loading states
  isLoadingPhases: boolean;
  isLoadingTasks: boolean;
  // Actions - Phases
  fetchPhases: () => Promise<void>;
  createPhase: (phase: Partial<SchedulePhase>) => Promise<SchedulePhase | null>;
  updatePhase: (id: string, updates: Partial<SchedulePhase>) => Promise<SchedulePhase | null>;
  deletePhase: (id: string) => Promise<boolean>;
  // Actions - Tasks
  fetchTasks: () => Promise<void>;
  createTask: (task: Partial<GanttTask>) => Promise<GanttTask | null>;
  updateTask: (id: string, updates: Partial<GanttTask>) => Promise<GanttTask | null>;
  deleteTask: (id: string) => Promise<boolean>;
  // Local state updates (optimistic)
  setPhases: React.Dispatch<React.SetStateAction<SchedulePhase[]>>;
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
}

/**
 * Central state management hook for Gantt Chart
 * Handles data fetching and CRUD operations for phases and tasks
 */
export function useGanttState({ projectId }: UseGanttStateProps): UseGanttStateReturn {
  const [phases, setPhases] = useState<SchedulePhase[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [isLoadingPhases, setIsLoadingPhases] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // ===== FETCH PHASES =====
  const fetchPhases = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingPhases(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-schedule-phases?projectId=${projectId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.phases) {
        console.log('[Gantt] Fetched phases:', data.phases);
        setPhases(data.phases);
      }
    } catch (error: any) {
      console.error('[Gantt] Error fetching phases:', error);
      setPhases([]);
    } finally {
      setIsLoadingPhases(false);
    }
  }, [projectId]);

  // ===== FETCH TASKS =====
  const fetchTasks = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingTasks(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-scheduled-tasks?projectId=${projectId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.scheduledTasks) {
        console.log('[Gantt] Fetched tasks:', data.scheduledTasks);
        setTasks(data.scheduledTasks as GanttTask[]);
      }
    } catch (error: any) {
      console.error('[Gantt] Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [projectId]);

  // ===== CREATE PHASE =====
  const createPhase = useCallback(async (phase: Partial<SchedulePhase>): Promise<SchedulePhase | null> => {
    if (!projectId) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/save-schedule-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...phase,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.phase) {
        console.log('[Gantt] Created phase:', data.phase);
        // Optimistically update local state
        setPhases(prev => [...prev, data.phase]);
        return data.phase;
      }

      return null;
    } catch (error: any) {
      console.error('[Gantt] Error creating phase:', error);
      return null;
    }
  }, [projectId]);

  // ===== UPDATE PHASE =====
  const updatePhase = useCallback(async (id: string, updates: Partial<SchedulePhase>): Promise<SchedulePhase | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/update-schedule-phase`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.phase) {
        console.log('[Gantt] Updated phase:', data.phase);
        // Optimistically update local state
        setPhases(prev => prev.map(p => p.id === id ? data.phase : p));
        return data.phase;
      }

      return null;
    } catch (error: any) {
      console.error('[Gantt] Error updating phase:', error);
      return null;
    }
  }, []);

  // ===== DELETE PHASE =====
  const deletePhase = useCallback(async (id: string): Promise<boolean> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/delete-schedule-phase?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('[Gantt] Deleted phase:', id);
        // Optimistically update local state
        setPhases(prev => prev.filter(p => p.id !== id));
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[Gantt] Error deleting phase:', error);
      return false;
    }
  }, []);

  // ===== CREATE TASK =====
  const createTask = useCallback(async (task: Partial<GanttTask>): Promise<GanttTask | null> => {
    if (!projectId) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/save-scheduled-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...task,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.scheduledTask) {
        console.log('[Gantt] Created task:', data.scheduledTask);
        // Optimistically update local state
        setTasks(prev => [...prev, data.scheduledTask as GanttTask]);
        return data.scheduledTask as GanttTask;
      }

      return null;
    } catch (error: any) {
      console.error('[Gantt] Error creating task:', error);
      return null;
    }
  }, [projectId]);

  // ===== UPDATE TASK =====
  const updateTask = useCallback(async (id: string, updates: Partial<GanttTask>): Promise<GanttTask | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/update-scheduled-task`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.scheduledTask) {
        console.log('[Gantt] Updated task:', data.scheduledTask);
        // Optimistically update local state
        setTasks(prev => prev.map(t => t.id === id ? data.scheduledTask as GanttTask : t));
        return data.scheduledTask as GanttTask;
      }

      return null;
    } catch (error: any) {
      console.error('[Gantt] Error updating task:', error);
      return null;
    }
  }, []);

  // ===== DELETE TASK =====
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/delete-scheduled-task?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('[Gantt] Deleted task:', id);
        // Optimistically update local state
        setTasks(prev => prev.filter(t => t.id !== id));
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[Gantt] Error deleting task:', error);
      return false;
    }
  }, []);

  // ===== AUTO-FETCH ON PROJECT CHANGE =====
  useEffect(() => {
    if (projectId) {
      fetchPhases();
      fetchTasks();
    }
  }, [projectId, fetchPhases, fetchTasks]);

  return {
    // Data
    phases,
    tasks,
    // Loading states
    isLoadingPhases,
    isLoadingTasks,
    // Actions - Phases
    fetchPhases,
    createPhase,
    updatePhase,
    deletePhase,
    // Actions - Tasks
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    // Direct state setters for optimistic updates
    setPhases,
    setTasks,
  };
}
