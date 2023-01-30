#
# container for aws/sam tools and optionally nodejs/python runtimes
#

FROM alpine:3.11

# nodejs and python
# alpine:3.10: nodejs:10.24 python3:3.7
# alpine:3.11: nodejs:12.22 python3:3.8
# FYI: in fact no runtime deps listed here are needed:
# FYI: sam build should be containerized (--use-container)
# FYI: sam local start-api is containerized by design
# RUN set -ex; \
#     apk add --no-cache \
#         nodejs npm python3 py3-pip;

# aws SAM cli
RUN set -ex; \
    apk add --no-cache \
        python3 py3-pip; \
    apk add --no-cache -t .sam-install-deps \
        build-base python3-dev; \
    pip3 install aws-sam-cli; \
    apk del --no-cache --purge .sam-install-deps;

# developer convenience only
RUN set -ex; \
    apk add --no-cache \
        docker-cli bash curl;

# FYI: https://github.com/aws/aws-sam-build-images/blob/develop/build-image-src/Dockerfile-nodejs12x
# FYI: there's an "official" way to install `aws` and `sam` in containers

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
