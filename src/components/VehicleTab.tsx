'use client'

import { useState, useEffect } from 'react'

type VehicleType = 'bicycle' | 'ebike' | 'moped' | 'car'

type TripEntry = {
  id: string
  date: string
  startTime: string
  endTime: string
  fromLocation: string
  toLocation: string
  distanceKm: string
  odometerStart: string
  odometerEnd: string
  purpose: string
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bicycle: 'Bicycle',
  ebike: 'E-bike / Cargo bike',
  moped: 'Moped / Scooter',
  car: 'Car / Motorcycle',
}

function genId() { return Math.random().toString(36).slice(2, 10) }

export default function VehicleTab({ clientId, year }: { clientId: number; year: number }) {
  const vTypeKey = `vehicle_type_${clientId}`
  const commuteKey = `vehicle_commute_${clientId}`
  const tripsKey = `vehicle_trips_${clientId}_${year}`

  const [vehicleType, setVehicleType] = useState<VehicleType>('bicycle')
  const [commutesByBike, setCommutesByBike] = useState(false)
  const [trips, setTrips] = useState<TripEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const [showAddTrip, setShowAddTrip] = useState(false)

  const emptyForm: Omit<TripEntry, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    startTime: '', endTime: '',
    fromLocation: '', toLocation: '',
    distanceKm: '', odometerStart: '', odometerEnd: '',
    purpose: 'Wolt delivery',
  }
  const [tripForm, setTripForm] = useState(emptyForm)

  // Load from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setVehicleType((localStorage.getItem(vTypeKey) as VehicleType) ?? 'bicycle')
    setCommutesByBike(localStorage.getItem(commuteKey) === 'true')
    try { setTrips(JSON.parse(localStorage.getItem(tripsKey) ?? '[]')) } catch { setTrips([]) }
    setMounted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year])

  // Persist on change
  useEffect(() => { if (mounted) localStorage.setItem(vTypeKey, vehicleType) }, [vehicleType, vTypeKey, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(commuteKey, String(commutesByBike)) }, [commutesByBike, commuteKey, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(tripsKey, JSON.stringify(trips)) }, [trips, tripsKey, mounted])

  function handleVehicleChange(v: VehicleType) {
    setVehicleType(v)
    setShowAddTrip(false)
  }

  function addTrip() {
    if (!tripForm.date || !tripForm.distanceKm || !tripForm.fromLocation || !tripForm.toLocation) return
    setTrips(prev =>
      [...prev, { id: genId(), ...tripForm }].sort((a, b) => a.date.localeCompare(b.date))
    )
    setShowAddTrip(false)
    setTripForm(emptyForm)
  }

  const totalKm = trips.reduce((s, t) => s + (parseFloat(t.distanceKm) || 0), 0)
  const isBike = vehicleType === 'bicycle' || vehicleType === 'ebike'

  if (!mounted) return null

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-1">Vehicle & Mileage — {year}</h3>
        <p className="text-[10px] text-gray-400">
          Track business travel deductions. Rules differ significantly by vehicle type.
        </p>
      </div>

      {/* Vehicle selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-3">Vehicle used for deliveries</div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(VEHICLE_LABELS) as [VehicleType, string][]).map(([type, label]) => (
            <button key={type} onClick={() => handleVehicleChange(type)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                vehicleType === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BICYCLE / E-BIKE ── */}
      {isBike && (
        <div className="space-y-4">
          {/* Commute flat deduction */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs font-semibold text-gray-700 mb-3">Personal Commute Deduction (Työmatkakulut)</div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={commutesByBike}
                onChange={e => setCommutesByBike(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600" />
              <div>
                <div className="text-sm font-medium text-gray-700">This client commutes to work by bicycle/e-bike</div>
                <div className="text-xs text-gray-400 mt-0.5">Home → first pickup zone / delivery area → home</div>
              </div>
            </label>

            {commutesByBike && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-green-800">2025 bicycle commute deduction — flat rate</div>
                  <div className="text-xl font-bold text-green-700">€100 / year</div>
                </div>
                <div className="text-[10px] text-green-700 space-y-1">
                  <div>→ No km tracking needed. Applies regardless of distance.</div>
                  <div>→ Claim on <strong>personal tax return</strong>: OmaVero → Tulot &amp; vähennykset → Matkakulut → Polkupyörä</div>
                  <div>→ Subject to €750 annual deductible — only excess is refunded. At €100, it rarely produces a refund on its own.</div>
                </div>
              </div>
            )}
          </div>

          {/* Actual bike costs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs font-semibold text-gray-700 mb-1">Business Delivery Costs</div>
            <p className="text-xs text-gray-500 mb-4">
              For bicycle/e-bike deliveries there is <strong>no per-km deduction rate</strong>.
              Instead, deduct actual costs as business expenses in the <em>Expenses</em> tab.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { cat: 'VEHICLE', text: 'Bike / e-bike purchase', note: '≤€1 200 → deduct in full same year; >€1 200 → depreciate 25%/yr' },
                { cat: 'VEHICLE', text: 'Repairs, maintenance, spare parts', note: 'Deductible as VEHICLE expense' },
                { cat: 'VEHICLE', text: 'Lock, lights, panniers, cargo racks', note: 'Accessories used for work — fully deductible' },
                { cat: 'VEHICLE', text: 'Battery & charger (e-bike)', note: 'Deductible as VEHICLE expense' },
                { cat: 'MATERIALS', text: 'Electricity for charging', note: 'Deductible as MATERIALS expense' },
                { cat: 'EQUIPMENT', text: 'Phone holder, safety vest, helmet', note: 'Deductible as EQUIPMENT expense' },
              ].map((row, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="font-medium text-gray-700">{row.text}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{row.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded p-2.5">
              Source: Vero.fi — bike/e-bike and accessories are deductible business expenses.
              Pienhankinta (minor acquisition) threshold: ≤€1 200 → full deduction in year of purchase.
            </div>
          </div>
        </div>
      )}

      {/* ── CAR / MOPED — Ajopäiväkirja ── */}
      {!isBike && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Business km logged</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{totalKm.toFixed(0)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Trips logged</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{trips.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Commute rate (personal return)</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{vehicleType === 'car' ? '€0.27' : '€0.13'}/km</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <strong>Deduction method:</strong> Add actual vehicle costs (fuel, insurance, maintenance, depreciation) as{' '}
            <em>VEHICLE</em> expenses in the Expenses tab. The trip log below proves the business-use percentage.
            If &gt;50% of total km are business → full actual costs deductible.
            If ≤50% → deduct only the business proportion of actual costs.
          </div>

          {/* Ajopäiväkirja table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-700">Ajopäiväkirja — Trip Log {year}</div>
                <div className="text-[10px] text-gray-400">Required by Vero.fi for car/moped business deductions</div>
              </div>
              <button onClick={() => setShowAddTrip(!showAddTrip)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium">
                + Add Trip
              </button>
            </div>

            {showAddTrip && (
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Date *</label>
                    <input type="date" value={tripForm.date}
                      onChange={e => setTripForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Start time</label>
                    <input type="time" value={tripForm.startTime}
                      onChange={e => setTripForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">End time</label>
                    <input type="time" value={tripForm.endTime}
                      onChange={e => setTripForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">From *</label>
                    <input type="text" value={tripForm.fromLocation}
                      placeholder="e.g. Restaurant name / home base"
                      onChange={e => setTripForm(f => ({ ...f, fromLocation: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">To *</label>
                    <input type="text" value={tripForm.toLocation}
                      placeholder="e.g. Customer address / delivery zone"
                      onChange={e => setTripForm(f => ({ ...f, toLocation: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Distance (km) *</label>
                    <input type="number" value={tripForm.distanceKm}
                      placeholder="e.g. 3.5" step="0.1" min="0"
                      onChange={e => setTripForm(f => ({ ...f, distanceKm: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Odometer start (km)</label>
                    <input type="number" value={tripForm.odometerStart} placeholder="optional"
                      onChange={e => setTripForm(f => ({ ...f, odometerStart: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Odometer end (km)</label>
                    <input type="number" value={tripForm.odometerEnd} placeholder="optional"
                      onChange={e => setTripForm(f => ({ ...f, odometerEnd: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Purpose</label>
                  <input type="text" value={tripForm.purpose}
                    placeholder="e.g. Wolt delivery, restaurant → customer address"
                    onChange={e => setTripForm(f => ({ ...f, purpose: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addTrip}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium">
                    Save Trip
                  </button>
                  <button onClick={() => setShowAddTrip(false)}
                    className="px-4 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs rounded-lg font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {trips.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-400 italic">
                No trips logged for {year}. Click "+ Add Trip" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">From → To</th>
                      <th className="px-3 py-2 text-right font-medium">km</th>
                      <th className="px-3 py-2 text-left font-medium">Purpose</th>
                      <th className="px-3 py-2 text-right font-medium">Odometer</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trips.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">
                          {new Date(t.date + 'T12:00:00').toLocaleDateString('fi-FI')}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {t.startTime || '—'}{t.endTime ? `–${t.endTime}` : ''}
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-[180px]">
                          <div className="truncate">{t.fromLocation} → {t.toLocation}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                          {parseFloat(t.distanceKm).toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[140px]">
                          <div className="truncate">{t.purpose || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400 font-mono text-[10px]">
                          {t.odometerStart && t.odometerEnd
                            ? `${t.odometerStart}→${t.odometerEnd}`
                            : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => setTrips(p => p.filter(x => x.id !== t.id))}
                            className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-xs text-gray-600">
                        Total — {trips.length} trip{trips.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{totalKm.toFixed(1)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
