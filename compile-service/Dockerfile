# Oark's compile service: the Arduino CLI with the ESP32 and ESP8266 compilers,
# behind a small web service.
#
# Every version here is pinned. A compiler that changes by itself would make
# yesterday's working sketch fail today with nobody having touched it.
FROM python:3.12-slim

ARG ARDUINO_CLI_VERSION=1.5.1
ARG ESP32_CORE_VERSION=3.3.5
ARG ESP8266_CORE_VERSION=3.1.2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz" \
       | tar -xz -C /usr/local/bin arduino-cli \
    && ln -s /usr/local/bin/python3 /usr/bin/python

# Not root: the compiler runs code-shaped input from strangers.
RUN useradd --create-home builder
USER builder
WORKDIR /home/builder/app

ENV OARK_WORK_DIR=/home/builder/work \
    OARK_WARM_DIR=/home/builder/warm

# The two board packages and the two libraries Oark's generated code uses.
RUN arduino-cli config init \
    && arduino-cli config add board_manager.additional_urls \
       https://espressif.github.io/arduino-esp32/package_esp32_index.json \
       https://arduino.esp8266.com/stable/package_esp8266com_index.json \
    && arduino-cli core update-index \
    && arduino-cli core install "esp32:esp32@${ESP32_CORE_VERSION}" "esp8266:esp8266@${ESP8266_CORE_VERSION}" \
    && arduino-cli lib install "PubSubClient@2.8" "ArduinoJson@7.4.2" \
    && rm -rf /home/builder/.arduino15/staging

# The slow part of a build, done once here instead of on every person's first
# compile (minutes -> seconds). Same sketch path and build folders that
# compiler.py uses, or the Arduino CLI would throw this work away.
# (Kept as .txt in the repository: a .ino file makes GitHub's code scanner
# try, and fail, to build the repository as a C++ project.)
COPY --chown=builder:builder prewarm/sketch.ino.txt /home/builder/work/sketch/sketch.ino
RUN arduino-cli compile --fqbn esp32:esp32:esp32 --build-path "$OARK_WARM_DIR/esp32" /home/builder/work/sketch \
    && arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 --build-path "$OARK_WARM_DIR/esp8266" /home/builder/work/sketch \
    && rm -rf /home/builder/work "$OARK_WARM_DIR/esp32/sketch" "$OARK_WARM_DIR/esp8266/sketch"

COPY --chown=builder:builder requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=builder:builder app.py compiler.py ./

ENV PATH="/home/builder/.local/bin:${PATH}"
# Cloud Run tells the service which port to listen on.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
