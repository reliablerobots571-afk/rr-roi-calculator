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
export type FacilityModel = 'CC1' | 'MT1'
export type HandlerModel = 'T300' | 'T600'
export type CleaningFrequency = 'daily' | 'weekly'
export type MaintenanceTier = 'standard' | 'heavy'

export const BUY_PRICE_ANCHOR = 24000 // T300 buy-outright anchor, quoted for "all robots"
export const RAAS_MONTHLY_ANCHOR = 399 // CC1 RaaS entry point, quoted as the universal hook

export const MAINTENANCE_COST: Record<MaintenanceTier, number> = {
  standard: 500,
  heavy: 1500,
}

// Real CC1 spec.
const CC1_SQFT_PER_HOUR = 6331
// ASSUMPTION: RR hasn't published how many unattended hours/day a facility
// typically gives CC1 to run (overnight / between shifts). Placeholder: 3
// hours/day, 7 days/week. Confirm before relying on this.
const CC1_HOURS_PER_DAY = 3

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

export function recommendFacilityRobot(
  sqft: number,
  frequency: CleaningFrequency
): FacilityRecommendation {
  const passesPerWeek = frequency === 'daily' ? 7 : 1
  const sqftPerWeekNeeded = Math.max(0, sqft) * passesPerWeek
  const sqftPerWeekPerCC1 = CC1_SQFT_PER_HOUR * CC1_HOURS_PER_DAY * 7

  const units = sqftPerWeekPerCC1 > 0 ? Math.max(1, Math.ceil(sqftPerWeekNeeded / sqftPerWeekPerCC1)) : 1

  // We don't have a public throughput number for MT1, so we can't size it
  // automatically — just flag it as an option once CC1 count gets high.
  return {
    model: 'CC1',
    units,
    note: units > 3 ? 'At this scale, ask the team about MT1 for large-area industrial floors.' : null,
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
