import { useState, useEffect, useRef } from 'react';
import { ArbitrageData } from '../data/mockData';

export const useFlashAnimation = (
  arbitrageData: Record<string, ArbitrageData>
) => {
  const [flashingElements, setFlashingElements] = useState<Set<string>>(
    new Set()
  );
  const prevDataRef = useRef<Record<string, ArbitrageData>>({});
  const dataStringRef = useRef<Record<string, string>>({});

  useEffect(() => {
    console.log('🎬 useFlashAnimation - useEffect triggered');
    console.log('🎬 Current arbitrageData:', arbitrageData);

    const newFlashingElements = new Set<string>();

    Object.entries(arbitrageData).forEach(([pair, data]) => {
      console.log(`🎬 Processing pair: ${pair}`);

      const prevData = prevDataRef.current[pair];

      // Create a unique string representation for comparison
      const currentDataString = JSON.stringify({
        buy_price: data.buy_price,
        sell_price: data.sell_price,
        amount: data.amount,
        spread: data.spread,
        buy_exchange: data.buy_exchange,
        sell_exchange: data.sell_exchange,
        no_chance: data.no_chance,
      });

      const prevDataString = dataStringRef.current[pair];

      console.log(`🎬 ${pair} - prevDataString:`, prevDataString);
      console.log(`🎬 ${pair} - currentDataString:`, currentDataString);

      // Check if this is actually new data
      const isNewData = currentDataString !== prevDataString;
      console.log(`🎬 ${pair} - isNewData: ${isNewData}`);

      if (prevData && isNewData) {
        // Improved number comparison function with better precision handling
        const hasChanged = (prev: any, current: any, fieldName: string) => {
          // Convert to numbers for comparison
          const prevNum = Number(prev);
          const currentNum = Number(current);

          // Use a small epsilon for floating point comparison
          const epsilon = 1e-10;
          const changed = Math.abs(prevNum - currentNum) > epsilon;

          if (changed) {
            console.log(
              `📈 ${fieldName} changed: ${prevNum} -> ${currentNum} (diff: ${Math.abs(prevNum - currentNum)})`
            );
          }
          return changed;
        };

        // Check for exchange changes (always trigger animation)
        const exchangeChanged =
          prevData.buy_exchange !== data.buy_exchange ||
          prevData.sell_exchange !== data.sell_exchange;

        if (exchangeChanged) {
          console.log(`🔄 Exchange changed for ${pair}`);
          newFlashingElements.add(`${pair}-buy-price`);
          newFlashingElements.add(`${pair}-sell-price`);
          newFlashingElements.add(`${pair}-buy-amount`);
          newFlashingElements.add(`${pair}-sell-amount`);
          newFlashingElements.add(`${pair}-spread`);
        } else {
          // Check individual field changes
          if (hasChanged(prevData.buy_price, data.buy_price, 'buy_price')) {
            newFlashingElements.add(`${pair}-buy-price`);
            newFlashingElements.add(`${pair}-buy-amount`);
            console.log(`🔥 Buy price flash: ${pair}`);
          }

          if (hasChanged(prevData.sell_price, data.sell_price, 'sell_price')) {
            newFlashingElements.add(`${pair}-sell-price`);
            newFlashingElements.add(`${pair}-sell-amount`);
            console.log(`🔥 Sell price flash: ${pair}`);
          }

          if (hasChanged(prevData.spread, data.spread, 'spread')) {
            newFlashingElements.add(`${pair}-spread`);
            console.log(`🔥 Spread flash: ${pair}`);
          }

          if (hasChanged(prevData.amount, data.amount, 'amount')) {
            newFlashingElements.add(`${pair}-buy-amount`);
            newFlashingElements.add(`${pair}-sell-amount`);
            console.log(`🔥 Amount flash: ${pair}`);
          }
        }

        // Check for no_chance status change
        if (prevData.no_chance !== data.no_chance) {
          console.log(
            `🔄 No chance status changed for ${pair}: ${prevData.no_chance} -> ${data.no_chance}`
          );
          newFlashingElements.add(`${pair}-spread`);
        }
      } else if (!prevData) {
        // Initial data - no animation but log
        console.log(`📊 Initial data received: ${pair}`);
      }

      // Always update references for next comparison
      dataStringRef.current[pair] = currentDataString;
    });

    console.log(`🎬 New flashing elements:`, newFlashingElements);

    if (newFlashingElements.size > 0) {
      console.log(`🎬 Setting flashing elements:`, newFlashingElements);
      setFlashingElements(newFlashingElements);

      // Clear animations after 1.2 seconds
      const timer = setTimeout(() => {
        console.log(`🎬 Clearing flashing elements`);
        setFlashingElements(new Set());
      }, 1200);

      return () => clearTimeout(timer);
    }

    // Update previous data reference for next comparison
    console.log(`🎬 Updating prevDataRef.current with:`, arbitrageData);
    prevDataRef.current = { ...arbitrageData };
  }, [arbitrageData]);

  console.log(
    `🎬 useFlashAnimation returning flashingElements:`,
    flashingElements
  );
  return flashingElements;
};
