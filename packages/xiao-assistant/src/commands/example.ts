import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';

export function registerExampleCommand(program: Command) {
  program
    .command('example <id>')
    .description('Show a code example by ID')
    .action((id: string) => {
      const assistant = new XIAOAssistant();
      const example = assistant.getExampleById(id);

      if (!example) {
        console.error(pc.red(`Example "${id}" not found.`));
        const all = assistant.getAllExamples();
        console.log(pc.yellow('\nAvailable examples:'));
        for (const ex of all) {
          console.log(`  - ${pc.cyan(ex.id)}: ${ex.title}`);
        }
        return;
      }

      console.log(pc.cyan(`\n  ${example.title}\n`));
      console.log(`  ${example.description}`);
      console.log(`  Language: ${pc.green(example.language)} | Category: ${pc.magenta(example.category)}`);
      console.log(`  Compatible boards: ${example.boards.join(', ')}`);
      if (example.requirements?.length) {
        console.log(`  Requirements: ${pc.yellow(example.requirements.join(', '))}`);
      }
      console.log('');
      console.log(pc.dim('  ─────────────────────────────────────────'));
      console.log('');
      const lines = example.code.split('\n');
      for (const line of lines) {
        if (line.startsWith('//') || line.startsWith('#')) {
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
