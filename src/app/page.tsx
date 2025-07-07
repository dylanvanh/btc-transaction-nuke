"use client";

import { useState } from "react";
import { Input } from "@base-ui-components/react/input";
import { Field } from "@base-ui-components/react/field";
import { Form } from "@base-ui-components/react/form";
import { useLaserEyes } from "@omnisat/lasereyes-react";
import { XVERSE } from "@omnisat/lasereyes-core";

export default function Home() {
  const [transactionId, setTransactionId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [replacementTxId, setReplacementTxId] = useState("");

  const { connect, disconnect, connected, address, paymentAddress, signPsbt, publicKey, paymentPublicKey } =
    useLaserEyes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId || !connected || !paymentAddress || !address) {
      setErrorMessage("Please connect wallet and enter transaction ID");
      setStatus("error");
      return;
    }

    setIsProcessing(true);
    setStatus("idle");
    setErrorMessage("");
    setReplacementTxId("");

    try {
      console.log("Cancelling transaction:", transactionId);

      const response = await fetch("/api/cancel-tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId,
          userPaymentAddress: paymentAddress,
          userOrdinalsAddress: address,
          ordinalsPublicKey: publicKey || "", // from wallet
          paymentPublicKey: paymentPublicKey // from wallet for P2SH addresses
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log("PSBT prepared, signing with wallet...");
        
        // Sign the PSBT with the wallet
        const signedPsbt = await signPsbt(result.unsignedPsbt);
        console.log("PSBT signed, broadcasting transaction...");
        
        if (!signedPsbt || !signedPsbt.signedPsbtHex) {
          throw new Error("Failed to sign PSBT");
        }
        
        // Broadcast the signed transaction using our mempool client
        const broadcastResponse = await fetch("/api/broadcast-tx", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signedPsbtHex: signedPsbt.signedPsbtHex
          }),
        });
        
        const broadcastResult = await broadcastResponse.json();
        
        if (!broadcastResponse.ok || !broadcastResult.success) {
          throw new Error(broadcastResult.error || "Failed to broadcast transaction");
        }
        
        setStatus("success");
        setReplacementTxId(broadcastResult.txId);
        console.log("Transaction cancellation successful:", { txId: broadcastResult.txId, result });
      } else {
        setErrorMessage(result.error || result.message || "Failed to cancel transaction");
        setStatus("error");
      }
    } catch (error) {
      console.error("Failed to cancel transaction:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to cancel transaction",
      );
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnect = async () => {
    try {
      await connect(XVERSE);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setErrorMessage("Failed to connect wallet");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">
                Bitcoin Transaction Nuke
              </h1>
              <p className="text-slate-400 text-sm">
                Cancel unconfirmed transactions
              </p>
            </div>

            {/* Wallet Connection Status */}
            <div className="mb-6">
              {!connected ? (
                <button
                  onClick={handleConnect}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 font-medium text-center mb-3">
                    ✓ Xverse Wallet Connected
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

                  {/* Ordinals Address (using main address) */}
                  {address && (
                    <div className="mb-3">
                      <p className="text-slate-300 text-xs font-medium mb-1">
                        Ordinals Address:
                      </p>
                      <p className="text-slate-200 text-sm font-mono bg-slate-800/50 px-2 py-1 rounded">
                        {address.slice(0, 12)}...{address.slice(-8)}
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <button
                      onClick={disconnect}
                      className="text-slate-400 hover:text-white text-sm underline"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
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
                  <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-300 text-xs font-medium mb-1">
                      Replacement Transaction ID:
                    </p>
                    <p className="text-slate-200 text-sm font-mono break-all">
                      {replacementTxId}
                    </p>
                  </div>
                )}
                <p className="text-slate-300 text-sm mt-2">
                  Monitor the mempool for confirmation
                </p>
              </div>
            )}

            {status === "error" && errorMessage && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-red-400 font-medium">✗ {errorMessage}</p>
              </div>
            )}

            <div className="mt-6 p-4 bg-slate-900/60 rounded-2xl border border-slate-700/30">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
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
        </div>
      </div>
    </div>
  );
}
