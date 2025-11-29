import { MarketSelector } from './MarketSelector';
import { OrderForm } from './OrderForm';
import { PositionCard } from './PositionCard';
import { PriceChart } from './PriceChart';
import { useTradingStore } from '../../stores/tradingStore';
import { Header } from '../Layout/Header';
import { useState } from 'react';
import { useOraclePriceUpdater } from '../../hooks/useOraclePriceUpdater';
import '../../App.css';

interface TradingInterfaceProps {
  onNavigate?: (page: 'trading' | 'portfolio') => void;
}

export function TradingInterface({ onNavigate }: TradingInterfaceProps) {
  const positions = useTradingStore((state) => state.positions);
  const [activeTab, setActiveTab] = useState<'orderbook' | 'trades'>('orderbook');
  
  // Update oracle prices from price feed (every 60 seconds)
  useOraclePriceUpdater(60000);

  return (
    <div className="trading-interface-container">
      <Header currentPage="trading" onNavigate={onNavigate} />
      
      <div className="trading-interface-layout">
        {/* Left: Chart Area with Positions Below */}
        <div className="trading-interface-left">
          {/* Market Info Bar */}
          <MarketSelector />
          
          {/* Chart - Fixed Height */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: '60vh' }}>
            <PriceChart />
          </div>

          {/* Positions Panel - Below Chart, Scrollable */}
          <div className="trading-positions-panel">
            <div className="trading-positions-title">Positions ({positions.length})</div>
            {positions.length === 0 ? (
              <div className="trading-positions-empty">
                No open positions
              </div>
            ) : (
              <>
                <div className="trading-positions-list">
                  {positions.map((position) => (
                    <PositionCard key={position.commitment} position={position} />
                  ))}
                </div>
                <div className="trading-positions-privacy-note">
                  <p className="text-xs text-gray-500 text-center italic">
                    ALL TRADING INFO ARE PRIVATE AND VERIFIED BY ZK PROOFS
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Middle: Order Book / Trades */}
        <div className="orderbook-container">
          {/* Order Book / Trades Header */}
          <div className="orderbook-header">
            <div className="orderbook-tabs">
              <button 
                onClick={() => setActiveTab('orderbook')}
                className={`orderbook-tab ${activeTab === 'orderbook' ? 'active' : ''}`}
              >
                Order Book
              </button>
              <button 
                onClick={() => setActiveTab('trades')}
                className={`orderbook-tab ${activeTab === 'trades' ? 'active' : ''}`}
              >
                Trades
              </button>
            </div>
          </div>

          {/* Order Book / Trades Content */}
          <div className="orderbook-content">
            {activeTab === 'orderbook' ? (
              <div className="orderbook-body">
                <div className="orderbook-column-headers">
                  <span>Price</span>
                  <span>Size (BTC)</span>
                  <span>Total (BTC)</span>
                </div>
                {/* Sell Orders (Asks) */}
                <div className="orderbook-asks">
                  {(() => {
                    const askPrices = [91.133, 91.132, 91.131, 91.130, 91.129, 91.128, 91.127, 91.126, 91.125, 91.124, 91.123];
                    const askSizes = askPrices.map(() => Math.random() * 0.002);
                    let cumulativeTotal = 0;
                    return askPrices.map((price, i) => {
                      const size = askSizes[i];
                      cumulativeTotal += size;
                      const total = cumulativeTotal.toFixed(5);
                      return (
                        <div key={i} className="orderbook-row orderbook-ask-row">
                          <span className="orderbook-price orderbook-price-ask">{price.toFixed(3)}</span>
                          <span className="orderbook-size">{size.toFixed(5)}</span>
                          <span className="orderbook-total">{total}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                {/* Spread */}
                <div className="orderbook-spread">
                  <span>Spread 1 0.001%</span>
                </div>
                {/* Buy Orders (Bids) */}
                <div className="orderbook-bids">
                  {(() => {
                    const bidPrices = [91.122, 91.121, 91.120, 91.119, 91.118, 91.117, 91.116, 91.115, 91.114, 91.113];
                    const bidSizes = bidPrices.map(() => Math.random() * 40 + 3);
                    let cumulativeTotal = 0;
                    const totals: number[] = [];
                    bidSizes.forEach((size) => {
                      cumulativeTotal += size;
                      totals.push(cumulativeTotal);
                    });
                    const maxTotal = Math.max(...totals);
                    
                    cumulativeTotal = 0;
                    return bidPrices.map((price, i) => {
                      const size = bidSizes[i];
                      cumulativeTotal += size;
                      const total = cumulativeTotal.toFixed(5);
                      const barWidth = (cumulativeTotal / maxTotal) * 100;
                      return (
                        <div key={i} className="orderbook-row orderbook-bid-row">
                          <div className="orderbook-bid-bar" style={{ width: `${barWidth}%` }} />
                          <span className="orderbook-price orderbook-price-bid">{price.toFixed(3)}</span>
                          <span className="orderbook-size">{size.toFixed(5)}</span>
                          <span className="orderbook-total">{total}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="orderbook-trades">
                <div className="orderbook-column-headers">
                  <span>Price</span>
                  <span>Size</span>
                  <span>Time</span>
                </div>
                <div className="orderbook-trades-list">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="orderbook-row orderbook-trade-row">
                      <span className={Math.random() > 0.5 ? 'orderbook-price-bid' : 'orderbook-price-ask'}>
                        {(91.190 + Math.random() * 0.02).toFixed(3)}
                      </span>
                      <span className="orderbook-size">{(Math.random() * 2).toFixed(5)}</span>
                      <span className="orderbook-time">12:34:56</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Trading Panel */}
        <div className="trading-interface-right">
          <div className="trading-interface-right-inner">
            <OrderForm />
          </div>
        </div>
      </div>
    </div>
  );
}

