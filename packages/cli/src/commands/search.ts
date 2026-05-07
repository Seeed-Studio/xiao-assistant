import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '@seeedstudio/xiao-sdk';

export function registerSearchCommand(program: Command) {
  program
    .command('search <query>')
    .description('Search for XIAO code examples and documentation')
    .option('-l, --lang <language>', 'Filter by language (arduino, micropython, circuitpython)')
    .option('-b, --board <board>', 'Filter by board ID')
    .option('-d, --docs', 'Search documentation only')
    .action(async (query: string, options: { lang?: string; board?: string; docs?: boolean }) => {
      const assistant = new XIAOAssistant();

      if (!options.docs) {
        const { local: examples, wiki } = await assistant.searchExamplesWithFallback(query, { language: options.lang, board: options.board });
        console.log(pc.cyan(`\n  Code Examples for "${query}"\n`));
        if (examples.length === 0) {
          console.log(pc.yellow('  No local examples found.'));
          if (wiki.length > 0) {
            console.log(pc.cyan('\n  Wiki Results:\n'));
            for (const r of wiki) {
              console.log(`  ${pc.green('●')} ${pc.bold(r.title)}`);
              console.log(`    ${pc.dim(r.snippet)}`);
              console.log(`    ${pc.blue(r.url)}`);
              console.log('');
            }
          }
        } else {
          for (const ex of examples) {
            console.log(`  ${pc.green('●')} ${pc.bold(ex.title)}`);
            console.log(`    ${pc.dim(ex.description)}`);
            console.log(`    Language: ${pc.cyan(ex.language)} | Category: ${pc.magenta(ex.category)} | ID: ${pc.yellow(ex.id)}`);
            console.log(`    Boards: ${ex.boards.join(', ')}`);
            if (ex.requirements?.length) {
              console.log(`    Requires: ${ex.requirements.join(', ')}`);
            }
            console.log('');
          }
        }
      }

      const { local: docs, wiki } = await assistant.searchDocumentsWithFallback(query);
      if (docs.length > 0) {
        console.log(pc.cyan(`  Documentation\n`));
        for (const doc of docs) {
          console.log(`  ${pc.green('●')} ${pc.bold(doc.title)}`);
          console.log(`    ${pc.dim(`Category: ${doc.category} | Boards: ${doc.boards.join(', ')}`)}`);
          console.log('');
        }
      } else if (wiki.length > 0 && options.docs) {
        console.log(pc.cyan('\n  Wiki Results:\n'));
        for (const r of wiki) {
          console.log(`  ${pc.green('●')} ${pc.bold(r.title)}`);
          console.log(`    ${pc.dim(r.snippet)}`);
          console.log(`    ${pc.blue(r.url)}`);
          console.log('');
        }
      }
    });
}
