import * as secp256k1 from "@bitcoinerlab/secp256k1";
import * as bitcoin from "bitcoinjs-lib";

// Initialize the ECC library
bitcoin.initEccLib(secp256k1);

export { bitcoin };
