# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import nltk

# NLTK package -> path nltk.data.find() looks up. The image ships all of them
# (Dockerfile), so nothing is fetched at runtime: nltk.download() always checks
# the online index first, which nltk refuses behind a proxy and which stalls
# without network access.
_NLTK_PACKAGES = {
    'punkt_tab': 'tokenizers/punkt_tab',
    'averaged_perceptron_tagger': 'taggers/averaged_perceptron_tagger',
    'averaged_perceptron_tagger_eng': 'taggers/averaged_perceptron_tagger_eng',
}


def ensure_nltk_data():
    """Download only the NLTK packages that are not available locally."""
    for package, path in _NLTK_PACKAGES.items():
        try:
            nltk.data.find(path)
        except LookupError:
            nltk.download(package, quiet=True)
