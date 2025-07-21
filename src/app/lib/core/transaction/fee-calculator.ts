import { Transaction } from "../../clients/mempool-client";
import { mempoolClient } from "../../clients/mempool-client";
import { ValidationError } from "../errors/errors";
import {
  FEE_RATE_BUMP,
  FASTEST_FEE_BUMP,
} from "../config/constants";

export const calculateNewFeeRate = async (
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

export const validateTransactionIsNotConfirmed = (originalTx: Transaction): void => {
  if (originalTx.status.confirmed) {
    throw new ValidationError("Cannot cancel confirmed transaction");
  }
};