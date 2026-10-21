# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from langchain_community.document_loaders import UnstructuredXMLLoader

from comps.text_extractor.utils.file_loaders.abstract_loader import AbstractLoader
from comps.text_extractor.utils.nltk_data import ensure_nltk_data


class LoadXml(AbstractLoader):
    def __init__(self, file_path):
        super().__init__(file_path)
        ensure_nltk_data()

    def extract_text(self):
        """Load xml file."""
        loader = UnstructuredXMLLoader(self.file_path)
        text = loader.load()[0].page_content
        return text
