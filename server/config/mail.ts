import nodemailer from 'nodemailer'
import { createChildLogger } from '../services/logger.js'

const log = createChildLogger({ module: 'mail' })

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT) || 587
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS

export const mailFrom = process.env.MAIL_FROM || 'noreply@digitalkhata.com'

export const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    })
  : null

if (!transporter) {
  log.warn('SMTP not configured — verification emails will be logged to console instead')
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    log.info({ to, subject }, 'DEV MODE — email not sent (SMTP not configured)')
    console.log('\n═══════════════════════════════════════════')
    console.log(`TO: ${to}`)
    console.log(`SUBJECT: ${subject}`)
    console.log('───────────────────────────────────────────')
    console.log(html.replace(/<[^>]*>/g, ''))
    console.log('═══════════════════════════════════════════\n')
    return false
  }

  try {
    await transporter.sendMail({
      from: mailFrom,
      to,
      subject,
      html,
    })
    return true
  } catch (err) {
    log.error({ err }, 'Failed to send email')
    return false
  }
}
