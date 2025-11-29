import { useEffect } from 'react';
import { useTradingStore } from '../stores/tradingStore';
import { updateOraclePricesFromFeed } from '../services/oracleService';

/**
 * Hook to periodically update oracle prices from Pyth Network
 * Note: This is now optional since we update prices before each position
 * Keeping it for background updates if needed
 */
export function useOraclePriceUpdater(updateInterval: number = 300000) {
  const ztarknetAccount = useTradingStore((state) => state.ztarknetAccount);
  const isZtarknetReady = useTradingStore((state) => state.isZtarknetReady);

  useEffect(() => {
    if (!isZtarknetReady || !ztarknetAccount) return;

    // Update prices in background (less frequent since we update before each trade)
    const updatePrices = async () => {
      try {
        await updateOraclePricesFromFeed(ztarknetAccount);
        console.log('Oracle prices updated successfully (background)');
      } catch (error) {
        console.error('Failed to update oracle prices (background):', error);
        // Don't show toast for background updates to avoid spam
      }
    };

    // Set up interval for periodic updates (every 5 minutes by default)
    const interval = setInterval(updatePrices, updateInterval);

    return () => clearInterval(interval);
  }, [ztarknetAccount, isZtarknetReady, updateInterval]);
}

