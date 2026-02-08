export type ThemeColors = {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardAlt: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders & dividers
  border: string;
  borderLight: string;
  divider: string;

  // Interactive surfaces
  inputBackground: string;
  inputBorder: string;
  buttonBackground: string;
  buttonBackgroundDisabled: string;

  // Navigation
  headerBackground: string;
  drawerBackground: string;
  drawerActiveText: string;
  drawerInactiveText: string;

  // Accent colors (same in both themes)
  accent: string;
  accentLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  warningText: string;
  danger: string;
  dangerLight: string;
  dangerBorder: string;

  // Specific UI elements
  tokenBadgeBackground: string;
  tokenBadgeText: string;
  skyBackground: string;
  tabBarBackground: string;
  tabBarActiveBackground: string;
  shadow: string;
  overlay: string;
  handleBar: string;
  pastDateBanner: string;
  pastDateText: string;

  // Stats-specific
  statHighlight: string;
  cellDefault: string;
  cellUnscheduled: string;
};

export const lightColors: ThemeColors = {
  background: '#F2F4F7',
  backgroundSecondary: '#F9FAFB',
  card: '#FFFFFF',
  cardAlt: '#F3F4F6',

  text: '#111827',
  textSecondary: '#64748B',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#E5E7EB',

  inputBackground: '#FFFFFF',
  inputBorder: '#E5E7EB',
  buttonBackground: '#F3F4F6',
  buttonBackgroundDisabled: '#F9FAFB',

  headerBackground: '#F2F4F7',
  drawerBackground: '#F2F4F7',
  drawerActiveText: '#3B82F6',
  drawerInactiveText: '#64748B',

  accent: '#3B82F6',
  accentLight: '#E0F2FE',
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FCA5A5',

  tokenBadgeBackground: '#FEF3C7',
  tokenBadgeText: '#92400E',
  skyBackground: '#87CEEB',
  tabBarBackground: '#E5E7EB',
  tabBarActiveBackground: '#FFFFFF',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  handleBar: '#D1D5DB',
  pastDateBanner: '#FEF3C7',
  pastDateText: '#92400E',

  statHighlight: '#3B82F6',
  cellDefault: '#D1D5DB',
  cellUnscheduled: '#F3F4F6',
};

export const darkColors: ThemeColors = {
  background: '#121218',
  backgroundSecondary: '#1A1A24',
  card: '#1E1E2A',
  cardAlt: '#282838',

  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#111827',

  border: '#2E2E3E',
  borderLight: '#252535',
  divider: '#2E2E3E',

  inputBackground: '#1E1E2A',
  inputBorder: '#2E2E3E',
  buttonBackground: '#282838',
  buttonBackgroundDisabled: '#1E1E2A',

  headerBackground: '#121218',
  drawerBackground: '#121218',
  drawerActiveText: '#60A5FA',
  drawerInactiveText: '#94A3B8',

  accent: '#3B82F6',
  accentLight: '#1E3A5F',
  success: '#22C55E',
  successLight: '#14532D',
  warning: '#F59E0B',
  warningLight: '#422006',
  warningText: '#FCD34D',
  danger: '#EF4444',
  dangerLight: '#3B1111',
  dangerBorder: '#7F1D1D',

  tokenBadgeBackground: '#422006',
  tokenBadgeText: '#FCD34D',
  skyBackground: '#1A2E4A',
  tabBarBackground: '#1E1E2A',
  tabBarActiveBackground: '#282838',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  handleBar: '#4A4A5A',
  pastDateBanner: '#422006',
  pastDateText: '#FCD34D',

  statHighlight: '#60A5FA',
  cellDefault: '#3A3A4A',
  cellUnscheduled: '#1E1E2A',
};
