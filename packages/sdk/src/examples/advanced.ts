import type { XIAOExample } from '../types.js';

export const advancedExamples: XIAOExample[] = [
  {
    id: 'deepsleep-esp32-arduino',
    title: 'Deep Sleep (ESP32)',
    description: 'Use deep sleep mode to save power on XIAO ESP32 series',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'power',
    code: `// Deep Sleep - XIAO ESP32 Series
// Wake up after 10 seconds via timer

#define uS_TO_S_FACTOR 1000000ULL
#define TIME_TO_SLEEP  10  // Sleep time in seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("XIAO ESP32 Deep Sleep Example");
  Serial.printf("Going to sleep for %d seconds...\\n", TIME_TO_SLEEP);
  
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void loop() {
  // Never reached - deep sleep resets the board on wake
}`,
    requirements: [],
  },
  {
    id: 'spi-display-arduino',
    title: 'SPI Display (SSD1306 OLED)',
    description: 'Drive an SSD1306 OLED display via SPI on XIAO',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21'],
    category: 'display',
    code: `// SSD1306 OLED via I2C - XIAO
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// Using I2C (more common for SSD1306)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    while (1);
  }
  
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 10);
  display.println("XIAO");
  display.setTextSize(1);
  display.setCursor(10, 40);
  display.println("Hello World!");
  display.display();
}

void loop() {
  // Nothing here
}`,
    requirements: ['Adafruit GFX Library', 'Adafruit SSD1306'],
  },
  {
    id: 'mqtt-esp32-arduino',
    title: 'MQTT Client (ESP32)',
    description: 'Connect to an MQTT broker for IoT communication',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'iot',
    code: `// MQTT Client - XIAO ESP32 Series
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* mqttServer = "broker.emqx.io";
const int mqttPort = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("Message arrived [%s]: %s\\n", topic, message.c_str());
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "XIAO-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT connected");
      client.subscribe("xiao/command");
    } else {
      Serial.printf("Failed, rc=%d. Retrying in 5s...\\n", client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi connected. IP: " + WiFi.localIP().toString());
  
  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) { reconnect(); }
  client.loop();
  
  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 5000) {
    lastMsg = millis();
    float temp = random(200, 350) / 10.0;
    client.publish("xiao/temperature", String(temp).c_str());
    Serial.printf("Published temperature: %.1f\\n", temp);
  }
}`,
    requirements: ['PubSubClient library'],
  },
  {
    id: 'camera-esp32s3sense-arduino',
    title: 'Camera Capture (ESP32S3 Sense)',
    description: 'Capture an image with the onboard OV2640 camera on XIAO ESP32S3 Sense',
    language: 'arduino',
    boards: ['esp32s3-sense'],
    category: 'camera',
    code: `// Camera Capture - XIAO ESP32S3 Sense
#include <camera_pins.h>
#include "esp_camera.h"

#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39
#define Y9_GPIO_NUM       15
#define Y8_GPIO_NUM       16
#define Y7_GPIO_NUM       18
#define Y6_GPIO_NUM       12
#define Y5_GPIO_NUM       17
#define Y4_GPIO_NUM       23
#define Y3_GPIO_NUM       4
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM    6
#define HREF_GPIO_NUM     7
#define PCLK_GPIO_NUM     13

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
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_UXGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  Serial.println("Camera initialized successfully!");
}

void loop() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }
  Serial.printf("Image captured! Size: %u bytes\\n", fb->len);
  esp_camera_fb_return(fb);
  delay(5000);
}`,
    requirements: ['ESP32 Camera driver (built-in for ESP32S3)'],
    wikiUrl: 'https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/',
  },
  {
    id: 'pwm-led-arduino',
    title: 'PWM LED Control',
    description: 'Control LED brightness using PWM on XIAO',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21', 'ra4m1'],
    category: 'basics',
    code: `// PWM LED Control - XIAO
// Fade an LED in and out using analogWrite (PWM)

#define LED_PIN LED_BUILTIN

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  // Fade in
  for (int brightness = 0; brightness <= 255; brightness++) {
    analogWrite(LED_PIN, brightness);
    delay(5);
  }
  
  // Fade out
  for (int brightness = 255; brightness >= 0; brightness--) {
    analogWrite(LED_PIN, brightness);
    delay(5);
  }
}`,
    requirements: [],
  },
];
