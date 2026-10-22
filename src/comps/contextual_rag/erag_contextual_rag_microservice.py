# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import time

from dotenv import load_dotenv
from fastapi import HTTPException

from comps.contextual_rag.utils.erag_contextual_rag import EragContextualRag
from comps.cores.mega.base_statistics import register_statistics, statistics_dict
from comps.cores.mega.constants import MegaServiceEndpoint, ServiceType
from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger
from comps.cores.mega.micro_service import erag_microservices, register_microservice
from comps.cores.proto.docarray import ContextualRagInput, TextDocList
from comps.cores.utils.utils import sanitize_env


# Define the unique service name for the microservice
USVC_NAME='erag_service@contextual_rag'

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "impl/microservice/.env"))

# Initialize the logger for the microservice
logger = get_erag_logger(f"{__file__.split('comps/')[1].split('/', 1)[0]}_microservice")
change_erag_logger_level(logger, log_level=os.getenv("ERAG_LOGGER_LEVEL", "INFO"))

# Initialize the contextual RAG service. The per-chunk context blurb is written by the
# LLM at CONTEXT_MODEL_NAME / VLLM_SERVER_ENDPOINT -- in a deployment, the dedicated blurb
# model (qwen3-4b-w8a8-blurb, role: contextual_rag). Both are mandatory and have no
# default: the model is deployed separately (see deployment/models.yaml), so an unset
# endpoint fails the container at start-up instead of silently doing nothing.
erag_contextual_rag = EragContextualRag(
    vllm_endpoint=sanitize_env(os.getenv("VLLM_SERVER_ENDPOINT", "")),
    context_model_name=sanitize_env(os.getenv("CONTEXT_MODEL_NAME", "")),
    max_new_tokens=int(os.getenv("MAX_NEW_TOKENS", "100")),
    max_concurrency=int(os.getenv("CONTEXT_MAX_CONCURRENCY", "32")),
    # Token budget for one blurb request (whole document + whole chunk + template +
    # MAX_NEW_TOKENS). A document is contextualised only if every chunk's request fits
    # it, and skipped otherwise -- never truncated. Capped at the served window; "0"
    # means the whole served window.
    max_prompt_tokens=int(os.getenv("CONTEXT_MAX_PROMPT_TOKENS", "16384")),
    chars_per_token=float(os.getenv("CONTEXT_CHARS_PER_TOKEN", "3.5")),
    request_timeout=int(os.getenv("CONTEXT_REQUEST_TIMEOUT", "300")),
    max_retries=int(os.getenv("CONTEXT_MAX_RETRIES", "2")),
    sticky_routing=os.getenv("CONTEXT_STICKY_ROUTING", "true").lower() == "true",
    replica_host=sanitize_env(os.getenv("CONTEXT_VLLM_REPLICA_HOST", "")),
    replica_ttl=int(os.getenv("CONTEXT_VLLM_REPLICA_TTL", "60")),
    trust_env_proxy=os.getenv("CONTEXT_TRUST_ENV_PROXY", "false").lower() == "true",
)

# Register the microservice with the specified configuration.
@register_microservice(
    name=USVC_NAME,
    service_type=ServiceType.CONTEXTUAL_RAG,
    endpoint=str(MegaServiceEndpoint.CONTEXTUAL_RAG),
    host='0.0.0.0',
    port=int(os.getenv('CONTEXTUAL_RAG_USVC_PORT', default=8004)),
    input_datatype=ContextualRagInput,
    output_datatype=TextDocList
)

@register_statistics(names=[USVC_NAME])
# Define a function to handle processing of input for the microservice.
# Its input and output data types must comply with the registered ones above.
def process(input: ContextualRagInput) -> TextDocList:
    start = time.time()
    try:
        # Pass the input to the 'run' method of the microservice instance
        res = erag_contextual_rag.run(input)
    except ValueError as e:
        logger.exception(f"An internal error occurred while processing: {str(e)}")
        raise HTTPException(status_code=400,
                            detail=f"An internal error occurred while processing: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"An error occurred while processing: {str(e)}")
        raise HTTPException(status_code=500,
                            detail=f"An error occurred while processing: {str(e)}"
        )
    statistics_dict[USVC_NAME].append_latency(time.time() - start, None)

    return res


if __name__ == "__main__":
    # Start the microservice
    erag_microservices[USVC_NAME].start()
    logger.info(f"Started ERAG Microservice: {USVC_NAME}")
