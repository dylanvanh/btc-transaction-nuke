import { mempoolClient, UTXO, Transaction } from "../clients/mempool-client";
import { bitcoin } from "./config";

export type UserWalletInfo = {
  paymentAddress: string;
  ordinalsAddress: string;
  ordinalsPublicKey: string;
  paymentPublicKey?: string;
  utxos: UTXO[];
};

export type CancelTxResult = {
  success: boolean;
  message: string;
  replacementTxId?: string;
  originalTxId: string;
  userUtxosUsed: UTXO[];
  feeRate: number;
  totalFee: number;
  unsignedPsbt?: string;
};

export const cancelTx = async (
  transactionId: string,
  userPaymentAddress: string,
  paymentPublicKey: string
): Promise<CancelTxResult> => {
  try {
    // 1. Get the original transaction
    const originalTx = await mempoolClient.getTransaction(transactionId);
    
    if (originalTx.status.confirmed) {
      throw new Error("Cannot cancel confirmed transaction");
    }

    // 2. Find which UTXOs from the original transaction belong to the user
    const userUtxosInOriginalTx = findUserUtxosInTransaction(originalTx, userPaymentAddress);
    
    if (userUtxosInOriginalTx.length === 0) {
      throw new Error("No UTXOs belonging to user found in transaction");
    }

    // 3. Calculate higher fee rate (original fee + buffer)
    const originalVsize = Math.ceil(originalTx.weight / 4);
    const originalFeeRate = Math.ceil(originalTx.fee / originalVsize);
    const newFeeRate = Math.max(originalFeeRate + 10, await mempoolClient.getFastestFee() + 5);
    
    // 4. Create replacement transaction with higher fees
    const replacementTx = await createReplacementTransaction(
      userUtxosInOriginalTx,
      userPaymentAddress,
      newFeeRate,
      paymentPublicKey
    );

    // 5. Return unsigned PSBT for wallet signing
    return {
      success: true,
      message: "Replacement transaction prepared for signing",
      originalTxId: transactionId,
      userUtxosUsed: userUtxosInOriginalTx,
      feeRate: newFeeRate,
      totalFee: replacementTx.fee,
      unsignedPsbt: replacementTx.psbt
    };

  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      originalTxId: transactionId,
      userUtxosUsed: [],
      feeRate: 0,
      totalFee: 0
    };
  }
};

const findUserUtxosInTransaction = (transaction: Transaction, userAddress: string): UTXO[] => {
  const userUtxos: UTXO[] = [];
  
  for (const input of transaction.vin) {
    if (input.prevout.scriptpubkey_address === userAddress) {
      userUtxos.push({
        txid: input.txid,
        vout: input.vout,
        value: input.prevout.value,
        status: transaction.status
      });
    }
  }
  
  return userUtxos;
};

const createReplacementTransaction = async (
  utxosToSpend: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string
): Promise<{ psbt: string; hex: string; fee: number }> => {
  const psbt = new bitcoin.Psbt();
  
  // Add inputs - using the same UTXOs as the original transaction
  for (const utxo of utxosToSpend) {
    const inputData: {
      hash: string;
      index: number;
      witnessUtxo: {
        script: Buffer;
        value: bigint;
      };
      redeemScript?: Buffer;
    } = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(bitcoin.address.toOutputScript(paymentAddress)),
        value: BigInt(utxo.value)
      }
    };

    // Add redeemScript for P2SH addresses
    if (paymentAddress.startsWith("3")) {
      const publicKeyBuffer = Buffer.from(paymentPublicKey, "hex");
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: publicKeyBuffer });
      inputData.redeemScript = Buffer.from(p2wpkh.output!);
    }

    psbt.addInput(inputData);
  }
  
  // Calculate total input value
  const totalInputValue = utxosToSpend.reduce((sum, utxo) => sum + utxo.value, 0);
  
  // Estimate transaction size (rough estimate)
  const estimatedSize = utxosToSpend.length * 148 + 34 + 10; // inputs + output + overhead
  const estimatedFee = Math.ceil(estimatedSize * feeRate);
  
  // Add single output - send everything back to the same address minus fees
  const outputValue = totalInputValue - estimatedFee;
  
  if (outputValue <= 546) {
    throw new Error("Insufficient funds to pay fees");
  }

  psbt.addOutput({
    address: paymentAddress,
    value: BigInt(outputValue),
  });

  return {
    psbt: psbt.toBase64(),
    hex: psbt.toHex(),
    fee: estimatedFee,
  };
};
