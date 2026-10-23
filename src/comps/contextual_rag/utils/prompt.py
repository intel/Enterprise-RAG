# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# Prompt from Anthropic's "Introducing Contextual Retrieval"
# (https://www.anthropic.com/engineering/contextual-retrieval), reproduced verbatim.
#
# The ordering matters: the whole document comes FIRST and is byte-identical for every
# chunk of that document, while the chunk comes LAST. That makes the document a shared
# prompt prefix, so vLLM's automatic prefix caching computes its KV cache once per
# document and reuses it for every remaining chunk -- the prompt-caching optimisation
# the blog post relies on to make contextualisation cheap ($1.02 / million document
# tokens). Never move per-chunk text ahead of the document or the prefix stops matching.

CONTEXT_SYSTEM_TEMPLATE = "<document>\n{whole_document}\n</document>"

CONTEXT_HUMAN_TEMPLATE = (
    "Here is the chunk we want to situate within the whole document\n"
    "<chunk>\n{chunk_content}\n</chunk>\n"
    "Please give a short succinct context to situate this chunk within the overall "
    "document for the purposes of improving search retrieval of the chunk. "
    "Answer only with the succinct context and nothing else."
)
