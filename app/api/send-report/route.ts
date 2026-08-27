import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { RobotCategory } from '@/lib/calculations'

const NAVY = '#081520'
const GREEN = '#00BF63'

const INTENT_LABELS: Record<string, string> = {
  raas: 'Explore RaaS (from $399/month)',
  quote: 'Purchase quote',
  'report-only': 'Just send the report',
}

interface SendReportBody {
  firstName: string
  email: string
  company?: string
  intent: string
  monthlyLabourCost: number
  tenYearSavings: number
  breakEvenYear: number | null
  robotCategory: RobotCategory
  robotModel: 'CC1' | 'MT1' | 'T300' | 'T600' | null
  robotUnits: number
  robotPrice: number
}

function robotSummary(data: SendReportBody): string {
  if (!data.robotModel) return 'Not selected'
  return `${data.robotUnits}x ${data.robotModel} (est. ${currency(data.robotPrice)}, exact pricing confirmed with the team)`
}

function currency(value: number) {
  return value.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  })
}

function customerEmailHtml(data: SendReportBody) {
  const breakEvenText = data.breakEvenYear ? `Year ${data.breakEvenYear}` : 'Beyond 10 years'
  const followUp =
    data.intent !== 'report-only'
      ? `<p style="margin:0 0 16px;">Our GTA team will be in touch shortly.</p>`
      : ''

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #171717;">
    <div style="background-color: ${NAVY}; padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 22px; margin: 0;">Reliable Robots</h1>
    </div>
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px;">Hi ${data.firstName},</p>
      <p style="margin: 0 0 24px;">Here is your labour cost analysis.</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Monthly Labour Cost</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${currency(data.monthlyLabourCost)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Recommended Robot</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${robotSummary(data)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">10-Year Savings</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: ${GREEN}; font-weight: bold;">${currency(data.tenYearSavings)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Break-Even Year</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${breakEvenText}</td>
        </tr>
      </table>

      ${followUp}

      <p style="margin: 0 0 4px;">Questions? Reach us at:</p>
      <p style="margin: 0 0 24px;">(888) 747-8992 &nbsp;|&nbsp; info@reliablerobots.ca</p>
    </div>
    <div style="background-color: #F4F6F9; padding: 20px 24px; text-align: center; font-size: 12px; color: #666;">
      Reliable Robots, Toronto ON
    </div>
  </div>
  `
}

function notificationEmailHtml(data: SendReportBody) {
  const breakEvenText = data.breakEvenYear ? `Year ${data.breakEvenYear}` : 'Beyond 10 years'
  const intentLabel = INTENT_LABELS[data.intent] || data.intent

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #171717;">
    <h2 style="color: ${NAVY};">New ROI Calculator Lead</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">First Name</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${data.firstName}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${data.email}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Company</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${data.company || 'N/A'}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Intent</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${intentLabel}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Monthly Labour Cost</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${currency(data.monthlyLabourCost)}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Recommended Robot</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${robotSummary(data)}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">10-Year Savings</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${currency(data.tenYearSavings)}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Break-Even Year</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${breakEvenText}</td></tr>
    </table>
  </div>
  `
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendReportBody

    if (!body.firstName || !body.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    const customerResult = await resend.emails.send({
      from: fromEmail,
      to: body.email,
      subject: 'Your ROI Report from Reliable Robots',
      html: customerEmailHtml(body),
    })

    if (customerResult.error) {
      return NextResponse.json({ error: customerResult.error.message }, { status: 500 })
    }

    const notifyResult = await resend.emails.send({
      from: fromEmail,
      to: 'info@reliablerobots.ca',
      subject: `New ROI Calculator Lead: ${body.firstName} at ${body.company || 'N/A'}`,
      html: notificationEmailHtml(body),
    })

    if (notifyResult.error) {
      return NextResponse.json({ error: notifyResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
