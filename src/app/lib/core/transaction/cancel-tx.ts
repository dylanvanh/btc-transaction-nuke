import { mempoolClient, Transaction, UTXO } from "../../clients/mempool-client";
import { ValidationError } from "../errors/errors";
import { getUserUtxosInTxForBothAddresses } from "../utxo/utxo-utils";
import { executeStrategies, CancellationStrategy } from "./strategy";
import {
  calculateNewFeeRate,
  validateTransactionIsNotConfirmed,
} from "./fee-calculator";
import { processPaymentUtxos } from "./strategies/payment-strategy";
import { processOrdinalsUtxos } from "./strategies/ordinals-strategy";

export type UserWalletInfo = {
  paymentAddress: string;
  ordinalsAddress: string;
  ordinalsPublicKey: string;
  paymentPublicKey?: string;
};

export type CancelTxResult = {
  unsignedPsbt: string;
  inputSigningMap: Array<{ index: number; address: string }>;
  totalFee: number;
};

const createCancellationStrategies = (
  allUserUtxos: UTXO[],
  originalTx: Transaction,
  paymentAddress: string,
  ordinalsAddress: string,
  newFeeRate: number,
  paymentPublicKey: string,
  ordinalsPublicKey: string,
): CancellationStrategy<CancelTxResult>[] => {
  const paymentUtxosOnlyStrategy = () =>
    processPaymentUtxos(
      allUserUtxos,
      originalTx,
      paymentAddress,
      newFeeRate,
      paymentPublicKey,
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
    );

  return [paymentUtxosOnlyStrategy, ordinalsUtxosWithPaymentFeesStrategy];
};

export const cancelTx = async (
  transactionId: string,
  userWalletInfo: UserWalletInfo,
): Promise<CancelTxResult> => {
  const {
    paymentAddress,
    paymentPublicKey,
    ordinalsAddress,
    ordinalsPublicKey,
  } = userWalletInfo;

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
  );

  return await executeStrategies(strategies);
};
