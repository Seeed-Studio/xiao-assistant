#!/usr/bin/env node

import { XIAOAssistant } from './packages/sdk/dist/index.js';

async function main() {
  console.log('XIAO Assistant Demo\n');

  const assistant = new XIAOAssistant();

  console.log('=== All Boards ===');
  assistant.getAllBoards().forEach((b) => {
    console.log(`  ${b.name} (${b.microcontroller}) - ${b.connectivity.join(', ') || 'No RF'}`);
  });

  console.log('\n=== Resolve Board: "xiao with camera" ===');
  assistant.resolveBoard('camera').forEach((b) => console.log(`  -> ${b.fullName}`));

  console.log('\n=== Pinout: ESP32C3 ===');
  console.log(assistant.getPinout('esp32c3'));

  console.log('\n=== Search Examples: "wifi" ===');
  assistant.searchExamples('wifi').forEach((e) => console.log(`  ${e.id}: ${e.title} (${e.language})`));

  console.log('\n=== Search Examples: "sensor" ===');
  assistant.searchExamples('sensor').forEach((e) => console.log(`  ${e.id}: ${e.title} (${e.language})`));

  console.log('\n=== Quickstart: ESP32 ===');
  const qs = assistant.getQuickstart('esp32c3');
  if (qs) console.log(`  Found: ${qs.title}`);

  console.log('\nDemo completed!');
}

main().catch(console.error);
