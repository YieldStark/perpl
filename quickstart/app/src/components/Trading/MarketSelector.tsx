import { useTradingStore } from '../../stores/tradingStore';
import { MARKETS, MARKET_INFO } from '../../config/contracts';
import { useEffect, useState } from 'react';
import { fetchPythPrice } from '../../services/pythService';
import { ChevronDown } from 'lucide-react';

export function MarketSelector() {
  const selectedMarket = useTradingStore((state) => state.selectedMarket);
  const setSelectedMarket = useTradingStore((state) => state.setSelectedMarket);
  const markets = useTradingStore((state) => state.markets);
  const setMarkets = useTradingStore((state) => state.setMarkets);
  const [fundingCountdown, setFundingCountdown] = useState('00:00:00');

  const currentMarket = markets.find((m) => m.marketId === selectedMarket);

  // Mock data for 24h volume
  const mockVolume24h = 3231779581.83;
  const mockOpenInterest = 2331160196.93;
  const mockPriceChange24h = 3931;
  const mockPriceChangePercent = 4.51;
  const mockFundingRate = 0.0008;

  // Countdown timer for funding
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = nextHour.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setFundingCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch prices from Pyth Network - only BTC/USD for now
  useEffect(() => {
    const fetchAllPrices = async () => {
      try {
        // Only fetch BTC/USD
        const marketDataPromises = [[MARKETS.BTC_USD, 'BTC_USD']].map(async ([marketId, key]) => {
          try {
            const priceData = await fetchPythPrice();
            console.log('MarketSelector: Fetched price from Pyth:', priceData);
            
            // Ensure price is valid
            if (!priceData || !priceData.price || priceData.price <= 0 || isNaN(priceData.price)) {
              console.warn('MarketSelector: Invalid price data from Pyth:', priceData);
              throw new Error('Invalid price data');
            }
            
            const price = priceData.price.toString();
            console.log('MarketSelector: Setting price to:', price);

            return {
              marketId,
              symbol: MARKET_INFO[marketId as keyof typeof MARKET_INFO]?.symbol || key,
              currentPrice: price,
              priceChange24h: mockPriceChangePercent.toString(),
              volume24h: mockVolume24h.toString(),
              openInterest: mockOpenInterest.toString(),
            };
          } catch (error) {
            console.error('MarketSelector: Error fetching price for', marketId, error);
            // Return with a fallback price instead of '0' to help debug
            return {
              marketId,
              symbol: MARKET_INFO[marketId as keyof typeof MARKET_INFO]?.symbol || key,
              currentPrice: '0', // Will show as 0 if fetch fails
              priceChange24h: mockPriceChangePercent.toString(),
              volume24h: mockVolume24h.toString(),
              openInterest: mockOpenInterest.toString(),
            };
          }
        });

        const marketData = (await Promise.all(marketDataPromises)).filter(Boolean);
        console.log('MarketSelector: Setting markets data:', marketData);
        setMarkets(marketData);
      } catch (error) {
        console.error('Error fetching market prices:', error);
        // Set empty markets on error to prevent UI breakage
        setMarkets([]);
      }
    };

    fetchAllPrices();

    // Poll for price updates every 10 seconds
    const interval = setInterval(() => {
      fetchAllPrices();
    }, 10000);

    return () => clearInterval(interval);
  }, [setMarkets]);

  const formatPrice = (price: string | undefined): string => {
    try {
      const num = parseFloat(price || '0');
      return isNaN(num) ? '0' : Math.round(num).toLocaleString();
    } catch {
      return '0';
    }
  };

  const formatLargeNumber = (value: string | undefined): string => {
    try {
      const num = parseFloat(value || '0');
      return isNaN(num) ? '0' : num.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    } catch {
      return '0';
    }
  };

  return (
    <div className="px-2 py-2">
      <div className="bg-[#0f1a1f] rounded border border-[rgba(255,255,255,0.1)] px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Market Selector with BTC Logo */}
          <div className="flex items-center gap-2">
            {[MARKETS.BTC_USD].map((marketId) => {
              const info = MARKET_INFO[marketId as keyof typeof MARKET_INFO];
              if (!info) return null;

              return (
                <button
                  key={marketId}
                  onClick={() => setSelectedMarket(marketId)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                >
                  {/* BTC Logo - Orange circle with Bitcoin symbol */}
                  <div className="w-6 h-6 rounded-full bg-[#f7931a] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">₿</span>
                  </div>
                  <span className="text-sm font-medium text-white">BTC-USDC</span>
                  <ChevronDown size={14} className="text-white/70 group-hover:text-white transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Right: Market Stats */}
          {currentMarket ? (
            <div className="flex items-center gap-8 text-xs">
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Mark</span>
                <span className="text-white font-medium text-sm">
                  {currentMarket.currentPrice && parseFloat(currentMarket.currentPrice) > 0
                    ? formatPrice(currentMarket.currentPrice)
                    : 'Loading...'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Oracle</span>
                <span className="text-white font-medium text-sm">
                  {(() => {
                    if (!currentMarket.currentPrice || parseFloat(currentMarket.currentPrice) <= 0) {
                      return 'Loading...';
                    }
                    const markPrice = parseFloat(currentMarket.currentPrice);
                    // Oracle price is slightly different (like in the image: Mark 91,168 vs Oracle 91,206)
                    const oraclePrice = markPrice + (markPrice * 0.0004); // ~0.04% difference
                    return formatPrice(oraclePrice.toString());
                  })()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5">24h Change</span>
                <div className="flex items-center gap-1">
                  <span className="text-[#50d2c1] font-medium text-sm">
                    +{mockPriceChange24h.toLocaleString()}
                  </span>
                  <span className="text-[#50d2c1] font-medium text-sm">
                    +{mockPriceChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5">24h Volume</span>
                <span className="text-white font-medium text-sm">
                  ${formatLargeNumber(currentMarket.volume24h)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Open Interest</span>
                <span className="text-white font-medium text-sm">
                  ${formatLargeNumber(currentMarket.openInterest)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Funding / Countdown</span>
                <div className="flex items-center gap-1">
                  <span className="text-[#50d2c1] font-medium text-sm">
                    {mockFundingRate.toFixed(4)}%
                  </span>
                  <span className="text-white/70 font-medium text-sm">
                    {fundingCountdown}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-8 text-xs">
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Mark</span>
                <span className="text-white font-medium text-sm">Loading...</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/50 text-[10px] mb-0.5 underline">Oracle</span>
                <span className="text-white font-medium text-sm">Loading...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
