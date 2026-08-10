// Simple error types for transaction cancellation
export class TransactionCancellationError extends Error {
  name = "TransactionCancellationError";
}

export class ValidationError extends TransactionCancellationError {
  name = "ValidationError";
}

export class InsufficientFundsError extends TransactionCancellationError {
  name = "InsufficientFundsError";
}

export class CollateralError extends TransactionCancellationError {
  name = "CollateralError";
}
