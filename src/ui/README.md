# Intel® AI for Enterprise RAG UI

This is the monorepo for the **Intel® AI for Enterprise RAG UI**, containing UI applications for different RAG solutions and supporting packages. It uses [pnpm](https://pnpm.io/) for fast, efficient package management and workspace support.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Workspace Structure](#workspace-structure)
  - [Apps](#apps)
  - [Packages](#packages)
- [Getting Started](#getting-started)
  - [Install dependencies](#install-dependencies)
  - [Build all packages](#build-all-packages)
  - [Launch the UI development server](#launch-the-ui-development-server)
- [License](#license)

## Prerequisites

- [Node.js](https://nodejs.org/) version 20 or higher
- [pnpm](https://pnpm.io/) version 9 or higher
- [npm](https://www.npmjs.com/) version 10 or higher

To check if all were successfully installed run the following commands:

```bash
node --version
```

```bash
npm --version
```

```bash
pnpm --version
```

`--version` option can be replaced with `-v` shorthand

## Workspace Structure

### Apps

- [@intel-enterprise-rag-ui/chatqna](apps/chatqna)
- [@intel-enterprise-rag-ui/audioqna](apps/audioqna)
- [@intel-enterprise-rag-ui/docsum](apps/docsum)

### Packages

- [@intel-enterprise-rag-ui/auth](packages/auth)
- [@intel-enterprise-rag-ui/chat](packages/chat)
- [@intel-enterprise-rag-ui/components](packages/components)
- [@intel-enterprise-rag-ui/control-plane](packages/control-plane)
- [@intel-enterprise-rag-ui/data-ingestion](packages/data-ingestion)
- [@intel-enterprise-rag-ui/icons](packages/icons)
- [@intel-enterprise-rag-ui/input-validation](packages/input-validation)
- [@intel-enterprise-rag-ui/layouts](packages/layouts)
- [@intel-enterprise-rag-ui/markdown](packages/markdown)
- [@intel-enterprise-rag-ui/shadcn-preset](packages/shadcn-preset) — live Tailwind v4 theme (`index.css`) + shadcn preview harness
- [@intel-enterprise-rag-ui/utils](packages/utils)

## Getting Started

### Install dependencies

```bash
pnpm install
```

This command will install dependencies for all apps and packages in this workspace.

### Build all packages

```bash
pnpm -r build
```

This command runs `build` scripts defined inside `package.json` files of all packages and apps in the workspace, ensuring every dependency is compiled before running the app.

### Launch the UI development server

To start the **Intel® AI for Enterprise RAG ChatQnA UI**, navigate to the `apps/chatqna` directory and run the development server:

```bash
cd apps/chatqna
npm run dev
```

The application will be available at `http://localhost:5173` by default.

For additional details on running and deploying **Intel® AI for Enterprise RAG ChatQnA UI**, refer to its [README](apps/chatqna/README.md).

## Control plane parameters

The admin control plane reads and writes pipeline parameters through the system
fingerprint service. Parameters are keyed per instance by `params_key`, so a
pipeline can run several instances of one kind (for example two LLM steps) with
independent settings.

- `SERVICE_NAME_NODE_ID_MAP` (in each app's `features/admin-panel/control-plane/utils/api.ts`)
  maps a backend service to the graph node IDs it backs. Each entry is an array:
  single-instance services list one node ID, and a service backing several
  instances of its kind lists a node ID per instance.
- The per-key read endpoint `GET /v1/system_fingerprint/config?params_key=<key>`
  returns a single instance's stored values, kind, and version. The values come
  back already in wire shape: a flat kind carries its fields at the top level and
  a nested guard kind carries them under its dedicated key. The control plane
  hydrates its cards by reading each group in the app's params-key list from this
  endpoint and merging them with `assembleServicesParameters`, which maps every
  group onto its card args via `parseServiceParametersByKind`. The key list is
  per app: chatqna and audioqna use `CONTROL_PLANE_PARAMS_KEYS` (llm, retriever,
  reranker, prompt_template, input_guard, output_guard), while docsum uses
  `DOCSUM_PARAMS_KEYS` (llm, docsum). Both the read and the write are scoped by
  `withScope`, which appends `pipeline` (from the runtime `PIPELINE` env, always
  set by the chart from `.Values.type`) and `tenant` (pinned to `_global` until
  `FINGERPRINT_PER_USER_TENANT`). Both are omitted - falling back to the service
  default - only when `PIPELINE` is unset.
- Writes go through `change_arguments`. For a free-form instance key that is not
  a canonical group name, the write carries a `params_kind` so the backend can
  select the value model to validate against. Prompt-template placeholder
  validation is unchanged.

## License

See [LICENSE](../../LICENSE) in the repository root.
