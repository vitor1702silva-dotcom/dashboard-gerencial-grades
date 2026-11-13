import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Info, Search, Weight, Package, Layers, RefreshCw, LogOut } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ypgytczcrufdnhybsrle.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const title = 'Previsão da geração de grade das lojas'

type RowData = {
  id?: number
  filial_destino?: string | number | null
  bandeira?: string | null
  qtd_reposicao?: string | number | null
  peso?: string | number | null
  total?: string | number | null
  importado_em?: string | null
}
type Session = { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number }
type Store = { name: string; records: number; replenishment: number; weight: number; total: number }
type Group = { name: string; stores: Store[]; records: number; replenishment: number; weight: number; total: number }

function storedSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem('grades_session') || 'null') as Session | null }
  catch { return null }
}
function saveSession(value: Session) {
  sessionStorage.setItem('grades_session', JSON.stringify({
    ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600),
  }))
}
async function signIn(email: string, password: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error('Não foi possível entrar. Confira o e-mail e a senha.')
  saveSession(await response.json() as Session)
}
async function token(): Promise<string> {
  const session = storedSession()
  if (!session) throw new Error('Entre com seu e-mail e senha.')
  if ((session.expires_at || 0) * 1000 > Date.now() + 60000) return session.access_token
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!response.ok) {
    sessionStorage.removeItem('grades_session')
    throw new Error('Sua sessão expirou. Entre novamente.')
  }
  saveSession(await response.json() as Session)
  return storedSession()!.access_token
}
async function fetchAllRows(): Promise<RowData[]> {
  const access = await token()
  const result: RowData[] = []
  for (let offset = 0; offset < 250000; offset += 1000) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_base_automatica?select=id,filial_destino,bandeira,qtd_reposicao,peso,total,importado_em&order=id.asc&offset=${offset}&limit=1000`, {
      headers: { apikey: KEY, Authorization: `Bearer ${access}` },
    })
    if (!response.ok) throw new Error(`Falha ao consultar os dados (${response.status}). Verifique as permissões no Supabase.`)
    const batch = await response.json() as RowData[]
    result.push(...batch)
    if (batch.length < 1000) return result
  }
  throw new Error('A consulta excedeu o limite de segurança de 250 mil registros.')
}
const num = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const clean = String(value).trim()
  const parsed = Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean)
  return Number.isFinite(parsed) ? parsed : 0
}
const fmt = (value: number, decimals = 0) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const fmtAccounting = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const norm = (value: unknown) => String(value ?? '').trim()

function StoreTable({ group, search, size, page }: { group: Group; search: string; size: number; page: number }) {
  const matches = group.stores.filter(store => store.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  const visible = matches.slice(page * size, (page + 1) * size)
  const totals = matches.reduce((acc, store) => ({
    records: acc.records + store.records, replenishment: acc.replenishment + store.replenishment,
    weight: acc.weight + store.weight, total: acc.total + store.total,
  }), { records: 0, replenishment: 0, weight: 0, total: 0 })
  return (
    <section className="store-panel" aria-label={`Lojas da bandeira ${group.name}`}>
      <header className="store-heading"><h2>{group.name}</h2><span>{matches.length} {matches.length === 1 ? 'loja' : 'lojas'}</span></header>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabela ${group.name}`}>
        <table>
          <caption className="sr-only">Previsão por loja · {group.name}</caption>
          <thead><tr><th scope="col">Loja</th><th scope="col">Itens</th><th scope="col">Peso kg</th><th scope="col">Valor</th></tr></thead>
          <tbody>{visible.length ? visible.map(store => (
            <tr key={store.name}><th scope="row">{store.name}</th><td>{fmt(store.records)}</td><td>{fmt(store.weight, 2)}</td><td>{fmtAccounting(store.total)}</td></tr>
          )) : <tr><td colSpan={4} className="empty-cell"><Building2 size={25} strokeWidth={1.4} aria-hidden="true" /><strong>Nenhuma loja encontrada</strong><span>Altere a pesquisa para ver outros resultados.</span></td></tr>}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>{fmt(totals.records)}</td><td>{fmt(totals.weight, 2)}</td><td>{fmtAccounting(totals.total)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  )
}

export function Dashboard() {
  const [session, setSession] = useState(() => !!storedSession())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<RowData[]>([])
  const [search, setSearch] = useState('')
  const [size, setSize] = useState('25')
  const [page, setPage] = useState(0)
  const [presentationMode, setPresentationMode] = useState(false)
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    setError('')
    fetchAllRows().then(data => {
      if (active) { setRows(data); setLastLoaded(new Date()) }
    }).catch(err => {
      if (active) { setError(err instanceof Error ? err.message : 'Erro ao carregar dados.'); if (!storedSession()) setSession(false) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session])

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Map<string, Store>>()
    for (const row of rows) {
      const banner = norm(row.bandeira) || 'SEM BANDEIRA'
      const storeName = norm(row.filial_destino) || 'SEM FILIAL'
      if (!map.has(banner)) map.set(banner, new Map())
      const stores = map.get(banner)!
      if (!stores.has(storeName)) stores.set(storeName, { name: storeName, records: 0, replenishment: 0, weight: 0, total: 0 })
      const store = stores.get(storeName)!
      store.records++
      store.replenishment += num(row.qtd_reposicao)
      store.weight += num(row.peso)
      store.total += num(row.total)
    }
    return [...map.entries()].map(([name, stores]) => {
      const values = [...stores.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
      return { name, stores: values, records: values.reduce((sum, s) => sum + s.records, 0),
        replenishment: values.reduce((sum, s) => sum + s.replenishment, 0),
        weight: values.reduce((sum, s) => sum + s.weight, 0), total: values.reduce((sum, s) => sum + s.total, 0) }
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [rows])
  const filteredGroups = groups.filter(group => group.stores.some(store => store.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))))
  const storesCount = groups.reduce((sum, group) => sum + group.stores.length, 0)
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0)
  const totalReplenishment = groups.reduce((sum, group) => sum + group.replenishment, 0)
  const totalGeneral = groups.reduce((sum, group) => sum + group.total, 0)
  const maxPages = Math.max(1, ...filteredGroups.map(group => Math.ceil(group.stores.filter(store => store.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).length / Number(size))))
  const metrics = [
    { label: 'Lojas', value: fmt(storesCount), note: 'Filiais por bandeira', icon: Building2 },
    { label: 'Itens + 20%', value: fmt(Math.ceil(rows.length * 1.20)), note: 'Total de itens com acréscimo de 20%', icon: FileSpreadsheet },
    { label: 'Peso total', value: fmt(totalWeight, 2), note: 'Peso informado na base · kg', icon: Weight },
    { label: 'Valor total', value: fmtAccounting(totalGeneral), note: 'Soma dos valores da base · R$', icon: Layers },
  ]

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoggingIn(true)
    setError('')
    try { await signIn(email.trim(), password); setPassword(''); setSession(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao entrar.') }
    finally { setLoggingIn(false) }
  }
  async function refresh() {
    setLoading(true); setError('')
    try { setRows(await fetchAllRows()); setLastLoaded(new Date()); setPage(0) }
    catch (err) { setError(err instanceof Error ? err.message : 'Erro ao atualizar.'); if (!storedSession()) setSession(false) }
    finally { setLoading(false) }
  }
  function logout() { sessionStorage.removeItem('grades_session'); setSession(false); setRows([]); setPassword(''); setError('') }
  function exportCsv() {
    const lines = [['Bandeira', 'Loja', 'Itens', 'Peso kg', 'Valor'],
      ...filteredGroups.flatMap(group => group.stores.filter(store => store.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(store => [
        group.name, store.name, String(store.records), String(store.weight).replace('.', ','), String(store.total).replace('.', ','),
      ]))]
    const escape = (cell: string) => `"${cell.replace(/^[\s]*[=+@\-]/, "'$&").replace(/"/g, '""')}"`
    const csv = '\uFEFF' + lines.map(line => line.map(escape).join(';')).join('\r\n')
    const url = globalThis.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'previsao_geracao_grades.csv'; a.click(); globalThis.URL.revokeObjectURL(url)
  }

  if (!session) return (
    <div className="presentation">
      <header className="report-masthead"><div className="masthead-inner"><div className="logo-box"><img src="/images/grupo-mateus.png" alt="Grupo Mateus" width="153" height="102" /></div><div className="masthead-title"><span className="overline">RELATÓRIO GERENCIAL · GERAÇÃO DE GRADES</span><h1>{title}</h1><p>Acesso autorizado · Supabase</p></div></div></header>
      <main id="relatorio"><section className="store-panel" style={{ maxWidth: 460, margin: '48px auto', padding: 28 }}><h2>Acessar relatório</h2><form onSubmit={handleLogin} style={{ display: 'grid', gap: 14, marginTop: 18 }}><label>E-mail<input style={{ display: 'block', width: '100%', padding: 12, marginTop: 6 }} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Senha<input style={{ display: 'block', width: '100%', padding: 12, marginTop: 6 }} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button className="export-button" type="submit" disabled={loggingIn}>{loggingIn ? 'Entrando…' : 'Entrar'}</button></form>{error && <p role="alert" style={{ color: '#b91c1c', marginTop: 14 }}>{error}</p>}</section></main>
    </div>
  )
  if (presentationMode) return (
    <div className="grades-summary-view">
      <style>{`
        .grades-summary-view { min-height: 100vh; padding: 12px 12px 22px; background: #e9eef5; box-sizing: border-box; color: #122f53; }
        .grades-summary-view * { box-sizing: border-box; }
        .grades-summary-toolbar { max-width: 1500px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font: 600 13px Arial,sans-serif; }
        .grades-summary-toolbar button { border: 0; border-radius: 7px; background: #12335e; color: #fff; padding: 9px 16px; font: inherit; cursor: pointer; }
        .grades-summary-slide { width: min(96vw, 160vh); max-width: 1500px; aspect-ratio: 16 / 9; margin: 0 auto; overflow: hidden; display: flex; flex-direction: column; background: #f3f6fb; border: 1px solid #d5deeb; box-shadow: 0 5px 20px #142e4c16; container-type: inline-size; font-family: Arial,Helvetica,sans-serif; }
        .grades-summary-head { height: 18%; flex-shrink: 0; display: flex; align-items: center; gap: 2.2cqw; padding: 1.4cqw 3cqw; background: #112e55; border-bottom: .48cqw solid #d82d43; color: #fff; }
        .grades-summary-head img { width: 10cqw; height: 6.5cqw; object-fit: contain; background: #fff; border-radius: .6cqw; padding: .35cqw; }
        .grades-summary-head h1 { margin: .35cqw 0; color: #fff; font-size: 2.25cqw; line-height: 1.15; }
        .grades-summary-head p { margin: 0; color: #d4e0f0; font-size: 1.15cqw; }
        .grades-summary-eyebrow { font-size: .92cqw; color: #c0d1e7; letter-spacing: .12em; font-weight: 700; }
        .grades-summary-body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 2cqw 2.6cqw 1.3cqw; gap: 1.7cqw; }
        .grades-summary-kpis { display: grid; grid-template-columns: .8fr 1fr 1.15fr 1.65fr; gap: 1.2cqw; }
        .grades-summary-kpi { background: #fff; border: 1px solid #d6e0ec; border-radius: .85cqw; padding: 1.4cqw; min-width: 0; }
        .grades-summary-kpi span { display: block; font-size: 1.12cqw; color: #526b89; margin-bottom: .65cqw; }
        .grades-summary-kpi strong { color: #102f58; font-size: 2.25cqw; white-space: nowrap; letter-spacing: -.04em; }
        .grades-summary-kpi:last-child strong { font-size: 1.95cqw; }
        .grades-summary-section { display: flex; justify-content: space-between; align-items: baseline; }
        .grades-summary-section h2 { margin: 0; font-size: 1.8cqw; color: #102f58; }
        .grades-summary-section span { font-size: 1.1cqw; color: #647993; }
        .grades-summary-table-wrap { background: #fff; border: 1px solid #d6e0ec; border-radius: .85cqw; overflow: hidden; flex: 1; min-height: 0; }
        .grades-summary-table { border-collapse: collapse; width: 100%; height: 100%; table-layout: fixed; font-size: 1.28cqw; }
        .grades-summary-table th,.grades-summary-table td { padding: 1.1cqw 1.3cqw; border-bottom: 1px solid #e5ebf3; }
        .grades-summary-table thead { background: #e8eef6; color: #3b5574; }
        .grades-summary-table th { text-align: left; }
        .grades-summary-table th:not(:first-child),.grades-summary-table td:not(:first-child) { text-align: right; white-space: nowrap; }
        .grades-summary-table tbody tr:nth-child(even) { background: #f7f9fc; }
        .grades-summary-table tbody td:first-child { font-weight: 700; }
        .grades-summary-table tfoot { background: #112e55; color: #fff; font-weight: 700; }
        .grades-summary-table tfoot td { border-bottom: 0; }
        .grades-summary-foot { flex-shrink: 0; padding: .95cqw 2.6cqw; display: flex; justify-content: space-between; background: #e1eaf4; font-size: 1.03cqw; color: #526b89; }
        @media print { @page { size: landscape; margin: 0; } .grades-summary-toolbar { display: none !important; } .grades-summary-view { padding: 0; background: white; } .grades-summary-slide { width: 100vw; border: 0; box-shadow: none; } }
      `}</style>
      <div className="grades-summary-toolbar">
        <span>Resumo gerencial · 16:9 · um único print</span>
        <button type="button" onClick={() => setPresentationMode(false)}>Voltar ao dashboard</button>
      </div>
      <div className="grades-summary-slide" aria-label="Resumo gerencial para apresentação 16 por 9">
        <header className="grades-summary-head">
          <img src="/images/grupo-mateus.png" alt="Grupo Mateus" />
          <div><div className="grades-summary-eyebrow">RELATÓRIO GERENCIAL · GERAÇÃO DE GRADES</div><h1>{title}</h1><p>Resumo consolidado por bandeira · Centro de Distribuição</p></div>
        </header>
        <div className="grades-summary-body">
          <div className="grades-summary-kpis">
            <div className="grades-summary-kpi"><span>Lojas</span><strong>{fmt(storesCount)}</strong></div>
            <div className="grades-summary-kpi"><span>Itens + 20%</span><strong>{fmt(Math.ceil(rows.length * 1.20))}</strong></div>
            <div className="grades-summary-kpi"><span>Peso total · kg</span><strong>{fmt(totalWeight, 2)}</strong></div>
            <div className="grades-summary-kpi"><span>Valor total</span><strong>{fmtAccounting(totalGeneral)}</strong></div>
          </div>
          <div className="grades-summary-section"><h2>Consolidado por bandeira</h2><span>{groups.length} bandeiras · {storesCount} lojas</span></div>
          <div className="grades-summary-table-wrap">
            <table className="grades-summary-table">
              <colgroup><col style={{width:'27%'}}/><col style={{width:'11%'}}/><col style={{width:'13%'}}/><col style={{width:'21%'}}/><col style={{width:'28%'}}/></colgroup>
              <thead><tr><th scope="col">Bandeira</th><th scope="col">Lojas</th><th scope="col">Itens (base)</th><th scope="col">Peso kg</th><th scope="col">Valor</th></tr></thead>
              <tbody>{groups.map(group => <tr key={group.name}><td>{group.name}</td><td>{fmt(group.stores.length)}</td><td>{fmt(group.records)}</td><td>{fmt(group.weight,2)}</td><td>{fmtAccounting(group.total)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total geral</td><td>{fmt(storesCount)}</td><td>{fmt(rows.length)}</td><td>{fmt(totalWeight,2)}</td><td>{fmtAccounting(totalGeneral)}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <footer className="grades-summary-foot"><span>Fonte: Supabase · Itens do quadro por bandeira sem acréscimo · Valores em R$</span><span>{lastLoaded ? `Consultado em ${lastLoaded.toLocaleString('pt-BR')}` : 'Aguardando atualização'}</span></footer>
      </div>
    </div>
  )

  return (
    <div className="presentation">
      <a className="skip-link" href="#relatorio">Pular para o relatório</a>
      <header className="report-masthead"><div className="masthead-inner"><div className="logo-box"><img src="/images/grupo-mateus.png" alt="Grupo Mateus" width="153" height="102" /></div><div className="masthead-title"><span className="overline">RELATÓRIO GERENCIAL · GERAÇÃO DE GRADES</span><h1>{title}</h1><p>Planejamento de reposição · visão por bandeira e loja</p></div><div className="extraction"><span>ÚLTIMA ATUALIZAÇÃO DA TELA</span><strong>{lastLoaded ? lastLoaded.toLocaleDateString('pt-BR') : '—'}</strong><small>{lastLoaded ? lastLoaded.toLocaleTimeString('pt-BR') : 'Aguardando dados'}</small></div></div></header>
      <main id="relatorio">
        <div className="cycle-row"><div className="cycle"><strong>Base</strong><span>{loading ? 'Carregando…' : 'Última sincronização concluída'}</span></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="export-button" onClick={() => setPresentationMode(true)} disabled={loading || !rows.length}>Resumo 16:9 para print</button><button className="export-button" onClick={refresh} disabled={loading}><RefreshCw size={16} />Atualizar dados</button><button className="export-button" onClick={logout}><LogOut size={16} />Sair</button></div></div>
        <style>{`
          .metrics.metrics-wide { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.25fr); }
          .metrics.metrics-wide .metric { min-width: 0; }
          .metrics.metrics-wide .metric-value { white-space: nowrap; }
          .metrics.metrics-wide .metric:last-child .metric-value { font-size: clamp(1.25rem, 2.1vw, 1.85rem); letter-spacing: -0.035em; }
          @media (max-width: 1000px) {
            .metrics.metrics-wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 560px) {
            .metrics.metrics-wide { grid-template-columns: minmax(0, 1fr); }
          }
        `}</style>
        <style>{`
          /* Layout compacto: mantém o visual original e aproxima os blocos. */
          .presentation .masthead-inner { padding-top: 12px; padding-bottom: 12px; }
          .presentation .report-masthead .logo-box img { max-height: 76px; object-fit: contain; }
          .presentation main#relatorio { padding-top: 12px; }
          .presentation .cycle-row { margin-bottom: 10px; }
          .presentation .metrics.metrics-wide { gap: 10px; margin-bottom: 12px; }
          .presentation .metrics.metrics-wide .metric { padding: 12px 14px; }
          .presentation .metrics.metrics-wide .metric-value { line-height: 1.1; }
          .presentation .metrics.metrics-wide .metric p { margin-top: 5px; }
          .presentation .report-controls { margin-top: 10px; margin-bottom: 10px; }
          .presentation .store-grid { gap: 10px; }
          .presentation .store-column { gap: 10px; }
          .presentation .store-heading { padding-top: 10px; padding-bottom: 10px; }
          .presentation .store-panel table th,
          .presentation .store-panel table td { padding-top: 7px; padding-bottom: 7px; }
          .presentation .pagination { margin-top: 10px; }
          @media (max-width: 760px) {
            .presentation .metrics.metrics-wide { gap: 8px; }
            .presentation .store-grid { gap: 8px; }
          }
        `}</style>
        <section className="metrics metrics-wide" aria-label="Resumo da previsão">{metrics.map(({ label, note, value, icon: Icon }) => <article className="metric" key={label}><div className="metric-label">{label}<Icon size={17} aria-hidden="true" /></div><strong className="metric-value">{loading && !rows.length ? '…' : value}</strong><p>{note}</p></article>)}</section>
        {error && <div className="data-note" role="alert"><Info size={17} /><p><strong>Não foi possível carregar os dados.</strong> {error}</p></div>}
        {!error && !loading && !rows.length && <div className="data-note" role="note"><Info size={17} /><p>Nenhum registro disponível na última sincronização.</p></div>}
        <section className="report-controls" aria-label="Controles do relatório"><div><span className="overline">DETALHAMENTO</span><h2>Previsão por bandeira</h2></div><div className="control-actions"><label className="search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Pesquisar loja" placeholder="Pesquisar loja…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label><button className="export-button" disabled={!rows.length || loading} onClick={exportCsv}><Download size={16} aria-hidden="true" />Exportar relatório</button></div></section>
        <div className="store-grid"><div className="store-column">{filteredGroups.filter((_, index) => index % 2 === 0).map(group => <StoreTable key={group.name} group={group} search={search} size={Number(size)} page={page} />)}</div><div className="store-column">{filteredGroups.filter((_, index) => index % 2 === 1).map(group => <StoreTable key={group.name} group={group} search={search} size={Number(size)} page={page} />)}</div></div>
        <div className="pagination"><span>{fmt(storesCount)} lojas nas bandeiras · Página {page + 1} de {maxPages}</span><div><label>Lojas por página<select value={size} onChange={e => { setSize(e.target.value); setPage(0) }}><option>25</option><option>50</option><option>100</option></select></label><button disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button><button disabled={page + 1 >= maxPages} onClick={() => setPage(p => p + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button></div></div>
        <footer><p>Pesos em kg · Valores em reais (R$) · Dados consultados no Supabase.</p><span>Previsão da geração de grade das lojas</span></footer>
      </main>
    </div>
  )
}
