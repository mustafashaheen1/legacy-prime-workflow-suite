import { useState, useRef, useCallback } from 'react';
import { GanttTask } from '@/types';

interface ResizeState {
  taskId: string;
  type: 'right';
  startX: number;
  initialDuration: number;
  initialEndDate: Date;
}

interface UseGanttResizeProps {
  cellWidth: number;
  rowHeight: number;
  tasks: GanttTask[];
  onUpdateTask: (id: string, updates: Partial<GanttTask>) => Promise<GanttTask | null>;
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
}

interface UseGanttResizeReturn {
  resizingTask: { id: string; type: 'right' } | null;
  handleResizeStart: (task: GanttTask, resizeType: 'right', clientX: number, clientY: number) => void;
  handleResizeMove: (clientX: number, clientY: number) => void;
  handleResizeEnd: () => Promise<void>;
}

/**
 * Hook for task resize (right-edge drag to extend duration).
 * Returns resizingTask as reactive STATE so parent re-renders immediately.
 * Also maintains a ref for synchronous access inside PanResponder callbacks.
 */
export function useGanttResize({
  cellWidth,
  onUpdateTask,
  setTasks,
}: UseGanttResizeProps): UseGanttResizeReturn {
  // Reactive state for parent re-renders
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'right' } | null>(null);

  // Refs for synchronous access inside gesture callbacks
  const activeResizeRef = useRef<ResizeState | null>(null);
  const resizingTaskRef = useRef<{ id: string; type: 'right' } | null>(null);

  // Keep both in sync
  const setResizeState = (state: { id: string; type: 'right' } | null) => {
    resizingTaskRef.current = state;
    setResizingTask(state);
  };

  const handleResizeStart = useCallback((
    task: GanttTask,
    resizeType: 'right',
    clientX: number,
    _clientY: number
  ) => {
    const resizeState: ResizeState = {
      taskId: task.id,
      type: resizeType,
      startX: clientX,
      initialDuration: task.duration,
      initialEndDate: new Date(task.endDate),
    };

    activeResizeRef.current = resizeState;
    setResizeState({ id: task.id, type: resizeType });

    console.log('[Gantt] Resize start:', { taskId: task.id, type: resizeType, clientX });
  }, []);

  const handleResizeMove = useCallback((clientX: number, _clientY: number) => {
    const resize = activeResizeRef.current;
    if (!resize) return;

    setTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === resize.taskId);
      if (!task) return prevTasks;

      const deltaX = clientX - resize.startX;
      const deltaDays = Math.round(deltaX / cellWidth);
      const newDuration = Math.max(1, resize.initialDuration + deltaDays);

      if (newDuration === task.duration) return prevTasks;

      const newEndDate = new Date(task.startDate);
      newEndDate.setDate(newEndDate.getDate() + newDuration);

      return prevTasks.map(t =>
        t.id === resize.taskId
          ? { ...t, duration: newDuration, endDate: newEndDate.toISOString() }
          : t
      );
    });
  }, [cellWidth, setTasks]);

  const handleResizeEnd = useCallback(async () => {
    const resize = activeResizeRef.current;
    if (resize) {
      let taskToSave: GanttTask | null = null;

      setTasks(prevTasks => {
        taskToSave = prevTasks.find(t => t.id === resize.taskId) || null;
        return prevTasks;
      });

      if (taskToSave) {
        console.log('[Gantt] Saving task after resize:', (taskToSave as GanttTask).id);
        await onUpdateTask((taskToSave as GanttTask).id, {
          endDate: (taskToSave as GanttTask).endDate,
          duration: (taskToSave as GanttTask).duration,
        });
      }
    }

    activeResizeRef.current = null;
    setResizeState(null);
  }, [setTasks, onUpdateTask]);

  return {
    resizingTask,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
}
