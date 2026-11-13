# Arquitetura

React 19 + TypeScript + TanStack Start, com adaptador Netlify. `src/routes/index.tsx` monta a interface; `src/routes/__root.tsx` define metadados e idioma pt-BR; `src/components/Dashboard.tsx` contém navegação, indicadores indisponíveis, estados vazios dos gráficos, relatórios e diálogos. `src/styles.css` define o sistema visual e responsividade.

# Convenções

Interface em português brasileiro, azul e branco. Use ícones Lucide, controles semânticos e estados de foco. Mantenha CSS responsivo e suporte a movimento reduzido. APIs do navegador apenas em eventos ou efeitos. Não executar comandos de build ou validação nesta sessão; a plataforma valida automaticamente.

# Decisões de escopo

O usuário escolheu explicitamente a interface sem conexão. Não adicionar dados fictícios, autenticação simulada ou alegar integração ativa. Não substituir nem alterar o banco existente. Nenhum dado privado é carregado nesta versão. Campos indisponíveis mostram traço; controles que exigem dados permanecem indisponíveis. Pesquisa e tamanho de página são somente estado de interface, sem persistência.

A view prevista é `dashboard_base_automatica`, chave `id` bigint. As colunas de departamento e seção se chamam `depto` e `secao`. Total geral soma `total` e não é dinheiro. Integração futura exige decisão arquitetural, autenticação real, permissões de leitura, paginação estável e agregação global. O README documenta esse contrato.
