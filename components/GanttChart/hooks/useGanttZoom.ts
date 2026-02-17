import { useState, useCallback } from 'react';
import { ZoomLevel } from '@/types';

interface UseGanttZoomReturn {
  cellWidth: number;
  zoomLevel: ZoomLevel;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomLevel: (level: ZoomLevel) => void;
}

/**
 * Hook for managing Gantt chart zoom controls
 * Adjusts cell width based on zoom level
 */
export function useGanttZoom(
  defaultCellWidth: number,
  minCellWidth: number,
  maxCellWidth: number
): UseGanttZoomReturn {
  const [cellWidth, setCellWidth] = useState(defaultCellWidth);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');

  const zoomIn = useCallback(() => {
    setCellWidth(prev => Math.min(prev + 20, maxCellWidth));
  }, [maxCellWidth]);

  const zoomOut = useCallback(() => {
    setCellWidth(prev => Math.max(prev - 20, minCellWidth));
  }, [minCellWidth]);

  const handleSetZoomLevel = useCallback((level: ZoomLevel) => {
    setZoomLevel(level);
    // Adjust cell width based on zoom level
    switch (level) {
      case 'day':
        setCellWidth(defaultCellWidth);
        break;
      case 'week':
        setCellWidth(Math.min(defaultCellWidth * 0.6, maxCellWidth));
        break;
      case 'month':
        setCellWidth(Math.min(defaultCellWidth * 0.4, maxCellWidth));
        break;
    }
  }, [defaultCellWidth, maxCellWidth]);

  return {
    cellWidth,
    zoomLevel,
    zoomIn,
    zoomOut,
    setZoomLevel: handleSetZoomLevel,
  };
}
