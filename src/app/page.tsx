"use client";

import { useState } from "react";
import { Input } from "@base-ui-components/react/input";
import { Field } from "@base-ui-components/react/field";
import { Form } from "@base-ui-components/react/form";
import { Dialog } from "@base-ui-components/react/dialog";
import { useLaserEyes } from "@omnisat/lasereyes-react";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 shadow-2xl relative">
            {/* Header Icons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => setShowWarningModal(true)}
                className="p-2 bg-slate-800/30 hover:bg-yellow-400/10 border border-slate-700/50 hover:border-yellow-400/30 text-slate-400 hover:text-yellow-400 rounded-lg transition-all duration-200"
                title="Important safety info"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </button>
              <a
                href="https://github.com/dylanvanh/btc-transaction-nuke"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 text-slate-400 hover:text-slate-200 rounded-lg transition-all duration-200"
                title="GitHub"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>

            <div className="text-center mb-8 mt-12">
              <h1 className="text-2xl font-bold text-white mb-2">
                Bitcoin Transaction Nuke
              </h1>
              <p className="text-slate-400 text-sm">
                Cancel unconfirmed transactions
              </p>
            </div>

            {/* Wallet Connection */}
            <div className="mb-6">
              <WalletSelector 
                onWalletConnected={handleWalletConnected}
                onError={handleWalletError}
              />
            </div>

            <Form onSubmit={handleSubmit}>
              <Field.Root className="mb-6">
                <Field.Label className="block text-sm font-medium text-slate-300 mb-3">
                  Transaction ID
                </Field.Label>
                <div className="relative">
                  <Input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Enter transaction ID..."
                    disabled={!connected}
                    className="w-full px-4 py-4 bg-slate-900/80 border border-slate-600/50 rounded-2xl text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-mono text-sm transition-all duration-200"
                    required
                  />
                </div>
              </Field.Root>

              <button
                type="submit"
                disabled={!connected || isProcessing || !transactionId}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {isProcessing ? (
                  <>
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Cancel Transaction
                  </>
                )}
              </button>
            </Form>

            {/* Status Messages */}
            {status === "success" && (
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-green-400 font-medium">
                  ✓ Cancellation transaction broadcast successfully!
                </p>
                {replacementTxId && (
                  <div className="mt-3">
                    <p className="text-slate-300 text-xs font-medium mb-2">
                      Replacement Transaction:
                    </p>
                    <a
                      href={`https://mempool.space/tx/${replacementTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors duration-200"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      View on Mempool.space
                    </a>
                  </div>
                )}
                <p className="text-slate-300 text-sm mt-3">
                  Monitor the mempool for confirmation
                </p>
              </div>
            )}

            {status === "error" && error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">❌</div>
                  <div className="flex-1">
                    <h3 className="text-red-400 font-medium text-sm mb-1">
                      Transaction Error
                    </h3>
                    <p className="text-slate-300 text-sm mb-3">{error}</p>
                    <button
                      onClick={() => {
                        setStatus("idle");
                        setError(null);
                      }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-slate-900/60 rounded-2xl border border-slate-700/30">
              <p className="text-slate-300 text-sm font-medium mb-1">
                Important
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Only works with unconfirmed transactions. Success depends on
                network conditions and gas fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      <Dialog.Root open={showWarningModal} onOpenChange={setShowWarningModal}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-sm w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-yellow-400/10 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>

                <Dialog.Title className="text-lg font-semibold text-white mb-3">
                  Safety Warning
                </Dialog.Title>

                <Dialog.Description className="text-slate-300 text-sm mb-6">
                  Always validate all transaction details before signing.
                </Dialog.Description>

                <Dialog.Close className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors">
                  Got it
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
