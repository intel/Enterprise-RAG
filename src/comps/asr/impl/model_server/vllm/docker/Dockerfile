# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

ARG vllm_version=0.22.1

FROM public.ecr.aws/q9t5s3a7/vllm-cpu-release-repo:v${vllm_version}

RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && rm -rf /var/cache/apk/*

RUN useradd -u 1000 -g 0 -m -s /bin/bash user && chmod g=u /home/user
ENV PATH="$PATH:/home/user/.local/bin"
WORKDIR /home/user/

ARG vllm_version
RUN pip install --no-cache "vllm[audio]==${vllm_version}" && \
    pip cache purge

# Fix known Python package CVEs
RUN pip install --no-cache-dir --upgrade \
    "setuptools==82.0.1" \
    "wheel==0.46.2"

USER 1000
# OpenShift (restricted-v2) runs as an arbitrary UID with no passwd entry: keep HOME.
ENV HOME=/home/user
