#!/usr/bin/env node

/**
 * XIAO Assistant Demo Script
 * Demonstrates the core functionality of the XIAO Assistant SDK
 */

import { XIAOAssistant } from './packages/sdk/dist/index.js';

async function main() {
  console.log('🚀 XIAO Assistant Demo\n');

  const assistant = new XIAOAssistant();

  // Show available boards
  console.log('📋 Available XIAO Boards:');
  const boards = assistant.getAllBoards();
  boards.forEach(board => {
    console.log(`  • ${board.name} (${board.microcontroller})`);
  });

  console.log('\n📌 XIAO ESP32C3 Pinout:');
  try {
    const pinout = assistant.getPinout('esp32c3');
    console.log(pinout);
  } catch (error) {
    console.error('Error getting pinout:', error.message);
  }

  console.log('\n🔍 Example Usage in AI Assistant:');
  console.log('User: "Show me how to connect an OLED display to XIAO ESP32C3"');
  console.log('Assistant: Uses XIAO SDK to get pinout info and provide accurate guidance');

  console.log('\n✨ Demo completed successfully!');
}

main().catch(console.error);