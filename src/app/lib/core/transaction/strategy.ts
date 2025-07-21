import { ValidationError, InsufficientFundsError } from "../errors/errors";

export type CancellationStrategy<T> = () => Promise<T>;

export const executeStrategies = async <T>(
  strategies: CancellationStrategy<T>[],
): Promise<T> => {
  const errors: Error[] = [];

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];

    try {
      const result = await strategy();
      return result;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof InsufficientFundsError
      ) {
        errors.push(error);
        continue; // Try next strategy
      }
      throw error;
    }
  }

  throw new ValidationError(
    `All transaction cancellation strategies failed. Errors: ${errors.map(err => err.message).join("; ")}`
  );
};
