import { UTXO, Transaction } from "../../clients/mempool-client";
import { ordiscanClient } from "../../clients/ordiscan-client";
import {
  ValidationError,
  CollateralError,
  TransactionCancellationError,
} from "../errors/errors";

export const createOutpointSet = (utxos: UTXO[]): Set<string> => {
  return new Set(utxos.map((utxo) => `${utxo.txid}:${utxo.vout}`));
};

export const filterUtxosByOutpoints = (
  utxos: UTXO[],
  outpoints: Set<string>,
): UTXO[] => {
  return utxos.filter((utxo) => {
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    return outpoints.has(outpoint);
  });
};

export const excludeUtxosByOutpoints = (
  utxos: UTXO[],
  outpoints: Set<string>,
): UTXO[] => {
  return utxos.filter((utxo) => {
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    return !outpoints.has(outpoint);
  });
};

export const findUserUtxosInTransaction = (
  transaction: Transaction,
  userAddress: string,
): UTXO[] => {
  const userUtxos: UTXO[] = [];

  for (const input of transaction.vin) {
    const inputAddress = input.prevout.scriptpubkey_address;

    if (inputAddress === userAddress) {
      userUtxos.push({
        txid: input.txid,
        vout: input.vout,
        value: input.prevout.value,
        status: transaction.status,
      });
    }
  }

  return userUtxos;
};

export const findLargestUtxo = (utxos: UTXO[]): UTXO => {
  return utxos.reduce((biggest, current) =>
    current.value > biggest.value ? current : biggest,
  );
};

export const getUserUtxosInTxForBothAddresses = (
  originalTx: Transaction,
  paymentAddress: string,
  ordinalsAddress: string,
): UTXO[] => {
  const userAddresses = new Set([paymentAddress, ordinalsAddress]);
  const allUserUtxos = Array.from(userAddresses).flatMap((address) =>
    findUserUtxosInTransaction(originalTx, address),
  );

  if (allUserUtxos.length === 0) {
    throw new ValidationError(
      "No UTXOs belonging to user found in transaction",
    );
  }

  return allUserUtxos;
};

// Ensure payment utxos don't contain collateral
// Prevent using them towards the fee
export const validatePaymentUtxosAreClean = async (
  utxos: UTXO[],
  userPaymentAddress: string,
): Promise<void> => {
  try {
    let addressUtxos;
    try {
      addressUtxos = await ordiscanClient.getAddressUTXOs(userPaymentAddress);
    } catch (ordiscanError) {
      throw new TransactionCancellationError(
        `Failed to validate UTXOs via Ordiscan: ${ordiscanError instanceof Error ? ordiscanError.message : "Unknown error"}`,
      );
    }

    for (const utxo of utxos) {
      const outpoint = `${utxo.txid}:${utxo.vout}`;

      const ordiscanUtxo = addressUtxos.find((u) => u.outpoint === outpoint);

      if (ordiscanUtxo) {
        if (ordiscanUtxo.inscriptions.length > 0) {
          throw new CollateralError(
            `UTXO ${outpoint} contains inscriptions: ${ordiscanUtxo.inscriptions.join(", ")}. Cannot use for fees as it would break the inscription.`,
          );
        }

        if (ordiscanUtxo.runes.length > 0) {
          const runeNames = ordiscanUtxo.runes.map((r) => r.name).join(", ");
          throw new CollateralError(
            `UTXO ${outpoint} contains runes: ${runeNames}. Cannot use for fees as it would break the rune.`,
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new ValidationError("Failed to validate UTXOs for collateral");
  }
};

// Find the best ordinals UTXO to use - prioritize clean UTXOs without collateral
export const findBestOrdinalsUtxo = async (
  utxos: UTXO[],
  ordinalsAddress: string,
): Promise<UTXO> => {
  if (utxos.length === 0) {
    throw new ValidationError("No UTXOs provided");
  }

  const cleanUtxos = await filterCleanUtxos(utxos, ordinalsAddress);

  // Return first clean UTXO if any found, otherwise fallback to first UTXO
  return cleanUtxos.length > 0 ? cleanUtxos[0] : utxos[0];
};

export const filterCleanUtxos = async (
  utxos: UTXO[],
  address: string,
): Promise<UTXO[]> => {
  if (utxos.length === 0) {
    return [];
  }

  try {
    const addressUtxos = await ordiscanClient.getAddressUTXOs(address);

    const cleanUtxos: UTXO[] = [];

    for (const utxo of utxos) {
      const outpoint = `${utxo.txid}:${utxo.vout}`;
      const ordiscanUtxo = addressUtxos.find((u) => u.outpoint === outpoint);

      // If UTXO not found in ordiscan or has no collateral, it's clean
      if (
        !ordiscanUtxo ||
        (ordiscanUtxo.inscriptions.length === 0 &&
          ordiscanUtxo.runes.length === 0)
      ) {
        cleanUtxos.push(utxo);
      }
    }

    return cleanUtxos;
  } catch (error) {
    throw new Error(
      `Failed to validate UTXOs with ordiscan: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
