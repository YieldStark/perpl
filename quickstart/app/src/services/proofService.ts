import { Noir } from '@noir-lang/noir_js';
import { DebugFileMap } from '@noir-lang/types';
import { UltraHonkBackend } from '@aztec/bb.js';
import { getZKHonkCallData, init } from 'garaga';
import { flattenFieldsAsArray } from '../helpers/proof';
import { bytecode, abi } from '../assets/circuit.json';
import vkUrl from '../assets/vk.bin?url';

let vkCache: Uint8Array | null = null;

async function loadVerifyingKey(): Promise<Uint8Array> {
  if (vkCache) return vkCache;
  
  const response = await fetch(vkUrl);
  const arrayBuffer = await response.arrayBuffer();
  vkCache = new Uint8Array(arrayBuffer);
  return vkCache;
}

function generateRandomSecret(): string {
  // Generate a random 32-byte hex string
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const hexString = '0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // BN254 field modulus: 21888242871839275222246405745257275088548364400416034343698204186575808495617
  // Ensure the secret is within the field modulus
  const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const secretBigInt = BigInt(hexString);
  const secretMod = secretBigInt % fieldModulus;
  
  // Return as hex string (Noir expects string format)
  return '0x' + secretMod.toString(16);
}

/**
 * Convert a string to its felt252 numeric representation
 * This is needed because Noir expects Field values to be numeric strings
 */
function stringToFelt252(str: string): string {
  // Convert string to BigInt using the same method as Starknet
  // Each character is converted to its ASCII value and combined
  let result = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const charCode = BigInt(str.charCodeAt(i));
    result = result * BigInt(256) + charCode;
  }
  // Ensure it fits in felt252 range (0 to 2^251 - 1)
  const felt252Max = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
  return (result % felt252Max).toString();
}

export interface OpenPositionProofInputs {
  privateMargin: string;      // Margin in wei (yUSD)
  privatePositionSize: string; // Position size in wei (BTC)
  isLong: boolean;
  marketId: string;
  oraclePrice: string;        // Current price from oracle
  leverage: number;           // e.g., 20 for 20x
  currentTime: number;        // Unix timestamp
  priceTimestamp: number;      // Price timestamp
  numSources: number;         // Number of price sources
  minSources: number;         // Minimum required sources
  maxPriceAge: number;        // Max price age in seconds
}

export interface ProofResult {
  proof: string[];            // Proof data as felt252 array
  publicInputs: string[];     // Public inputs
  commitment: string;         // Commitment hash
  traderSecret?: string;      // Trader secret (needed for closing positions)
}

export async function generateOpenPositionProof(
  inputs: OpenPositionProofInputs
): Promise<ProofResult> {
  // Ensure garaga is initialized
  await init();
  
  // Load verifying key
  const vk = await loadVerifyingKey();
  
  // Generate random trader secret
  const privateTraderSecret = generateRandomSecret();
  
  // Calculate execution price (for now, use oracle price with no impact)
  const priceImpact = '0';
  const executionPrice = inputs.oraclePrice;
  
  // Convert market_id string to felt252 numeric value for Noir
  const marketIdFelt = stringToFelt252(inputs.marketId);
  
  // Prepare circuit inputs
  const circuitInput = {
    action: 0, // 0 = open_market
    private_margin: inputs.privateMargin,
    private_position_size: inputs.privatePositionSize,
    private_entry_price: inputs.oraclePrice,
    private_trader_secret: privateTraderSecret,
    is_long: inputs.isLong ? 1 : 0,
    market_id: marketIdFelt, // Convert string to felt252 numeric value
    oracle_price: inputs.oraclePrice,
    current_time: inputs.currentTime.toString(),
    price_timestamp: inputs.priceTimestamp.toString(),
    num_sources: inputs.numSources.toString(),
    min_sources: inputs.minSources.toString(),
    max_price_age: inputs.maxPriceAge.toString(),
    price_impact: priceImpact,
    execution_price: executionPrice,
    acceptable_slippage: '100', // 1% in basis points
    leverage: inputs.leverage.toString(),
    min_margin_ratio: '5', // 5%
    max_position_size: '1000000000000000000000', // Max position size
    trigger_price: '0',
    current_price: inputs.oraclePrice,
    closing_size: '0',
    take_profit_price: '0',
    stop_loss_price: '0',
    trading_fee_bps: '10', // 0.1%
    twap_price: '0',
    twap_duration: '0',
    chunk_index: '0',
    total_chunks: '0',
  };

  // Generate witness
  const noir = new Noir({ 
    bytecode, 
    abi: abi as any, 
    debug_symbols: '', 
    file_map: {} as DebugFileMap 
  });
  
  // Log inputs for debugging
  console.log('Circuit inputs:', {
    action: circuitInput.action,
    market_id: circuitInput.market_id,
    market_id_type: typeof circuitInput.market_id,
    has_all_fields: Object.keys(circuitInput).length,
    all_keys: Object.keys(circuitInput),
  });
  
  let execResult;
  try {
    execResult = await noir.execute(circuitInput);
    console.log('Circuit execution result:', execResult);
  } catch (error: any) {
    console.error('Noir execution error:', error);
    console.error('Circuit input keys:', Object.keys(circuitInput));
    console.error('Full circuit input:', JSON.stringify(circuitInput, null, 2));
    if (abi && abi.parameters) {
      console.error('ABI expected parameters:', abi.parameters.map((p: any) => `${p.name}: ${p.type.kind}`));
    }
    throw error;
  }

  // Generate proof
  const honk = new UltraHonkBackend(bytecode, { threads: 1 });
  const proof = await honk.generateProof(execResult.witness, { starknetZK: true });
  honk.destroy();
  
  console.log('Proof generated:', proof);

  // Prepare calldata for contract
  const callData = getZKHonkCallData(
    proof.proof,
    flattenFieldsAsArray(proof.publicInputs),
    vk,
    1 // HonkFlavor.STARKNET
  );

  // Extract proof and public inputs
  // callData format: [proof_length, ...proof, ...public_inputs]
  console.log('Raw callData from getZKHonkCallData:', {
    length: callData.length,
    first10: callData.slice(0, 10),
    types: callData.slice(0, 10).map(v => typeof v),
    sampleValues: callData.slice(0, 5).map(v => ({ value: v, type: typeof v, string: String(v) }))
  });
  
  const proofLength = Number(callData[0]);
  
  // Helper function to ensure value is a hex string with 0x prefix
  // CRITICAL: Starknet.js requires ALL calldata values to be strings with 0x prefix
  // This function MUST always return a string starting with '0x'
  const toHexString = (v: any, index?: number): string => {
    try {
      // Handle null/undefined/empty
      if (v === null || v === undefined || v === '') {
        return '0x0';
      }
      
      let num: bigint;
      
      // Convert to BigInt first, then to hex string
      if (typeof v === 'string') {
        // If already has 0x prefix, parse it
        if (v.startsWith('0x') || v.startsWith('0X')) {
          if (v.length === 2) return '0x0'; // Just "0x"
          try {
            num = BigInt(v);
          } catch {
            // Try without prefix
            num = BigInt('0x' + v.slice(2));
          }
        } else {
          // Try as decimal first
          try {
            num = BigInt(v);
          } catch {
            // Try as hex without prefix
            num = BigInt('0x' + v);
          }
        }
      } else if (typeof v === 'number') {
        if (!Number.isFinite(v) || Number.isNaN(v)) {
          console.warn(`Invalid number at index ${index}: ${v}, using 0x0`);
          return '0x0';
        }
        num = BigInt(v);
      } else if (typeof v === 'bigint') {
        num = v;
      } else {
        // Try to convert to string then parse
        const str = String(v);
        if (str.startsWith('0x') || str.startsWith('0X')) {
          num = BigInt(str);
        } else {
          num = BigInt(str);
        }
      }
      
      // Convert to hex string and ensure 0x prefix
      const hex = num.toString(16);
      return '0x' + hex;
    } catch (error) {
      console.error(`Error converting value at index ${index} to hex:`, v, error);
      return '0x0';
    }
  };
  
  // Convert all proof values to hex strings (Starknet.js requires 0x-prefixed hex strings)
  const rawProof = callData.slice(1, 1 + proofLength);
  console.log('Raw proof values:', {
    count: rawProof.length,
    first5: rawProof.slice(0, 5),
    types: rawProof.slice(0, 5).map(v => typeof v),
    hasNonString: rawProof.some(v => typeof v !== 'string'),
    sampleValues: rawProof.slice(0, 10).map((v, i) => ({
      index: i,
      value: v,
      type: typeof v,
      stringified: String(v),
      isZero: v === 0 || v === '0' || v === '0x0' || v === '0x'
    }))
  });
  
  // Convert all proof values to hex strings
  // CRITICAL: Each value MUST be a string with 0x prefix for Starknet.js
  const proofData = rawProof.map((v, i) => {
    const hex = toHexString(v, i);
    // Final validation - toHexString should always return a string with 0x prefix
    if (typeof hex !== 'string' || !hex.startsWith('0x')) {
      throw new Error(`Invalid hex conversion at proof index ${i}: got ${hex} (${typeof hex}) from ${v} (${typeof v})`);
    }
    return hex;
  });
  
  console.log(`Converted ${proofData.length} proof values, first 5:`, proofData.slice(0, 5));
  console.log('Proof data types:', proofData.slice(0, 5).map(v => typeof v));
  
  // Validate all proof values are strings with 0x prefix
  const invalidProof = proofData.filter(v => typeof v !== 'string' || !v.startsWith('0x'));
  if (invalidProof.length > 0) {
    console.error(`Found ${invalidProof.length} proof values without 0x prefix:`, invalidProof);
    console.error('Invalid proof indices:', proofData.map((v, i) => ({ index: i, value: v, type: typeof v, hasPrefix: v.startsWith('0x') })).filter((_, i) => invalidProof.includes(proofData[i])));
    throw new Error(`Invalid proof data: ${invalidProof.length} values missing 0x prefix`);
  }
  
  // The verifier is called with only the proof (not public_inputs)
  // The position handler expects public_inputs as [market_id, commitment] at positions 0 and 1
  // We format public_inputs separately for the position handler
  // Reuse marketIdFelt declared earlier (line 91)
  const commitment = execResult.returnValue.toString();
  
  // Ensure values are in hex format (Starknet.js expects hex strings)
  const marketIdHex = marketIdFelt.startsWith('0x') ? marketIdFelt : '0x' + BigInt(marketIdFelt).toString(16);
  const commitmentHex = commitment.startsWith('0x') ? commitment : '0x' + BigInt(commitment).toString(16);
  
  // Format public inputs as expected by the position handler: [market_id, commitment]
  const publicInputs = [marketIdHex, commitmentHex];
  
  console.log('Proof and public inputs:', {
    proofLength: proofData.length,
    publicInputsLength: publicInputs.length,
    marketId: marketIdHex,
    commitment: commitmentHex.substring(0, 20) + '...',
  });

  return {
    proof: proofData,
    publicInputs,
    commitment: execResult.returnValue.toString(),
    traderSecret: privateTraderSecret, // Return secret for storage
  };
}

export interface ClosePositionProofInputs {
  privateMargin: string;          // Original margin in wei (yUSD)
  privatePositionSize: string;    // Position size in wei (BTC)
  privateEntryPrice: string;      // Entry price (in oracle format with decimals)
  privateTraderSecret: string;    // Same secret used when opening
  isLong: boolean;
  marketId: string;
  currentPrice: string;           // Current price from oracle (in oracle format)
  closingSize: string;            // Size to close in wei (BTC) - use full size for full close
  currentTime: number;            // Unix timestamp
  priceTimestamp: number;         // Price timestamp
  numSources: number;
  minSources: number;
  maxPriceAge: number;
  tradingFeeBps: number;          // Trading fee in basis points (e.g., 10 = 0.1%)
}

export async function generateClosePositionProof(
  inputs: ClosePositionProofInputs
): Promise<ProofResult> {
  // Ensure garaga is initialized
  await init();
  
  // Load verifying key
  const vk = await loadVerifyingKey();
  
  // Convert market_id string to felt252 numeric value for Noir
  const marketIdFelt = stringToFelt252(inputs.marketId);
  
  // Prepare circuit inputs
  const circuitInput = {
    action: 3, // 3 = close_position
    private_margin: inputs.privateMargin,
    private_position_size: inputs.privatePositionSize,
    private_entry_price: inputs.privateEntryPrice,
    private_trader_secret: inputs.privateTraderSecret,
    is_long: inputs.isLong ? 1 : 0,
    market_id: marketIdFelt, // Convert string to felt252 numeric value
    oracle_price: inputs.currentPrice,
    current_time: inputs.currentTime.toString(),
    price_timestamp: inputs.priceTimestamp.toString(),
    num_sources: inputs.numSources.toString(),
    min_sources: inputs.minSources.toString(),
    max_price_age: inputs.maxPriceAge.toString(),
    price_impact: '0',
    execution_price: inputs.currentPrice,
    acceptable_slippage: '100', // 1% in basis points
    leverage: '0', // Not used for closing
    min_margin_ratio: '0', // Not used for closing
    max_position_size: '0', // Not used for closing
    trigger_price: '0',
    current_price: inputs.currentPrice,
    closing_size: inputs.closingSize,
    take_profit_price: '0',
    stop_loss_price: '0',
    trading_fee_bps: inputs.tradingFeeBps.toString(),
    twap_price: '0',
    twap_duration: '0',
    chunk_index: '0',
    total_chunks: '0',
  };

  // Generate witness
  const noir = new Noir({ 
    bytecode, 
    abi: abi as any, 
    debug_symbols: '', 
    file_map: {} as DebugFileMap 
  });
  
  const execResult = await noir.execute(circuitInput);
  console.log('Close position circuit execution result:', execResult);

  // Generate proof
  const honk = new UltraHonkBackend(bytecode, { threads: 1 });
  const proof = await honk.generateProof(execResult.witness, { starknetZK: true });
  honk.destroy();
  
  console.log('Close position proof generated:', proof);

  // Prepare calldata for contract
  const callData = getZKHonkCallData(
    proof.proof,
    flattenFieldsAsArray(proof.publicInputs),
    vk,
    1 // HonkFlavor.STARKNET
  );

  // Extract proof and public inputs
  const proofLength = Number(callData[0]);
  
  // Helper function to ensure value is a hex string with 0x prefix
  // CRITICAL: Starknet.js requires ALL calldata values to be strings with 0x prefix
  const toHexString = (v: any, index?: number): string => {
    try {
      // Handle null/undefined/empty
      if (v === null || v === undefined || v === '') {
        return '0x0';
      }
      
      let num: bigint;
      
      // Convert to BigInt first, then to hex string
      if (typeof v === 'string') {
        // If already has 0x prefix, parse it
        if (v.startsWith('0x') || v.startsWith('0X')) {
          if (v.length === 2) return '0x0'; // Just "0x"
          num = BigInt(v);
        } else {
          // Try as decimal first, then as hex
          try {
            num = BigInt(v);
          } catch {
            num = BigInt('0x' + v);
          }
        }
      } else if (typeof v === 'number') {
        if (!Number.isFinite(v) || Number.isNaN(v)) {
          return '0x0';
        }
        num = BigInt(v);
      } else if (typeof v === 'bigint') {
        num = v;
      } else {
        // Try to convert to string then parse
        const str = String(v);
        num = str.startsWith('0x') || str.startsWith('0X') ? BigInt(str) : BigInt('0x' + str);
      }
      
      // Convert to hex string and ensure 0x prefix
      const hex = num.toString(16);
      return '0x' + hex;
    } catch (error) {
      console.error(`Error converting value at index ${index} to hex:`, v, error);
      return '0x0';
    }
  };
  
  // Convert all proof values to hex strings (Starknet.js requires 0x-prefixed hex strings)
  const rawProof = callData.slice(1, 1 + proofLength);
  console.log('Raw proof values:', {
    count: rawProof.length,
    first5: rawProof.slice(0, 5),
    types: rawProof.slice(0, 5).map(v => typeof v),
    hasNonString: rawProof.some(v => typeof v !== 'string'),
    sampleValues: rawProof.slice(0, 10).map((v, i) => ({
      index: i,
      value: v,
      type: typeof v,
      stringified: String(v),
      isZero: v === 0 || v === '0' || v === '0x0' || v === '0x'
    }))
  });
  
  // Convert all proof values to hex strings
  // CRITICAL: Each value MUST be a string with 0x prefix for Starknet.js
  const proofData = rawProof.map((v, i) => {
    const hex = toHexString(v, i);
    // Final validation - toHexString should always return a string with 0x prefix
    if (typeof hex !== 'string' || !hex.startsWith('0x')) {
      throw new Error(`Invalid hex conversion at proof index ${i}: got ${hex} (${typeof hex}) from ${v} (${typeof v})`);
    }
    return hex;
  });
  
  console.log(`Converted ${proofData.length} proof values, first 5:`, proofData.slice(0, 5));
  console.log('Proof data types:', proofData.slice(0, 5).map(v => typeof v));
  
  // Validate all proof values are strings with 0x prefix
  const invalidProof = proofData.filter(v => typeof v !== 'string' || !v.startsWith('0x'));
  if (invalidProof.length > 0) {
    console.error(`Found ${invalidProof.length} proof values without 0x prefix:`, invalidProof);
    console.error('Invalid proof indices:', proofData.map((v, i) => ({ index: i, value: v, type: typeof v, hasPrefix: v.startsWith('0x') })).filter((_, i) => invalidProof.includes(proofData[i])));
    throw new Error(`Invalid proof data: ${invalidProof.length} values missing 0x prefix`);
  }
  
  // The verifier is called with only the proof (not public_inputs)
  // The position handler expects public inputs as [market_id, commitment, outcome_code] at positions 0, 1, and 2
  // Reuse marketIdFelt declared earlier (line 232)
  const commitment = execResult.returnValue.toString();
  const outcomeCode = '0'; // For close position, outcome_code is 0 (success)
  
  // Ensure values are in hex format (Starknet.js expects hex strings)
  const marketIdHex = marketIdFelt.startsWith('0x') ? marketIdFelt : '0x' + BigInt(marketIdFelt).toString(16);
  const commitmentHex = commitment.startsWith('0x') ? commitment : '0x' + BigInt(commitment).toString(16);
  const outcomeCodeHex = outcomeCode.startsWith('0x') ? outcomeCode : '0x' + BigInt(outcomeCode).toString(16);
  
  // Format public inputs as expected by the contract: [market_id, commitment, outcome_code]
  const publicInputs = [marketIdHex, commitmentHex, outcomeCodeHex];

  return {
    proof: proofData,
    publicInputs,
    commitment: execResult.returnValue.toString(),
  };
}

