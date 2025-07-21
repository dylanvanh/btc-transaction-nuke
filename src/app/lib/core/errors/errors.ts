// Simple error types for transaction cancellation
export class TransactionCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCancellationError";
  }
}

export class ValidationError extends TransactionCancellationError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class InsufficientFundsError extends TransactionCancellationError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class CollateralError extends TransactionCancellationError {
  constructor(message: string) {
    super(message);
    this.name = "CollateralError";
  }
}
