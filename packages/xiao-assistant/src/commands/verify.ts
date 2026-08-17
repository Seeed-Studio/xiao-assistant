import { Command } from 'commander';
import pc from 'picocolors';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XIAOAssistant } from '../core/assistant.js';

/**
 * `xiao verify <board> [exampleId]` - compile a served example for real with
 * arduino-cli. The FQBN comes from board data when verified, otherwise it is
 * discovered at runtime via `arduino-cli board listall` against the cores the
 * user actually has installed (board ids drift between core versions; guessing
 * them in data would violate the wiki-verified-data rule).
 */
export function registerVerifyCommand(program: Command) {
  program
    .command('verify <board> [exampleId]')
    .description('Compile an example for a board with arduino-cli (real firmware check)')
    .option('--dry-run', 'print the compile plan without running it')
    .option('--cli <path>', 'arduino-cli binary', 'arduino-cli')
    .action(
      (
        board: string,
        exampleId: string | undefined,
        options: { dryRun?: boolean; cli: string }
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

        // 1) Resolve the FQBN: verified data first, runtime discovery second.
        let fqbn = boardInfo.fqbn;
        let discovered = false;
        if (!fqbn) {
          const listall = spawnSync(options.cli, ['board', 'listall', boardInfo.name], {
            encoding: 'utf-8',
          });
          if (listall.status === 0) {
            // Output rows: "Board Name     FQBN        Core"
            const rows = (listall.stdout ?? '')
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.includes(':'));
            const hit = rows.find((l) =>
              l.toLowerCase().includes(boardInfo.name.toLowerCase().split(' ')[0] ?? '')
            );
            const fromRow = hit?.match(/([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)/)?.[1];
            if (fromRow) {
              fqbn = fromRow;
              discovered = true;
            }
          }
        }
        if (!fqbn && !options.dryRun) {
          console.error(
            pc.red(
              `No FQBN for ${boardInfo.fullName}: not in board data and \`arduino-cli board listall\` found nothing.\n` +
                `Install the board's core (see: xiao quickstart ${boardInfo.id}), then retry - discovery uses YOUR installed cores.`
            )
          );
          process.exitCode = 1;
          return;
        }
        const shownFqbn = fqbn ?? '<fqbn>  # resolved at runtime from your installed cores';

        // 2) Sketch source: the served example (blink fallback = init template logic).
        const sketchName = example ? example.id : `${boardInfo.id}-blink-check`;
        const code =
          example?.code ??
          (boardInfo.id === 'esp32c3'
            ? `const int LED_PIN = 10;\nvoid setup() { Serial.begin(115200); pinMode(LED_PIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_PIN, HIGH); delay(500); digitalWrite(LED_PIN, LOW); delay(500); }\n`
            : `void setup() { Serial.begin(115200); pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_BUILTIN, HIGH); delay(500); digitalWrite(LED_BUILTIN, LOW); delay(500); }\n`);

        const args = ['compile', '--fqbn', fqbn ?? '<fqbn>', sketchName];
        console.log(pc.cyan(`\n  verify: ${sketchName} → ${boardInfo.fullName}`));
        console.log(
          pc.dim(
            `  FQBN: ${shownFqbn}${discovered ? pc.yellow('  (discovered from your installed cores)') : fqbn ? '  (verified board data)' : ''}`
          )
        );

        if (options.dryRun) {
          console.log(pc.dim(`  plan: ${options.cli} ${args.join(' ')}  # in a temp sketch dir`));
          console.log(pc.green('\n  dry-run ok - rerun without --dry-run to compile.'));
          return;
        }

        // 3) Real compile in a temp sketch folder named after the sketch.
        const dir = mkdtempSync(join(tmpdir(), 'xiao-verify-'));
        const sketchDir = join(dir, sketchName);
        try {
          mkdirSync(sketchDir, { recursive: true });
          writeFileSync(join(sketchDir, `${sketchName}.ino`), code);
          const res = spawnSync(options.cli, args, { cwd: dir, encoding: 'utf-8' });
          const out = (res.stdout ?? '') + (res.stderr ?? '');
          const sizeLine = out.split('\n').find((l) => l.includes('Sketch uses'));
          if (res.status === 0) {
            console.log(
              pc.green(
                `\n  ✅ compiles for ${boardInfo.fullName}${sizeLine ? ` — ${sizeLine.trim()}` : ''}`
              )
            );
          } else {
            console.error(pc.red('\n  ❌ compile failed:'));
            console.error(
              out
                .split('\n')
                .filter((l) => /error|Error|fatal/.test(l))
                .slice(0, 6)
                .map((l) => `     ${l.trim()}`)
                .join('\n') || out.split('\n').slice(-8).join('\n')
            );
            process.exitCode = 1;
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    );
}
