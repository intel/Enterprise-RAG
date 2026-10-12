#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
import json
import logging
import socket
import time
from urllib.parse import urljoin

import kr8s
import requests

logger = logging.getLogger(__name__)


class InvalidChatqnaResponseBody(Exception):
    """
    Raised when the call to /v1/chatqna returns a body does not follow
    'Server-Sent Events' structure
    """
    pass


class CustomPortForward(object):

    BIND_ATTEMPTS = 3
    BIND_TIMEOUT = 5

    def __init__(self, remote_port, namespace, label_selector, local_port=None):
        self.remote_port = remote_port
        self.local_port = local_port
        self.pod = self._get_pod(namespace, label_selector)
        self.pf = None

    def __enter__(self):
        # Retry with a new port if the port forward fails to bind, e.g. when another
        # socket takes the port between _find_unused_port() and the bind.
        attempts = 1 if self.local_port is not None else self.BIND_ATTEMPTS
        for attempt in range(1, attempts + 1):
            local_port = self.local_port or self._find_unused_port()
            self.pf = kr8s.portforward.PortForward(self.pod, remote_port=self.remote_port, local_port=local_port)
            self.pf.start()
            if self._wait_for_bind():
                return self.pf
            self.pf.stop()
            logger.warning(f"Port forward failed to bind on 127.0.0.1:{local_port} (attempt {attempt}/{attempts})")
        raise RuntimeError(f"Could not start port forward to {self.pod.name}:{self.remote_port}")

    def __exit__(self, type, value, traceback):
        self.pf.stop()
        time.sleep(1)

    def _wait_for_bind(self):
        """
        Wait until the port forward listens on its local port.
        Return False if its background thread exited, e.g. because the bind failed.
        """
        deadline = time.monotonic() + self.BIND_TIMEOUT
        while time.monotonic() < deadline:
            if self.pf.servers:
                return True
            if not self.pf._bg_thread.is_alive():
                return False
            time.sleep(0.1)
        return False

    def _find_unused_port(self):
        """
        Return a free local port chosen by the OS.
        Probing random ports with connect() misses ports that are bound but not
        listening, e.g. local ends of outgoing connections in the ephemeral range.
        """
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]

    def _get_pod(self, namespace, label_selector):
        pods = list(kr8s.get("pods",
                             namespace=namespace,
                             label_selector=label_selector))
        return pods[0]


class ApiResponse:
    """
    Wrapper class for the response from 'requests' library
    """

    def __init__(self, response, response_time, exception=None):
        self._response = response
        self._response_time = response_time
        self._exception = exception

    def __getattr__(self, name):
        return getattr(self._response, name)

    @property
    def response_time(self):
        return self._response_time

    @property
    def exception(self):
        return self._exception


class ApiRequestHelper:

    def __init__(self, keycloak_helper=None):
        self.default_headers = {"Content-Type": "application/json"}
        self.keycloak_helper = keycloak_helper

    def call_health_check_api(self, namespace, selector, port, health_path="v1/health_check"):
        """
        API call to microservice health_check API.
        Microservices are not exposed so we need to forward their ports first.
        namespace and selector are used in order to find the specified pod
        which handles health_check call.
        """
        with CustomPortForward(port, namespace, selector) as pf:
            logger.info(f"Attempting to make a request to {namespace}/{selector}...")
            base_url = f"http://127.0.0.1:{pf.local_port}/"
            full_url = urljoin(base_url, health_path)
            response = requests.get(
                full_url,
                headers=self.default_headers,
                timeout=10
            )
            return response

    def get_headers(self, as_user=None):
        """ Get headers with the access token for authenticated requests. """
        if as_user:
            self.default_headers["authorization"] = f"Bearer {self.keycloak_helper.get_access_token(as_user=as_user)}" if self.keycloak_helper else ""
        else:
            self.default_headers["authorization"] = f"Bearer {self.keycloak_helper.access_token}" if self.keycloak_helper else ""
        return self.default_headers

    def format_response(self, response):
        """
        Parse raw response_body from the chatqna response and return a human-readable text
        """
        response_text = ""
        reranked_docs = []
        if response.headers.get("Content-Type") == "application/json":
            response = response.json()
            response_text = response.get("text")
            if response_text is None:
                response_text = response.get("error")
            resonse_json_key = response.get("json")
            if resonse_json_key:
                reranked_docs = resonse_json_key.get("reranked_docs", [])
        elif response.headers.get("Content-Type") == "text/event-stream":
            text = self.fix_encoding(response.text)
            response_lines = text.splitlines()
            response_text = ""
            for line in response_lines:
                if isinstance(line, bytes):
                    line = line.decode('utf-8')
                if line == "":
                    continue
                if line.startswith("json:"):
                    # Remove 'json: ' prefix and parse the JSON content
                    reranked_docs = line[5:]
                    reranked_docs = json.loads(reranked_docs)
                    reranked_docs = reranked_docs.get("reranked_docs", [])
                elif line.startswith("data: "):
                    data_content = line.removeprefix("data: ")

                    if data_content.strip() in ["[DONE]"]:
                        continue

                    try:
                        chunk_data = json.loads(data_content)
                        # Extract content from OpenAI format: choices[0].delta.content
                        if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                            delta = chunk_data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                response_text += content
                            # Skip if it's just a finish_reason marker
                            elif chunk_data["choices"][0].get("finish_reason"):
                                continue
                        else:
                            logger.warning(f"OpenAI format chunk missing choices: {chunk_data}")
                    except json.JSONDecodeError:
                        # Fallback: treat as plain text (old format)
                        # Sometimes (depending on the pipeline) the response is wrapped in single quotes
                        if data_content.startswith("'"):
                            data_content = data_content.removeprefix("'").removesuffix("'")
                        response_text += data_content
                else:
                    logger.warning(f"Unexpected line in the response: {line}")
                    raise InvalidChatqnaResponseBody(
                        "Chatqa API response body does not follow 'Server-Sent Events' structure. "
                        f"Response: {response.text}.\n\nHeaders: {response.headers}"
                    )
            # Replace new line characters for better output
            response_text = response_text.replace('\\n', '\n')
        else:
            raise InvalidChatqnaResponseBody(
                f"Unexpected Content-Type in the response: {response.headers.get('Content-Type')}")
        return response_text, reranked_docs

    def fix_encoding(self, string):
        try:
            # Encode as bytes, then decode with UTF-8
            return string.encode('latin1').decode('utf-8')
        except Exception:
            return string  # Append original if there's an error

    def get_text(self, response):
        """Extract the text from the response"""
        response_text, _ = self.format_response(response)
        return response_text
