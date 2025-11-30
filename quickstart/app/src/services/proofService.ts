import { Noir } from '@noir-lang/noir_js';
import { DebugFileMap } from '@noir-lang/types';
import { UltraHonkBackend } from '@aztec/bb.js';
import { getZKHonkCallData, init } from 'garaga';
import { cairo } from 'starknet';
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
 * Pragma Asset IDs - Exact felt252 values used by the contract
 * These match the values defined in contracts/src/core/oracle.cairo
 * CRITICAL: Using exact values ensures market_id matches what's stored in DataStore
 */
const PRAGMA_ASSET_IDS: Record<string, string> = {
  'BTC/USD': '0x4254432f555344', // Pragma asset ID: 18669995996566340 (ASCII "BTC/USD")
  'ETH/USD': '0x4554482f555344', // Pragma asset ID: 19514442401534788 (ASCII "ETH/USD")
  'WBTC/USD': '0x574254432f555344', // Pragma asset ID: 6287680677296296772
  'LORDS/USD': '0x4c4f5244532f555344', // Pragma asset ID: 1407668255603079598916
  'STRK/USD': '0x5354524b2f555344', // Pragma asset ID: 6004514686061859652
  'EKUBO/USD': '0x454b55424f2f555344', // Pragma asset ID: 1278253658919688033092
  'DOG/USD': '0x444f472f555344', // Pragma asset ID: 19227465571717956
};

/**
 * Convert a string to its felt252 numeric representation
 * Uses exact Pragma asset IDs to ensure market_id matches what's stored in DataStore
 * This is CRITICAL for avoiding MARKET_DISABLED errors
 */
function stringToFelt252(str: string): string {
  // Use exact Pragma asset ID if available - this matches contract expectations
  if (PRAGMA_ASSET_IDS[str]) {
    const pragmaId = PRAGMA_ASSET_IDS[str];
    // Ensure it's always returned as a hex string with 0x prefix
    if (typeof pragmaId === 'string' && pragmaId.startsWith('0x')) {
      return pragmaId.toLowerCase();
    }
    // Convert to hex if it's not already
    return '0x' + BigInt(pragmaId).toString(16);
  }
  // Fallback to cairo.felt() for other strings
  const felt = cairo.felt(str);
  // cairo.felt() returns a decimal string, convert to hex
  if (typeof felt === 'string' && !felt.startsWith('0x')) {
    return '0x' + BigInt(felt).toString(16);
  }
  return felt;
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
  
  // CRITICAL: Force market_id to exact Pragma asset ID format
  // This ensures it matches what's stored in DataStore
  const expectedPragmaId = PRAGMA_ASSET_IDS[inputs.marketId];
  if (!expectedPragmaId) {
    throw new Error(`Unknown market_id: ${inputs.marketId}. Supported markets: ${Object.keys(PRAGMA_ASSET_IDS).join(', ')}`);
  }
  
  // ALWAYS use the exact Pragma asset ID format (lowercase hex)
  const marketIdFelt = expectedPragmaId.toLowerCase();
  
  console.log('🔍 Market ID (proofService):', {
    inputMarketId: inputs.marketId,
    marketIdFelt: marketIdFelt,
    expectedPragmaId: expectedPragmaId,
    usingExactFormat: true,
  });
  
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

  // CRITICAL: According to Starknet team, public inputs are already part of the proof structure
  // We should use the FULL callData (minus the first element) as the proof
  // The verifier will extract and return the public inputs if the proof is valid
  // callData format: [proof_length, ...proof_with_hints_and_embedded_public_inputs]
  console.log('Raw callData from getZKHonkCallData:', {
    length: callData.length,
    first10: callData.slice(0, 10),
    types: callData.slice(0, 10).map(v => typeof v),
    sampleValues: callData.slice(0, 5).map(v => ({ value: v, type: typeof v, string: String(v) }))
  });
  
  // CRITICAL: Use callData.slice(1) directly like the example app
  // getZKHonkCallData() already returns properly formatted felt252 values
  // We should NOT convert them again as that can cause felt252 overflow
  // callData format: [proof_length, ...proof_data_with_hints_and_embedded_public_inputs]
  const fullProofData = callData.slice(1);
  
  console.log('Raw full proof data from callData.slice(1):', {
    count: fullProofData.length,
    first5: fullProofData.slice(0, 5),
    types: fullProofData.slice(0, 5).map(v => typeof v),
    hasNonString: fullProofData.some(v => typeof v !== 'string'),
    sampleValues: fullProofData.slice(0, 10).map((v, i) => ({
      index: i,
      value: v,
      type: typeof v,
      stringified: String(v),
    }))
  });
  
  // CRITICAL: Use callData.slice(1) directly without conversion
  // The values from getZKHonkCallData() are already properly formatted as felt252
  // Only ensure they're strings (they should already be)
  const proofData = fullProofData.map((v, i) => {
    // Ensure it's a string (should already be from garaga)
    if (typeof v !== 'string') {
      // Convert to string if needed (shouldn't happen but be safe)
      const str = String(v);
      if (str.startsWith('0x') || str.startsWith('0X')) {
        return str.toLowerCase();
      }
      // If it's a number, convert to hex
      try {
        return '0x' + BigInt(v).toString(16);
      } catch {
        throw new Error(`Cannot convert proof value at index ${i} to hex: ${v} (${typeof v})`);
      }
    }
    // Already a string - normalize to lowercase
    return String(v).toLowerCase();
  });
  
  console.log(`Using ${proofData.length} proof values directly from callData.slice(1), first 5:`, proofData.slice(0, 5));
  
  // Validate all proof values are strings with 0x prefix
  const invalidProof = proofData.filter(v => typeof v !== 'string' || !v.startsWith('0x'));
  if (invalidProof.length > 0) {
    console.error(`Found ${invalidProof.length} proof values without 0x prefix:`, invalidProof);
    throw new Error(`Invalid proof data: ${invalidProof.length} values missing 0x prefix`);
  }
  
  // The verifier is called with only the proof (not public_inputs)
  // The position handler expects public_inputs as [market_id, commitment] at positions 0 and 1
  // We format public_inputs separately for the position handler
  // Reuse marketIdFelt declared earlier (line 91)
  const commitment = execResult.returnValue.toString();
  
  // Ensure values are in hex format (Starknet.js expects hex strings)
  // CRITICAL: Must be strings with 0x prefix
  // cairo.felt() returns a hex string, so we just need to normalize it
  let marketIdHex: string;
  const trimmed = String(marketIdFelt).trim();
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    marketIdHex = trimmed.toLowerCase();
  } else {
    // If somehow not hex, convert it
    try {
      marketIdHex = '0x' + BigInt(trimmed).toString(16);
    } catch {
      // Fallback: try as hex without prefix
      marketIdHex = '0x' + BigInt('0x' + trimmed).toString(16);
    }
  }
  
  // CRITICAL: Commitment is a 256-bit value that may exceed felt252 bounds (252 bits)
  // We need to reduce it modulo the Stark prime to fit in felt252
  // Stark prime: 0x800000000000011000000000000000000000000000000000000000000000000
  const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
  
  let commitmentBigInt: bigint;
  if (typeof commitment === 'string') {
    const trimmed = commitment.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      commitmentBigInt = BigInt(trimmed);
    } else {
      try {
        commitmentBigInt = BigInt(trimmed);
      } catch {
        // Fallback: try as hex without prefix
        commitmentBigInt = BigInt('0x' + trimmed);
      }
    }
  } else {
    commitmentBigInt = BigInt(commitment);
  }
  
  // Reduce commitment modulo Stark prime to fit in felt252
  const commitmentModulo = commitmentBigInt % STARK_PRIME;
  const commitmentHex = '0x' + commitmentModulo.toString(16);
  
  // Final validation - ensure both are strings with 0x prefix
  if (typeof marketIdHex !== 'string' || !marketIdHex.startsWith('0x')) {
    throw new Error(`Invalid marketIdHex: ${marketIdHex} (${typeof marketIdHex})`);
  }
  if (typeof commitmentHex !== 'string' || !commitmentHex.startsWith('0x')) {
    throw new Error(`Invalid commitmentHex: ${commitmentHex} (${typeof commitmentHex})`);
  }
  
  // Verify commitment fits in felt252 (63 hex digits after 0x)
  const commitmentHexDigits = commitmentHex.slice(2);
  if (commitmentHexDigits.length > 63) {
    throw new Error(`Commitment still exceeds felt252 bounds after modulo reduction: ${commitmentHexDigits.length} hex digits (max 63)`);
  }
  
  // CRITICAL: Force market_id to exact format - use the Pragma asset ID directly
  const expectedMarketId = PRAGMA_ASSET_IDS[inputs.marketId];
  if (!expectedMarketId) {
    throw new Error(`Unknown market_id: ${inputs.marketId}`);
  }
  
  // ALWAYS use the exact Pragma asset ID (lowercase hex)
  marketIdHex = expectedMarketId.toLowerCase();
  
  // Format public inputs as expected by the position handler: [market_id, commitment]
  const publicInputs = [marketIdHex, commitmentHex];
  
  // Final validation log
  console.log('✅ Final public_inputs (FORCED CORRECT FORMAT):', {
    market_id: publicInputs[0],
    commitment: publicInputs[1]?.substring(0, 20) + '...',
    market_id_format: '0x4254432f555344 (BTC/USD)',
    matches_expected: publicInputs[0].toLowerCase() === expectedMarketId.toLowerCase(),
  });
  
  // CRITICAL: Final validation - ensure all proof values are strings with 0x prefix
  const validatedProof = proofData.map((v, i) => {
    if (typeof v !== 'string') {
      console.error(`❌ Proof value at index ${i} is not a string:`, { value: v, type: typeof v });
      throw new Error(`Proof value at index ${i} must be a string, got ${typeof v}`);
    }
    if (!v.startsWith('0x') && !v.startsWith('0X')) {
      console.error(`❌ Proof value at index ${i} missing 0x prefix:`, { value: v });
      throw new Error(`Proof value at index ${i} must start with 0x, got: "${v}"`);
    }
    return v.toLowerCase(); // Normalize to lowercase
  });

  // Validate public inputs
  const validatedPublicInputs = publicInputs.map((v, i) => {
    if (typeof v !== 'string') {
      console.error(`❌ Public input at index ${i} is not a string:`, { value: v, type: typeof v });
      throw new Error(`Public input at index ${i} must be a string, got ${typeof v}`);
    }
    if (!v.startsWith('0x') && !v.startsWith('0X')) {
      console.error(`❌ Public input at index ${i} missing 0x prefix:`, { value: v });
      throw new Error(`Public input at index ${i} must start with 0x, got: "${v}"`);
    }
    return v.toLowerCase(); // Normalize to lowercase
  });

  console.log('Proof and public inputs:', {
    proofLength: validatedProof.length,
    publicInputsLength: validatedPublicInputs.length,
    marketId: marketIdHex,
    commitment: commitmentHex.substring(0, 20) + '...',
    allProofValid: validatedProof.every(v => typeof v === 'string' && v.startsWith('0x')),
    allPublicInputsValid: validatedPublicInputs.every(v => typeof v === 'string' && v.startsWith('0x')),
  });

  return {
    proof: validatedProof,
    publicInputs: validatedPublicInputs,
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

  // CRITICAL: According to Starknet team, public inputs are already part of the proof structure
  // We should use the FULL callData (minus the first element) as the proof
  // The verifier will extract and return the public inputs if the proof is valid
  // Use the full calldata (skip the first element which is proof_length)
  const fullProofData = callData.slice(1);
  
  // Helper function to ensure value is a hex string with 0x prefix
  // CRITICAL: Starknet.js requires ALL calldata values to be strings with 0x prefix
  // Note: This function is kept for potential future use but currently unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toHexString = (v: any, index?: number): string => {
    try {
      // Handle null/undefined/empty
      if (v === null || v === undefined || v === '') {
        return '0x0';
      }
      
      let num: bigint;
      
      // Convert to BigInt first, then to hex string
      if (typeof v === 'string') {
        const trimmed = v.trim();
        
        // If already has 0x prefix
        if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
          if (trimmed.length === 2) return '0x0'; // Just "0x"
          
          // Remove prefix and validate it's valid hex
          const hexPart = trimmed.slice(2);
          if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
            console.error(`Invalid hex string at index ${index}: ${v}`);
            return '0x0';
          }
          num = BigInt(trimmed);
        } else {
          // No prefix - try parsing as decimal or hex
          // First check if it looks like hex (only contains hex chars)
          if (/^[0-9a-fA-F]+$/.test(trimmed)) {
            // Try as hex first
            try {
              num = BigInt('0x' + trimmed);
            } catch {
              // Fall back to decimal
              num = BigInt(trimmed);
            }
          } else {
            // Contains non-hex chars, must be decimal
            num = BigInt(trimmed);
          }
        }
      } else if (typeof v === 'number') {
        if (!Number.isFinite(v) || Number.isNaN(v)) {
          console.warn(`Invalid number at index ${index}: ${v}, using 0x0`);
          return '0x0';
        }
        num = BigInt(Math.floor(v));
      } else if (typeof v === 'bigint') {
        num = v;
      } else {
        // Try to convert to string then parse
        const str = String(v).trim();
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
      console.error(`Error converting value at index ${index} to hex:`, {
        value: v,
        type: typeof v,
        error: error
      });
      return '0x0';
    }
  };
  
  // CRITICAL: Use callData.slice(1) directly like the example app (for closePosition)
  // getZKHonkCallData() already returns properly formatted felt252 values
  // We should NOT convert them again as that can cause felt252 overflow
  console.log('Raw full proof data from callData.slice(1) (closePosition):', {
    count: fullProofData.length,
    first5: fullProofData.slice(0, 5),
    types: fullProofData.slice(0, 5).map(v => typeof v),
    hasNonString: fullProofData.some(v => typeof v !== 'string'),
    sampleValues: fullProofData.slice(0, 10).map((v, i) => ({
      index: i,
      value: v,
      type: typeof v,
      stringified: String(v),
    }))
  });
  
  // CRITICAL: Use callData.slice(1) directly without conversion
  // The values from getZKHonkCallData() are already properly formatted as felt252
  // Only ensure they're strings (they should already be)
  const proofData = fullProofData.map((v, i) => {
    // Ensure it's a string (should already be from garaga)
    if (typeof v !== 'string') {
      // Convert to string if needed (shouldn't happen but be safe)
      const str = String(v);
      if (str.startsWith('0x') || str.startsWith('0X')) {
        return str.toLowerCase();
      }
      // If it's a number, convert to hex
      try {
        return '0x' + BigInt(v).toString(16);
      } catch {
        throw new Error(`Cannot convert proof value at index ${i} to hex: ${v} (${typeof v})`);
      }
    }
    // Already a string - normalize to lowercase
    return String(v).toLowerCase();
  });
  
  console.log(`Using ${proofData.length} proof values directly from callData.slice(1) (closePosition), first 5:`, proofData.slice(0, 5));
  
  // Validate all proof values are strings with 0x prefix
  const invalidProof = proofData.filter(v => typeof v !== 'string' || !v.startsWith('0x'));
  if (invalidProof.length > 0) {
    console.error(`Found ${invalidProof.length} proof values without 0x prefix:`, invalidProof);
    throw new Error(`Invalid proof data: ${invalidProof.length} values missing 0x prefix`);
  }
  
  // The verifier is called with only the proof (not public_inputs)
  // The position handler expects public inputs as [market_id, commitment, outcome_code] at positions 0, 1, and 2
  // Reuse marketIdFelt declared earlier (line 232)
  const commitment = execResult.returnValue.toString();
  const outcomeCode = '0'; // For close position, outcome_code is 0 (success)
  
  // Ensure values are in hex format (Starknet.js expects hex strings)
  // CRITICAL: Must be strings with 0x prefix
  // cairo.felt() returns a hex string, so we just need to normalize it
  let marketIdHex: string;
  const trimmed = String(marketIdFelt).trim();
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    marketIdHex = trimmed.toLowerCase();
  } else {
    // If somehow not hex, convert it
    try {
      marketIdHex = '0x' + BigInt(trimmed).toString(16);
    } catch {
      // Fallback: try as hex without prefix
      marketIdHex = '0x' + BigInt('0x' + trimmed).toString(16);
    }
  }
  
  // CRITICAL: Commitment is a 256-bit value that may exceed felt252 bounds (252 bits)
  // We need to reduce it modulo the Stark prime to fit in felt252
  // Stark prime: 0x800000000000011000000000000000000000000000000000000000000000000
  const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
  
  let commitmentBigInt: bigint;
  if (typeof commitment === 'string') {
    const trimmed = commitment.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      commitmentBigInt = BigInt(trimmed);
    } else {
      try {
        commitmentBigInt = BigInt(trimmed);
      } catch {
        // Fallback: try as hex without prefix
        commitmentBigInt = BigInt('0x' + trimmed);
      }
    }
  } else {
    commitmentBigInt = BigInt(commitment);
  }
  
  // Reduce commitment modulo Stark prime to fit in felt252
  const commitmentModulo = commitmentBigInt % STARK_PRIME;
  const commitmentHex = '0x' + commitmentModulo.toString(16);
  
  // Verify commitment fits in felt252 (63 hex digits after 0x)
  const commitmentHexDigits = commitmentHex.slice(2);
  if (commitmentHexDigits.length > 63) {
    throw new Error(`Commitment still exceeds felt252 bounds after modulo reduction: ${commitmentHexDigits.length} hex digits (max 63)`);
  }
  
  let outcomeCodeHex: string;
  if (typeof outcomeCode === 'string') {
    const trimmed = outcomeCode.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      outcomeCodeHex = trimmed.toLowerCase();
    } else {
      try {
        outcomeCodeHex = '0x' + BigInt(trimmed).toString(16);
      } catch {
        outcomeCodeHex = '0x' + BigInt('0x' + trimmed).toString(16);
      }
    }
  } else {
    outcomeCodeHex = '0x' + BigInt(outcomeCode).toString(16);
  }
  
  // Final validation - ensure all are strings with 0x prefix
  if (typeof marketIdHex !== 'string' || !marketIdHex.startsWith('0x')) {
    throw new Error(`Invalid marketIdHex: ${marketIdHex} (${typeof marketIdHex})`);
  }
  if (typeof commitmentHex !== 'string' || !commitmentHex.startsWith('0x')) {
    throw new Error(`Invalid commitmentHex: ${commitmentHex} (${typeof commitmentHex})`);
  }
  if (typeof outcomeCodeHex !== 'string' || !outcomeCodeHex.startsWith('0x')) {
    throw new Error(`Invalid outcomeCodeHex: ${outcomeCodeHex} (${typeof outcomeCodeHex})`);
  }
  
  // Format public inputs as expected by the contract: [market_id, commitment, outcome_code]
  const publicInputs = [marketIdHex, commitmentHex, outcomeCodeHex];

  // CRITICAL: Final validation - ensure all proof values are strings with 0x prefix
  const validatedProof = proofData.map((v, i) => {
    if (typeof v !== 'string') {
      console.error(`❌ Proof value at index ${i} is not a string:`, { value: v, type: typeof v });
      throw new Error(`Proof value at index ${i} must be a string, got ${typeof v}`);
    }
    if (!v.startsWith('0x') && !v.startsWith('0X')) {
      console.error(`❌ Proof value at index ${i} missing 0x prefix:`, { value: v });
      throw new Error(`Proof value at index ${i} must start with 0x, got: "${v}"`);
    }
    return v.toLowerCase(); // Normalize to lowercase
  });

  // Validate public inputs
  const validatedPublicInputs = publicInputs.map((v, i) => {
    if (typeof v !== 'string') {
      console.error(`❌ Public input at index ${i} is not a string:`, { value: v, type: typeof v });
      throw new Error(`Public input at index ${i} must be a string, got ${typeof v}`);
    }
    if (!v.startsWith('0x') && !v.startsWith('0X')) {
      console.error(`❌ Public input at index ${i} missing 0x prefix:`, { value: v });
      throw new Error(`Public input at index ${i} must start with 0x, got: "${v}"`);
    }
    return v.toLowerCase(); // Normalize to lowercase
  });

  return {
    proof: validatedProof,
    publicInputs: validatedPublicInputs,
    commitment: execResult.returnValue.toString(),
  };
}

