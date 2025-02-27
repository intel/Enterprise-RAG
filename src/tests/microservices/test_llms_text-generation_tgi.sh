#!/bin/bash
# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# This test checks llms microservice by sending request and verifying 200 response code.
# Model server: TGI
# Requires HF_TOKEN : Hugging Face auth token

set -xe

WORKPATH=$(dirname "$(dirname "$PWD")")
IP_ADDRESS=$(hostname -I | awk '{print $1}')

CONTAINER_NAME_BASE="test-comps-llms"

ENDPOINT_CONTAINER_NAME="${CONTAINER_NAME_BASE}-endpoint"
ENDPOINT_IMAGE_NAME="ghcr.io/huggingface/text-generation-inference:2.1.0"

MICROSERVICE_API_PORT=5005
MICROSERVICE_CONTAINER_NAME="${CONTAINER_NAME_BASE}-microservice"
MICROSERVICE_IMAGE_NAME="opea/${MICROSERVICE_CONTAINER_NAME}:comps"

function test_fail() {
    echo "FAIL: ${1}" 1>&2
    test_clean
    exit 1
}

function check_prerequisites() {
    if [ -z "${HF_TOKEN}" ]; then
        test_fail "HF_TOKEN environment variable is not set. Exiting."
    fi
}

function build_docker_images() {
    cd $WORKPATH
    echo $(pwd)

    docker build -t ${MICROSERVICE_IMAGE_NAME} -f comps/llms/impl/microservice/Dockerfile .
}

function start_service() {
    model=$1
    internal_communication_port=5004

    docker run -d --name="${ENDPOINT_CONTAINER_NAME}" \
        --runtime runc \
        -p $internal_communication_port:80 \
        -e HF_TOKEN=${HF_TOKEN} \
        -v ./data:/data \
        --shm-size 1g \
        ${ENDPOINT_IMAGE_NAME} \
        --model-id ${model} \

    docker run -d --name ${MICROSERVICE_CONTAINER_NAME} \
        --runtime runc \
        -p ${MICROSERVICE_API_PORT}:9000 \
        -e http_proxy=$http_proxy \
        -e https_proxy=$https_proxy \
        -e LLM_MODEL_SERVER_ENDPOINT="http://${IP_ADDRESS}:${internal_communication_port}" \
        -e HUGGINGFACEHUB_API_TOKEN=$HF_TOKEN \
        --ipc=host \
        ${MICROSERVICE_IMAGE_NAME}
}

function check_containers() {
    container_names=("${ENDPOINT_CONTAINER_NAME}" "${MICROSERVICE_CONTAINER_NAME}")
    failed_containers="false"

    for name in "${container_names[@]}"; do
        if [ "$( docker container inspect -f '{{.State.Status}}' "${name}" )" != "running" ]; then
            echo "Container '${name}' failed. Print logs:"
            docker logs "${name}"
            failed_containers="true"
        fi
    done

    if [[ "${failed_containers}" == "true" ]]; then
        test_fail "There are failed containers"
    fi
}

function check_readiness() {
    # Check whether TGI is fully ready. Delays are to be expected due to LLM download.
    log_dir=/tmp/test-logs
    log_src="${log_dir}/${ENDPOINT_CONTAINER_NAME}.log"

    # values unit is seconds
    wait_pause=5
    timeout=60
    total_wait=0

    tgi_ready="false"

    mkdir -p "${log_dir}"

    until [[ ${total_wait} -ge ${timeout} ]] || [[ "${tgi_ready}" == "true" ]]; do
        docker logs ${ENDPOINT_CONTAINER_NAME} > "${log_src}"
        if grep -q Connected "${log_src}"; then
            tgi_ready="true"
            break
        fi
        sleep "${wait_pause}s"
        (( total_wait += wait_pause ))
    done

    rm -rf "${log_dir}"

    if [[ "${tgi_ready}" != "true" ]]; then
        echo "Container '${ENDPOINT_CONTAINER_NAME}' exceeded timeout. Print logs:"
        docker logs ${ENDPOINT_CONTAINER_NAME}
        test_fail "Endpoint container TGI are not ready after timeout."
    fi
}

function validate_microservice() {
    # Command errors here are not exceptions, but handled as test fails.
    set +e

    http_response=$(curl \
        --write-out "HTTPSTATUS:%{http_code}" \
        http://${IP_ADDRESS}:${MICROSERVICE_API_PORT}/v1/chat/completions \
        -X POST \
        -d '{"query":"What is Deep Learning?", "max_new_tokens": 128}' \
        -H 'Content-Type: application/json' \
    )

    http_status=$(echo $http_response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    if [ "$http_status" -ne "200" ]; then
        test_fail "HTTP status is not 200. Received status was $http_status"
    fi

	set -e
}

function purge_containers() {
    cids=$(docker ps -aq --filter "name=${CONTAINER_NAME_BASE}-*")
    if [[ ! -z "$cids" ]]
    then
        docker stop $cids
        docker rm $cids
    fi
}

function remove_images() {
    # Remove images and the build cache
    iid=$(docker images \
        --filter=reference=${ENDPOINT_IMAGE_NAME} \
        --filter=reference=${MICROSERVICE_IMAGE_NAME} \
        --format "{{.ID}}" \
    )
    if [[ ! -z "$iid" ]]; then docker rmi $iid && sleep 1s; fi
}

function test_clean() {
    purge_containers
    remove_images
}

function main() {

    check_prerequisites
    test_clean

    build_docker_images

    llm_models=(
        BAAI/bge-large-en-v1.5
    )
    for model in "${llm_models[@]}"; do
        start_service "${model}"
        check_containers
        check_readiness
        validate_microservice
        purge_containers
    done

    test_clean

}

main
