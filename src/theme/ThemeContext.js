import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, elevations } from '../theme';

const STORAGE_KEY = 'shoptally.themeMode';
const MODES = ['system', 'light', 'dark'];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (MODES.includes(saved)) setModeState(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = (next) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolved = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo(
    () => ({ colors: palettes[resolved], elevation: elevations[resolved], mode, resolved, setMode }),
    [mode, resolved]
  );

  // Splash screen stays visible until the saved mode is loaded,
  // so the app never flashes the wrong theme.
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
