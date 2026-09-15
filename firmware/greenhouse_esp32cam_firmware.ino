#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Smart Greenhouse Server Dual-CAM Intake Endpoint URL
const char* serverUrl = "https://greenhouse-automation-system.onrender.com/api/esp32cam/upload";

// AI Thinker ESP32-CAM Pin Mapping
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_siod = SIOD_GPIO_NUM;
  config.pin_sioc = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // SVGA (800x600) is plenty of detail for AI disease/growth analysis while
  // keeping each base64-encoded upload small and fast over WiFi every 60s.
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count = psramFound() ? 2 : 1;

  // Camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // WiFi init
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  captureAndSendFrame();
  delay(60000); // Capture + upload a frame every 60 seconds for disease/growth analysis
}

// Minimal base64 encoder (no external library needed) -- the server's
// /api/esp32cam/upload endpoint expects a JSON body with a base64-encoded
// image, not raw JPEG bytes.
String base64Encode(const uint8_t* data, size_t len) {
  static const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out;
  out.reserve(((len + 2) / 3) * 4);
  size_t i = 0;
  while (i + 3 <= len) {
    uint32_t n = ((uint32_t)data[i] << 16) | ((uint32_t)data[i + 1] << 8) | data[i + 2];
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += chars[(n >> 6) & 0x3F];
    out += chars[n & 0x3F];
    i += 3;
  }
  size_t remaining = len - i;
  if (remaining == 1) {
    uint32_t n = (uint32_t)data[i] << 16;
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += "==";
  } else if (remaining == 2) {
    uint32_t n = ((uint32_t)data[i] << 16) | ((uint32_t)data[i + 1] << 8);
    out += chars[(n >> 18) & 0x3F];
    out += chars[(n >> 12) & 0x3F];
    out += chars[(n >> 6) & 0x3F];
    out += "=";
  }
  return out;
}

void captureAndSendFrame() {
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  if(WiFi.status() == WL_CONNECTED) {
    String base64Image = base64Encode(fb->buf, fb->len);

    DynamicJsonDocument doc(base64Image.length() + 1024);
    doc["image"] = "data:image/jpeg;base64," + base64Image;
    doc["mimeType"] = "image/jpeg";
    doc["source"] = "esp32_cam";
    doc["ipAddress"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(payload);
    if(httpResponseCode > 0) {
      Serial.printf("Frame sent successfully! Server HTTP Response: %d\n", httpResponseCode);
    } else {
      Serial.printf("Error sending frame: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
  esp_camera_fb_return(fb);
}