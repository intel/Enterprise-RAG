# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# Use the official Python image from the Docker Hub
ARG python_version=3.11
ARG python_image_version=${python_version}-slim-trixie
# Pinned by digest so the base (and its OpenSSL) only changes when bumped here,
# keeping it in step with the openssl pin below.
ARG python_image_digest=sha256:bab1b7ef4b450c81002278d035eff85ebe394ae94df904f7a3ba14f7e16e487b

FROM python:${python_image_version}@${python_image_digest}
COPY --from=ghcr.io/astral-sh/uv:0.8.0 /uv /uvx /bin/

ARG python_version
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends --only-upgrade openssl=3.5.7-1~deb13u3 libssl3t64=3.5.7-1~deb13u3 openssl-provider-legacy=3.5.7-1~deb13u3 && \
    apt-get install -y --no-install-recommends qpdf && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN rm -f /usr/bin/dmesg /usr/bin/base64 /usr/bin/perl
RUN rm -rf /home/user/.local/lib/python${python_version}/site-packages/*
RUN rm -rf /usr/local/lib/python${python_version}/site-packages/*

# Add non-root user
RUN useradd -m -s /bin/bash -u 1000 -g 0 user

USER 1000
ENV HOME=/home/user
ENV PATH="$PATH:/home/user/.local/bin"
ENV PYTHONPATH="/home/user"

# Copy the dependencies file into the container
WORKDIR /home/user
COPY ./edp/app/pyproject.toml pyproject.toml
COPY ./edp/app/uv.lock uv.lock

# --locked will fail when any changes in pyproject.toml were introduced
# Source: https://github.com/astral-sh/uv/blob/main/docs/concepts/projects/sync.md#checking-if-the-lockfile-is-up-to-date
RUN uv sync --locked --no-cache
ENV PATH="/home/user/.venv/bin:$PATH"

# Copy the rest of the application code into the container
COPY --chown=user:0 ./edp/app ./app
COPY --chown=user:0 ./comps/cores/mega/logger.py ./comps/cores/mega/logger.py

# Expose the port the app runs on
EXPOSE 5000

# Set workdir
WORKDIR /home/user/app
COPY --chown=user:0 ./edp/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
# OpenShift (restricted-v2) runs the container as an arbitrary UID in group 0:
# let group 0 create files wherever the owner can.
USER root
RUN find /home/user -name .venv -prune -o -type d -exec chmod g=u {} +
USER 1000
ENTRYPOINT ["./entrypoint.sh"]
