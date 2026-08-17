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
  /** Base board this variant extends ("esp32s3-sense" -> "esp32s3"). */
  variantOf?: string;
  /** arduino-cli FQBN. Only stored when verified against a real core; verify
   *  discovers the rest at runtime via `arduino-cli board listall`. */
  fqbn?: string;
  /** Wokwi part id (verified against docs.wokwi.com/diagram-format); boards
   *  without Wokwi support omit this. */
  wokwiPart?: string;
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
  hasResetButton: boolean;
  hasBootButton: boolean;
  hasBatteryCharging: boolean;
  /** Standby/deep-sleep current from the official comparison table (verbatim). */
  lowPowerMode?: string;
  wikiUrl: string;
  sku: string;
}

export interface XIAOExample {
  id: string;
  title: string;
  description: string;
  language: 'arduino' | 'micropython' | 'circuitpython' | 'zephyr';
  boards: string[];
  category: string;
  tags?: string[];
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

export interface WikiSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface XIAOTroubleshootEntry {
  id: string;
  title: string;
  symptoms: string[];
  boards: string[];
  category: string;
  diagnosis: string[];
  solutions: string[];
  wikiUrl?: string;
}

export interface XIAOKnowledge {
  id: string;
  title: string;
  tags: string[];
  boards: string[];
  category: string;
  severity: 'easy' | 'medium' | 'hard';
  source: 'support-ticket' | 'internal-test' | 'community' | 'wiki';
  /** Provenance / freshness (records, per the support workflow). */
  ticketUrl?: string;
  createdAt?: string;
  lastVerifiedAt?: string;
  summary: string;
  problem: string;
  solution: string;
  code?: string;
  workaround?: string;
}
