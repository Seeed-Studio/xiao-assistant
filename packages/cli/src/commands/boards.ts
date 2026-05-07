import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '@seeedstudio/xiao-sdk';

export function registerBoardsCommand(program: Command) {
  program
    .command('boards')
    .description('List all supported XIAO boards')
    .action(() => {
      const assistant = new XIAOAssistant();
      const boards = assistant.getAllBoards();

      console.log(pc.cyan('\n  Supported XIAO Boards\n'));
      console.log('  ┌─────────────────────┬──────────────────┬───────────────┬─────────────────────────────────┐');
      console.log('  │ Board                │ MCU              │ Connectivity  │ Key Features                    │');
      console.log('  ├─────────────────────┼──────────────────┼───────────────┼─────────────────────────────────┤');

      for (const board of boards) {
        const name = board.name.padEnd(20).slice(0, 20);
        const mcu = board.microcontroller.padEnd(17).slice(0, 17);
        const conn = (board.connectivity.length > 0 ? board.connectivity[0].split(' ')[0] : 'N/A').padEnd(14).slice(0, 14);
        const feat = (board.builtinSensors.length > 0 ? board.builtinSensors[0] : board.features[0] || 'Basic').padEnd(32).slice(0, 32);
        console.log(`  │ ${pc.cyan(name)} │ ${mcu} │ ${conn} │ ${feat} │`);
      }

      console.log('  └─────────────────────┴──────────────────┴───────────────┴─────────────────────────────────┘');
      console.log(pc.yellow(`\n  Total: ${boards.length} boards\n`));
      console.log(pc.dim('  Use "xiao pinout <board-id>" for detailed pinout information'));
    });
}
