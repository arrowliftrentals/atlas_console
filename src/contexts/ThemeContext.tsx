
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'vscode-dark' | 'deep-ocean' | 'cyber-purple' | 'forest-night' | string;

interface Theme {
  name: string;
  label: string;
  colors: {
    // Backgrounds
    background: string;
    backgroundElevated: string;
    backgroundSubtle: string;
    backgroundCard: string;
    backgroundHover: string;
    
    // Borders
    border: string;
    borderSubtle: string;
    borderAccent: string;
    borderSuccess: string;
    borderWarning: string;
    borderError: string;
    
    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textAccent: string;
    textSuccess: string;
    textWarning: string;
    textError: string;
    textInfo: string;
    
    // Buttons
    buttonPrimary: string;
    buttonPrimaryHover: string;
    buttonSecondary: string;
    buttonSecondaryHover: string;
    
    // Accents & Highlights
    accent: string;
    accentHover: string;
    accentSecondary: string;
    accentTertiary: string;
    
    // Status & States
    success: string;
    successMuted: string;
    warning: string;
    warningMuted: string;
    error: string;
    errorMuted: string;
    info: string;
    infoMuted: string;
    
    // UI Elements
    statusBar: string;
    sectionDivider: string;
    cardGradient: string;
    progressBar: string;
  };
}

const defaultThemes: Record<string, Theme> = {
  'vscode-dark': {
    name: 'vscode-dark',
    label: 'VS Code Dark',
    colors: {
      background: '#1e1e1e',
      backgroundElevated: '#252526',
      backgroundSubtle: '#2d2d30',
      backgroundCard: '#2d2d30',
      backgroundHover: '#323232',
      
      border: '#3e3e42',
      borderSubtle: '#2b2b2b',
      borderAccent: '#007acc',
      borderSuccess: '#4ec9b0',
      borderWarning: '#dcdcaa',
      borderError: '#f48771',
      
      textPrimary: '#cccccc',
      textSecondary: '#9d9d9d',
      textMuted: '#6a6a6a',
      textAccent: '#007acc',
      textSuccess: '#4ec9b0',
      textWarning: '#dcdcaa',
      textError: '#f48771',
      textInfo: '#75beff',
      
      buttonPrimary: '#007acc',
      buttonPrimaryHover: '#0098ff',
      buttonSecondary: '#3e3e42',
      buttonSecondaryHover: '#4e4e52',
      
      accent: '#007acc',
      accentHover: '#0098ff',
      accentSecondary: '#4ec9b0',
      accentTertiary: '#dcdcaa',
      
      success: '#4ec9b0',
      successMuted: 'rgba(78, 201, 176, 0.2)',
      warning: '#dcdcaa',
      warningMuted: 'rgba(220, 220, 170, 0.2)',
      error: '#f48771',
      errorMuted: 'rgba(244, 135, 113, 0.2)',
      info: '#75beff',
      infoMuted: 'rgba(117, 190, 255, 0.2)',
      
      statusBar: '#007acc',
      sectionDivider: '#007acc',
      cardGradient: 'rgba(0, 122, 204, 0.1)',
      progressBar: '#007acc',
    }
  },
  'deep-ocean': {
    name: 'deep-ocean',
    label: 'Deep Ocean',
    colors: {
      background: '#0f1f2e',
      backgroundElevated: '#1a2f45',
      backgroundSubtle: '#243d58',
      backgroundCard: '#1a2f42',
      backgroundHover: '#1f3550',
      
      border: '#00d4ff',
      borderSubtle: '#0088aa',
      borderAccent: '#00d4ff',
      borderSuccess: '#00ffcc',
      borderWarning: '#ffaa00',
      borderError: '#ff4466',
      
      textPrimary: '#e0f7ff',
      textSecondary: '#7dd3fc',
      textMuted: '#38bdf8',
      textAccent: '#00d4ff',
      textSuccess: '#00ffcc',
      textWarning: '#ffaa00',
      textError: '#ff4466',
      textInfo: '#7dd3fc',
      
      buttonPrimary: '#00bcd4',
      buttonPrimaryHover: '#00e5ff',
      buttonSecondary: '#1e3a52',
      buttonSecondaryHover: '#2a4a65',
      
      accent: '#00d4ff',
      accentHover: '#00f0ff',
      accentSecondary: '#00ffcc',
      accentTertiary: '#7dd3fc',
      
      success: '#00ffcc',
      successMuted: 'rgba(0, 255, 204, 0.2)',
      warning: '#ffaa00',
      warningMuted: 'rgba(255, 170, 0, 0.2)',
      error: '#ff4466',
      errorMuted: 'rgba(255, 68, 102, 0.2)',
      info: '#00d4ff',
      infoMuted: 'rgba(0, 212, 255, 0.2)',
      
      statusBar: '#006b8f',
      sectionDivider: '#00d4ff',
      cardGradient: 'rgba(0, 212, 255, 0.1)',
      progressBar: '#00d4ff',
    }
  },
  'cyber-purple': {
    name: 'cyber-purple',
    label: 'Cyber Purple',
    colors: {
      background: '#2d1b4e',
      backgroundElevated: '#4a2171',
      backgroundSubtle: '#5c2d8a',
      backgroundCard: '#3d1f5c',
      backgroundHover: '#4a2171',
      
      border: '#a855f7',
      borderSubtle: '#8b5cf6',
      borderAccent: '#a855f7',
      borderSuccess: '#6ee7b7',
      borderWarning: '#fbbf24',
      borderError: '#f472b6',
      
      textPrimary: '#f3e8ff',
      textSecondary: '#d8b4fe',
      textMuted: '#c084fc',
      textAccent: '#a855f7',
      textSuccess: '#6ee7b7',
      textWarning: '#fbbf24',
      textError: '#f472b6',
      textInfo: '#c084fc',
      
      buttonPrimary: '#a855f7',
      buttonPrimaryHover: '#d946ef',
      buttonSecondary: '#3d1f5c',
      buttonSecondaryHover: '#5c2d8a',
      
      accent: '#a855f7',
      accentHover: '#d946ef',
      accentSecondary: '#6ee7b7',
      accentTertiary: '#fbbf24',
      
      success: '#6ee7b7',
      successMuted: 'rgba(110, 231, 183, 0.2)',
      warning: '#fbbf24',
      warningMuted: 'rgba(251, 191, 36, 0.2)',
      error: '#f472b6',
      errorMuted: 'rgba(244, 114, 182, 0.2)',
      info: '#c084fc',
      infoMuted: 'rgba(192, 132, 252, 0.2)',
      
      statusBar: '#7c3aed',
      sectionDivider: '#a855f7',
      cardGradient: 'rgba(168, 85, 247, 0.1)',
      progressBar: '#a855f7',
    }
  },
  'forest-night': {
    name: 'forest-night',
    label: 'Forest Night',
    colors: {
      background: '#0f2e1a',
      backgroundElevated: '#2d5a4a',
      backgroundSubtle: '#3d7060',
      backgroundCard: '#2e5547',
      backgroundHover: '#2d5a4a',
      
      border: '#10b981',
      borderSubtle: '#059669',
      borderAccent: '#10b981',
      borderSuccess: '#4ade80',
      borderWarning: '#fbbf24',
      borderError: '#fb7185',
      
      textPrimary: '#d1fae5',
      textSecondary: '#6ee7b7',
      textMuted: '#34d399',
      textAccent: '#10b981',
      textSuccess: '#4ade80',
      textWarning: '#fbbf24',
      textError: '#fb7185',
      textInfo: '#22d3ee',
      
      buttonPrimary: '#10b981',
      buttonPrimaryHover: '#34d399',
      buttonSecondary: '#2e5547',
      buttonSecondaryHover: '#3d7060',
      
      accent: '#10b981',
      accentHover: '#34d399',
      accentSecondary: '#22d3ee',
      accentTertiary: '#fbbf24',
      
      success: '#4ade80',
      successMuted: 'rgba(74, 222, 128, 0.2)',
      warning: '#fbbf24',
      warningMuted: 'rgba(251, 191, 36, 0.2)',
      error: '#fb7185',
      errorMuted: 'rgba(251, 113, 133, 0.2)',
      info: '#22d3ee',
      infoMuted: 'rgba(34, 211, 238, 0.2)',
      
      statusBar: '#059669',
      sectionDivider: '#10b981',
      cardGradient: 'rgba(16, 185, 129, 0.1)',
      progressBar: '#10b981',
    }
  }
};

interface ThemeContextType {
  currentTheme: string;
  theme: Theme;
  setTheme: (theme: string) => void;
  availableThemes: Theme[];
  addCustomTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'atlas_console_theme';
const CUSTOM_THEMES_STORAGE_KEY = 'atlas_console_custom_themes';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<string>('vscode-dark');
  const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({});

  // Load custom themes and current theme from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load custom themes
    const storedCustomThemes = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (storedCustomThemes) {
      try {
        const parsed = JSON.parse(storedCustomThemes);
        setCustomThemes(parsed);
      } catch (e) {
        console.error('Failed to parse custom themes', e);
      }
    }
    
    // Load current theme
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      setCurrentTheme(stored);
    }
  }, []);

  // Apply theme CSS variables whenever theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const allThemes = { ...defaultThemes, ...customThemes };
    const theme = allThemes[currentTheme];
    if (!theme) return;
    
    const root = document.documentElement;
    
    // Apply CSS variables - Backgrounds
    root.style.setProperty('--atlas-bg-primary', theme.colors.background);
    root.style.setProperty('--atlas-bg-elevated', theme.colors.backgroundElevated);
    root.style.setProperty('--atlas-bg-subtle', theme.colors.backgroundSubtle);
    root.style.setProperty('--atlas-bg-card', theme.colors.backgroundCard);
    root.style.setProperty('--atlas-bg-hover', theme.colors.backgroundHover);
    
    // Borders
    root.style.setProperty('--atlas-border', theme.colors.border);
    root.style.setProperty('--atlas-border-subtle', theme.colors.borderSubtle);
    root.style.setProperty('--atlas-border-accent', theme.colors.borderAccent);
    root.style.setProperty('--atlas-border-success', theme.colors.borderSuccess);
    root.style.setProperty('--atlas-border-warning', theme.colors.borderWarning);
    root.style.setProperty('--atlas-border-error', theme.colors.borderError);
    
    // Text
    root.style.setProperty('--atlas-text-primary', theme.colors.textPrimary);
    root.style.setProperty('--atlas-text-secondary', theme.colors.textSecondary);
    root.style.setProperty('--atlas-text-muted', theme.colors.textMuted);
    root.style.setProperty('--atlas-text-accent', theme.colors.textAccent);
    root.style.setProperty('--atlas-text-success', theme.colors.textSuccess);
    root.style.setProperty('--atlas-text-warning', theme.colors.textWarning);
    root.style.setProperty('--atlas-text-error', theme.colors.textError);
    root.style.setProperty('--atlas-text-info', theme.colors.textInfo);
    
    // Buttons
    root.style.setProperty('--atlas-btn-primary', theme.colors.buttonPrimary);
    root.style.setProperty('--atlas-btn-primary-hover', theme.colors.buttonPrimaryHover);
    root.style.setProperty('--atlas-btn-secondary', theme.colors.buttonSecondary);
    root.style.setProperty('--atlas-btn-secondary-hover', theme.colors.buttonSecondaryHover);
    
    // Accents
    root.style.setProperty('--atlas-accent-primary', theme.colors.accent);
    root.style.setProperty('--atlas-accent-hover', theme.colors.accentHover);
    root.style.setProperty('--atlas-accent-secondary', theme.colors.accentSecondary);
    root.style.setProperty('--atlas-accent-tertiary', theme.colors.accentTertiary);
    
    // Status colors
    root.style.setProperty('--atlas-success', theme.colors.success);
    root.style.setProperty('--atlas-success-muted', theme.colors.successMuted);
    root.style.setProperty('--atlas-warning', theme.colors.warning);
    root.style.setProperty('--atlas-warning-muted', theme.colors.warningMuted);
    root.style.setProperty('--atlas-error', theme.colors.error);
    root.style.setProperty('--atlas-error-muted', theme.colors.errorMuted);
    root.style.setProperty('--atlas-info', theme.colors.info);
    root.style.setProperty('--atlas-info-muted', theme.colors.infoMuted);
    
    // UI Elements
    root.style.setProperty('--atlas-status-bar', theme.colors.statusBar);
    root.style.setProperty('--atlas-section-divider', theme.colors.sectionDivider);
    root.style.setProperty('--atlas-card-gradient', theme.colors.cardGradient);
    root.style.setProperty('--atlas-progress-bar', theme.colors.progressBar);
    
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme, customThemes]);

  const setTheme = (theme: string) => {
    setCurrentTheme(theme);
  };

  const addCustomTheme = (theme: Theme) => {
    const updated = { ...customThemes, [theme.name]: theme };
    setCustomThemes(updated);
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(updated));
    setCurrentTheme(theme.name);
  };

  const allThemes = { ...defaultThemes, ...customThemes };
  const currentThemeObj = allThemes[currentTheme] || defaultThemes['vscode-dark'];

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      theme: currentThemeObj,
      setTheme,
      availableThemes: Object.values(allThemes),
      addCustomTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
