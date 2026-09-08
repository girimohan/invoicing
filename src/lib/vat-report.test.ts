import {
  computeAnnualFigures, computeMonths, computePeriods,
  type VatReportSourceData,
} from './vat-report'

// Minimal builders — only the fields the computations actually read.
const income = (month: number, exVat: number, tips = 0, vatRate = 25.5) => ({
  id: `i${month}-${exVat}`,
  periodStart: new Date(2026, month, 1),
  periodEnd: new Date(2026, month, 28),
  description: null,
  woltInvoiceRef: null,
  totalExVat: exVat,
  tipsExVat: tips,
  vatRate,
  vatAmount: Math.round(exVat * (vatRate / 100) * 100) / 100,
  totalIncVat: Math.round((exVat * (1 + vatRate / 100) + tips) * 100) / 100,
  notes: null,
})

const expense = (month: number, exVat: number, vatRate = 25.5) => ({
  id: `e${month}-${exVat}`,
  date: new Date(2026, month, 15),
  description: 'test',
  supplier: null,
  category: 'OTHER',
  amountExVat: exVat,
  vatRate,
  vatAmount: Math.round(exVat * (vatRate / 100) * 100) / 100,
  totalAmount: Math.round(exVat * (1 + vatRate / 100) * 100) / 100,
  receiptRef: null,
})

/** A substitute invoice: Wolt gross `gross`, of which the worker keeps `workerShare`. */
const subInvoice = (month: number, gross: number, workerShare: number, vatRate = 25.5) => ({
  id: `inv${month}-${gross}`,
  invoiceNumber: `BB-${month}`,
  invoiceDate: new Date(2026, month, 20),
  periodEnd: new Date(2026, month, 28),
  sellerName: 'Worker',
  buyerName: 'Owner',
  totalExVat: workerShare,
  totalVat: Math.round(workerShare * (vatRate / 100) * 100) / 100,
  totalIncVat: Math.round(workerShare * (1 + vatRate / 100) * 100) / 100,
  lineItems: [{
    earnedAmount: gross,
    sharePercent: (workerShare / gross) * 100,
    vatRate,
    amountExVat: workerShare,
    vatAmount: Math.round(workerShare * (vatRate / 100) * 100) / 100,
  }],
})

const empty: VatReportSourceData = {
  incomes: [], linkedInvoices: [], sellerInvoices: [],
  expenses: [], bookkeeperInvoices: [], receivedBkInvoices: [],
}

describe('computeAnnualFigures — account holder', () => {
  it('counts own fees plus tips as turnover', () => {
    const f = computeAnnualFigures({ ...empty, incomes: [income(0, 1000, 50), income(1, 500, 20)] }, true)
    expect(f.totalIncomeExVat).toBe(1500)
    expect(f.totalIncomeTips).toBe(70)
    expect(f.incomeExVat).toBe(1570)
  })

  it('counts only the owner cut from substitute work, never the full gross', () => {
    // Wolt paid 1000; the worker was paid 750, so the owner's own turnover is 250.
    const f = computeAnnualFigures({ ...empty, linkedInvoices: [subInvoice(2, 1000, 750)] }, true)
    expect(f.woltGrossFromSubstitutes).toBe(1000)
    expect(f.workerCostExVat).toBe(750)
    expect(f.ownerCutExVat).toBe(250)
    expect(f.incomeExVat).toBe(250)
  })

  it('does not subtract the worker payment twice', () => {
    // The owner cut is already net, so turnover must not become 250 - 750.
    const f = computeAnnualFigures(
      { ...empty, incomes: [income(0, 400)], linkedInvoices: [subInvoice(2, 1000, 750)] },
      true,
    )
    expect(f.incomeExVat).toBe(650)
  })

  it('subtracts expenses to reach cash-basis profit', () => {
    const f = computeAnnualFigures(
      { ...empty, incomes: [income(0, 1000)], expenses: [expense(1, 300), expense(2, 200)] },
      true,
    )
    expect(f.otherExpExVat).toBe(500)
    expect(f.netProfit).toBe(500)
  })
})

describe('computeAnnualFigures — substitute worker', () => {
  it('uses their own outgoing invoices as turnover, ignoring account-holder figures', () => {
    const f = computeAnnualFigures(
      { ...empty, sellerInvoices: [subInvoice(3, 1000, 800)], incomes: [income(0, 999)] },
      false,
    )
    expect(f.sellerIncomeExVat).toBe(800)
    expect(f.incomeExVat).toBe(800)
  })
})

describe('computeAnnualFigures and computeMonths agree', () => {
  it('reconciles annual turnover with the monthly VAT breakdown', () => {
    const data: VatReportSourceData = {
      ...empty,
      incomes: [income(0, 1000, 50), income(4, 2000, 100)],
      expenses: [expense(1, 400)],
    }
    const annual = computeAnnualFigures(data, true)
    const months = computeMonths(data, true)
    const outVat = months.reduce((s, m) => s + m.outVat, 0)
    // Output VAT across the year must equal VAT on the year's own fees.
    expect(Math.round(outVat * 100) / 100).toBe(annual.totalIncomeVat)
    // Turnover includes tips; VAT does not.
    expect(annual.incomeExVat).toBe(3150)
  })

  it('assigns invoices to periods by service period, not invoice date', () => {
    // Service period ends 28 Jun (Q2); the invoice itself is dated 20 Jun.
    const data: VatReportSourceData = { ...empty, linkedInvoices: [subInvoice(5, 1000, 750)] }
    const periods = computePeriods(computeMonths(data, true), 'quarterly', 2026)
    expect(periods[1].outVatSubs).toBeGreaterThan(0)   // Q2 carries it
    expect(periods[2].outVatSubs).toBe(0)              // Q3 does not
  })
})

describe('empty books', () => {
  it('produces zeros rather than NaN', () => {
    const f = computeAnnualFigures(empty, true)
    expect(f.incomeExVat).toBe(0)
    expect(f.netProfit).toBe(0)
    expect(Number.isNaN(f.incomeExVat)).toBe(false)
  })
})
