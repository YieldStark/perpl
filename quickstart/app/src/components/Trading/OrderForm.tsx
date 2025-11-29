import { useState, useEffect, useMemo } from 'react';
import { useTradingStore } from '../../stores/tradingStore';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatYusdBalance } from '../../lib/balanceUtils';
import { ApprovalModal } from '../Wallet/ApprovalModal';
import { usePerpRouter } from '../../hooks/usePerpRouter';
import { generateOpenPositionProof } from '../../services/proofService';
import { updateOraclePriceFromPyth } from '../../services/oracleService';
import { fetchPythPrice } from '../../services/pythService';
import { CONTRACTS, NETWORK, MARKET_INFO } from '../../config/contracts';
import '../../App.css';

export function OrderForm() {
  const {
    orderType,
    orderSide,
    orderPrice,
    collateral,
    setOrderType,
    setOrderSide,
    setOrderPrice,
    setCollateral,
    resetOrderForm,
    isZtarknetReady,
    ztarknetAccount,
    availableBalance,
    selectedMarket,
    addPosition,
  } = useTradingStore();

  const { openPosition } = usePerpRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [leverage, setLeverage] = useState<string>('20x');
  const [positionMode, setPositionMode] = useState<'one-way' | 'hedge'>('one-way');
  const [sizePercent, setSizePercent] = useState<number>(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [takeProfitStopLoss, setTakeProfitStopLoss] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<string>('0');

  // Get leverage number from string (e.g., "20x" -> 20)
  const leverageNum = useMemo(() => {
    return parseInt(leverage.replace('x', '')) || 20;
  }, [leverage]);

  // Calculate available balance in wei
  const availableBalanceWei = useMemo(() => {
    return availableBalance || '0';
  }, [availableBalance]);

  // Calculate margin amount from percentage
  const marginFromPercent = useMemo(() => {
    if (!availableBalanceWei || availableBalanceWei === '0') return '0';
    const percent = sizePercent / 100;
    const balance = BigInt(availableBalanceWei);
    const margin = (balance * BigInt(Math.floor(percent * 10000))) / 10000n;
    return margin.toString();
  }, [sizePercent, availableBalanceWei]);

  // Calculate BTC size from margin and leverage
  const calculatedBtcSize = useMemo(() => {
    if (!currentPrice || currentPrice === '0' || !collateral) return '0';
    try {
      const marginWei = BigInt(collateral || '0');
      const price = BigInt(currentPrice);
      const decimals = MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8;
      
      // Position size = (margin * leverage) / price
      // All values need to account for decimals
      const marginValue = Number(marginWei) / 1e18; // yUSD has 18 decimals
      const priceValue = Number(price) / (10 ** decimals);
      const positionSize = (marginValue * leverageNum) / priceValue;
      
      return positionSize.toFixed(8);
    } catch (error) {
      return '0';
    }
  }, [collateral, currentPrice, leverageNum, selectedMarket]);

  // Fetch current price from Pyth Network (same as MarketSelector)
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceData = await fetchPythPrice();
        // Store price in oracle format (with decimals) for proof generation
        const priceDecimals = MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8;
        const priceInOracleFormat = (priceData.price * (10 ** priceDecimals)).toString();
        setCurrentPrice(priceInOracleFormat);
      } catch (error) {
        console.error('Error fetching price from Pyth:', error);
        // Fallback to 0 if fetch fails
        setCurrentPrice('0');
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [selectedMarket]);

  // Update collateral when slider changes
  useEffect(() => {
    if (sizePercent > 0 && marginFromPercent !== '0') {
      const marginFormatted = (Number(marginFromPercent) / 1e18).toFixed(2);
      setCollateral(marginFormatted);
    }
  }, [sizePercent, marginFromPercent, setCollateral]);

  // Update slider when collateral changes manually
  const handleCollateralChange = (value: string) => {
    setCollateral(value);
    if (availableBalanceWei && availableBalanceWei !== '0') {
      const marginWei = BigInt(Math.floor(parseFloat(value || '0') * 1e18));
      const balance = BigInt(availableBalanceWei);
      const percent = Number((marginWei * 10000n) / balance) / 100;
      setSizePercent(Math.min(100, Math.max(0, percent)));
    }
  };

  const handleSizePercentChange = (percent: number) => {
    setSizePercent(Math.min(100, Math.max(0, percent)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isZtarknetReady || !ztarknetAccount) {
      toast.error('Please set up your Ztarknet trading wallet first');
      return;
    }

    if (!collateral || parseFloat(collateral) <= 0) {
      toast.error('Please enter a valid margin amount');
      return;
    }

    if (orderType === 'limit' && (!orderPrice || parseFloat(orderPrice) <= 0)) {
      toast.error('Please enter a valid limit price');
      return;
    }

    // Check if approval is needed
    if (needsApproval) {
      setShowApprovalModal(true);
      return;
    }

    setIsSubmitting(true);
    
    // Show progress indicator
    const progressToast = toast.loading('Preparing position...', {
      description: 'Step 1/4: Checking oracle price',
    });

    try {
      // Step 1: Update oracle price from Pyth Network (only if stale)
      if (!ztarknetAccount) {
        throw new Error('Ztarknet account not available');
      }

      let updatedPrice = currentPrice;
      try {
        toast.loading('Checking oracle price...', {
          id: progressToast,
          description: 'Step 1/4: Checking if oracle needs update',
        });

        const oracleUpdateResult = await updateOraclePriceFromPyth(ztarknetAccount, selectedMarket);
        
        if (oracleUpdateResult.skipped) {
          toast.success('Oracle price is fresh', {
            id: progressToast,
            description: 'Step 1/4: Using current oracle price',
            duration: 2000,
          });
        } else {
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
        
        // Update current price with the newly fetched price (convert to oracle format)
        const priceDecimals = MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8;
        updatedPrice = (oracleUpdateResult.price * (10 ** priceDecimals)).toString();
        setCurrentPrice(updatedPrice);
      } catch (oracleError: any) {
        console.warn('Failed to update oracle price, using current price:', oracleError);
        toast.warning('Using cached oracle price', {
          id: progressToast,
          description: 'Step 1/4: Oracle update skipped',
          duration: 2000,
        });
        // Continue with current price if oracle update fails
      }

      // Step 2: Convert margin to wei
      const marginWei = BigInt(Math.floor(parseFloat(collateral) * 1e18));
      
      // Step 3: Calculate position size in wei (BTC with 18 decimals for circuit)
      const price = BigInt(updatedPrice);
      const priceDecimals = MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8;
      const priceValue = Number(price) / (10 ** priceDecimals);
      const positionSizeValue = (parseFloat(collateral) * leverageNum) / priceValue;
      const positionSizeWei = BigInt(Math.floor(positionSizeValue * 1e18));

      // Step 4: Get current timestamp
      const now = Math.floor(Date.now() / 1000);

      // Step 5: Generate proof (use updated price) - This is the slowest step
      toast.loading('Generating ZK proof...', {
        id: progressToast,
        description: 'Step 2/4: This may take 10-30 seconds',
      });
      
      const proofResult = await generateOpenPositionProof({
        privateMargin: marginWei.toString(),
        privatePositionSize: positionSizeWei.toString(),
        isLong: orderSide === 'long',
        marketId: selectedMarket,
        oraclePrice: updatedPrice, // Use the updated price
        leverage: leverageNum,
        currentTime: now,
        priceTimestamp: now,
        numSources: 3,
        minSources: 2,
        maxPriceAge: 60,
      });

      // Step 6: Submit to PerpRouter
      toast.loading('Submitting transaction...', {
        id: progressToast,
        description: 'Step 3/4: Sending to blockchain',
      });
      
      const tx = await openPosition(proofResult.proof, proofResult.publicInputs);

      // Step 7: Wait for confirmation
      toast.loading('Waiting for confirmation...', {
        id: progressToast,
        description: 'Step 4/4: Confirming on-chain',
      });
      
      await ztarknetAccount.waitForTransaction(tx.transaction_hash);
      
      // Dismiss progress toast
      toast.dismiss(progressToast);

      // Show success with transaction link
      toast.success('Position opened successfully!', {
        action: {
          label: 'View Transaction',
          onClick: () => window.open(`${NETWORK.EXPLORER_URL}/tx/${tx.transaction_hash}`, '_blank'),
        },
        duration: 10000,
      });

      // Add position to store (traderSecret is returned from proof generation)
      addPosition({
        commitment: proofResult.commitment,
        marketId: selectedMarket,
        isLong: orderSide === 'long',
        size: calculatedBtcSize,
        entryPrice: (Number(updatedPrice) / (10 ** (MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8))).toString(),
        margin: collateral,
        pnl: '0',
        timestamp: Date.now(),
        leverage: leverageNum,
        traderSecret: proofResult.traderSecret, // Store secret for closing
      });

      resetOrderForm();
      setSizePercent(0);
    } catch (error: any) {
      console.error('Order submission error:', error);
      toast.error(error.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-form-container">
      {/* Top Controls: Cross, 20x, One-Way */}
      <div className="order-form-top-controls">
        <button
          onClick={() => setMarginMode('cross')}
          className={`order-form-control-btn ${marginMode === 'cross' ? 'active' : ''}`}
        >
          Cross
        </button>
        <button
          onClick={() => setLeverage('20x')}
          className={`order-form-control-btn ${leverage === '20x' ? 'active' : ''}`}
        >
          20x
        </button>
        <button
          onClick={() => setPositionMode('one-way')}
          className={`order-form-control-btn ${positionMode === 'one-way' ? 'active' : ''}`}
        >
          One-Way
        </button>
      </div>

      {/* Order Type Tabs: Market, Limit, TWAP */}
      <div className="order-form-type-tabs">
        <button
          onClick={() => setOrderType('market')}
          className={`order-form-type-tab ${orderType === 'market' ? 'active' : ''}`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('limit')}
          className={`order-form-type-tab ${orderType === 'limit' ? 'active' : ''}`}
        >
          Limit
        </button>
        <button 
          onClick={() => setOrderType('twap')}
          className={`order-form-type-tab ${orderType === 'twap' ? 'active' : ''}`}
        >
          TWAP
        </button>
      </div>

      {/* Long/Short Toggle - Sliding switch effect */}
      <div className="order-form-toggle-container">
        <div className={`order-form-toggle-slider ${orderSide === 'short' ? 'right' : ''}`} />
        <button
          onClick={() => setOrderSide('long')}
          className={`order-form-toggle-btn ${orderSide === 'long' ? 'active' : ''}`}
        >
          <ArrowUp size={12} />
          Buy / Long
        </button>
        <button
          onClick={() => setOrderSide('short')}
          className={`order-form-toggle-btn ${orderSide === 'short' ? 'active' : ''}`}
        >
          <ArrowDown size={12} />
          Sell / Short
        </button>
      </div>

      {/* Account Info */}
      <div className="order-form-account-info">
        <div className="order-form-account-row">
          <span>Available to Trade:</span>
          <span>{availableBalance ? `${formatYusdBalance(availableBalance)} yUSD` : '0.00 yUSD'}</span>
        </div>
        <div className="order-form-account-row">
          <span>Current Position:</span>
          <span>0.000 BTC</span>
        </div>
      </div>

      {/* Order Form */}
      <form onSubmit={handleSubmit} className="order-form-form">
        {/* Margin Input - Label and dropdown INSIDE the input */}
        <div className="order-form-size-input-container">
          <input
            type="number"
            step="0.01"
            value={collateral}
            onChange={(e) => handleCollateralChange(e.target.value)}
            placeholder="0.00"
            className="order-form-size-input"
            required
          />
          <span className="order-form-size-label">Margin</span>
          <button
            type="button"
            className="order-form-size-dropdown"
          >
            yUSD
            <ChevronDown size={8} />
          </button>
        </div>

        {/* Calculated BTC Size Display */}
        {calculatedBtcSize !== '0' && (
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: 'rgba(80, 210, 193, 0.1)', 
            borderRadius: '8px',
            fontSize: '12px',
            color: '#50d2c1',
            textAlign: 'center'
          }}>
            Position Size: {calculatedBtcSize} BTC ({leverage}x leverage)
          </div>
        )}

        {/* Size Slider and Percentage */}
        <div className="order-form-slider-container">
          <input
            type="range"
            min="0"
            max="100"
            value={sizePercent}
            onChange={(e) => handleSizePercentChange(Number(e.target.value))}
            className="order-form-slider"
            style={{
              background: `linear-gradient(to right, #50d2c1 0%, #50d2c1 ${sizePercent}%, rgba(255,255,255,0.1) ${sizePercent}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
          <div className="order-form-percent-row">
            <input
              type="number"
              min="0"
              max="100"
              value={sizePercent}
              onChange={(e) => handleSizePercentChange(Number(e.target.value))}
              className="order-form-percent-input"
            />
            <span className="order-form-percent-label">%</span>
          </div>
        </div>

        {/* Limit Price Input (only for limit orders) */}
        {orderType === 'limit' && (
          <div className="order-form-size-input-container" style={{ marginTop: '12px' }}>
            <input
              type="number"
              step="0.01"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              placeholder="0.00"
              className="order-form-size-input"
              required
            />
            <span className="order-form-size-label">Limit Price</span>
            <button
              type="button"
              className="order-form-size-dropdown"
            >
              USD
              <ChevronDown size={8} />
            </button>
          </div>
        )}

        {/* Checkboxes */}
        <div className="order-form-checkboxes">
          <label className="order-form-checkbox-label">
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={(e) => setReduceOnly(e.target.checked)}
              className="order-form-checkbox"
            />
            <span className="order-form-checkbox-label-text">Reduce Only</span>
          </label>
          <label className="order-form-checkbox-label">
            <input
              type="checkbox"
              checked={takeProfitStopLoss}
              onChange={(e) => setTakeProfitStopLoss(e.target.checked)}
              className="order-form-checkbox"
            />
            <span className="order-form-checkbox-label-text">Take Profit / Stop Loss</span>
          </label>
        </div>

        {/* Connect/Submit Button */}
        <div className="order-form-submit-container">
          {!isZtarknetReady || !ztarknetAccount ? (
            <button
              type="button"
              onClick={() => toast.info('Please connect your wallet first')}
              className="order-form-submit-btn"
            >
              Connect
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`order-form-submit-btn ${orderSide === 'short' ? 'sell' : ''}`}
            >
              {isSubmitting ? 'Submitting...' : `${orderSide === 'long' ? 'Buy' : 'Sell'} ${orderType === 'market' ? 'Market' : 'Limit'}`}
            </button>
          )}
        </div>
      </form>

      {/* Trade Information */}
      <div className="order-form-trade-info">
        <div className="order-form-trade-info-row">
          <span className="order-form-trade-info-label">Liquidation Price</span>
          <span className="order-form-trade-info-value">N/A</span>
        </div>
        <div className="order-form-trade-info-row">
          <span className="order-form-trade-info-label">Order Value</span>
          <span className="order-form-trade-info-value">
            {calculatedBtcSize !== '0' && currentPrice !== '0' 
              ? `$${(parseFloat(calculatedBtcSize) * parseFloat(currentPrice) / (10 ** (MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO]?.decimals || 8))).toFixed(2)}`
              : 'N/A'}
          </span>
        </div>
        <div className="order-form-trade-info-row">
          <span className="order-form-trade-info-label">Slippage</span>
          <span className="order-form-trade-info-value">Est: 0% / Max: 8.00%</span>
        </div>
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onApproved={() => {
          setNeedsApproval(false);
          // Retry submission after approval
          setTimeout(() => {
            const form = document.querySelector('.order-form-form') as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          }, 500);
        }}
        spenderAddress={CONTRACTS.PERP_ROUTER}
        amount={collateral ? BigInt(Math.floor(parseFloat(collateral) * 1e18)).toString() : '0'}
      />
    </div>
  );
}
