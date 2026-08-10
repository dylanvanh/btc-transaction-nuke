import { env } from "@/app/env";
import { fetchApi } from "./fetch-api";

export type Rune = {
  name: string;
};

export type UTXO = {
  outpoint: string;
  runes: Rune[];
  inscriptions: string[];
};

export const ordiscanClient = {
  async getAddressUTXOs(bitcoinAddress: string): Promise<UTXO[]> {
    const response = await fetchApi(
      `${env.ORDISCAN_URL}/v1/address/${bitcoinAddress}/utxos`,
      {
        headers: {
          Authorization: `Bearer ${env.ORDISCAN_API_KEY}`,
        },
      },
    ).then((apiResponse) => apiResponse.json() as Promise<{ data: UTXO[] }>);

    if (!response.data) {
      throw new Error(
        "Invalid nested API response structure received from Ordiscan.",
      );
    }

    return response.data;
  },
};
