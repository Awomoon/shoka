import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, elevations } from '../theme';
import type { Palette, ResolvedTheme, ThemeMode } from '../theme';

const STORAGE_KEY = 'shoptally.themeMode';
const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export interface ThemeContextValue {
  colors: Palette;
  elevation: ViewStyle;
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (next: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && (MODES as string[]).includes(saved)) {
          setModeState(saved as ThemeMode);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = (next: ThemeMode) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolved: ResolvedTheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: palettes[resolved], elevation: elevations[resolved], mode, resolved, setMode }),
    [mode, resolved]
  );

  // Splash screen stays visible until the saved mode is loaded,
  // so the app never flashes the wrong theme.
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
