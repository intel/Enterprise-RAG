# Intel® AI for Enterprise RAG Documentation

The technical documentation for the RAG application layer. Start with **Meet** for the
what and why, **Get started** to stand it up, **Deploy** to choose a pipeline and go
further, then customize, operate, and look things up as needed.

> [!IMPORTANT]
> This layer is a component of [Intel® AI for Enterprise Solutions](https://github.com/intel/enterprise-ai-solutions). Clone **that** repository, run every command from its root, and `init erag` will fetch this one into `ext/` for you. See [Meet](meet/meet.md#where-the-pieces-live).

## Meet

| Guide | What it covers |
|-------|----------------|
| [Meet Intel® AI for Enterprise RAG](meet/meet.md) | What it is, why it exists, when to choose it, and which repository to start from |
| [FAQ](faq.md) | Short answers to the questions that come up most |
| [Glossary](glossary.md) | Every term used in these guides, defined once |

## Get started

Check your machine meets the bar, then deploy the stack and ingest a document.

| Guide | What it covers |
|-------|----------------|
| [Prerequisites](quickstart/prerequisites.md) | RAG hardware sizing, software access, and the limited single-user option |
| [Quick Start](quickstart/quickstart.md) | `init erag` to a working assistant, end to end |

## Deploy

Install the layer, pick a pipeline, and take it onto a partner platform.

| Guide | What it covers |
|-------|----------------|
| [Deploy the RAG Layer](deploy/install_rag.md) | Step-by-step install, endpoints, credentials, and teardown |
| [Pipelines](deploy/pipelines.md) | The five flavours, ChatQnA variants, and how to switch between them |
| [Deploy on VMware](deploy/vmware.md) | Running the chatbot on VMware vSphere |
| [Deployment Layer Reference](../deployment/README.md) | What the `deployment/` plug-in contributes and how the installer consumes it |

## Customize

Change models, wire up identity and external data sources, and tune every knob.

| Guide | What it covers |
|-------|----------------|
| [Configuration](customize/configuration.md) | Every option in `config.erag.yaml`, and how overrides resolve |
| [Models](customize/models.md) | Changing the LLM, embedding, and reranking models; multilingual and accuracy features |
| [Authentication](customize/auth.md) | Keycloak SSO with Microsoft Entra ID, multi-factor auth, and Active Directory federation |
| [SharePoint](customize/sharepoint.md) | Ingesting from SharePoint Online, scheduled sync, and per-user site filtering |
| [MCP Integration](customize/mcp.md) | Exposing retrieval and ingestion to AI agents over Model Context Protocol |
| [Object Store](customize/object_store.md) | EDP storage backends, and serving documents from NetApp ONTAP S3 |
| [AWS S3 and SQS Setup](customize/aws_s3.md) | Creating the buckets, queue, and IAM user for external S3 with the AWS CLI |
| [Building Images](customize/images.md) | Building the component images locally and pointing the deployment at your registry |

## Operate

Watch it, tune it, and fix it once it is running.

| Guide | What it covers |
|-------|----------------|
| [Telemetry](operate/telemetry.md) | The RAG Grafana dashboards and where to find logs |
| [Performance](operate/performance.md) | Per-step resources, replica sizing, autoscaling, and vector-database tuning |
| [Backup and Restore](operate/backup.md) | Enabling it, running a backup or restore, what is and is not captured, and the identity realm |
| [Troubleshooting](operate/troubleshooting.md) | Common symptoms, their causes, and the debug tool |

## Reference

How the layer is built and what it exposes.

| Guide | What it covers |
|-------|----------------|
| [Architecture](reference/architecture.md) | Components, roles, namespaces, pipeline composition, and request flow |
| [Container Images](reference/docker_images.md) | Every image the deployment pulls, with its build context |
| [Service Mesh](reference/mesh.md) | How RAG namespaces join the Istio ambient mesh, and the current mTLS posture |

## User guides

Feature and usage walkthroughs for each app, with screenshots.

| Guide | App |
|-------|-----|
| [AudioQnA User Guide](Intel_AI_for_Enterprise_RAG_AudioQnA_User_Guide.pdf) | Voice question answering |
| [ChatQnA User Guide](Intel_AI_for_Enterprise_RAG_ChatQnA_User_Guide.pdf) | Conversational retrieval |
| [DocSum User Guide](Intel_AI_for_Enterprise_RAG_DocSum_User_Guide.pdf) | Document summarization |
