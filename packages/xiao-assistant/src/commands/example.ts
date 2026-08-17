import { Command } from 'commander';
import pc from 'picocolors';
import { mkdirSync, writeFileSync } from 'node:fs';
import { XIAOAssistant } from '../core/assistant.js';
import { buildSimProject } from '../core/sim.js';

export function registerExampleCommand(program: Command) {
  program
    .command('example <id>')
    .description('Show a code example by ID')
    .option('--sim [dir]', 'export the example as a Wokwi simulation project (no hardware needed)')
    .option(
      '-b, --board <board>',
      'board to simulate on (default: first Wokwi-supported compatible board)'
    )
    .action((id: string, options: { sim?: string | boolean; board?: string }) => {
      const assistant = new XIAOAssistant();
      const example = assistant.getExampleById(id);

      if (!example) {
        console.error(pc.red(`Example "${id}" not found.`));
        const all = assistant.getAllExamples();
        console.log(pc.yellow('\nAvailable examples:'));
        for (const ex of all) {
          console.log(`  - ${pc.cyan(ex.id)}: ${ex.title}`);
        }
        process.exitCode = 1;
        return;
      }

      if (options.sim !== undefined) {
        exportSim(assistant, example, options);
        return;
      }

      console.log(pc.cyan(`\n  ${example.title}\n`));
      console.log(`  ${example.description}`);
      console.log(
        `  Language: ${pc.green(example.language)} | Category: ${pc.magenta(example.category)}`
      );
      console.log(`  Compatible boards: ${example.boards.join(', ')}`);
      if (example.requirements?.length) {
        console.log(`  Requirements: ${pc.yellow(example.requirements.join(', '))}`);
      }
      console.log('');
      console.log(pc.dim('  ─────────────────────────────────────────'));
      console.log('');
      const lines = example.code.split('\n');
      // '#' is a comment in Python dialects only; in Arduino/C it is a preprocessor
      // directive and must not be colored like a comment.
      const isComment =
        example.language === 'arduino' || example.language === 'zephyr'
          ? (line: string) => line.startsWith('//')
          : (line: string) => line.startsWith('//') || line.startsWith('#');
      for (const line of lines) {
        if (isComment(line)) {
          console.log(pc.green(`  ${line}`));
        } else {
          console.log(`  ${line}`);
        }
      }
      console.log(pc.dim('\n  ─────────────────────────────────────────'));
      if (example.wikiUrl) {
        console.log(pc.dim(`  Wiki: ${example.wikiUrl}`));
      }
      console.log('');
    });
}

function exportSim(
  assistant: XIAOAssistant,
  example: import('../core/types.js').XIAOExample,
  options: { sim?: string | boolean; board?: string }
) {
  // Pick the board to simulate on: explicit --board, else the example's first
  // Wokwi-capable board.
  let board = options.board ? assistant.getBoard(options.board) : undefined;
  if (options.board && !board) {
    console.error(pc.red(`Unknown board "${options.board}". Run "xiao boards" to list ids.`));
    process.exitCode = 1;
    return;
  }
  if (!board) {
    board = example.boards.map((b) => assistant.getBoard(b)).find((b) => b?.wokwiPart);
  }
  if (!board) {
    console.error(
      pc.red(
        `No Wokwi-supported board for "${example.id}". Wokwi supports XIAO ESP32C3/C6/S3, ESP32C5 and RP2040.`
      )
    );
    process.exitCode = 1;
    return;
  }

  const project = buildSimProject(board, example);
  if ('error' in project) {
    console.error(pc.red(project.error));
    process.exitCode = 1;
    return;
  }

  const dir =
    typeof options.sim === 'string' && options.sim.trim()
      ? options.sim.trim()
      : `wokwi-${example.id}`;
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(project.files)) {
    writeFileSync(`${dir}/${name}`, content);
  }
  console.log(pc.cyan(`\n  Wokwi project exported: ${dir}/`));
  console.log(
    `    board: ${board.fullName} → ${pc.green(project.partId)}${project.nativePart ? pc.dim(' (native XIAO part)') : pc.yellow(' (chip-equivalent stand-in)')}`
  );
  console.log(`    files: ${Object.keys(project.files).join(', ')}`);
  console.log(
    pc.dim(
      `\n    Run: open https://wokwi.com/projects/new and paste both files (see ${dir}/README-sim.md)`
    )
  );
}
