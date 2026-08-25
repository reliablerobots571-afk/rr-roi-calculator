'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BUY_PRICE_ANCHOR,
  calculateBreakEven,
  calculateMonthlyLabourCost,
  calculateReadinessScore,
  calculateTenYearData,
  CalculationMethod,
  CleaningFrequency,
  DEFAULT_HOURLY_WAGE,
  FacilityRecommendation,
  HandlerRecommendation,
  laborHoursEquivalent,
  MAINTENANCE_COST,
  MaintenanceTier,
  RAAS_MONTHLY_ANCHOR,
  recommendFacilityRobot,
  recommendHandlerRobot,
  RobotCategory,
  savingsAtYear,
} from '@/lib/calculations'

const GREEN = '#00BF63'
const NAVY = '#0A1628'
const RED = '#EF4444'
const AMBER = '#F59E0B'

const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BORDER = 'rgba(255,255,255,0.08)'
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)'

const currency = (value: number, decimals = 0) =>
  value.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const METHOD_TITLES: Record<CalculationMethod, string> = {
  hours: 'I know my monthly hours',
  team: 'I know my team size',
  sqft: 'I know my square footage',
  monthly: 'I know my monthly cost',
}

const METHOD_LETTERS: Record<CalculationMethod, string> = {
  hours: 'A',
  team: 'B',
  sqft: 'C',
  monthly: 'D',
}

type Intent = 'raas' | 'quote' | 'report-only'
type Direction = 'forward' | 'back'

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function Home() {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<Direction>('forward')

  const [method, setMethod] = useState<CalculationMethod | null>(null)

  const [monthlyHours, setMonthlyHours] = useState('')
  const [hourlyWageHours, setHourlyWageHours] = useState(String(DEFAULT_HOURLY_WAGE))

  const [teamSize, setTeamSize] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('40')
  const [hourlyWageTeam, setHourlyWageTeam] = useState(String(DEFAULT_HOURLY_WAGE))

  const [sqft, setSqft] = useState('')
  const [costPerSqft, setCostPerSqft] = useState('')

  const [monthlyCostInput, setMonthlyCostInput] = useState('')

  const [inflationRate, setInflationRate] = useState(3.5)

  const [taskType, setTaskType] = useState<RobotCategory>('facility')

  const [facilitySqft, setFacilitySqft] = useState('')
  const [cleaningFrequency, setCleaningFrequency] = useState<CleaningFrequency>('weekly')

  const [payloadKg, setPayloadKg] = useState('')
  const [tripsPerDay, setTripsPerDay] = useState('')
  const [avgTripLength, setAvgTripLength] = useState('')
  const [workHoursPerShift, setWorkHoursPerShift] = useState('8')
  const [shiftsCount, setShiftsCount] = useState('1')
  const [avgSpeed, setAvgSpeed] = useState(1)

  const [maintenanceTier, setMaintenanceTier] = useState<MaintenanceTier>('standard')

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [intent, setIntent] = useState<Intent>('raas')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function goTo(n: number, dir: Direction) {
    setDirection(dir)
    setStep(n)
  }

  function selectMethod(m: CalculationMethod) {
    setMethod(m)
    goTo(2, 'forward')
  }

  const monthlyLabourCost = (() => {
    if (!method) return 0

    if (method === 'hours') {
      const hours = parseFloat(monthlyHours)
      const wage = parseFloat(hourlyWageHours)
      if (!hours || !wage) return 0
      return calculateMonthlyLabourCost('hours', { monthlyHours: hours, hourlyWage: wage })
    }

    if (method === 'team') {
      const size = parseFloat(teamSize)
      const hpw = parseFloat(hoursPerWeek)
      const wage = parseFloat(hourlyWageTeam)
      if (!size || !hpw || !wage) return 0
      return calculateMonthlyLabourCost('team', {
        teamSize: size,
        hoursPerWeek: hpw,
        hourlyWage: wage,
      })
    }

    if (method === 'sqft') {
      const sq = parseFloat(sqft)
      const cost = parseFloat(costPerSqft)
      if (!sq || !cost) return 0
      return calculateMonthlyLabourCost('sqft', { sqft: sq, costPerSqft: cost })
    }

    if (method === 'monthly') {
      const cost = parseFloat(monthlyCostInput)
      if (!cost) return 0
      return calculateMonthlyLabourCost('monthly', { monthlyCost: cost })
    }

    return 0
  })()

  const hasResult = monthlyLabourCost > 0

  const facilityRecommendation: FacilityRecommendation | null =
    taskType === 'facility'
      ? recommendFacilityRobot(parseFloat(facilitySqft) || 0, cleaningFrequency)
      : null

  const handlerRecommendation: HandlerRecommendation | null =
    taskType === 'handler'
      ? recommendHandlerRobot({
          payloadKg: parseFloat(payloadKg) || 0,
          tripsPerDay: parseFloat(tripsPerDay) || 0,
          avgTripLengthMeters: parseFloat(avgTripLength) || 0,
          workHoursPerShift: parseFloat(workHoursPerShift) || 0,
          shifts: parseFloat(shiftsCount) || 0,
          avgSpeedMps: avgSpeed,
        })
      : null

  const hasRecommendationInput =
    taskType === 'facility' ? parseFloat(facilitySqft) > 0 : parseFloat(payloadKg) > 0

  const recommendedModel = facilityRecommendation?.model ?? handlerRecommendation?.model ?? null
  const recommendedUnits = facilityRecommendation?.units ?? handlerRecommendation?.units ?? 0

  // Only price/size off a real recommendation — not the CC1-equivalent
  // count kept for reference when the facility actually needs MT1 sizing.
  const hasConfidentRecommendation = hasRecommendationInput && recommendedModel !== null

  // Graph math needs one concrete number. RR doesn't disclose per-model buy
  // pricing — "T300 from $24,000 CAD, all robots available" is the real,
  // universal anchor they quote, so that's what drives the 10-year estimate.
  const robotPrice = hasConfidentRecommendation ? BUY_PRICE_ANCHOR * recommendedUnits : 0
  const annualMaintenance = MAINTENANCE_COST[maintenanceTier]

  const tenYearData = hasResult
    ? calculateTenYearData(monthlyLabourCost, inflationRate, robotPrice, annualMaintenance)
    : []

  const breakEvenYear = calculateBreakEven(tenYearData)

  const oneYearSavings = savingsAtYear(tenYearData, 1)
  const fiveYearSavings = savingsAtYear(tenYearData, 5)

  const hoursEquivalent = hasConfidentRecommendation ? laborHoursEquivalent(recommendedUnits) : null

  const totalLabourCost = tenYearData.length
    ? tenYearData[tenYearData.length - 1].labourCumulative
    : 0
  const totalRobotCost = tenYearData.length
    ? tenYearData[tenYearData.length - 1].robotCumulative
    : 0
  const tenYearSavings = totalLabourCost - totalRobotCost

  const readiness = calculateReadinessScore(monthlyLabourCost, tenYearSavings)

  const chartData = tenYearData.map((d) => ({
    name: `Year ${d.year}`,
    labour: Math.round(d.labourCumulative),
    robot: Math.round(d.robotCumulative),
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          email,
          company,
          intent,
          monthlyLabourCost,
          tenYearSavings,
          breakEvenYear,
          robotCategory: taskType,
          robotModel: recommendedModel,
          robotUnits: recommendedUnits,
          robotPrice,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Something went wrong')
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={{ backgroundColor: NAVY }} className="min-h-screen">
      <style>{`
        @keyframes rrSlideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes rrSlideInLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes rrFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rrFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rrDrawCheck {
          from { stroke-dashoffset: 64; }
          to { stroke-dashoffset: 0; }
        }
        .rr-anim-forward { animation: rrSlideInRight 280ms ease-out; }
        .rr-anim-back { animation: rrSlideInLeft 280ms ease-out; }
        .rr-anim-fade { animation: rrFadeIn 200ms ease-out; }
        .rr-anim-fade-up { animation: rrFadeUp 400ms ease-out; }

        .rr-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
        }
        .rr-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${GREEN};
          cursor: pointer;
        }
        .rr-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${GREEN};
          cursor: pointer;
        }
        .rr-slider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: transparent;
        }
      `}</style>

      {/* HERO */}
      <section
        className="text-center py-20 px-6 md:px-20"
        style={{ backgroundColor: NAVY, borderBottom: `4px solid ${GREEN}` }}
      >
        <div className="max-w-4xl mx-auto">
          <p
            className="text-sm font-semibold tracking-widest uppercase mb-6"
            style={{ color: GREEN }}
          >
            Free Tool — Reliable Robots
          </p>
          <h1 className="font-heading text-white text-4xl md:text-[56px] leading-tight mb-6">
            Find out how much your labour is really costing you.
          </h1>
          <p className="text-lg" style={{ color: TEXT_SECONDARY }}>
            Takes 2 minutes. We email you the full report.
          </p>
        </div>
      </section>

      {/* PROGRESS BAR */}
      <div
        className="sticky top-0 z-20"
        style={{
          backgroundColor: 'rgba(10,22,40,0.9)',
          borderBottom: `1px solid ${CARD_BORDER}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="flex-1 h-1.5 rounded-full transition-colors"
                style={{ backgroundColor: n <= step ? GREEN : 'rgba(255,255,255,0.15)' }}
              />
            ))}
          </div>
          <p className="text-xs" style={{ color: TEXT_SECONDARY }}>
            Step {step} of 5
          </p>
        </div>
      </div>

      {/* WIZARD */}
      <div className="px-6 md:px-10 py-16">
        <div className="max-w-4xl mx-auto">
          {step > 1 && (
            <div className="max-w-[640px] mx-auto flex flex-col gap-2 mb-8">
              {method && (
                <SummaryLine onClick={() => goTo(1, 'back')}>
                  {METHOD_TITLES[method]}
                </SummaryLine>
              )}
              {step > 2 && hasResult && (
                <SummaryLine onClick={() => goTo(2, 'back')}>
                  Estimated cost: {currency(monthlyLabourCost, 2)}/mo
                </SummaryLine>
              )}
              {step > 3 && (
                <SummaryLine onClick={() => goTo(3, 'back')}>
                  {inflationRate}% inflation ·{' '}
                  {hasConfidentRecommendation
                    ? `${recommendedUnits}x ${recommendedModel}`
                    : hasRecommendationInput
                      ? 'Needs MT1 sizing'
                      : 'No robot selected'}{' '}
                  · {maintenanceTier === 'standard' ? 'Standard' : 'Heavy duty'} maintenance
                </SummaryLine>
              )}
              {step > 4 && (
                <SummaryLine onClick={() => goTo(4, 'back')}>
                  10-year savings: {currency(tenYearSavings)}
                </SummaryLine>
              )}
            </div>
          )}

          <div className="overflow-hidden">
            <div key={step} className={direction === 'forward' ? 'rr-anim-forward' : 'rr-anim-back'}>
              {step === 1 && <Step1 onSelect={selectMethod} />}

              {step === 2 && method && (
                <Step2
                  method={method}
                  onBack={() => goTo(1, 'back')}
                  onNext={() => goTo(3, 'forward')}
                  hasResult={hasResult}
                  monthlyLabourCost={monthlyLabourCost}
                  monthlyHours={monthlyHours}
                  setMonthlyHours={setMonthlyHours}
                  hourlyWageHours={hourlyWageHours}
                  setHourlyWageHours={setHourlyWageHours}
                  teamSize={teamSize}
                  setTeamSize={setTeamSize}
                  hoursPerWeek={hoursPerWeek}
                  setHoursPerWeek={setHoursPerWeek}
                  hourlyWageTeam={hourlyWageTeam}
                  setHourlyWageTeam={setHourlyWageTeam}
                  sqft={sqft}
                  setSqft={setSqft}
                  costPerSqft={costPerSqft}
                  setCostPerSqft={setCostPerSqft}
                  monthlyCostInput={monthlyCostInput}
                  setMonthlyCostInput={setMonthlyCostInput}
                />
              )}

              {step === 3 && (
                <Step3
                  onBack={() => goTo(2, 'back')}
                  onNext={() => goTo(4, 'forward')}
                  inflationRate={inflationRate}
                  setInflationRate={setInflationRate}
                  taskType={taskType}
                  setTaskType={setTaskType}
                  facilitySqft={facilitySqft}
                  setFacilitySqft={setFacilitySqft}
                  cleaningFrequency={cleaningFrequency}
                  setCleaningFrequency={setCleaningFrequency}
                  payloadKg={payloadKg}
                  setPayloadKg={setPayloadKg}
                  tripsPerDay={tripsPerDay}
                  setTripsPerDay={setTripsPerDay}
                  avgTripLength={avgTripLength}
                  setAvgTripLength={setAvgTripLength}
                  workHoursPerShift={workHoursPerShift}
                  setWorkHoursPerShift={setWorkHoursPerShift}
                  shiftsCount={shiftsCount}
                  setShiftsCount={setShiftsCount}
                  avgSpeed={avgSpeed}
                  setAvgSpeed={setAvgSpeed}
                  hasRecommendationInput={hasRecommendationInput}
                  facilityRecommendation={facilityRecommendation}
                  handlerRecommendation={handlerRecommendation}
                  maintenanceTier={maintenanceTier}
                  setMaintenanceTier={setMaintenanceTier}
                />
              )}

              {step === 4 && (
                <Step4
                  onBack={() => goTo(3, 'back')}
                  onNext={() => goTo(5, 'forward')}
                  monthlyLabourCost={monthlyLabourCost}
                  oneYearSavings={oneYearSavings}
                  fiveYearSavings={fiveYearSavings}
                  tenYearSavings={tenYearSavings}
                  breakEvenYear={breakEvenYear}
                  chartData={chartData}
                  readiness={readiness}
                  hoursEquivalent={hoursEquivalent}
                />
              )}

              {step === 5 && (
                <Step5
                  onBack={() => goTo(4, 'back')}
                  monthlyLabourCost={monthlyLabourCost}
                  tenYearSavings={tenYearSavings}
                  breakEvenYear={breakEvenYear}
                  firstName={firstName}
                  setFirstName={setFirstName}
                  email={email}
                  setEmail={setEmail}
                  company={company}
                  setCompany={setCompany}
                  intent={intent}
                  setIntent={setIntent}
                  submitting={submitting}
                  submitted={submitted}
                  submitError={submitError}
                  onSubmit={handleSubmit}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/* ---------------------------------- Step 1 --------------------------------- */

function Step1({ onSelect }: { onSelect: (m: CalculationMethod) => void }) {
  return (
    <div className="max-w-[640px] mx-auto">
      <h2 className="font-heading text-white text-3xl mb-3">How do you know your labour costs?</h2>
      <p className="mb-10" style={{ color: TEXT_SECONDARY }}>
        Pick the option closest to how you think about it.
      </p>

      <div className="flex flex-col gap-4">
        {(Object.keys(METHOD_TITLES) as CalculationMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className="w-full h-[72px] flex items-center justify-between rounded-xl px-5 border border-white/10 bg-white/[0.04] hover:border-[#00BF63] hover:bg-[#00BF63]/[0.06] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-4">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ backgroundColor: GREEN }}
              >
                {METHOD_LETTERS[m]}
              </span>
              <span className="text-white text-base font-medium text-left">{METHOD_TITLES[m]}</span>
            </span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 15L12.5 10L7.5 5"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------- Step 2 --------------------------------- */

function Step2(props: {
  method: CalculationMethod
  onBack: () => void
  onNext: () => void
  hasResult: boolean
  monthlyLabourCost: number
  monthlyHours: string
  setMonthlyHours: (v: string) => void
  hourlyWageHours: string
  setHourlyWageHours: (v: string) => void
  teamSize: string
  setTeamSize: (v: string) => void
  hoursPerWeek: string
  setHoursPerWeek: (v: string) => void
  hourlyWageTeam: string
  setHourlyWageTeam: (v: string) => void
  sqft: string
  setSqft: (v: string) => void
  costPerSqft: string
  setCostPerSqft: (v: string) => void
  monthlyCostInput: string
  setMonthlyCostInput: (v: string) => void
}) {
  const {
    method,
    onBack,
    onNext,
    hasResult,
    monthlyLabourCost,
    monthlyHours,
    setMonthlyHours,
    hourlyWageHours,
    setHourlyWageHours,
    teamSize,
    setTeamSize,
    hoursPerWeek,
    setHoursPerWeek,
    hourlyWageTeam,
    setHourlyWageTeam,
    sqft,
    setSqft,
    costPerSqft,
    setCostPerSqft,
    monthlyCostInput,
    setMonthlyCostInput,
  } = props

  const animated = useCountUp(monthlyLabourCost, 800)

  return (
    <div className="max-w-[640px] mx-auto">
      <BackLink onClick={onBack} />

      <h2 className="font-heading text-white text-3xl mb-3">{METHOD_TITLES[method]}</h2>
      <p className="mb-10" style={{ color: TEXT_SECONDARY }}>
        Fill in what you know. We handle the math.
      </p>

      <div className="flex flex-col gap-6">
        {method === 'hours' && (
          <>
            <DarkField
              label="Monthly labour hours"
              type="number"
              placeholder="e.g. 160"
              value={monthlyHours}
              onChange={setMonthlyHours}
              autoFocus
            />
            <DarkField
              label="Hourly wage CAD$"
              type="number"
              value={hourlyWageHours}
              onChange={setHourlyWageHours}
            />
          </>
        )}

        {method === 'team' && (
          <>
            <DarkField
              label="Number of team members"
              type="number"
              placeholder="e.g. 3"
              value={teamSize}
              onChange={setTeamSize}
              autoFocus
            />
            <DarkField
              label="Hours per week per person"
              type="number"
              value={hoursPerWeek}
              onChange={setHoursPerWeek}
            />
            <DarkField
              label="Hourly wage CAD$"
              type="number"
              value={hourlyWageTeam}
              onChange={setHourlyWageTeam}
            />
          </>
        )}

        {method === 'sqft' && (
          <>
            <DarkField
              label="Square footage"
              type="number"
              placeholder="e.g. 5000"
              value={sqft}
              onChange={setSqft}
              autoFocus
            />
            <DarkField
              label="Cost per sq ft per month CAD$"
              type="number"
              placeholder="e.g. 0.15"
              value={costPerSqft}
              onChange={setCostPerSqft}
            />
          </>
        )}

        {method === 'monthly' && (
          <DarkField
            label="Monthly cost for this task CAD$"
            type="number"
            placeholder="e.g. 3200"
            value={monthlyCostInput}
            onChange={setMonthlyCostInput}
            autoFocus
          />
        )}
      </div>

      {hasResult && (
        <div
          className="mt-8 text-center"
          style={{
            backgroundColor: 'rgba(0,191,99,0.1)',
            border: '1px solid rgba(0,191,99,0.3)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: GREEN }}>
            Your estimated monthly labour cost
          </p>
          <p className="font-heading text-white font-bold text-5xl">{currency(animated, 0)}</p>
        </div>
      )}

      {hasResult && (
        <button
          type="button"
          onClick={onNext}
          className="mt-6 w-full font-heading text-white transition-colors"
          style={{ height: 56, backgroundColor: GREEN, borderRadius: 10, fontSize: 16 }}
        >
          Next: Adjust assumptions →
        </button>
      )}
    </div>
  )
}

/* ---------------------------------- Step 3 --------------------------------- */

function Step3({
  onBack,
  onNext,
  inflationRate,
  setInflationRate,
  taskType,
  setTaskType,
  facilitySqft,
  setFacilitySqft,
  cleaningFrequency,
  setCleaningFrequency,
  payloadKg,
  setPayloadKg,
  tripsPerDay,
  setTripsPerDay,
  avgTripLength,
  setAvgTripLength,
  workHoursPerShift,
  setWorkHoursPerShift,
  shiftsCount,
  setShiftsCount,
  avgSpeed,
  setAvgSpeed,
  hasRecommendationInput,
  facilityRecommendation,
  handlerRecommendation,
  maintenanceTier,
  setMaintenanceTier,
}: {
  onBack: () => void
  onNext: () => void
  inflationRate: number
  setInflationRate: (v: number) => void
  taskType: RobotCategory
  setTaskType: (v: RobotCategory) => void
  facilitySqft: string
  setFacilitySqft: (v: string) => void
  cleaningFrequency: CleaningFrequency
  setCleaningFrequency: (v: CleaningFrequency) => void
  payloadKg: string
  setPayloadKg: (v: string) => void
  tripsPerDay: string
  setTripsPerDay: (v: string) => void
  avgTripLength: string
  setAvgTripLength: (v: string) => void
  workHoursPerShift: string
  setWorkHoursPerShift: (v: string) => void
  shiftsCount: string
  setShiftsCount: (v: string) => void
  avgSpeed: number
  setAvgSpeed: (v: number) => void
  hasRecommendationInput: boolean
  facilityRecommendation: FacilityRecommendation | null
  handlerRecommendation: HandlerRecommendation | null
  maintenanceTier: MaintenanceTier
  setMaintenanceTier: (v: MaintenanceTier) => void
}) {
  return (
    <div className="max-w-[640px] mx-auto">
      <BackLink onClick={onBack} />

      <h2 className="font-heading text-white text-3xl mb-3">Adjust your assumptions.</h2>
      <p className="mb-10" style={{ color: TEXT_SECONDARY }}>
        Conservative defaults based on Canadian wage data. Change anything.
      </p>

      <div className="flex flex-col gap-6">
        <div className="rounded-xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-medium">Annual labour cost inflation</span>
            <span className="font-semibold" style={{ color: GREEN }}>
              {inflationRate}%
            </span>
          </div>
          <Slider
            min={1}
            max={8}
            step={0.5}
            value={inflationRate}
            onChange={setInflationRate}
          />
          <p className="text-xs mt-3" style={{ color: TEXT_SECONDARY }}>
            Based on WCBC Salary Survey 2025-2026
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <p className="text-white font-medium mb-4">What kind of task?</p>
          <div className="flex gap-3 mb-2">
            <Pill
              label="Facility coverage"
              selected={taskType === 'facility'}
              onClick={() => setTaskType('facility')}
            />
            <Pill
              label="Material handling"
              selected={taskType === 'handler'}
              onClick={() => setTaskType('handler')}
            />
          </div>
          <p className="text-xs" style={{ color: TEXT_SECONDARY }}>
            {taskType === 'facility'
              ? 'Sized by square footage and cleaning frequency.'
              : 'Sized by payload weight and cycle time.'}
          </p>
        </div>

        {taskType === 'facility' ? (
          <div className="rounded-xl p-6 flex flex-col gap-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <DarkField
              label="Facility size (sq ft)"
              type="number"
              placeholder="e.g. 45000"
              value={facilitySqft}
              onChange={setFacilitySqft}
            />
            <div>
              <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: TEXT_SECONDARY }}>
                Cleaning frequency
              </span>
              <div className="flex gap-3">
                <Pill
                  label="Weekly"
                  selected={cleaningFrequency === 'weekly'}
                  onClick={() => setCleaningFrequency('weekly')}
                />
                <Pill
                  label="Daily"
                  selected={cleaningFrequency === 'daily'}
                  onClick={() => setCleaningFrequency('daily')}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-6 flex flex-col gap-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <DarkField
              label="Average payload (kg)"
              type="number"
              placeholder="e.g. 120"
              value={payloadKg}
              onChange={setPayloadKg}
            />
            <DarkField
              label="Trips per day"
              type="number"
              placeholder="e.g. 60"
              value={tripsPerDay}
              onChange={setTripsPerDay}
            />
            <DarkField
              label="Average trip length (meters)"
              type="number"
              placeholder="e.g. 40"
              value={avgTripLength}
              onChange={setAvgTripLength}
            />
            <div className="grid grid-cols-2 gap-4">
              <DarkField
                label="Work hours per shift"
                type="number"
                value={workHoursPerShift}
                onChange={setWorkHoursPerShift}
              />
              <DarkField
                label="Number of shifts"
                type="number"
                value={shiftsCount}
                onChange={setShiftsCount}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide" style={{ color: TEXT_SECONDARY }}>
                  Average speed
                </span>
                <span className="font-semibold" style={{ color: GREEN }}>
                  {avgSpeed.toFixed(2)} m/s
                </span>
              </div>
              <Slider min={0.5} max={1.25} step={0.05} value={avgSpeed} onChange={setAvgSpeed} />
            </div>
          </div>
        )}

        <div className="rounded-xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <p className="text-xs uppercase tracking-wide mb-3" style={{ color: TEXT_SECONDARY }}>
            Recommended
          </p>
          {hasRecommendationInput && taskType === 'facility' && facilityRecommendation ? (
            facilityRecommendation.model ? (
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-heading text-white text-4xl font-bold">
                  {facilityRecommendation.units}x {facilityRecommendation.model}
                </span>
                <span className="text-sm" style={{ color: TEXT_SECONDARY }}>
                  facility robot
                </span>
              </div>
            ) : (
              <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
                {facilityRecommendation.note}
              </p>
            )
          ) : hasRecommendationInput && taskType === 'handler' && handlerRecommendation ? (
            <>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-heading text-white text-4xl font-bold">
                  {handlerRecommendation.units}x {handlerRecommendation.model}
                </span>
                <span className="text-sm" style={{ color: TEXT_SECONDARY }}>
                  material handler
                </span>
              </div>
              {handlerRecommendation.units > 1 && (
                <p className="text-sm mb-1" style={{ color: TEXT_SECONDARY }}>
                  One unit achieves ~{handlerRecommendation.cycleTime.achievableTripsPerUnit} trips/day vs{' '}
                  {handlerRecommendation.cycleTime.requiredTripsPerDay} required, so recommendation scales up.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
              {taskType === 'facility'
                ? 'Enter your facility size above to see a recommended model.'
                : 'Enter payload weight above to see a recommended model.'}
            </p>
          )}

          <p className="text-sm font-medium mt-3" style={{ color: GREEN }}>
            From {currency(RAAS_MONTHLY_ANCHOR)}/month (RaaS) · From {currency(BUY_PRICE_ANCHOR)} (buy outright)
          </p>
          <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
            Exact pricing is confirmed with the Reliable Robots team.
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <p className="text-white font-medium mb-4">Annual maintenance</p>
          <div className="flex gap-3">
            <Pill
              label={`Standard — $${MAINTENANCE_COST.standard}/yr`}
              selected={maintenanceTier === 'standard'}
              onClick={() => setMaintenanceTier('standard')}
            />
            <Pill
              label={`Heavy duty — $${MAINTENANCE_COST.heavy}/yr`}
              selected={maintenanceTier === 'heavy'}
              onClick={() => setMaintenanceTier('heavy')}
            />
          </div>
          <p className="text-xs mt-3" style={{ color: TEXT_SECONDARY }}>
            Standard covers routine consumables. Heavy duty is for high-cycle or harsh environments.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 w-full font-heading text-white transition-colors"
        style={{ height: 56, backgroundColor: GREEN, borderRadius: 10, fontSize: 16 }}
      >
        See my results →
      </button>
    </div>
  )
}

/* ---------------------------------- Step 4 --------------------------------- */

interface ChartPoint {
  name: string
  labour: number
  robot: number
}

function Step4({
  onBack,
  onNext,
  monthlyLabourCost,
  oneYearSavings,
  fiveYearSavings,
  tenYearSavings,
  breakEvenYear,
  chartData,
  readiness,
  hoursEquivalent,
}: {
  onBack: () => void
  onNext: () => void
  monthlyLabourCost: number
  oneYearSavings: number
  fiveYearSavings: number
  tenYearSavings: number
  breakEvenYear: number | null
  chartData: ChartPoint[]
  readiness: { score: number; label: 'LOW' | 'MEDIUM' | 'HIGH'; description: string }
  hoursEquivalent: { hoursPerDay: number; fteEquivalent: number } | null
}) {
  const animatedSavings = useCountUp(fiveYearSavings, 800)

  const [revealStage, setRevealStage] = useState(0)
  useEffect(() => {
    const timers = [
      setTimeout(() => setRevealStage(1), 200),
      setTimeout(() => setRevealStage(2), 1000),
      setTimeout(() => setRevealStage(3), 2000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div>
      <BackLink onClick={onBack} />

      <h2 className="font-heading text-white text-3xl mb-8 rr-anim-fade">
        Here is what the numbers say.
      </h2>

      {revealStage >= 1 && (
        <div className="rr-anim-fade-up">
          <div
            className="text-center mb-6"
            style={{
              backgroundColor: 'rgba(0,191,99,0.08)',
              border: '1px solid rgba(0,191,99,0.25)',
              borderRadius: 16,
              padding: 40,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: GREEN }}>
              5-Year Savings With Automation
            </p>
            <p className="font-heading text-white font-bold text-6xl md:text-[72px]">
              {currency(animatedSavings, 0)}
            </p>
            <p className="mt-3" style={{ color: TEXT_SECONDARY }}>
              compared to continuing with labour
            </p>
            <p className="text-xs mt-4" style={{ color: TEXT_SECONDARY }}>
              10-year projection: {currency(tenYearSavings, 0)}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatCard label="Monthly Labour Cost" value={currency(monthlyLabourCost, 0)} color="#ffffff" />
            <StatCard label="1-Year Savings" value={currency(oneYearSavings, 0)} color={GREEN} />
            <StatCard
              label="Labour Hours Replaced"
              value={hoursEquivalent ? `~${hoursEquivalent.fteEquivalent.toFixed(1)} people/day` : 'N/A'}
              color="#ffffff"
            />
            <StatCard
              label="Break-Even"
              value={breakEvenYear ? `Year ${breakEvenYear}` : 'Beyond 10 years'}
              color="#ffffff"
            />
          </div>
        </div>
      )}

      {revealStage >= 2 && (
        <div
          className="rr-anim-fade-up mb-10"
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 32 }}
        >
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="font-heading text-white text-xl">Cost comparison over time</h3>
            <span className="text-xs" style={{ color: TEXT_SECONDARY }}>
              shown through Year 10
            </span>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                  tickFormatter={(value: number) => `$${value.toLocaleString()}`}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: NAVY,
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#ffffff',
                  }}
                  labelStyle={{ color: '#ffffff' }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(value) => currency(Number(value), 0)}
                />
                <Legend wrapperStyle={{ color: '#ffffff' }} />
                <Line
                  type="monotone"
                  dataKey="labour"
                  name="Labour Cost"
                  stroke={RED}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={1200}
                />
                <Line
                  type="monotone"
                  dataKey="robot"
                  name="Robot Investment"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={1200}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {revealStage >= 3 && (
        <div className="rr-anim-fade-up">
          <div
            style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 32 }}
          >
            <h3 className="font-heading text-white text-xl mb-6">Automation readiness</h3>
            <Gauge score={readiness.score} label={readiness.label} description={readiness.description} animate />
          </div>

          <button
            type="button"
            onClick={onNext}
            className="mt-8 w-full font-heading text-white transition-colors"
            style={{ height: 56, backgroundColor: GREEN, borderRadius: 10, fontSize: 16 }}
          >
            Get my free report →
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------- Step 5 --------------------------------- */

function Step5({
  onBack,
  monthlyLabourCost,
  tenYearSavings,
  breakEvenYear,
  firstName,
  setFirstName,
  email,
  setEmail,
  company,
  setCompany,
  intent,
  setIntent,
  submitting,
  submitted,
  submitError,
  onSubmit,
}: {
  onBack: () => void
  monthlyLabourCost: number
  tenYearSavings: number
  breakEvenYear: number | null
  firstName: string
  setFirstName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  company: string
  setCompany: (v: string) => void
  intent: Intent
  setIntent: (v: Intent) => void
  submitting: boolean
  submitted: boolean
  submitError: string
  onSubmit: (e: React.FormEvent) => void
}) {
  if (submitted) {
    return (
      <div className="max-w-[480px] mx-auto text-center">
        <div className="flex justify-center mb-6">
          <AnimatedCheck />
        </div>
        <h2 className="font-heading text-white text-3xl mb-3">Report sent.</h2>
        <p className="mb-6" style={{ color: TEXT_SECONDARY }}>
          Check your inbox. Our GTA team will be in touch shortly.
        </p>
        <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
          (888) 747-8992 | info@reliablerobots.ca
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[480px] mx-auto">
      <BackLink onClick={onBack} />

      <h2 className="font-heading text-white text-3xl mb-3 text-center">Your report is ready.</h2>
      <p className="mb-8 text-center" style={{ color: TEXT_SECONDARY }}>
        Enter your email and we will send your full ROI analysis as a PDF. Free.
      </p>

      <div
        className="grid grid-cols-3 gap-3 mb-8 rounded-xl p-5 text-center"
        style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>
            Monthly cost
          </p>
          <p className="text-white font-semibold text-sm">{currency(monthlyLabourCost, 0)}</p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>
            10yr savings
          </p>
          <p className="font-semibold text-sm" style={{ color: GREEN }}>
            {currency(tenYearSavings, 0)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>
            Break-even
          </p>
          <p className="text-white font-semibold text-sm">
            {breakEvenYear ? `Year ${breakEvenYear}` : 'Beyond 10yr'}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <DarkField label="First Name" type="text" value={firstName} onChange={setFirstName} required />
        <DarkField label="Work Email" type="email" value={email} onChange={setEmail} required />
        <DarkField label="Company Name (optional)" type="text" value={company} onChange={setCompany} />

        <div>
          <span
            className="text-xs uppercase tracking-wide mb-3 block"
            style={{ color: TEXT_SECONDARY }}
          >
            What are you looking for?
          </span>
          <div className="flex flex-col sm:flex-row gap-3">
            <Pill label="Explore RaaS" selected={intent === 'raas'} onClick={() => setIntent('raas')} />
            <Pill label="Purchase quote" selected={intent === 'quote'} onClick={() => setIntent('quote')} />
            <Pill
              label="Just the report"
              selected={intent === 'report-only'}
              onClick={() => setIntent('report-only')}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full font-heading font-bold text-white transition-colors disabled:opacity-60"
          style={{ height: 60, backgroundColor: GREEN, borderRadius: 10, fontSize: 18 }}
        >
          {submitting ? 'Sending…' : 'Send Me My Free ROI Report'}
        </button>

        {submitError && <p className="text-sm text-center" style={{ color: RED }}>{submitError}</p>}
      </form>
    </div>
  )
}

/* -------------------------------- Shared UI -------------------------------- */

function SummaryLine({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-sm rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.04]"
      style={{ color: TEXT_SECONDARY, border: `1px solid ${CARD_BORDER}` }}
    >
      {children}
    </button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm mb-6 inline-block hover:text-white transition-colors"
      style={{ color: TEXT_SECONDARY }}
    >
      ← Back
    </button>
  )
}

function DarkField({
  label,
  type,
  placeholder,
  value,
  onChange,
  autoFocus,
  required,
}: {
  label: string
  type: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide" style={{ color: TEXT_SECONDARY }}>
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-white text-lg rounded-[10px] px-5 py-4 bg-white/[0.06] border border-white/10 focus:border-[#00BF63] focus:outline-none transition-colors placeholder-white/30"
      />
    </label>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="rr-slider"
      style={{
        background: `linear-gradient(to right, ${GREEN} 0%, ${GREEN} ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
      }}
    />
  )
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors"
      style={{
        color: '#ffffff',
        backgroundColor: selected ? GREEN : 'transparent',
        border: `1px solid ${selected ? GREEN : 'rgba(255,255,255,0.2)'}`,
      }}
    >
      {label}
    </button>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl p-5 text-center"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <p className="text-xs mb-2" style={{ color: TEXT_SECONDARY }}>
        {label}
      </p>
      <p className="text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function AnimatedCheck() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="44" stroke={GREEN} strokeWidth="4" opacity="0.3" />
      <path
        d="M28 50 L42 64 L70 34"
        stroke={GREEN}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 64,
          strokeDashoffset: 64,
          animation: 'rrDrawCheck 600ms ease-out 200ms forwards',
        }}
      />
    </svg>
  )
}

function Gauge({
  score,
  label,
  description,
  animate,
}: {
  score: number
  label: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
  animate: boolean
}) {
  const [sweep, setSweep] = useState(false)

  useEffect(() => {
    if (!animate) return
    const id = requestAnimationFrame(() => setSweep(true))
    return () => cancelAnimationFrame(id)
  }, [animate])

  const cx = 150
  const cy = 150
  const radius = 120
  const needleLength = 100

  const targetRotation = (score / 100) * 180
  const rotation = sweep ? targetRotation : 0

  const labelColor = label === 'HIGH' ? GREEN : label === 'MEDIUM' ? AMBER : RED

  const arcPoint = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
    }
  }
  const p180 = arcPoint(180)
  const p120 = arcPoint(120)
  const p60 = arcPoint(60)
  const p0 = arcPoint(0)

  return (
    <div className="flex flex-col items-center">
      <svg width="300" height="160" viewBox="0 0 300 160">
        <path
          d={`M ${p180.x} ${p180.y} A ${radius} ${radius} 0 0 1 ${p120.x} ${p120.y}`}
          fill="none"
          stroke={RED}
          strokeWidth="24"
        />
        <path
          d={`M ${p120.x} ${p120.y} A ${radius} ${radius} 0 0 1 ${p60.x} ${p60.y}`}
          fill="none"
          stroke={AMBER}
          strokeWidth="24"
        />
        <path
          d={`M ${p60.x} ${p60.y} A ${radius} ${radius} 0 0 1 ${p0.x} ${p0.y}`}
          fill="none"
          stroke={GREEN}
          strokeWidth="24"
        />

        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 800ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx - needleLength}
            y2={cy}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="8" fill="#ffffff" />
        </g>
      </svg>

      <p className="font-heading text-white font-bold text-5xl mt-4">{Math.round(score)}%</p>
      <p className="font-heading text-lg uppercase mt-2" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="text-sm text-center max-w-md mt-3" style={{ color: TEXT_SECONDARY }}>
        {description}
      </p>
    </div>
  )
}
