"use client";

import { Dialog } from "@base-ui-components/react/dialog";
import {
  ProviderType,
  SUPPORTED_WALLETS,
  useLaserEyes,
  WalletIcon,
} from "@omnisat/lasereyes-react";
import { useEffect, useState } from "react";

interface WalletSelectorProps {
  onWalletConnected?: () => void;
  onError?: (error: string) => void;
}

export default function WalletSelector({
  onWalletConnected,
  onError,
}: WalletSelectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletStatusMap, setWalletStatusMap] = useState<
    Record<string, boolean>
  >({});

  const {
    connect,
    disconnect,
    connected,
    address: ordinalsAddress,
    paymentAddress,
  } = useLaserEyes();

  const handleConnect = async (walletName: string) => {
    setIsConnecting(true);
    try {
      await connect(walletName as ProviderType);
      setShowWalletModal(false);
      onWalletConnected?.();
    } catch (error: unknown) {
      console.error("Wallet connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to connect wallet";
      onError?.(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatWalletName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const isWalletInstalled = (provider: string): boolean => {
    return typeof window !== "undefined" && provider in window;
  };

  // Check wallet installation status
  useEffect(() => {
    const checkWalletAvailability = () => {
      const statusMap: Record<string, boolean> = {};

      Object.values(SUPPORTED_WALLETS).forEach((wallet) => {
        let isInstalled = false;

        // Check based on wallet name
        switch (wallet.name.toLowerCase()) {
          case SUPPORTED_WALLETS.xverse.name:
            isInstalled = isWalletInstalled("XverseProviders");
            break;
          case SUPPORTED_WALLETS.unisat.name:
            isInstalled = isWalletInstalled("unisat");
            break;
          case SUPPORTED_WALLETS.leather.name:
            isInstalled =
              isWalletInstalled("LeatherProvider") ||
              isWalletInstalled("HiroWalletProvider");
            break;
          case SUPPORTED_WALLETS["magic-eden"].name:
            isInstalled = isWalletInstalled("magicEden");
            break;
          case SUPPORTED_WALLETS.okx.name:
            isInstalled = isWalletInstalled("okxwallet");
            break;
          case SUPPORTED_WALLETS.phantom.name:
            isInstalled = isWalletInstalled("phantom");
            break;
          case SUPPORTED_WALLETS.wizz.name:
            isInstalled = isWalletInstalled("wizz");
            break;
          case SUPPORTED_WALLETS.oyl.name:
            isInstalled = isWalletInstalled("oyl");
            break;
          case SUPPORTED_WALLETS.orange.name:
            isInstalled = isWalletInstalled("orange");
            break;
          default:
            // Generic check for other wallets
            isInstalled = isWalletInstalled(wallet.name.toLowerCase());
        }

        statusMap[wallet.name] = isInstalled;
      });

      setWalletStatusMap(statusMap);
    };

    checkWalletAvailability();

    // Re-check when the modal opens
    if (showWalletModal) {
      checkWalletAvailability();
    }
  }, [showWalletModal]);

  const handleDisconnect = async () => {
    try {
      disconnect();
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  if (connected) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <p className="text-green-400 font-medium text-center mb-3">
          ✓ Wallet Connected
        </p>

        {/* Payment Address */}
        {paymentAddress && (
          <div className="mb-3">
            <p className="text-slate-300 text-xs font-medium mb-1">
              Payment Address:
            </p>
            <p className="text-slate-200 text-sm font-mono bg-slate-800/50 px-2 py-1 rounded">
              {paymentAddress.slice(0, 12)}...
              {paymentAddress.slice(-8)}
            </p>
          </div>
        )}

        {ordinalsAddress && (
          <div className="mb-3">
            <p className="text-slate-300 text-xs font-medium mb-1">
              Ordinals Address:
            </p>
            <p className="text-slate-200 text-sm font-mono bg-slate-800/50 px-2 py-1 rounded">
              {ordinalsAddress.slice(0, 12)}...
              {ordinalsAddress.slice(-8)}
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleDisconnect}
            className="text-slate-400 hover:text-white text-sm underline transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowWalletModal(true)}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
      >
        Connect Wallet
      </button>

      {/* Wallet Selection Modal */}
      <Dialog.Root open={showWalletModal} onOpenChange={setShowWalletModal}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-xl font-semibold text-white">
                  Connect Wallet
                </Dialog.Title>
                <Dialog.Close className="text-slate-400 hover:text-white text-xl">
                  ✕
                </Dialog.Close>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.values(SUPPORTED_WALLETS)
                  .sort((a, b) => {
                    // Sort installed wallets first
                    const aInstalled = walletStatusMap[a.name];
                    const bInstalled = walletStatusMap[b.name];

                    if (aInstalled && !bInstalled) return -1;
                    if (!aInstalled && bInstalled) return 1;

                    // Then sort by name
                    return a.name.localeCompare(b.name);
                  })
                  .map((wallet) => {
                    const isInstalled = walletStatusMap[wallet.name];

                    return (
                      <div key={wallet.name} className="relative">
                        <button
                          onClick={
                            isInstalled
                              ? () => handleConnect(wallet.name)
                              : undefined
                          }
                          disabled={isConnecting || !isInstalled}
                          className={`flex items-center gap-4 w-full p-4 border rounded-xl transition-all duration-200 group ${
                            isInstalled
                              ? "bg-slate-900/50 hover:bg-slate-700/50 border-slate-700/50 hover:border-slate-600/50 cursor-pointer"
                              : "bg-slate-900/20 border-slate-800/50 cursor-not-allowed opacity-60"
                          }`}
                        >
                          <div className="w-10 h-10 flex items-center justify-center">
                            <WalletIcon
                              walletName={wallet.name}
                              size={32}
                              className={`transition-transform ${
                                isInstalled ? "group-hover:scale-110" : ""
                              }`}
                            />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium text-sm">
                                {formatWalletName(wallet.name)}
                              </p>
                              {isInstalled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                  ✓ Installed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                  Not installed
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs">
                              Bitcoin wallet
                            </p>
                          </div>
                          {isConnecting && isInstalled && (
                            <div className="text-orange-500">
                              <svg
                                className="animate-spin h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            </div>
                          )}
                        </button>

                        {!isInstalled && (
                          <div className="absolute top-0 right-0 h-full flex items-center pr-4">
                            <a
                              href={wallet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Install
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="mt-6 p-4 bg-slate-900/60 rounded-xl border border-slate-700/30">
                <p className="text-slate-400 text-xs text-center">
                  Make sure your wallet extension is installed and unlocked
                </p>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
