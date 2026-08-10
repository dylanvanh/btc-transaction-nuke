import { env } from "../../env";
import { fetchApi } from "./fetch-api";

const MEMPOOL_API_URL = `${env.MEMPOOL_URL}/api`;

export type UTXO = {
  txid: string;
  vout: number;
  value: number;
};
type TransactionPrevout = {
  scriptpubkey_address: string;
  value: number;
};
type TransactionVin = {
  txid: string;
  vout: number;
  prevout: TransactionPrevout;
};
export type Transaction = {
  vin: TransactionVin[];
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
  };
};

export const mempoolClient = {
  async getFastestFee(): Promise<number> {
    const { fastestFee } = await fetchApi(
      `${MEMPOOL_API_URL}/v1/fees/recommended`,
    ).then(
      (response) => response.json() as Promise<{ fastestFee: number }>,
    );

    return fastestFee;
  },

  async getTransaction(txid: string): Promise<Transaction> {
    return fetchApi(`${MEMPOOL_API_URL}/tx/${txid}`).then(
      (response) => response.json() as Promise<Transaction>,
    );
  },

  async broadcastTransaction(rawTx: string): Promise<string> {
    return fetchApi(`${MEMPOOL_API_URL}/tx`, {
      method: "POST",
      body: rawTx,
      headers: {
        "Content-Type": "text/plain",
      },
    }).then((response) => response.text());
  },

  async getAddressUtxos(address: string): Promise<UTXO[]> {
    return fetchApi(`${MEMPOOL_API_URL}/address/${address}/utxo`).then(
      (response) => response.json() as Promise<UTXO[]>,
    );
  },
};
