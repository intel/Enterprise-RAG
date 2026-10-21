#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import functools

import kr8s

cfg = {}  # dictionary to hold build configuration


def keycloak_base_url():
    """External Keycloak URL for the configured routing mode.

    Path mode serves Keycloak under the platform's keycloak_path (http-relative-path,
    default /keycloak) on the base domain; subdomain mode on keycloak.<base_domain_name>.
    """
    fqdn = cfg.get("base_domain_name")
    if cfg.get("routing_mode", "subdomain") == "path":
        prefix = cfg.get("erag_keycloak_default_path_prefix") or cfg.get("keycloak_path") or "/keycloak"
        return f"https://{fqdn}{prefix}"
    return f"https://keycloak.{fqdn}"


@functools.cache
def is_openshift():
    if "cluster_distribution" in cfg:
        return cfg["cluster_distribution"] == "openshift"
    if not cfg.get("existing_kubernetes"):
        return False
    try:
        return bool(list(kr8s.get("clusterversions.config.openshift.io", "version")))
    except ValueError:
        return False
