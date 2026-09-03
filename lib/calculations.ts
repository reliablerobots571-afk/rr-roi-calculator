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
export type CleaningTask = 'sweeping' | 'mopping' | 'scrubbing' | 'vacuuming'
export type SpaceHazard = 'forklifts' | 'vehicles'

export const BUY_PRICE_ANCHOR = 24000 // T300 buy-outright anchor, quoted for "all robots"
export const RAAS_MONTHLY_ANCHOR = 399 // CC1 RaaS entry point, quoted as the universal hook

export const MAINTENANCE_COST: Record<MaintenanceTier, number> = {
  standard: 500,
  heavy: 1500,
}

// No longer a manual pick — determined from how hard the recommended fleet
// is actually working. 75%+ of its own weekly capacity used = heavy duty,
// otherwise standard.
export const HEAVY_DUTY_UTILIZATION_THRESHOLD = 75

export function determineMaintenanceTier(utilizationPercent: number): MaintenanceTier {
  return utilizationPercent >= HEAVY_DUTY_UTILIZATION_THRESHOLD ? 'heavy' : 'standard'
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

// Real specs from reliablerobots.ca/cc1, /mt1, /bg1. Using the conservative
// low end of each published range where a range exists.
const CC1_SQFT_PER_HOUR = 7534.74 // 700 m²/h low end, Covered Cleaning Mode

// MT1's real spec sheet publishes TWO distinct rates: All-covered Cleaning
// Mode (19,375 sqft/h, thorough wet pass) and Spot Cleaning Mode (64,583.46
// sqft/h, faster dry debris sweep). For sweeping-only jobs, Spot Cleaning is
// the right comparison, not All-covered. Confirmed against Johnny's own
// worked example (200,000 sqft, 3.5h x 2 shifts -> ~2x/day coverage).
const MT1_SPOT_SQFT_PER_HOUR = 64583.46

// BG1's real, defining feature: sweeps AND scrubs in ONE pass ("By sweeping
// in the front and scrubbing in the rear, it eliminates the need for
// multiple cleaning passes"). CC1 does one function per pass — if a job
// needs both, it has to run the space twice, halving effective coverage.
// Also confirmed against Johnny's worked example for BG1 Pro (200,000 sqft,
// 5h x 2 shifts -> ~1x/day full scrub coverage).
const BG1_SQFT_PER_HOUR = 21528 // Covered Cleaning Mode
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

export interface FacilityAltOption {
  label: string
  description: string
}

export interface FacilityRecommendation {
  label: string
  model: FacilityModel
  units: number
  note: string | null
  altOption: FacilityAltOption | null
  // How close to its own weekly capacity the recommended fleet runs, 0-100+.
  // Drives the auto maintenance-tier determination (no longer a manual pick).
  utilizationPercent: number
}

// Above this many CC1 units, BG1 (real ~4x weekly capacity once its longer
// runtime is factored in) is the more credible "next tier up" pick.
const MAX_REASONABLE_CC1_UNITS = 3

export function recommendFacilityRobot(
  sqft: number,
  frequency: CleaningFrequency,
  cleaningTasks: CleaningTask[],
  hazards: SpaceHazard[],
  hoursPerShift: number,
  shiftsPerDay: number
): FacilityRecommendation {
  const passesPerWeek = frequency === 'daily' ? 7 : 1
  const sqftPerWeekNeeded = Math.max(0, sqft) * passesPerWeek

  const hours = Math.max(0, hoursPerShift)
  const shifts = Math.max(0, shiftsPerDay)
  const weeklyCapacity = (ratePerHour: number) => ratePerHour * hours * shifts * 7
  const utilization = (units: number, ratePerHour: number) => {
    const cap = weeklyCapacity(ratePerHour) * units
    return cap > 0 ? (sqftPerWeekNeeded / cap) * 100 : 0
  }

  const needsSweep = cleaningTasks.includes('sweeping')
  // ASSUMPTION: no separate real throughput figure for mopping or vacuuming
  // on any of these models, so both are treated like scrubbing (a thorough
  // wet/detail pass, not a fast dry sweep) for sizing purposes. Confirm
  // with Johnny — he's flagged this area (MT1 vs MT1 Vac vs MT1 Max by
  // debris size/fineness) as having more real configurations than this
  // model captures yet.
  const needsScrubLike =
    cleaningTasks.includes('scrubbing') || cleaningTasks.includes('mopping') || cleaningTasks.includes('vacuuming')
  const hasHazard = hazards.length > 0

  // Rule 1: needs both sweeping and a thorough pass (scrubbing/mopping/
  // vacuuming). Real challenge case Johnny flagged: at scale, a single BG1
  // (one-pass combo) and a split MT1 (fast sweep) + BG1 (thorough scrub)
  // fleet are both legitimate, so both are shown as real computed options.
  // Hazards upgrade both halves to their obstacle-aware variant.
  if (needsSweep && needsScrubLike) {
    const bg1Model: FacilityModel = hasHazard ? 'BG1 Pro' : 'BG1'
    const mt1Model: FacilityModel = hasHazard ? 'MT1 Max' : 'MT1'

    const bg1ComboUnits = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))
    const mt1SplitUnits = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(MT1_SPOT_SQFT_PER_HOUR)))
    const bg1SplitUnits = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))

    return {
      label: 'Option 1',
      model: bg1Model,
      units: bg1ComboUnits,
      note: 'Sweeps and scrubs in one pass, single-unit coverage.',
      altOption: {
        label: 'Option 2',
        description: `${mt1SplitUnits}x ${mt1Model} (fast debris sweep, spot mode) + ${bg1SplitUnits}x ${bg1Model} (thorough scrub, covered mode), run on split shifts. Keeps larger debris clear throughout the day instead of just once per pass, at the cost of running two robot types.`,
      },
      utilizationPercent: utilization(bg1ComboUnits, BG1_SQFT_PER_HOUR),
    }
  }

  // Rule 2: scrubbing/mopping/vacuuming needed, no sweeping. Hazards route
  // to BG1 Pro (Johnny's rule: "if it has forklifts... then BG1 Pro").
  if (needsScrubLike && !needsSweep) {
    if (hasHazard) {
      const units = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))
      return {
        label: 'Recommended',
        model: 'BG1 Pro',
        units,
        note: 'Space has forklifts or moving vehicles. BG1 Pro is built for that (3D LiDAR obstacle detection).',
        altOption: null,
        utilizationPercent: utilization(units, BG1_SQFT_PER_HOUR),
      }
    }

    const ccUnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(CC1_SQFT_PER_HOUR)))

    if (ccUnitsNeeded > MAX_REASONABLE_CC1_UNITS) {
      const bg1Units = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))
      return {
        label: 'Recommended',
        model: 'BG1',
        units: bg1Units,
        note: `Roughly equivalent to ${ccUnitsNeeded}x CC1.`,
        altOption: null,
        utilizationPercent: utilization(bg1Units, BG1_SQFT_PER_HOUR),
      }
    }

    return {
      label: 'Recommended',
      model: 'CC1',
      units: ccUnitsNeeded,
      note: null,
      altOption: null,
      utilizationPercent: utilization(ccUnitsNeeded, CC1_SQFT_PER_HOUR),
    }
  }

  // Rule 3: sweeping only. MT1 using its real Spot Cleaning Mode rate
  // (fast dry sweep), matching Johnny's own worked example. Hazard present
  // upgrades to MT1 Max specifically (not BG1 Pro) — Max is the
  // sweep-specialist's own obstacle-aware variant, per Johnny's later
  // clarification, rather than always jumping to the wet-combo unit.
  if (needsSweep && !needsScrubLike) {
    const model: FacilityModel = hasHazard ? 'MT1 Max' : 'MT1'
    const units = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(MT1_SPOT_SQFT_PER_HOUR)))
    return {
      label: 'Recommended',
      model,
      units,
      note: hasHazard ? 'Space has forklifts or moving vehicles. MT1 Max detects and routes around them.' : null,
      altOption: null,
      utilizationPercent: utilization(units, MT1_SPOT_SQFT_PER_HOUR),
    }
  }

  // Fallback: no specific cleaning task checked yet. Same CC1/BG1
  // escalation as the scrub-only case.
  if (hasHazard) {
    const units = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))
    return {
      label: 'Recommended',
      model: 'BG1 Pro',
      units,
      note: 'Space has forklifts or moving vehicles. BG1 Pro is built for that (3D LiDAR obstacle detection).',
      altOption: null,
      utilizationPercent: utilization(units, BG1_SQFT_PER_HOUR),
    }
  }
  const ccUnitsNeeded = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(CC1_SQFT_PER_HOUR)))
  if (ccUnitsNeeded > MAX_REASONABLE_CC1_UNITS) {
    const bg1Units = Math.max(1, Math.ceil(sqftPerWeekNeeded / weeklyCapacity(BG1_SQFT_PER_HOUR)))
    return {
      label: 'Recommended',
      model: 'BG1',
      units: bg1Units,
      note: `Roughly equivalent to ${ccUnitsNeeded}x CC1.`,
      altOption: null,
      utilizationPercent: utilization(bg1Units, BG1_SQFT_PER_HOUR),
    }
  }
  return {
    label: 'Recommended',
    model: 'CC1',
    units: ccUnitsNeeded,
    note: null,
    altOption: null,
    utilizationPercent: utilization(ccUnitsNeeded, CC1_SQFT_PER_HOUR),
  }
}

export interface HandlerRecommendation {
  model: HandlerModel
  units: number
  cycleTime: { requiredTripsPerDay: number; achievableTripsPerUnit: number }
  note: string | null
  utilizationPercent: number
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

  const fleetCapacity = achievableTripsPerUnit * units
  const utilizationPercent = fleetCapacity > 0 ? (tripsPerDay / fleetCapacity) * 100 : 0

  return {
    model,
    units,
    cycleTime: {
      requiredTripsPerDay: tripsPerDay,
      achievableTripsPerUnit: Math.round(achievableTripsPerUnit),
    },
    note,
    utilizationPercent,
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
