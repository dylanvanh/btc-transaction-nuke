import { ValidationError, InsufficientFundsError } from "../errors/errors";

export type CancellationStrategy<T> = () => Promise<T>;

export const executeStrategies = async <T>(
  strategies: CancellationStrategy<T>[],
): Promise<T> => {
  const errors: Error[] = [];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      if (
        !(error instanceof ValidationError) &&
        !(error instanceof InsufficientFundsError)
      ) {
        throw error;
      }

      errors.push(error);
    }
  }

  throw new ValidationError(
    `All transaction cancellation strategies failed. Errors: ${errors.map(err => err.message).join("; ")}`
  );
};
