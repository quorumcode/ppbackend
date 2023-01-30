#!/bin/bash

if [[ -v USER_NAME ]]
then exec su ${USER_NAME} -c "$(printf "%q " "$@")"
else exec "$@"
fi
