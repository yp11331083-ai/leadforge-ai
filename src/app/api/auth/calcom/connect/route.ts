import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'

// Hardcoded — must match the redirect URI registered in Cal.com OAuth app
const CALCOM_CLIENT_ID = '6020c29591603206027afe1afe0fdc7a06cbaf0ad10b402cf286883b2764021d'
const CALCOM_REDIRECT_URI = 'https://leadforge-ai-5t3a.vercel.app/api/auth/calcom/callback'

export async function GET() {
  try {
    await requireUser()

    const clientId = process.env.CALCOM_CLIENT_ID || CALCOM_CLIENT_ID

    // Cal.com v2 OAuth uses /auth (not /oauth/authorize)
    // It redirects to login page, then back to authorization
    const authUrl = `https://app.cal.com/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(CALCOM_REDIRECT_URI)}&scope=bookings:read`

    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect('/login')
  }
}
