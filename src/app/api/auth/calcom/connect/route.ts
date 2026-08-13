import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'

/**
 * GET /api/auth/calcom/connect
 * Redirects user to Cal.com OAuth authorization page
 */
export async function GET() {
  try {
    const user = await requireUser()
    
    const clientId = process.env.CALCOM_CLIENT_ID || ''
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/calcom/callback`
    
    if (!clientId) {
      return NextResponse.json({ 
        error: 'Cal.com OAuth not configured. Set CALCOM_CLIENT_ID env var.' 
      }, { status: 500 })
    }

    const authUrl = `https://app.cal.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=bookings:read`
    
    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect('/login')
  }
}
