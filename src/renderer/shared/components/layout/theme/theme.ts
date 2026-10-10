import { createTheme, type ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    customBorder?: string;
  }
  interface PaletteOptions {
    customBorder?: string;
  }
}

// Design tokens from DESIGN.md (warm cream canvas, coral primary, serif display).
const SANS = '"StyreneB", "Inter", "Roboto", "Helvetica", "Arial", sans-serif';
const SERIF = '"Copernicus", "Tiempos Headline", "Iowan Old Style", Georgia, serif';

const serifHeading = (fontSize: string, letterSpacing: string, lineHeight: number) => ({
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize,
  letterSpacing,
  lineHeight
});

const scrollbar = (track: string, thumb: string) => ({
  '&::-webkit-scrollbar': { width: '10px', height: '10px' },
  '&::-webkit-scrollbar-track': { background: track, borderRadius: '5px' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: thumb,
    border: `2px solid ${track}`,
    borderRadius: '5px'
  },
  scrollbarWidth: 'thin',
  scrollbarColor: `${thumb} ${track}`
});

const buildSettings = (border: string, track: string, thumb: string): ThemeOptions => ({
  typography: {
    fontFamily: SANS,
    h1: serifHeading('2.25rem', '-0.5px', 1.15),
    h2: serifHeading('1.75rem', '-0.3px', 1.2),
    h3: serifHeading('1.5rem', '-0.2px', 1.25),
    h4: { ...serifHeading('1.25rem', '0', 1.3) },
    h5: { fontWeight: 500, fontSize: '1.125rem' },
    h6: { fontWeight: 500, fontSize: '1rem' },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } }
    },
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 12, backgroundImage: 'none' } }
    },
    MuiCard: {
      styleOverrides: { root: { border: `1px solid ${border}`, boxShadow: 'none' } }
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: scrollbar(track, thumb),
        '*': scrollbar(track, thumb)
      }
    }
  }
});

export const lightTheme = createTheme({
  ...buildSettings('#e6dfd8', '#efe9de', '#cc785c'),
  palette: {
    mode: 'light',
    primary: { main: '#cc785c', dark: '#a9583e', contrastText: '#ffffff' },
    secondary: { main: '#5db8a6', contrastText: '#141413' },
    info: { main: '#5db8a6' },
    success: { main: '#5db872' },
    warning: { main: '#d4a017' },
    error: { main: '#c64545' },
    background: {
      default: '#faf9f5',
      paper: '#ffffff'
    },
    text: {
      primary: '#141413',
      secondary: '#6c6a64'
    },
    divider: '#e6dfd8',
    customBorder: '#e6dfd8'
  }
});

export const darkTheme = createTheme({
  ...buildSettings('#33302b', '#252320', '#cc785c'),
  palette: {
    mode: 'dark',
    primary: { main: '#d98b70', dark: '#cc785c', contrastText: '#141413' },
    secondary: { main: '#5db8a6', contrastText: '#141413' },
    info: { main: '#5db8a6' },
    success: { main: '#5db872' },
    warning: { main: '#e8a55a' },
    error: { main: '#e06a6a' },
    background: {
      default: '#181715',
      paper: '#1f1e1b'
    },
    text: {
      primary: '#faf9f5',
      secondary: '#a09d96'
    },
    divider: '#33302b',
    customBorder: '#33302b'
  }
});
