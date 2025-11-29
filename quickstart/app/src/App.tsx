import { useState, useEffect, useRef } from 'react'
import './App.css'
import { ProofState, ProofStateData } from './types'
import { Noir } from "@noir-lang/noir_js";
import { DebugFileMap } from "@noir-lang/types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { flattenFieldsAsArray } from "./helpers/proof";
import { getZKHonkCallData, init } from 'garaga';
import { bytecode, abi } from "./assets/circuit.json";
import { abi as verifierAbi } from "./assets/verifier.json";
import vkUrl from './assets/vk.bin?url';
import { RpcProvider, Contract } from 'starknet';
import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";
import Faucet from './components/Faucet';
import { TradingInterface } from './components/Trading/TradingInterface';
import { Portfolio } from './components/Portfolio/Portfolio';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTradingStore } from './stores/tradingStore';
import { MARKET_INFO } from './config/contracts';

function App() {
  const [proofState, setProofState] = useState<ProofStateData>({
    state: ProofState.Initial
  });
  const [vk, setVk] = useState<Uint8Array | null>(null);
  const [inputX, setInputX] = useState<number>(5);
  const [inputY, setInputY] = useState<number>(10);
  // Use a ref to reliably track the current state across asynchronous operations
  const currentStateRef = useRef<ProofState>(ProofState.Initial);

  // Initialize WASM on component mount
  useEffect(() => {
    const initWasm = async () => {
      try {
        // This might have already been initialized in main.tsx,
        // but we're adding it here as a fallback
        if (typeof window !== 'undefined') {
          await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
          console.log('WASM initialization in App component complete');
        }
      } catch (error) {
        console.error('Failed to initialize WASM in App component:', error);
      }
    };

    const loadVk = async () => {
      const response = await fetch(vkUrl);
      const arrayBuffer = await response.arrayBuffer();
      const binaryData = new Uint8Array(arrayBuffer);
      setVk(binaryData);
      console.log('Loaded verifying key:', binaryData);
    };
    
    initWasm();
    loadVk();
  }, []);

  const resetState = () => {
    currentStateRef.current = ProofState.Initial;
    setProofState({ 
      state: ProofState.Initial,
      error: undefined 
    });
  };

  const handleError = (error: unknown) => {
    console.error('Error:', error);
    let errorMessage: string;
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error !== null && error !== undefined) {
      // Try to convert any non-Error object to a string
      try {
        errorMessage = String(error);
      } catch {
        errorMessage = 'Unknown error (non-stringifiable object)';
      }
    } else {
      errorMessage = 'Unknown error occurred';
    }
    
    // Use the ref to get the most recent state
    setProofState({
      state: currentStateRef.current,
      error: errorMessage
    });
  };

  const updateState = (newState: ProofState) => {
    currentStateRef.current = newState;
    setProofState({ state: newState, error: undefined });
  };

  const startProcess = async () => {
    try {
      // Start the process
      updateState(ProofState.GeneratingWitness);
      
      // Use input values from state
      const input = { x: inputX, y: inputY };
      
      // Generate witness
      let noir = new Noir({ bytecode, abi: abi as any, debug_symbols: '', file_map: {} as DebugFileMap });
      let execResult = await noir.execute(input);
      console.log(execResult);
      
      // Generate proof
      updateState(ProofState.GeneratingProof);

      // Use single thread to avoid worker issues in development
      // You can change to { threads: 2 } or more for production builds
      let honk = new UltraHonkBackend(bytecode, { threads: 1 });
      let proof = await honk.generateProof(execResult.witness, { starknetZK: true });
      honk.destroy();
      console.log(proof);
      
      // Prepare calldata
      updateState(ProofState.PreparingCalldata);

      await init();
      const callData = getZKHonkCallData(
        proof.proof,
        flattenFieldsAsArray(proof.publicInputs),
        vk as Uint8Array,
        1 // HonkFlavor.STARKNET
      );
      console.log(callData);
      
      // Connect wallet
      updateState(ProofState.ConnectingWallet);

      // Send transaction
      updateState(ProofState.SendingTransaction);

      const provider = new RpcProvider({ nodeUrl: 'https://ztarknet-madara.d.karnot.xyz' });
      // TODO: use conract address from the result of the `make deploy-verifier` step
      const contractAddress = '0x02048def58e122c910f80619ebab076b0ef5513550d38afdfdf2d8a1710fa7c6';
      const verifierContract = new Contract({ abi: verifierAbi, address: contractAddress, providerOrAccount: provider });
      
      // Check verification
      const res = await verifierContract.verify_ultra_starknet_zk_honk_proof(callData.slice(1));
      console.log(res);

      updateState(ProofState.ProofVerified);
    } catch (error) {
      handleError(error);
    }
  };

  const renderStateIndicator = (state: ProofState, current: ProofState) => {
    let status = 'pending';
    
    // If this stage is current with an error, show error state
    if (current === state && proofState.error) {
      status = 'error';
    } 
    // If this is the current stage, show active state
    else if (current === state) {
      status = 'active';
    } 
    // If we're past this stage, mark it completed
    else if (getStateIndex(current) > getStateIndex(state)) {
      status = 'completed';
    }
    
    return (
      <div className={`state-indicator ${status}`}>
        <div className="state-dot"></div>
        <div className="state-label">{state}</div>
      </div>
    );
  };

  const getStateIndex = (state: ProofState): number => {
    const states = [
      ProofState.Initial,
      ProofState.GeneratingWitness,
      ProofState.GeneratingProof,
      ProofState.PreparingCalldata,
      ProofState.ConnectingWallet,
      ProofState.SendingTransaction,
      ProofState.ProofVerified
    ];
    
    return states.indexOf(state);
  };

  const [currentPage, setCurrentPage] = useState<'proof' | 'faucet' | 'trading' | 'portfolio'>('trading');
  
  // Update page title with current market price
  const selectedMarket = useTradingStore((state) => state.selectedMarket);
  const markets = useTradingStore((state) => state.markets);
  
  useEffect(() => {
    if (currentPage === 'trading') {
      const currentMarket = markets.find((m) => m.marketId === selectedMarket);
      const marketInfo = MARKET_INFO[selectedMarket as keyof typeof MARKET_INFO];
      const marketSymbol = marketInfo?.symbol?.split('/')[0] || 'BTC';
      
      if (currentMarket?.currentPrice) {
        const price = parseFloat(currentMarket.currentPrice);
        const formattedPrice = price.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
        document.title = `${formattedPrice} | ${marketSymbol} | Circuit`;
      } else {
        document.title = `91,168 | BTC | Circuit`;
      }
    } else if (currentPage === 'portfolio') {
      document.title = `Portfolio | Circuit`;
    } else {
      document.title = `Circuit - Private Perpetual DEX`;
    }
  }, [currentPage, selectedMarket, markets]);

  return (
    <>
      {currentPage === 'trading' ? (
        <ErrorBoundary>
          <TradingInterface onNavigate={(page) => setCurrentPage(page)} />
        </ErrorBoundary>
      ) : currentPage === 'portfolio' ? (
        <ErrorBoundary>
          <Portfolio onNavigate={(page) => setCurrentPage(page)} />
        </ErrorBoundary>
      ) : (
    <div className="container">
          {/* Tailwind CSS Test Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 mb-4 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">🎨 Tailwind CSS Test</h2>
                <p className="text-sm text-blue-100">If you see this styled banner, Tailwind is working!</p>
              </div>
              <div className="flex gap-2">
                <div className="bg-white/20 rounded px-3 py-1 text-sm font-semibold">Card Test</div>
                <div className="bg-white/20 rounded px-3 py-1 text-sm font-semibold">Grid Test</div>
                <button className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-1 px-4 rounded transition-colors">
                  Button Test
                </button>
              </div>
            </div>
          </div>

      <nav className="app-nav">
            <button 
              className={(currentPage as string) === 'trading' ? 'active' : ''}
              onClick={() => setCurrentPage('trading')}
            >
              Trading
            </button>
            <button 
              className={currentPage === 'portfolio' ? 'active' : ''}
              onClick={() => setCurrentPage('portfolio')}
            >
              Portfolio
            </button>
        <button 
          className={currentPage === 'faucet' ? 'active' : ''}
          onClick={() => setCurrentPage('faucet')}
        >
          yUSD Faucet
        </button>
        <button 
          className={currentPage === 'proof' ? 'active' : ''}
          onClick={() => setCurrentPage('proof')}
        >
          Proof Generation
        </button>
      </nav>

      {currentPage === 'faucet' ? (
        <Faucet />
      ) : (
        <>
          <h1>Noir Proof Generation & Starknet Verification</h1>
          
          <div className="state-machine">
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="input-x">X:</label>
            <input 
              id="input-x"
              type="text" 
              value={inputX} 
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setInputX(isNaN(value) ? 0 : value);
              }} 
              disabled={proofState.state !== ProofState.Initial}
            />
          </div>
          <div className="input-group">
            <label htmlFor="input-y">Y:</label>
            <input 
              id="input-y"
              type="text" 
              value={inputY} 
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setInputY(isNaN(value) ? 0 : value);
              }} 
              disabled={proofState.state !== ProofState.Initial}
            />
          </div>
        </div>
        
        {renderStateIndicator(ProofState.GeneratingWitness, proofState.state)}
        {renderStateIndicator(ProofState.GeneratingProof, proofState.state)}
        {renderStateIndicator(ProofState.PreparingCalldata, proofState.state)}
        {renderStateIndicator(ProofState.ConnectingWallet, proofState.state)}
        {renderStateIndicator(ProofState.SendingTransaction, proofState.state)}
      </div>
      
      {proofState.error && (
        <div className="error-message">
          Error at stage '{proofState.state}': {proofState.error}
        </div>
      )}
      
      <div className="controls">
        {proofState.state === ProofState.Initial && !proofState.error && (
          <button className="primary-button" onClick={startProcess}>Start</button>
        )}
        
        {(proofState.error || proofState.state === ProofState.ProofVerified) && (
          <button className="reset-button" onClick={resetState}>Reset</button>
        )}
      </div>
        </>
      )}
    </div>
      )}
    </>
  )
}

export default App
