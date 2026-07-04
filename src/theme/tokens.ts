import { Platform, type TextStyle } from 'react-native';

/** 4pt base grid, generous whitespace by default. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', default: undefined });

type Type = Record<
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption',
  TextStyle
>;

/** Apple HIG-aligned type scale. */
export const typography: Type = {
  largeTitle: { fontFamily, fontSize: 34, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontFamily, fontSize: 28, fontWeight: '700' },
  title2: { fontFamily, fontSize: 22, fontWeight: '700' },
  title3: { fontFamily, fontSize: 20, fontWeight: '600' },
  headline: { fontFamily, fontSize: 17, fontWeight: '600' },
  body: { fontFamily, fontSize: 17, fontWeight: '400' },
  callout: { fontFamily, fontSize: 16, fontWeight: '400' },
  subhead: { fontFamily, fontSize: 15, fontWeight: '400' },
  footnote: { fontFamily, fontSize: 13, fontWeight: '400' },
  caption: { fontFamily, fontSize: 12, fontWeight: '400' },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
