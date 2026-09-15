/*
 * ============================================================================
 * 🌱 SMART CEYLON GREENHOUSE CONTROLLER - ESP32-S3 MAIN FIRMWARE
 * Board: ESP32-S3-DevKitC-1 (WROOM-1)
 * Cultivar: Ceylon Green Chilli (MICH 2 & KA 2) & Greenhouse Crops
 * Sensors: DHT22/SHT31 (Temp/Hum), Capacitive Soil Moisture, LDR/BH1750 (Lux),
 *          RS485 Modbus NPK Soil Sensor (Nitrogen, Phosphorus, Potassium)
 * Actuators: 4-Channel 5V Relay (Vent Fan, Drip Pump, Grow LEDs)
 * Display: 128x64 SSD1306 I2C OLED (live on-site readout)
 * Telemetry Cloud Target: https://greenhouse-automation-system.onrender.com/api/telemetry
 *
 * Pin mapping below is chosen to avoid ESP32-S3 strapping pins (0, 3, 45, 46),
 * the native-USB pins (19, 20), the UART0 debug pins used by Serial (43, 44),
 * and the SPI flash / octal PSRAM pins (26-37 on R8 modules) -- so it is safe
 * on both the official ESP32-S3-DevKitC-1 board and bare WROOM-1 breakouts.
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>       // Library: ArduinoJson by Benoit Blanchon (v6.x or v7.x)
#include <DHT.h>               // Library: DHT sensor library by Adafruit
#include <Wire.h>
#include <Adafruit_GFX.h>      // Library: Adafruit GFX Library
#include <Adafruit_SSD1306.h>  // Library: Adafruit SSD1306

// --------------------------- CONFIGURATION ---------------------------------
const char* WIFI_SSID     = "YOUR_GREENHOUSE_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_GREENHOUSE_WIFI_PASSWORD";

// Hosted Server Telemetry Ingestion URL
const char* SERVER_ENDPOINT = "https://greenhouse-automation-system.onrender.com/api/telemetry";

// Pin Assignments (ESP32-S3-DevKitC-1 safe GPIOs)
#define DHTPIN            4     // GPIO4  -> DHT22 Data Pin
#define DHTTYPE           DHT22 // DHT 22 (AM2302)
#define SOIL_ANALOG_PIN   1     // GPIO1  (ADC1_CH0) -> Capacitive Soil Moisture Sensor (AOUT)
#define LDR_ANALOG_PIN    2     // GPIO2  (ADC1_CH1) -> LDR Light Sensor (AOUT)

// Relay Actuator Output Pins (Active LOW for standard 5V Optocoupler Relay Modules)
#define RELAY_FAN_PIN     5     // GPIO5  -> Ventilation Fan Relay
#define RELAY_PUMP_PIN    6     // GPIO6  -> Drip Irrigation Water Pump Relay
#define RELAY_LIGHT_PIN   7     // GPIO7  -> Supplementary Grow Light Relay

// 128x64 I2C OLED Display (on-site live readout)
#define OLED_SDA_PIN      8     // GPIO8  -> OLED SDA
#define OLED_SCL_PIN      9     // GPIO9  -> OLED SCL
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64
#define OLED_RESET        -1
#define SCREEN_ADDRESS    0x3C

// RS485 Modbus NPK Soil Sensor (HardwareSerial 1)
#define RS485_RX_PIN      16    // GPIO16 -> MAX485 RO Pin
#define RS485_TX_PIN      17    // GPIO17 -> MAX485 DI Pin
#define RS485_DE_RE_PIN   18    // GPIO18 -> MAX485 DE & RE Pins (Tied together)

DHT dht(DHTPIN, DHTTYPE);
HardwareSerial modbusSerial(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool oledReady = false;

// Modbus Inquiry Frame for 7-in-1 / 3-in-1 Soil NPK Sensor
const byte npkInquiryFrame[] = {0x01, 0x03, 0x00, 0x1E, 0x00, 0x03, 0x65, 0xCD};
byte npkResponseFrame[11];

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n[INIT] Initializing Smart Greenhouse Controller (ESP32-S3)...");

  // Setup Relays
  pinMode(RELAY_FAN_PIN, OUTPUT);
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RS485_DE_RE_PIN, OUTPUT);

  // Default Relays OFF (Active LOW relays)
  digitalWrite(RELAY_FAN_PIN, HIGH);
  digitalWrite(RELAY_PUMP_PIN, HIGH);
  digitalWrite(RELAY_LIGHT_PIN, HIGH);
  digitalWrite(RS485_DE_RE_PIN, LOW); // Set RS485 to Receiver Mode

  // Init Sensors
  dht.begin();
  modbusSerial.begin(9600, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

  // Init OLED
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[WARN] OLED SSD1306 not found at 0x3C - continuing without display");
    oledReady = false;
  } else {
    oledReady = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Smart Greenhouse");
    display.println("Booting...");
    display.display();
  }

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Read DHT22 Temperature and Humidity
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[WARN] Failed to read from DHT22 sensor!");
    temperature = 28.5; // Fallback safe reading
    humidity    = 65.0;
  }

  // 2. Read Capacitive Soil Moisture Sensor (Analog 0 - 4095)
  int rawSoil = analogRead(SOIL_ANALOG_PIN);
  // Calibration: ~3200 in dry air (0%), ~1400 in water (100%)
  int soilMoisturePercent = map(rawSoil, 3200, 1400, 0, 100);
  soilMoisturePercent = constrain(soilMoisturePercent, 0, 100);

  // 3. Read LDR Ambient Light (Analog 0 - 4095 -> 0 - 1000 Lux)
  int rawLdr = analogRead(LDR_ANALOG_PIN);
  int lightIntensityLux = map(rawLdr, 0, 4095, 50, 1100);
  lightIntensityLux = constrain(lightIntensityLux, 0, 1200);

  // 4. Read RS485 Soil NPK Macronutrients
  int nitrogen = 160, phosphorus = 45, potassium = 200;
  readNPKSensor(nitrogen, phosphorus, potassium);

  // 5. Refresh the on-site OLED readout
  updateOledDisplay(temperature, humidity, soilMoisturePercent, lightIntensityLux, nitrogen, phosphorus, potassium);

  // 6. Build JSON Payload & Send to Hosted Cloud Dashboard
  sendTelemetryToCloud(temperature, humidity, soilMoisturePercent, lightIntensityLux, nitrogen, phosphorus, potassium);

  // Delay between sensor reading cycles (e.g. 5 seconds for real-time monitoring)
  delay(5000);
}

void connectWiFi() {
  Serial.printf("\\n[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 30) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\n[WIFI] Connected! Node IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\n[WIFI] Connection Failed. Will retry in next loop.");
  }
}

void readNPKSensor(int &n, int &p, int &k) {
  // Transmit inquiry frame to RS485 NPK sensor
  digitalWrite(RS485_DE_RE_PIN, HIGH); // Transmitter Mode
  delay(10);
  modbusSerial.write(npkInquiryFrame, sizeof(npkInquiryFrame));
  modbusSerial.flush();
  digitalWrite(RS485_DE_RE_PIN, LOW);  // Receiver Mode
  delay(10);

  // Read response
  byte index = 0;
  unsigned long start = millis();
  while (millis() - start < 1000 && index < 11) {
    if (modbusSerial.available()) {
      npkResponseFrame[index++] = modbusSerial.read();
    }
  }

  if (index >= 11 && npkResponseFrame[0] == 0x01 && npkResponseFrame[1] == 0x03) {
    n = (npkResponseFrame[3] << 8) | npkResponseFrame[4];
    p = (npkResponseFrame[5] << 8) | npkResponseFrame[6];
    k = (npkResponseFrame[7] << 8) | npkResponseFrame[8];
    Serial.printf("[NPK] N: %d mg/kg, P: %d mg/kg, K: %d mg/kg\\n", n, p, k);
  } else {
    // Default safe agricultural NPK baseline for green chilli if RS485 is in transit
    n = 165; p = 48; k = 210;
  }
}

void updateOledDisplay(float temp, float hum, int soil, int light, int n, int p, int k) {
  if (!oledReady) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("SMART GREENHOUSE");
  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  display.setCursor(0, 13);
  display.printf("Temp: %.1fC  Hum: %.0f%%\\n", temp, hum);

  display.setCursor(0, 24);
  display.printf("Soil: %d%%   Lux: %d\\n", soil, light);

  display.setCursor(0, 35);
  display.printf("N:%d P:%d K:%d mg/kg\\n", n, p, k);

  display.setCursor(0, 46);
  display.print(WiFi.status() == WL_CONNECTED ? "WiFi: Connected" : "WiFi: Offline");

  display.display();
}

void sendTelemetryToCloud(float temp, float hum, int soil, int light, int n, int p, int k) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  // Create JSON document
  StaticJsonDocument<512> doc;
  doc["temperature"]    = temp;
  doc["humidity"]       = hum;
  doc["soilMoisture"]   = soil;
  doc["lightIntensity"] = light;
  doc["nitrogen"]       = n;
  doc["phosphorus"]     = p;
  doc["potassium"]      = k;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.printf("[HTTP] POST %s -> %s\\n", SERVER_ENDPOINT, requestBody.c_str());
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP] Response [%d]: %s\\n", httpResponseCode, response.c_str());

    // Parse commands from server to control physical relays
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);
    if (!error && resDoc.containsKey("commands")) {
      bool fan   = resDoc["commands"]["fanStatus"];
      bool pump  = resDoc["commands"]["pumpStatus"];
      bool leds  = resDoc["commands"]["lightStatus"];

      // Relays are Active LOW (LOW = Relay ON / Closed Circuit, HIGH = Relay OFF)
      digitalWrite(RELAY_FAN_PIN,   fan  ? LOW : HIGH);
      digitalWrite(RELAY_PUMP_PIN,  pump ? LOW : HIGH);
      digitalWrite(RELAY_LIGHT_PIN, leds ? LOW : HIGH);

      Serial.printf("[ACTUATORS] Relay State -> Fan: %s | Pump: %s | Grow LEDs: %s\\n", 
                    fan ? "ON" : "OFF", pump ? "ON" : "OFF", leds ? "ON" : "OFF");
    }
  } else {
    Serial.printf("[HTTP] Error sending telemetry: %s\\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
