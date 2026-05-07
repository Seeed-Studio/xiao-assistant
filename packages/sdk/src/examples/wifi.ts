import type { XIAOExample } from '../types.js';

export const wifiExamples: XIAOExample[] = [
  {
    id: 'wifi-scan-arduino',
    title: 'WiFi Scan',
    description: 'Scan and list available WiFi networks using XIAO ESP32 series',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'wifi',
    code: `// WiFi Scan - XIAO ESP32 Series
#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  
  // Set WiFi to station mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  Serial.println("WiFi Scan started");
}

void loop() {
  Serial.println("Scanning...");
  
  int networkCount = WiFi.scanNetworks();
  
  if (networkCount == 0) {
    Serial.println("No networks found");
  } else {
    Serial.printf("%d networks found:\\n", networkCount);
    for (int i = 0; i < networkCount; i++) {
      Serial.printf("%d: %s (RSSI: %d) %s\\n",
        i + 1,
        WiFi.SSID(i).c_str(),
        WiFi.RSSI(i),
        WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "(Open)" : "(Encrypted)"
      );
    }
  }
  Serial.println("");
  delay(5000);
}`,
    requirements: ['WiFi library (built-in for ESP32)'],
  },
  {
    id: 'wifi-connect-arduino',
    title: 'WiFi Connect',
    description: 'Connect to a WiFi network with XIAO ESP32 series',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'wifi',
    code: `// WiFi Connect - XIAO ESP32 Series
#include <WiFi.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  
  Serial.printf("Connecting to %s", ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

void loop() {
  // Check connection status
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Connection lost. Reconnecting...");
    WiFi.begin(ssid, password);
  }
  delay(10000);
}`,
    requirements: ['WiFi library (built-in for ESP32)'],
  },
  {
    id: 'http-server-arduino',
    title: 'Simple HTTP Server',
    description: 'Create a simple web server to control an LED via WiFi',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'wifi',
    code: `// Simple HTTP Server - XIAO ESP32 Series
#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

WebServer server(80);
bool ledState = false;

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>XIAO LED Control</title></head><body><h1>XIAO LED Control</h1>";
  html += "<p>LED is now: <strong>" + String(ledState ? "ON" : "OFF") + "</strong></p>";
  html += "<a href='/on'><button>Turn ON</button></a> ";
  html += "<a href='/off'><button>Turn OFF</button></a></body></html>";
  server.send(200, "text/html", html);
}

void handleOn() {
  ledState = true;
  digitalWrite(LED_BUILTIN, HIGH);
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleOff() {
  ledState = false;
  digitalWrite(LED_BUILTIN, LOW);
  server.sendHeader("Location", "/");
  server.send(303);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nConnected! IP: " + WiFi.localIP().toString());
  
  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.begin();
}

void loop() {
  server.handleClient();
}`,
    requirements: ['WiFi library', 'WebServer library (built-in)'],
  },
];
