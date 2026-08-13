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
    apolloApiKey: '',
    calComApiKey: '',
    stripeSecretKey: '',
    stripeMeteredPriceId: '',
  })
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingSmartlead, setTestingSmartlead] = useState(false)
  const [testingApollo, setTestingApollo] = useState(false)
  const [testingCalCom, setTestingCalCom] = useState(false)
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null)
  const [smartleadOk, setSmartleadOk] = useState<boolean | null>(null)
  const [apolloOk, setApolloOk] = useState<boolean | null>(null)
  const [calComOk, setCalComOk] = useState<boolean | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    fetchEmailConfig()
  }, [fetchEmailConfig])

  // 同步 DB Settings到表單（只在 emailConfig.updatedAt 改變時執行，避免覆蓋使用者輸入）
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
      apolloApiKey: '',
      calComApiKey: '',
      stripeSecretKey: '',
      stripeMeteredPriceId: emailConfig.stripeMeteredPriceId ?? '',
    })
    setSmtpOk(null)
    setSmartleadOk(null)
    setApolloOk(null)
    setCalComOk(null)
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

  const handleTestSmartlead = async () => {
    if (form.smartleadApiKey) {
      await saveEmailConfig({ smartleadApiKey: form.smartleadApiKey })
    }
    setTestingSmartlead(true)
    setSmartleadOk(null)
    const result = await testEmailConfig('test-smartlead')
    setTestingSmartlead(false)
    setSmartleadOk(result.success)
    if (result.success) toast.success(result.message ?? 'Smartlead connection successful')
    else toast.error(result.error ?? 'Smartlead connection failed')
  }

  const handleTestApollo = async () => {
    if (form.apolloApiKey) {
      await saveEmailConfig({ apolloApiKey: form.apolloApiKey })
    }
    setTestingApollo(true)
    setApolloOk(null)
    const result = await testEmailConfig('test-apollo')
    setTestingApollo(false)
    setApolloOk(result.success)
    if (result.success) toast.success(result.message ?? 'Apollo API Key valid')
    else toast.error(result.error ?? 'Apollo TestFailed')
  }

  const handleTestCalCom = async () => {
    if (form.calComApiKey) {
      await saveEmailConfig({ calComApiKey: form.calComApiKey })
    }
    setTestingCalCom(true)
    setCalComOk(null)
    const result = await testEmailConfig('test-calcom' as any)
    setTestingCalCom(false)
    setCalComOk(result.success)
    if (result.success) toast.success(result.message ?? 'Cal.com API Key valid')
    else toast.error(result.error ?? 'Cal.com TestFailed')
  }

  const smtpConfigured = !!(emailConfig?.smtpHost && emailConfig?.smtpUser && emailConfig?.smtpPass && emailConfig?.smtpFromEmail)
  const smartleadConfigured = !!emailConfig?.smartleadApiKey
  const apolloConfigured = !!emailConfig?.apolloApiKey
  const calComConfigured = !!emailConfig?.calComApiKey
  const stripeConfigured = !!emailConfig?.stripeSecretKey

  return (
    <div className="space-y-5">
      {/* SMTP 區塊 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
              <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                SMTP Built-in Sending
                {smtpConfigured ? (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Not configured
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                適合Test / 少量Email（每天 &lt; 50 emails）。直接透過你的 SMTP 伺服器寄出。
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={form.smtpHost}
                onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                placeholder="smtp.gmail.com / smtp.sendgrid.net / email-smtp.us-east-1.amazonaws.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                value={form.smtpPort}
                onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
                placeholder="587 / 465"
                type="number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-user">Username</Label>
              <Input
                id="smtp-user"
                value={form.smtpUser}
                onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
                placeholder="your@gmail.com or apikey"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-pass">
                Password / API Key
                {emailConfig?.smtpPass && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (current: {emailConfig.smtpPass}）
                  </span>
                )}
              </Label>
              <Input
                id="smtp-pass"
                type="password"
                value={form.smtpPass}
                onChange={(e) => setForm((f) => ({ ...f, smtpPass: e.target.value }))}
                placeholder={emailConfig?.smtpPass ? '••••••••(leave empty to keep current)' : '輸入Passwordor API Key'}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-name">SenderName</Label>
              <Input
                id="smtp-from-name"
                value={form.smtpFromName}
                onChange={(e) => setForm((f) => ({ ...f, smtpFromName: e.target.value }))}
                placeholder="Alex from GrowthForge"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-email">Sender Email</Label>
              <Input
                id="smtp-from-email"
                type="email"
                value={form.smtpFromEmail}
                onChange={(e) => setForm((f) => ({ ...f, smtpFromEmail: e.target.value }))}
                placeholder="alex@growthforge.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <Switch
                id="smtp-secure"
                checked={form.smtpSecure}
                onCheckedChange={(v) => setForm((f) => ({ ...f, smtpSecure: v }))}
              />
              <Label htmlFor="smtp-secure" className="text-sm cursor-pointer">
                Use SSL/TLS (Port 465 usually needs this; 587 usually does not)
              </Label>
            </div>
          </div>

          {smtpOk !== null && (
            <div
              className={`flex items-center gap-2 rounded-md p-2 text-xs ${
                smtpOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              {smtpOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {smtpOk ? 'SMTP connection successful! Ready to send.' : 'SMTP connection failed. Please check settings.'}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Save Settings
            </Button>
            <Button onClick={handleTestSmtp} disabled={testingSmtp} size="sm">
              {testingSmtp ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Testing connection...
                </>
              ) : (
                <>
                  <Plug className="mr-1 h-3.5 w-3.5" />
                  Test SMTP Connection
                </>
              )}
            </Button>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs space-y-1.5 text-blue-700 dark:text-blue-300">
            <p className="font-medium flex items-center gap-1">
              <Mail className="h-3 w-3" /> Common SMTP Services
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono">
              <span>• Gmail: smtp.gmail.com:587(needs App Password)</span>
              <span>• SendGrid: smtp.sendgrid.net:587（user: apikey）</span>
              <span>• Mailgun: smtp.mailgun.org:587</span>
              <span>• AWS SES: email-smtp.us-east-1.amazonaws.com:587</span>
              <span>• Outlook: smtp.office365.com:587</span>
              <span>• Zoho: smtp.zoho.com:465（SSL）</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Smartlead 區塊 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-violet-100 dark:bg-violet-950/50 p-2">
            <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Smartlead Push
              {smartleadConfigured ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Not configured
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              For scaled production sending. Pushes leads and AI content to Smartlead for professional delivery (IP warmup, tracking, A/B testing).
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="smartlead-key" className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Smartlead API Key
              {emailConfig?.smartleadApiKey && (
                <span className="text-xs text-muted-foreground">
                  (current: {emailConfig.smartleadApiKey}）
                </span>
              )}
            </Label>
            <Input
              id="smartlead-key"
              type="password"
              value={form.smartleadApiKey}
              onChange={(e) => setForm((f) => ({ ...f, smartleadApiKey: e.target.value }))}
              placeholder={emailConfig?.smartleadApiKey ? '••••••••(leave empty to keep current)' : 'Go to Smartlead dashboard → API → Copy API Key'}
            />
          </div>

          {smartleadOk !== null && (
            <div
              className={`flex items-center gap-2 rounded-md p-2 text-xs ${
                smartleadOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              {smartleadOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {smartleadOk ? 'Smartlead connection successful! Ready to push leads.' : 'Smartlead connection failed. Please check API Key.'}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleTestSmartlead} disabled={testingSmartlead} size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
              {testingSmartlead ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Testing connection...
                </>
              ) : (
                <>
                  <Plug className="mr-1 h-3.5 w-3.5" />
                  Test Smartlead Connection
                </>
              )}
            </Button>
          </div>

          <a
            href="https://app.smartlead.ai/app/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Get Smartlead API Key
          </a>
        </div>
      </Card>

      {/* Apollo.io 區塊 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-100 dark:bg-cyan-950/50 p-2">
            <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Apollo.io 找 Email
              {apolloConfigured ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Not configured（將用 AI 預測）
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              找出 VP Sales / Director / CEO / Founder 等Decision Maker的驗證 email。Not configured時自動切換 AI 模式。
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="apollo-key" className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Apollo API Key
              {emailConfig?.apolloApiKey && (
                <span className="text-xs text-muted-foreground">
                  (current: {emailConfig.apolloApiKey}）
                </span>
              )}
            </Label>
            <Input
              id="apollo-key"
              type="password"
              value={form.apolloApiKey}
              onChange={(e) => setForm((f) => ({ ...f, apolloApiKey: e.target.value }))}
              placeholder={emailConfig?.apolloApiKey ? '••••••••(leave empty to keep current)' : '至 Apollo → Settings → API Keys 取得'}
            />
          </div>

          {apolloOk !== null && (
            <div
              className={`flex items-center gap-2 rounded-md p-2 text-xs ${
                apolloOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              {apolloOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {apolloOk ? 'Apollo API Key valid！可以使用 Apollo 找 email。' : 'Apollo API Key invalidorTestFailed。'}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleTestApollo}
              disabled={testingApollo}
              size="sm"
              variant="outline"
            >
              {testingApollo ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Plug className="mr-1 h-3.5 w-3.5" />
                  Test Apollo API
                </>
              )}
            </Button>
          </div>

          <div className="rounded-md bg-cyan-50 dark:bg-cyan-950/30 p-3 text-xs space-y-1.5 text-cyan-700 dark:text-cyan-300">
            <p className="font-medium">Not configured Apollo 時怎麼運作？</p>
            <ul className="space-y-0.5 ml-3 list-disc text-cyan-700 dark:text-cyan-400">
              <li>AI 透過 LinkedIn Search找出 VP Sales / Director / CEO 等Decision Maker</li>
              <li>從姓名 + Company網域預測 email 格式（first.last@company.com 等 8 種常見格式）</li>
              <li>Confidence is medium (recommend Apollo verification)</li>
            </ul>
          </div>

          <a
            href="https://app.apollo.io/#/settings/integrations/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Get Apollo API Key
          </a>
        </div>
      </Card>

      {/* Cal.com 區塊 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-rose-100 dark:bg-rose-950/50 p-2">
            <Calendar className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Cal.com meetings追蹤
              {calComConfigured ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />Not configured
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Automatically track meetings booked by prospects，after connecting webhook「Meetings Booked」KPI 自動 +1
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="calcom-key" className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Cal.com API Key
              {emailConfig?.calComApiKey && (
                <span className="text-xs text-muted-foreground">(current: {emailConfig.calComApiKey}）</span>
              )}
            </Label>
            <Input
              id="calcom-key"
              type="password"
              value={form.calComApiKey}
              onChange={(e) => setForm((f) => ({ ...f, calComApiKey: e.target.value }))}
              placeholder={emailConfig?.calComApiKey ? '••••••••(leave empty to keep current)' : '至 Cal.com → Settings → API 取得'}
            />
          </div>

          {calComOk !== null && (
            <div className={`flex items-center gap-2 rounded-md p-2 text-xs ${
              calComOk ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}>
              {calComOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {calComOk ? 'Cal.com API Key valid！' : 'Cal.com API Key invalid。'}
            </div>
          )}

          <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 p-3 text-xs space-y-1.5 text-rose-700 dark:text-rose-300">
            <p className="font-medium">Settings webhook 接收meetings事件</p>
            <p className="font-mono text-[11px]">URL: https://your-domain.com/api/webhooks/calcom</p>
            <p className="text-rose-700 dark:text-rose-400">Subscribe to events:booking.created, booking.cancelled</p>
          </div>

          <a
            href="https://app.cal.com/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Get Cal.com API Key
          </a>
        </div>
      </Card>

      {/* Stripe 區塊 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/50 p-2">
            <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Stripe 計費
              {stripeConfigured ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />Not configured
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Metered billing：依SendEmail數計費，Stripe auto-charges at month end
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stripe-key" className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Stripe Secret Key
              {emailConfig?.stripeSecretKey && (
                <span className="text-xs text-muted-foreground">(current: {emailConfig.stripeSecretKey}）</span>
              )}
            </Label>
            <Input
              id="stripe-key"
              type="password"
              value={form.stripeSecretKey}
              onChange={(e) => setForm((f) => ({ ...f, stripeSecretKey: e.target.value }))}
              placeholder={emailConfig?.stripeSecretKey ? '••••••••(leave empty to keep current)' : 'sk_live_... or sk_test_...'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stripe-price">Metered Price ID</Label>
            <Input
              id="stripe-price"
              value={form.stripeMeteredPriceId}
              onChange={(e) => setForm((f) => ({ ...f, stripeMeteredPriceId: e.target.value }))}
              placeholder="price_... (usage_type=metered)"
            />
          </div>

          <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 p-3 text-xs space-y-1.5 text-indigo-700 dark:text-indigo-300">
            <p className="font-medium">Stripe Webhook Settings</p>
            <p className="font-mono text-[11px]">URL: https://your-domain.com/api/webhooks/stripe</p>
            <p className="text-indigo-700 dark:text-indigo-400">訂閱：customer.subscription.created/updated/deleted, invoice.payment_succeeded/failed</p>
          </div>

          <a
            href="https://dashboard.stripe.com/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            前往 Stripe Settings Webhook
          </a>
        </div>
      </Card>

      <Separator />

      {/* 說明 */}
      <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <Send className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-medium text-amber-800 dark:text-amber-300">兩種Email方式怎麼選？</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-amber-700 dark:text-amber-400">
              <div>
                <p className="font-semibold mb-1">▸ SMTP Built-in Sending</p>
                <ul className="space-y-0.5 ml-3 list-disc">
                  <li>Zero cost, ready to use</li>
                  <li>每天 50 emails以下最適合</li>
                  <li>No IP warmup, no tracking</li>
                  <li>Easily blocked by spam filters</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">▸ Smartlead Push</p>
                <ul className="space-y-0.5 ml-3 list-disc">
                  <li>Starts at $39/month</li>
                  <li>每週數千emails也 OK</li>
                  <li>Auto IP warmup + tracking</li>
                  <li>A/B testing, multi-mailbox rotation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
