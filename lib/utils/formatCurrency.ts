/**
 * Formats a number as currency with configurable locale and currency
 *
 * @param amount - The number to format
 * @param currency - The currency code (default: 'EUR')
 * @param locale - The locale for formatting (default: 'nl-NL')
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56) // "€ 1.234,56"
 * formatCurrency(1234.56, 'EUR', 'nl-NL', false) // "€ 1.235"
 * formatCurrency(1234.56, 'USD', 'en-US') // "$1,234.56"
 * formatCurrency(1234.56, 'USD', 'en-US', false) // "$1,235"
 */
export function formatCurrency(
  amount: number,
  currency: string = 'EUR',
  locale: string = 'nl-NL',
  showDecimals: boolean = true
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Formats a number as currency without decimals
 *
 * @param amount - The number to format
 * @param currency - The currency code (default: 'EUR')
 * @param locale - The locale for formatting (default: 'nl-NL')
 * @returns Formatted currency string without decimals
 *
 * @example
 * formatCurrencyWhole(1234.56) // "€ 1.235"
 * formatCurrencyWhole(1234.56, 'USD', 'en-US') // "$1,235"
 */
export function formatCurrencyWhole(
  amount: number,
  currency: string = 'EUR',
  locale: string = 'nl-NL'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
