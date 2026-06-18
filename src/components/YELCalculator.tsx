'use client'

import { useState, useMemo } from 'react'

// YEL rates — verify annually at https://www.etk.fi/en/working-in-finland/self-employed/yel-insurance/
const YEL_RATE_STANDARD = 0.2510       // ~25.10% (2025 approximate)
const YEL_RATE_NEW_ENTREPRENEUR = 0.19578 // 22% discount applied: 25.10% × 0.78
const YEL_MIN_TYOTULO = 9010.28        // €/year — indexed annually by Eläketurvakeskus
const YEL_MAX_TYOTULO = 204625         // €/year (2024 ceiling, updated annually)
const NEW_ENTREPRENEUR_DISCOUNT_MONTHS = 48 // First 48 months of entrepreneurship

function fmt(n: number) {
  return n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function YELCalculator() {
  const [annualIncome, setAnnualIncome] = useState(20000)
  const [incomeInput, setIncomeInput] = useState('20000')
  const [isNewEntrepreneur, setIsNewEntrepreneur] = useState(false)

  const calc = useMemo(() => {
    const tyotulo = Math.min(Math.max(annualIncome, 0), YEL_MAX_TYOTULO)
    const rate = isNewEntrepreneur ? YEL_RATE_NEW_ENTREPRENEUR : YEL_RATE_STANDARD
    const isMandatory = tyotulo >= YEL_MIN_TYOTULO
    const annualPremium = isMandatory ? tyotulo * rate : 0
    const monthlyPremium = annualPremium / 12
    const savingsWithDiscount = isMandatory
      ? tyotulo * (YEL_RATE_STANDARD - YEL_RATE_NEW_ENTREPRENEUR)
      : 0
    return { tyotulo, rate, isMandatory, annualPremium, monthlyPremium, savingsWithDiscount }
  }, [annualIncome, isNewEntrepreneur])

  function handleIncomeInput(val: string) {
    setIncomeInput(val)
    const parsed = parseFloat(val.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) setAnnualIncome(Math.round(parsed))
  }

  function handleSlider(val: number) {
    setAnnualIncome(val)
    setIncomeInput(String(val))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">YEL Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Yrittäjän eläkevakuutus — estimate mandatory pension insurance cost for a self-employed client.
        </p>
      </div>

      {/* Rate notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
        <span className="font-semibold">Rates shown are approximate for 2025.</span>{' '}
        Verify current rates and minimum työtulo annually at{' '}
        <span className="font-mono">etk.fi</span> (Eläketurvakeskus).
      </div>

      {/* Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Annual income */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated annual YEL income (työtulo) — €/year
          </label>
          <p className="text-xs text-gray-400 mb-3">
            This is the declared "working input value", not necessarily actual net income. Can be set independently.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100000}
              step={500}
              value={annualIncome}
              onChange={e => handleSlider(Number(e.target.value))}
              className="flex-1 h-2 accent-blue-600"
            />
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-36">
              <span className="px-2 py-2 bg-gray-50 text-gray-400 text-sm border-r border-gray-300">€</span>
              <input
                type="text"
                value={incomeInput}
                onChange={e => handleIncomeInput(e.target.value)}
                className="flex-1 px-2 py-2 text-sm text-right outline-none"
                placeholder="e.g. 20000"
              />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
            <span>€0</span>
            <span>€50k</span>
            <span>€100k</span>
          </div>
        </div>

        {/* New entrepreneur toggle */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isNewEntrepreneur}
              onChange={e => setIsNewEntrepreneur(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-blue-600"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">New entrepreneur discount</div>
              <div className="text-xs text-gray-400 mt-0.5">
                22% discount for the first {NEW_ENTREPRENEUR_DISCOUNT_MONTHS} months (4 years) of entrepreneurship.
                Applies automatically — confirm with your YEL insurer.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Result</h2>

        {/* Mandatory check */}
        <div className={`flex items-center gap-3 p-3 rounded-lg mb-5 ${calc.isMandatory ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className={`text-lg ${calc.isMandatory ? 'text-blue-600' : 'text-gray-400'}`}>
            {calc.isMandatory ? '✔' : '—'}
          </div>
          <div>
            {calc.isMandatory ? (
              <span className="text-sm font-semibold text-blue-800">YEL insurance is mandatory</span>
            ) : (
              <span className="text-sm font-semibold text-gray-500">YEL not mandatory at this income</span>
            )}
            <div className="text-xs text-gray-500 mt-0.5">
              Mandatory when annual työtulo ≥ €{fmt(YEL_MIN_TYOTULO)} and working ≥ 4 months/year.
            </div>
          </div>
        </div>

        {calc.isMandatory ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Monthly premium</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">€{fmt(calc.monthlyPremium)}</div>
                <div className="text-xs text-gray-400 mt-0.5">per month</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Annual premium</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">€{fmt(calc.annualPremium)}</div>
                <div className="text-xs text-gray-400 mt-0.5">per year</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 mb-1">YEL työtulo</div>
                <div className="font-semibold text-gray-800">€{fmt(calc.tyotulo)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 mb-1">Rate applied</div>
                <div className="font-semibold text-gray-800">{(calc.rate * 100).toFixed(3)}%</div>
              </div>
              <div className={`rounded-lg p-3 ${isNewEntrepreneur ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-gray-500 mb-1">Discount saving</div>
                <div className={`font-semibold ${isNewEntrepreneur ? 'text-green-700' : 'text-gray-400'}`}>
                  {isNewEntrepreneur ? `€${fmt(calc.savingsWithDiscount)}/yr` : '—'}
                </div>
              </div>
            </div>

            {/* Tax deductibility note */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-xs text-green-800 mt-2">
              <span className="font-semibold">Tax tip:</span> YEL premiums are fully deductible in the client's
              income tax return. Remind them to deduct this in OmaVero under "Yrittäjän eläkevakuutusmaksu".
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            Increase the income above €{fmt(YEL_MIN_TYOTULO)}/year to see the premium calculation.
          </div>
        )}
      </div>

      {/* What YEL affects */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">What YEL työtulo affects</h2>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          {[
            ['Future pension', 'Higher työtulo = higher monthly pension'],
            ['Sick pay (sairauspäiväraha)', 'Based on työtulo via Kela'],
            ['Parental leave pay', 'Maternity/paternity benefits from Kela'],
            ['Unemployment benefit', 'Entrepreneurship protection requires ≥ €13,573/yr'],
            ['Rehabilitation benefit', 'Kela calculations use työtulo'],
            ['Premium cost', 'Higher työtulo = higher monthly cost'],
          ].map(([title, note]) => (
            <div key={title} className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">{title}</div>
              <div className="text-gray-400 mt-0.5">{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
