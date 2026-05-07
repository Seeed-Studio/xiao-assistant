import type { XIAOExample } from '../types.js';

export const sensorExamples: XIAOExample[] = [
  {
    id: 'i2c-scanner-arduino',
    title: 'I2C Scanner',
    description: 'Scan I2C bus to find connected devices',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21', 'ra4m1', 'mg24', 'mg24-sense'],
    category: 'i2c',
    code: `// I2C Scanner - XIAO Boards
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  Serial.println("\\nI2C Scanner");
  
  Wire.begin();
}

void loop() {
  Serial.println("Scanning...");
  
  int deviceCount = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.printf("Device found at 0x%02X\\n", address);
      deviceCount++;
    }
  }
  
  if (deviceCount == 0) {
    Serial.println("No I2C devices found!");
  } else {
    Serial.printf("Found %d device(s)\\n", deviceCount);
  }
  
  delay(5000);
}`,
    requirements: ['Wire library (built-in)'],
  },
  {
    id: 'dht11-arduino',
    title: 'DHT11 Temperature & Humidity',
    description: 'Read temperature and humidity from a DHT11 sensor',
    language: 'arduino',
    boards: ['esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6', 'rp2040', 'rp2350', 'nrf52840', 'nrf52840-sense', 'samd21', 'ra4m1', 'mg24', 'mg24-sense'],
    category: 'sensors',
    code: `// DHT11 Temperature & Humidity Sensor - XIAO
#include <DHT.h>

#define DHTPIN 2      // Connect DHT11 data pin to XIAO pin 2
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  Serial.println("DHT11 Sensor Reading");
  dht.begin();
}

void loop() {
  delay(2000);  // DHT11 needs at least 1 second between readings
  
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  
  Serial.printf("Temperature: %.1f °C\\n", temperature);
  Serial.printf("Humidity: %.1f %%\\n", humidity);
  Serial.printf("Heat Index: %.1f °C\\n", heatIndex);
  Serial.println("---");
}`,
    requirements: ['DHT sensor library (by Adafruit)'],
  },
  {
    id: 'imu-arduino',
    title: 'IMU Sensor Reading (nRF52840 Sense)',
    description: 'Read 6-axis IMU data from XIAO nRF52840 Sense onboard sensor',
    language: 'arduino',
    boards: ['nrf52840-sense'],
    category: 'sensors',
    code: `// IMU Sensor - XIAO nRF52840 Sense (LSM6DS3TR-C)
#include <Adafruit_LSM6DS3TRC.h>

Adafruit_LSM6DS3TRC lsm6ds3;

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  
  if (!lsm6ds3.begin_I2C()) {
    Serial.println("Failed to find LSM6DS3TR-C chip");
    while (1) { delay(10); }
  }
  
  Serial.println("LSM6DS3TR-C Found!");
  lsm6ds3.setAccelRange(LSM6DS3_ACCEL_RANGE_2_G);
  lsm6ds3.setGyroRange(LSM6DS3_GYRO_RANGE_250_DPS);
}

void loop() {
  sensors_event_t accel, gyro, temp;
  lsm6ds3.getEvent(&accel, &gyro, &temp);
  
  Serial.printf("Accel X: %.2f, Y: %.2f, Z: %.2f m/s^2\\n",
    accel.acceleration.x, accel.acceleration.y, accel.acceleration.z);
  Serial.printf("Gyro X: %.2f, Y: %.2f, Z: %.2f rad/s\\n",
    gyro.gyro.x, gyro.gyro.y, gyro.gyro.z);
  Serial.printf("Temp: %.1f °C\\n", temp.temperature);
  Serial.println("---");
  delay(100);
}`,
    requirements: ['Adafruit LSM6DS library', 'Adafruit Unified Sensor'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO_BLE/',
  },
  {
    id: 'ble-uart-arduino',
    title: 'BLE UART Service',
    description: 'Set up BLE UART service for wireless serial communication',
    language: 'arduino',
    boards: ['nrf52840', 'nrf52840-sense', 'esp32c3', 'esp32s3', 'esp32s3-sense', 'esp32c6'],
    category: 'bluetooth',
    code: `// BLE UART Service - XIAO nRF52840
// For ESP32 series, use BLEDevice.h instead
#include <ArduinoBLE.h>

BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLEStringCharacteristic txChar("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", BLERead | BLENotify, 20);
BLEStringCharacteristic rxChar("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", BLEWrite, 20);

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  
  if (!BLE.begin()) {
    Serial.println("Starting BLE failed!");
    while (1);
  }
  
  BLE.setLocalName("XIAO-BLE-UART");
  BLE.setAdvertisedService(uartService);
  uartService.addCharacteristic(txChar);
  uartService.addCharacteristic(rxChar);
  BLE.addService(uartService);
  
  BLE.advertise();
  Serial.println("BLE UART service active. Waiting for connection...");
}

void loop() {
  BLEDevice central = BLE.central();
  
  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());
    
    while (central.connected()) {
      if (rxChar.written()) {
        String value = rxChar.value();
        Serial.print("Received: ");
        Serial.println(value);
        txChar.writeValue("Echo: " + value);
      }
    }
    
    Serial.println("Disconnected");
  }
}`,
    requirements: ['ArduinoBLE library'],
    wikiUrl: 'https://wiki.seeedstudio.com/XIAO_BLE/',
  },
];
