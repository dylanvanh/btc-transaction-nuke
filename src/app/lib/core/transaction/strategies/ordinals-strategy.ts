import { UTXO, Transaction } from "../../../clients/mempool-client";
import { mempoolClient } from "../../../clients/mempool-client";
import {
  ValidationError,
  TransactionCancellationError,
  InsufficientFundsError,
} from "../../errors/errors";
import {
  createOutpointSet,
  filterUtxosByOutpoints,
  excludeUtxosByOutpoints,
  findUserUtxosInTransaction,
  findBestOrdinalsUtxo,
  filterCleanUtxos,
  findLargestUtxo,
} from "../../utxo/utxo-utils";
import {
  buildOrdinalsTransactionWithSeparateOutputs,
  buildOrdinalsTransactionWithMultiplePaymentInputs,
} from "../transaction-builder";
import { executeStrategies } from "../strategy";
import {
  ESTIMATED_INPUT_SIZE,
  ESTIMATED_OUTPUT_SIZE,
  TRANSACTION_OVERHEAD,
  DUST_THRESHOLD,
} from "../../config/constants";

export type CancelTxResult = {
  unsignedPsbt: string;
  inputSigningMap: Array<{ index: number; address: string }>;
  totalFee: number;
};

export const processOrdinalsUtxos = async (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): Promise<CancelTxResult> => {
  const userOrdinalsUtxosInTx = findUserUtxosInTransaction(
    originalTx,
    ordinalsAddress,
  );
  const ordinalsOutpoints = createOutpointSet(userOrdinalsUtxosInTx);
  const ordinalsUtxos = filterUtxosByOutpoints(allUserUtxos, ordinalsOutpoints);

  if (ordinalsUtxos.length === 0) {
    throw new ValidationError("No ordinals UTXOs found in transaction");
  }

  let availablePaymentUtxos;
  try {
    availablePaymentUtxos = await mempoolClient.getAddressUtxos(paymentAddress);
  } catch (error) {
    throw new TransactionCancellationError(
      `Failed to fetch payment UTXOs: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Filter out UTXOs that are already used in the original transaction
  const unusedPaymentUtxos = excludeUtxosByOutpoints(
    availablePaymentUtxos,
    createOutpointSet(allUserUtxos),
  );

  if (unusedPaymentUtxos.length === 0) {
    throw new InsufficientFundsError(
      "No available payment UTXOs found to cover fees for ordinals transaction cancellation. " +
        "Please ensure you have available UTXOs in your payment address.",
    );
  }

  const bestOrdinalsUtxo = await findBestOrdinalsUtxo(
    ordinalsUtxos,
    ordinalsAddress,
  );

  const cleanPaymentUtxos = await filterCleanUtxos(
    unusedPaymentUtxos,
    paymentAddress,
  );

  if (cleanPaymentUtxos.length === 0) {
    throw new InsufficientFundsError(
      "No clean payment UTXOs available (all contain inscriptions or runes). " +
        "Please ensure you have UTXOs without collateral in your payment address.",
    );
  }

  // Try approaches in order: single payment UTXO first, then multiple
  const ordinalsStrategies = [
    () =>
      createOrdinalsReplacementWithSinglePaymentUtxo(
        bestOrdinalsUtxo,
        cleanPaymentUtxos,
        ordinalsAddress,
        paymentAddress,
        feeRate,
        paymentPublicKey,
        ordinalsPublicKey,
      ),
    () =>
      buildOrdinalsReplacementWithMultiplePaymentUtxos(
        bestOrdinalsUtxo,
        cleanPaymentUtxos,
        ordinalsAddress,
        paymentAddress,
        feeRate,
        paymentPublicKey,
        ordinalsPublicKey,
      ),
  ];

  return await executeStrategies(ordinalsStrategies);
};

const createOrdinalsReplacementWithSinglePaymentUtxo = async (
  ordinalsUtxo: UTXO,
  availablePaymentUtxos: UTXO[],
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): Promise<CancelTxResult> => {
  const singlePaymentUtxo = findLargestUtxo(availablePaymentUtxos);

  const estimatedSize =
    2 * ESTIMATED_INPUT_SIZE + 2 * ESTIMATED_OUTPUT_SIZE + TRANSACTION_OVERHEAD;
  const estimatedFee = Math.ceil(estimatedSize * feeRate);
  const remainingValue = singlePaymentUtxo.value - estimatedFee;

  if (remainingValue <= DUST_THRESHOLD) {
    throw new InsufficientFundsError(
      "Single payment UTXO insufficient to cover fees",
    );
  }

  const replacementTx = await buildOrdinalsTransactionWithSeparateOutputs(
    ordinalsUtxo,
    singlePaymentUtxo,
    ordinalsAddress,
    paymentAddress,
    feeRate,
    paymentPublicKey,
    ordinalsPublicKey,
  );

  // For ordinals scenarios: input 0 = ordinals address, input 1 = payment address
  const inputSigningMap = [
    { index: 0, address: ordinalsAddress },
    { index: 1, address: paymentAddress },
  ];

  return {
    unsignedPsbt: replacementTx.psbt,
    inputSigningMap,
    totalFee: replacementTx.fee,
  };
};

const buildOrdinalsReplacementWithMultiplePaymentUtxos = async (
  ordinalsUtxo: UTXO,
  paymentUtxos: UTXO[],
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): Promise<CancelTxResult> => {
  // Sort payment UTXOs by value (largest first) for efficiency
  const sortedPaymentUtxos = paymentUtxos.sort((a, b) => b.value - a.value);

  // Add payment UTXOs until we have enough to cover fees
  const paymentUtxosToUse: UTXO[] = [];
  let totalPaymentValue = 0;

  for (const utxo of sortedPaymentUtxos) {
    paymentUtxosToUse.push(utxo);
    totalPaymentValue += utxo.value;

    // Estimate fee with current UTXO count (1 ordinals + N payment inputs, 2 outputs)
    const estimatedSize =
      (1 + paymentUtxosToUse.length) * ESTIMATED_INPUT_SIZE +
      2 * ESTIMATED_OUTPUT_SIZE +
      TRANSACTION_OVERHEAD;
    const estimatedFee = Math.ceil(estimatedSize * feeRate);

    // Check if we now have enough to cover fees
    if (totalPaymentValue - estimatedFee > DUST_THRESHOLD) {
      break;
    }
  }

  // Final check - ensure we have enough
  const finalSize =
    (1 + paymentUtxosToUse.length) * ESTIMATED_INPUT_SIZE +
    2 * ESTIMATED_OUTPUT_SIZE +
    TRANSACTION_OVERHEAD;
  const finalFee = Math.ceil(finalSize * feeRate);

  if (totalPaymentValue - finalFee <= DUST_THRESHOLD) {
    throw new InsufficientFundsError(
      "Insufficient payment UTXOs to cover fees for ordinals transaction",
    );
  }

  const replacementTx = await buildOrdinalsTransactionWithMultiplePaymentInputs(
    ordinalsUtxo,
    paymentUtxosToUse,
    ordinalsAddress,
    paymentAddress,
    feeRate,
    paymentPublicKey,
    ordinalsPublicKey,
  );

  // For ordinals with multiple payments: input 0 = ordinals, inputs 1+ = payment addresses
  const inputSigningMap = [
    { index: 0, address: ordinalsAddress },
    ...paymentUtxosToUse.map((_, i) => ({
      index: i + 1,
      address: paymentAddress,
    })),
  ];

  return {
    unsignedPsbt: replacementTx.psbt,
    inputSigningMap,
    totalFee: replacementTx.fee,
  };
};