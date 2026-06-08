export const DEFAULT_CURRENCY = 'LKR'

export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
  const amount = Number(value) || 0
  return `${currency || DEFAULT_CURRENCY} ${amount.toLocaleString('en-LK')}`
}

export const formatCurrencyShort = (value, currency = DEFAULT_CURRENCY) => {
  const amount = Number(value) || 0
  if (Math.abs(amount) >= 1000000) return `${currency || DEFAULT_CURRENCY} ${(amount / 1000000).toFixed(1)}M`
  if (Math.abs(amount) >= 1000) return `${currency || DEFAULT_CURRENCY} ${Math.round(amount / 1000)}K`
  return formatCurrency(amount, currency)
}
