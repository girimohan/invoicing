// Shared TypeScript types for the invoicing application

export interface LineItemInput {
  id: string
  description: string
  earnedAmount: number   // gross amount from Wolt (excl. VAT)
  sharePercent: number   // % of work done by this worker (0-100)
  shareType: 'PERCENT' | 'AMOUNT'  // how the worker share is expressed
  shareAmount: number   // flat € amount per payout (used when shareType = 'AMOUNT')
  vatRate: number
  amountExVat: number    // earnedAmount × sharePercent/100  OR  shareAmount
  vatAmount: number
  totalAmount: number
  sortOrder: number
}

export interface InvoiceInput {
  invoiceNumber: string
  invoiceDate: string        // ISO date string YYYY-MM-DD
  dueDate: string
  paymentTerms: string
  periodStart: string
  periodEnd: string
  woltInvoiceNumber?: string
  woltInvoiceDate?: string

  sellerName: string
  sellerAddress: string
  sellerPostalCode: string
  sellerCity: string
  sellerBusinessId: string   // Y-tunnus, e.g. "1234567-8"
  sellerVatId: string        // ALV-tunnus, e.g. "FI12345678"
  sellerIban: string
  sellerBic: string
  sellerEmail?: string
  sellerPhone?: string

  buyerName: string
  buyerAddress: string
  buyerPostalCode: string
  buyerCity: string
  buyerBusinessId: string
  buyerVatId: string

  totalExVat: number
  totalVat: number
  totalIncVat: number

  notes?: string
  workerId?: number | null
  buyerClientId?: number | null

  lineItems: LineItemInput[]
}

export interface VatBreakdown {
  rate: number    // VAT rate as percentage (25.5, 0, etc.)
  base: number    // Turnover excluding VAT at this rate
  vat: number     // VAT amount at this rate
}

export interface Calculated {
  lineItems: {
    amountExVat: number
    vatAmount: number
    totalAmount: number
  }[]
  totalExVat: number
  totalVat: number
  totalIncVat: number
  vatBreakdown: VatBreakdown[]
}

// Form-level line item (strings for controlled inputs)
export interface LineItemRow {
  id: string
  description: string
  earnedAmount: string   // gross amount from Wolt (excl. VAT)
  sharePercent: string   // % of work done by this worker
  shareType: 'PERCENT' | 'AMOUNT'  // how the worker share is expressed
  shareAmount: string   // flat € amount per payout (used when shareType = 'AMOUNT')
  vatRate: string
}

// Form state (all strings for controlled inputs)
export interface FormState {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  paymentTerms: string
  periodStart: string
  periodEnd: string
  woltInvoiceNumber: string
  woltInvoiceDate: string

  sellerName: string
  sellerAddress: string
  sellerPostalCode: string
  sellerCity: string
  sellerBusinessId: string
  sellerVatId: string
  sellerIban: string
  sellerBic: string
  sellerEmail: string
  sellerPhone: string

  buyerName: string
  buyerAddress: string
  buyerPostalCode: string
  buyerCity: string
  buyerBusinessId: string
  buyerVatId: string

  notes: string
}
