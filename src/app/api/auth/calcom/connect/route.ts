import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'

// Cal.com OAuth credentials — hardcoded because Vercel env vars are unreliable
const CALCOM_CLIENT_ID = '6020c29591603206027afe1afe0fdc7a06cbaf0ad10b402cf286883b2764021d'

export async function GET() {
  try {
    await requireUser()

    const clientId = process.env.CALCOM_CLIENT_ID || CALCOM_CLIENT_ID
    const baseUrl = process.env.NEXTAUTH_URL || 'https://leadforge-ai-5t3a.vercel.app'
    const redirectUri = `${baseUrl}/api/auth/calcom/callback`

    const authUrl = `https://app.cal.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=bookings:read`

    return NextResponse.redirect(authUrl)
  } catch {
    return NextResponse.redirect('/login')
  }
}
