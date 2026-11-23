# Previsão da geração de grade das lojas

Interface responsiva em português brasileiro para acompanhamento de reposição, estoques e distribuição. Desenvolvida com React 19, TypeScript, TanStack Start, CSS e Lucide, com adaptação para publicação no Netlify.

## Escopo atual

Conforme solicitado após esclarecimento, esta entrega contém **somente a interface, sem conexão**. Não há dados fictícios, consultas, autenticação, armazenamento ou exportação de dados reais. Nenhuma alteração foi feita no banco existente. Os traços nos indicadores representam informação indisponível, não zero. As tabelas por bandeira apresentam estados vazios, sem registros simulados. A apresentação segue a referência fornecida: cabeçalho azul-marinho com detalhe vermelho, marca do Grupo Mateus, cinco indicadores e tabelas em duas colunas. Os códigos e nomes das bandeiras foram usados como estrutura visual da referência; não representam agrupamentos consultados na base. A marca foi recortada da imagem fornecida e está em `public/images/grupo-mateus.png`.

A pesquisa e a seleção do tamanho de página funcionam somente como estado da interface, sem persistência ou consulta. Paginação e exportação permanecem indisponíveis até a integração. Não há login ou requisições à base. O layout se adapta a telas pequenas, com rolagem horizontal das tabelas, controles semânticos, estados de foco e suporte a movimento reduzido.

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
