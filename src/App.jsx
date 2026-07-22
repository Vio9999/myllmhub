import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Plus, RefreshCw, Trash2, ChevronRight, Loader2, Sparkles, Zap, Check, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { PROVIDERS, loadKey, saveKey, configuredProviders, fetchQuota, fetchRateLimit } from "@/lib/providers"

const fmtNum = (n) => { if (n == null) return "-"; if (n >= 1e8) return `${(n/1e8).toFixed(2)}亿`; if (n >= 1e4) return `${(n/1e4).toFixed(1)}万`; return n.toLocaleString() }

export default function App() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [, setTick] = useState(0)

  const refreshOne = useCallback(async (id) => {
    const p = PROVIDERS.find((x) => x.id === id); if (!p) return
    const key = loadKey(p.id); if (!key) return
    setResults((p) => ({ ...p, [id]: { ...p[id], loading: true, error: null } }))
    try {
      const [quota, rateLimit] = await Promise.all([fetchQuota(p, key), fetchRateLimit(p, key)])
      setResults((p) => ({ ...p, [id]: { quota, rateLimit, loading: false, error: null, ts: Date.now() } }))
    } catch (e) {
      setResults((p) => ({ ...p, [id]: { ...p[id], loading: false, error: e.message } }))
    }
  }, [])

  const refreshAll = useCallback(async () => {
    const cs = configuredProviders(); if (!cs.length) return
    setLoading(true)
    await Promise.all(cs.map((p) => refreshOne(p.id)))
    setLoading(false); toast.success("已刷新所有平台")
  }, [refreshOne])

  useEffect(() => { refreshAll() }, [])

  const configured = configuredProviders()
  const detailP = detailId ? PROVIDERS.find((p) => p.id === detailId) : null

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">LLM Hub</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">大模型管理面板</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="icon" onClick={refreshAll} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> 添加</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {configured.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <motion.div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
            <AnimatePresence mode="popLayout">
              {configured.map((p) => (
                <ProviderCard key={p.id} provider={p} result={results[p.id]} onClick={() => setDetailId(p.id)} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        {configured.length > 0 && configured.length < PROVIDERS.length && (
          <div className="mt-8">
            <Separator className="mb-6" />
            <p className="mb-3 px-1 text-xs text-muted-foreground">可添加的平台</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.filter((p) => !loadKey(p.id)).map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </main>
      <AddDialog open={addOpen} onOpenChange={setAddOpen} onAdded={(id) => { setTick(t => t + 1); refreshOne(id) }} />
      <Dialog open={!!detailP} onOpenChange={(o) => !o && setDetailId(null)}>
        {detailP && <DetailContent provider={detailP} result={results[detailP.id]} onRefresh={() => refreshOne(detailP.id)} onRemove={() => { saveKey(detailP.id, ""); setDetailId(null); setTick(t => t + 1); toast.success("已移除 " + detailP.name) }} />}
      </Dialog>
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5 py-24 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 ring-1 ring-violet-500/20"><Zap className="size-9 text-violet-400" /></div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">还没有添加任何平台</h2>
        <p className="text-sm text-muted-foreground">添加 API Key，开始监控各大模型平台的额度与限流</p>
      </div>
      <Button onClick={onAdd} size="lg"><Plus /> 添加第一个平台</Button>
    </motion.div>
  )
}

function ProviderCard({ provider, result, onClick }) {
  const { quota, rateLimit, loading, error, ts } = result || {}
  const pct = quota?.total > 0 ? Math.min((quota.used / quota.total) * 100, 100) : 0
  const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <motion.div layout variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, scale: 0.95 }}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/40 gap-4" onClick={onClick}>
        <CardContent className="space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold" style={{ background: `${provider.color}22`, color: provider.color }}>{provider.name[0]}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{provider.name}</p><p className="truncate text-[11px] text-muted-foreground">{provider.sub}</p></div>
            {loading ? <Badge variant="secondary"><Loader2 className="animate-spin" />查询中</Badge> : error ? <Badge variant="destructive">失败</Badge> : ts ? <Badge variant="success"><Check className="size-3" />已刷新</Badge> : <Badge variant="outline">待查询</Badge>}
          </div>
          {quota?.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground"><span>已用 {fmtNum(quota.used)}</span><span>总额 {fmtNum(quota.total)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 2)}%` }} transition={{ duration: 0.6 }} /></div>
            </div>
          )}
          {rateLimit?.remaining != null && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">请求配额</span><span className="font-medium">{rateLimit.remaining} / {rateLimit.limit}</span></div>}
          {!quota?.total && !rateLimit?.remaining && !loading && <p className="text-center text-[11px] text-muted-foreground/60">{error ? "点击查看详情" : "暂无额度数据"}</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AddDialog({ open, onOpenChange, onAdded }) {
  const [sel, setSel] = useState(null)
  const [keyInput, setKeyInput] = useState("")
  const handleSave = () => { if (!sel || !keyInput.trim()) return; saveKey(sel.id, keyInput.trim()); toast.success(`已添加 ${sel.name}`); onAdded(sel.id); setSel(null); setKeyInput(""); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSel(null); setKeyInput("") } }}>
      <DialogContent>
        {!sel ? (
          <>
            <DialogHeader><DialogTitle>添加平台</DialogTitle><DialogDescription>选择要添加的大模型平台</DialogDescription></DialogHeader>
            <div className="grid gap-2">
              {PROVIDERS.map((p) => { const has = !!loadKey(p.id); return (
                <button key={p.id} disabled={has} onClick={() => setSel(p)} className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 disabled:opacity-40">
                  <div className="flex size-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${p.color}22`, color: p.color }}>{p.name[0]}</div>
                  <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-[11px] text-muted-foreground">{p.sub}</p></div>
                  {has ? <Badge variant="success">已配置</Badge> : <ChevronRight className="size-4 text-muted-foreground" />}
                </button>
              )})}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><div className="flex size-7 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${sel.color}22`, color: sel.color }}>{sel.name[0]}</div>{sel.name}</DialogTitle>
              <DialogDescription>输入 {sel.sub} 的 API Key</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="apikey">API Key</Label>
              <Input id="apikey" type="password" placeholder="粘贴 API Key…" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSel(null)}>返回</Button>
              <Button onClick={handleSave} disabled={!keyInput.trim()}>保存</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailContent({ provider, result, onRefresh, onRemove }) {
  const { quota, rateLimit, loading, error } = result || {}
  const [showKey, setShowKey] = useState(false)
  const key = loadKey(provider.id)
  const pct = quota?.total > 0 ? Math.min((quota.used / quota.total) * 100, 100) : 0
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${provider.color}22`, color: provider.color }}>{provider.name[0]}</div>
          {provider.name}
        </DialogTitle>
        <DialogDescription>{provider.sub}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs">{showKey ? key : key.slice(0, 8) + "••••••••" + key.slice(-4)}</code>
            <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff /> : <Eye />}</Button>
          </div>
        </div>
        <Separator />
        {loading ? <div className="flex items-center justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>
        ) : (
          <>
            {quota?.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">额度使用</span><span className="font-medium">{pct.toFixed(1)}%</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full" style={{ background: provider.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 2)}%` }} transition={{ duration: 0.6 }} /></div>
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>已用 {fmtNum(quota.used)}</span><span>总额 {fmtNum(quota.total)}</span></div>
              </div>
            )}
            {rateLimit?.remaining != null && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3"><p className="text-[11px] text-muted-foreground">请求剩余</p><p className="mt-1 text-lg font-bold">{rateLimit.remaining}</p><p className="text-[11px] text-muted-foreground">/ {rateLimit.limit}</p></div>
                {rateLimit.tokenRemaining != null && <div className="rounded-lg border p-3"><p className="text-[11px] text-muted-foreground">Token 剩余</p><p className="mt-1 text-lg font-bold">{rateLimit.tokenRemaining}</p><p className="text-[11px] text-muted-foreground">/ {rateLimit.tokenLimit}</p></div>}
              </div>
            )}
            {!quota?.total && !rateLimit?.remaining && <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>}
          </>
        )}
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="destructive" size="sm" onClick={onRemove}><Trash2 /> 移除</Button>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /> 刷新</Button>
      </DialogFooter>
    </DialogContent>
  )
}
