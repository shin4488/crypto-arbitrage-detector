# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time cryptocurrency arbitrage detection system that monitors price differences between exchanges (Binance and OKX) and identifies profitable trading opportunities. The system consists of:

- **Backend**: Go-based WebSocket server that connects to exchange APIs and calculates arbitrage opportunities
- **Frontend**: React TypeScript application with real-time UI updates and flash animations
- **Deployment**: Docker-based containerized deployment with docker-compose

## Architecture

The system uses a microservices architecture with WebSocket communication:

```
Binance WebSocket ─┐
                   ├─► Go Backend (arbitrage engine) ─► WebSocket ─► React Frontend
OKX WebSocket ─────┘
```

Key components:
- `backend/arbitrage/engine.go`: Core arbitrage detection algorithm
- `backend/exchanges/`: Exchange client implementations (Binance, OKX)
- `backend/server/websocket.go`: WebSocket hub for real-time communication
- `frontend/src/components/ArbitrageCard.tsx`: Main UI component with flash animations
- `frontend/src/hooks/useWebSocket.ts`: WebSocket client connection management

## Development Commands

### Backend (Go)
```bash
cd backend

# Development workflow
make dev              # Format, vet, test, and run
make run             # Run application directly
make run-race        # Run with race detection
make test            # Run tests
make test-coverage   # Run tests with coverage report
make build           # Build binary
make fmt             # Format code
make vet             # Vet code
make lint            # Lint code (requires golangci-lint)
make clean           # Clean build artifacts
```

### Frontend (React/TypeScript)
```bash
cd frontend

# Development
npm run dev          # Start development server
npm start           # Alternative start command
npm run build       # Build for production
npm test            # Run tests
npm run lint        # Run ESLint
npm run lint:fix    # Run ESLint with auto-fix
npm run format      # Format code with Prettier
npm run format:check # Check formatting
```

### Docker Development
```bash
# Full system startup
docker-compose up --build

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild specific service
docker-compose up --build backend
docker-compose up --build frontend

# Stop services
docker-compose down
docker-compose down -v  # Remove volumes
```

## Key Technical Details

### Supported Trading Pairs
- BTC/USDT (BTCUSDT on Binance, BTC-USDT on OKX)
- ETH/USDT (ETHUSDT on Binance, ETH-USDT on OKX)

### Arbitrage Detection Algorithm
The system analyzes 5 price ordering patterns between exchanges and identifies profitable opportunities:
- **Pattern 1**: Buy OKX ask, Sell Binance bid
- **Pattern 5**: Buy Binance ask, Sell OKX bid
- Other patterns result in losses and are ignored

### Data Flow
1. Exchange WebSocket connections provide real-time bid/ask prices
2. Arbitrage engine calculates opportunities using decimal precision
3. Results are broadcast to frontend via WebSocket
4. UI updates with flash animations for price changes

### Real-time Features
- WebSocket connections for sub-second latency
- Flash animations on price/spread changes
- Connection status monitoring
- Automatic reconnection handling

## Testing

Run tests before committing changes:
```bash
# Backend tests
cd backend && make test

# Frontend tests  
cd frontend && npm test
```

## Adding New Trading Pairs

To add new trading pairs, update the symbol arrays in `backend/main.go`:

```go
// Binance symbols
binanceSymbols := []string{"BTCUSDT", "ETHUSDT", "NEWPAIR"}

// OKX symbols  
okxSymbols := []string{"BTC-USDT", "ETH-USDT", "NEW-PAIR"}
```

Ensure symbol formats match each exchange's requirements.

## Service Endpoints

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Health check: http://localhost:8080/health
- WebSocket: ws://localhost:8080/ws

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 3000/8080 are available
2. **WebSocket connection errors**: Verify backend is running and accessible
3. **Container startup failures**: Check logs with `docker-compose logs`
4. **Exchange connection issues**: Monitor exchange status in health endpoint

### Development Notes
- The system requires both exchange connections to function properly
- Price data is considered stale after 30 seconds
- Arbitrage opportunities are calculated using decimal precision for accuracy
- Flash animations trigger on any price/spread changes without thresholds