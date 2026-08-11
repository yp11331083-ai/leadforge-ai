'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MoreHorizontal,
  Sparkles,
  Mail,
  Trash2,
  ChevronDown,
  Search,
  ExternalLink,
  CheckCircle2,
  Send,
  RefreshCw,
} from 'lucide-react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useLeadStore, type Lead } from '@/store/lead-store'
import { StatusBadge, ScoreBadge, ALL_STATUSES, STATUS_LABELS } from './status-badge'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

export function LeadsTable() {
  const leads = useLeadStore((s) => s.leads)
  const loading = useLeadStore((s) => s.loading)
  const updateLead = useLeadStore((s) => s.updateLead)
  const deleteLead = useLeadStore((s) => s.deleteLead)
  const researchLead = useLeadStore((s) => s.researchLead)
  const generateEmail = useLeadStore((s) => s.generateEmail)
  const setSelectedLeadId = useLeadStore((s) => s.setSelectedLeadId)
  const filterStatus = useLeadStore((s) => s.filterStatus)
  const setFilterStatus = useLeadStore((s) => s.setFilterStatus)
  const searchQuery = useLeadStore((s) => s.searchQuery)
  const setSearchQuery = useLeadStore((s) => s.setSearchQuery)

  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: 'select',
        size: 32,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'company',
        header: '公司',
        size: 180,
        cell: ({ row }) => {
          const lead = row.original
          return (
            <button
              className="text-left group"
              onClick={() => setSelectedLeadId(lead.id)}
            >
              <div className="font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {lead.company}
              </div>
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <span className="truncate max-w-[140px]">{lead.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </button>
          )
        },
      },
      {
        accessorKey: 'contactName',
        header: '聯絡人',
        size: 140,
        cell: ({ row }) => (
          <div>
            <div className="text-sm font-medium">
              {row.original.contactName || <span className="text-muted-foreground">—</span>}
            </div>
            {row.original.title && (
              <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                {row.original.title}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'industry',
        header: '產業',
        size: 110,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.industry || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'score',
        header: '分數',
        size: 100,
        cell: ({ row }) => <ScoreBadge score={row.original.score} />,
      },
      {
        accessorKey: 'status',
        header: '狀態',
        size: 110,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'emailBody',
        header: '郵件',
        size: 80,
        cell: ({ row }) =>
          row.original.emailBody ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已生成
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">未生成</span>
          ),
      },
      {
        id: 'actions',
        size: 60,
        cell: ({ row }) => {
          const lead = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>動作</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  檢視詳情
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!lead.website || actionLoading === lead.id}
                  onClick={async () => {
                    setActionLoading(lead.id)
                    toast.info(`正在研究 ${lead.company}...`)
                    const ok = await researchLead(lead.id)
                    setActionLoading(null)
                    if (ok) toast.success('研究完成')
                    else toast.error('研究失敗')
                  }}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  AI 研究
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!lead.painPoints || actionLoading === lead.id}
                  onClick={async () => {
                    setActionLoading(lead.id)
                    toast.info(`正在生成郵件...`)
                    const ok = await generateEmail(lead.id)
                    setActionLoading(null)
                    if (ok) toast.success('郵件已生成')
                    else toast.error('生成失敗')
                  }}
                >
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  生成郵件
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    變更狀態
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={lead.status}
                        onValueChange={(v) => {
                          updateLead(lead.id, { status: v })
                          toast.success(`已標記為：${STATUS_LABELS[v as Lead['status']]}`)
                        }}
                      >
                        {ALL_STATUSES.map((s) => (
                          <DropdownMenuRadioItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300"
                  onClick={() => {
                    if (confirm(`確定刪除 ${lead.company}？`)) {
                      deleteLead(lead.id)
                      toast.success('已刪除')
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  刪除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [setSelectedLeadId, researchLead, generateEmail, updateLead, deleteLead, actionLoading]
  )

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, rowSelection, globalFilter: searchQuery },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const allHaveWebsite = selectedRows.every((r) => r.original.website)

  const handleBulkResearch = async () => {
    if (!allHaveWebsite) {
      toast.error('所選名單中部分缺少網站，無法研究')
      return
    }
    toast.info(`開始批次研究 ${selectedRows.length} 筆名單...`)
    for (const row of selectedRows) {
      await researchLead(row.original.id)
    }
    toast.success('批次研究完成')
    setRowSelection({})
  }

  return (
    <div className="space-y-3">
      {/* 篩選與搜尋 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋公司、聯絡人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              狀態：
              <span className="ml-1 font-medium">
                {filterStatus === 'all' ? '全部' : STATUS_LABELS[filterStatus]}
              </span>
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <DropdownMenuRadioItem value="all">全部</DropdownMenuRadioItem>
              {ALL_STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={() => useLeadStore.getState().fetchLeads()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        {selectedRows.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已選 {selectedRows.length} 筆
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkResearch}
              disabled={!allHaveWebsite}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              批次研究
            </Button>
          </div>
        )}
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className="text-xs font-semibold uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: columns.length }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full bg-muted/60 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    尚無名單。點擊右上角「新增名單」開始建立你的潛在客戶資料庫。
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedLeadId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
