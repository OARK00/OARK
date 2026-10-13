// Built once while the image is made, so the slow part of an ESP build (the
// board's own system code and these libraries) is already done when a
// person's first compile arrives. It includes what Oark's generated code
// includes; it is never run on a board.
#if defined(ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

WiFiClientSecure net;
PubSubClient mqtt(net);

void setup() {
  Serial.begin(115200);
  JsonDocument doc;
  doc["ready"] = true;
  net.setInsecure();
  mqtt.setServer("localhost", 8883);
}

void loop() {
  mqtt.loop();
}
