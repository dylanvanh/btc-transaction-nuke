import { mempoolClient, UTXO, Transaction } from "../clients/mempool-client";
import {
  ValidationError,
  TransactionCancellationError,
  InsufficientFundsError,
} from "./errors";
import {
  getUserUtxosInTxForBothAddresses,
  createOutpointSet,
  filterUtxosByOutpoints,
  excludeUtxosByOutpoints,
  findLargestUtxo,
  validatePaymentUtxosAreClean,
  findUserUtxosInTransaction,
  findBestOrdinalsUtxo,
  filterCleanUtxos,
} from "./utxo-utils";
import {
  buildConsolidatedTransaction,
  buildOrdinalsTransactionWithSeparateOutputs,
  buildOrdinalsTransactionWithMultiplePaymentInputs,
} from "./transaction-builder";
import { executeStrategies, CancellationStrategy } from "./strategy";
import {
  FEE_RATE_BUMP,
  FASTEST_FEE_BUMP,
  ESTIMATED_INPUT_SIZE,
  ESTIMATED_OUTPUT_SIZE,
  TRANSACTION_OVERHEAD,
  DUST_THRESHOLD,
} from "./constants";

export type UserWalletInfo = {
  paymentAddress: string;
  ordinalsAddress: string;
  ordinalsPublicKey: string;
  paymentPublicKey?: string;
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
  scenario: string;
  inputSigningMap?: Array<{ index: number; address: string }>;
};

const calculateNewFeeRate = async (
  originalTx: Transaction,
): Promise<number> => {
  const originalVsize = Math.ceil(originalTx.weight / 4);
  const originalFeeRate = Math.ceil(originalTx.fee / originalVsize);
  const fastestFee = await mempoolClient.getFastestFee();

  return Math.max(
    originalFeeRate + FEE_RATE_BUMP,
    fastestFee + FASTEST_FEE_BUMP,
  );
};

const validateTransactionIsNotConfirmed = (originalTx: Transaction): void => {
  if (originalTx.status.confirmed) {
    throw new ValidationError("Cannot cancel confirmed transaction");
  }
};

const createCancellationStrategies = (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  paymentAddress: string,
  ordinalsAddress: string,
  newFeeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
  transactionId: string,
): CancellationStrategy<CancelTxResult>[] => {
  const paymentUtxosOnlyStrategy = () =>
    processPaymentUtxos(
      allUserUtxos,
      originalTx,
      paymentAddress,
      newFeeRate,
      paymentPublicKey,
      transactionId,
    );

  const ordinalsUtxosWithPaymentFeesStrategy = () =>
    processOrdinalsUtxos(
      allUserUtxos,
      originalTx,
      ordinalsAddress,
      paymentAddress,
      newFeeRate,
      paymentPublicKey,
      ordinalsPublicKey,
      transactionId,
    );

  // return [paymentUtxosOnlyStrategy, ordinalsUtxosWithPaymentFeesStrategy];
  return [paymentUtxosOnlyStrategy, ordinalsUtxosWithPaymentFeesStrategy];
};

const processPaymentUtxos = async (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  transactionId: string,
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
      transactionId,
    );

  const replaceUsingExistingPlusAdditionalPaymentUtxos = () =>
    createReplacementWithAdditionalPaymentUtxos(
      paymentUtxos,
      paymentAddress,
      feeRate,
      paymentPublicKey,
      transactionId,
    );

  const paymentOnlyStrategies = [
    replaceUsingOnlyExistingPaymentUtxos,
    replaceUsingExistingPlusAdditionalPaymentUtxos,
  ];

  return await executeStrategies(paymentOnlyStrategies);
};

const processOrdinalsUtxos = async (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
  transactionId: string,
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
        transactionId,
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
        transactionId,
      ),
  ];

  return await executeStrategies(ordinalsStrategies);
};

const createReplacementWithExistingPaymentUtxos = async (
  paymentUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  transactionId: string,
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
    success: true,
    message: "Transaction cancelled using payment UTXOs from transaction",
    originalTxId: transactionId,
    userUtxosUsed: paymentUtxos,
    feeRate: feeRate,
    totalFee: replacementTx.fee,
    unsignedPsbt: replacementTx.psbt,
    scenario: "payment-utxos-only",
    inputSigningMap,
  };
};

const createReplacementWithAdditionalPaymentUtxos = async (
  transactionUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  transactionId: string,
): Promise<CancelTxResult> => {
  return await supplementWithAdditionalPaymentUtxos(
    transactionUtxos,
    paymentAddress,
    feeRate,
    paymentPublicKey,
    transactionId,
  );
};

const createOrdinalsReplacementWithSinglePaymentUtxo = async (
  ordinalsUtxo: UTXO,
  availablePaymentUtxos: UTXO[],
  ordinalsAddress: string,
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
  transactionId: string,
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
    success: true,
    message:
      "Transaction cancelled using ordinals UTXO + single payment UTXO for fees",
    originalTxId: transactionId,
    userUtxosUsed: [ordinalsUtxo, singlePaymentUtxo],
    feeRate: feeRate,
    totalFee: replacementTx.fee,
    unsignedPsbt: replacementTx.psbt,
    scenario: "ordinals-with-payment-fee",
    inputSigningMap,
  };
};

const supplementWithAdditionalPaymentUtxos = async (
  transactionUtxos: UTXO[],
  paymentAddress: string,
  feeRate: number,
  paymentPublicKey: string,
  transactionId: string,
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
    success: true,
    message:
      "Transaction cancelled using payment UTXOs + additional wallet UTXOs",
    originalTxId: transactionId,
    userUtxosUsed: allUtxosToUse,
    feeRate: feeRate,
    totalFee: replacementTx.fee,
    unsignedPsbt: replacementTx.psbt,
    scenario: "payment-with-additional",
    inputSigningMap,
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
  transactionId: string,
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
    success: true,
    message:
      "Transaction cancelled using ordinals UTXO + multiple payment UTXOs for fees",
    originalTxId: transactionId,
    userUtxosUsed: [ordinalsUtxo, ...paymentUtxosToUse],
    feeRate: feeRate,
    totalFee: replacementTx.fee,
    unsignedPsbt: replacementTx.psbt,
    scenario: "ordinals-with-multiple-payment",
    inputSigningMap,
  };
};

export const cancelTx = async (
  transactionId: string,
  userWalletInfo: UserWalletInfo,
): Promise<CancelTxResult> => {
  const { paymentAddress, paymentPublicKey, ordinalsAddress, ordinalsPublicKey } = userWalletInfo;

  if (!paymentPublicKey) {
    throw new ValidationError("Payment public key is required");
  }

  const originalTx = await mempoolClient.getTransaction(transactionId);
  validateTransactionIsNotConfirmed(originalTx);

  const allUserUtxos = getUserUtxosInTxForBothAddresses(
    originalTx,
    paymentAddress,
    ordinalsAddress,
  );
  const newFeeRate = await calculateNewFeeRate(originalTx);

  const strategies = createCancellationStrategies(
    allUserUtxos,
    originalTx,
    paymentAddress,
    ordinalsAddress,
    newFeeRate,
    paymentPublicKey,
    ordinalsPublicKey,
    transactionId,
  );

  return await executeStrategies(strategies);
};
