import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentType, ReactNode } from 'react';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export type IconName =
  | 'today'
  | 'scan'
  | 'inventory'
  | 'recipes'
  | 'planning'
  | 'ai'
  | 'profile'
  | 'barcode'
  | 'receipt'
  | 'camera'
  | 'plus'
  | 'minus'
  | 'water'
  | 'caffeine'
  | 'supplement'
  | 'flame'
  | 'check'
  | 'chevronRight'
  | 'close'
  | 'edit'
  | 'trash'
  | 'lock'
  | 'sparkles'
  | 'warning'
  | 'heart'
  | 'cart'
  | 'search'
  | 'settings'
  | 'fridge'
  | 'clock'
  | 'globe'
  | 'shield'
  | 'doc'
  | 'refresh'
  | 'send';

/** SF Symbol on iOS / Material Community icon elsewhere. */
const MAP: Record<IconName, { sf: string; material: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  today: { sf: 'sun.max', material: 'white-balance-sunny' },
  scan: { sf: 'viewfinder', material: 'scan-helper' },
  inventory: { sf: 'basket', material: 'basket-outline' },
  recipes: { sf: 'book', material: 'book-open-outline' },
  planning: { sf: 'calendar', material: 'calendar-outline' },
  ai: { sf: 'sparkles', material: 'creation' },
  profile: { sf: 'person.crop.circle', material: 'account-circle-outline' },
  barcode: { sf: 'barcode.viewfinder', material: 'barcode-scan' },
  receipt: { sf: 'doc.text.viewfinder', material: 'receipt' },
  camera: { sf: 'camera', material: 'camera-outline' },
  plus: { sf: 'plus', material: 'plus' },
  minus: { sf: 'minus', material: 'minus' },
  water: { sf: 'drop', material: 'water-outline' },
  caffeine: { sf: 'cup.and.saucer', material: 'coffee-outline' },
  supplement: { sf: 'pills', material: 'pill' },
  flame: { sf: 'flame', material: 'fire' },
  check: { sf: 'checkmark', material: 'check' },
  chevronRight: { sf: 'chevron.right', material: 'chevron-right' },
  close: { sf: 'xmark', material: 'close' },
  edit: { sf: 'pencil', material: 'pencil-outline' },
  trash: { sf: 'trash', material: 'trash-can-outline' },
  lock: { sf: 'lock', material: 'lock-outline' },
  sparkles: { sf: 'sparkles', material: 'creation' },
  warning: { sf: 'exclamationmark.triangle', material: 'alert-outline' },
  heart: { sf: 'heart', material: 'heart-outline' },
  cart: { sf: 'cart', material: 'cart-outline' },
  search: { sf: 'magnifyingglass', material: 'magnify' },
  settings: { sf: 'gearshape', material: 'cog-outline' },
  fridge: { sf: 'refrigerator', material: 'fridge-outline' },
  clock: { sf: 'clock', material: 'clock-outline' },
  globe: { sf: 'globe', material: 'web' },
  shield: { sf: 'checkmark.shield', material: 'shield-check-outline' },
  doc: { sf: 'doc.text', material: 'file-document-outline' },
  refresh: { sf: 'arrow.clockwise', material: 'refresh' },
  send: { sf: 'arrow.up.circle.fill', material: 'send-circle' },
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

interface SymbolViewProps {
  name: string;
  size?: number;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  fallback?: ReactNode;
}

let SymbolViewComponent: ComponentType<SymbolViewProps> | null | undefined;

function loadSymbolView(): ComponentType<SymbolViewProps> | null {
  if (SymbolViewComponent !== undefined) return SymbolViewComponent;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native view; fall back in Expo Go if unavailable
    SymbolViewComponent = require('expo-symbols').SymbolView as ComponentType<SymbolViewProps>;
  } catch {
    SymbolViewComponent = null;
  }
  return SymbolViewComponent;
}

export function Icon({ name, size = 22, color, style }: IconProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;
  const entry = MAP[name];
  const materialIcon = (
    <MaterialCommunityIcons name={entry.material} size={size} color={tint} style={style as never} />
  );

  if (Platform.OS === 'ios') {
    const SymbolView = loadSymbolView();
    if (SymbolView) {
      return (
        <SymbolView name={entry.sf} size={size} tintColor={tint as string} style={style} fallback={materialIcon} />
      );
    }
  }
  return materialIcon;
}
