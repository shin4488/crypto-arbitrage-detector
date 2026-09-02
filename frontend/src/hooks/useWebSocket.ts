import { useState, useEffect, useRef } from 'react';
import { ArbitrageData } from '../data/mockData';

export const useWebSocket = () => {
  const [arbitrageData, setArbitrageData] = useState<
    Record<string, ArbitrageData>
  >({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws';
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setWsConnected(true);
        };

        wsRef.current.onmessage = event => {
          try {
            const data: ArbitrageData = JSON.parse(event.data);
            console.log('🔌 Received WebSocket data:', data);

            // タイムスタンプを追加してデータ更新を確実に検知
            const dataWithTimestamp = {
              ...data,
              _updateTime: Date.now(),
            };

            console.log('🔄 Updating state with data:', dataWithTimestamp);

            setArbitrageData(prev => {
              const newData = {
                ...prev,
                [data.pair]: dataWithTimestamp,
              };
              console.log('📊 New arbitrageData state:', newData);
              console.log('📊 Previous arbitrageData state:', prev);
              return newData;
            });
          } catch (error) {
            console.error('Error parsing WebSocket data:', error);
          }
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          setWsConnected(false);
          setTimeout(connectWebSocket, 3000);
        };

        wsRef.current.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    arbitrageData,
    wsConnected,
  };
};
