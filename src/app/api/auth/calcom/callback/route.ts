import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

/**
 * GET /api/auth/calcom/callback?code=AUTH_CODE
 * 
 * Cal.com OAuth flow:
 * 1. Receives authorization code from Cal.com
 * 2. Exchanges code for access token
 * 3. Auto-registers webhook (booking.created, booking.cancelled)
 * 4. Saves Cal.com connection to tenant's EmailConfig
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?view=admin&calcom_error=${error}`)
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?view=admin&calcom_error=no_code`)
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login`)
    }

    const user = session.user as any
    const tenantId = user.tenantId

    // Exchange code for access token
    // Cal.com OAuth credentials — hardcoded because Vercel env vars are unreliable
    const clientId = process.env.CALCOM_CLIENT_ID || '6020c29591603206027afe1afe0fdc7a06cbaf0ad10b402cf286883b2764021d'
    const clientSecret = process.env.CALCOM_CLIENT_SECRET || '9e2cbc504707171937b27eca48700e1a55d8a66c09f6cc8e09e6b647a6274848'
    const redirectUri = `${process.env.NEXTAUTH_URL || 'https://leadforge-ai-5t3a.vercel.app'}/api/auth/calcom/callback`

    const tokenRes = await fetch('https://api.cal.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('Cal.com token exchange failed:', tokenRes.status, errText)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?view=admin&calcom_error=token_failed`)
    }

    const tokenData = await tokenRes.json() as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    const accessToken = tokenData.access_token
    if (!accessToken) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?view=admin&calcom_error=no_token`)
    }

    // Auto-register webhook for this user
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/calcom`
    
    const webhookRes = await fetch('https://api.cal.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        subscriberUrl: webhookUrl,
        eventTriggers: ['BOOKING_CREATED', 'BOOKING_CANCELLED'],
        active: true,
      }),
    })

    const webhookCreated = webhookRes.ok
    if (!webhookCreated) {
      console.warn('Cal.com webhook auto-registration failed (non-blocking)')
    }

    // Save Cal.com connection to EmailConfig
    // Store the access token as the calComApiKey (used for future API calls)
    await db.emailConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        calComApiKey: accessToken,
      },
      update: {
        calComApiKey: accessToken,
      },
    })

    // Redirect back to admin with success indicator
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?view=admin&calcom_connected=true${webhookCreated ? '&webhook=auto' : '&webhook=manual'}`
    )
  } catch (error) {
    console.error('Cal.com OAuth callback error:', error)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?view=admin&calcom_error=exception`)
  }
}
