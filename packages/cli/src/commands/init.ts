import { Command } from 'commander';
import figlet from 'figlet';
import pc from 'picocolors';
import { select, input } from '@inquirer/prompts';
import ora from 'ora';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { XIAOAssistant } from '@seeed-studio/xiao-sdk';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initialize a new XIAO project')
    .action(async () => {
      console.log(pc.cyan(figlet.textSync('XIAO', { font: 'Speed' })));
      console.log(pc.green('  XIAO Project Initializer\n'));

      const assistant = new XIAOAssistant();
      const boards = assistant.getAllBoards();

      const board: string = await select({
        message: 'Select your XIAO board:',
        choices: boards.map((b) => ({
          name: `${b.fullName} (${b.connectivity.join(', ') || 'No RF'})`,
          value: b.id,
        })),
      });

      const language = await select({
        message: 'Select programming language:',
        choices: [
          { name: 'Arduino (C/C++)', value: 'arduino' },
          { name: 'MicroPython', value: 'micropython' },
          { name: 'CircuitPython', value: 'circuitpython' },
        ],
      });

      const projectName = await input({
        message: 'Project name:',
        default: `xiao-${board}-project`,
      });

      const spinner = ora('Creating project...').start();

      try {
        mkdirSync(projectName, { recursive: true });

        const mainFile = language === 'arduino' ? `${projectName}.ino` : language === 'micropython' ? 'main.py' : 'code.py';
        const code = generateTemplate(board, language, projectName);

        writeFileSync(join(projectName, mainFile), code);

        writeFileSync(join(projectName, 'README.md'), `# ${projectName}\n\nXIAO ${board.toUpperCase()} project using ${language}.\n\n## Setup\n\nSee [XIAO Wiki](https://wiki.seeedstudio.com/SeeedStudio_XIAO_Series_Introduction/) for getting started.\n`);

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
      }
    });
}

function generateTemplate(board: string, language: string, projectName: string): string {
  if (language === 'arduino') {
    return `// ${projectName}
// XIAO ${board.toUpperCase()} - Arduino

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("XIAO ${board.toUpperCase()} Ready!");
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
# XIAO ${board.toUpperCase()} - MicroPython

from machine import Pin
import time

led = Pin("LED_BUILTIN", Pin.OUT)

print("XIAO ${board.toUpperCase()} Ready!")

while True:
    led.on()
    time.sleep(1)
    led.off()
    time.sleep(1)
`;
  }

  return `# ${projectName}
# XIAO ${board.toUpperCase()} - CircuitPython

import board
import digitalio
import time

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

print("XIAO ${board.toUpperCase()} Ready!")

while True:
    led.value = True
    time.sleep(1)
    led.value = False
    time.sleep(1)
`;
}
