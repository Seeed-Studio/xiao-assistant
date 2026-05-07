export interface XIAOPinConfig {
  digital: number[];
  analog: number[];
  pwm: number[];
  i2c: Array<{ sda: number; scl: number }>;
  spi: Array<{ mosi: number; miso: number; sck: number; cs: number }>;
  uart: Array<{ tx: number; rx: number }>;
}

export interface XIAOBoard {
  id: string;
  name: string;
  fullName: string;
  microcontroller: string;
  architecture: string;
  clockSpeed: string;
  flashSize: string;
  ramSize: string;
  onboardFlash: string;
  pins: XIAOPinConfig;
  features: string[];
  connectivity: string[];
  builtinSensors: string[];
  supportedLanguages: string[];
  lowPowerMode: string;
  hasResetButton: boolean;
  hasBootButton: boolean;
  hasBatteryCharging: boolean;
  wikiUrl: string;
  sku: string;
}

export interface XIAOExample {
  id: string;
  title: string;
  description: string;
  language: 'arduino' | 'micropython' | 'circuitpython';
  boards: string[];
  category: string;
  code: string;
  requirements?: string[];
  wikiUrl?: string;
}

export interface XIAODocument {
  id: string;
  title: string;
  content: string;
  category: string;
  boards: string[];
  wikiUrl?: string;
}
