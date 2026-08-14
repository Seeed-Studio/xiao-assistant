import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';

export function registerTroubleshootCommand(program: Command) {
  program
    .command('troubleshoot <symptoms>')
    .description('Diagnose XIAO problems from symptoms')
    .option('-b, --board <board>', 'Narrow down to a board ID')
    .action((symptoms: string, options: { board?: string }) => {
      const assistant = new XIAOAssistant();
      if (options.board && !assistant.getBoard(options.board)) {
        console.error(
          pc.red(`Unknown board "${options.board}". Run "xiao boards" to list valid board IDs.`)
        );
        process.exitCode = 1;
        return;
      }

      const entries = assistant.troubleshoot(symptoms, options.board);
      console.log(pc.cyan(`\n  Troubleshooting "${symptoms}"\n`));

      if (entries.length === 0) {
        console.log(pc.yellow('  No matching troubleshooting entries.'));
        console.log(pc.dim('  Try the exact symptom text or search the wiki: xiao search --docs'));
        return;
      }

      for (const e of entries.slice(0, 5)) {
        console.log(`  ${pc.green('●')} ${pc.bold(e.title)}`);
        console.log(`    ${pc.dim(`Category: ${e.category} | Boards: ${e.boards.join(', ')}`)}`);
        console.log(`    ${pc.cyan('Diagnosis:')}`);
        for (const d of e.diagnosis) console.log(`      - ${d}`);
        console.log(`    ${pc.cyan('Solutions:')}`);
        for (const s of e.solutions) console.log(`      - ${s}`);
        if (e.wikiUrl) console.log(`    ${pc.blue(e.wikiUrl)}`);
        console.log('');
      }
      if (entries.length > 5) {
        console.log(pc.dim(`  ... and ${entries.length - 5} more matches`));
      }
    });
}
