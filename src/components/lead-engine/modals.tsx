'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

const EMPTY_FORM = {
  company: '',
  contactName: '',
  title: '',
  email: '',
  linkedinUrl: '',
  website: '',
  industry: '',
  companySize: '',
  location: '',
}

interface AddLeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddLeadModal({ open, onOpenChange }: AddLeadModalProps) {
  const createLead = useLeadStore((s) => s.createLead)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const handleClose = (open: boolean) => {
    if (!open) {
      setForm(EMPTY_FORM)
    }
    onOpenChange(open)
  }

  const handleSubmit = async () => {
    if (!form.company.trim()) {
      toast.error('CompanyName為Required')
      return
    }
    setSubmitting(true)
    const result = await createLead(form)
    setSubmitting(false)
    if (result) {
      toast.success(`已Add Lead：${form.company}`)
      handleClose(false)
    } else {
      toast.error('AddFailed，please retry')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription>
            手動Add一leads。Add後可直接在試算表中觸發 AI Research與Email生成。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="company">CompanyName *</Label>
            <Input
              id="company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="例如：Acme Inc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Company網站</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://acme.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="SaaS / E-commerce / ..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Contact姓名</Label>
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="VP of Sales"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="john@acme.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              value={form.linkedinUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companySize">Company規模</Label>
            <Input
              id="companySize"
              value={form.companySize}
              onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
              placeholder="50-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Taipei / San Francisco"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Add Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleImport = async () => {
    if (!text.trim()) {
      toast.error('請貼上 JSON 或 CSV 內容')
      return
    }
    setSubmitting(true)
    try {
      let leads: Record<string, unknown>[] = []

      // 嘗試 JSON
      try {
        const parsed = JSON.parse(text)
        leads = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        // 嘗試 CSV（簡易解析）
        const lines = text.trim().split('\n')
        if (lines.length < 2) {
          toast.error('無法解析：請提供 JSON 或帶標頭的 CSV')
          setSubmitting(false)
          return
        }
        const headers = lines[0].split(',').map((h) => h.trim())
        leads = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim())
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => {
            obj[h] = values[i]
          })
          return obj
        })
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`SuccessImport ${data.count} leads`)
        onOpenChange(false)
        setText('')
        // 重新載入
        window.location.reload()
      } else {
        toast.error('ImportFailed')
      }
    } catch {
      toast.error('解析Failed，please check format')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ImportLeads</DialogTitle>
          <DialogDescription>
            貼上 JSON 陣列或帶標頭的 CSV。支援欄位：company, contactName, title, email,
            linkedinUrl, website, industry, companySize, location
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={`CSV 範例：
company,contactName,title,email,website,industry
Acme Inc.,John Doe,VP Sales,john@acme.com,https://acme.com,SaaS

JSON 範例：
[{"company":"Acme Inc.","website":"https://acme.com"}]`}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={submitting}>
            {submitting ? 'Import中...' : '開始Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
