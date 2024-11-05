# Intel(R) AI for Enterprise RAG

![logo](./images/logo.png)

Intel AI for Enterprise RAG makes turning your enterprise data into actionable insights easy while delivering better total cost of ownership (TCO) than the alternative. Powered by Intel Gaudi AI accelerators and Intel Xeon processors, Intel AI for Enterprise RAG integrates components from industry partners to offer a streamlined approach to deploying solutions for enterprises. It scales seamlessly with proven orchestration frameworks, giving you the flexibility and choice your enterprise needs.

**ChatQnA**

The ChatQnA solution uses retrieval augmented generation (RAG) architecture, which is quickly becoming the industry standard for chatbot development. It combines the benefits of a knowledge base (via a vector store) and generative models to reduce hallucinations, maintain up-to-date information, and leverage domain-specific knowledge. 

![arch](./images/architecture.png)

For the complete microservices architecture, refer [here](./docs/microservices_architecture.png)

# Table of Contents

- [Documentation](#documentation)
- [System Requirements](#system-requirements)
- [Installation](#Installation)
- [Support](#support)
- [License](#license)
- [Security](#security)
- [Trademark Information](#trademark-information)

# Documentation

* [Deployment Guide](deployment/README.md) explains how to install and configure Intel(R) AI for Enterprise RAG for your needs.

# System Requirements


|         |                                                                                                           |
|--------------------|--------------------------------------------------------------------------------------------------------------------|
| Operating System   | Ubuntu 22.04                                                               |
| Hardware Platforms | 3th Gen Intel Xeon processors and Intel(R) Gaudi(R) 2 AI accelerator <br> 4th Gen Intel Xeon processors and Intel(R) Gaudi(R) 2 AI accelerator |
| Kubernetes Vesrion   | 1.29
| Gaudi Firmware Version   | 1.18.0
Intel(R) AI for Enterprise RAG supports following platforms: 
- 4th Gen Intel Xeon processors
- 5th Gen Intel Xeon processors
- Intel(R) Gaudi(R) 2 AI accelerator
  
## Requirements for Building from Source

### Hardware Prerequisites
To get the right instances to run Intel(R) AI for Enterprise RAG, follow these steps:

- visit Intel® Tiber™ AI Cloud using this [link](https://console.cloud.intel.com/home).
- In the left pane select `Catalog > Hardware`.
- Select `Gaudi® 2 Deep Learning Server` or `Gaudi® 2 Deep Learning Server - Dell`.
- Select the Machine image - `ubuntu-22.04-gaudi2-v1.17.0-metal-cloudimg-amd64-v20240803` with `Architecture: X86_64 (Baremetal only)`.


### Software Prerequisites

Refer to the [prerequisites](./docs/prerequisites.md) guide for detailed instructions to install the components mentioned below:

-   **Kubernetes Cluster**: Access to a Kubernetes v1.29 cluster
-   **CSI Driver**: The K8s cluster must have the CSI driver installed, using the  [local-path-provisioner](https://github.com/rancher/local-path-provisioner)  with  `local_path_provisioner_claim_root`  set to  `/mnt`. For an example of how to set up Kubernetes via Kubespray, refer to the prerequisites guide:  [CSI Driver](./docs/prerequisites.md#csi-driver).
-   **Operating System**: Ubuntu 22.04
-   **Gaudi Software Stack**: Verify that your setup uses a valid software stack for Gaudi accelerators, see  [Gaudi support matrix](https://docs.habana.ai/en/latest/Support_Matrix/Support_Matrix.html). Note that running LLM on a CPU is possible but will significantly reduce performance.
-   **Prepared Gaudi Node**: Please refer to the [Gaudi Software Stack](./docs/prerequisites.md#gaudi-software-stack) section of the prerequisites section.
-   **Hugging Face Model Access**: Ensure you have the necessary access to download and use the chosen Hugging Face model. This default model used is `Mixtral-8x22B` for which access needs to be requested. Visit  [Mixtral-8x22B](https://huggingface.co/mistralai/Mixtral-8x22B-Instruct-v0.1) to apply for access.
- **Disk Space**: `1TB` of disk space is generally recommended. It is highly dependent on the model size. The model used in the default examples(`Mixtral-8x22B`) takes up a disk space of `~260GB`

# Installation

```
git clone https://github.com/intel-innersource/applications.ai.enterprise-rag.enterprise-ai-solution.git
cd applications.ai.enterprise-rag.enterprise-ai-solution/deployment
./one_click_chatqna.sh -g HUG_TOKEN -z GRAFANA_PASSWORD [-p HTTP_PROXY] [-u HTTPS_PROXY] [-n NO_PROXY] -d PIPELINE -t [TAG] -i IP
```

Proxy variables are optional.
Refer [Deployment](deployment/README.md#prerequisites) if you prefer to install with multiple options.

# Support

Submit questions, feature requests, and bug reports on the
GitHub Issues page.

# License

Intel(R) AI for Enterprise RAG is licensed under [Apache License Version 2.0](LICENSE). Refer to the
"[LICENSE](LICENSE)" file for the full license text and copyright notice.

This distribution includes third party software governed by separate license
terms. This third party software, even if included with the distribution of
the Intel software, may be governed by separate license terms, including
without limitation, third party license terms, other Intel software license
terms, and open source software license terms. These separate license terms
govern your use of the third party programs as set forth in the
"[THIRD-PARTY-PROGRAMS](THIRD-PARTY-PROGRAMS)" file.

# Security

[Security Policy](SECURITY.md) outlines our guidelines and procedures
for ensuring the highest level of Security and trust for our users
who consume oneDNN.

# Trademark Information

Intel, the Intel logo, Arc, Intel Atom, Intel Core, Iris,
OpenVINO, the OpenVINO logo, Pentium, VTune, and Xeon are trademarks
of Intel Corporation or its subsidiaries.

Arm and Neoverse are trademarks, or registered trademarks of Arm Ltd.

\* Other names and brands may be claimed as the property of others.

Microsoft, Windows, and the Windows logo are trademarks, or registered
trademarks of Microsoft Corporation in the United States and/or other
countries.

OpenCL and the OpenCL logo are trademarks of Apple Inc. used by permission
by Khronos.

(C) Intel Corporation
