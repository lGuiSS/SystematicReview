# SysReview - Sistema de Revisão Bibliográfica Sistemática

Uma ferramenta completa e 100% client-side para condução de **revisões bibliográficas sistemáticas** seguindo a metodologia **PRISMA**. O SysReview guia o pesquisador desde a definição do protocolo até a análise bibliométrica e exportação dos resultados, sem necessidade de servidor backend.

## Funcionalidades

- **Definição de Protocolo** - Título, questão de pesquisa, palavras-chave, critérios de inclusão/exclusão, bases de dados alvo e configuração do sistema de pontuação
- **Importação de Artigos** - Suporte a BibTeX (Scopus, Web of Science, ScienceDirect) e MEDLINE (PubMed) com detecção automática de duplicatas (DOI + título normalizado)
- **Sistema de Pontuação Automática** - Scoring por correspondência de palavras-chave com pesos configuráveis para título, resumo e palavras-chave
- **Processamento de Dados** - Marcação de duplicatas, inclusão e exclusão individual ou em lote
- **Três Estágios de Filtro** - Filtros cascata com critérios de inclusão/exclusão do protocolo, com menu de contexto para ação rápida
- **Estatísticas e Visualizações** - Diagrama de fluxo PRISMA, gráficos por ano, país e periódico, extração de dados baseada nos critérios do protocolo
- **Bibliometria** - Redes de co-autoria, co-ocorrência de palavras-chave, detecção de comunidades (Louvain) e visualização de rede
- **Exportação** - Projeto completo em arquivo `.srp` e planilha `.xlsx` com dados extraídos
- **Auto-save** - Salvamento automático no localStorage com opção de auto-save via File System Access API
- **Internacionalização** - Interface em Português Brasileiro (padrão) e Inglês

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + Vite 7 |
| Estilização | Tailwind CSS 3 |
| Gráficos | Recharts |
| Exportação Excel | ExcelJS |
| Ícones | Lucide React |
| i18n | react-i18next |
| Análise de Redes | Graphology + Louvain |
| Visualização de Rede | vis-network |
| Persistência | localStorage + File System Access API |

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm (incluído com o Node.js)

## Instalação e Execução

```bash
# Clone o repositório
git clone <url-do-repositorio>

# Navegue até o diretório do projeto
cd sistema-revisao-bibliografica

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento com Hot Module Replacement |
| `npm run build` | Gera a versão de produção na pasta `dist/` |
| `npm run preview` | Pré-visualiza a build de produção |
| `npm run lint` | Executa o linting com ESLint |

## Estrutura do Projeto

```
src/
├── App.jsx                        # Componente principal (toda a lógica e UI)
├── main.jsx                       # Ponto de entrada da aplicação
├── fileSystem.js                  # Salvamento/carga de projetos (.srp) com versionamento de schema
├── index.css                      # Estilos globais
├── assets/                        # Imagens e recursos estáticos
├── bibliometrics/                 # Análise bibliométrica
│   ├── CoAuthorshipAnalysis.jsx   #   Rede de co-autoria
│   ├── KeywordCoOccurrence.jsx    #   Co-ocorrência de palavras-chave
│   ├── CommunityDetection.jsx     #   Detecção de comunidades (Louvain)
│   ├── NetworkVisualization.jsx   #   Visualização de rede (vis-network)
│   └── DensityVisualization.jsx   #   Visualização de densidade
├── components/                    # Componentes de UI
│   ├── ArticleModal.jsx           #   Modal de detalhes do artigo
│   ├── StatisticsSection.jsx      #   Gráficos e estatísticas
│   ├── AlertModal.jsx             #   Modal de alerta/toast
│   ├── UnsavedWarningModal.jsx    #   Aviso de alterações não salvas
│   ├── ReminderSettingsModal.jsx  #   Configuração de lembretes
│   ├── SupportModal.jsx           #   Modal de apoio/doação
│   ├── SupportRequestModal.jsx    #   Solicitação automática de apoio
│   └── AutoSaveOfferModal.jsx     #   Oferta de auto-save
├── countryPatterns/               # Padrões de nomes de países (2002 registros)
│   └── countryPatterns_v3.json    #   Extração automática de afiliação → país
├── i18n/                          # Internacionalização
│   ├── index.js                   #   Configuração do i18next
│   └── locales/
│       ├── pt.json                #   Traduções em Português Brasileiro
│       └── en.json                #   Traduções em Inglês
└── icons/
    └── SysReviewIcon.jsx          # Ícone SVG do projeto (globo)
```

## Fluxo de Trabalho

```
┌─────────────────────┐
│  1. Protocolo        │  Definir título, questão de pesquisa, palavras-chave,
│     de Revisão        │  critérios, bases de dados e configuração de pontuação
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. Importação       │  Importar BibTeX (Scopus/WoS/ScienceDirect) ou
│     de Artigos        │  MEDLINE (PubMed) com detecção de duplicatas
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  3. Processamento    │  Marcar como duplicata, incluir ou excluir
│     de Dados          │  (individual ou em lote)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  4. Filtros 1→2→3   │  Filtragem cascata com critérios de inclusão/
│     Sequenciais       │  exclusão; excluir em qualquer etapa reseta etapas posteriores
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  5. Estatísticas     │  Diagrama PRISMA, gráficos por ano/país/periódico,
│     e Bibliometria    │  redes de co-autoria, co-ocorrência de palavras-chave
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  6. Exportação       │  Arquivo de projeto .srp ou planilha .xlsx
└─────────────────────┘
```

## Sistema de Pontuação

O scoring automático avalia a relevância de cada artigo com base na correspondência de palavras-chave:

**Opções configuráveis:**
- Ignorar maiúsculas/minúsculas
- Correspondência por palavra exata (word boundary)
- Contar múltiplas ocorrências da mesma palavra-chave

O score é recalculado automaticamente ao alterar as palavras-chave ou a configuração (debounce de 500ms).

## Salvamento e Persistência

- **Auto-save (localStorage):** Salvamento automático a cada 5 segundos no armazenamento local do navegador
- **Auto-save (arquivo):** Após o primeiro salvamento manual, opção de habilitar auto-save direto no arquivo `.srp` via File System Access API
- **Salvar manualmente:** Cria e baixa um arquivo `.srp` (JSON com metadados e versionamento de schema v1.2.0)
- **Restauração:** O projeto é restaurado automaticamente ao recarregar a página (localStorage) ou ao abrir um arquivo `.srp`
- **Aviso de alterações não salvas:** Lembrete configurável antes de sair da página ou após período sem salvar

## Formatos de Importação

| Formato | Fonte | Extensão |
|---|---|---|
| BibTeX | Scopus, Web of Science, ScienceDirect | `.bib` |
| MEDLINE | PubMed | `.txt` |

> É necessário informar a **string de busca** utilizada em cada importação para rastreabilidade.

## Idiomas

- **Português Brasileiro (pt-BR)** - Idioma padrão
- **Inglês (en)** - Disponível via seletor na interface

## Autor

**Guilherme Santos Silva** - São Carlos, SP, Brasil
