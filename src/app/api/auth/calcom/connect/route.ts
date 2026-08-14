import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'

/**
 * GET /api/auth/calcom/connect
 * Redirects user to Cal.com OAuth authorization page.
 * If CALCOM_CLIENT_ID is not set, redirects back to home with a clear notice.
 */
export async function GET() {
  try {
    await requireUser()

    const clientId = process.env.CALCOM_CLIENT_ID || ''
    const baseUrl = process.env.NEXTAUTH_URL || ''
    const redirectUri = `${baseUrl}/api/auth/calcom/callback`

    if (!clientId) {
      // Cal.com OAuth not yet configured by platform admin.
      // Redirect home with a clear "coming soon" notice instead of an ugly JSON error.
      return NextResponse.redirect(`${baseUrl}/?calcom=not_configured`)
    }

    const authUrl = `https://app.cal.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=bookings:read`

    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect('/login')
  }
}
