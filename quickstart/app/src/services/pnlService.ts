import { Position } from '../stores/tradingStore';
import { MARKET_INFO } from '../config/contracts';

/**
 * Calculate PnL for a position based on entry price, current price, leverage, and collateral
 * Formula:
 * - Long: PnL = (current_price - entry_price) / entry_price * collateral * leverage
 * - Short: PnL = (entry_price - current_price) / entry_price * collateral * leverage
 * 
 * This is calculated off-chain for display purposes only
 */
export function calculatePnL(
  position: Position,
  currentPrice: number, // Current price in USD (not wei format)
  leverage: number = 20 // Default leverage if not stored
): { pnl: number; pnlPercent: number; roe: number } {
  if (!position.entryPrice || !position.margin) {
    return { pnl: 0, pnlPercent: 0, roe: 0 };
  }

  const entryPrice = parseFloat(position.entryPrice);
  const margin = parseFloat(position.margin); // Collateral in yUSD

  if (entryPrice <= 0 || margin <= 0 || currentPrice <= 0) {
    return { pnl: 0, pnlPercent: 0, roe: 0 };
  }

  // Calculate price change percentage
  const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

  // Calculate PnL based on position type and leverage
  // PnL = price_change_percent * margin * leverage / 100
  let pnl: number;
  if (position.isLong) {
    // Long: profit when price goes up
    // PnL = (current_price - entry_price) / entry_price * margin * leverage
    pnl = (priceChangePercent / 100) * margin * leverage;
  } else {
    // Short: profit when price goes down
    // PnL = (entry_price - current_price) / entry_price * margin * leverage
    pnl = (-priceChangePercent / 100) * margin * leverage;
  }

  // Calculate ROE (Return on Equity) = PnL / Margin * 100
  const roe = margin > 0 ? (pnl / margin) * 100 : 0;

  // PnL percentage (same as price change percentage for display)
  const pnlPercent = priceChangePercent * leverage;

  return {
    pnl,
    pnlPercent,
    roe,
  };
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  position: Position,
  leverage: number = 20,
  minMarginRatio: number = 5 // 5% minimum margin ratio
): number | null {
  if (!position.entryPrice || !position.size || !position.margin) {
    return null;
  }

  const entryPrice = parseFloat(position.entryPrice);
  const margin = parseFloat(position.margin);
  const positionSize = parseFloat(position.size);

  // Liquidation occurs when remaining margin = required margin
  // For long: liquidation_price = entry_price * (1 - (1/leverage) + (min_margin_ratio/100))
  // For short: liquidation_price = entry_price * (1 + (1/leverage) - (min_margin_ratio/100))
  
  // Simplified calculation
  const maintenanceMarginPercent = (1 / leverage) * 100 + minMarginRatio;
  
  if (position.isLong) {
    // Long liquidation: price drops too much
    const liquidationPercent = 1 - (maintenanceMarginPercent / 100);
    return entryPrice * liquidationPercent;
  } else {
    // Short liquidation: price rises too much
    const liquidationPercent = 1 + (maintenanceMarginPercent / 100);
    return entryPrice * liquidationPercent;
  }
}

