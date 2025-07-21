import { env } from "../../env";
import ApiClient from "./api-client";

export type UTXO = {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
  value: number;
};
export type RecommendedFees = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};
type TransactionPrevout = {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
};
type TransactionVin = {
  txid: string;
  vout: number;
  prevout: TransactionPrevout;
  scriptsig: string;
  scriptsig_asm: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
  inner_redeemscript_asm?: string;
};
type TransactionVout = {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
};
export type Transaction = {
  txid: string;
  version: number;
  locktime: number;
  vin: TransactionVin[];
  vout: TransactionVout[];
  size: number;
  weight: number;
  sigops: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
};

export class MempoolClient extends ApiClient {
  constructor() {
    super(MempoolClient.getBaseUrl());
  }

  private static getBaseUrl(): string {
    return `${env.MEMPOOL_URL}/api`;
  }

  async getFastestFee(): Promise<number> {
    const recommendedFees = await this.getRecommendedFees();
    return recommendedFees.fastestFee;
  }

  async getTransaction(txid: string): Promise<Transaction> {
    return this.api.get(`/tx/${txid}`).then((response) => response.data);
  }

  async getRecommendedFees(): Promise<RecommendedFees> {
    return this.api
      .get("/v1/fees/recommended")
      .then((response) => response.data);
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    return this.api
      .post("/tx", rawTx, {
        headers: {
          "Content-Type": "text/plain",
        },
      })
      .then((response) => response.data);
  }

  async getAddressUtxos(address: string): Promise<UTXO[]> {
    return this.api
      .get(`/address/${address}/utxo`)
      .then((response) => response.data);
  }
}

export const mempoolClient = new MempoolClient();
