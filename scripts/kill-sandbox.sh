#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Stop the sandbox
${SCRIPT_DIR}/../sandbox down

# Kill the algod
ALGOD_PROC_ID=$(docker container ls -a | grep algorand-sandbox-algod | cut -d ' ' -f 1)
if [ "${ALGOD_PROC_ID}" != "" ]; then
    echo "Killing algod"
    docker container rm ${ALGOD_PROC_ID}
fi

# Kill the indexer
INDEXER_PROC_ID=$(docker container ls -a | grep algorand-sandbox-indexer | cut -d ' ' -f 1)
if [ "${INDEXER_PROC_ID}" != "" ]; then
    echo "Killing indexer"
    docker container rm ${INDEXER_PROC_ID}
fi

# Kill postgres
POSTGRES_PROC_ID=$(docker container ls -a | grep algorand-sandbox-postgres | cut -d ' ' -f 1)
if [ "${POSTGRES_PROC_ID}" != "" ]; then
    echo "Killing postgres"
    docker container rm ${POSTGRES_PROC_ID}
fi
