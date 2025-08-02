/**
 * Generates a random decimal number with 6 decimal places
 * @param baseAmount The base amount (e.g., 10 for 10 DUST)
 * @returns The amount with random decimals (e.g., 10.123456)
 */
export function generateRandomAmount(baseAmount: number): string {
  // Generate a random number between 0 and 1 with 6 decimal places
  const randomDecimals = Math.random().toFixed(6);
  
  // Combine the base amount with the random decimals
  const amountWithDecimals = `${baseAmount}.${randomDecimals.split('.')[1]}`;
  
  return amountWithDecimals;
}

/**
 * Validates if an amount string has the correct format (base amount + 6 decimal places)
 * @param amount The amount string to validate
 * @returns boolean indicating if the amount is valid
 */
export function isValidAmountFormat(amount: string): boolean {
  // Check if the amount matches the pattern: number.number with exactly 6 decimal places
  const amountRegex = /^\d+\.\d{6}$/;
  return amountRegex.test(amount);
}

/**
 * Generates a valid random amount with retries
 * @param baseAmount The base amount to use
 * @param maxRetries Maximum number of retries (default: 100)
 * @returns The valid random amount
 * @throws Error if unable to generate valid amount after max retries
 */
export function generateValidRandomAmount(baseAmount: number, maxRetries: number = 100): string {
  for (let i = 0; i < maxRetries; i++) {
    const amount = generateRandomAmount(baseAmount);
    if (isValidAmountFormat(amount)) {
      return amount;
    }
  }
  
  throw new Error(`Failed to generate valid random amount after ${maxRetries} attempts`);
}
