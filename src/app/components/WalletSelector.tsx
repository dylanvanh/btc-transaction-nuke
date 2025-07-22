"use client";

import { Dialog } from "@base-ui-components/react/dialog";
import {
  ProviderType,
  SUPPORTED_WALLETS,
  useLaserEyes,
  WalletIcon,
} from "@omnisat/lasereyes-react";
import { CheckCircle, Wallet } from "lucide-react";
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
      <div className="border border-green-400 pixel-border p-3 mb-4">
        <div className="flex items-center justify-center space-x-2 mb-3">
          <CheckCircle className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400 tracking-wider font-bold">
            WALLET CONNECTED
          </span>
        </div>

        {paymentAddress && (
          <div className="mb-2">
            <p className="text-gray-400 text-xs mb-1 tracking-wider">
              PAYMENT:
            </p>
            <p className="text-white text-xs font-mono bg-gray-900 px-2 py-1 border border-gray-600">
              {`${paymentAddress.slice(0, 8)}...${paymentAddress.slice(-6)}`}
            </p>
          </div>
        )}

        {ordinalsAddress && (
          <div className="mb-3">
            <p className="text-gray-400 text-xs mb-1 tracking-wider">
              ORDINALS:
            </p>
            <p className="text-white text-xs font-mono bg-gray-900 px-2 py-1 border border-gray-600">
              {`${ordinalsAddress.slice(0, 8)}...${ordinalsAddress.slice(-6)}`}
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleDisconnect}
            className="text-gray-400 hover:text-red-400 text-xs underline tracking-wider"
          >
            DISCONNECT
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowWalletModal(true)}
        disabled={isConnecting}
        className="w-full flex items-center justify-center space-x-2 py-2 bg-white text-black text-xs font-bold border border-white pixel-button hover:bg-black hover:text-white transition-all disabled:opacity-50 mb-4"
      >
        <Wallet className="w-3 h-3" />
        <span>{isConnecting ? "CONNECTING..." : "CONNECT WALLET"}</span>
      </button>

      {/* Wallet Selection Modal */}
      <Dialog.Root open={showWalletModal} onOpenChange={setShowWalletModal}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black bg-opacity-50 z-40" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-black border border-white pixel-border p-6 w-full max-w-md mx-auto relative overflow-hidden">
              <div className="absolute inset-0 bg-gray-900 opacity-5 animate-pulse"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <Dialog.Title className="text-lg font-bold tracking-wider text-white truncate">
                  SELECT WALLET
                </Dialog.Title>
                <Dialog.Close className="text-gray-400 hover:text-white text-xl flex-shrink-0 ml-4">
                  ✕
                </Dialog.Close>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto overflow-x-hidden relative z-10">
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
                      <div key={wallet.name} className="w-full overflow-hidden">
                        <button
                          onClick={
                            isInstalled
                              ? () => handleConnect(wallet.name)
                              : undefined
                          }
                          disabled={isConnecting || !isInstalled}
                          className={`flex items-center justify-between w-full p-3 border transition-all duration-200 group min-w-0 ${
                            isInstalled
                              ? "bg-black hover:bg-gray-900 border-white hover:border-gray-300 cursor-pointer pixel-button"
                              : "bg-black border-gray-600 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <WalletIcon walletName={wallet.name} size={24} />
                            </div>
                            <p className="text-white font-bold text-xs tracking-wider truncate">
                              {formatWalletName(wallet.name).toUpperCase()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isConnecting && isInstalled && (
                              <div className="text-red-400">
                                <svg
                                  className="animate-spin h-4 w-4"
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
                            {isInstalled ? (
                              <span className="inline-flex items-center px-2 py-0.5 border border-green-400 text-xs font-bold bg-black text-green-400 whitespace-nowrap">
                                ✓ READY
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 border border-gray-600 text-xs font-bold bg-black text-gray-400 whitespace-nowrap">
                                  NOT FOUND
                                </span>
                                <a
                                  href={wallet.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-600 pixel-button whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  GET
                                </a>
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
