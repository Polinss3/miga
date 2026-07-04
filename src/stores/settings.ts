import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Lightweight local-only preferences (not synced to the backend). */
interface SettingsState {
  waterGlassMl: number;
  photoAnalysisMode: 'fast' | 'precise';
  setWaterGlassMl: (ml: number) => void;
  setPhotoAnalysisMode: (mode: 'fast' | 'precise') => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      waterGlassMl: 250,
      photoAnalysisMode: 'fast',
      setWaterGlassMl: (waterGlassMl) => set({ waterGlassMl }),
      setPhotoAnalysisMode: (photoAnalysisMode) => set({ photoAnalysisMode }),
    }),
    {
      name: 'miga.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
