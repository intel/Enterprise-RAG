# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

ARG python_version=3.11
ARG python_image_version=${python_version}-slim-trixie
# Pinned by digest so the base (and its OpenSSL) only changes when bumped here,
# keeping it in step with the openssl pin below.
ARG python_image_digest=sha256:bab1b7ef4b450c81002278d035eff85ebe394ae94df904f7a3ba14f7e16e487b

FROM python:${python_image_version}@${python_image_digest}
COPY --from=ghcr.io/astral-sh/uv:0.8.0 /uv /uvx /bin/

ENV LANG=C.UTF-8
ARG python_version

RUN apt-get -y update && \
    apt-get install -y --only-upgrade openssl=3.5.7-1~deb13u3 libssl3t64=3.5.7-1~deb13u3 openssl-provider-legacy=3.5.7-1~deb13u3 && \
    apt-get install --no-install-recommends --fix-missing -y asciidoctor libreoffice libgl1 tesseract-ocr tesseract-ocr-pol libmagic1 ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN rm -f /usr/bin/dmesg /usr/bin/base64 /usr/bin/perl
RUN rm -rf /home/user/.local/lib/python${python_version}/site-packages/*
RUN rm -rf /usr/local/lib/python${python_version}/site-packages/*

RUN useradd -m -s /bin/bash user

USER user
ENV PATH="$PATH:/home/user/.local/bin"
ENV PYTHONPATH="/home/user"

WORKDIR /home/user
COPY ./comps/text_extractor/impl/microservice/pyproject.toml pyproject.toml
COPY ./comps/text_extractor/impl/microservice/uv.lock uv.lock

# --locked will fail when any changes in pyproject.toml were introduced
# Source: https://github.com/astral-sh/uv/blob/main/docs/concepts/projects/sync.md#checking-if-the-lockfile-is-up-to-date
RUN uv sync --locked --no-cache
ENV PATH="/home/user/.venv/bin:$PATH"

# Bake the NLTK corpora into the image: nltk >= 3.10.3 refuses proxied downloads
# (SSRF hardening), so a runtime fetch fails in proxied clusters.
RUN NLTK_ALLOW_PROXIED_URLOPEN=1 python -m nltk.downloader -d /home/user/.venv/nltk_data \
    punkt_tab averaged_perceptron_tagger averaged_perceptron_tagger_eng

COPY --chown=user:user ./comps/cores ./comps/cores
COPY --chown=user:user ./comps/text_extractor/utils ./comps/text_extractor/utils
COPY --chown=user:user ./comps/text_extractor/impl/microservice/.env ./comps/text_extractor/impl/microservice/.env
COPY --chown=user:user ./comps/text_extractor/erag_text_extractor_microservice.py ./comps/text_extractor/erag_text_extractor_microservice.py

WORKDIR /home/user/comps/text_extractor
CMD ["python", "erag_text_extractor_microservice.py"]
