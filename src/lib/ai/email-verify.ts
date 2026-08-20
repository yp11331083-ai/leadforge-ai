import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns/promises'

export type EmailVerificationResult = 'verified' | 'invalid' | 'unknown'

interface SmtpCheckOutcome {
  code: number
  message: string
}

const CONNECT_TIMEOUT = 8000
const RESPONSE_TIMEOUT = 8000
const TOTAL_SESSION_TIMEOUT = 20000

/** Resolve the lowest-priority (highest preference) MX host for a domain. */
async function resolveMxHost(domain: string): Promise<string | null> {
  try {
    const mx = await dns.resolveMx(domain)
    if (mx.length === 0) return null
    mx.sort((a, b) => a.priority - b.priority)
    return mx[0].exchange
  } catch {
    // No MX → domain can't receive mail at all (e.g. many seed-stage sites)
    return null
  }
}

/**
 * A tiny state-machine SMTP client. Sends EHLO → (STARTTLS + re-EHLO when
 * advertised) → MAIL FROM → RCPT TO → QUIT. Never transmits message data, so
 * nothing is delivered.
 *
 * Google/Office365 only reveal whether a mailbox exists *after* TLS, so plain
 * EHLO would always answer 250 for any local-part. This matters: without TLS a
 * junk address on a Gmail MX gets "250 OK" and we'd wrongly call it verified.
 */
function smtpRcpt(mxHost: string, from: string, to: string): Promise<SmtpCheckOutcome> {
  return new Promise((resolve) => {
    const raw = net.createConnection({ host: mxHost, port: 25 })
    let socket: net.Socket | tls.TLSSocket = raw
    let buffer = ''
    let settled = false
    let phase: 'greeting' | 'ehlo' | 'starttls' | 'ehlo2' | 'mail' | 'rcpt' = 'greeting'

    const finish = (code: number, message: string) => {
      if (settled) return
      settled = true
      try { socket.write('QUIT\r\n') } catch {}
      setTimeout(() => { try { socket.destroy() } catch {} }, 300)
      resolve({ code, message })
    }

    const failTimer = setTimeout(() => finish(-1, 'timeout'), TOTAL_SESSION_TIMEOUT)
    const fail = (reason: string) => finish(-1, reason)

    raw.on('error', () => fail('socket-error'))
    raw.setTimeout(CONNECT_TIMEOUT, () => fail('connect-timeout'))

    const write = (line: string) => socket.write(line + '\r\n')

    const processChunk = (chunk: Buffer | string) => {
      buffer += chunk.toString()
      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n')
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)
        const match = line.match(/^(\d{3})([ -])(.*)$/)
        if (!match) continue
        const code = parseInt(match[1], 10)
        // Only final lines of multi-line replies drive the state machine
        if (match[2] !== ' ') continue

        switch (phase) {
          case 'greeting':
            if (code === 220) {
              phase = 'ehlo'
              write('EHLO outrovo-verify.local')
            } else {
              fail(`bad-greeting:${code}`)
            }
            break

          case 'ehlo':
            if (code === 250) {
              const caps = buffer.toUpperCase()
              if (caps.includes('STARTTLS')) {
                phase = 'starttls'
                write('STARTTLS')
              } else {
                phase = 'mail'
                write(`MAIL FROM:<${from}>`)
              }
            } else {
              fail(`ehlo-fail:${code}`)
            }
            break

          case 'starttls':
            if (code === 220) {
              const secure = tls.connect({
                socket: raw,
                servername: mxHost,
                rejectUnauthorized: false,
              })
              socket = secure
              secure.on('error', () => fail('tls-error'))
              secure.on('data', processChunk)
              secure.once('secureConnect', () => {
                phase = 'ehlo2'
                write('EHLO outrovo-verify.local')
              })
            } else {
              fail(`starttls-fail:${code}`)
            }
            break

          case 'ehlo2':
            if (code === 250) {
              phase = 'mail'
              write(`MAIL FROM:<${from}>`)
            } else {
              fail(`ehlo2-fail:${code}`)
            }
            break

          case 'mail':
            if (code === 250) {
              phase = 'rcpt'
              write(`RCPT TO:<${to}>`)
            } else {
              fail(`mail-from-fail:${code}`)
            }
            break

          case 'rcpt':
            clearTimeout(failTimer)
            finish(code, match[3])
            break
        }
      }
    }

    // Before STARTTLS, data arrives on the raw socket.
    socket.on('data', processChunk)
  })
}

export interface VerifyEmailOptions {
  /** Envelope sender — defaults to a neutral verification address. */
  fromEmail?: string
  /** Treat RCPT-250-accepts as verified only when the server is NOT a catch-all. */
  checkCatchAll?: boolean
}

/**
 * Verify a mailbox exists using a lightweight SMTP handshake:
 * MX lookup → connect on :25 → EHLO → [STARTTLS] → MAIL FROM → RCPT TO.
 * No message is sent, so nothing lands in anyone's inbox.
 *
 * Returns:
 *  - 'verified'  → server accepted RCPT (mailbox exists)
 *  - 'invalid'   → server rejected RCPT (mailbox does not exist)
 *  - 'unknown'   → no MX, timeout, connection refused, or catch-all server
 *                  (cannot determine — don't trust it as a real address)
 */
export async function verifyEmail(email: string, opts: VerifyEmailOptions = {}): Promise<EmailVerificationResult> {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return 'invalid'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  if (local.length === 0 || local.length > 64 || /[\s"(),:;<>@[\]]/.test(local)) return 'invalid'
  if (domain.length > 255 || domain.includes('..')) return 'invalid'
  if (!/^[a-zA-Z0-9._%+-]+$/.test(local)) return 'invalid'

  const mxHost = await resolveMxHost(domain)
  if (!mxHost) return 'unknown' // no MX → cannot receive mail → don't call it real

  const fromEmail = opts.fromEmail ?? 'verify@outrovo.app'

  const outcome = await smtpRcpt(mxHost, fromEmail, email)
  const { code } = outcome

  // 2xx → accepted
  if (code >= 200 && code < 300) {
    if (opts.checkCatchAll === false) return 'verified'
    // Catch-all check: a random local-part that can't exist should be rejected.
    // If the server accepts it too, the domain accepts everything → unknown.
    const junk = `no-such-${Math.random().toString(36).slice(2, 10)}@${domain}`
    const junkOutcome = await smtpRcpt(mxHost, fromEmail, junk)
    if (junkOutcome.code >= 200 && junkOutcome.code < 300) return 'unknown'
    return 'verified'
  }

  // 5xx → rejected (mailbox doesn't exist)
  if (code >= 500 && code < 600) return 'invalid'

  // 4xx (greylist/rate-limit) or anything else → inconclusive
  return 'unknown'
}

export async function verifyEmails(emails: string[], opts: VerifyEmailOptions = {}): Promise<Map<string, EmailVerificationResult>> {
  const results = new Map<string, EmailVerificationResult>()
  await Promise.all(
    emails.map(async (email) => {
      const normalized = email.trim().toLowerCase()
      if (!normalized) return
      results.set(normalized, await verifyEmail(normalized, opts))
    })
  )
  return results
}