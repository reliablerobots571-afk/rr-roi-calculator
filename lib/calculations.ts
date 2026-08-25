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
export type HandlerModel = 'T300' | 'T600'
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

// Real specs from reliablerobots.ca/cc1, /mt1, /bg1 — "Covered/All-covered
// Cleaning Mode" rate on all three, so they're apples-to-apples. Using the
// conservative low end of each published range.
const CC1_SQFT_PER_HOUR = 7534.74 // 700 m²/h low end (range: 700-1000 m²/h)
const CC1_HOURS_PER_DAY = 5 // real: general combined-mode battery runtime (range: 4-9h by mode)

const MT1_SQFT_PER_HOUR = 19375.04 // All-covered Cleaning Mode, ~2.6x CC1's rate
const MT1_HOURS_PER_DAY = 4 // real: conservative low end of published 4-8h runtime range

// BG1's real, defining feature: sweeps AND scrubs in ONE pass ("By sweeping
// in the front and scrubbing in the rear, it eliminates the need for
// multiple cleaning passes"). CC1/MT1 do one function per pass — if a job
// needs both, they have to run the space twice, halving effective coverage.
const BG1_SQFT_PER_HOUR = 21528 // Covered Cleaning Mode
const BG1_HOURS_PER_DAY = 7.5 // real: max Sweeping & Scrubbing runtime
// BG1 Pro shares BG1's cleaning performance — the Pro difference is
// perception/obstacle-detection hardware, same as MT1 vs MT1 Max.

// Real per-product payload specs (see note above on the 600kg/800kg conflict).
const HANDLER_PAYLOAD_MAX_KG: Record<HandlerModel, number> = {
  T300: 300,
  T600: 800,
}

export interface FacilityRecommendation {
  model: FacilityModel
  units: number
  note: string | null
}

// Above this many CC1 units, consolidating into MT1 units (real ~2.6x
// throughput) is the more credible recommendation.
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

  // CC1/MT1 need a second pass to cover the second cleaning function —
  // halves their effective weekly capacity. BG1/BG1 Pro don't take this hit.
  const passPenalty = needsBoth ? 2 : 1

  if (needsBoth) {
    const sqftPerWeekPerBG1 = BG1_SQFT_PER_HOUR * BG1_HOURS_PER_DAY * 7
    const bg1UnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerBG1))
    const model: FacilityModel = hasHazard ? 'BG1 Pro' : 'BG1'

    // Reference-only equivalent, matching the original "3x CC1 or 1x BG1"
    // framing — shown in the note, not as a real alternative recommendation.
    const sqftPerWeekPerCC1 = (CC1_SQFT_PER_HOUR * CC1_HOURS_PER_DAY * 7) / passPenalty
    const ccEquivalentUnits = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerCC1))

    return {
      model,
      units: bg1UnitsNeeded,
      note: `Sweeping + scrubbing both needed — ${model} does both in one pass instead of two. Roughly equivalent to ${ccEquivalentUnits}x CC1 running each pass separately.`,
    }
  }

  const sqftPerWeekPerCC1 = CC1_SQFT_PER_HOUR * CC1_HOURS_PER_DAY * 7
  const ccUnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerCC1))

  if (ccUnitsNeeded > MAX_REASONABLE_CC1_UNITS) {
    const sqftPerWeekPerMT1 = MT1_SQFT_PER_HOUR * MT1_HOURS_PER_DAY * 7
    const mt1UnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerMT1))
    const model: FacilityModel = hasHazard ? 'MT1 Max' : 'MT1'

    return {
      model,
      units: mt1UnitsNeeded,
      note: hasHazard
        ? 'MT1 Max recommended over base MT1 — built for spaces with forklifts or moving vehicles (stronger obstacle detection, audible/visual alarms).'
        : null,
    }
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
}

export function recommendHandlerRobot(params: {
  payloadKg: number
  tripsPerDay: number
  avgTripLengthMeters: number
  workHoursPerShift: number
  shifts: number
  avgSpeedMps: number // 0.5 - 1.25, default 1
}): HandlerRecommendation {
  const { payloadKg, tripsPerDay, avgTripLengthMeters, workHoursPerShift, shifts, avgSpeedMps } =
    params

  const model: HandlerModel = payloadKg <= HANDLER_PAYLOAD_MAX_KG.T300 ? 'T300' : 'T600'

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
