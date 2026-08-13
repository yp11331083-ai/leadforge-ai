'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Mail,
  Send,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  KeyRound,
  ExternalLink,
  Plug,
  Users,
  Calendar,
  CreditCard,
  ChevronDown,
  Zap,
  Shield,
  Settings2,
  Copy,
  Sparkles,
} from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

export function EmailSendingPanel() {
  const emailConfig = useLeadStore((s) => s.emailConfig)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const saveEmailConfig = useLeadStore((s) => s.saveEmailConfig)
  const testEmailConfig = useLeadStore((s) => s.testEmailConfig)

  const [form, setForm] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFromName: '',
    smtpFromEmail: '',
    smtpSecure: false,
    smartleadApiKey: '',
  })
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    fetchEmailConfig()
  }, [fetchEmailConfig])

  const configKey = emailConfig?.updatedAt ?? ''
  if (emailConfig && configKey !== lastSyncedAt) {
    setLastSyncedAt(configKey)
    setForm({
      smtpHost: emailConfig.smtpHost ?? '',
      smtpPort: emailConfig.smtpPort?.toString() ?? '587',
      smtpUser: emailConfig.smtpUser ?? '',
      smtpPass: '',
      smtpFromName: emailConfig.smtpFromName ?? '',
      smtpFromEmail: emailConfig.smtpFromEmail ?? '',
      smtpSecure: emailConfig.smtpSecure,
      smartleadApiKey: '',
    })
    setSmtpOk(null)
  }

  const handleSave = async () => {
    setSaving(true)
    await saveEmailConfig(form)
    setSaving(false)
    toast.success('Settings saved')
  }

  const handleTestSmtp = async () => {
    if (form.smtpHost || form.smtpUser || form.smtpPass) {
      await saveEmailConfig(form)
    }
    setTestingSmtp(true)
    setSmtpOk(null)
    const result = await testEmailConfig('test-smtp')
    setTestingSmtp(false)
    setSmtpOk(result.success)
    if (result.success) toast.success(result.message ?? 'SMTP connection successful')
    else toast.error(result.error ?? 'SMTP connection failed')
  }

  const handleCopyWebhook = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/calcom`
    navigator.clipboard.writeText(webhookUrl)
    toast.success('Webhook URL copied!')
  }

  const smtpConfigured = !!(emailConfig?.smtpHost && emailConfig?.smtpUser && emailConfig?.smtpPass && emailConfig?.smtpFromEmail)
  const smartleadConfigured = !!emailConfig?.smartleadApiKey

  return (
    <div className="space-y-5">
      {/* ===== 1. Quick Connect (OAuth) ===== */}
      <Card className="p-5 space-y-4 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
            <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Quick Connect
              <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                Recommended
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">One-click OAuth — no technical setup needed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Google Workspace */}
          <div className={`rounded-lg border p-4 transition-all ${
            smtpConfigured
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-border/60 hover:border-emerald-300 dark:hover:border-emerald-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Google Workspace</p>
                  <p className="text-xs text-muted-foreground">
                    {smtpConfigured ? `Connected: ${emailConfig?.smtpFromEmail ?? emailConfig?.smtpUser}` : 'Connect your Gmail or Google Workspace account'}
                  </p>
                </div>
              </div>
              {smtpConfigured ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Button size="sm" onClick={() => toast.info('Google Workspace OAuth setup required')} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                  <Plug className="mr-1.5 h-3.5 w-3.5" /> Connect
                </Button>
              )}
            </div>
          </div>

          {/* Microsoft 365 */}
          <div className="rounded-lg border border-border/60 p-4 hover:border-blue-300 dark:hover:border-blue-800 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Microsoft 365 / Outlook</p>
                  <p className="text-xs text-muted-foreground">Connect your Outlook or Microsoft 365 account</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast.info('Microsoft 365 OAuth setup required')}>
                <Plug className="mr-1.5 h-3.5 w-3.5" /> Connect
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
          <Shield className="h-3 w-3 mt-0.5 shrink-0" />
          <span>OAuth is the most secure method. We never see or store your password — you authorize access directly with Google/Microsoft.</span>
        </div>
      </Card>

      {/* ===== 2. Advanced SMTP (Collapsible) ===== */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card className="p-5">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 p-2">
                  <Settings2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Advanced: Custom SMTP / Dedicated IP
                    {smtpConfigured && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Configured
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">For AWS SES, SendGrid, Mailgun, or self-hosted servers</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input id="smtp-host" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} placeholder="smtp.gmail.com / smtp.sendgrid.net" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input id="smtp-port" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} placeholder="587 / 465" type="number" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-user">Username</Label>
                  <Input id="smtp-user" value={form.smtpUser} onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))} placeholder="apikey or your@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-pass">Password / API Key {emailConfig?.smtpPass && <span className="text-xs text-muted-foreground">(current: {emailConfig.smtpPass})</span>}</Label>
                  <Input id="smtp-pass" type="password" value={form.smtpPass} onChange={(e) => setForm((f) => ({ ...f, smtpPass: e.target.value }))} placeholder={emailConfig?.smtpPass ? '•••••••• (leave empty to keep)' : 'Enter password or API key'} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-from-name">From Name</Label>
                  <Input id="smtp-from-name" value={form.smtpFromName} onChange={(e) => setForm((f) => ({ ...f, smtpFromName: e.target.value }))} placeholder="Alex from Forge" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-from-email">From Email</Label>
                  <Input id="smtp-from-email" type="email" value={form.smtpFromEmail} onChange={(e) => setForm((f) => ({ ...f, smtpFromEmail: e.target.value }))} placeholder="alex@yourcompany.com" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Switch id="smtp-secure" checked={form.smtpSecure} onCheckedChange={(v) => setForm((f) => ({ ...f, smtpSecure: v }))} />
                  <Label htmlFor="smtp-secure" className="text-sm cursor-pointer">Use SSL/TLS (Port 465 usually needs this; 587 usually does not)</Label>
                </div>
              </div>
              {smtpOk !== null && (
                <div className={`flex items-center gap-2 rounded-md p-2 text-xs ${smtpOk ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'}`}>
                  {smtpOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {smtpOk ? 'SMTP connection successful! Ready to send.' : 'SMTP connection failed. Please check settings.'}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">{saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save</Button>
                <Button onClick={handleTestSmtp} disabled={testingSmtp} size="sm">{testingSmtp ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Testing...</> : <><Plug className="mr-1 h-3.5 w-3.5" /> Test Connection</>}</Button>
              </div>
              <div className="rounded-md bg-muted/30 p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Common SMTP Services</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[11px]">
                  <span>• Gmail: smtp.gmail.com:587 (App Password)</span>
                  <span>• SendGrid: smtp.sendgrid.net:587 (user: apikey)</span>
                  <span>• Mailgun: smtp.mailgun.org:587</span>
                  <span>• AWS SES: email-smtp.us-east-1.amazonaws.com:587</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Separator />

      {/* ===== 3. Lead Credits (Apollo — Platform-managed) ===== */}
      <Card className="p-5 space-y-3 border-cyan-200 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-950/10">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-100 dark:bg-cyan-950/50 p-2">
            <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Lead Credits
              <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Active
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">AI-powered email finding & enrichment — powered by Forge AI</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-white/60 dark:bg-cyan-950/20 p-3">
          <Sparkles className="h-8 w-8 text-cyan-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Email enrichment is built-in</p>
            <p className="text-xs text-muted-foreground">Finding verified emails for VP Sales / CEO / Founder uses your Lead Credits balance. No API key needed — we handle it for you.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/?view=billing'}>
            View Credits
          </Button>
        </div>
      </Card>

      {/* ===== 4. Cal.com Meeting Tracking (Platform-provided URL) ===== */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-rose-100 dark:bg-rose-950/50 p-2">
            <Calendar className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Cal.com Meeting Tracking</h2>
            <p className="text-xs text-muted-foreground">Track meetings booked by your prospects automatically</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Copy Webhook URL */}
          <div className="rounded-lg border border-border/60 p-3">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Your Webhook URL (copy this)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted/40 px-2 py-1.5 rounded truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/calcom` : '/api/webhooks/calcom'}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyWebhook} className="shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 p-3 text-xs space-y-1.5 text-rose-700 dark:text-rose-300">
            <p className="font-medium">Setup instructions:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Log in to your <a href="https://app.cal.com/settings/webhooks" target="_blank" rel="noopener noreferrer" className="underline">Cal.com Webhooks settings</a></li>
              <li>Click "Add Webhook"</li>
              <li>Paste the URL above into "Endpoint URL"</li>
              <li>Select events: <code className="px-1 bg-rose-100 dark:bg-rose-950/60 rounded">booking.created</code> and <code className="px-1 bg-rose-100 dark:bg-rose-950/60 rounded">booking.cancelled</code></li>
              <li>Save — meetings will auto-appear in your Analytics</li>
            </ol>
          </div>

          <a href="https://app.cal.com/settings/webhooks" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline">
            <ExternalLink className="h-3 w-3" /> Open Cal.com Webhook Settings
          </a>
        </div>
      </Card>

      {/* ===== 5. Smartlead (Optional / Advanced) ===== */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-violet-100 dark:bg-violet-950/50 p-2">
            <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Smartlead Integration
              <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                Optional
              </Badge>
              {smartleadConfigured && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">For high-volume sending with IP warmup, tracking & A/B testing. If you have your own Smartlead account.</p>
          </div>
        </div>

        <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
          <p><b>Not required for most users.</b> Google/Microsoft OAuth already handles sending. Only connect Smartlead if you need dedicated IP warmup or advanced A/B testing.</p>
        </div>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              {smartleadConfigured ? 'Update Smartlead API Key' : 'Connect Smartlead (Advanced)'}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="smartlead-key" className="flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3" /> Smartlead API Key
                  {emailConfig?.smartleadApiKey && <span className="text-xs text-muted-foreground">(current: {emailConfig.smartleadApiKey})</span>}
                </Label>
                <Input id="smartlead-key" type="password" value={form.smartleadApiKey} onChange={(e) => setForm((f) => ({ ...f, smartleadApiKey: e.target.value }))} placeholder={emailConfig?.smartleadApiKey ? '•••••••• (leave empty to keep)' : 'Go to Smartlead → Settings → API → Copy Key'} />
              </div>
              <a href="https://app.smartlead.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline">
                <ExternalLink className="h-3 w-3" /> Get Smartlead API Key
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ===== 6. Stripe (Platform-managed — hidden from user) ===== */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 p-4 flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-slate-400 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-slate-600 dark:text-slate-400">Billing is managed by Forge AI</p>
          <p>Subscription and credits are handled automatically. Visit the Billing tab to view your plan and usage.</p>
        </div>
      </div>

      {/* Save button */}
      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Send className="mr-2 h-4 w-4" /> Save Settings</>}
      </Button>
    </div>
  )
}
