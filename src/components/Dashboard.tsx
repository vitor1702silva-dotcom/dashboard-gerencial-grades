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
          <thead><tr><th scope="col">Loja</th><th scope="col">Registros</th><th scope="col">Reposição</th><th scope="col">Peso kg</th><th scope="col">Total</th></tr></thead>
          <tbody>{visible.length ? visible.map(store => (
            <tr key={store.name}><th scope="row">{store.name}</th><td>{fmt(store.records)}</td><td>{fmt(store.replenishment, 2)}</td><td>{fmt(store.weight, 2)}</td><td>{fmt(store.total, 2)}</td></tr>
          )) : <tr><td colSpan={5} className="empty-cell"><Building2 size={25} strokeWidth={1.4} aria-hidden="true" /><strong>Nenhuma loja encontrada</strong><span>Altere a pesquisa para ver outros resultados.</span></td></tr>}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>{fmt(totals.records)}</td><td>{fmt(totals.replenishment, 2)}</td><td>{fmt(totals.weight, 2)}</td><td>{fmt(totals.total, 2)}</td></tr></tfoot>
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
    { label: 'Registros', value: fmt(rows.length), note: 'Linhas da base automática', icon: FileSpreadsheet },
    { label: 'Peso total', value: fmt(totalWeight, 2), note: 'Peso informado na base · kg', icon: Weight },
    { label: 'Reposição', value: fmt(totalReplenishment, 2), note: 'Quantidade total de reposição', icon: Package },
    { label: 'Total geral', value: fmt(totalGeneral, 2), note: 'Soma do total · sem valor monetário', icon: Layers },
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
    const lines = [['Bandeira', 'Loja', 'Registros', 'Reposição', 'Peso kg', 'Total'],
      ...filteredGroups.flatMap(group => group.stores.filter(store => store.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(store => [
        group.name, store.name, String(store.records), String(store.replenishment).replace('.', ','), String(store.weight).replace('.', ','), String(store.total).replace('.', ','),
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
  return (
    <div className="presentation">
      <a className="skip-link" href="#relatorio">Pular para o relatório</a>
      <header className="report-masthead"><div className="masthead-inner"><div className="logo-box"><img src="/images/grupo-mateus.png" alt="Grupo Mateus" width="153" height="102" /></div><div className="masthead-title"><span className="overline">RELATÓRIO GERENCIAL · GERAÇÃO DE GRADES</span><h1>{title}</h1><p>Planejamento de reposição · visão por bandeira e loja</p></div><div className="extraction"><span>ÚLTIMA ATUALIZAÇÃO DA TELA</span><strong>{lastLoaded ? lastLoaded.toLocaleDateString('pt-BR') : '—'}</strong><small>{lastLoaded ? lastLoaded.toLocaleTimeString('pt-BR') : 'Aguardando dados'}</small></div></div></header>
      <main id="relatorio">
        <div className="cycle-row"><div className="cycle"><strong>Base</strong><span>{loading ? 'Carregando…' : 'Última sincronização concluída'}</span></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="export-button" onClick={refresh} disabled={loading}><RefreshCw size={16} />Atualizar dados</button><button className="export-button" onClick={logout}><LogOut size={16} />Sair</button></div></div>
        <section className="metrics" aria-label="Resumo da previsão">{metrics.map(({ label, note, value, icon: Icon }) => <article className="metric" key={label}><div className="metric-label">{label}<Icon size={17} aria-hidden="true" /></div><strong className="metric-value">{loading && !rows.length ? '…' : value}</strong><p>{note}</p></article>)}</section>
        {error && <div className="data-note" role="alert"><Info size={17} /><p><strong>Não foi possível carregar os dados.</strong> {error}</p></div>}
        {!error && !loading && !rows.length && <div className="data-note" role="note"><Info size={17} /><p>Nenhum registro disponível na última sincronização.</p></div>}
        <section className="report-controls" aria-label="Controles do relatório"><div><span className="overline">DETALHAMENTO</span><h2>Previsão por bandeira</h2></div><div className="control-actions"><label className="search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Pesquisar loja" placeholder="Pesquisar loja…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label><button className="export-button" disabled={!rows.length || loading} onClick={exportCsv}><Download size={16} aria-hidden="true" />Exportar relatório</button></div></section>
        <div className="store-grid"><div className="store-column">{filteredGroups.filter((_, index) => index % 2 === 0).map(group => <StoreTable key={group.name} group={group} search={search} size={Number(size)} page={page} />)}</div><div className="store-column">{filteredGroups.filter((_, index) => index % 2 === 1).map(group => <StoreTable key={group.name} group={group} search={search} size={Number(size)} page={page} />)}</div></div>
        <div className="pagination"><span>{fmt(storesCount)} lojas nas bandeiras · Página {page + 1} de {maxPages}</span><div><label>Lojas por página<select value={size} onChange={e => { setSize(e.target.value); setPage(0) }}><option>25</option><option>50</option><option>100</option></select></label><button disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button><button disabled={page + 1 >= maxPages} onClick={() => setPage(p => p + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button></div></div>
        <footer><p>Pesos em kg · Total geral sem interpretação monetária · Dados consultados no Supabase.</p><span>Previsão da geração de grade das lojas</span></footer>
      </main>
    </div>
  )
}
