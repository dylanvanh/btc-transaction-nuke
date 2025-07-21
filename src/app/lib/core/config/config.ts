import * as secp256k1 from "@bitcoinerlab/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import ECPairFactory from "ecpair";

// Initialize the ECC library
bitcoin.initEccLib(secp256k1);

const ECPair = ECPairFactory(secp256k1);

export { bitcoin, ECPair };
