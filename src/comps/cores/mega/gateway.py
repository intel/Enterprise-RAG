# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from fastapi import Request
from fastapi.responses import StreamingResponse

from ..proto.api_protocol import (
    AudioChatCompletionRequest,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatMessage,
    UsageInfo,
)
from ..proto.docarray import LLMParams
from .constants import MegaServiceEndpoint, ServiceRoleType, ServiceType
from .micro_service import MicroService


class Gateway:
    def __init__(
        self,
        megaservice,
        host="0.0.0.0",
        port=8888,
        endpoint=str(MegaServiceEndpoint.CHAT_QNA),
        input_datatype=ChatCompletionRequest,
        output_datatype=ChatCompletionResponse,
    ):
        self.megaservice = megaservice
        self.host = host
        self.port = port
        self.endpoint = endpoint
        self.input_datatype = input_datatype
        self.output_datatype = output_datatype
        self.service = MicroService(
            service_role=ServiceRoleType.MEGASERVICE,
            service_type=ServiceType.GATEWAY,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
            input_datatype=self.input_datatype,
            output_datatype=self.output_datatype,
        )
        self.define_routes()
        self.service.start()

    def define_routes(self):
        self.service.app.router.add_api_route(self.endpoint, self.handle_request, methods=["POST"])
        self.service.app.router.add_api_route(str(MegaServiceEndpoint.LIST_SERVICE), self.list_service, methods=["GET"])
        self.service.app.router.add_api_route(
            str(MegaServiceEndpoint.LIST_PARAMETERS), self.list_parameter, methods=["GET"]
        )

    def add_route(self, endpoint, handler, methods=["POST"]):
        self.service.app.router.add_api_route(endpoint, handler, methods=methods)

    def stop(self):
        self.service.stop()

    async def handle_request(self, request: Request):
        raise NotImplementedError("Subclasses must implement this method")

    def list_service(self):
        response = {}
        for node in self.all_leaves():
            response = {self.services[node].description: self.services[node].endpoint_path}
        return response

    def list_parameter(self):
        pass

    def _handle_message(self, messages):
        if isinstance(messages, str):
            prompt = messages
        else:
            messages_dict = {}
            system_prompt = ""
            for message in messages:
                msg_role = message["role"]
                if msg_role == "system":
                    system_prompt = message["content"]
                elif msg_role == "user":
                    if type(message["content"]) is list:
                        text = ""
                        text_list = [item["text"] for item in message["content"] if item["type"] == "text"]
                        text += "\n".join(text_list)
                        messages_dict[msg_role] = text
                    else:
                        messages_dict[msg_role] = message["content"]
                elif msg_role == "assistant":
                    messages_dict[msg_role] = message["content"]
                else:
                    raise ValueError(f"Unknown role: {msg_role}")
            prompt = system_prompt + "\n"
            for role, message in messages_dict.items():
                if message:
                    prompt += role + ": " + message + "\n"
                else:
                    prompt += role + ":"
        return prompt


class ChatQnAGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.CHAT_QNA), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        stream_opt = data.get("stream", True)
        chat_request = ChatCompletionRequest.parse_obj(data)
        prompt = self._handle_message(chat_request.messages)
        parameters = LLMParams(
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=stream_opt,
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"text": prompt}, llm_parameters=parameters
        )
        for node, response in result_dict.items():
            if isinstance(response, StreamingResponse):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="chatqna", choices=choices, usage=usage)


class CodeGenGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.CODE_GEN), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        stream_opt = data.get("stream", True)
        chat_request = ChatCompletionRequest.parse_obj(data)
        prompt = self._handle_message(chat_request.messages)
        parameters = LLMParams(
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=stream_opt,
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"query": prompt}, llm_parameters=parameters
        )
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="codegen", choices=choices, usage=usage)


class CodeTransGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.CODE_TRANS), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        language_from = data["language_from"]
        language_to = data["language_to"]
        source_code = data["source_code"]
        prompt_template = """
            ### System: Please translate the following {language_from} codes into {language_to} codes.

            ### Original codes:
            '''{language_from}

            {source_code}

            '''

            ### Translated codes:
        """
        prompt = prompt_template.format(language_from=language_from, language_to=language_to, source_code=source_code)
        result_dict, runtime_graph = await self.megaservice.schedule(initial_inputs={"query": prompt})
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="codetrans", choices=choices, usage=usage)


class TranslationGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.TRANSLATION), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        language_from = data["language_from"]
        language_to = data["language_to"]
        source_language = data["source_language"]
        prompt_template = """
            Translate this from {language_from} to {language_to}:

            {language_from}:
            {source_language}

            {language_to}:
        """
        prompt = prompt_template.format(
            language_from=language_from, language_to=language_to, source_language=source_language
        )
        result_dict, runtime_graph = await self.megaservice.schedule(initial_inputs={"query": prompt})
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="translation", choices=choices, usage=usage)


class DocSumGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.DOC_SUMMARY), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        stream_opt = data.get("stream", True)
        chat_request = ChatCompletionRequest.parse_obj(data)
        prompt = self._handle_message(chat_request.messages)
        parameters = LLMParams(
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=stream_opt,
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"query": prompt}, llm_parameters=parameters
        )
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="docsum", choices=choices, usage=usage)


class AudioQnAGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice,
            host,
            port,
            str(MegaServiceEndpoint.AUDIO_QNA),
            AudioChatCompletionRequest,
            ChatCompletionResponse,
        )

    async def handle_request(self, request: Request):
        data = await request.json()

        chat_request = AudioChatCompletionRequest.parse_obj(data)
        parameters = LLMParams(
            # relatively lower max_tokens for audio conversation
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 128,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=False,  # TODO add streaming LLM output as input to TTS
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"byte_str": chat_request.audio}, llm_parameters=parameters
        )

        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["byte_str"]

        return response


class SearchQnAGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.SEARCH_QNA), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        stream_opt = data.get("stream", True)
        chat_request = ChatCompletionRequest.parse_obj(data)
        prompt = self._handle_message(chat_request.messages)
        parameters = LLMParams(
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=stream_opt,
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"text": prompt}, llm_parameters=parameters
        )
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="searchqna", choices=choices, usage=usage)


class FaqGenGateway(Gateway):
    def __init__(self, megaservice, host="0.0.0.0", port=8888):
        super().__init__(
            megaservice, host, port, str(MegaServiceEndpoint.FAQ_GEN), ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        stream_opt = data.get("stream", True)
        chat_request = ChatCompletionRequest.parse_obj(data)
        prompt = self._handle_message(chat_request.messages)
        parameters = LLMParams(
            max_new_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            repetition_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 1.03,
            streaming=stream_opt,
        )
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"query": prompt}, llm_parameters=parameters
        )
        for node, response in result_dict.items():
            # Here it suppose the last microservice in the megaservice is LLM.
            if (
                isinstance(response, StreamingResponse)
                and node == list(self.megaservice.services.keys())[-1]
                and self.megaservice.services[node].service_type == ServiceType.LLM
            ):
                return response
        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="faqgen", choices=choices, usage=usage)
