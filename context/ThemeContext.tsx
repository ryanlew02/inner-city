import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { ThemeColors, lightColors, darkColors } from '../constants/Colors';
import { ThemePreference, getThemePreference, setThemePreference as saveThemePreference } from '../services/database/themeService';

type ResolvedTheme = 'light' | 'dark';

type ThemeContextType = {
  colors: ThemeColors;
  theme: ResolvedTheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  theme: 'light',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getThemePreference().then((pref) => {
      setPreferenceState(pref);
      setLoaded(true);
    });
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    saveThemePreference(pref);
  }, []);

  const resolvedTheme: ResolvedTheme =
    preference === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : preference;

  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, theme: resolvedTheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
