import { useRef, useCallback } from 'react';
import { GanttTask } from '@/types';

interface DragState {
  taskId: string;
  startX: number;
  startY: number;
  initialRow: number;
  initialStartDate: Date;
  initialDayIndex: number;
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
 * Hook for task drag functionality
 * Follows existing schedule.tsx patterns with refs to avoid stale closures
 */
export function useGanttDrag({
  cellWidth,
  rowHeight,
  dates,
  tasks,
  onUpdateTask,
  setTasks,
}: UseGanttDragProps): UseGanttDragReturn {
  const activeDragRef = useRef<DragState | null>(null);
  const draggedTaskIdRef = useRef<string | null>(null);

  // Collision detection helper
  const checkTaskOverlap = useCallback((
    task1Start: Date,
    task1End: Date,
    task1Row: number,
    task2: GanttTask,
    excludeTaskId?: string
  ): boolean => {
    if (task2.id === excludeTaskId) return false;
    if (task1Row !== task2.row) return false;

    const task2Start = new Date(task2.startDate);
    const task2End = new Date(task2.endDate);

    // Check if date ranges overlap
    return task1Start < task2End && task1End > task2Start;
  }, []);

  // Find first available row without overlaps
  const findAvailableRow = useCallback((
    startDate: Date,
    endDate: Date,
    allTasks: GanttTask[],
    excludeTaskId?: string
  ): number => {
    let row = 0;
    let foundAvailableRow = false;

    while (!foundAvailableRow && row < 20) { // Max 20 rows
      const hasOverlap = allTasks.some(task =>
        checkTaskOverlap(startDate, endDate, row, task, excludeTaskId)
      );

      if (!hasOverlap) {
        foundAvailableRow = true;
      } else {
        row++;
      }
    }

    return row;
  }, [checkTaskOverlap]);

  const handleDragStart = useCallback((task: GanttTask, clientX: number, clientY: number) => {
    // Find the initial day index
    const taskStartDate = new Date(task.startDate);
    const initialDayIndex = dates.findIndex(d =>
      d.toDateString() === taskStartDate.toDateString()
    );

    const dragState: DragState = {
      taskId: task.id,
      startX: clientX,
      startY: clientY,
      initialRow: task.row || 0,
      initialStartDate: taskStartDate,
      initialDayIndex,
    };

    // Store in ref for event listeners
    activeDragRef.current = dragState;
    draggedTaskIdRef.current = task.id;

    console.log('[Gantt] Drag start:', dragState);
  }, [dates]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    // Read from ref to avoid stale closure
    const drag = activeDragRef.current;
    if (!drag) return;

    // Use functional setState to always get latest tasks
    setTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === drag.taskId);
      if (!task) return prevTasks;

      // Calculate horizontal movement (days)
      const deltaX = clientX - drag.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      // Calculate vertical movement (rows)
      const deltaY = clientY - drag.startY;
      const deltaRows = Math.round(deltaY / rowHeight);
      let newRow = Math.max(0, drag.initialRow + deltaRows);

      // Calculate new start date
      const newStartDate = new Date(drag.initialStartDate);
      newStartDate.setDate(drag.initialStartDate.getDate() + deltaDays);

      // Calculate new end date based on duration
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + task.duration);

      // Check for overlaps and auto-shift to next available row
      const wouldOverlap = prevTasks.some(t =>
        t.id !== drag.taskId &&
        t.row === newRow &&
        new Date(t.startDate) < newEndDate &&
        new Date(t.endDate) > newStartDate
      );

      if (wouldOverlap) {
        // Find next available row
        newRow = findAvailableRow(newStartDate, newEndDate, prevTasks, drag.taskId);
        console.log('[Gantt] Overlap detected, auto-shifted to row', newRow);
      }

      // Only update if something changed
      const currentRow = task.row || 0;
      const currentStartDate = new Date(task.startDate).toDateString();
      const newStartDateString = newStartDate.toDateString();

      if (newRow !== currentRow || currentStartDate !== newStartDateString) {
        return prevTasks.map(t =>
          t.id === drag.taskId
            ? {
                ...t,
                row: newRow,
                startDate: newStartDate.toISOString(),
                endDate: newEndDate.toISOString(),
              }
            : t
        );
      }

      return prevTasks;
    });
  }, [cellWidth, rowHeight, setTasks, findAvailableRow]);

  const handleDragEnd = useCallback(async () => {
    const drag = activeDragRef.current;
    if (drag) {
      // Use functional setState to get the latest task data
      let taskToSave: GanttTask | null = null;

      setTasks(prevTasks => {
        taskToSave = prevTasks.find(t => t.id === drag.taskId) || null;
        return prevTasks; // Don't modify state, just read it
      });

      if (taskToSave) {
        console.log('[Gantt] Saving task after drag:', {
          id: taskToSave.id,
          row: taskToSave.row,
          startDate: taskToSave.startDate,
          endDate: taskToSave.endDate,
        });

        // Save changes to database
        await onUpdateTask(taskToSave.id, {
          startDate: taskToSave.startDate,
          endDate: taskToSave.endDate,
          duration: taskToSave.duration,
          row: taskToSave.row,
        });
      }
    }

    activeDragRef.current = null;
    draggedTaskIdRef.current = null;
  }, [setTasks, onUpdateTask]);

  return {
    draggedTaskId: draggedTaskIdRef.current,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
