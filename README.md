# Dashboard Gerencial — Geração de Grades

Interface responsiva em português brasileiro para acompanhamento de reposição, estoques e distribuição. Desenvolvida com React 19, TypeScript, TanStack Start, CSS e Lucide, com adaptação para publicação no Netlify.

## Escopo atual

Conforme solicitado após esclarecimento, esta entrega contém **somente a interface, sem conexão**. Não há dados fictícios, consultas, autenticação, armazenamento ou exportação de dados reais. Nenhuma alteração foi feita no banco existente. Os traços nos indicadores representam informação indisponível, não zero. Os gráficos apresentam estados vazios, sem séries simuladas.

Funcionam a navegação entre áreas, abertura dos detalhes e ajuda, alternância de agrupamentos, recolhimento de filtros, edição da pesquisa, limpeza e seleção de tamanho de página. Filtros dependentes de registros, paginação e CSV permanecem indisponíveis até a integração. Atualizar dados informa que a integração está pendente; não realiza requisições.

## Desenvolvimento local

Use Node.js 22.13+ e pnpm:

```sh
pnpm install
pnpm dev
```

A configuração de publicação está em `netlify.toml`. O pipeline realiza a compilação automaticamente.

## Contrato da integração futura

Origem prevista: view `dashboard_base_automatica` do banco existente. Identificador único: `id` (bigint, tratar como string para evitar perda de precisão). Agrupamentos: `filial_destino`, `depto`, `secao`, `produto`, `cidade`, `regiao`. Reposição = soma de `qtd_reposicao`; peso = soma de `peso`; total geral = soma de `total`, **sem interpretação monetária**. Filiais e produtos são contagens distintas. Estoques correspondem a `estoque_cd` e `estoque_filial`; validar a granularidade antes de somar, evitando duplicações de saldos.

A próxima etapa precisa definir a arquitetura de integração e autenticação permitida. Configurar uma chave não ativa esta versão. Nunca incluir chaves secretas no navegador ou repositório. Exigir sessão válida e permissões de leitura na origem; esconder componentes não protege dados. Não expor dados antes da implementação e validação do controle de acesso.

Para mais de 14 mil linhas, implementar paginação determinística por `id`, filtros e pesquisa na origem, agregações no banco sobre todo o conjunto filtrado e exportação paginada completa. Não calcular totais a partir de uma página ou do limite padrão de 1.000 registros. Prevenir injeção de fórmulas em células CSV, incluir cabeçalho, escapar delimitadores e preservar acentos.
