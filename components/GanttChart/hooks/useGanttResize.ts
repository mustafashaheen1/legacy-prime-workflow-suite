import { useRef, useCallback } from 'react';
import { GanttTask } from '@/types';

interface ResizeState {
  taskId: string;
  type: 'right' | 'bottom';
  startX: number;
  startY: number;
  initialDuration: number;
  initialRowSpan: number;
}

interface UseGanttResizeProps {
  cellWidth: number;
  rowHeight: number;
  tasks: GanttTask[];
  onUpdateTask: (id: string, updates: Partial<GanttTask>) => Promise<GanttTask | null>;
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
}

interface UseGanttResizeReturn {
  resizingTask: { id: string; type: 'right' | 'bottom' } | null;
  handleResizeStart: (task: GanttTask, resizeType: 'right' | 'bottom', clientX: number, clientY: number) => void;
  handleResizeMove: (clientX: number, clientY: number) => void;
  handleResizeEnd: () => Promise<void>;
}

/**
 * Hook for task resize functionality
 * Follows existing schedule.tsx patterns with refs to avoid stale closures
 */
export function useGanttResize({
  cellWidth,
  rowHeight,
  tasks,
  onUpdateTask,
  setTasks,
}: UseGanttResizeProps): UseGanttResizeReturn {
  const activeResizeRef = useRef<ResizeState | null>(null);
  const resizingTaskRef = useRef<{ id: string; type: 'right' | 'bottom' } | null>(null);

  const handleResizeStart = useCallback((
    task: GanttTask,
    resizeType: 'right' | 'bottom',
    clientX: number,
    clientY: number
  ) => {
    const resizeState: ResizeState = {
      taskId: task.id,
      type: resizeType,
      startX: clientX,
      startY: clientY,
      initialDuration: task.duration,
      initialRowSpan: task.rowSpan || 1,
    };

    // Store in ref for event listeners
    activeResizeRef.current = resizeState;
    resizingTaskRef.current = { id: task.id, type: resizeType };

    console.log('[Gantt] Resize start:', resizeState);
  }, []);

  const handleResizeMove = useCallback((clientX: number, clientY: number) => {
    // Read from ref to avoid stale closure
    const resize = activeResizeRef.current;
    if (!resize) return;

    // Use functional setState to always get latest tasks
    setTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === resize.taskId);
      if (!task) return prevTasks;

      if (resize.type === 'right') {
        // Calculate delta from initial position
        const deltaX = clientX - resize.startX;
        const deltaDays = Math.round(deltaX / cellWidth);
        const newDuration = Math.max(1, resize.initialDuration + deltaDays);

        if (newDuration !== task.duration) {
          const newEndDate = new Date(task.startDate);
          newEndDate.setDate(newEndDate.getDate() + newDuration);

          return prevTasks.map(t =>
            t.id === resize.taskId ? {
              ...t,
              duration: newDuration,
              endDate: newEndDate.toISOString(),
            } : t
          );
        }
      } else if (resize.type === 'bottom') {
        // Calculate delta from initial position
        const deltaY = clientY - resize.startY;
        const deltaRows = Math.round(deltaY / rowHeight);
        const newRowSpan = Math.max(1, resize.initialRowSpan + deltaRows);

        if (newRowSpan !== (task.rowSpan || 1)) {
          return prevTasks.map(t =>
            t.id === resize.taskId ? { ...t, rowSpan: newRowSpan } : t
          );
        }
      }

      return prevTasks;
    });
  }, [cellWidth, rowHeight, setTasks]);

  const handleResizeEnd = useCallback(async () => {
    const resize = activeResizeRef.current;
    if (resize) {
      // Use functional setState to get the latest task data
      let taskToSave: GanttTask | null = null;

      setTasks(prevTasks => {
        taskToSave = prevTasks.find(t => t.id === resize.taskId) || null;
        return prevTasks; // Don't modify state, just read it
      });

      if (taskToSave) {
        console.log('[Gantt] Saving task after resize:', {
          id: taskToSave.id,
          duration: taskToSave.duration,
          endDate: taskToSave.endDate,
          rowSpan: taskToSave.rowSpan,
        });

        // Save changes to database
        await onUpdateTask(taskToSave.id, {
          startDate: taskToSave.startDate,
          endDate: taskToSave.endDate,
          duration: taskToSave.duration,
          rowSpan: taskToSave.rowSpan,
        });
      }
    }

    activeResizeRef.current = null;
    resizingTaskRef.current = null;
  }, [setTasks, onUpdateTask]);

  return {
    resizingTask: resizingTaskRef.current,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
}
