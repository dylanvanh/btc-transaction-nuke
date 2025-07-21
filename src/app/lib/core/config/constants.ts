// Transaction size estimation constants
export const ESTIMATED_INPUT_SIZE = 148; // bytes per input
export const ESTIMATED_OUTPUT_SIZE = 34; // bytes per output
export const TRANSACTION_OVERHEAD = 10; // bytes for transaction overhead
export const DUST_THRESHOLD = 546; // minimum output value in satoshis

// Fee rate constants
export const FEE_RATE_BUMP = 10; // satoshis per vbyte to add to original fee rate
export const FASTEST_FEE_BUMP = 5; // satoshis per vbyte to add to fastest fee rate

// Fee adjustment constants
export const FEE_BUFFER = 2000; // satoshis buffer for fee calculations to ensure sufficient coverage
