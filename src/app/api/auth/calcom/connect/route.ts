import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import crypto from 'crypto'

// Hardcoded — must match the redirect URI registered in Cal.com OAuth app
const CALCOM_CLIENT_ID = '6020c29591603206027afe1afe0fdc7a06cbaf0ad10b402cf286883b2764021d'
const CALCOM_REDIRECT_URI = 'https://leadforge-ai-5t3a.vercel.app/api/auth/calcom/callback'

export async function GET() {
  try {
    await requireUser()

    const clientId = process.env.CALCOM_CLIENT_ID || CALCOM_CLIENT_ID

    // PKCE: generate code_verifier and code_challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    // Store code_verifier in a cookie so the callback can use it
    const authUrl = `https://app.cal.com/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(CALCOM_REDIRECT_URI)}&scope=bookings:read&code_challenge=${codeChallenge}&code_challenge_method=S256`

    const response = NextResponse.redirect(authUrl)
    // Store code_verifier in cookie (httpOnly, 10 min expiry)
    response.cookies.set('calcom_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch {
    return NextResponse.redirect('/login')
  }
}
