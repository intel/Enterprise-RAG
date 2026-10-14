// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";

import { withScope } from "@/utils/scope";

const CONFIG_ENDPOINT = "/v1/system_fingerprint/config";
const CHANGE_ARGUMENTS_ENDPOINT = "/v1/system_fingerprint/change_arguments";

describe("withScope", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("appends pipeline and _global tenant when PIPELINE is set", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_PIPELINE", "chatqna");

    const url = withScope(CHANGE_ARGUMENTS_ENDPOINT);

    expect(url).toBe(
      `${CHANGE_ARGUMENTS_ENDPOINT}?pipeline=chatqna&tenant=_global`,
    );
  });

  it("keeps params_key alongside the pipeline scope", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_PIPELINE", "audioqna");

    const url = withScope(CONFIG_ENDPOINT, { params_key: "llm" });

    expect(url).toBe(
      `${CONFIG_ENDPOINT}?params_key=llm&pipeline=audioqna&tenant=_global`,
    );
  });

  it("omits the scope when PIPELINE is absent", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_PIPELINE", "");

    expect(withScope(CHANGE_ARGUMENTS_ENDPOINT)).toBe(
      CHANGE_ARGUMENTS_ENDPOINT,
    );
    expect(withScope(CONFIG_ENDPOINT, { params_key: "retriever" })).toBe(
      `${CONFIG_ENDPOINT}?params_key=retriever`,
    );
  });

  it("encodes param values and joins with a single question mark", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_PIPELINE", "chatqna");

    const url = withScope(CONFIG_ENDPOINT, { params_key: "prompt template" });

    expect(url.match(/\?/g)).toHaveLength(1);
    expect(url).toBe(
      `${CONFIG_ENDPOINT}?params_key=prompt+template&pipeline=chatqna&tenant=_global`,
    );
  });
});
