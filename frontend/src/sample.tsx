import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Container,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { FlashOn } from '@mui/icons-material';
import { ArbitrageData } from './data/mockData';
import { darkTheme } from './theme/darkTheme';
import { useWebSocket } from './hooks/useWebSocket';
import { useFlashAnimation } from './hooks/useFlashAnimation';
import { ArbitrageCard } from './components/ArbitrageCard';
import { useTranslations } from './utils/localization';

const CryptoArbDetector: React.FC = () => {
  const { arbitrageData } = useWebSocket();
  const flashingElements = useFlashAnimation(arbitrageData);
  const t = useTranslations();

  // デバッグ用ログ
  React.useEffect(() => {
    console.log('🎯 CryptoArbDetector - arbitrageData updated:', arbitrageData);
  }, [arbitrageData]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #374151 100%)', // slate-900 to gray-700
          minHeight: '100vh',
          py: 3,
          px: 2,
        }}
      >
        <Container maxWidth='lg'>
          {/* ヘッダー */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <FlashOn sx={{ mr: 1, color: '#38bdf8', fontSize: '2rem' }} />
            <Typography
              variant='h4'
              component='h1'
              sx={{
                background: 'linear-gradient(90deg, #60a5fa 20%, #a78bfa 80%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800,
                letterSpacing: 0.5,
              }}
            >
              {t.title}
            </Typography>
          </Box>

          {/* グリッド */}
          <Grid container spacing={3}>
            {Object.keys(arbitrageData).length === 0 ? (
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant='h5' sx={{ color: '#9ca3af', mb: 2 }}>
                      {t.connecting}
                    </Typography>
                    <Typography variant='body1' sx={{ color: '#6b7280' }}>
                      {t.searchingOpportunities}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              Object.values(arbitrageData).map((data: ArbitrageData) => {
                // デバッグ用ログ
                console.log(
                  `🔍 Rendering ArbitrageCard for ${data.pair}:`,
                  data
                );
                return (
                  <ArbitrageCard
                    key={data.pair}
                    data={data}
                    flashingElements={flashingElements}
                  />
                );
              })
            )}
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default CryptoArbDetector;
