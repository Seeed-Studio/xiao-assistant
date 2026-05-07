import { Command } from 'commander';
import figlet from 'figlet';
import pc from 'picocolors';
import { registerInitCommand } from './commands/init.js';
import { registerPinoutCommand } from './commands/pinout.js';
import { registerSearchCommand } from './commands/search.js';
import { registerExampleCommand } from './commands/example.js';
import { registerBoardsCommand } from './commands/boards.js';
import { registerKnowledgeCommand } from './commands/knowledge.js';

const program = new Command();

program
  .name('xiao')
  .description('XIAO Assistant - Development tools for Seeed Studio XIAO series')
  .version('0.1.0');

program
  .command('help')
  .description('Show detailed help information')
  .action(() => {
    console.log(pc.cyan(figlet.textSync('XIAO', { font: 'Speed' })));
    console.log(pc.green('\n  XIAO Assistant - AI-powered development tools for Seeed Studio XIAO\n'));
    console.log('  Commands:');
    console.log(`    ${pc.cyan('xiao init')}          - Initialize a new XIAO project`);
    console.log(`    ${pc.cyan('xiao pinout <board>')} - Show pinout diagram for a board`);
    console.log(`    ${pc.cyan('xiao boards')}        - List all supported XIAO boards`);
    console.log(`    ${pc.cyan('xiao search <query>')} - Search examples and docs`);
    console.log(`    ${pc.cyan('xiao example <name>')} - Show a code example`);
    console.log(`    ${pc.cyan('xiao knowledge')}     - Launch knowledge editor web UI`);
    console.log(`\n  Example: ${pc.yellow('xiao pinout esp32c3')}`);
    console.log(`  Example: ${pc.yellow('xiao search wifi --lang arduino')}`);
    console.log(`  Example: ${pc.yellow('xiao example blink-arduino')}\n`);
  });

registerInitCommand(program);
registerPinoutCommand(program);
registerBoardsCommand(program);
registerSearchCommand(program);
registerExampleCommand(program);
registerKnowledgeCommand(program);

program.parse();
