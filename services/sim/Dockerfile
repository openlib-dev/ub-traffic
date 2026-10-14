FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    SUMO_HOME=/usr/share/sumo \
    PYTHONPATH=/usr/share/sumo/tools \
    SIM_DATA=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        sumo \
        sumo-tools \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH=/opt/venv/bin:$PATH

COPY sumo_worker ./sumo_worker

EXPOSE 8081
CMD ["python3", "-m", "sumo_worker"]
