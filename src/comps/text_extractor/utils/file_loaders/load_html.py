# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from langchain_community.document_loaders import UnstructuredHTMLLoader

from comps.text_extractor.utils.file_loaders.abstract_loader import AbstractLoader
from comps.text_extractor.utils.nltk_data import ensure_nltk_data


class LoadHtml(AbstractLoader):
    def __init__(self, file_path):
        super().__init__(file_path)
        ensure_nltk_data()

    def extract_text(self):
        """Load the html file."""
        data_html = UnstructuredHTMLLoader(self.file_path, mode="elements").load()
        content = []
        for ins in data_html:
            content.append(ins.page_content)
        return '\n'.join(content)
