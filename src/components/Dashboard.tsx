import { useState } from 'react'
import { Building2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Info, Search, Weight, Package, Layers } from 'lucide-react'

const title = 'Previsão da geração de grade das lojas'
const metrics = [
  { label: 'Lojas', note: 'Filiais de destino distintas', icon: Building2 },
  { label: 'Registros', note: 'Linhas da base automática', icon: FileSpreadsheet },
  { label: 'Peso total', note: 'Peso informado na base · kg', icon: Weight },
  { label: 'Reposição', note: 'Quantidade total de reposição', icon: Package },
  { label: 'Total geral', note: 'Soma do total · sem valor monetário', icon: Layers },
]

function StoreTable({ name, code, search }: { name: string; code: string; search: string }) {
  return (
    <section className="store-panel" aria-label={`Lojas da bandeira ${name}`}>
      <header className="store-heading">
        <h2>{code} · {name}</h2><span>— lojas</span>
      </header>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabela ${name}`}>
        <table>
          <caption className="sr-only">Previsão por loja · {name}. Dados indisponíveis.</caption>
          <thead><tr><th scope="col">Loja</th><th scope="col">Registros</th><th scope="col">Reposição</th><th scope="col">Peso kg</th><th scope="col">Total</th></tr></thead>
          <tbody><tr><td colSpan={5} className="empty-cell">
            <Building2 size={25} strokeWidth={1.4} aria-hidden="true" />
            <strong>Dados das lojas indisponíveis</strong>
            <span>{search ? 'A pesquisa estará disponível após a integração.' : 'Aguardando integração para apresentar a previsão.'}</span>
          </td></tr></tbody>
          <tfoot><tr><th scope="row">Total</th><td>—</td><td>—</td><td>—</td><td>—</td></tr></tfoot>
        </table>
      </div>
    </section>
  )
}

export function Dashboard() {
  const [search, setSearch] = useState('')
  const [size, setSize] = useState('25')
  return (
    <div className="presentation">
      <a className="skip-link" href="#relatorio">Pular para o relatório</a>
      <header className="report-masthead">
        <div className="masthead-inner">
          <div className="logo-box"><img src="/images/grupo-mateus.png" alt="Grupo Mateus" width="153" height="102" /></div>
          <div className="masthead-title"><span className="overline">RELATÓRIO GERENCIAL · GERAÇÃO DE GRADES</span><h1>{title}</h1><p>Planejamento de reposição · visão por bandeira e loja</p></div>
          <div className="extraction"><span>ÚLTIMA EXTRAÇÃO</span><strong>—</strong><small>Dados indisponíveis</small></div>
        </div>
      </header>
      <main id="relatorio">
        <div className="cycle-row"><div className="cycle"><strong>Ciclo</strong><span>—</span><span className="cycle-divider" /><span>Período indisponível</span></div><span className="offline"><span /> Interface sem conexão</span></div>
        <section className="metrics" aria-label="Resumo da previsão">
          {metrics.map(({ label, note, icon: Icon }) => <article className="metric" key={label}><div className="metric-label">{label}<Icon size={17} aria-hidden="true" /></div><strong className="metric-value" aria-label="Indisponível">—</strong><p>{note}</p></article>)}
        </section>
        <div className="data-note" role="note"><Info size={17} aria-hidden="true" /><p><strong>Previsão ainda indisponível.</strong> Esta apresentação não carrega dados privados. Os indicadores e totais serão apresentados após a integração.</p></div>
        <section className="report-controls" aria-label="Controles do relatório">
          <div><span className="overline">DETALHAMENTO</span><h2>Previsão por bandeira</h2></div>
          <div className="control-actions"><label className="search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Pesquisar loja" placeholder="Pesquisar loja…" value={search} onChange={e => setSearch(e.target.value)} /></label><button className="export-button" disabled title="Exportação disponível após a integração"><Download size={16} aria-hidden="true" />Exportar relatório</button></div>
        </section>
        <div className="store-grid"><div className="store-column"><StoreTable code="11" name="MIX" search={search} /><StoreTable code="14" name="CAMINO" search={search} /><StoreTable code="15" name="SUPER" search={search} /></div><div className="store-column"><StoreTable code="8" name="HIPER/SPAZIO" search={search} /><StoreTable code="18" name="ARMAZZEM" search={search} /></div></div>
        <div className="pagination"><span>Quantidade de lojas indisponível</span><div><label>Lojas por página<select value={size} onChange={e => setSize(e.target.value)}><option>25</option><option>50</option><option>100</option></select></label><button disabled aria-label="Página anterior"><ChevronLeft size={18} /></button><button disabled aria-label="Próxima página"><ChevronRight size={18} /></button></div></div>
        <footer><p>Pesos em kg · Total geral sem interpretação monetária · Traços indicam dados indisponíveis.</p><span>Previsão da geração de grade das lojas</span></footer>
      </main>
    </div>
  )
}
