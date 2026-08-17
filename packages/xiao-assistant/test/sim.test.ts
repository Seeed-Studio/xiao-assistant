import { describe, it, expect } from 'vitest';
import { buildSimProject } from '../src/core/sim.js';
import { XIAOAssistant } from '../src/core/assistant.js';

const assistant = new XIAOAssistant();

describe('buildSimProject', () => {
  it('generates a valid diagram.json for a supported board', () => {
    const board = assistant.getBoard('esp32s3');
    const example = assistant.getExampleById('blink-arduino');
    if (!board || !example) throw new Error('fixture missing');
    const project = buildSimProject(board, example);
    if ('error' in project) throw new Error(project.error);
    const diagram = JSON.parse(project.files['diagram.json'] ?? '{}');
    expect(diagram.version).toBe(1);
    expect(diagram.parts[0].type).toBe('board-xiao-esp32-s3');
    expect(project.nativePart).toBe(true);
    expect(project.files['sketch.ino']).toContain('setup()');
  });

  it('rejects boards without Wokwi support', () => {
    const board = assistant.getBoard('samd21');
    const example = assistant.getExampleById('blink-arduino');
    if (!board || !example) throw new Error('fixture missing');
    expect(buildSimProject(board, example)).toHaveProperty('error');
  });
});
