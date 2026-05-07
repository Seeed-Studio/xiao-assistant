import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '@seeedstudio/xiao-sdk';

export function registerPinoutCommand(program: Command) {
  program
    .command('pinout <board>')
    .description('Show pinout diagram for a XIAO board')
    .action((board: string) => {
      const assistant = new XIAOAssistant();
      try {
        const pinout = assistant.getPinout(board);
        console.log(pinout);
      } catch (err: any) {
        console.error(pc.red(err.message));
        const boards = assistant.getAllBoards();
        console.log(pc.yellow('\nAvailable boards:'));
        for (const b of boards) {
          console.log(`  - ${pc.cyan(b.id)} (${b.name})`);
        }
      }
    });
}
