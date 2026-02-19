import { useState, useRef, useCallback } from 'react';
import { GanttTask } from '@/types';

interface DragState {
  taskId: string;
  startX: number;
  startY: number;
  initialStartDate: Date;
}

interface UseGanttDragProps {
  cellWidth: number;
  rowHeight: number;
  dates: Date[];
  tasks: GanttTask[];
  onUpdateTask: (id: string, updates: Partial<GanttTask>) => Promise<GanttTask | null>;
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
}

interface UseGanttDragReturn {
  draggedTaskId: string | null;
  handleDragStart: (task: GanttTask, clientX: number, clientY: number) => void;
  handleDragMove: (clientX: number, clientY: number) => void;
  handleDragEnd: () => Promise<void>;
}

/**
 * Hook for task drag functionality.
 * Returns draggedTaskId as reactive STATE so parent re-renders on drag start/end.
 * Also maintains a ref for synchronous access inside PanResponder callbacks.
 */
export function useGanttDrag({
  cellWidth,
  onUpdateTask,
  setTasks,
}: UseGanttDragProps): UseGanttDragReturn {
  // Reactive state for parent re-renders
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Refs for synchronous access inside gesture callbacks
  const activeDragRef = useRef<DragState | null>(null);
  const draggedTaskIdRef = useRef<string | null>(null);

  // Keep both in sync
  const setDragId = (id: string | null) => {
    draggedTaskIdRef.current = id;
    setDraggedTaskId(id);
  };

  const handleDragStart = useCallback((task: GanttTask, clientX: number, _clientY: number) => {
    const taskStartDate = new Date(task.startDate);

    const dragState: DragState = {
      taskId: task.id,
      startX: clientX,
      startY: clientY,
      initialStartDate: taskStartDate,
    };

    activeDragRef.current = dragState;
    setDragId(task.id);

    console.log('[Gantt] Drag start:', { taskId: task.id, clientX });
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    const drag = activeDragRef.current;
    if (!drag) return;

    setTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === drag.taskId);
      if (!task) return prevTasks;

      const deltaX = clientX - drag.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      const newStartDate = new Date(drag.initialStartDate);
      newStartDate.setDate(drag.initialStartDate.getDate() + deltaDays);

      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + task.duration);

      const currentStartStr = new Date(task.startDate).toDateString();
      const newStartStr = newStartDate.toDateString();

      if (currentStartStr === newStartStr) return prevTasks;

      return prevTasks.map(t =>
        t.id === drag.taskId
          ? { ...t, startDate: newStartDate.toISOString(), endDate: newEndDate.toISOString() }
          : t
      );
    });
  }, [cellWidth, setTasks]);

  const handleDragEnd = useCallback(async () => {
    const drag = activeDragRef.current;
    if (drag) {
      let taskToSave: GanttTask | null = null;

      setTasks(prevTasks => {
        taskToSave = prevTasks.find(t => t.id === drag.taskId) || null;
        return prevTasks;
      });

      if (taskToSave) {
        console.log('[Gantt] Saving task after drag:', (taskToSave as GanttTask).id);
        await onUpdateTask((taskToSave as GanttTask).id, {
          startDate: (taskToSave as GanttTask).startDate,
          endDate: (taskToSave as GanttTask).endDate,
          duration: (taskToSave as GanttTask).duration,
        });
      }
    }

    activeDragRef.current = null;
    setDragId(null);
  }, [setTasks, onUpdateTask]);

  return {
    draggedTaskId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
