import { useState } from 'react';
import { Contract } from 'starknet';
import { CONTRACTS, NETWORK } from '../../config/contracts';
import { useTradingStore } from '../../stores/tradingStore';
import { toast } from 'sonner';

const YUSD_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
];

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
  spenderAddress: string;
  amount: string; // Amount in wei (u256)
}

type ApprovalState = 'idle' | 'approving' | 'success' | 'error';

export function ApprovalModal({ 
  isOpen, 
  onClose, 
  onApproved, 
  spenderAddress, 
  amount 
}: ApprovalModalProps) {
  const ztarknetAccount = useTradingStore((state) => state.ztarknetAccount);
  const isZtarknetReady = useTradingStore((state) => state.isZtarknetReady);
  const [status, setStatus] = useState<ApprovalState>('idle');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!ztarknetAccount || !isZtarknetReady) {
      setStatus('error');
      setMessage('Please finish setting up your Ztarknet wallet first.');
      return;
    }

    setStatus('approving');
    setMessage('Submitting approval transaction...');
    setTxHash(null);

    try {
      const contract = new Contract({
        abi: YUSD_ABI,
        address: CONTRACTS.YUSD_TOKEN,
        providerOrAccount: ztarknetAccount,
      });

      // Convert amount to u256
      const amountBigInt = BigInt(amount);
      const tx = await contract.approve(spenderAddress, {
        low: amountBigInt,
        high: 0n,
      });

      setTxHash(tx.transaction_hash);
      setMessage('Waiting for confirmation...');

      await ztarknetAccount.waitForTransaction(tx.transaction_hash);

      setStatus('success');
      setMessage('Approval successful!');
      
      // Show transaction link notification
      toast.success('Token approval successful!', {
        action: {
          label: 'View Transaction',
          onClick: () => window.open(`${NETWORK.EXPLORER_URL}/tx/${tx.transaction_hash}`, '_blank'),
        },
      });
      
      onApproved();
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setMessage('');
        setTxHash(null);
      }, 1500);
    } catch (error: any) {
      console.error('Approval error:', error);
      setStatus('error');
      setMessage(error?.message || 'Failed to approve. Please try again.');
      toast.error('Approval failed');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[10000]" 
      style={{ padding: '20px' }}
    >
      <div 
        style={{ 
          backgroundColor: '#0c191e', 
          color: 'white', 
          borderRadius: '24px', 
          border: '1px solid rgba(255,255,255,0.1)', 
          width: '100%', 
          maxWidth: '400px', 
          padding: '40px', 
          position: 'relative', 
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)' 
        }}
      >
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '16px', 
            right: '16px', 
            color: 'rgba(255,255,255,0.6)', 
            fontSize: '20px', 
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 150ms ease' 
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
        >
          ✕
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
            Approve transaction
          </h2>

          {message && (
            <div 
              style={{ 
                borderRadius: '12px', 
                border: status === 'error' 
                  ? '1px solid rgba(248,113,113,0.4)' 
                  : status === 'success' 
                  ? '1px solid rgba(80,210,193,0.4)' 
                  : '1px solid rgba(255,255,255,0.12)', 
                backgroundColor: status === 'error' 
                  ? 'rgba(248,113,113,0.1)' 
                  : status === 'success' 
                  ? 'rgba(80,210,193,0.1)' 
                  : 'rgba(255,255,255,0.05)', 
                padding: '12px', 
                fontSize: '13px', 
                color: status === 'error' 
                  ? '#fecaca' 
                  : status === 'success' 
                  ? '#50d2c1' 
                  : 'rgba(255,255,255,0.8)' 
              }}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleApprove}
            disabled={status === 'approving' || !isZtarknetReady}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: '14px',
              backgroundColor: '#50d2c1',
              color: '#0f1a1f',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: status === 'approving' || !isZtarknetReady ? 'not-allowed' : 'pointer',
              opacity: status === 'approving' || !isZtarknetReady ? 0.5 : 1,
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (status !== 'approving' && isZtarknetReady) {
                e.currentTarget.style.backgroundColor = '#45c0b0';
              }
            }}
            onMouseLeave={(e) => {
              if (status !== 'approving' && isZtarknetReady) {
                e.currentTarget.style.backgroundColor = '#50d2c1';
              }
            }}
          >
            {status === 'approving' ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}






