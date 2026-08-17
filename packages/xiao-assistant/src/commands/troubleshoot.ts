import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';
import { recordQuery } from '../core/query-log.js';

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
      // Internal knowledge often holds the EXACT fix (compile-error text lives
      // in a knowledge entry's problem field). Rendered FIRST: the audit found
      // the knowledge hit buried 77 lines deep where no first screen showed it.
      const knowledge = assistant
        .searchKnowledge(symptoms, options.board ? { board: options.board } : undefined)
        .filter((k) => !entries.some((e) => e.id === k.id))
        .slice(0, 2);
      recordQuery({
        tool: 'troubleshoot',
        query: symptoms,
        board: options.board,
        hits: entries.length + knowledge.length,
        matched: [...entries.slice(0, 5).map((e) => e.id), ...knowledge.map((k) => k.id)],
      });
      console.log(pc.cyan(`\n  Troubleshooting "${symptoms}"\n`));

      if (knowledge.length > 0) {
        console.log(pc.magenta('  Internal Knowledge (specific fixes):'));
        for (const k of knowledge) {
          console.log(`  ${pc.magenta('◆')} ${pc.bold(k.title)}`);
          console.log(
            `    ${pc.dim(`Severity: ${k.severity} | Boards: ${k.boards.join(', ') || 'all'}`)}`
          );
          console.log(`    ${k.solution}`);
          if (k.code)
            console.log(
              pc.dim(
                `    (fix code available: xiao search "${k.tags[0] ?? k.id}" or MCP search_knowledge)`
              )
            );
          console.log('');
        }
      }

      if (entries.length === 0) {
        if (knowledge.length === 0) {
          console.log(pc.yellow('  No matching troubleshooting entries.'));
        }
      } else {
        console.log(pc.cyan('  General troubleshooting:'));
        for (const e of entries.slice(0, 3)) {
          console.log(`  ${pc.green('●')} ${pc.bold(e.title)}`);
          console.log(`    ${pc.dim(`Category: ${e.category} | Boards: ${e.boards.join(', ')}`)}`);
          console.log(`    ${pc.cyan('Diagnosis:')}`);
          for (const d of e.diagnosis) console.log(`      - ${d}`);
          console.log(`    ${pc.cyan('Solutions:')}`);
          for (const s of e.solutions) console.log(`      - ${s}`);
          if (e.wikiUrl) console.log(`    ${pc.blue(e.wikiUrl)}`);
          console.log('');
        }
        if (entries.length > 3) {
          console.log(pc.dim(`  ... and ${entries.length - 3} more general matches`));
        }
      }

      if (entries.length === 0 && knowledge.length === 0) {
        console.log(pc.dim('  Try the exact symptom text or search the wiki: xiao search --docs'));
      }
    });
}
