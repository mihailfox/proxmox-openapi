ARG BASE_IMAGE=node:24-bookworm-slim
FROM ${BASE_IMAGE}

ARG DEVCONTAINER_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive \
    NPM_CONFIG_PREFIX=/usr/local \
    PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /workspaces

RUN set -euxo pipefail \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        python3 \
        python3-venv \
        python3-pip \
    && install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && npm install --location=global "@devcontainers/cli@${DEVCONTAINER_VERSION:-latest}" \
    && npm cache clean --force \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY scripts/devcontainer/helper-entrypoint.sh /usr/local/bin/devcontainer-launcher

RUN chmod +x /usr/local/bin/devcontainer-launcher

ENV WORKSPACE_FOLDER=/workspaces/workspace

ENTRYPOINT ["devcontainer-launcher"]
