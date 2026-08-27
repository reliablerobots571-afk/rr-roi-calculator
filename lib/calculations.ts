export type CalculationMethod = 'hours' | 'team' | 'sqft' | 'monthly'

export const DEFAULT_HOURLY_WAGE = 20.32

export function calculateMonthlyLabourCost(
  method: CalculationMethod,
  inputs: Record<string, number>
): number {
  switch (method) {
    case 'hours':
      return inputs.monthlyHours * inputs.hourlyWage
    case 'team':
      return inputs.teamSize * inputs.hoursPerWeek * 4.33 * inputs.hourlyWage
    case 'sqft':
      return inputs.sqft * inputs.costPerSqft
    case 'monthly':
      return inputs.monthlyCost
    default:
      return 0
  }
}

/* ------------------------- Robot recommendation ------------------------- */
/*
 * Real Reliable Robots catalog — not invented classes.
 *
 * Facility cleaning: CC1 (lobbies/corridors/common areas) and MT1 (large
 * industrial floors, wide-area scrubbing).
 * Material movement: T300 (up to 300kg payload) and T600 (up to 800kg —
 * NOTE: the landing-page copy says the T-series tops out "up to 600kg"
 * combined, conflicting with the per-product spec card's 800kg for T600.
 * Using 800kg as the more specific source. Confirm with Johnny.)
 *
 * Pricing is NOT broken out per model — Reliable Robots deliberately keeps
 * it to two universal anchors and closes exact pricing in a sales
 * conversation:
 *   - RaaS: "From $399/month" (CC1 entry hook, quoted for all robots)
 *   - Buy outright: "T300 from $24,000 CAD. All robots available."
 * This tool uses those same two real anchors rather than a fabricated
 * per-model price table.
 */

export type RobotCategory = 'facility' | 'handler'
export type FacilityModel = 'CC1' | 'MT1' | 'MT1 Max' | 'BG1' | 'BG1 Pro'
export type HandlerModel = 'T300' | 'T600' | 'FOLA'
export type CleaningFrequency = 'daily' | 'weekly'
export type MaintenanceTier = 'standard' | 'heavy'
export type CleaningTask = 'sweeping' | 'scrubbing'
export type SpaceHazard = 'forklifts' | 'vehicles'

export const BUY_PRICE_ANCHOR = 24000 // T300 buy-outright anchor, quoted for "all robots"
export const RAAS_MONTHLY_ANCHOR = 399 // CC1 RaaS entry point, quoted as the universal hook

export const MAINTENANCE_COST: Record<MaintenanceTier, number> = {
  standard: 500,
  heavy: 1500,
}

// Johnny's own framing: a robot can run 3x 5-hour shifts in 24 hours = 15
// hours/day. Against a standard 8-hour human shift, that's ~1.9, "about two
// people" per unit per day (his words). Real, client-given numbers — not
// invented.
export const ROBOT_HOURS_PER_DAY = 15
export const STANDARD_SHIFT_HOURS = 8

export function laborHoursEquivalent(units: number): { hoursPerDay: number; fteEquivalent: number } {
  const hoursPerDay = units * ROBOT_HOURS_PER_DAY
  return {
    hoursPerDay,
    fteEquivalent: hoursPerDay / STANDARD_SHIFT_HOURS,
  }
}

const DAYS_PER_MONTH = 30.44 // 365.25 / 12, used for robot capacity since it can run every day

export interface HoursReplacedResult {
  replacedHoursPerMonth: number
  percentOfCleaningHours: number
  robotHoursPerMonth: number
  actualCleaningHoursPerMonth: number
  hasHeadroom: boolean
}

// Ties robot capacity to what the team actually spends on cleaning, instead
// of a floating "N people/day" that ignores the entered team size entirely.
export function reconcileHoursReplaced(
  actualMonthlyLabourHours: number,
  cleaningTimePercent: number, // 0-100
  robotUnits: number
): HoursReplacedResult {
  const actualCleaningHoursPerMonth = actualMonthlyLabourHours * (cleaningTimePercent / 100)
  const robotHoursPerMonth = robotUnits * ROBOT_HOURS_PER_DAY * DAYS_PER_MONTH
  const replacedHoursPerMonth = Math.min(robotHoursPerMonth, actualCleaningHoursPerMonth)
  const percentOfCleaningHours =
    actualCleaningHoursPerMonth > 0 ? (replacedHoursPerMonth / actualCleaningHoursPerMonth) * 100 : 0

  return {
    replacedHoursPerMonth,
    percentOfCleaningHours,
    robotHoursPerMonth,
    actualCleaningHoursPerMonth,
    hasHeadroom: robotHoursPerMonth > actualCleaningHoursPerMonth,
  }
}

/* ------------------- Material handling positioning ------------------- */

export type TransportMethod = 'cart' | 'forklift'
export type PayloadType = 'pallets' | 'bins' | 'boxes'

const AVERAGE_STRIDE_METERS = 0.762 // ~2.5ft, standard adult walking stride
// ASSUMPTION: no public/sourced figure for typical warehouse forklift travel
// speed. Using a commonly cited ~7 km/h safe-operating average. Confirm with
// Johnny before treating this as a real number in front of a prospect.
const FORKLIFT_METERS_PER_HOUR = 7000

export interface ManualEffortResult {
  totalDistanceMetersPerDay: number
  steps: number | null
  forkliftDriveHoursPerDay: number | null
}

export function calculateManualEffort(
  tripsPerDay: number,
  avgTripLengthMeters: number,
  transportMethod: TransportMethod
): ManualEffortResult {
  // Round trip per delivery, same assumption the cycle-time model uses.
  const totalDistanceMetersPerDay = Math.max(0, tripsPerDay) * Math.max(0, avgTripLengthMeters) * 2

  return {
    totalDistanceMetersPerDay,
    steps: transportMethod === 'cart' ? totalDistanceMetersPerDay / AVERAGE_STRIDE_METERS : null,
    forkliftDriveHoursPerDay:
      transportMethod === 'forklift' ? totalDistanceMetersPerDay / FORKLIFT_METERS_PER_HOUR : null,
  }
}

// Real specs from reliablerobots.ca/cc1, /mt1, /bg1 — "Covered/All-covered
// Cleaning Mode" rate on all three, so they're apples-to-apples. Using the
// conservative low end of each published range.
const CC1_SQFT_PER_HOUR = 7534.74 // 700 m²/h low end (range: 700-1000 m²/h)
const CC1_HOURS_PER_DAY = 5 // real: general combined-mode battery runtime (range: 4-9h by mode)

// MT1 (19,375 sqft/h, 4h runtime) isn't used as a pick here — BG1's real
// numbers (21,528 sqft/h, 7.5h runtime) beat it on both throughput and
// runtime, so BG1 is the better "next tier up from CC1" by the numbers we
// have. MT1/MT1 Max stay in the FacilityModel type in case Johnny wants
// them reintroduced for a reason this model doesn't capture (e.g. dry-only
// industrial cleaning vs BG1's wet sweep+scrub).

// BG1's real, defining feature: sweeps AND scrubs in ONE pass ("By sweeping
// in the front and scrubbing in the rear, it eliminates the need for
// multiple cleaning passes"). CC1 does one function per pass — if a job
// needs both, it has to run the space twice, halving effective coverage.
const BG1_SQFT_PER_HOUR = 21528 // Covered Cleaning Mode
const BG1_HOURS_PER_DAY = 7.5 // real: max Sweeping & Scrubbing runtime
// BG1 Pro shares BG1's cleaning performance — the Pro difference is
// perception/obstacle-detection hardware, same as MT1 vs MT1 Max.

// Real per-product payload specs (see note above on the 600kg/800kg conflict).
const HANDLER_PAYLOAD_MAX_KG: Record<'T300' | 'T600', number> = {
  T300: 300,
  T600: 800,
}

// Real spec from reliablerobots.ca/autonomous-forklift: the FOLA line spans
// 300-2000kg across 5 variants (SN300/SN600/DN1416/QN1416/BN2001), built for
// rack-aisle navigation and precise pallet alignment, i.e. a genuinely
// different product than the general-purpose T-series. Not distinguishing
// between the specific FOLA sub-models here (DN vs QN at the same 1400kg
// isn't something the scraped spec explains), just capping at the line's
// real max payload.
const FOLA_MAX_PAYLOAD_KG = 2000

export interface FacilityRecommendation {
  model: FacilityModel
  units: number
  note: string | null
}

// Above this many CC1 units, BG1 (real ~4x weekly capacity once its longer
// runtime is factored in) is the more credible "next tier up" pick.
const MAX_REASONABLE_CC1_UNITS = 3

export function recommendFacilityRobot(
  sqft: number,
  frequency: CleaningFrequency,
  cleaningTasks: CleaningTask[],
  hazards: SpaceHazard[]
): FacilityRecommendation {
  const passesPerWeek = frequency === 'daily' ? 7 : 1
  const sqftPerWeekNeeded = Math.max(0, sqft) * passesPerWeek

  const needsBoth = cleaningTasks.includes('sweeping') && cleaningTasks.includes('scrubbing')
  const hasHazard = hazards.length > 0

  // CC1 needs a second pass to cover a second cleaning function — halves
  // its effective weekly capacity. BG1/BG1 Pro don't take this hit (built
  // to sweep and scrub in one pass).
  const passPenalty = needsBoth ? 2 : 1
  const sqftPerWeekPerCC1 = (CC1_SQFT_PER_HOUR * CC1_HOURS_PER_DAY * 7) / passPenalty
  const ccUnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerCC1))

  // BG1 is the "XL" tier once CC1 would need too many units, OR the job
  // needs both sweeping and scrubbing (where BG1's one-pass design wins
  // regardless of facility size). Matches "3x CC1 or 1x BG1" as a general
  // sizing rule, not just a combo-cleaning special case.
  if (needsBoth || ccUnitsNeeded > MAX_REASONABLE_CC1_UNITS) {
    const sqftPerWeekPerBG1 = BG1_SQFT_PER_HOUR * BG1_HOURS_PER_DAY * 7
    const bg1UnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerBG1))
    const model: FacilityModel = hasHazard ? 'BG1 Pro' : 'BG1'

    let note = needsBoth
      ? `Sweeping + scrubbing both needed. ${model} does both in one pass instead of two. Roughly equivalent to ${ccUnitsNeeded}x CC1 running each pass separately.`
      : `Roughly equivalent to ${ccUnitsNeeded}x CC1.`

    // At real scale, a mixed fleet (bulk-area unit + a CC1 for corners and
    // detail work) is a legitimate configuration, but the exact split isn't
    // something this tool can compute confidently, so it's a suggestion to
    // raise with the team, not a separate computed recommendation.
    if (bg1UnitsNeeded > 1) {
      note += ` At this scale, some facilities pair ${model} for bulk coverage with a CC1 for tight corners and detail work. Ask the team if a mixed fleet fits your layout.`
    }

    return { model, units: bg1UnitsNeeded, note }
  }

  return {
    model: 'CC1',
    units: ccUnitsNeeded,
    note: null,
  }
}

export interface HandlerRecommendation {
  model: HandlerModel
  units: number
  cycleTime: { requiredTripsPerDay: number; achievableTripsPerUnit: number }
  note: string | null
}

export function recommendHandlerRobot(params: {
  payloadKg: number
  payloadType: PayloadType
  tripsPerDay: number
  avgTripLengthMeters: number
  workHoursPerShift: number
  shifts: number
  avgSpeedMps: number // 0.5 - 1.25, default 1
}): HandlerRecommendation {
  const { payloadKg, payloadType, tripsPerDay, avgTripLengthMeters, workHoursPerShift, shifts, avgSpeedMps } =
    params

  let model: HandlerModel
  let note: string | null = null

  if (payloadType === 'pallets') {
    // Real product distinction, not just a weight cutoff: FOLA is built for
    // rack-aisle navigation and precise pallet alignment. T300/T600 are
    // general-purpose delivery robots, not pallet handlers.
    model = 'FOLA'
    note =
      payloadKg <= HANDLER_PAYLOAD_MAX_KG.T300
        ? 'Palletized loads route to the FOLA autonomous forklift line (built for rack-aisle navigation and pallet alignment), not T300/T600. A T300 Lift variant also exists for lighter pallet transfer to workstations, worth asking the team about for this weight.'
        : 'Palletized loads route to the FOLA autonomous forklift line (300-2000kg across 5 variants), built for rack-aisle navigation and precise pallet alignment, not the general-purpose T-series.'
    if (payloadKg > FOLA_MAX_PAYLOAD_KG) {
      note += ` Note: ${payloadKg}kg is above FOLA's largest published variant (2000kg), confirm with the team.`
    }
  } else {
    model = payloadKg <= HANDLER_PAYLOAD_MAX_KG.T300 ? 'T300' : 'T600'
  }

  const speed = Math.min(1.25, Math.max(0.5, avgSpeedMps || 1))
  const availableSeconds = Math.max(0, workHoursPerShift) * Math.max(0, shifts) * 3600
  const roundTripSeconds = (2 * Math.max(0, avgTripLengthMeters)) / speed
  const achievableTripsPerUnit = roundTripSeconds > 0 ? availableSeconds / roundTripSeconds : 0

  // Restaurant-delivery-style scaling: if one unit can't hit the required
  // trips, add units to cover the gap.
  const units =
    achievableTripsPerUnit > 0 && tripsPerDay > 0
      ? Math.max(1, Math.ceil(tripsPerDay / achievableTripsPerUnit))
      : 1

  return {
    model,
    units,
    cycleTime: {
      requiredTripsPerDay: tripsPerDay,
      achievableTripsPerUnit: Math.round(achievableTripsPerUnit),
    },
    note,
  }
}

/* ------------------------------ ROI math --------------------------------- */

export interface YearlyData {
  year: number
  labourCumulative: number
  robotCumulative: number
}

export function calculateTenYearData(
  monthlyLabourCost: number,
  inflationRate: number,
  robotPrice: number,
  annualMaintenance: number
): YearlyData[] {
  const annualLabourCostBase = monthlyLabourCost * 12
  const data: YearlyData[] = []

  let labourCumulative = 0
  let robotCumulative = 0
  let currentYearLabourCost = annualLabourCostBase

  for (let year = 1; year <= 10; year++) {
    if (year > 1) {
      currentYearLabourCost = currentYearLabourCost * (1 + inflationRate / 100)
    }
    labourCumulative += currentYearLabourCost

    if (year === 1) {
      robotCumulative = robotPrice + annualMaintenance
    } else {
      robotCumulative += annualMaintenance
    }

    data.push({ year, labourCumulative, robotCumulative })
  }

  return data
}

export function calculateBreakEven(data: YearlyData[]): number | null {
  for (const point of data) {
    if (point.robotCumulative < point.labourCumulative) {
      return point.year
    }
  }
  return null
}

export function savingsAtYear(data: YearlyData[], year: number): number {
  const point = data.find((d) => d.year === year)
  if (!point) return 0
  return point.labourCumulative - point.robotCumulative
}

export interface ReadinessScore {
  score: number
  label: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
}

export function calculateReadinessScore(
  monthlyLabourCost: number,
  tenYearSavings: number
): ReadinessScore {
  if (monthlyLabourCost > 3000 || tenYearSavings > 50000) {
    const ratio = Math.max(monthlyLabourCost / 3000, tenYearSavings / 50000)
    const score = Math.min(100, Math.round(75 + (ratio - 1) * 25))
    return {
      score,
      label: 'HIGH',
      description:
        'Strong ROI case. Automation could significantly reduce your operating costs.',
    }
  }

  if (monthlyLabourCost > 1500 || tenYearSavings > 20000) {
    const ratio = Math.max(monthlyLabourCost / 1500, tenYearSavings / 20000)
    const score = Math.round(40 + Math.min(1, ratio - 1) * 34)
    return {
      score,
      label: 'MEDIUM',
      description:
        'Moderate ROI case. Worth exploring which robot type fits your operation.',
    }
  }

  const ratio = Math.max(monthlyLabourCost / 1500, tenYearSavings / 20000)
  const score = Math.round(Math.min(1, ratio) * 39)
  return {
    score,
    label: 'LOW',
    description:
      'Early stage. A smaller robot or partial automation may be a good starting point.',
  }
}
