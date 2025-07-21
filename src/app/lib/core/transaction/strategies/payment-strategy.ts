import {
  mempoolClient,
  Transaction,
  UTXO,
} from "../../../clients/mempool-client";
import {
  DUST_THRESHOLD,
  ESTIMATED_INPUT_SIZE,
  ESTIMATED_OUTPUT_SIZE,
  TRANSACTION_OVERHEAD,
} from "../../config/constants";
import { InsufficientFundsError, ValidationError } from "../../errors/errors";
import {
  createOutpointSet,
  excludeUtxosByOutpoints,
  filterUtxosByOutpoints,
  findUserUtxosInTransaction,
  validatePaymentUtxosAreClean,
} from "../../utxo/utxo-utils";
import { executeStrategies } from "../strategy";
import { buildConsolidatedTransaction } from "../transaction-builder";

export type CancelTxResult = {
  unsignedPsbt: string;
  inputSigningMap: Array<{ index: number; address: string }>;
  totalFee: number;
};

export const processPaymentUtxos = async (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
): Promise<CancelTxResult> => {
  const userPaymentUtxosInTx = findUserUtxosInTransaction(
    originalTx,
    paymentAddress,
  );
  const paymentOutpoints = createOutpointSet(userPaymentUtxosInTx);
  const paymentUtxos = filterUtxosByOutpoints(allUserUtxos, paymentOutpoints);

  if (paymentUtxos.length === 0) {
    throw new ValidationError("No payment UTXOs found in transaction");
  }

  // Try approaches in order: existing UTXOs first, then add additional ones
  const replaceUsingOnlyExistingPaymentUtxos = () =>
    createReplacementWithExistingPaymentUtxos(
      paymentUtxos,
      paymentAddress,
      feeRate,
      paymentPublicKey,
    );

  const replaceUsingExistingPlusAdditionalPaymentUtxos = () =>
    createReplacementWithAdditionalPaymentUtxos(
      paymentUtxos,
      paymentAddress,
      feeRate,
      paymentPublicKey,
    );

  const paymentOnlyStrategies = [
    replaceUsingOnlyExistingPaymentUtxos,
    replaceUsingExistingPlusAdditionalPaymentUtxos,
  ];

  return await executeStrategies(paymentOnlyStrategies);
};

const createReplacementWithExistingPaymentUtxos = async (
  paymentUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
): Promise<CancelTxResult> => {
  const totalValue = paymentUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const estimatedSize =
    paymentUtxos.length * ESTIMATED_INPUT_SIZE +
    ESTIMATED_OUTPUT_SIZE +
    TRANSACTION_OVERHEAD;
  const estimatedFee = Math.ceil(estimatedSize * feeRate);

  if (totalValue - estimatedFee <= DUST_THRESHOLD) {
    throw new InsufficientFundsError(
      "Payment UTXOs insufficient to cover fees",
    );
  }

  const replacementTx = await buildConsolidatedTransaction(
    paymentUtxos,
    paymentAddress,
    feeRate,
    paymentPublicKey,
  );

  // For payment-only scenarios, all inputs are signed with payment address
  const inputSigningMap = paymentUtxos.map((_, index) => ({
    index,
    address: paymentAddress,
  }));

  return {
    unsignedPsbt: replacementTx.psbt,
    inputSigningMap,
    totalFee: replacementTx.fee,
  };
};

const createReplacementWithAdditionalPaymentUtxos = async (
  transactionUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
): Promise<CancelTxResult> => {
  return await supplementWithAdditionalPaymentUtxos(
    transactionUtxos,
    paymentAddress,
    feeRate,
    paymentPublicKey,
  );
};

const supplementWithAdditionalPaymentUtxos = async (
  transactionUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
): Promise<CancelTxResult> => {
  const availablePaymentUtxos =
    await mempoolClient.getAddressUtxos(paymentAddress);

  const unusedPaymentUtxos = excludeUtxosByOutpoints(
    availablePaymentUtxos,
    createOutpointSet(transactionUtxos),
  );

  if (unusedPaymentUtxos.length === 0) {
    throw new InsufficientFundsError(
      "No additional payment UTXOs available in wallet",
    );
  }

  await validatePaymentUtxosAreClean(unusedPaymentUtxos, paymentAddress);

  // Add additional UTXOs until we have enough for fees
  const allUtxosToUse = [...transactionUtxos];
  let totalValue = transactionUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

  // Sort unused UTXOs by value (largest first) for efficiency
  const sortedUnusedUtxos = unusedPaymentUtxos.sort(
    (a, b) => b.value - a.value,
  );

  for (const utxo of sortedUnusedUtxos) {
    allUtxosToUse.push(utxo);
    totalValue += utxo.value;

    // Estimate fee with current UTXO count
    const estimatedSize =
      allUtxosToUse.length * ESTIMATED_INPUT_SIZE +
      ESTIMATED_OUTPUT_SIZE +
      TRANSACTION_OVERHEAD;
    const estimatedFee = Math.ceil(estimatedSize * feeRate);

    // Check if we now have enough
    if (totalValue - estimatedFee > DUST_THRESHOLD) {
      break;
    }
  }

  const replacementTx = await buildConsolidatedTransaction(
    allUtxosToUse,
    paymentAddress,
    feeRate,
    paymentPublicKey,
  );

  // For payment-only scenarios with additional UTXOs, all inputs are signed with payment address
  const inputSigningMap = allUtxosToUse.map((_, index) => ({
    index,
    address: paymentAddress,
  }));

  return {
    unsignedPsbt: replacementTx.psbt,
    inputSigningMap,
    totalFee: replacementTx.fee,
  };
};

