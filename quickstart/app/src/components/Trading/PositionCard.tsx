import { useState, useEffect } from 'react';
import { useTradingStore, Position } from '../../stores/tradingStore';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePerpRouter } from '../../hooks/usePerpRouter';
import { generateClosePositionProof } from '../../services/proofService';
import { calculatePnL, calculateLiquidationPrice } from '../../services/pnlService';
import { updateOraclePriceFromPyth } from '../../services/oracleService';
import { fetchPythPrice } from '../../services/pythService';
import { CONTRACTS, NETWORK, MARKET_INFO } from '../../config/contracts';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
  const removePosition = useTradingStore((state) => state.removePosition);
  const ztarknetAccount = useTradingStore((state) => state.ztarknetAccount);
  const isZtarknetReady = useTradingStore((state) => state.isZtarknetReady);
  const { closePosition } = usePerpRouter();
  
  const [isClosing, setIsClosing] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [pnlData, setPnlData] = useState<{ pnl: number; pnlPercent: number; roe: number } | null>(null);
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null);

  // Fetch current price from Pyth Network and calculate PnL in real-time
  useEffect(() => {
    if (!position.entryPrice || !position.size || !position.margin) return;

    const fetchPriceAndCalculatePnL = async () => {
      try {
        // Fetch from Pyth Network (same as MarketSelector)
        const priceData = await fetchPythPrice();
        const price = priceData.price; // Price in USD (already formatted)
        setCurrentPrice(price);

        // Calculate PnL
        const pnl = calculatePnL(position, price, position.leverage || 20);
        setPnlData(pnl);

        // Calculate liquidation price
        const liqPrice = calculateLiquidationPrice(position, position.leverage || 20);
        setLiquidationPrice(liqPrice);
      } catch (error) {
        console.error('Error fetching price from Pyth for PnL calculation:', error);
        // Don't set price to 0 on error, keep last known price
      }
    };

    fetchPriceAndCalculatePnL();
    
    // Update every 5 seconds
    const interval = setInterval(fetchPriceAndCalculatePnL, 5000);
    return () => clearInterval(interval);
  }, [position]);

  const handleClose = async () => {
    if (!isZtarknetReady || !ztarknetAccount) {
      toast.error('Please set up your Ztarknet trading wallet first');
      return;
    }

    if (!position.traderSecret) {
      toast.error('Position data incomplete. Cannot close position.');
      return;
    }

    setIsClosing(true);
    const progressToast = toast.loading('Preparing to close position...', {
      description: 'Step 1/4: Checking oracle price',
    });

    try {
      // Step 1: Update oracle price if needed
      let updatedPrice = currentPrice;
      if (currentPrice) {
        try {
          toast.loading('Checking oracle price...', {
            id: progressToast,
            description: 'Step 1/4: Updating oracle if needed',
          });

          const oracleUpdateResult = await updateOraclePriceFromPyth(ztarknetAccount, position.marketId);
          if (!oracleUpdateResult.skipped && oracleUpdateResult.txHash) {
            toast.success('Oracle price updated!', {
              id: progressToast,
              description: 'Step 1/4: Updated from Pyth Network',
              action: {
                label: 'View Transaction',
                onClick: () => window.open(`${NETWORK.EXPLORER_URL}/tx/${oracleUpdateResult.txHash}`, '_blank'),
              },
              duration: 3000,
            });
          }
          
          const priceDecimals = MARKET_INFO[position.marketId as keyof typeof MARKET_INFO]?.decimals || 8;
          updatedPrice = oracleUpdateResult.price;
          const priceInOracleFormat = (updatedPrice * (10 ** priceDecimals)).toString();
          
          // Step 2: Convert position data to wei format
          const marginWei = BigInt(Math.floor(parseFloat(position.margin || '0') * 1e18));
          const positionSizeWei = BigInt(Math.floor(parseFloat(position.size || '0') * 1e18));
          const entryPriceWei = BigInt(Math.floor(parseFloat(position.entryPrice || '0') * (10 ** priceDecimals)));

          // Step 3: Generate proof
          toast.loading('Generating ZK proof...', {
            id: progressToast,
            description: 'Step 2/4: This may take 10-30 seconds',
          });

          const now = Math.floor(Date.now() / 1000);
          const proofResult = await generateClosePositionProof({
            privateMargin: marginWei.toString(),
            privatePositionSize: positionSizeWei.toString(),
            privateEntryPrice: entryPriceWei.toString(),
            privateTraderSecret: position.traderSecret,
            isLong: position.isLong,
            marketId: position.marketId,
            currentPrice: priceInOracleFormat,
            closingSize: positionSizeWei.toString(), // Full close
            currentTime: now,
            priceTimestamp: now,
            numSources: 3,
            minSources: 2,
            maxPriceAge: 60,
            tradingFeeBps: 10, // 0.1%
          });

          // Step 4: Submit close transaction
          toast.loading('Submitting transaction...', {
            id: progressToast,
            description: 'Step 3/4: Sending to blockchain',
          });

          const tx = await closePosition(
            proofResult.proof,
            proofResult.publicInputs,
            position.commitment
          );

          // Step 5: Wait for confirmation
          toast.loading('Waiting for confirmation...', {
            id: progressToast,
            description: 'Step 4/4: Confirming on-chain',
          });

          await ztarknetAccount.waitForTransaction(tx.transaction_hash);
          
          toast.dismiss(progressToast);

          // Show success
          toast.success('Position closed successfully!', {
            action: {
              label: 'View Transaction',
              onClick: () => window.open(`${NETWORK.EXPLORER_URL}/tx/${tx.transaction_hash}`, '_blank'),
            },
            duration: 10000,
          });

          // Remove position from store
          removePosition(position.commitment);
        } catch (oracleError: any) {
          console.warn('Failed to update oracle, using current price:', oracleError);
          toast.warning('Using cached oracle price', {
            id: progressToast,
            description: 'Step 1/4: Oracle update skipped',
            duration: 2000,
          });
        }
      } else {
        toast.error('Unable to fetch current price');
      }
    } catch (error: any) {
      console.error('Close position error:', error);
      toast.dismiss(progressToast);
      toast.error(error.message || 'Failed to close position');
    } finally {
      setIsClosing(false);
    }
  };

  // Format PnL display
  const displayPnL = pnlData ? pnlData.pnl : (position.pnl ? parseFloat(position.pnl) : 0);
  const displayROE = pnlData ? pnlData.roe : 0;

  // Calculate position value
  const positionValue = position.size && currentPrice !== null
    ? parseFloat(position.size) * currentPrice
    : null;

  return (
    <div
      className={`p-3 rounded border text-xs ${
        position.isLong
          ? 'bg-[#50d2c1]/10 border-[#50d2c1]/30'
          : 'bg-red-900/20 border-red-700/50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {position.isLong ? (
            <ArrowUp className="text-[#50d2c1]" size={14} />
          ) : (
            <ArrowDown className="text-red-400" size={14} />
          )}
          <span className="font-medium text-white text-xs">
            {position.isLong ? 'Long' : 'Short'} {position.leverage ? `${position.leverage}x` : ''}
          </span>
          <span className="text-gray-400 text-xs">
            BTC
          </span>
        </div>
        <button
          onClick={handleClose}
          disabled={isClosing || !isZtarknetReady}
          className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isClosing ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.2)',
            color: isClosing ? 'rgba(255,255,255,0.5)' : '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          {isClosing ? 'Closing...' : 'Close'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        {position.size && (
          <div>
            <div className="text-gray-400 mb-1">Size</div>
            <div className="text-white font-semibold">
              {parseFloat(position.size).toFixed(8)} BTC
            </div>
          </div>
        )}

        {positionValue !== null && (
          <div>
            <div className="text-gray-400 mb-1">Position Value</div>
            <div className="text-white font-semibold">
              ${positionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {position.entryPrice && (
          <div>
            <div className="text-gray-400 mb-1">Entry Price</div>
            <div className="text-white font-semibold">
              ${parseFloat(position.entryPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        {currentPrice !== null && (
          <div>
            <div className="text-gray-400 mb-1">Mark Price</div>
            <div className="text-white font-semibold">
              ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        <div className="col-span-2">
          <div className="text-gray-400 mb-1">PnL (ROE %)</div>
          <div
            className={`font-semibold text-sm ${
              displayPnL >= 0 ? 'text-[#50d2c1]' : 'text-red-400'
            }`}
          >
            {displayPnL >= 0 ? '+' : ''}${displayPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            {displayROE !== 0 && (
              <span className="ml-2 text-xs">
                ({displayROE >= 0 ? '+' : ''}
                {displayROE.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        {liquidationPrice !== null && (
          <div>
            <div className="text-gray-400 mb-1">Liq. Price</div>
            <div className="text-white font-semibold text-xs">
              ${liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        {position.margin && (
          <div>
            <div className="text-gray-400 mb-1">Margin</div>
            <div className="text-white font-semibold">
              {parseFloat(position.margin).toLocaleString(undefined, { maximumFractionDigits: 2 })} yUSD
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          Commitment: {position.commitment.slice(0, 16)}...
        </div>
        <div className="text-xs text-gray-500">
          Opened: {new Date(position.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
