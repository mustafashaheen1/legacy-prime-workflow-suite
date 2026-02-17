import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type BreakpointSize = 'mobile' | 'tablet' | 'desktop';

interface GanttResponsiveConfig {
  size: BreakpointSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Layout dimensions
  sidebarWidth: number;
  rowHeight: number;
  headerHeight: number;
  // Cell dimensions (can be controlled by zoom)
  defaultCellWidth: number;
  minCellWidth: number;
  maxCellWidth: number;
  // Typography
  headerFontSize: number;
  bodyFontSize: number;
  smallFontSize: number;
  // Spacing
  padding: number;
  gap: number;
  // Component sizes
  iconSize: number;
  handleSize: number;
}

const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * Centralized responsive hook for Gantt Chart UI
 * Provides consistent breakpoints and responsive values across all components
 */
export function useGanttResponsive(): GanttResponsiveConfig {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const isMobile = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const size: BreakpointSize = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Sidebar width logic
    let sidebarWidth: number;
    if (isMobile) {
      sidebarWidth = 120; // Compact on mobile
    } else if (isTablet) {
      sidebarWidth = 180;
    } else {
      sidebarWidth = 220;
    }

    return {
      size,
      isMobile,
      isTablet,
      isDesktop,
      // Layout
      sidebarWidth,
      rowHeight: isMobile ? 60 : 80,
      headerHeight: isMobile ? 40 : 50,
      // Cell dimensions (zoom controls will adjust these)
      defaultCellWidth: isMobile ? 60 : 80,
      minCellWidth: isMobile ? 30 : 40,
      maxCellWidth: isMobile ? 100 : 120,
      // Typography scale
      headerFontSize: isMobile ? 12 : isTablet ? 14 : 16,
      bodyFontSize: isMobile ? 11 : isTablet ? 12 : 14,
      smallFontSize: isMobile ? 9 : 10,
      // Spacing
      padding: isMobile ? 8 : 12,
      gap: isMobile ? 6 : 8,
      // Sizes
      iconSize: isMobile ? 16 : 18,
      handleSize: isMobile ? 20 : 24,
    };
  }, [width]);
}
