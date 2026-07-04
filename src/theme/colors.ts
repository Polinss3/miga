export interface Palette {
  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  separator: string;
  // Content
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  // Brand
  accent: string;
  accentSoft: string;
  // Semantic
  success: string;
  warning: string;
  danger: string;
  info: string;
  // Nutrition
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  caffeine: string;
  // Misc
  overlay: string;
  tabBar: string;
}

export const light: Palette = {
  background: '#F7F9F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF2EE',
  border: '#E3E8E3',
  separator: '#E9EDE9',
  text: '#151915',
  textSecondary: '#5B655D',
  textTertiary: '#8B948C',
  textOnAccent: '#FFFFFF',
  accent: '#1F8A4C',
  accentSoft: '#E3F3E9',
  success: '#2FA36B',
  warning: '#D98E04',
  danger: '#D64545',
  info: '#3478C6',
  calories: '#1F8A4C',
  protein: '#3478C6',
  carbs: '#D98E04',
  fat: '#B4589E',
  water: '#3AA3D9',
  caffeine: '#8A6D3B',
  overlay: 'rgba(0,0,0,0.35)',
  tabBar: 'rgba(255,255,255,0.85)',
};

export const dark: Palette = {
  background: '#0E120F',
  surface: '#181D19',
  surfaceElevated: '#1F2620',
  surfaceMuted: '#232A24',
  border: '#2C342D',
  separator: '#262E27',
  text: '#F2F5F2',
  textSecondary: '#A8B2A9',
  textTertiary: '#6F7A71',
  textOnAccent: '#FFFFFF',
  accent: '#3FB878',
  accentSoft: '#1D3327',
  success: '#43BC7F',
  warning: '#E8A93C',
  danger: '#E06060',
  info: '#5A96D9',
  calories: '#3FB878',
  protein: '#5A96D9',
  carbs: '#E8A93C',
  fat: '#CC79B5',
  water: '#54B4E4',
  caffeine: '#B0905F',
  overlay: 'rgba(0,0,0,0.5)',
  tabBar: 'rgba(20,25,21,0.85)',
};
