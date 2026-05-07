import type { XIAOBoard } from '../types.js';
import { esp32c3 } from './esp32c3.js';
import { esp32s3, esp32s3Sense } from './esp32s3.js';
import { esp32c6 } from './esp32c6.js';
import { rp2040, rp2350 } from './rp2040.js';
import { nrf52840, nrf52840Sense } from './nrf52840.js';
import { samd21 } from './samd21.js';
import { ra4m1 } from './ra4m1.js';
import { mg24, mg24Sense } from './mg24.js';
import { nrf54l15, nrf54l15Sense } from './nrf54l15.js';

export const allBoards: XIAOBoard[] = [
  samd21,
  rp2040,
  rp2350,
  nrf52840,
  nrf52840Sense,
  esp32c3,
  esp32c6,
  esp32s3,
  esp32s3Sense,
  ra4m1,
  mg24,
  mg24Sense,
  nrf54l15,
  nrf54l15Sense,
];
