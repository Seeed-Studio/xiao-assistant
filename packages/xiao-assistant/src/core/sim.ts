import type { XIAOBoard, XIAOExample } from './types.js';

/**
 * Wokwi simulation export: turn a bundled example into a runnable Wokwi
 * project (sketch.ino + diagram.json + README). Part ids verified against
 * https://docs.wokwi.com/diagram-format's supported-microcontroller list —
 * Wokwi ships native parts for XIAO ESP32-C3/C6/S3; other chips use the
 * chip-equivalent devkit as a stand-in.
 */

export interface SimProject {
  files: Record<string, string>;
  /** true when Wokwi has a native XIAO part for this board */
  nativePart: boolean;
  partId: string;
}

export function buildSimProject(
  board: XIAOBoard,
  example: XIAOExample
): SimProject | { error: string } {
  if (!board.wokwiPart) {
    return {
      error: `Wokwi does not support ${board.fullName} (supported: XIAO ESP32C3/C6/S3, ESP32C5, RP2040).`,
    };
  }
  if (example.language !== 'arduino') {
    return { error: `Example is ${example.language}; Wokwi export handles Arduino sketches only.` };
  }

  const nativePart = board.wokwiPart.startsWith('board-xiao-');
  const diagram = {
    version: 1,
    author: 'xiao-assistant',
    editor: 'wokwi',
    parts: [{ type: board.wokwiPart, id: 'board', top: 0, left: 0, attrs: {} }],
    connections: [],
  };

  const readme = `# ${example.title} — Wokwi simulation

Simulated on **${board.fullName}**${nativePart ? '' : ' (stand-in board — Wokwi has no native XIAO part for this chip)'}.
Part: \`${board.wokwiPart}\` — ids verified against docs.wokwi.com/diagram-format.

## Run on wokwi.com (free, no install)

1. Open https://wokwi.com/projects/new
2. Replace sketch.ino with the one in this folder
3. Create diagram.json with the one here (in Wokwi: Project files > diagram.json)
4. Press ▶ — serial output appears in the bottom panel

## Run locally (wokwi-cli)

\`\`\`bash
npm install -g wokwi-cli   # then set WOKWI_TOKEN (free tier available)
wokwi-cli simulate .       # from this folder (needs a wokwi.toml with build output)
\`\`\`

> Note: the diagram ships the board only. Examples that need external parts
> (LEDs on boards without LED_BUILTIN, I2C sensors, displays) run their logic
> and serial output; wire the missing parts in Wokwi's editor when needed.
> Source example: \`${example.id}\` (${example.wikiUrl ?? 'bundled example'}).
`;

  return {
    nativePart,
    partId: board.wokwiPart,
    files: {
      'sketch.ino': example.code,
      'diagram.json': JSON.stringify(diagram, null, 2) + '\n',
      'README-sim.md': readme,
    },
  };
}
