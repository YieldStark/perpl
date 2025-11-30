import { useEffect, useMemo, useState } from 'react';
import { Account } from 'starknet';
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createZtarknetAccount,
  deployZtarknetWallet,
  generateZtarknetWallet,
  isWalletDeployed,
  loadZtarknetWallet,
  saveZtarknetWallet,
  waitForWalletDeployment,
  ZtarknetWallet,
} from '../../services/walletService';
import { NETWORK } from '../../config/contracts';
import '../../App.css';

interface ProvisionModalProps {
  isOpen: boolean;
  ownerAddress?: string | null;
  onClose: () => void;
  onWalletReady: (account: Account) => void;
}

type ProvisionState =
  | 'idle'
  | 'generating'
  | 'awaiting_funding'
  | 'deploying'
  | 'ready'
  | 'error';

export function ZtarknetProvisionModal({
  isOpen,
  ownerAddress,
  onClose,
  onWalletReady,
}: ProvisionModalProps) {
  const [wallet, setWallet] = useState<ZtarknetWallet | null>(null);
  const [state, setState] = useState<ProvisionState>('idle');
  const [attempt, setAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const steps = useMemo(
    () => [
      { id: 'generating', label: 'Generating private Ztarknet wallet' },
      { id: 'awaiting_funding', label: 'Fund wallet & deploy on Ztarknet' },
      { id: 'ready', label: 'Wallet ready for Circuit' },
    ],
    []
  );

  useEffect(() => {
    if (!isOpen || !ownerAddress) return;

    let cancelled = false;

    const startProvision = async () => {
      try {
        setErrorMessage(null);
        setTxHash(null);
        setState('generating');

        const existing = loadZtarknetWallet(ownerAddress);
        const walletToUse = existing ?? generateZtarknetWallet(ownerAddress);
        setWallet(walletToUse);

        if (existing?.deployed) {
          finalize(existing);
          return;
        }

        const deployedAlready = await isWalletDeployed(walletToUse.address);
        if (cancelled) return;

        if (deployedAlready) {
          finalize({ ...walletToUse, deployed: true });
          return;
        }

        setState('awaiting_funding');
      } catch (error: any) {
        if (cancelled) return;
        console.error('Provisioning error:', error);
        setState('error');
        setErrorMessage(error.message || 'Failed to provision wallet. Please try again.');
      }
    };

    startProvision();

    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerAddress, onWalletReady]);

  const finalize = (walletData: ZtarknetWallet) => {
    saveZtarknetWallet({ ...walletData, deployed: true }, ownerAddress);
    const account = createZtarknetAccount({ ...walletData, deployed: true });
    onWalletReady(account);
    setState('ready');
    toast.success('Ztarknet wallet is ready for trading');
  };

  const handleDeploy = async () => {
    if (!wallet || !ownerAddress) return;
    setState('deploying');
    setErrorMessage(null);
    setAttempt(0);
    try {
      const deployResult = await deployZtarknetWallet(wallet);

      if (deployResult.alreadyDeployed) {
        finalize({ ...wallet, deployed: true });
        return;
      }

      if (deployResult.transaction_hash) {
        setTxHash(deployResult.transaction_hash);
      }

      const deployed = await waitForWalletDeployment(wallet, {
        ownerAddress,
        onTick: (tryCount) => setAttempt(tryCount),
      });

      if (!deployed) {
        throw new Error(
          'Deployment is taking longer than expected. Please keep this window open and retry.'
        );
      }

      finalize({ ...wallet, deployed: true });
    } catch (error: any) {
      console.error('Deploy error:', error);
      setState('error');
      setErrorMessage(
        error.message ||
          'Failed to deploy wallet. Confirm the address is funded and try again.'
      );
    }
  };

  const handleCopyAddress = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address);
    toast.success('Address copied');
  };

  const handleCheckStatus = async () => {
    if (!wallet) return;
    setIsChecking(true);
    try {
      const deployed = await isWalletDeployed(wallet.address);
      if (deployed) {
        finalize({ ...wallet, deployed: true });
      } else {
        toast.info('Wallet not deployed yet. Fund it and try again.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to check status right now.');
    } finally {
      setIsChecking(false);
    }
  };

  const renderIcon = (stepId: string) => {
    if (state === 'error' && stepId !== 'generating') {
      return (
        <div className="ztarknet-modal-status-icon error">
          <X className="ztarknet-modal-icon-small ztarknet-modal-icon-error" />
        </div>
      );
    }

    if (
      state === stepId ||
      (state === 'deploying' && stepId === 'awaiting_funding')
    ) {
      return (
        <div className="ztarknet-modal-status-icon loading">
          <Loader2 className="ztarknet-modal-icon-small ztarknet-modal-icon-loading" />
        </div>
      );
    }

    if (
      state === 'ready' ||
      (state === 'awaiting_funding' && stepId === 'generating') ||
      (state === 'deploying' && stepId === 'generating')
    ) {
      return (
        <div className="ztarknet-modal-status-icon success">
          <Check className="ztarknet-modal-icon-small ztarknet-modal-icon-success" />
        </div>
      );
    }

    return <div className="ztarknet-modal-status-icon pending" />;
  };

  if (!isOpen) return null;

  return (
    <div className="ztarknet-modal-overlay">
      <div className="ztarknet-modal-container">
        {/* Decorative gradient overlay */}
        <div className="ztarknet-modal-gradient-overlay" />
        
        <button
          onClick={onClose}
          className="ztarknet-modal-close-btn"
        >
          <X size={20} />
        </button>

        <div className="ztarknet-modal-content">
          {/* Header Section */}
          <div className="ztarknet-modal-header">
            <div className="ztarknet-modal-icon">
              <Wallet style={{ color: '#0a1216' }} size={32} />
            </div>
            <div className="ztarknet-modal-header-text">
              <h2 className="ztarknet-modal-title">
                Create a Ztarknet Trading Wallet
              </h2>
              <p className="ztarknet-modal-description">
                This private wallet is pegged to your Argent address and stored locally. Fund it with faucet tokens, deploy it on Ztarknet, and start trading privately on Circuit.
              </p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="ztarknet-modal-grid">
            {/* Steps Section */}
            <div className="ztarknet-modal-section">
              <p className="ztarknet-modal-section-title">Steps</p>
              <div className="ztarknet-modal-steps">
                {steps.map((step, idx) => (
                  <div key={step.id} className="ztarknet-modal-step">
                    <div className="ztarknet-modal-step-number">
                      {idx + 1}
                    </div>
                    <div className="ztarknet-modal-step-content">
                      <div className="ztarknet-modal-step-icon">
                        {renderIcon(step.id)}
                      </div>
                      <span className="ztarknet-modal-step-label">{step.label}</span>
                      {step.id === 'deploying' && state === 'deploying' && attempt > 0 && (
                        <span className="ztarknet-modal-step-attempt">
                          attempt {attempt.toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address Section */}
            {wallet && (
              <div className="ztarknet-modal-section">
                <div>
                  <p className="ztarknet-modal-section-title">Ztarknet Address</p>
                  <div className="ztarknet-modal-address-container">
                    <code className="ztarknet-modal-address-code">
                      {wallet.address}
                    </code>
                  </div>
                </div>
                <div className="ztarknet-modal-button-group">
                  <button
                    onClick={handleCopyAddress}
                    className="ztarknet-modal-button ztarknet-modal-button-secondary"
                  >
                    <Copy size={16} />
                    Copy address
                  </button>
                  <button
                    onClick={() =>
                      window.open(`https://faucet.ztarknet.cash/?address=${wallet.address}`, '_blank')
                    }
                    className="ztarknet-modal-button ztarknet-modal-button-faucet"
                  >
                    <ExternalLink size={16} />
                    Open faucet
                  </button>
                </div>
                {state === 'awaiting_funding' && (
                  <div className="ztarknet-modal-instructions">
                    <div className="ztarknet-modal-instructions-list">
                      <p className="ztarknet-modal-instruction-item">
                        <span className="ztarknet-modal-instruction-number">1.</span>
                        <span>Copy the wallet address above.</span>
                      </p>
                      <p className="ztarknet-modal-instruction-item">
                        <span className="ztarknet-modal-instruction-number">2.</span>
                        <span>Fund it using the Ztarknet faucet (ETH/yUSD).</span>
                      </p>
                      <p className="ztarknet-modal-instruction-item">
                        <span className="ztarknet-modal-instruction-number">3.</span>
                        <span>Return here and press Deploy Wallet once funded.</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {state === 'deploying' && (
          <div className="ztarknet-modal-status-message">
            <div className="ztarknet-modal-spinner" />
            <div className="ztarknet-modal-status-text">
              <p className="ztarknet-modal-status-title">Deploying wallet on Ztarknet...</p>
              {txHash && (
                <a
                  href={`${NETWORK.EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ztarknet-modal-status-link"
                >
                  View transaction
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}
        
        {state === 'error' && (
          <div className="ztarknet-modal-error">
            <div className="ztarknet-modal-error-message">{errorMessage}</div>
            <button
              onClick={() => setState(wallet?.deployed ? 'ready' : 'awaiting_funding')}
              className="ztarknet-modal-error-retry"
            >
              <RefreshCw size={12} />
              Try again
            </button>
          </div>
        )}

        {/* Action Buttons */}
        {(state === 'awaiting_funding' || state === 'deploying') && wallet && (
          <div className="ztarknet-modal-actions">
            <button
              onClick={handleCheckStatus}
              disabled={isChecking || state === 'deploying'}
              className="ztarknet-modal-button-check"
            >
              {isChecking ? (
                <>
                  <Loader2 size={16} className="ztarknet-modal-icon-loading" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Check Status
                </>
              )}
            </button>
            <button
              onClick={handleDeploy}
              disabled={state === 'deploying'}
              className="ztarknet-modal-button ztarknet-modal-button-primary"
            >
              {state === 'deploying' ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="ztarknet-modal-icon-loading" />
                  Deploying...
                </span>
              ) : (
                'Deploy Wallet'
              )}
            </button>
          </div>
        )}

        {state === 'ready' && (
          <button
            onClick={onClose}
            className="ztarknet-modal-button-continue"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}


