import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  ListFilter,
  Menu,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Weight,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Page =
  'Visão geral' | 'Reposição' | 'Estoques' | 'Distribuição' | 'Relatórios'
const navigation: { label: Page; icon: LucideIcon }[] = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Reposição', icon: RefreshCw },
  { label: 'Estoques', icon: Boxes },
  { label: 'Distribuição', icon: Truck },
  { label: 'Relatórios', icon: FileSpreadsheet },
]
const metrics: { label: string; icon: LucideIcon; note: string }[] = [
  {
    label: 'Total de registros',
    icon: FileSpreadsheet,
    note: 'Registros da base automática',
  },
  {
    label: 'Quantidade de reposição',
    icon: Package,
    note: 'Soma das quantidades de reposição',
  },
  { label: 'Peso total', icon: Weight, note: 'Soma do peso informado na base' },
  {
    label: 'Total geral',
    icon: BarChart3,
    note: 'Soma da coluna total da planilha',
  },
  {
    label: 'Filiais atendidas',
    icon: Building2,
    note: 'Filiais de destino distintas',
  },
  { label: 'Produtos', icon: Boxes, note: 'Produtos distintos na base' },
  {
    label: 'Estoque CD',
    icon: Package,
    note: 'Estoque do centro de distribuição',
  },
  { label: 'Estoque filial', icon: Building2, note: 'Estoque nas filiais' },
]
const columns = [
  'ID',
  'Filial destino',
  'Departamento',
  'Seção',
  'Produto',
  'Qtd. reposição',
  'Peso',
  'Total',
  'Estoque CD',
  'Estoque filial',
  'Cidade',
  'Região',
]

const URL = 'https://ypgytczcrufdnhybsrle.supabase.co'
const KEY = 'sb_publishable_TqV-mUEueoidbDi5WN7irQ_LCRqRLHq'
type RowData = Record<string, string | number | null>
const fieldMap: Record<string,string> = {
  'Filial destino':'filial_destino', 'Departamento':'depto', 'Seção':'secao',
  'Produto':'produto', 'Cidade':'cidade', 'Região':'regiao'
}
const displayFields = ['id','filial_destino','depto','secao','produto','qtd_reposicao','peso','total','estoque_cd','estoque_filial','cidade','regiao']
const numeric = (v: unknown) => Number(v || 0) || 0
const formatted = (v: number) => v.toLocaleString('pt-BR',{maximumFractionDigits:2})
const safe = (v: unknown) => String(v ?? '')
function getSession(): {access_token:string;refresh_token:string;expires_at:number}|null {
  try { return JSON.parse(sessionStorage.getItem('grades_session') || 'null') } catch { return null }
}
async function signIn(email:string,password:string) {
  const res=await fetch(`${URL}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{'apikey':KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  })
  const body=await res.json()
  if(!res.ok) throw new Error(body.msg || body.error_description || 'Não foi possível entrar')
  sessionStorage.setItem('grades_session',JSON.stringify(body))
  return body
}
async function token(): Promise<string> {
  const session=getSession()
  if(!session) throw new Error('Entre com seu e-mail e senha')
  if(session.expires_at && session.expires_at * 1000 > Date.now()+60000) return session.access_token
  const res=await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',headers:{'apikey':KEY,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:session.refresh_token})
  })
  if(!res.ok) { sessionStorage.removeItem('grades_session'); throw new Error('Sessão expirada. Entre novamente.') }
  const body=await res.json()
  sessionStorage.setItem('grades_session',JSON.stringify(body))
  return body.access_token
}
async function fetchAllRows():Promise<RowData[]> {
  const access=await token()
  const result:RowData[]=[]
  for(let offset=0;offset<250000;offset+=1000) {
    const res=await fetch(`${URL}/rest/v1/dashboard_base_automatica?select=*&order=id.asc&offset=${offset}&limit=1000`,{
      headers:{'apikey':KEY,'Authorization':`Bearer ${access}`}
    })
    if(!res.ok) throw new Error(`Consulta falhou (${res.status}): ${await res.text()}`)
    const part=await res.json() as RowData[]
    result.push(...part)
    if(part.length<1000) return result
  }
  throw new Error('Limite de segurança da consulta atingido')
}
function sumBy(rows:RowData[],field:string,measure:string) {
  const m=new Map<string,number>()
  rows.forEach(r=>{const k=safe(r[field]) || 'Não informado';m.set(k,(m.get(k)||0)+numeric(r[measure]))})
  return [...m.entries()].sort((a,b)=>b[1]-a[1])
}
export function Dashboard() {
  const [page, setPage] = useState<Page>('Visão geral')
  const [menu, setMenu] = useState(false)
  const [dialog, setDialog] = useState<'connection' | 'help' | null>(null)
  const [search, setSearch] = useState('')
  const [size, setSize] = useState('25')
  const [group, setGroup] = useState('Departamento')
  const [geo, setGeo] = useState('Região')
  const [filters, setFilters] = useState(true)
  const [notice, setNotice] = useState('')
  const [session, setSession] = useState(!!getSession())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [rows, setRows] = useState<RowData[]>([])
  const [selected, setSelected] = useState<Record<string,string>>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [loadedAt, setLoadedAt] = useState('')
  async function refresh() {
    setLoading(true);setDataError('')
    try { const data=await fetchAllRows();setRows(data);setLoadedAt(new Date().toLocaleString('pt-BR'));setNotice(`${formatted(data.length)} registros consultados com sucesso.`) }
    catch(e) {setDataError(e instanceof Error?e.message:'Erro de conexão')}
    finally {setLoading(false)}
  }
  useEffect(()=>{if(session) void refresh()},[session])
  const filtered=useMemo(()=>rows.filter(r=>Object.entries(selected).every(([field,value])=>!value || safe(r[field])===value)),[rows,selected])
  const searched=useMemo(()=>filtered.filter(r=>!search || [r.produto,r.filial_destino,r.depto,r.secao,r.cidade,r.regiao,r.id].some(v=>safe(v).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[filtered,search])
  const pageSize=Number(size)
  const pages=Math.max(1,Math.ceil(searched.length/pageSize))
  const visibleRows=searched.slice(Math.min(currentPage,pages-1)*pageSize,(Math.min(currentPage,pages-1)+1)*pageSize)
  const values=[filtered.length, ...['qtd_reposicao','peso','total'].map(f=>filtered.reduce((a,r)=>a+numeric(r[f]),0)),new Set(filtered.map(r=>r.filial_destino).filter(Boolean)).size,new Set(filtered.map(r=>r.produto).filter(Boolean)).size,...['estoque_cd','estoque_filial'].map(f=>filtered.reduce((a,r)=>a+numeric(r[f]),0))]
  function exportCSV(){
    const content=[displayFields.join(';'),...searched.map(r=>displayFields.map(f=>'"'+safe(r[f]).replaceAll('"','""')+'"').join(';'))].join('\r\n')
    const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'})
    const href=window.URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=href;a.download='relatorio_grades.csv';a.click();window.URL.revokeObjectURL(href)
  }
  function signOut(){sessionStorage.removeItem('grades_session');setSession(false);setRows([])}

  function navigate(next: Page) {
    setPage(next)
    setMenu(false)
    setSearch('')
    setNotice('')
  }
  const showCharts = page !== 'Relatórios'
  if (!session) return (
    <div className="app-shell" style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>
      <form className="filter-panel" style={{width:'min(430px,92vw)',padding:30}} onSubmit={async e=>{e.preventDefault();setBusy(true);setAuthError('');try{await signIn(email,password);setSession(true)}catch(err){setAuthError(err instanceof Error?err.message:'Falha no login')}finally{setBusy(false)}}}>
        <h1 style={{fontSize:25,marginBottom:8}}>Dashboard Gerencial</h1>
        <p>Entre com o usuário cadastrado no Supabase.</p>
        <label style={{display:'block',marginTop:22}}>E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:7,border:'1px solid #cbd5e1',borderRadius:7}} /></label>
        <label style={{display:'block',marginTop:15}}>Senha<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:7,border:'1px solid #cbd5e1',borderRadius:7}} /></label>
        {authError && <p style={{color:'#b42318'}}>{authError}</p>}
        <button disabled={busy} className="button primary" type="submit" style={{marginTop:20,width:'100%',justifyContent:'center'}}>{busy?'Entrando...':'Entrar'}</button>
      </form>
    </div>
  )
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <a
          href="#main"
          className="brand"
          onClick={() => navigate('Visão geral')}
        >
          <span className="brand-mark">
            <BarChart3 size={24} />
          </span>
          <span>
            Dashboard<span className="brand-sub">GERENCIAL</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Boxes size={19} />
          </span>
          <div>
            Geração de Grades<small>Painel de gestão</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">PRINCIPAL</div>
        <nav aria-label="Navegação principal">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={page === label ? 'nav-item active' : 'nav-item'}
              aria-current={page === label ? 'page' : undefined}
            >
              <Icon size={19} />
              {label}
              {page === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-symbol">
              <Database size={19} />
            </span>
            <strong>Sua gestão, conectada.</strong>
            <p>Todos os dados da operação em um só lugar.</p>
            <button onClick={() => setDialog('connection')}>
              Ver conexão <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setDialog('connection')}>
            <Settings2 size={19} />
            Configurações
          </button>
          <button className="nav-item" onClick={() => setDialog('help')}>
            <CircleHelp size={19} />
            Central de ajuda
          </button>
          <div className="sidebar-footer">
            <ShieldCheck size={15} /> Ambiente de gestão
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Gerencial</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <span />
              Conectado ao Supabase
            </span>
            <span className="top-divider" />
            <button
              className="icon-button"
              aria-label="Ajuda"
              onClick={() => setDialog('help')}
            >
              <CircleHelp size={19} />
            </button>
            <button className="text-button" onClick={signOut}>Sair</button>
            <button
              className="avatar"
              aria-label="Informações de acesso"
              onClick={() => setDialog('connection')}
            >
              GG
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">INTELIGÊNCIA OPERACIONAL</div>
              <h1>{page === 'Visão geral' ? 'Geração de Grades' : page}</h1>
              <p>
                {page === 'Visão geral'
                  ? 'Uma visão completa da reposição, dos estoques e da sua distribuição.'
                  : page === 'Relatórios'
                    ? 'Consulte os detalhes da base automática e acompanhe sua operação.'
                    : page === 'Estoques'
                      ? 'Acompanhe a disponibilidade no centro de distribuição e nas filiais.'
                      : page === 'Distribuição'
                        ? 'Explore a distribuição de produtos por região e cidade.'
                        : 'Acompanhe as necessidades de reposição por filial e produto.'}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => void refresh()} disabled={loading}
            >
              <RefreshCw size={16} />
              Atualizar dados
            </button>
          </div>
          <div className="status-banner">
            <span className="status-icon">
              <Database size={19} />
            </span>
            <div>
              <strong>{dataError ? 'Falha ao consultar dados' : loading ? 'Carregando registros...' : 'Dados conectados ao Supabase'}</strong>
              <p>
                {dataError || (loading ? 'Consultando a base em lotes de 1.000 registros.' : `Última consulta: ${loadedAt || 'aguardando'}. ${formatted(rows.length)} registros carregados.`)}
              </p>
            </div>
            <button onClick={() => setDialog('connection')}>
              Detalhes da conexão <ArrowUpRight size={15} />
            </button>
          </div>
          <section className="filter-panel" aria-label="Filtros do relatório">
            <div className="section-top">
              <h2>
                <SlidersHorizontal size={17} />
                Filtros <span className="subtle-pill">Toda a base</span>
              </h2>
              <button
                className="text-button"
                onClick={() => setFilters(!filters)}
              >
                {filters ? 'Recolher' : 'Exibir filtros'}
                <ChevronDown size={14} className={!filters ? 'rotate' : ''} />
              </button>
            </div>
            {filters && (
              <>
                <div className="filters">
                  {[
                    'Filial destino',
                    'Departamento',
                    'Seção',
                    'Produto',
                    'Cidade',
                    'Região',
                  ].map((label) => (
                    <label key={label}>
                      {label}
                      <div className="select-wrap">
                        <select aria-label={label} value={selected[fieldMap[label]] || ''} onChange={e=>{setSelected(p=>({...p,[fieldMap[label]]:e.target.value}));setCurrentPage(0)}}>
                          <option>
                            {label === 'Filial destino'
                              ? 'Todas as filiais'
                              : label === 'Departamento'
                                ? 'Todos os departamentos'
                                : label === 'Seção'
                                  ? 'Todas as seções'
                                  : label === 'Produto'
                                    ? 'Todos os produtos'
                                    : label === 'Cidade'
                                      ? 'Todas as cidades'
                                      : 'Todas as regiões'}
                          </option>
                          {[...new Set(rows.map(r=>safe(r[fieldMap[label]])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(value=><option key={value} value={value}>{value}</option>)}
                        </select>
                        <ChevronDown size={13} />
                      </div>
                    </label>
                  ))}
                </div>
                <div className="filter-foot">
                  <span>
                    <Filter size={13} /> {formatted(filtered.length)} registros correspondem aos filtros.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch('')
                      setSelected({})
                      setCurrentPage(0)
                      setNotice('Filtros e pesquisa limpos.')
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              </>
            )}
          </section>
          {notice && (
            <div className="notice" role="status">
              <Check size={15} />
              {notice}
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {page !== 'Relatórios' && (
            <>
              <div className="section-caption">
                <h2>Resumo da operação</h2>
                <span>
                  <span className="tiny-dot" /> {loadedAt || "Aguardando atualização"}
                </span>
              </div>
              <section className="metrics" aria-label="Indicadores principais">
                {metrics
                  .filter(
                    (_, i) =>
                      page !== 'Estoques' || [0, 4, 5, 6, 7].includes(i),
                  )
                  .map(({ label, icon: Icon, note }) => (
                    <article className="metric" key={label}>
                      <div className="metric-top">
                        <span>{label}</span>
                        <Icon size={18} />
                      </div>
                      <div className="metric-value">
                        {formatted(values[metrics.findIndex(m=>m.label===label)])}<span>{loading ? 'Atualizando' : 'Dados reais'}</span>
                      </div>
                      <p>{note}</p>
                    </article>
                  ))}
              </section>
            </>
          )}
          {showCharts && (
            <section className="charts-grid" aria-label="Gráficos gerenciais">
              {(page === 'Visão geral' || page === 'Reposição') && (
                <>
                  <Chart
                    title="Reposição por filial" data={sumBy(filtered,'filial_destino','qtd_reposicao')}
                    subtitle="Quantidade de reposição por filial de destino"
                    wide
                  />
                  <Chart
                    title="Reposição por departamento" data={sumBy(filtered,group==='Departamento'?'depto':'secao','qtd_reposicao')}
                    subtitle="Composição das necessidades de reposição"
                    control={
                      <div className="segmented">
                        {['Departamento', 'Seção'].map((g) => (
                          <button
                            key={g}
                            className={g === group ? 'selected' : ''}
                            onClick={() => setGroup(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    }
                    type="ring"
                    description={`Sem dados por ${group.toLowerCase()}`}
                  />
                </>
              )}
              {(page === 'Visão geral' || page === 'Distribuição') && (
                <Chart
                  title="Distribuição geográfica" data={sumBy(filtered,geo==='Região'?'regiao':'cidade','qtd_reposicao')}
                  subtitle="Reposição por localização de destino"
                  control={
                    <div className="segmented">
                      {['Região', 'Cidade'].map((g) => (
                        <button
                          key={g}
                          className={g === geo ? 'selected' : ''}
                          onClick={() => setGeo(g)}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  }
                  description={`Sem dados por ${geo.toLowerCase()}`}
                />
              )}{' '}
              {(page === 'Visão geral' || page === 'Estoques') && (
                <Chart
                  title="Comparativo de estoques" data={[["Estoque CD",values[6]],["Estoque filial",values[7]]]}
                  subtitle="Disponibilidade no CD e nas filiais"
                  legend
                />
              )}
              {page === 'Reposição' && (
                <Chart
                  title="Produtos com maior reposição" data={sumBy(filtered,'produto','qtd_reposicao')}
                  subtitle="Ordenação por quantidade de reposição"
                  wide
                />
              )}
            </section>
          )}
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>
                  <FileSpreadsheet size={18} />
                  {page === 'Relatórios'
                    ? 'Relatório detalhado'
                    : 'Detalhamento da base'}
                </h2>
                <p>Consulte os registros de geração de grades.</p>
              </div>
              <button
                className="button secondary"
                onClick={exportCSV}
                disabled={!searched.length}
                title="Exportar os registros filtrados"
              >
                <ArrowDownToLine size={16} />
                Exportar CSV
              </button>
            </div>
            <div className="table-toolbar">
              <label className="search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar produto, filial ou registro..."
                  aria-label="Pesquisar registros"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Limpar pesquisa"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <span className="table-tag">
                <ListFilter size={14} /> Base automática
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>
                        {c}
                        <ChevronDown size={11} />
                      </th>
                    ))}
                  </tr>
                </thead>
              {visibleRows.length > 0 ? <tbody>{visibleRows.map((r,i)=><tr key={`${r.id}-${i}`}>{displayFields.map(f=><td key={f} style={{padding:'12px 10px',borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{['qtd_reposicao','peso','total','estoque_cd','estoque_filial'].includes(f)?formatted(numeric(r[f])):safe(r[f])}</td>)}</tr>)}</tbody> : null}
              </table>
              {visibleRows.length === 0 && <div className="table-empty">
                <span className="empty-icon">
                  <FileSpreadsheet size={25} />
                </span>
                <h3>
                  {search
                    ? 'Nenhum resultado para a pesquisa'
                    : 'Nenhum registro disponível'}
                </h3>
                <p>
                  {search
                    ? 'Altere os termos pesquisados ou os filtros.'
                    : 'Verifique sua conexão e os filtros selecionados.'}
                </p>
                <button
                  className="text-button"
                  onClick={() => setDialog('connection')}
                >
                  Ver detalhes da integração <ArrowUpRight size={14} />
                </button>
              </div>}
            </div>
            <div className="pagination">
              <span>{formatted(searched.length)} registros encontrados</span>
              <div>
                <label>
                  Linhas por página{' '}
                  <select
                    value={size}
                    onChange={(e) => {setSize(e.target.value);setCurrentPage(0)}}
                    aria-label="Linhas por página"
                  >
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                  </select>
                </label>
                <span>{Math.min(currentPage,pages-1)+1} de {pages}</span>
                <button
                  className="icon-button"
                  disabled={currentPage===0}
                  onClick={()=>setCurrentPage(p=>Math.max(0,p-1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={currentPage>=pages-1}
                  onClick={()=>setCurrentPage(p=>Math.min(pages-1,p+1))}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              Dashboard Gerencial <span className="footer-dot">·</span> Geração
              de Grades
            </span>
            <span>
              <ShieldCheck size={13} /> Acesso autenticado via Supabase
            </span>
          </footer>
        </main>
      </div>
      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDialog(null)
              if (e.key === 'Tab') {
                const nodes =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    'button:not([disabled])',
                  )
                const first = nodes[0]
                const last = nodes[nodes.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault()
                  last?.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault()
                  first?.focus()
                }
              }
            }}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              aria-label="Fechar"
              onClick={() => setDialog(null)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              {dialog === 'connection' ? (
                <Database size={25} />
              ) : (
                <CircleHelp size={25} />
              )}
            </span>
            <div className="eyebrow">
              {dialog === 'connection'
                ? 'INTEGRAÇÃO ATIVA'
                : 'CENTRAL DE AJUDA'}
            </div>
            <h2 id="modal-title">
              {dialog === 'connection'
                ? 'Sua base, no centro da gestão.'
                : 'Sobre este painel'}
            </h2>
            {dialog === 'connection' ? (
              <>
                <p>
                  A aplicação consulta a view existente com a sessão autenticada do Supabase. Nenhum dado é alterado.
                </p>
                <dl>
                  <dt>Origem prevista</dt>
                  <dd>Supabase · BaseAutomatica</dd>
                  <dt>View existente</dt>
                  <dd>
                    <code>dashboard_base_automatica</code>
                  </dd>
                  <dt>Identificador</dt>
                  <dd>
                    <code>id</code> · bigint
                  </dd>
                  <dt>Acesso</dt>
                  <dd>Login Supabase e permissões de leitura habilitados</dd>
                </dl>
                <div className="modal-note">
                  <ShieldCheck size={19} />
                  <span>
                    A conexão utiliza a chave pública e o token do usuário autenticado. Não insira credenciais secretas nesta interface.
                  </span>
                </div>
              </>
            ) : (
              <>
                <p>
                  Use o menu para explorar os indicadores, estoques,
                  distribuição e o detalhamento da base.
                </p>
                <dl>
                  <dt>Indicadores sem valores</dt>
                  <dd>O traço indica informação indisponível, não zero.</dd>
                  <dt>Total geral</dt>
                  <dd>Soma da coluna total, sem interpretação monetária.</dd>
                  <dt>Relatórios completos</dt>
                  <dd>
                    A integração futura precisa paginar todos os registros e
                    agregar a base completa, sem corte em 1.000 linhas.
                  </dd>
                </dl>
              </>
            )}
            <button
              className="button primary modal-done"
              onClick={() => setDialog(null)}
            >
              Entendi
              <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
function Chart({
  title,
  subtitle,
  control,
  type,
  wide,
  legend,
  description,
  data = [],
}: {
  title: string
  subtitle: string
  control?: ReactNode
  type?: 'ring'
  wide?: boolean
  legend?: boolean
  description?: string
  data?: (string | number)[][]
}) {
  return (
    <article className={`chart-card ${wide ? 'chart-wide' : ''}`}>
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {control || (
          <span className="chart-menu">
            <BarChart3 size={17} />
          </span>
        )}
      </div>
      {legend && (
        <div className="legend">
          <span>
            <i />
            Estoque CD
          </span>
          <span>
            <i />
            Estoque filial
          </span>
        </div>
      )}
      <div style={{padding:'12px 22px',minHeight:180}}>
        {data.length ? data.slice(0,10).map(([label,value],i)=>{
          const max=Math.max(1,...data.map(([,v])=>numeric(v)))
          return <div key={`${label}-${i}`} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12}}><span>{safe(label)}</span><strong>{formatted(numeric(value))}</strong></div>
            <div style={{background:'#edf2f9',height:9,borderRadius:6,marginTop:5}}><div style={{width:`${100*numeric(value)/max}%`,background:'#2862d8',height:'100%',borderRadius:6}} /></div>
          </div>
        }) : <p style={{textAlign:'center',padding:35,color:'#667085'}}>Sem registros disponíveis</p>}
      </div>
      <div className="chart-bottom">
        <span>Fonte: base automática</span>
        <span>{data.length} categorias</span>
      </div>
    </article>
  )
}
