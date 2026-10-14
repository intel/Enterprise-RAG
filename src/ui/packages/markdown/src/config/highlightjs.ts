// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import hljs from "highlight.js/lib/common";
import applescript from "highlight.js/lib/languages/applescript";
import armasm from "highlight.js/lib/languages/armasm";
import delphi from "highlight.js/lib/languages/delphi";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import erlang from "highlight.js/lib/languages/erlang";
import fortran from "highlight.js/lib/languages/fortran";
import http from "highlight.js/lib/languages/http";
import mathematica from "highlight.js/lib/languages/mathematica";
import nginx from "highlight.js/lib/languages/nginx";
import powershell from "highlight.js/lib/languages/powershell";
import properties from "highlight.js/lib/languages/properties";
import scala from "highlight.js/lib/languages/scala";

/**
 * Highlight.js configuration for secure syntax highlighting.
 *
 * This configuration prioritizes security by:
 * 1. Bundling highlight.js's curated "common" language set (~36 of the most used languages,
 *    including shell, config and data formats) instead of every grammar, plus:
 *    - the LLM Guard "code" scanner languages (`SUPPORTED_CODE_LANGUAGES` in
 *      packages/control-plane/src/configs/guards/constants.ts) that "common" doesn't include —
 *      keep those registrations in sync with that list;
 *    - a few ops/config formats common in enterprise answers but missing from "common".
 *    Unregistered languages render as "Plain Text" (see renderer.ts).
 *    No highlight.js core grammar exists for "COBOL" or "jq", so those fall back to plain text.
 * 2. Throwing errors on unescaped HTML (prevents XSS attacks)
 * 3. Enabling safe mode (disables HTML rendering in code)
 */

// Guard code-scanner languages missing from highlight.js/lib/common
const guardScannerLanguages = {
  armasm, // ARM Assembly
  applescript, // AppleScript
  erlang, // Erlang
  fortran, // Fortran
  mathematica, // Mathematica/Wolfram Language
  delphi, // Pascal (grammar aliases include "pascal")
  powershell, // PowerShell
  scala, // Scala
};

// Ops/config formats missing from highlight.js/lib/common
const opsLanguages = {
  dockerfile,
  http,
  nginx,
  properties,
};

for (const [name, language] of Object.entries({
  ...guardScannerLanguages,
  ...opsLanguages,
})) {
  hljs.registerLanguage(name, language);
}

// Throw errors if unescaped HTML is detected in code blocks
// This prevents potential XSS attacks through code injection
hljs.configure({
  throwUnescapedHTML: true,
});

// Enable safe mode to disable HTML rendering and force plain text handling
// Additional layer of XSS protection
hljs.safeMode();

export default hljs;
