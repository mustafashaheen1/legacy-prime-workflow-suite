import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export type BreakpointSize = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveConfig {
  size: BreakpointSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Sidebar dimensions
  sidebarWidth: number;
  sidebarPadding: number;
  // Typography
  headerFontSize: number;
  subtitleFontSize: number;
  bodyFontSize: number;
  metaFontSize: number;
  timestampFontSize: number;
  // Spacing
  cardPadding: number;
  cardGap: number;
  // Component sizes
  checkboxSize: number;
  iconSize: number;
}

const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * Centralized responsive hook for Daily Tasks UI
 * Provides consistent breakpoints and responsive values across all components
 */
export function useDailyTaskResponsive(): ResponsiveConfig {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const isMobile = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const size: BreakpointSize = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Sidebar width logic
    let sidebarWidth: number;
    if (isMobile) {
      sidebarWidth = Math.min(width * 0.9, 400); // 90% of screen, max 400px
    } else if (isTablet) {
      sidebarWidth = 420;
    } else {
      sidebarWidth = 480;
    }

    return {
      size,
      isMobile,
      isTablet,
      isDesktop,
      // Dimensions
      sidebarWidth,
      sidebarPadding: isMobile ? 16 : 20,
      // Typography scale
      headerFontSize: isMobile ? 18 : isTablet ? 20 : 22,
      subtitleFontSize: isMobile ? 12 : 13,
      bodyFontSize: isMobile ? 14 : 15,
      metaFontSize: isMobile ? 11 : 12,
      timestampFontSize: isMobile ? 10 : 11,
      // Spacing
      cardPadding: isMobile ? 12 : 14,
      cardGap: isMobile ? 8 : 10,
      // Sizes
      checkboxSize: isMobile ? 20 : 22,
      iconSize: isMobile ? 16 : 18,
    };
  }, [width]);
}
