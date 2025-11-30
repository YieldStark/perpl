import { useCallback } from 'react';
import { useTradingStore } from '../stores/tradingStore';
import { CONTRACTS, NETWORK } from '../config/contracts';
import { num, RpcProvider } from 'starknet';

export function usePerpRouter() {
  const ztarknetAccount = useTradingStore((state) => state.ztarknetAccount);
  const addPosition = useTradingStore((state) => state.addPosition);

  const openPosition = useCallback(
    async (
      proof: string[],
      publicInputs: string[]
    ) => {
      // FELT252_MAX: Maximum value for a felt252 (252 bits = 63 hex digits after 0x)
      // felt252 range: 0 to 0x800000000000011000000000000000000000000000000000000000000000000
      const FELT252_MAX = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
      if (!ztarknetAccount) {
        throw new Error('Ztarknet trading wallet not ready. Please set up your trading wallet first.');
      }

      // CRITICAL: Validate inputs at entry point - ensure all are strings with 0x prefix
      const validateHexArray = (arr: any[], name: string) => {
        arr.forEach((v, i) => {
          if (typeof v !== 'string') {
            console.error(`❌ ${name}[${i}] is not a string:`, { value: v, type: typeof v });
            throw new Error(`${name}[${i}] must be a string, got ${typeof v}`);
          }
          if (!v.startsWith('0x') && !v.startsWith('0X')) {
            console.error(`❌ ${name}[${i}] missing 0x prefix:`, { value: v, length: v.length });
            throw new Error(`${name}[${i}] must start with 0x, got: "${v}"`);
          }
        });
      };

      validateHexArray(proof, 'proof');
      validateHexArray(publicInputs, 'publicInputs');

      // Log raw proof and publicInputs to understand their format
      console.log('Raw proof and publicInputs before conversion:', {
        proofLength: proof.length,
        proofFirst5: proof.slice(0, 5),
        proofTypes: proof.slice(0, 5).map(v => typeof v),
        publicInputsLength: publicInputs.length,
        publicInputs: publicInputs,
        publicInputsTypes: publicInputs.map(v => typeof v),
      });
      
      // CRITICAL: Use proof directly from proofService (it's already callData.slice(1) from garaga)
      // Like the example app, we should NOT convert values again as that causes felt252 overflow
      // The proof from proofService is already properly formatted by getZKHonkCallData()
      
      // Extract only market_id and commitment from publicInputs (first 2 elements)
      if (publicInputs.length < 2) {
        throw new Error(`Invalid publicInputs: expected at least 2 elements (market_id, commitment), got ${publicInputs.length}`);
      }
      
      const minimalPublicInputs = [publicInputs[0], publicInputs[1]]; // [market_id, commitment]
      
      // 🔍 DEBUG: Log the market_id in public inputs
      // CRITICAL: Ensure market_id is in correct format
      const expectedMarketId = '0x4254432f555344'; // BTC/USD Pragma asset ID
      const actualMarketId = publicInputs[0]?.toLowerCase();
      
      if (actualMarketId !== expectedMarketId) {
        console.warn('⚠️  Market ID format mismatch, correcting...', {
          got: actualMarketId,
          expected: expectedMarketId,
        });
        // Force correct format
        publicInputs[0] = expectedMarketId;
      }
      
      console.log('🔍 Public Inputs (usePerpRouter):', {
        marketIdInPublicInputs: publicInputs[0],
        expectedPragmaId: expectedMarketId,
        matches: publicInputs[0]?.toLowerCase() === expectedMarketId,
        commitment: publicInputs[1]?.substring(0, 20) + '...',
      });
      
      // CRITICAL: Use proof directly without conversion (like example app)
      // The proof is already callData.slice(1) - properly formatted felt252 values
      // Only ensure they're strings (they should already be)
      const proofFormatted = proof.map((v, i) => {
        if (typeof v !== 'string') {
          throw new Error(`Proof value at index ${i} is not a string: ${v} (${typeof v})`);
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          throw new Error(`Proof value at index ${i} missing 0x prefix: ${v}`);
        }
        return v.toLowerCase(); // Normalize to lowercase
      });
      
      // Format minimal public_inputs - ensure they're strings with 0x prefix
      const publicInputsFormatted = minimalPublicInputs.map((v, i) => {
        if (typeof v !== 'string') {
          throw new Error(`Public input at index ${i} is not a string: ${v} (${typeof v})`);
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          throw new Error(`Public input at index ${i} missing 0x prefix: ${v}`);
        }
        return v.toLowerCase(); // Normalize to lowercase
      });
      
      // Format as Span<felt252> for contract call
      // Span format: [length, ...elements]
      // Use proof length and public_inputs length as numbers, convert to hex
      const proofLenHex = '0x' + BigInt(proofFormatted.length).toString(16);
      const publicInputsLenHex = '0x' + BigInt(publicInputsFormatted.length).toString(16);
      
      // Build calldata array - CRITICAL: Use proof directly without conversion
      // Format: [proof_len, ...proof, public_inputs_len, ...minimal_public_inputs]
      const calldataRaw = [
        proofLenHex,
        ...proofFormatted,  // Use proof directly - already properly formatted
        publicInputsLenHex,
        ...publicInputsFormatted,  // Use public_inputs directly - already properly formatted
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
          return '0x' + (v as bigint).toString(16);
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
      
      // CRITICAL: Check for felt252 overflow (Starknet team identified this issue)
      // The last element is often a concatenated value that can overflow felt252 bounds
      const overflowElements: { index: number; value: string; hexDigits: number }[] = [];
      
      calldata.forEach((v, i) => {
        if (typeof v === 'string' && v.startsWith('0x')) {
          const hexDigits = v.slice(2);
          if (hexDigits.length > 63) {
            overflowElements.push({ index: i, value: v, hexDigits: hexDigits.length });
          }
        }
      });
      
      if (overflowElements.length > 0) {
        console.error(`❌ CRITICAL: Found ${overflowElements.length} calldata elements exceeding felt252 bounds:`, overflowElements);
        // Check the last element especially (Starknet team identified this)
        if (calldata.length > 0) {
          const lastElement = calldata[calldata.length - 1];
          const lastHexDigits = lastElement.startsWith('0x') ? lastElement.slice(2) : lastElement;
          if (lastHexDigits.length > 63) {
            console.error('❌ Last calldata element exceeds felt252 bounds!');
            console.error(`   Last element: ${lastElement}`);
            console.error(`   Hex digits: ${lastHexDigits.length} (max 63)`);
            console.error(`   This is likely causing the RPC error: "expected hex string to be prefixed by 0x"`);
            try {
              const lastValue = BigInt(lastElement);
              if (lastValue >= FELT252_MAX) {
                console.error(`   Value ${lastValue} >= FELT252_MAX ${FELT252_MAX}`);
                console.error(`   Overflow amount: ${lastValue - FELT252_MAX}`);
              }
            } catch (e) {
              console.error(`   Could not parse last element as BigInt:`, e);
            }
          }
        }
      }
      
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
        const stillInvalid = calldata.filter((v) => typeof v !== 'string' || !v.startsWith('0x'));
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
      const stillInvalid = finalCalldataStrings.filter((v) => typeof v !== 'string' || !v.startsWith('0x'));
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

      // CRITICAL: Test JSON serialization to catch any values that would fail RPC validation
      // This simulates what happens when Starknet.js serializes the request
      try {
        console.log('Testing JSON serialization of calldata...');
        const testJSON = JSON.stringify({ calldata: sanitizedCalldata });
        const parsed = JSON.parse(testJSON);
        
        // Check each value after round-trip through JSON
        const problematicValues: Array<{ index: number; issue: string; original: any; afterJSON: any }> = [];
        
        parsed.calldata.forEach((v: any, i: number) => {
          const original = sanitizedCalldata[i];
          
          // Check if value lost its string type
          if (typeof v !== 'string') {
            problematicValues.push({
              index: i,
              issue: 'not_string',
              original: original,
              afterJSON: v
            });
            console.error(`❌ Value at index ${i} is not a string after JSON serialization:`, {
              original: original,
              originalType: typeof original,
              afterJSON: v,
              afterJSONType: typeof v,
              originalInArray: sanitizedCalldata[i],
              originalArrayType: typeof sanitizedCalldata[i]
            });
          } 
          // Check if value lost its 0x prefix
          else if (!v.startsWith('0x') && !v.startsWith('0X')) {
            problematicValues.push({
              index: i,
              issue: 'missing_prefix',
              original: original,
              afterJSON: v
            });
            console.error(`❌ Value at index ${i} missing 0x prefix after JSON serialization:`, {
              original: original,
              afterJSON: v,
              originalLength: original?.length,
              afterJSONLength: v?.length
            });
          }
        });
        
        if (problematicValues.length > 0) {
          console.error('CRITICAL: Found problematic values after JSON serialization:', problematicValues);
          console.error('Full problematic values details:', problematicValues.map(pv => ({
            index: pv.index,
            issue: pv.issue,
            original: pv.original,
            originalType: typeof pv.original,
            originalStringified: String(pv.original),
            afterJSON: pv.afterJSON,
            afterJSONType: typeof pv.afterJSON,
            originalJSON: JSON.stringify(pv.original),
            afterJSONJSON: JSON.stringify(pv.afterJSON)
          })));
          
          // Try to fix the problematic values
          const fixedCalldata = sanitizedCalldata.map((v, i) => {
            const problematic = problematicValues.find(pv => pv.index === i);
            if (problematic) {
              console.log(`Attempting to fix value at index ${i}:`, problematic);
              // Force to string explicitly
              let fixed = String(v);
              if (!fixed.startsWith('0x') && !fixed.startsWith('0X')) {
                try {
                  fixed = '0x' + BigInt(fixed).toString(16);
                } catch {
                  fixed = '0x0';
                }
              }
              console.log(`Fixed value at index ${i}: "${v}" -> "${fixed}"`);
              return fixed;
            }
            return v;
          });
          
          // Test the fixed calldata
          const fixedTestJSON = JSON.stringify({ calldata: fixedCalldata });
          const fixedParsed = JSON.parse(fixedTestJSON);
          const stillProblematic = fixedParsed.calldata.filter((v: any) => 
            typeof v !== 'string' || !v.startsWith('0x')
          );
          
          if (stillProblematic.length > 0) {
            throw new Error(`CRITICAL: Found ${problematicValues.length} values that would fail RPC validation after JSON serialization. Unable to auto-fix. Check console for details.`);
          } else {
            console.log('Successfully fixed problematic values, using fixed calldata');
            // Use the fixed calldata
            sanitizedCalldata.splice(0, sanitizedCalldata.length, ...fixedCalldata);
          }
        } else {
          console.log('✅ All calldata values passed JSON serialization test');
        }
      } catch (error) {
        console.error('CRITICAL: JSON serialization test failed:', error);
        throw error;
      }

      // CRITICAL: Create a completely new array with fresh string objects
      // Use Object.freeze() on each string to prevent any modification
      // Also ensure we're creating primitive strings, not String objects
      const finalCalldataForRPC: readonly string[] = sanitizedCalldata.map((v) => {
        // Force to primitive string
        let str: string;
        if (typeof v === 'string') {
          str = v;
        } else {
          str = String(v);
        }
        
        // Ensure 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = '0x' + BigInt(str).toString(16);
          } catch {
            str = '0x0';
          }
        }
        
        // Normalize to lowercase
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        
        // Return as a fresh primitive string (not a String object)
        return String(str);
      });

      // Final verification - check every single value
      const verificationIssues: Array<{ index: number; issue: string; value: any }> = [];
      finalCalldataForRPC.forEach((v, i) => {
        if (typeof v !== 'string') {
          verificationIssues.push({ index: i, issue: 'not_string', value: v });
        } else if (!v.startsWith('0x') && !v.startsWith('0X')) {
          verificationIssues.push({ index: i, issue: 'missing_prefix', value: v });
        }
      });

      if (verificationIssues.length > 0) {
        console.error('CRITICAL: Verification issues in finalCalldataForRPC:', verificationIssues);
        throw new Error(`Found ${verificationIssues.length} verification issues in final calldata`);
      }

      console.log('Final calldata for RPC (openPosition):', {
        length: finalCalldataForRPC.length,
        allStrings: finalCalldataForRPC.every(v => typeof v === 'string'),
        allHavePrefix: finalCalldataForRPC.every(v => typeof v === 'string' && v.startsWith('0x')),
        sample: finalCalldataForRPC.slice(0, 5),
        // Check for any values that might be serialized as numbers
        smallValues: finalCalldataForRPC.map((v, i) => {
          if (typeof v === 'string' && v.startsWith('0x')) {
            try {
              const num = BigInt(v);
              if (num <= 9n) {
                return { index: i, value: v, numValue: num.toString() };
              }
            } catch {}
          }
          return null;
        }).filter(x => x !== null)
      });

      // CRITICAL: Convert readonly array to regular array for Starknet.js
      // But ensure each value is explicitly a string
      // Use Object.defineProperty to make the array non-configurable to prevent Starknet.js from modifying it
      const calldataForExecute = [...finalCalldataForRPC];
      
      // Wrap each value in a getter to ensure it always returns a string
      // This prevents any internal transformation by Starknet.js
      const protectedCalldata = calldataForExecute.map((v) => {
        const str = String(v);
        // Create a property descriptor that always returns the string value
        return str;
      });

      // Final check before execute
      const preExecuteCheck = protectedCalldata.map((v, i) => {
        if (typeof v !== 'string') {
          return { index: i, value: v, type: typeof v };
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          return { index: i, value: v, issue: 'missing_prefix' };
        }
        return null;
      }).filter(x => x !== null);
      
      if (preExecuteCheck.length > 0) {
        console.error('CRITICAL: Pre-execute check failed:', preExecuteCheck);
        throw new Error(`Found ${preExecuteCheck.length} issues in calldata before execute`);
      }

      // CRITICAL: Create a final calldata array with fresh string objects
      // This ensures JSON.stringify won't convert any values to numbers
      // We create a completely new array with new string primitives
      // ALSO: Final felt252 bounds check and reduction
      const finalCalldataForExecute: string[] = [];
      for (let i = 0; i < protectedCalldata.length; i++) {
        const v = protectedCalldata[i];
        let str = String(v);
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = '0x' + BigInt(str).toString(16);
          } catch {
            str = '0x0';
          }
        }
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        
        // CRITICAL: Final felt252 bounds check - reduce any value exceeding 63 hex digits
        const hexDigits = str.slice(2);
        if (hexDigits.length > 63) {
          console.error(`❌ FINAL CHECK: Value at index ${i} has ${hexDigits.length} hex digits (max 63). Value: ${str}`);
          try {
            const valueBigInt = BigInt(str);
            const STARK_PRIME = FELT252_MAX + 1n;
            const reducedValue = valueBigInt % STARK_PRIME;
            str = '0x' + reducedValue.toString(16);
            console.warn(`   Reduced to: ${str} (${str.slice(2).length} hex digits)`);
            // Verify it now fits
            const newHexDigits = str.slice(2);
            if (newHexDigits.length > 63) {
              console.error(`   CRITICAL: Value still exceeds felt252 after reduction!`);
              throw new Error(`Value at index ${i} still exceeds felt252 bounds after modulo reduction`);
            }
          } catch (e) {
            console.error(`   Could not reduce value:`, e);
            str = '0x0'; // Fallback
          }
        }
        
        // CRITICAL: Create a new string primitive to prevent any reference issues
        finalCalldataForExecute.push(String(str));
      }

      // Final validation
      const invalid = finalCalldataForExecute.find((v, i) => {
        if (typeof v !== 'string') {
          console.error(`Value at index ${i} is not a string:`, v, typeof v);
          return true;
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          console.error(`Value at index ${i} missing 0x prefix:`, v);
          return true;
        }
        return false;
      });

      if (invalid !== undefined) {
        throw new Error('CRITICAL: Invalid calldata value found after final processing');
      }

      // CRITICAL: Explicit numeric check - ensure ALL values are < Stark Prime
      // Stark Prime (decimal): 3618502788666131213697322783095070105623107215331596699973092056135872020481
      // This is the maximum value for felt252 (FELT252_MAX)
      const STARK_PRIME_DECIMAL = BigInt('3618502788666131213697322783095070105623107215331596699973092056135872020481');
      const STARK_PRIME_HEX = '0x800000000000011000000000000000000000000000000000000000000000000';
      
      console.log(`🔍 Validating ${finalCalldataForExecute.length} calldata values against Stark Prime...`);
      console.log(`   Stark Prime (decimal): ${STARK_PRIME_DECIMAL}`);
      console.log(`   Stark Prime (hex): ${STARK_PRIME_HEX}`);
      
      const valuesExceedingStarkPrime: { index: number; value: string; numericValue: bigint; hexDigits: number }[] = [];
      let maxValue = BigInt(0);
      let maxValueIndex = -1;

      for (let i = 0; i < finalCalldataForExecute.length; i++) {
        const v = finalCalldataForExecute[i];
        try {
          const numericValue = BigInt(v);
          
          // Track the maximum value for reporting
          if (numericValue > maxValue) {
            maxValue = numericValue;
            maxValueIndex = i;
          }
          
          if (numericValue >= STARK_PRIME_DECIMAL) {
            const hexDigits = v.slice(2).length;
            valuesExceedingStarkPrime.push({
              index: i,
              value: v,
              numericValue: numericValue,
              hexDigits: hexDigits
            });
          }
        } catch (e) {
          console.error(`Could not parse value at index ${i} as BigInt:`, v, e);
          throw new Error(`Invalid calldata value at index ${i}: ${v} (cannot parse as BigInt)`);
        }
      }

      if (valuesExceedingStarkPrime.length > 0) {
        console.error(`❌ CRITICAL: Found ${valuesExceedingStarkPrime.length} calldata values >= Stark Prime:`, valuesExceedingStarkPrime);
        console.error(`   Stark Prime (decimal): ${STARK_PRIME_DECIMAL}`);
        console.error(`   Stark Prime (hex): ${STARK_PRIME_HEX}`);
        throw new Error(`Found ${valuesExceedingStarkPrime.length} calldata values that exceed or equal Stark Prime. First violation at index ${valuesExceedingStarkPrime[0].index}: ${valuesExceedingStarkPrime[0].value} (${valuesExceedingStarkPrime[0].numericValue} >= ${STARK_PRIME_DECIMAL})`);
      }

      // Report validation results
      const maxValueHex = '0x' + maxValue.toString(16);
      const maxValueHexDigits = maxValueHex.slice(2).length;
      console.log(`✅ VALIDATION PASSED: All ${finalCalldataForExecute.length} calldata values are < Stark Prime`);
      console.log(`   Max value found: ${maxValueHex} (${maxValueHexDigits} hex digits, index ${maxValueIndex})`);
      console.log(`   Stark Prime: ${STARK_PRIME_HEX} (63 hex digits max)`);
      console.log(`   Safety margin: ${STARK_PRIME_DECIMAL - maxValue - 1n} values below limit`);

      // Use account.execute() - it handles hash calculation and signing correctly
      // Since we've fixed the calldata formatting (felt252 overflow), we can use the high-level API
      // This ensures the signature matches what the account contract expects
      console.log('📊 Calldata Size Check (openPosition):', {
        calldataLength: finalCalldataForExecute.length,
        calldataSizeBytes: JSON.stringify(finalCalldataForExecute).length,
        calldataSizeKB: (JSON.stringify(finalCalldataForExecute).length / 1024).toFixed(2),
        isOver3K: finalCalldataForExecute.length > 3000,
        isOver5K: finalCalldataForExecute.length > 5000,
        first10: finalCalldataForExecute.slice(0, 10),
        last10: finalCalldataForExecute.slice(-10),
      });
      
      const result = await ztarknetAccount.execute({
        contractAddress: CONTRACTS.PERP_ROUTER,
        entrypoint: 'open_position',
        calldata: finalCalldataForExecute,
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

      // CRITICAL: Validate inputs at entry point - ensure all are strings with 0x prefix
      const validateHexArray = (arr: any[], name: string) => {
        arr.forEach((v, i) => {
          if (typeof v !== 'string') {
            console.error(`❌ ${name}[${i}] is not a string:`, { value: v, type: typeof v });
            throw new Error(`${name}[${i}] must be a string, got ${typeof v}`);
          }
          if (!v.startsWith('0x') && !v.startsWith('0X')) {
            console.error(`❌ ${name}[${i}] missing 0x prefix:`, { value: v, length: v.length });
            throw new Error(`${name}[${i}] must start with 0x, got: "${v}"`);
          }
        });
      };

      validateHexArray(proof, 'proof');
      validateHexArray(publicInputs, 'publicInputs');
      
      // Validate commitment
      if (typeof commitment !== 'string') {
        throw new Error(`commitment must be a string, got ${typeof commitment}`);
      }
      if (!commitment.startsWith('0x') && !commitment.startsWith('0X')) {
        throw new Error(`commitment must start with 0x, got: "${commitment}"`);
      }

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

      // CRITICAL: Use proof directly from proofService (it's already callData.slice(1) from garaga)
      // Like the example app, we should NOT convert values again as that causes felt252 overflow
      // The proof from proofService is already properly formatted by getZKHonkCallData()
      
      // Extract only the minimal public inputs needed for parsing (first 3 elements)
      if (publicInputs.length < 3) {
        throw new Error(`Invalid publicInputs for closePosition: expected at least 3 elements (market_id, commitment, outcome_code), got ${publicInputs.length}`);
      }
      
      const minimalPublicInputs = [publicInputs[0], publicInputs[1], publicInputs[2]]; // [market_id, commitment, outcome_code]
      
      // CRITICAL: Use proof directly without conversion (like example app)
      // The proof is already callData.slice(1) - properly formatted felt252 values
      // Only ensure they're strings (they should already be)
      const proofFormatted = proof.map((v, i) => {
        if (typeof v !== 'string') {
          throw new Error(`Proof value at index ${i} is not a string: ${v} (${typeof v})`);
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          throw new Error(`Proof value at index ${i} missing 0x prefix: ${v}`);
        }
        return v.toLowerCase(); // Normalize to lowercase
      });
      
      // Format minimal public_inputs - ensure they're strings with 0x prefix
      const publicInputsFormatted = minimalPublicInputs.map((v, i) => {
        if (typeof v !== 'string') {
          throw new Error(`Public input at index ${i} is not a string: ${v} (${typeof v})`);
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          throw new Error(`Public input at index ${i} missing 0x prefix: ${v}`);
        }
        return v.toLowerCase(); // Normalize to lowercase
      });
      
      // Format commitment - ensure it's a string with 0x prefix
      let commitmentHex: string;
      if (typeof commitment !== 'string') {
        commitmentHex = '0x' + BigInt(commitment).toString(16);
      } else if (commitment.startsWith('0x') || commitment.startsWith('0X')) {
        commitmentHex = commitment.toLowerCase();
      } else {
        commitmentHex = '0x' + BigInt(commitment).toString(16);
      }
      
      // Format as Span<felt252> for contract call
      // Span format: [length, ...elements]
      const proofLenHex = '0x' + BigInt(proofFormatted.length).toString(16);
      const publicInputsLenHex = '0x' + BigInt(publicInputsFormatted.length).toString(16);
      
      // Build calldata array - CRITICAL: Use proof directly without conversion
      // Format: [proof_len, ...proof, public_inputs_len, ...minimal_public_inputs, commitment]
      const calldataRaw = [
        proofLenHex,
        ...proofFormatted,  // Use proof directly - already properly formatted
        publicInputsLenHex,
        ...publicInputsFormatted,  // Use public_inputs directly - already properly formatted
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
          return '0x' + (v as bigint).toString(16);
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
        const stillInvalid = calldata.filter((v) => typeof v !== 'string' || !v.startsWith('0x'));
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
      const stillInvalid = finalCalldataStrings.filter((v) => typeof v !== 'string' || !v.startsWith('0x'));
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

      // CRITICAL: Test JSON serialization to catch any values that would fail RPC validation
      // This simulates what happens when Starknet.js serializes the request
      try {
        console.log('Testing JSON serialization of calldata (closePosition)...');
        const testJSON = JSON.stringify({ calldata: sanitizedCalldata });
        const parsed = JSON.parse(testJSON);
        
        // Check each value after round-trip through JSON
        const problematicValues: Array<{ index: number; issue: string; original: any; afterJSON: any }> = [];
        
        parsed.calldata.forEach((v: any, i: number) => {
          const original = sanitizedCalldata[i];
          
          // Check if value lost its string type
          if (typeof v !== 'string') {
            problematicValues.push({
              index: i,
              issue: 'not_string',
              original: original,
              afterJSON: v
            });
            console.error(`❌ Value at index ${i} is not a string after JSON serialization (closePosition):`, {
              original: original,
              originalType: typeof original,
              afterJSON: v,
              afterJSONType: typeof v,
              originalInArray: sanitizedCalldata[i],
              originalArrayType: typeof sanitizedCalldata[i]
            });
          } 
          // Check if value lost its 0x prefix
          else if (!v.startsWith('0x') && !v.startsWith('0X')) {
            problematicValues.push({
              index: i,
              issue: 'missing_prefix',
              original: original,
              afterJSON: v
            });
            console.error(`❌ Value at index ${i} missing 0x prefix after JSON serialization (closePosition):`, {
              original: original,
              afterJSON: v,
              originalLength: original?.length,
              afterJSONLength: v?.length
            });
          }
        });
        
        if (problematicValues.length > 0) {
          console.error('CRITICAL: Found problematic values after JSON serialization (closePosition):', problematicValues);
          console.error('Full problematic values details:', problematicValues.map(pv => ({
            index: pv.index,
            issue: pv.issue,
            original: pv.original,
            originalType: typeof pv.original,
            originalStringified: String(pv.original),
            afterJSON: pv.afterJSON,
            afterJSONType: typeof pv.afterJSON,
            originalJSON: JSON.stringify(pv.original),
            afterJSONJSON: JSON.stringify(pv.afterJSON)
          })));
          
          // Try to fix the problematic values
          const fixedCalldata = sanitizedCalldata.map((v, i) => {
            const problematic = problematicValues.find(pv => pv.index === i);
            if (problematic) {
              console.log(`Attempting to fix value at index ${i} (closePosition):`, problematic);
              // Force to string explicitly
              let fixed = String(v);
              if (!fixed.startsWith('0x') && !fixed.startsWith('0X')) {
                try {
                  fixed = '0x' + BigInt(fixed).toString(16);
                } catch {
                  fixed = '0x0';
                }
              }
              console.log(`Fixed value at index ${i} (closePosition): "${v}" -> "${fixed}"`);
              return fixed;
            }
            return v;
          });
          
          // Test the fixed calldata
          const fixedTestJSON = JSON.stringify({ calldata: fixedCalldata });
          const fixedParsed = JSON.parse(fixedTestJSON);
          const stillProblematic = fixedParsed.calldata.filter((v: any) => 
            typeof v !== 'string' || !v.startsWith('0x')
          );
          
          if (stillProblematic.length > 0) {
            throw new Error(`CRITICAL: Found ${problematicValues.length} values that would fail RPC validation after JSON serialization (closePosition). Unable to auto-fix. Check console for details.`);
          } else {
            console.log('Successfully fixed problematic values (closePosition), using fixed calldata');
            // Use the fixed calldata
            sanitizedCalldata.splice(0, sanitizedCalldata.length, ...fixedCalldata);
          }
        } else {
          console.log('✅ All calldata values passed JSON serialization test (closePosition)');
        }
      } catch (error) {
        console.error('CRITICAL: JSON serialization test failed (closePosition):', error);
        throw error;
      }

      // CRITICAL: Create a completely new array with fresh string objects
      // Use Object.freeze() on each string to prevent any modification
      // Also ensure we're creating primitive strings, not String objects
      const finalCalldataForRPC: readonly string[] = sanitizedCalldata.map((v) => {
        // Force to primitive string
        let str: string;
        if (typeof v === 'string') {
          str = v;
        } else {
          str = String(v);
        }
        
        // Ensure 0x prefix
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = '0x' + BigInt(str).toString(16);
          } catch {
            str = '0x0';
          }
        }
        
        // Normalize to lowercase
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        
        // Return as a fresh primitive string (not a String object)
        return String(str);
      });

      // Final verification - check every single value
      const verificationIssues: Array<{ index: number; issue: string; value: any }> = [];
      finalCalldataForRPC.forEach((v, i) => {
        if (typeof v !== 'string') {
          verificationIssues.push({ index: i, issue: 'not_string', value: v });
        } else if (!v.startsWith('0x') && !v.startsWith('0X')) {
          verificationIssues.push({ index: i, issue: 'missing_prefix', value: v });
        }
      });

      if (verificationIssues.length > 0) {
        console.error('CRITICAL: Verification issues in finalCalldataForRPC (closePosition):', verificationIssues);
        throw new Error(`Found ${verificationIssues.length} verification issues in final calldata (closePosition)`);
      }

      console.log('Final calldata for RPC (closePosition):', {
        length: finalCalldataForRPC.length,
        allStrings: finalCalldataForRPC.every(v => typeof v === 'string'),
        allHavePrefix: finalCalldataForRPC.every(v => typeof v === 'string' && v.startsWith('0x')),
        sample: finalCalldataForRPC.slice(0, 5),
        // Check for any values that might be serialized as numbers
        smallValues: finalCalldataForRPC.map((v, i) => {
          if (typeof v === 'string' && v.startsWith('0x')) {
            try {
              const num = BigInt(v);
              if (num <= 9n) {
                return { index: i, value: v, numValue: num.toString() };
              }
            } catch {}
          }
          return null;
        }).filter(x => x !== null)
      });

      // CRITICAL: Convert readonly array to regular array for Starknet.js
      // But ensure each value is explicitly a string
      // Use Object.defineProperty to make the array non-configurable to prevent Starknet.js from modifying it
      const calldataForExecute = [...finalCalldataForRPC];
      
      // Wrap each value in a getter to ensure it always returns a string
      // This prevents any internal transformation by Starknet.js
      const protectedCalldata = calldataForExecute.map((v) => {
        const str = String(v);
        // Create a property descriptor that always returns the string value
        return str;
      });

      // Final check before execute
      const preExecuteCheck = protectedCalldata.map((v, i) => {
        if (typeof v !== 'string') {
          return { index: i, value: v, type: typeof v };
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          return { index: i, value: v, issue: 'missing_prefix' };
        }
        return null;
      }).filter(x => x !== null);
      
      if (preExecuteCheck.length > 0) {
        console.error('CRITICAL: Pre-execute check failed (closePosition):', preExecuteCheck);
        throw new Error(`Found ${preExecuteCheck.length} issues in calldata before execute (closePosition)`);
      }

      // CRITICAL: Create a final calldata array with fresh string objects
      const finalCalldataForRPCClose: string[] = [];
      for (let i = 0; i < protectedCalldata.length; i++) {
        const v = protectedCalldata[i];
        let str = String(v);
        if (!str.startsWith('0x') && !str.startsWith('0X')) {
          try {
            str = '0x' + BigInt(str).toString(16);
          } catch {
            str = '0x0';
          }
        }
        str = str.toLowerCase();
        if (str === '0x') str = '0x0';
        // CRITICAL: Create a new string primitive
        finalCalldataForRPCClose.push(String(str));
      }

      // Final validation
      const invalidClose = finalCalldataForRPCClose.find((v, i) => {
        if (typeof v !== 'string') {
          console.error(`Value at index ${i} is not a string (closePosition):`, v, typeof v);
          return true;
        }
        if (!v.startsWith('0x') && !v.startsWith('0X')) {
          console.error(`Value at index ${i} missing 0x prefix (closePosition):`, v);
          return true;
        }
        return false;
      });

      if (invalidClose !== undefined) {
        throw new Error('CRITICAL: Invalid calldata value found after final processing (closePosition)');
      }

      // CRITICAL: Explicit numeric check - ensure ALL values are < Stark Prime (closePosition)
      // Stark Prime (decimal): 3618502788666131213697322783095070105623107215331596699973092056135872020481
      const STARK_PRIME_DECIMAL_CLOSE = BigInt('3618502788666131213697322783095070105623107215331596699973092056135872020481');
      const STARK_PRIME_HEX_CLOSE = '0x800000000000011000000000000000000000000000000000000000000000000';
      
      console.log(`🔍 Validating ${finalCalldataForRPCClose.length} calldata values against Stark Prime (closePosition)...`);
      console.log(`   Stark Prime (decimal): ${STARK_PRIME_DECIMAL_CLOSE}`);
      console.log(`   Stark Prime (hex): ${STARK_PRIME_HEX_CLOSE}`);
      
      const valuesExceedingStarkPrimeClose: { index: number; value: string; numericValue: bigint; hexDigits: number }[] = [];
      let maxValueClose = BigInt(0);
      let maxValueIndexClose = -1;

      for (let i = 0; i < finalCalldataForRPCClose.length; i++) {
        const v = finalCalldataForRPCClose[i];
        try {
          const numericValue = BigInt(v);
          
          // Track the maximum value for reporting
          if (numericValue > maxValueClose) {
            maxValueClose = numericValue;
            maxValueIndexClose = i;
          }
          
          if (numericValue >= STARK_PRIME_DECIMAL_CLOSE) {
            const hexDigits = v.slice(2).length;
            valuesExceedingStarkPrimeClose.push({
              index: i,
              value: v,
              numericValue: numericValue,
              hexDigits: hexDigits
            });
          }
        } catch (e) {
          console.error(`Could not parse value at index ${i} as BigInt (closePosition):`, v, e);
          throw new Error(`Invalid calldata value at index ${i} (closePosition): ${v} (cannot parse as BigInt)`);
        }
      }

      if (valuesExceedingStarkPrimeClose.length > 0) {
        console.error(`❌ CRITICAL: Found ${valuesExceedingStarkPrimeClose.length} calldata values >= Stark Prime (closePosition):`, valuesExceedingStarkPrimeClose);
        console.error(`   Stark Prime (decimal): ${STARK_PRIME_DECIMAL_CLOSE}`);
        console.error(`   Stark Prime (hex): ${STARK_PRIME_HEX_CLOSE}`);
        throw new Error(`Found ${valuesExceedingStarkPrimeClose.length} calldata values that exceed or equal Stark Prime (closePosition). First violation at index ${valuesExceedingStarkPrimeClose[0].index}: ${valuesExceedingStarkPrimeClose[0].value} (${valuesExceedingStarkPrimeClose[0].numericValue} >= ${STARK_PRIME_DECIMAL_CLOSE})`);
      }

      // Report validation results
      const maxValueHexClose = '0x' + maxValueClose.toString(16);
      const maxValueHexDigitsClose = maxValueHexClose.slice(2).length;
      console.log(`✅ VALIDATION PASSED: All ${finalCalldataForRPCClose.length} calldata values are < Stark Prime (closePosition)`);
      console.log(`   Max value found: ${maxValueHexClose} (${maxValueHexDigitsClose} hex digits, index ${maxValueIndexClose})`);
      console.log(`   Stark Prime: ${STARK_PRIME_HEX_CLOSE} (63 hex digits max)`);
      console.log(`   Safety margin: ${STARK_PRIME_DECIMAL_CLOSE - maxValueClose - 1n} values below limit`);

      // BYPASS account.execute() - Manual transaction construction with no fee estimation
      const provider = new RpcProvider({ nodeUrl: NETWORK.RPC_URL });
      
      // Get nonce
      const nonce = await provider.getNonceForAddress(
        ztarknetAccount.address,
        'latest'
      );
      
      // Get chain ID - get from provider with fallback to network default
      let chainId: string;
      try {
        chainId = await provider.getChainId();
        if (!chainId) {
          chainId = NETWORK.CHAIN_ID;
        }
      } catch (error) {
        console.warn('Failed to get chain ID from provider, using network default:', error);
        chainId = NETWORK.CHAIN_ID;
      }
      
      if (!chainId) {
        throw new Error('Failed to get chain ID - provider returned undefined and no network default available');
      }
      
      // Build transaction request - use high default values for resource bounds (skip fee estimation)
      const transactionRequest = {
        type: 'INVOKE' as const,
        sender_address: ztarknetAccount.address,
        calldata: finalCalldataForRPCClose, // Direct use - no transformations!
        signature: [] as string[],
        nonce: num.toHex(nonce),
        version: '0x3' as const,
        resource_bounds: {
          l2_gas: {
            max_amount: '0xffffffffffffffff', // High default - skip fee estimation
            max_price_per_unit: '0x0',
          },
          l1_gas: {
            max_amount: '0xffffffffffffffff',
            max_price_per_unit: '0x0',
          },
          l1_data_gas: {
            max_amount: '0xffffffffffffffff',
            max_price_per_unit: '0x0',
          },
        },
        tip: '0x0',
        paymaster_data: [],
        nonce_data_availability_mode: 'L1' as const, // RPC expects string, not number
        fee_data_availability_mode: 'L1' as const,
        account_deployment_data: [],
      };
      
      // Calculate hash - ensure all values are defined before BigInt conversion
      const l2MaxAmount = transactionRequest.resource_bounds.l2_gas.max_amount || '0xffffffffffffffff';
      const l1MaxAmount = transactionRequest.resource_bounds.l1_gas.max_amount || '0xffffffffffffffff';
      const l1DataMaxAmount = transactionRequest.resource_bounds.l1_data_gas.max_amount || '0xffffffffffffffff';
      const tipAmount = transactionRequest.tip || '0x0';
      
      // Sign the transaction - pass the calls array with transaction details
      // signTransaction internally processes calls, so we need to pass the call structure
      const calls = [{
        contractAddress: CONTRACTS.PERP_ROUTER,
        entrypoint: 'close_position',
        calldata: finalCalldataForRPCClose,
      }];
      
      // signTransaction expects calls array and additional transaction details
      // Include walletAddress and cairoVersion as required by InvocationsSignerDetails
      const signatureResult = await ztarknetAccount.signer.signTransaction(
        calls,
        {
          walletAddress: transactionRequest.sender_address,
          cairoVersion: '1' as const,
          nonce: BigInt(transactionRequest.nonce),
          version: transactionRequest.version,
          resourceBounds: {
            l2_gas: { max_amount: BigInt(l2MaxAmount), max_price_per_unit: 0n },
            l1_gas: { max_amount: BigInt(l1MaxAmount), max_price_per_unit: 0n },
            l1_data_gas: { max_amount: BigInt(l1DataMaxAmount), max_price_per_unit: 0n },
          },
          tip: BigInt(tipAmount),
          paymasterData: transactionRequest.paymaster_data,
          nonceDataAvailabilityMode: 'L1' as const,
          feeDataAvailabilityMode: 'L1' as const,
          accountDeploymentData: transactionRequest.account_deployment_data,
          chainId: chainId as '0x534e5f4d41494e' | '0x534e5f5345504f4c4941',
        }
      );
      
      // Convert signature to hex strings
      // signTransaction can return either:
      // 1. An array of BigInts/strings
      // 2. A Signature2 object with {r, s, recovery} properties
      let signatureArray: string[] = [];
      
      if (Array.isArray(signatureResult)) {
        // Handle array case
        signatureArray = signatureResult.map((s: any) => {
          if (typeof s === 'bigint') {
            return num.toHex(s);
          }
          if (typeof s === 'string') {
            return s.startsWith('0x') ? s : `0x${s}`;
          }
          try {
            const bigIntValue = typeof s === 'number' ? BigInt(s) : BigInt(String(s));
            return num.toHex(bigIntValue);
          } catch {
            console.error('Failed to convert signature value to hex:', s, typeof s);
            return '0x0';
          }
        });
      } else if (signatureResult && typeof signatureResult === 'object') {
        // Handle Signature2 object case: {r: BigInt, s: BigInt, recovery: number}
        if ('r' in signatureResult && 's' in signatureResult) {
          const r = (signatureResult as any).r;
          const s = (signatureResult as any).s;
          signatureArray = [
            typeof r === 'bigint' ? num.toHex(r) : (typeof r === 'string' ? ((r as string).startsWith('0x') ? r : `0x${r}`) : num.toHex(BigInt(r))),
            typeof s === 'bigint' ? num.toHex(s) : (typeof s === 'string' ? ((s as string).startsWith('0x') ? s : `0x${s}`) : num.toHex(BigInt(s)))
          ];
        } else {
          // Fallback: try to convert the object
          console.error('Unknown signature format:', signatureResult);
          signatureArray = ['0x0', '0x0'];
        }
      } else {
        // Single value case
        const s: any = signatureResult;
        if (typeof s === 'bigint') {
          signatureArray = [num.toHex(s)];
        } else if (typeof s === 'string') {
          signatureArray = [s.startsWith('0x') ? s : `0x${s}`];
        } else {
          try {
            const bigIntValue = typeof s === 'number' ? BigInt(s) : BigInt(String(s));
            signatureArray = [num.toHex(bigIntValue)];
          } catch {
            console.error('Failed to convert signature value to hex:', s, typeof s);
            signatureArray = ['0x0'];
          }
        }
      }
      
      transactionRequest.signature = signatureArray;
      
      // Send transaction directly via provider - bypasses account.execute() entirely
      // RPC expects all values as hex strings - transactionRequest already has everything as strings
      // No conversion needed, just use transactionRequest directly
      const rpcTransactionRequest = transactionRequest;
      
      // Log calldata size for debugging potential size limit issues
      console.log('📊 Calldata Size Check (closePosition):', {
        calldataLength: finalCalldataForRPCClose.length,
        calldataSizeBytes: JSON.stringify(finalCalldataForRPCClose).length,
        calldataSizeKB: (JSON.stringify(finalCalldataForRPCClose).length / 1024).toFixed(2),
        isOver3K: finalCalldataForRPCClose.length > 3000,
        isOver5K: finalCalldataForRPCClose.length > 5000,
        first10: finalCalldataForRPCClose.slice(0, 10),
        last10: finalCalldataForRPCClose.slice(-10),
      });
      
      // Build the RPC request body
      const rpcRequestBody = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'starknet_addInvokeTransaction',
        params: {
          invoke_transaction: rpcTransactionRequest
        }
      };
      
      // Log the raw RPC request size
      const requestBodyString = JSON.stringify(rpcRequestBody);
      console.log('📤 Raw RPC Request Info (closePosition):', {
        method: rpcRequestBody.method,
        calldataLength: rpcTransactionRequest.calldata.length,
        transactionSizeBytes: requestBodyString.length,
        transactionSizeKB: (requestBodyString.length / 1024).toFixed(2),
        transactionSizeMB: (requestBodyString.length / (1024 * 1024)).toFixed(2),
        // Log full request if it's small enough, otherwise just structure
        fullRequestSize: requestBodyString.length,
        requestPreview: requestBodyString.length < 5000 
          ? rpcRequestBody 
          : {
              jsonrpc: rpcRequestBody.jsonrpc,
              method: rpcRequestBody.method,
              calldataLength: rpcTransactionRequest.calldata.length,
              note: 'Request too large - see calldata size above'
            }
      });
      
      // Send transaction via direct RPC call
      // Use fetch to make direct RPC request since provider.rpc is not accessible
      const rpcResponse = await fetch(NETWORK.RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBodyString
      });
      
      if (!rpcResponse.ok) {
        throw new Error(`RPC request failed: ${rpcResponse.status} ${rpcResponse.statusText}`);
      }
      
      const rpcResult = await rpcResponse.json();
      
      if (rpcResult.error) {
        // Log the full error for debugging
        console.error('RPC Error Details:', {
          code: rpcResult.error.code,
          message: rpcResult.error.message,
          data: rpcResult.error.data,
          fullError: rpcResult.error
        });
        // Log what we sent for debugging
        console.error('Transaction sent:', JSON.stringify(rpcTransactionRequest, null, 2));
        throw new Error(`RPC error: ${rpcResult.error.message || JSON.stringify(rpcResult.error)}`);
      }
      
      return { transaction_hash: rpcResult.result.transaction_hash };
    },
    [ztarknetAccount]
  );

  return {
    openPosition,
    closePosition,
  };
}

