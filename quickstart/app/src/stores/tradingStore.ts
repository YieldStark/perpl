import { create } from 'zustand';
import { Account } from 'starknet';
import { MARKETS } from '../config/contracts';

// Types
export interface Position {
  commitment: string; // Commitment hash (public)
  marketId: string;
  isLong: boolean;
  // Private data (only visible to user locally)
  size?: string;
  entryPrice?: string;
  margin?: string;
  pnl?: string;
  timestamp: number;
  traderSecret?: string; // Secret used for commitment (needed for closing)
  leverage?: number; // Leverage used (needed for PnL calculation)
}

export interface Order {
  id: string;
  marketId: string;
  isLong: boolean;
  size: string;
  price: string;
  orderType: 'market' | 'limit' | 'twap';
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: number;
}

export interface MarketData {
  marketId: string;
  symbol: string;
  currentPrice: string;
  priceChange24h: string;
  volume24h: string;
  openInterest: string;
}

interface TradingState {
  // Wallets
  sepoliaAccount: Account | null; // Sepolia wallet for identity
  ztarknetAccount: Account | null; // Ztarknet wallet for trading
  isSepoliaConnected: boolean;
  isZtarknetReady: boolean;
  availableBalance: string; // yUSD balance (wei string)
  
  // Trading State
  selectedMarket: string;
  positions: Position[];
  orders: Order[];
  markets: MarketData[];
  
  // UI State
  orderType: 'market' | 'limit' | 'twap';
  orderSide: 'long' | 'short';
  orderSize: string;
  orderPrice: string;
  collateral: string;
  
  // Actions
  setSepoliaAccount: (account: Account | null) => void;
  setZtarknetAccount: (account: Account | null) => void;
  setSelectedMarket: (marketId: string) => void;
  setAvailableBalance: (balance: string) => void;
  addPosition: (position: Position) => void;
  updatePosition: (commitment: string, updates: Partial<Position>) => void;
  removePosition: (commitment: string) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  setMarkets: (markets: MarketData[]) => void;
  updateMarketPrice: (marketId: string, price: string) => void;
  setOrderType: (type: 'market' | 'limit' | 'twap') => void;
  setOrderSide: (side: 'long' | 'short') => void;
  setOrderSize: (size: string) => void;
  setOrderPrice: (price: string) => void;
  setCollateral: (amount: string) => void;
  resetOrderForm: () => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  // Initial State
  sepoliaAccount: null,
  ztarknetAccount: null,
  isSepoliaConnected: false,
  isZtarknetReady: false,
  availableBalance: '0',
  selectedMarket: MARKETS.BTC_USD, // BTC/USD default
  positions: [],
  orders: [],
  markets: [],
  orderType: 'market',
  orderSide: 'long',
  orderSize: '',
  orderPrice: '',
  collateral: '',
  
  // Actions
  setSepoliaAccount: (account) => set({ sepoliaAccount: account, isSepoliaConnected: !!account }),
  setZtarknetAccount: (account) => set({ ztarknetAccount: account, isZtarknetReady: !!account }),
  setAvailableBalance: (balance) => set({ availableBalance: balance }),
  
  setSelectedMarket: (marketId) => set({ selectedMarket: marketId }),
  
  addPosition: (position) =>
    set((state) => ({ positions: [...state.positions, position] })),
  
  updatePosition: (commitment, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.commitment === commitment ? { ...p, ...updates } : p
      ),
    })),
  
  removePosition: (commitment) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.commitment !== commitment),
    })),
  
  addOrder: (order) =>
    set((state) => ({ orders: [...state.orders, order] })),
  
  updateOrder: (id, updates) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    })),
  
  setMarkets: (markets) => set({ markets }),
  
  updateMarketPrice: (marketId, price) =>
    set((state) => ({
      markets: state.markets.map((m) =>
        m.marketId === marketId ? { ...m, currentPrice: price } : m
      ),
    })),
  
  setOrderType: (type) => set({ orderType: type }),
  setOrderSide: (side) => set({ orderSide: side }),
  setOrderSize: (size) => set({ orderSize: size }),
  setOrderPrice: (price) => set({ orderPrice: price }),
  setCollateral: (amount) => set({ collateral: amount }),
  
  resetOrderForm: () =>
    set({
      orderSize: '',
      orderPrice: '',
      collateral: '',
      orderType: 'market',
    }),
}));

