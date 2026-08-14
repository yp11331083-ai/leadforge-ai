'use client'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Building2, Package } from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'

export function SenderConfigPanel() {
  const senderConfig = useLeadStore((s) => s.senderConfig)
  const setSenderConfig = useLeadStore((s) => s.setSenderConfig)

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
          <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Sender Settings</h2>
          <p className="text-xs text-muted-foreground">
            AI uses these details as context when generating personalized emails
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sender-name" className="flex items-center gap-1.5">
            <User className="h-3 w-3" /> Sender Name
          </Label>
          <Input
            id="sender-name"
            value={senderConfig.senderName}
            onChange={(e) => setSenderConfig({ senderName: e.target.value })}
            placeholder="Your name"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="sender-company" className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Your Company
          </Label>
          <Input
            id="sender-company"
            value={senderConfig.senderCompany}
            onChange={(e) => setSenderConfig({ senderCompany: e.target.value })}
            placeholder="Your company name"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="sender-product" className="flex items-center gap-1.5">
            <Package className="h-3 w-3" /> Product / Service
          </Label>
          <Textarea
            id="sender-product"
            value={senderConfig.senderProduct}
            onChange={(e) => setSenderConfig({ senderProduct: e.target.value })}
            placeholder="One sentence describing what your product does for customers"
            rows={3}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tone</Label>
            <Select
              value={senderConfig.tone}
              onValueChange={(v) =>
                setSenderConfig({ tone: v as typeof senderConfig.tone })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Email Language</Label>
            <Select
              value={senderConfig.language}
              onValueChange={(v) =>
                setSenderConfig({ language: v as typeof senderConfig.language })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-TW">繁體中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  )
}
