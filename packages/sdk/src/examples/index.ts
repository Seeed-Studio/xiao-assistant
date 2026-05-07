import type { XIAOExample } from '../types.js';
import { blinkExamples } from './blink.js';
import { wifiExamples } from './wifi.js';
import { sensorExamples } from './sensors.js';
import { advancedExamples } from './advanced.js';

export const allExamples: XIAOExample[] = [
  ...blinkExamples,
  ...wifiExamples,
  ...sensorExamples,
  ...advancedExamples,
];
