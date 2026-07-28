import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { STORAGE_KEYS } from '@constants/storageKeys';
import { storage } from '@utils/storage';

export const THEMES = { LIGHT: 'light', DARK: 'dark' };

/**
 * Owns the `data-theme` attribute on <html>, which is what every stylesheet keys
 * its dark-mode rules off. Reads and writes the same plain-string localStorage
 * entry the original build used, so an existing preference carries over.
 */
export const ThemeContext = createContext(null);

const readInitialTheme = () =>
  storage.getRaw(STORAGE_KEYS.THEME) === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.setRaw(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK)),
    [],
  );

  const value = useMemo(
    () => ({ theme, isDarkMode: theme === THEMES.DARK, setTheme, toggleTheme }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
