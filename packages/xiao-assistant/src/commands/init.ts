import { Command } from 'commander';
import figlet from 'figlet';
import pc from 'picocolors';
import { select, input } from '@inquirer/prompts';
import ora from 'ora';
import { writeFileSync, mkdirSync } from 'fs';
import { join, basename, isAbsolute } from 'path';
import { XIAOAssistant } from '../core/assistant.js';

const LANGUAGES = ['arduino', 'micropython', 'circuitpython'] as const;
type Language = (typeof LANGUAGES)[number];

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initialize a new XIAO project')
    .option('-b, --board <board>', 'Board ID (non-interactive)')
    .option('-l, --lang <language>', 'Language: arduino | micropython | circuitpython')
    .option('-n, --name <name>', 'Project name (defaults to xiao-<board>-project)')
    .option('-y, --yes', 'Skip prompts, use the provided options as-is')
    .action(async (options: { board?: string; lang?: string; name?: string; yes?: boolean }) => {
      console.log(pc.cyan(figlet.textSync('XIAO', { font: 'Speed' })));
      console.log(pc.green('  XIAO Project Initializer\n'));

      const assistant = new XIAOAssistant();
      const boards = assistant.getAllBoards();
      const interactive = process.stdout.isTTY && process.stdin.isTTY;

      try {
        let board = options.board;
        if (board) {
          const resolved = assistant.getBoard(board);
          if (!resolved) {
            console.error(
              pc.red(`Unknown board "${board}". Run "xiao boards" to list valid board IDs.`)
            );
            process.exitCode = 1;
            return;
          }
          board = resolved.id;
        } else if (options.yes || !interactive) {
          console.error(
            pc.red('Non-interactive init requires --board (and ideally --lang / --name).')
          );
          process.exitCode = 1;
          return;
        } else {
          board = await select({
            message: 'Select your XIAO board:',
            choices: boards.map((b) => ({
              name: `${b.fullName} (${b.connectivity.join(', ') || 'No RF'})`,
              value: b.id,
            })),
          });
        }

        let language = options.lang;
        if (language) {
          if (!LANGUAGES.includes(language as Language)) {
            console.error(pc.red(`Invalid --lang "${language}". Valid: ${LANGUAGES.join(', ')}`));
            process.exitCode = 1;
            return;
          }
        } else if (options.yes || !interactive) {
          language = 'arduino';
        } else {
          language = await select({
            message: 'Select programming language:',
            choices: [
              { name: 'Arduino (C/C++)', value: 'arduino' },
              { name: 'MicroPython', value: 'micropython' },
              { name: 'CircuitPython', value: 'circuitpython' },
            ],
          });
        }

        let projectName =
          options.name ??
          (interactive && !options.yes
            ? await input({ message: 'Project name:', default: `xiao-${board}-project` })
            : `xiao-${board}-project`);

        // Keep the created directory inside the cwd: no traversal, no absolute paths.
        if (
          !projectName ||
          projectName === '.' ||
          projectName === '..' ||
          isAbsolute(projectName) ||
          basename(projectName) !== projectName
        ) {
          console.error(
            pc.red(
              `Invalid project name "${projectName}": must be a plain directory name (no path separators, not absolute).`
            )
          );
          process.exitCode = 1;
          return;
        }

        const spinner = ora('Creating project...').start();

        try {
          mkdirSync(projectName, { recursive: true });

          const mainFile =
            language === 'arduino'
              ? `${projectName}.ino`
              : language === 'micropython'
                ? 'main.py'
                : 'code.py';
          const code = generateTemplate(board, language as Language, projectName);

          writeFileSync(join(projectName, mainFile), code);

          writeFileSync(
            join(projectName, 'README.md'),
            `# ${projectName}\n\nXIAO ${board.toUpperCase()} project using ${language}.\n\n## Setup\n\nSee [XIAO Wiki](https://wiki.seeedstudio.com/SeeedStudio_XIAO_Series_Introduction/) for getting started.\n`
          );

          spinner.succeed(pc.green(`Project "${projectName}" created!`));
          console.log(`\n  ${pc.cyan('Files created:')}`);
          console.log(`    ${projectName}/`);
          console.log(`    ├── ${mainFile}`);
          console.log(`    └── README.md`);
          console.log(`\n  ${pc.yellow('Next steps:')}`);
          console.log(`    1. Open the project in your IDE`);
          console.log(`    2. Connect your XIAO ${board.toUpperCase()} via USB-C`);
          console.log(`    3. Upload the sketch`);
        } catch (err) {
          spinner.fail(pc.red('Failed to create project'));
          console.error(err);
          process.exitCode = 1;
        }
      } catch (err) {
        // Ctrl-C / non-TTY prompt failures land here: fail cleanly, not with a stack.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(pc.red(`\nInit cancelled${msg ? `: ${msg}` : ''}`));
        process.exitCode = 1;
      }
    });
}

function generateTemplate(board: string, language: Language, projectName: string): string {
  const BOARD = board.toUpperCase();
  // XIAO ESP32C3 has no onboard user LED (no LED_BUILTIN in its Arduino core).
  const noOnboardLed = board === 'esp32c3';

  if (language === 'arduino') {
    return noOnboardLed
      ? `// ${projectName}
// XIAO ${BOARD} - Arduino
// NOTE: XIAO ESP32C3 has NO onboard user LED - the template blinks an
// external LED wired to D10 through a 150-ohm resistor.

const int LED_PIN = 10; // external LED via 150ohm resistor

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("XIAO ${BOARD} Ready!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
`
      : `// ${projectName}
// XIAO ${BOARD} - Arduino

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("XIAO ${BOARD} Ready!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;
  }

  if (language === 'micropython') {
    return `# ${projectName}
# XIAO ${BOARD} - MicroPython
${noOnboardLed ? '# NOTE: XIAO ESP32C3 has no onboard user LED - external LED on D10 (150ohm resistor).\n' : ''}
from machine import Pin
import time

# D10 works on every XIAO; adjust to your wiring.
led = Pin(10, Pin.OUT)

print("XIAO ${BOARD} Ready!")

while True:
    led.on()
    time.sleep(1)
    led.off()
    time.sleep(1)
`;
  }

  return `# ${projectName}
# XIAO ${BOARD} - CircuitPython

import board
import digitalio
import time

# D10 works on every XIAO; board.LED also exists on most builds.
led = digitalio.DigitalInOut(board.D10)
led.direction = digitalio.Direction.OUTPUT

print("XIAO ${BOARD} Ready!")

while True:
    led.value = True
    time.sleep(1)
    led.value = False
    time.sleep(1)
`;
}
