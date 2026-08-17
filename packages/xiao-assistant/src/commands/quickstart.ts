import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';

export function registerQuickstartCommand(program: Command) {
  program
    .command('quickstart <board>')
    .description('IDE setup and first-upload guide for a board')
    .action((board: string) => {
      const assistant = new XIAOAssistant();
      const resolved = assistant.getBoard(board);
      if (!resolved) {
        console.error(
          pc.red(`Unknown board "${board}". Run "xiao boards" to list valid board IDs.`)
        );
        process.exitCode = 1;
        return;
      }
      const doc = assistant.getQuickstart(resolved.id);
      if (!doc) {
        const wiki = resolved.wikiUrl;
        console.log(pc.yellow(`No local quickstart for ${resolved.fullName}; wiki: ${wiki}`));
        return;
      }
      console.log(pc.cyan(`\n  ${resolved.fullName} — getting started\n`));
      console.log(doc.content.trim());
      console.log(pc.dim(`\n  Next: xiao init -b ${resolved.id} -y   # scaffold a project`));
    });
}
