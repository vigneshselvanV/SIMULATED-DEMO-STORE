/**
 * Format price in integer paise to Indian Rupee (INR) representation
 * Example: 149900 paise -> "₹1,499.00"
 */
export function formatPrice(paise, includeDecimals = true) {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0.00';
  }

  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(rupees);
}

/**
 * Format date string into human readable format
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Format compact date
 */
export function formatShortDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
