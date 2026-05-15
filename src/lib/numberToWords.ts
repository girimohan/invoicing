const ones = [
  '',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]

const tens = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety',
]

function threeDigits(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ones[n]
  if (n < 100) {
    const t = tens[Math.floor(n / 10)]
    const o = ones[n % 10]
    return o ? `${t}-${o}` : t
  }
  const hundreds = ones[Math.floor(n / 100)]
  const rest = n % 100
  return rest > 0
    ? `${hundreds} hundred ${threeDigits(rest)}`
    : `${hundreds} hundred`
}

export function numberToWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  const euros = Math.floor(rounded)
  const cents = Math.round((rounded - euros) * 100)

  if (euros === 0 && cents === 0) return 'Zero euros'

  const parts: string[] = []

  const millions = Math.floor(euros / 1_000_000)
  if (millions > 0) {
    parts.push(`${threeDigits(millions)} million`)
  }

  const thousands = Math.floor((euros % 1_000_000) / 1_000)
  if (thousands > 0) {
    parts.push(`${threeDigits(thousands)} thousand`)
  }

  const remainder = euros % 1_000
  if (remainder > 0) {
    parts.push(threeDigits(remainder))
  }

  let result = parts.join(' ')
  result += euros === 1 ? ' euro' : ' euros'

  if (cents > 0) {
    result += ` and ${threeDigits(cents)} ${cents === 1 ? 'cent' : 'cents'}`
  }

  return result.charAt(0).toUpperCase() + result.slice(1)
}
