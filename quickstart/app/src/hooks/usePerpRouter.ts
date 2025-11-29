import { useCallback } from 'react';
import { useTradingStore } from '../stores/tradingStore';
import { CONTRACTS } from '../config/contracts';
import { num } from 'starknet';

export function usePerpRouter() {
  const ztarknetAccount = useTradingStore((state) => state.ztarknetAccount);
  const addPosition = useTradingStore((state) => state.addPosition);

  const openPosition = useCallback(
    async (
      proof: string[],
      publicInputs: string[]
    ) => {
      if (!ztarknetAccount) {
        throw new Error('Ztarknet trading wallet not ready. Please set up your trading wallet first.');
      }

      // Helper function to ensure value is a hex string with 0x prefix
      // CRITICAL: RPC requires ALL values to be strings with 0x prefix
      // We use num.toHex() but also add defensive check to ensure 0x prefix
      const toHexString = (v: any, index?: number): string => {
        try {
          if (v === null || v === undefined) {
            return '0x0';
          }
          
          let result: string;
          
          // Use starknet.js num.toHex() for proper formatting
          if (typeof v === 'string') {
            if (v.startsWith('0x') || v.startsWith('0X')) {
              if (v.length === 2) return '0x0';
              // Already has 0x, but normalize using num.toHex to ensure proper format
              try {
                result = num.toHex(BigInt(v));
              } catch {
                result = v.toLowerCase();
              }
            } else if (v === '') {
              result = '0x0';
            } else {
              // Try as decimal first, then as hex
              try {
                result = num.toHex(BigInt(v));
              } catch {
                try {
                  result = num.toHex(BigInt('0x' + v));
                } catch {
                  result = '0x0';
                }
              }
            }
          } else if (typeof v === 'bigint') {
            result = num.toHex(v);
          } else if (typeof v === 'number') {
            if (!Number.isFinite(v) || Number.isNaN(v)) {
              result = '0x0';
            } else {
              result = num.toHex(BigInt(v));
            }
          } else {
            // For any other type, convert to BigInt first
            try {
              const bigIntValue = BigInt(String(v));
              result = num.toHex(bigIntValue);
            } catch {
              result = '0x0';
            }
          }
          
          // CRITICAL: Defensive check - ensure result always has 0x prefix
          // num.toHex() should always return 0x prefix, but be extra safe
          if (!result.startsWith('0x') && !result.startsWith('0X')) {
            console.warn(`toHexString returned value without 0x prefix at index ${index}: "${result}", adding prefix`);
            // Try to parse as decimal and convert
            try {
              result = num.toHex(BigInt(result));
            } catch {
              // If that fails, try as hex without prefix
              try {
                result = num.toHex(BigInt('0x' + result));
              } catch {
                result = '0x0';
              }
            }
          }
          
          // Final validation - must be string with 0x prefix
          if (typeof result !== 'string' || !result.startsWith('0x')) {
            console.error(`CRITICAL: toHexString failed to produce valid hex string at index ${index}. Input: ${v} (${typeof v}), Output: ${result} (${typeof result})`);
            return '0x0';
          }
          
          return result.toLowerCase(); // Normalize to lowercase
        } catch (error) {
          console.error(`Error converting calldata value at index ${index} to hex:`, v, error);
          return '0x0';
        }
      };

      // Log raw proof and publicInputs to understand their format
      console.log('Raw proof and publicInputs before conversion:', {
        proofLength: proof.length,
        proofFirst5: proof.slice(0, 5),
        proofTypes: proof.slice(0, 5).map(v => typeof v),
        publicInputsLength: publicInputs.length,
        publicInputs: publicInputs,
        publicInputsTypes: publicInputs.map(v => typeof v),
      });
      
      // Format proof and public_inputs as Span<felt252>
      // Span format in calldata: [length, ...elements]
      // Starknet.js requires all calldata values to be hex strings with 0x prefix
      // For contract call, we need to flatten: [proof_len, ...proof, public_inputs_len, ...public_inputs]
      const proofLenHex = toHexString(proof.length, 0);
      const proofHex = proof.map((v, i) => {
        const originalType = typeof v;
        const originalValue = v;
        const hex = toHexString(v, i + 1);
        if (!hex.startsWith('0x')) {
          console.error(`Proof value at index ${i} missing 0x prefix:`, {
            original: originalValue,
            originalType,
            converted: hex
          });
          return '0x' + hex.replace(/^0x/, ''); // Remove any existing 0x and add it
        }
        return hex;
      });
      const publicInputsLenHex = toHexString(publicInputs.length, proof.length + 1);
      const publicInputsHex = publicInputs.map((v, i) => {
        const originalType = typeof v;
        const originalValue = v;
        const hex = toHexString(v, proof.length + 2 + i);
        if (!hex.startsWith('0x')) {
          console.error(`Public input at index ${i} missing 0x prefix:`, {
            original: originalValue,
            originalType,
            converted: hex
          });
          return '0x' + hex.replace(/^0x/, ''); // Remove any existing 0x and add it
        }
        return hex;
      });
      
      // Build calldata array - CRITICAL: All values MUST be strings with 0x prefix
      const calldataRaw = [
        proofLenHex,
        ...proofHex,
        publicInputsLenHex,
        ...publicInputsHex,
      ];

      // FINAL PASS: Ensure every single value is a string with 0x prefix
      // This is critical because JSON-RPC will reject any non-string values
      // We need to be extremely careful here - even one non-string value will cause the RPC to fail
      const calldata = calldataRaw.map((v, i) => {
        // Type check first
        if (typeof v === 'string') {
          // Already a string - ensure it has 0x prefix
          if (v.startsWith('0x') || v.startsWith('0X')) {
            // Normalize to lowercase and ensure it's valid
            const normalized = v.toLowerCase();
            if (normalized === '0x') return '0x0';
            return normalized;
          }
          // String without 0x - try to parse and convert
          try {
            const num = BigInt(v);
            return '0x' + num.toString(16);
          } catch {
            // Try as hex string without prefix
            try {
              const num = BigInt('0x' + v);
              return '0x' + num.toString(16);
            } catch {
              console.error(`Failed to convert string value at index ${i}: "${v}"`);
              return '0x0';
            }
          }
        }
        
        // Handle numbers
        if (typeof v === 'number') {
          if (!Number.isFinite(v) || Number.isNaN(v)) {
            console.error(`Invalid number at index ${i}: ${v}`);
            return '0x0';
          }
          // Handle negative numbers (shouldn't happen but be safe)
          if (v < 0) {
            // Convert to unsigned representation
            const num = BigInt(Math.floor(v));
            return '0x' + num.toString(16);
          }
          return '0x' + BigInt(v).toString(16);
        }
        
        // Handle bigint
        if (typeof v === 'bigint') {
          return '0x' + v.toString(16);
        }
        
        // For any other type, convert to string first
        try {
          const str = String(v);
          if (str.startsWith('0x') || str.startsWith('0X')) {
            return str.toLowerCase();
          }
          const num = BigInt(str);
          return '0x' + num.toString(16);
        } catch (error) {
          console.error(`Failed to convert value at index ${i} (type: ${typeof v}, value: ${v}):`, error);
          return '0x0';
        }
      });

      // Final validation - every value must be a string with 0x prefix
      // CRITICAL: This check happens BEFORE JSON serialization
      const invalidValues: { index: number; value: any; type: string; stringified: string }[] = [];
      calldata.forEach((v, i) => {
        if (typeof v !== 'string') {
          invalidValues.push({ 
            index: i, 
            value: v, 
            type: typeof v,
            stringified: String(v)
          });
        } else if (!v.startsWith('0x') && !v.startsWith('0X')) {
          invalidValues.push({ 
            index: i, 
            value: v, 
            type: typeof v,
            stringified: String(v)
          });
        }
      });
      
      if (invalidValues.length > 0) {
        console.error('CRITICAL: Invalid calldata values after final pass:', invalidValues);
        console.error('Calldata length:', calldata.length);
        console.error('First 20 calldata values with types:', calldata.slice(0, 20).map((v, i) => ({ 
          index: i, 
          value: v, 
          type: typeof v, 
          hasPrefix: typeof v === 'string' ? v.startsWith('0x') : false,
          stringified: String(v)
        })));
        // Try to fix them one more time
        invalidValues.forEach(({ index }) => {
          const original = calldata[index];
          try {
            if (typeof original === 'number' || typeof original === 'bigint') {
              calldata[index] = '0x' + BigInt(original).toString(16);
            } else {
              const str = String(original);
              if (str.startsWith('0x') || str.startsWith('0X')) {
                calldata[index] = str.toLowerCase();
              } else {
                calldata[index] = '0x' + BigInt(str).toString(16);
              }
            }
          } catch (error) {
            console.error(`Failed to fix value at index ${index}:`, original, error);
            calldata[index] = '0x0';
          }
        });
        
        // Re-validate after fix attempt
        const stillInvalid = calldata.filter((v, i) => typeof v !== 'string' || !v.startsWith('0x'));
        if (stillInvalid.length > 0) {
          throw new Error(`Found ${stillInvalid.length} calldata values that could not be converted to hex strings with 0x prefix`);
        }
      }
      
      // One final check - ensure ALL values are strings (for JSON serialization)
      const nonStringValues = calldata.filter(v => typeof v !== 'string');
      if (nonStringValues.length > 0) {
        console.error('CRITICAL: Found non-string values in calldata:', nonStringValues);
        throw new Error(`Found ${nonStringValues.length} non-string values in calldata. All values must be strings for JSON-RPC.`);
      }
      
      console.log(`Calldata prepared: ${calldata.length} values, all strings with 0x prefix`);
      console.log('Sample calldata (first 5):', calldata.slice(0, 5));
      console.log('Calldata types check:', calldata.every(v => typeof v === 'string' && v.startsWith('0x')));
      
      // CRITICAL: One final check before sending to RPC
      // JSON.stringify will serialize numbers without quotes, which RPC rejects
      // We MUST ensure every value is a string with 0x prefix
      // Convert EVERY value to string, regardless of current type
      const finalCalldata: string[] = [];
      for (let i = 0; i < calldata.length; i++) {
        const v = calldata[i];
        let str: string;
        
        // Force convert to string based on type using num.toHex() for consistency
        if (typeof v === 'string') {
          // If already a string with 0x, use num.toHex to normalize
          if (v.startsWith('0x') || v.startsWith('0X')) {
            try {
              str = num.toHex(BigInt(v));
            } catch {
              str = v.toLowerCase();
            }
          } else {
            // Try to parse and convert
            try {
              str = num.toHex(BigInt(v));
            } catch {
              try {
                str = num.toHex(BigInt('0x' + v));
              } catch {
                str = '0x0';
              }
            }
          }
        } else if (typeof v === 'number') {
          // Numbers MUST be converted to hex strings using num.toHex()
          if (!Number.isFinite(v) || Number.isNaN(v)) {
            console.error(`CRITICAL: Invalid number at index ${i}: ${v}`);
            str = '0x0';
          } else {
            str = num.toHex(BigInt(v));
          }
        } else if (typeof v === 'bigint') {
          str = num.toHex(v);
        } else {
          // Unknown type - try to convert using num.toHex()
          try {
            const bigIntValue = BigInt(String(v));
            str = num.toHex(bigIntValue);
          } catch {
            console.error(`CRITICAL: Failed to convert value at index ${i}:`, v, typeof v);
            str = '0x0';
          }
        }
        
        // Ensure 0x prefix (num.toHex() should always return 0x prefix, but double-check)
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = num.toHex(BigInt(str));
          } catch {
            str = '0x0';
          }
        }
        
        // Normalize
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        
        // Final type assertion
        if (typeof str !== 'string') {
          console.error(`CRITICAL: Value still not string at index ${i}:`, str, typeof str);
          str = '0x0';
        }
        
        finalCalldata.push(str);
      }
      
      // Validate all are strings
      const nonString = finalCalldata.filter(v => typeof v !== 'string');
      if (nonString.length > 0) {
        throw new Error(`Found ${nonString.length} non-string values in finalCalldata`);
      }
      
      // CRITICAL: Final validation - ensure EVERY value has 0x prefix
      // This is the absolute last check before RPC call
      const valuesWithoutPrefix: { index: number; value: string }[] = [];
      finalCalldata.forEach((v, i) => {
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          valuesWithoutPrefix.push({ index: i, value: v });
        }
      });
      
      if (valuesWithoutPrefix.length > 0) {
        console.error('CRITICAL: Found values without 0x prefix RIGHT BEFORE RPC CALL:', valuesWithoutPrefix);
        // Try to fix them
        valuesWithoutPrefix.forEach(({ index }) => {
          const original = finalCalldata[index];
          try {
            if (typeof original === 'string') {
              // Try to parse as decimal and convert
              finalCalldata[index] = num.toHex(BigInt(original));
            } else {
              finalCalldata[index] = num.toHex(BigInt(String(original)));
            }
          } catch {
            finalCalldata[index] = '0x0';
          }
        });
        
        // Re-check after fix
        const stillMissing = finalCalldata.filter(v => !v.startsWith('0x'));
        if (stillMissing.length > 0) {
          throw new Error(`CRITICAL: ${stillMissing.length} values still missing 0x prefix after final fix attempt`);
        }
      }

      // CRITICAL: One more pass - explicitly ensure every value is a string
      // This prevents any potential number serialization in JSON
      const finalCalldataStrings = finalCalldata.map((v, i) => {
        // Force to string first
        let str = String(v);
        
        // Ensure it has 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          console.error(`CRITICAL: Value at index ${i} missing 0x prefix in final pass: "${str}"`);
          // Try to fix
          try {
            const bigIntValue = BigInt(str);
            str = num.toHex(bigIntValue);
          } catch {
            try {
              const bigIntValue = BigInt('0x' + str);
              str = num.toHex(bigIntValue);
            } catch {
              str = '0x0';
            }
          }
        }
        
        // Final check
        if (typeof str !== 'string' || !str.startsWith('0x')) {
          console.error(`CRITICAL: Failed to ensure string with 0x at index ${i}, using 0x0`);
          return '0x0';
        }
        
        return str.toLowerCase();
      });
      
      // Final validation
      const stillInvalid = finalCalldataStrings.filter((v, i) => typeof v !== 'string' || !v.startsWith('0x'));
      if (stillInvalid.length > 0) {
        console.error('CRITICAL: Values still invalid after final string conversion:', stillInvalid.map((v, i) => ({ index: i, value: v, type: typeof v })));
        throw new Error(`CRITICAL: ${stillInvalid.length} values still invalid after final string conversion`);
      }
      
      // CRITICAL: Log the actual calldata being sent to verify all are strings
      console.log('Final calldata being sent to account.execute():', {
        length: finalCalldataStrings.length,
        allStrings: finalCalldataStrings.every(v => typeof v === 'string'),
        allHavePrefix: finalCalldataStrings.every(v => v.startsWith('0x')),
        sample: finalCalldataStrings.slice(0, 10),
        sampleTypes: finalCalldataStrings.slice(0, 10).map(v => typeof v),
        // Check for any non-string values
        nonStringIndices: finalCalldataStrings.map((v, i) => typeof v !== 'string' ? i : -1).filter(i => i !== -1),
        // Check for any values without 0x prefix
        missingPrefixIndices: finalCalldataStrings.map((v, i) => !v.startsWith('0x') ? i : -1).filter(i => i !== -1),
      });

      // CRITICAL: One final pass to ensure all values are strings with 0x prefix
      // This prevents any potential issues with JSON serialization in the RPC call
      const sanitizedCalldata = finalCalldataStrings.map((v, i) => {
        // Force to string
        let str = String(v);
        
        // Remove any whitespace
        str = str.trim();
        
        // Ensure 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          // Try to parse as number and convert
          try {
            const num = BigInt(str);
            str = '0x' + num.toString(16);
          } catch {
            // Try as hex without prefix
            try {
              const num = BigInt('0x' + str);
              str = '0x' + num.toString(16);
            } catch {
              console.error(`Failed to sanitize calldata value at index ${i}: "${v}"`);
              str = '0x0';
            }
          }
        }
        
        // Normalize to lowercase
        str = str.toLowerCase();
        
        // Handle edge case: just "0x"
        if (str === '0x') {
          str = '0x0';
        }
        
        // Final validation
        if (typeof str !== 'string' || !str.startsWith('0x')) {
          console.error(`CRITICAL: Value at index ${i} still invalid after sanitization: "${str}"`);
          return '0x0';
        }
        
        return str;
      });

      // Execute using account.execute with properly formatted calldata
      const result = await ztarknetAccount.execute({
        contractAddress: CONTRACTS.PERP_ROUTER,
        entrypoint: 'open_position',
        calldata: sanitizedCalldata,
      });
      return result;
    },
    [ztarknetAccount, addPosition]
  );

  const closePosition = useCallback(
    async (proof: string[], publicInputs: string[], commitment: string) => {
      if (!ztarknetAccount) {
        throw new Error('Ztarknet trading wallet not ready. Please set up your trading wallet first.');
      }

      // Helper function to ensure value is a hex string with 0x prefix
      // CRITICAL: RPC requires ALL values to be strings with 0x prefix
      // We use num.toHex() but also add defensive check to ensure 0x prefix
      const toHexString = (v: any, index?: number): string => {
        try {
          if (v === null || v === undefined) {
            return '0x0';
          }
          
          let result: string;
          
          // Use starknet.js num.toHex() for proper formatting
          if (typeof v === 'string') {
            if (v.startsWith('0x') || v.startsWith('0X')) {
              if (v.length === 2) return '0x0';
              // Already has 0x, but normalize using num.toHex to ensure proper format
              try {
                result = num.toHex(BigInt(v));
              } catch {
                result = v.toLowerCase();
              }
            } else if (v === '') {
              result = '0x0';
            } else {
              // Try as decimal first, then as hex
              try {
                result = num.toHex(BigInt(v));
              } catch {
                try {
                  result = num.toHex(BigInt('0x' + v));
                } catch {
                  result = '0x0';
                }
              }
            }
          } else if (typeof v === 'bigint') {
            result = num.toHex(v);
          } else if (typeof v === 'number') {
            if (!Number.isFinite(v) || Number.isNaN(v)) {
              result = '0x0';
            } else {
              result = num.toHex(BigInt(v));
            }
          } else {
            // For any other type, convert to BigInt first
            try {
              const bigIntValue = BigInt(String(v));
              result = num.toHex(bigIntValue);
            } catch {
              result = '0x0';
            }
          }
          
          // CRITICAL: Defensive check - ensure result always has 0x prefix
          // num.toHex() should always return 0x prefix, but be extra safe
          if (!result.startsWith('0x') && !result.startsWith('0X')) {
            console.warn(`toHexString returned value without 0x prefix at index ${index}: "${result}", adding prefix`);
            // Try to parse as decimal and convert
            try {
              result = num.toHex(BigInt(result));
            } catch {
              // If that fails, try as hex without prefix
              try {
                result = num.toHex(BigInt('0x' + result));
              } catch {
                result = '0x0';
              }
            }
          }
          
          // Final validation - must be string with 0x prefix
          if (typeof result !== 'string' || !result.startsWith('0x')) {
            console.error(`CRITICAL: toHexString failed to produce valid hex string at index ${index}. Input: ${v} (${typeof v}), Output: ${result} (${typeof result})`);
            return '0x0';
          }
          
          return result.toLowerCase(); // Normalize to lowercase
        } catch (error) {
          console.error(`Error converting calldata value at index ${index} to hex:`, v, error);
          return '0x0';
        }
      };

      // Log raw proof and publicInputs to understand their format
      console.log('Raw proof and publicInputs before conversion (closePosition):', {
        proofLength: proof.length,
        proofFirst5: proof.slice(0, 5),
        proofTypes: proof.slice(0, 5).map(v => typeof v),
        publicInputsLength: publicInputs.length,
        publicInputs: publicInputs,
        publicInputsTypes: publicInputs.map(v => typeof v),
        commitment: commitment,
        commitmentType: typeof commitment,
      });

      // Format proof and public_inputs as Span<felt252>
      // Span format in calldata: [length, ...elements]
      // Starknet.js requires all calldata values to be hex strings with 0x prefix
      // For contract call, we need to flatten: [proof_len, ...proof, public_inputs_len, ...public_inputs, commitment]
      const proofLenHex = toHexString(proof.length, 0);
      const proofHex = proof.map((v, i) => {
        const originalType = typeof v;
        const originalValue = v;
        const hex = toHexString(v, i + 1);
        if (!hex.startsWith('0x')) {
          console.error(`Proof value at index ${i} missing 0x prefix:`, {
            original: originalValue,
            originalType,
            converted: hex
          });
          return '0x' + hex.replace(/^0x/, ''); // Remove any existing 0x and add it
        }
        return hex;
      });
      const publicInputsLenHex = toHexString(publicInputs.length, proof.length + 1);
      const publicInputsHex = publicInputs.map((v, i) => {
        const originalType = typeof v;
        const originalValue = v;
        const hex = toHexString(v, proof.length + 2 + i);
        if (!hex.startsWith('0x')) {
          console.error(`Public input at index ${i} missing 0x prefix:`, {
            original: originalValue,
            originalType,
            converted: hex
          });
          return '0x' + hex.replace(/^0x/, ''); // Remove any existing 0x and add it
        }
        return hex;
      });
      const commitmentHex = toHexString(commitment, proof.length + publicInputs.length + 2);
      
      // Build calldata array - CRITICAL: All values MUST be strings with 0x prefix
      const calldataRaw = [
        proofLenHex,
        ...proofHex,
        publicInputsLenHex,
        ...publicInputsHex,
        commitmentHex,
      ];

      // FINAL PASS: Ensure every single value is a string with 0x prefix
      // This is critical because JSON-RPC will reject any non-string values
      // We need to be extremely careful here - even one non-string value will cause the RPC to fail
      const calldata = calldataRaw.map((v, i) => {
        // Type check first
        if (typeof v === 'string') {
          // Already a string - ensure it has 0x prefix
          if (v.startsWith('0x') || v.startsWith('0X')) {
            // Normalize to lowercase and ensure it's valid
            const normalized = v.toLowerCase();
            if (normalized === '0x') return '0x0';
            return normalized;
          }
          // String without 0x - try to parse and convert
          try {
            const num = BigInt(v);
            return '0x' + num.toString(16);
          } catch {
            // Try as hex string without prefix
            try {
              const num = BigInt('0x' + v);
              return '0x' + num.toString(16);
            } catch {
              console.error(`Failed to convert string value at index ${i}: "${v}"`);
              return '0x0';
            }
          }
        }
        
        // Handle numbers
        if (typeof v === 'number') {
          if (!Number.isFinite(v) || Number.isNaN(v)) {
            console.error(`Invalid number at index ${i}: ${v}`);
            return '0x0';
          }
          // Handle negative numbers (shouldn't happen but be safe)
          if (v < 0) {
            // Convert to unsigned representation
            const num = BigInt(Math.floor(v));
            return '0x' + num.toString(16);
          }
          return '0x' + BigInt(v).toString(16);
        }
        
        // Handle bigint
        if (typeof v === 'bigint') {
          return '0x' + v.toString(16);
        }
        
        // For any other type, convert to string first
        try {
          const str = String(v);
          if (str.startsWith('0x') || str.startsWith('0X')) {
            return str.toLowerCase();
          }
          const num = BigInt(str);
          return '0x' + num.toString(16);
        } catch (error) {
          console.error(`Failed to convert value at index ${i} (type: ${typeof v}, value: ${v}):`, error);
          return '0x0';
        }
      });

      // Final validation - every value must be a string with 0x prefix
      // CRITICAL: This check happens BEFORE JSON serialization
      const invalidValues: { index: number; value: any; type: string; stringified: string }[] = [];
      calldata.forEach((v, i) => {
        if (typeof v !== 'string') {
          invalidValues.push({ 
            index: i, 
            value: v, 
            type: typeof v,
            stringified: String(v)
          });
        } else if (!v.startsWith('0x') && !v.startsWith('0X')) {
          invalidValues.push({ 
            index: i, 
            value: v, 
            type: typeof v,
            stringified: String(v)
          });
        }
      });
      
      if (invalidValues.length > 0) {
        console.error('CRITICAL: Invalid calldata values after final pass (closePosition):', invalidValues);
        console.error('Calldata length:', calldata.length);
        console.error('First 20 calldata values with types:', calldata.slice(0, 20).map((v, i) => ({ 
          index: i, 
          value: v, 
          type: typeof v, 
          hasPrefix: typeof v === 'string' ? v.startsWith('0x') : false,
          stringified: String(v)
        })));
        // Try to fix them one more time
        invalidValues.forEach(({ index }) => {
          const original = calldata[index];
          try {
            if (typeof original === 'number' || typeof original === 'bigint') {
              calldata[index] = '0x' + BigInt(original).toString(16);
            } else {
              const str = String(original);
              if (str.startsWith('0x') || str.startsWith('0X')) {
                calldata[index] = str.toLowerCase();
              } else {
                calldata[index] = '0x' + BigInt(str).toString(16);
              }
            }
          } catch (error) {
            console.error(`Failed to fix value at index ${index}:`, original, error);
            calldata[index] = '0x0';
          }
        });
        
        // Re-validate after fix attempt
        const stillInvalid = calldata.filter((v, i) => typeof v !== 'string' || !v.startsWith('0x'));
        if (stillInvalid.length > 0) {
          throw new Error(`Found ${stillInvalid.length} calldata values that could not be converted to hex strings with 0x prefix`);
        }
      }
      
      // One final check - ensure ALL values are strings (for JSON serialization)
      const nonStringValues = calldata.filter(v => typeof v !== 'string');
      if (nonStringValues.length > 0) {
        console.error('CRITICAL: Found non-string values in calldata:', nonStringValues);
        throw new Error(`Found ${nonStringValues.length} non-string values in calldata. All values must be strings for JSON-RPC.`);
      }
      
      console.log(`Calldata prepared (closePosition): ${calldata.length} values, all strings with 0x prefix`);
      console.log('Sample calldata (first 5):', calldata.slice(0, 5));
      console.log('Calldata types check:', calldata.every(v => typeof v === 'string' && v.startsWith('0x')));
      
      // CRITICAL: One final check before sending to RPC
      // JSON.stringify will serialize numbers without quotes, which RPC rejects
      // We MUST ensure every value is a string with 0x prefix
      // Convert EVERY value to string, regardless of current type
      const finalCalldata: string[] = [];
      for (let i = 0; i < calldata.length; i++) {
        const v = calldata[i];
        let str: string;
        
        // Force convert to string based on type using num.toHex() for consistency
        if (typeof v === 'string') {
          // If already a string with 0x, use num.toHex to normalize
          if (v.startsWith('0x') || v.startsWith('0X')) {
            try {
              str = num.toHex(BigInt(v));
            } catch {
              str = v.toLowerCase();
            }
          } else {
            // Try to parse and convert
            try {
              str = num.toHex(BigInt(v));
            } catch {
              try {
                str = num.toHex(BigInt('0x' + v));
              } catch {
                str = '0x0';
              }
            }
          }
        } else if (typeof v === 'number') {
          // Numbers MUST be converted to hex strings using num.toHex()
          if (!Number.isFinite(v) || Number.isNaN(v)) {
            console.error(`CRITICAL: Invalid number at index ${i}: ${v}`);
            str = '0x0';
          } else {
            str = num.toHex(BigInt(v));
          }
        } else if (typeof v === 'bigint') {
          str = num.toHex(v);
        } else {
          // Unknown type - try to convert using num.toHex()
          try {
            const bigIntValue = BigInt(String(v));
            str = num.toHex(bigIntValue);
          } catch {
            console.error(`CRITICAL: Failed to convert value at index ${i}:`, v, typeof v);
            str = '0x0';
          }
        }
        
        // Ensure 0x prefix (num.toHex() should always return 0x prefix, but double-check)
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = num.toHex(BigInt(str));
          } catch {
            str = '0x0';
          }
        }
        
        // Normalize
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        
        // Final type assertion
        if (typeof str !== 'string') {
          console.error(`CRITICAL: Value still not string at index ${i}:`, str, typeof str);
          str = '0x0';
        }
        
        finalCalldata.push(str);
      }
      
      // Validate all are strings
      const nonString = finalCalldata.filter(v => typeof v !== 'string');
      if (nonString.length > 0) {
        throw new Error(`Found ${nonString.length} non-string values in finalCalldata`);
      }
      
      // CRITICAL: Final validation - ensure EVERY value has 0x prefix
      // This is the absolute last check before RPC call
      const valuesWithoutPrefix: { index: number; value: string }[] = [];
      finalCalldata.forEach((v, i) => {
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          valuesWithoutPrefix.push({ index: i, value: v });
        }
      });
      
      if (valuesWithoutPrefix.length > 0) {
        console.error('CRITICAL: Found values without 0x prefix RIGHT BEFORE RPC CALL (closePosition):', valuesWithoutPrefix);
        // Try to fix them
        valuesWithoutPrefix.forEach(({ index }) => {
          const original = finalCalldata[index];
          try {
            if (typeof original === 'string') {
              // Try to parse as decimal and convert
              finalCalldata[index] = num.toHex(BigInt(original));
            } else {
              finalCalldata[index] = num.toHex(BigInt(String(original)));
            }
          } catch {
            finalCalldata[index] = '0x0';
          }
        });
        
        // Re-check after fix
        const stillMissing = finalCalldata.filter(v => !v.startsWith('0x'));
        if (stillMissing.length > 0) {
          throw new Error(`CRITICAL: ${stillMissing.length} values still missing 0x prefix after final fix attempt (closePosition)`);
        }
      }

      // CRITICAL: One more pass - explicitly ensure every value is a string
      // This prevents any potential number serialization in JSON
      const finalCalldataStrings = finalCalldata.map((v, i) => {
        // Force to string first
        let str = String(v);
        
        // Ensure it has 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          console.error(`CRITICAL: Value at index ${i} missing 0x prefix in final pass (closePosition): "${str}"`);
          // Try to fix
          try {
            const bigIntValue = BigInt(str);
            str = num.toHex(bigIntValue);
          } catch {
            try {
              const bigIntValue = BigInt('0x' + str);
              str = num.toHex(bigIntValue);
            } catch {
              str = '0x0';
            }
          }
        }
        
        // Final check
        if (typeof str !== 'string' || !str.startsWith('0x')) {
          console.error(`CRITICAL: Failed to ensure string with 0x at index ${i} (closePosition), using 0x0`);
          return '0x0';
        }
        
        return str.toLowerCase();
      });
      
      // Final validation
      const stillInvalid = finalCalldataStrings.filter((v, i) => typeof v !== 'string' || !v.startsWith('0x'));
      if (stillInvalid.length > 0) {
        console.error('CRITICAL: Values still invalid after final string conversion (closePosition):', stillInvalid.map((v, i) => ({ index: i, value: v, type: typeof v })));
        throw new Error(`CRITICAL: ${stillInvalid.length} values still invalid after final string conversion (closePosition)`);
      }

      // CRITICAL: One final pass to ensure all values are strings with 0x prefix
      // This prevents any potential issues with JSON serialization in the RPC call
      const sanitizedCalldata = finalCalldataStrings.map((v, i) => {
        // Force to string
        let str = String(v);
        
        // Remove any whitespace
        str = str.trim();
        
        // Ensure 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          // Try to parse as number and convert
          try {
            const num = BigInt(str);
            str = '0x' + num.toString(16);
          } catch {
            // Try as hex without prefix
            try {
              const num = BigInt('0x' + str);
              str = '0x' + num.toString(16);
            } catch {
              console.error(`Failed to sanitize calldata value at index ${i} (closePosition): "${v}"`);
              str = '0x0';
            }
          }
        }
        
        // Normalize to lowercase
        str = str.toLowerCase();
        
        // Handle edge case: just "0x"
        if (str === '0x') {
          str = '0x0';
        }
        
        // Final validation
        if (typeof str !== 'string' || !str.startsWith('0x')) {
          console.error(`CRITICAL: Value at index ${i} still invalid after sanitization (closePosition): "${str}"`);
          return '0x0';
        }
        
        return str;
      });

      // Execute using account.execute with properly formatted calldata
      const result = await ztarknetAccount.execute({
        contractAddress: CONTRACTS.PERP_ROUTER,
        entrypoint: 'close_position',
        calldata: sanitizedCalldata,
      });
      return result;
    },
    [ztarknetAccount]
  );

  return {
    openPosition,
    closePosition,
  };
}

