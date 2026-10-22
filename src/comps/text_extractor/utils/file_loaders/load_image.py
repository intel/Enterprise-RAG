# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os

import cairosvg
import pytesseract
import regex
from langchain_community.document_loaders import UnstructuredImageLoader
from PIL import Image, ImageOps

from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger
from comps.text_extractor.utils.file_loaders.abstract_loader import AbstractLoader
from comps.text_extractor.utils.nltk_data import ensure_nltk_data


logger = get_erag_logger(f"{__file__.split('comps/')[1].split('/', 1)[0]}_microservice")
change_erag_logger_level(logger, log_level=os.getenv("ERAG_LOGGER_LEVEL", "INFO"))


class LoadImage(AbstractLoader):
    def __init__(self, file_path):
        super().__init__(file_path)
        ensure_nltk_data()

    def extract_text(self):
        """Run OCR on the image. Try Unstructured first, fall back to pytesseract."""
        if self.file_type == "svg":
            self.convert_to_png(self.file_path)

        # Try Unstructured OCR
        try:
            docs = UnstructuredImageLoader(self.file_path, strategy="ocr_only", language=["eng", "pol"]).load()
            if docs and (text := docs[0].page_content.strip()):
                return self._clean_ocr_text(text)
        except Exception as e:
            logger.debug(f"OCR (unstructured) failed, falling back to pytesseract: {e}")

        # Fallback to pytesseract
        try:
            with Image.open(self.file_path) as img:
                text = pytesseract.image_to_string(ImageOps.autocontrast(img.convert("RGB")), 
                                                    lang="eng+pol", config="--psm 6")
                return self._clean_ocr_text(text)
        except Exception as e:
            logger.error(f"OCR failed for {self.file_path}: {e}")
            return ""

    def convert_to_png(self, image_path):
        """Convert image file to png file."""
        png_path = image_path.split(".")[0] + ".png"
        cairosvg.svg2png(url=image_path, write_to=png_path)
        self.file_path = png_path
        self.file_type = "png"

    def _clean_ocr_text(self, text: str) -> str:
        """Normalize OCR noise: whitespace, punctuation, leading/trailing junk."""
        if not text:
            return ""
        text = text.strip().replace("—", "-").replace("_", " ")
        text = regex.sub(r"\s+", " ", text)
        return text.strip()

