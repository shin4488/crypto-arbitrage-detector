import { createTheme } from '@mui/material';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8', // sky-400
    },
    background: {
      default: '#0f172a', // slate-900
      paper: '#271e2d', // カスタム濃い紫グレー
    },
    text: {
      primary: '#ffffff',
      secondary: '#cbd5e1', // slate-300
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          backgroundColor: '#0f172a',
        },
        html: {
          margin: 0,
          padding: 0,
        },
        '*': {
          boxSizing: 'border-box',
        },
        '@keyframes flash': {
          '0%': {
            boxShadow: '0 0 0 0px rgba(96, 165, 250, 0.6)',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            transform: 'scale(1)',
          },
          '15%': {
            boxShadow: '0 0 25px 5px rgba(96, 165, 250, 0.4)',
            backgroundColor: 'rgba(96, 165, 250, 0.25)',
            transform: 'scale(1.02)',
          },
          '30%': {
            boxShadow: '0 0 20px 3px rgba(96, 165, 250, 0.3)',
            backgroundColor: 'rgba(96, 165, 250, 0.2)',
            transform: 'scale(1.01)',
          },
          '60%': {
            boxShadow: '0 0 10px 2px rgba(96, 165, 250, 0.2)',
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
            transform: 'scale(1)',
          },
          '100%': {
            boxShadow: 'none',
            backgroundColor: 'transparent',
            transform: 'scale(1)',
          },
        },
        '@keyframes priceFlash': {
          '0%': {
            boxShadow: '0 0 0 0px rgba(96, 165, 250, 0.6)',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            transform: 'scale(1)',
          },
          '15%': {
            boxShadow: '0 0 25px 5px rgba(96, 165, 250, 0.4)',
            backgroundColor: 'rgba(96, 165, 250, 0.25)',
            transform: 'scale(1.02)',
          },
          '30%': {
            boxShadow: '0 0 20px 3px rgba(96, 165, 250, 0.3)',
            backgroundColor: 'rgba(96, 165, 250, 0.2)',
            transform: 'scale(1.01)',
          },
          '60%': {
            boxShadow: '0 0 10px 2px rgba(96, 165, 250, 0.2)',
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
            transform: 'scale(1)',
          },
          '100%': {
            boxShadow: 'none',
            backgroundColor: 'transparent',
            transform: 'scale(1)',
          },
        },
        '.price-flash': {
          animation: 'priceFlash 1.2s cubic-bezier(0.47, 1.64, 0.41, 0.8)',
          borderRadius: '8px',
          transition: 'all 0.3s ease',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: '#271e2d',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(96, 165, 250, 0.3)', // blue-400/30
          borderRadius: 16,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
            borderColor: 'rgba(96, 165, 250, 0.5)',
          },
        },
      },
    },
  },
});
