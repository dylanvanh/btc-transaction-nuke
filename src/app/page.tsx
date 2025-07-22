"use client";

import { Form } from "@base-ui-components/react/form";
import { Dialog } from "@base-ui-components/react/dialog";
import { useLaserEyes } from "@omnisat/lasereyes-react";
import { AlertCircle, AlertTriangle, CheckCircle, Skull } from "lucide-react";
import { siGithub } from "simple-icons";
import { useState } from "react";
import WalletSelector from "./components/WalletSelector";

export default function Home() {
  const [transactionId, setTransactionId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [replacementTxId, setReplacementTxId] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);

  const {
    connected,
    address: ordinalsAddress,
    paymentAddress,
    signPsbt,
    paymentPublicKey,
    publicKey: ordinalsPublicKey,
  } = useLaserEyes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId || !connected || !paymentAddress || !ordinalsAddress) {
      setError("Please connect wallet and enter transaction ID");
      setStatus("error");
      return;
    }

    setIsProcessing(true);
    setStatus("idle");
    setError(null);
    setReplacementTxId("");

    try {
      const response = await fetch("/api/cancel-tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId,
          userWalletInfo: {
            paymentAddress: paymentAddress,
            paymentPublicKey: paymentPublicKey,
            ordinalsAddress: ordinalsAddress,
            ordinalsPublicKey: ordinalsPublicKey,
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Sign the PSBT with proper address mapping
        const inputsToSign =
          (
            result as {
              inputSigningMap?: Array<{ index: number; address: string }>;
            }
          ).inputSigningMap || [];

        let signedPsbt;
        try {
          signedPsbt = await signPsbt({
            tx: result.unsignedPsbt,
            inputsToSign: inputsToSign,
            finalize: false,
            broadcast: false,
          });
        } catch (signError) {
          throw new Error(
            `Failed to sign PSBT: ${signError instanceof Error ? signError.message : "Unknown error"}`,
          );
        }

        if (!signedPsbt || !signedPsbt.signedPsbtHex) {
          throw new Error("Failed to sign PSBT");
        }

        // Broadcast the signed transaction
        const broadcastResponse = await fetch("/api/broadcast-tx", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signedPsbtHex: signedPsbt.signedPsbtHex,
          }),
        });

        const broadcastResult = await broadcastResponse.json();

        if (!broadcastResponse.ok || !broadcastResult.success) {
          throw new Error(
            broadcastResult.error || "Failed to broadcast transaction",
          );
        }

        setStatus("success");
        setReplacementTxId(broadcastResult.txId);
      } else {
        setError(result.error || "Failed to cancel transaction");
        setStatus("error");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to cancel transaction",
      );
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalletConnected = () => {
    setStatus("idle");
    setError(null);
  };

  const handleWalletError = (errorMessage: string) => {
    setError(errorMessage);
    setStatus("error");
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-2 h-2 bg-white animate-pulse"></div>
        <div className="absolute top-20 right-20 w-1 h-1 bg-white animate-ping"></div>
        <div className="absolute bottom-20 left-20 w-1 h-1 bg-white animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-2 h-2 bg-white animate-ping"></div>
      </div>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <Skull className="w-6 h-6 text-red-400 animate-pulse" />
              <h2 className="text-2xl font-bold tracking-wider text-red-400">
                NUKE TRANSACTION
              </h2>
              <Skull className="w-6 h-6 text-red-400 animate-pulse" />
            </div>
            <p className="text-gray-400 text-sm">
              Enter TX hash to cancel pending transaction
            </p>
          </div>

          {/* Main Interface */}
          <div className="bg-black border border-red-400 pixel-border p-6 mb-6 relative">
            {/* Glitch effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900 to-transparent opacity-10 animate-pulse"></div>

            <div className="space-y-4 relative z-10">
              {/* Wallet Connection */}
              <div className="mb-6">
                <WalletSelector
                  onWalletConnected={handleWalletConnected}
                  onError={handleWalletError}
                />
              </div>

              <Form onSubmit={handleSubmit}>
                {/* Transaction Input */}
                <div>
                  <label className="block text-xs font-bold mb-2 tracking-wider text-red-400">
                    TRANSACTION HASH
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="1a1a1a1a..."
                    className="w-full p-3 bg-black text-white border border-white pixel-input focus:outline-none focus:border-red-400 font-mono text-xs"
                    disabled={!connected || isProcessing}
                  />
                </div>

                {/* Cancel Button */}
                <button
                  type="submit"
                  disabled={!connected || !transactionId.trim() || isProcessing}
                  className="w-full py-3 px-4 bg-red-600 text-white font-bold text-sm tracking-wider border border-red-600 pixel-button hover:bg-black hover:text-red-600 hover:border-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden mt-4"
                >
                  <span className="relative z-10">
                    {isProcessing ? "NUKING..." : "💥 NUKE TX"}
                  </span>
                  {!isProcessing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-500 opacity-0 hover:opacity-20 transition-opacity"></div>
                  )}
                </button>

                {/* Status */}
                {!connected && (
                  <div className="flex items-center justify-center space-x-1 text-yellow-400 text-xs mt-4">
                    <AlertTriangle className="w-3 h-3" />
                    <span>CONNECT WALLET FIRST</span>
                  </div>
                )}
              </Form>
            </div>
          </div>

          {/* Status Messages */}
          {status === "success" && (
            <div className="bg-black border border-green-400 pixel-border p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-green-400 font-bold text-xs tracking-wider">
                  NUKE SUCCESSFUL!
                </p>
              </div>
              {replacementTxId && (
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-2">REPLACEMENT TX:</p>
                  <div className="bg-gray-900 p-2 border border-gray-600 text-xs font-mono break-all mb-3">
                    {replacementTxId}
                  </div>
                  <a
                    href={`https://mempool.space/tx/${replacementTxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 py-2 px-3 bg-white text-black font-bold text-xs border border-white pixel-button hover:bg-black hover:text-white transition-all"
                  >
                    <span>VIEW ON MEMPOOL</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {status === "error" && error && (
            <div className="bg-black border border-red-400 pixel-border p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 font-bold text-xs tracking-wider">
                  NUKE FAILED
                </p>
              </div>
              <p className="text-gray-400 text-xs text-center mb-3">{error}</p>
              <div className="text-center">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setError(null);
                  }}
                  className="py-2 px-3 bg-white text-black font-bold text-xs border border-white pixel-button hover:bg-black hover:text-white transition-all"
                >
                  TRY AGAIN
                </button>
              </div>
            </div>
          )}

          {/* Compact Info */}
          <div className="border border-gray-600 border-dotted p-3 text-center">
            <p className="text-gray-500 text-xs">
              Uses RBF to cancel unconfirmed transactions
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex justify-center space-x-3">
            <a
              href="https://github.com/dylanvanh/btc-transaction-nuke"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 text-white hover:text-red-400 transition-all tracking-wider text-xs border border-white hover:border-red-400 px-3 py-2 pixel-button bg-black hover:bg-black hover:text-red-400"
            >
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="w-3 h-3 fill-current"
              >
                <path d={siGithub.path} />
              </svg>
              <span className="font-bold">GITHUB</span>
            </a>
            <button
              onClick={() => setShowWarningModal(true)}
              className="flex items-center justify-center space-x-2 text-white hover:text-red-400 transition-all tracking-wider text-xs border border-white hover:border-red-400 px-3 py-2 pixel-button bg-black hover:bg-black hover:text-red-400"
            >
              <AlertCircle className="w-3 h-3" />
              <span className="font-bold">DISCLAIMER</span>
            </button>
          </div>
        </div>
      </main>

      {/* Warning Modal */}
      <Dialog.Root open={showWarningModal} onOpenChange={setShowWarningModal}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black bg-opacity-50 z-40" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-black border border-yellow-400 pixel-border p-6 max-w-md w-full relative">
              <div className="absolute inset-0 bg-yellow-900 opacity-5 animate-pulse"></div>
              <div className="text-center mb-4 relative z-10">
                <div className="flex items-center justify-center mb-3">
                  <AlertCircle className="w-8 h-8 text-yellow-400 animate-pulse" />
                </div>
                <Dialog.Title className="text-lg font-bold mb-3 tracking-wider text-yellow-400">
                  DISCLAIMER
                </Dialog.Title>
                <div className="text-left space-y-2 text-xs text-gray-300">
                  <Dialog.Description className="font-bold text-white mb-2">
                    Important Notice:
                  </Dialog.Description>
                  <div>• Always verify transaction details before signing.</div>
                  <div>
                    • The owner is not responsible for any incorrect
                    transactions you sign.
                  </div>
                  <div>• Use this platform at your own risk.</div>
                  <div>• By using this platform, you agree to these terms.</div>
                </div>
              </div>

              <Dialog.Close className="w-full py-2 bg-yellow-400 text-black font-bold text-xs border border-yellow-400 pixel-button hover:bg-black hover:text-yellow-400 hover:border-yellow-400 transition-all tracking-wider">
                I UNDERSTAND
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
