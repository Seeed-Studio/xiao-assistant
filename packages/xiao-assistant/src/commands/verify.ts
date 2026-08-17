import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';
import type { XIAOBoard } from '../core/types.js';
import { compileSketch, resolveFqbn } from '../core/compiler.js';

/**
 * `xiao verify <board> [exampleId]` - compile a served example for real with
 * arduino-cli. FQBNs come from verified board data when present, otherwise
 * they are discovered at runtime via `arduino-cli board listall` against the
 * cores the user actually has installed (board ids drift between core
 * versions; guessing them in data would violate the verified-data rule).
 */
export function registerVerifyCommand(program: Command) {
  program
    .command('verify <board> [exampleId]')
    .description('Compile an example with arduino-cli (real firmware check)')
    .option('--dry-run', 'print the compile plan without running it')
    .option('--all', 'compile every arduino example compatible with the board')
    .option('--cli <path>', 'arduino-cli binary', 'arduino-cli')
    .action(
      (
        board: string,
        exampleId: string | undefined,
        options: { dryRun?: boolean; all?: boolean; cli: string }
      ) => {
        const assistant = new XIAOAssistant();
        const boardInfo = assistant.getBoard(board);
        if (!boardInfo) {
          console.error(
            pc.red(`Unknown board "${board}". Run "xiao boards" to list valid board IDs.`)
          );
          process.exitCode = 1;
          return;
        }

        if (options.all) {
          verifyAll(assistant, boardInfo, options.cli);
          return;
        }

        const example = exampleId ? assistant.getExampleById(exampleId) : undefined;
        if (exampleId && !example) {
          console.error(
            pc.red(`Unknown example "${exampleId}". Run "xiao search <topic>" to list ids.`)
          );
          process.exitCode = 1;
          return;
        }
        if (example && example.language !== 'arduino') {
          console.error(
            pc.red(
              `Example "${example.id}" is ${example.language}; verify compiles Arduino sketches only.`
            )
          );
          process.exitCode = 1;
          return;
        }

        const { fqbn, discovered, hint } = resolveFqbn(boardInfo, options.cli);
        const sketchName = example ? example.id : `${boardInfo.id}-blink-check`;
        const code =
          example?.code ??
          (boardInfo.id === 'esp32c3'
            ? `const int LED_PIN = 10;\nvoid setup() { Serial.begin(115200); pinMode(LED_PIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_PIN, HIGH); delay(500); digitalWrite(LED_PIN, LOW); delay(500); }\n`
            : `void setup() { Serial.begin(115200); pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_BUILTIN, HIGH); delay(500); digitalWrite(LED_BUILTIN, LOW); delay(500); }\n`);

        console.log(pc.cyan(`\n  verify: ${sketchName} → ${boardInfo.fullName}`));
        if (!fqbn && options.dryRun) {
          console.log(pc.dim(`  FQBN: <fqbn>  # resolved at runtime — ${hint}`));
          console.log(pc.dim(`  plan: ${options.cli} compile --fqbn <fqbn> ${sketchName}`));
          console.log(pc.green('\n  dry-run ok - rerun without --dry-run to compile.'));
          return;
        }
        if (!fqbn) {
          console.error(pc.red(`No FQBN for ${boardInfo.fullName}: ${hint}`));
          process.exitCode = 1;
          return;
        }
        console.log(
          pc.dim(
            `  FQBN: ${fqbn}${discovered ? pc.yellow('  (discovered from installed cores)') : '  (verified board data)'}`
          )
        );

        if (options.dryRun) {
          console.log(pc.dim(`  plan: ${options.cli} compile --fqbn ${fqbn} ${sketchName}`));
          console.log(pc.green('\n  dry-run ok - rerun without --dry-run to compile.'));
          return;
        }

        const res = compileSketch({ board: boardInfo, sketchName, code, cliPath: options.cli });
        if (res.ok) {
          console.log(pc.green(`\n  ✅ compiles${res.sizeLine ? ` — ${res.sizeLine}` : ''}`));
        } else {
          console.error(pc.red('\n  ❌ compile failed:'));
          for (const e of res.errors) console.error(`     ${e}`);
          process.exitCode = 1;
        }
      }
    );
}

function verifyAll(assistant: XIAOAssistant, boardInfo: XIAOBoard, cli: string) {
  const group = new Set(assistant.boardGroup(boardInfo.id));
  const targets = assistant
    .getAllExamples()
    .filter((e) => e.language === 'arduino' && e.boards.some((b) => group.has(b)))
    // skip sketches that need libraries the CLI can't assume are installed
    .filter((e) => (e.requirements ?? []).length === 0);
  if (targets.length === 0) {
    console.log(pc.yellow('No dependency-free arduino examples for this board.'));
    return;
  }
  console.log(pc.cyan(`\n  verify --all: ${targets.length} examples → ${boardInfo.fullName}\n`));
  let pass = 0;
  const failed: string[] = [];
  for (const ex of targets) {
    const res = compileSketch({ board: boardInfo, sketchName: ex.id, code: ex.code, cliPath: cli });
    if (res.ok) {
      pass++;
      console.log(
        `  ${pc.green('✅')} ${ex.id}${res.sizeLine ? pc.dim(`  ${res.sizeLine.split(',')[0]}`) : ''}`
      );
    } else {
      failed.push(ex.id);
      console.log(`  ${pc.red('❌')} ${ex.id}`);
      for (const e of res.errors.slice(0, 2)) console.log(pc.red(`       ${e}`));
    }
  }
  console.log(
    `\n  ${pass}/${targets.length} compile${failed.length ? `, failed: ${failed.join(', ')}` : ''}`
  );
  if (failed.length > 0) process.exitCode = 1;
}
