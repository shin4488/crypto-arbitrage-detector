import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { ArbitrageData } from '../data/mockData';
import { formatPrice, formatAmount, formatSpread } from '../utils/formatters';
import { useTranslations } from '../utils/localization';

interface ArbitrageCardProps {
  data: ArbitrageData;
  flashingElements: Set<string>;
}

export const ArbitrageCard: React.FC<ArbitrageCardProps> = ({
  data,
  flashingElements,
}) => {
  const t = useTranslations();

  // デバッグ用ログ
  React.useEffect(() => {
    console.log(`💳 ArbitrageCard ${data.pair} - received data:`, data);
    console.log(
      `💳 ArbitrageCard ${data.pair} - buy_price:`,
      data.buy_price,
      typeof data.buy_price
    );
    console.log(
      `💳 ArbitrageCard ${data.pair} - formatted buy_price:`,
      formatPrice(data.buy_price)
    );
  }, [data]);

  const getExchangeBadgeColor = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'binance':
        return '#22d3ee'; // cyan-300
      case 'okx':
        return '#bbf7d0'; // green-200
      case 'coinbase':
        return '#c7d2fe'; // indigo-200
      case 'kraken':
        return '#ddd6fe'; // purple-200
      default:
        return '#d1d5db'; // gray-300
    }
  };

  const getExchangeTextColor = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'binance':
        return '#1e40af'; // blue-800
      case 'okx':
        return '#166534'; // green-800
      case 'coinbase':
        return '#3730a3'; // indigo-800
      case 'kraken':
        return '#6b21a8'; // purple-800
      default:
        return '#374151'; // gray-700
    }
  };

  // Check if this is a "no chance" situation
  if (data.no_chance) {
    return (
      <Grid item xs={12} md={6}>
        <Card
          sx={{
            background: '#271e2d',
            border: '1px solid #374151',
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            {/* Trading Pair Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography
                variant='h6'
                sx={{
                  color: '#f1f5f9',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                }}
              >
                {data.pair}
              </Typography>
            </Box>

            {/* Trading Section - Left/Right Layout */}
            <Box
              sx={{ display: 'flex', alignItems: 'center', mb: 2.5, gap: 2 }}
            >
              {/* Buy Section - Left */}
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Chip
                  label='-'
                  sx={{
                    backgroundColor: '#6b7280',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    mb: 1.5,
                  }}
                />
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 0.5,
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant='body1'
                      sx={{ fontWeight: 700, color: '#6b7280' }}
                    >
                      -
                    </Typography>
                    <Chip
                      label={t.buy}
                      size='small'
                      sx={{
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Typography
                    variant='h3'
                    sx={{
                      fontWeight: 700,
                      color: '#6b7280',
                      fontSize: { xs: '1.5rem', md: '2rem' },
                    }}
                  >
                    -
                  </Typography>
                </Box>
              </Box>

              {/* Arrow */}
              <ArrowForward sx={{ color: '#6366f1', fontSize: '2rem' }} />

              {/* Sell Section - Right */}
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Chip
                  label='-'
                  sx={{
                    backgroundColor: '#6b7280',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    mb: 1.5,
                  }}
                />
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 0.5,
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant='body1'
                      sx={{ fontWeight: 700, color: '#6b7280' }}
                    >
                      -
                    </Typography>
                    <Chip
                      label={t.sell}
                      size='small'
                      sx={{
                        backgroundColor: 'rgba(244, 114, 182, 0.2)',
                        color: '#f472b6',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Typography
                    variant='h3'
                    sx={{
                      fontWeight: 700,
                      color: '#6b7280',
                      fontSize: { xs: '1.5rem', md: '2rem' },
                    }}
                  >
                    -
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Profit/Spread */}
            <Box
              sx={{
                background: '#312d3c',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 3,
                p: 2,
                textAlign: 'center',
              }}
            >
              <Typography
                variant='h4'
                sx={{
                  fontWeight: 700,
                  color: '#f87171',
                  mb: 0.5,
                }}
              >
                {t.noArbitrageChance}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  }

  // Normal arbitrage opportunity display
  return (
    <Grid item xs={12} md={6}>
      <Card
        sx={{
          background: '#271e2d',
          border: '1px solid #374151',
          borderRadius: 2,
          transition: 'all 0.3s ease',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Trading Pair Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant='h6'
              sx={{
                color: '#f1f5f9',
                fontWeight: 600,
                fontSize: '1.1rem',
              }}
            >
              {data.pair}
            </Typography>
          </Box>

          {/* Trading Section - Left/Right Layout */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5, gap: 2 }}>
            {/* Buy Section - Left */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Chip
                label={data.buy_exchange}
                sx={{
                  backgroundColor: getExchangeBadgeColor(data.buy_exchange),
                  color: getExchangeTextColor(data.buy_exchange),
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  mb: 1.5,
                }}
              />
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 0.5,
                    gap: 1,
                    animation: flashingElements.has(`${data.pair}-buy-amount`)
                      ? 'flash 1.2s cubic-bezier(0.4, 0, 0.6, 1)'
                      : 'none',
                    borderRadius: 1,
                    padding: '4px 8px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}
                  >
                    <Typography
                      variant='body1'
                      sx={{ fontWeight: 700, color: '#fcd34d' }}
                    >
                      {formatAmount(data.amount, data.pair)}
                    </Typography>
                  </Box>
                  <Chip
                    label={t.buy}
                    size='small'
                    sx={{
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      fontWeight: 700,
                    }}
                  />
                </Box>
                <Typography
                  variant='h3'
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    animation: flashingElements.has(`${data.pair}-buy-price`)
                      ? 'flash 1.2s cubic-bezier(0.4, 0, 0.6, 1)'
                      : 'none',
                    borderRadius: 1,
                    padding: '4px 8px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {formatPrice(data.buy_price)}
                </Typography>
              </Box>
            </Box>

            {/* Arrow */}
            <ArrowForward sx={{ color: '#60a5fa', fontSize: '2rem' }} />

            {/* Sell Section - Right */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Chip
                label={data.sell_exchange}
                sx={{
                  backgroundColor: getExchangeBadgeColor(data.sell_exchange),
                  color: getExchangeTextColor(data.sell_exchange),
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  mb: 1.5,
                }}
              />
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 0.5,
                    gap: 1,
                    animation: flashingElements.has(`${data.pair}-sell-amount`)
                      ? 'flash 1.2s cubic-bezier(0.4, 0, 0.6, 1)'
                      : 'none',
                    borderRadius: 1,
                    padding: '4px 8px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}
                  >
                    <Typography
                      variant='body1'
                      sx={{ fontWeight: 700, color: '#fcd34d' }}
                    >
                      {formatAmount(data.amount, data.pair)}
                    </Typography>
                  </Box>
                  <Chip
                    label={t.sell}
                    size='small'
                    sx={{
                      backgroundColor: 'rgba(244, 114, 182, 0.2)',
                      color: '#f472b6',
                      fontWeight: 700,
                    }}
                  />
                </Box>
                <Typography
                  variant='h3'
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    animation: flashingElements.has(`${data.pair}-sell-price`)
                      ? 'flash 1.2s cubic-bezier(0.4, 0, 0.6, 1)'
                      : 'none',
                    borderRadius: 1,
                    padding: '4px 8px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {formatPrice(data.sell_price)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Profit/Spread */}
          <Box
            sx={{
              background: '#312d3c',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 3,
              p: 2,
              textAlign: 'center',
            }}
          >
            <Typography
              variant='body2'
              sx={{
                color: '#10b981',
                fontWeight: 600,
                mb: 0.5,
                textTransform: 'uppercase',
                fontSize: '0.8rem',
                letterSpacing: '0.5px',
              }}
            >
              {t.profit.toUpperCase()}
            </Typography>
            <Typography
              variant='h4'
              sx={{
                fontWeight: 700,
                color: '#6ee7b7',
                mb: 0.5,
                animation: flashingElements.has(`${data.pair}-spread`)
                  ? 'flash 1.2s cubic-bezier(0.4, 0, 0.6, 1)'
                  : 'none',
                borderRadius: 1,
                padding: '4px 8px',
                transition: 'all 0.3s ease',
              }}
            >
              {formatSpread(data.spread, data.currency)}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
};
