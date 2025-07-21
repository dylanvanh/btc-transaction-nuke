import { UTXO } from "../../clients/mempool-client";
import { bitcoin } from "../config/config";
import * as secp256k1 from "@bitcoinerlab/secp256k1";
import { InsufficientFundsError } from "../errors/errors";
import {
  ESTIMATED_INPUT_SIZE,
  ESTIMATED_OUTPUT_SIZE,
  TRANSACTION_OVERHEAD,
  DUST_THRESHOLD,
} from "../config/constants";

const addUtxoInput = async (
  psbt: bitcoin.Psbt,
  utxo: UTXO,
  address: string,
  publicKey: string,
): Promise<void> => {
  const inputData: {
    hash: string;
    index: number;
    witnessUtxo: {
      script: Buffer;
      value: bigint;
    };
    redeemScript?: Buffer;
    tapInternalKey?: Buffer;
  } = {
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: Buffer.from(bitcoin.address.toOutputScript(address)),
      value: BigInt(utxo.value),
    },
  };

  // Add redeemScript for P2SH addresses
  if (address.startsWith("3")) {
    const publicKeyBuffer = Buffer.from(publicKey, "hex");
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: publicKeyBuffer });
    inputData.redeemScript = Buffer.from(p2wpkh.output!);
  } else if (address.startsWith("bc1p")) {
    try {
      const publicKeyBuffer = Buffer.from(publicKey, "hex");

      let xOnlyPubkey;
      if (publicKeyBuffer.length === 32) {
        // Already x-only format (32 bytes)
        xOnlyPubkey = publicKeyBuffer;
      } else if (publicKeyBuffer.length === 33) {
        // Compressed format (33 bytes) - convert to x-only
        xOnlyPubkey = secp256k1.xOnlyPointFromPoint(publicKeyBuffer);
      } else {
        throw new Error(
          `Invalid public key length: ${publicKeyBuffer.length}. Expected 32 or 33 bytes.`,
        );
      }

      inputData.tapInternalKey = Buffer.from(xOnlyPubkey);
    } catch (error) {
      throw error;
    }
  }

  psbt.addInput(inputData);
};

export const buildConsolidatedTransaction = async (
  utxosToSpend: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
): Promise<{ psbt: string; hex: string; fee: number }> => {
  const psbt = new bitcoin.Psbt();

  for (const utxo of utxosToSpend) {
    await addUtxoInput(psbt, utxo, paymentAddress, paymentPublicKey);
  }

  const totalInputValue = utxosToSpend.reduce(
    (sum, utxo) => sum + utxo.value,
    0,
  );

  const estimatedSize =
    utxosToSpend.length * ESTIMATED_INPUT_SIZE +
    ESTIMATED_OUTPUT_SIZE +
    TRANSACTION_OVERHEAD;
  const estimatedFee = Math.ceil(estimatedSize * feeRate);

  const outputValue = totalInputValue - 2000;

  if (outputValue <= DUST_THRESHOLD) {
    throw new InsufficientFundsError("Insufficient funds to pay fees");
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

export const buildOrdinalsTransactionWithSeparateOutputs = async (
  ordinalsUtxo: UTXO,
  paymentUtxo: UTXO,
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): Promise<{ psbt: string; hex: string; fee: number }> => {
  const psbt = new bitcoin.Psbt();

  // Add ordinals UTXO as input (send back unchanged)
  await addUtxoInput(psbt, ordinalsUtxo, ordinalsAddress, ordinalsPublicKey);

  // Add payment UTXO as input (use for fees)
  await addUtxoInput(psbt, paymentUtxo, paymentAddress, paymentPublicKey);

  // Calculate fee based on transaction size
  const estimatedSize =
    2 * ESTIMATED_INPUT_SIZE + 2 * ESTIMATED_OUTPUT_SIZE + TRANSACTION_OVERHEAD; // 2 inputs + 2 outputs + overhead
  const estimatedFee = Math.ceil(estimatedSize * feeRate);

  // Output 1: Send ordinals UTXO back to ordinals address (unchanged)
  psbt.addOutput({
    address: ordinalsAddress,
    value: BigInt(ordinalsUtxo.value),
  });

  // Output 2: Send payment UTXO back to payment address (minus fees)
  const paymentOutputValue = paymentUtxo.value - estimatedFee + 2000;

  if (paymentOutputValue <= DUST_THRESHOLD) {
    throw new InsufficientFundsError("Payment UTXO too small to cover fees");
  }

  psbt.addOutput({
    address: paymentAddress,
    value: BigInt(paymentOutputValue),
  });

  return {
    psbt: psbt.toBase64(),
    hex: psbt.toHex(),
    fee: estimatedFee,
  };
};

export const buildOrdinalsTransactionWithMultiplePaymentInputs = async (
  ordinalsUtxo: UTXO,
  paymentUtxos: UTXO[],
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): Promise<{ psbt: string; hex: string; fee: number }> => {
  const psbt = new bitcoin.Psbt();

  // Add ordinals UTXO as input (send back unchanged)
  await addUtxoInput(psbt, ordinalsUtxo, ordinalsAddress, ordinalsPublicKey);

  // Add all payment UTXOs as inputs
  for (const paymentUtxo of paymentUtxos) {
    await addUtxoInput(psbt, paymentUtxo, paymentAddress, paymentPublicKey);
  }

  // Calculate fee based on transaction size
  const estimatedSize =
    (1 + paymentUtxos.length) * ESTIMATED_INPUT_SIZE +
    2 * ESTIMATED_OUTPUT_SIZE +
    TRANSACTION_OVERHEAD; // ordinals + payment inputs + 2 outputs + overhead
  const estimatedFee = Math.ceil(estimatedSize * feeRate);

  // Output 1: Send ordinals UTXO back to ordinals address (unchanged)
  psbt.addOutput({
    address: ordinalsAddress,
    value: BigInt(ordinalsUtxo.value),
  });

  // Output 2: Send combined payment UTXOs back to payment address (minus fees)
  const totalPaymentValue = paymentUtxos.reduce(
    (sum, utxo) => sum + utxo.value,
    0,
  );
  const paymentOutputValue = totalPaymentValue - estimatedFee;

  if (paymentOutputValue <= DUST_THRESHOLD) {
    throw new InsufficientFundsError(
      "Combined payment UTXOs too small to cover fees",
    );
  }

  psbt.addOutput({
    address: paymentAddress,
    value: BigInt(paymentOutputValue),
  });

  return {
    psbt: psbt.toBase64(),
    hex: psbt.toHex(),
    fee: estimatedFee,
  };
};
