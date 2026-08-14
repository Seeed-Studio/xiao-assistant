import { Command } from 'commander';
import pc from 'picocolors';
import { XIAOAssistant } from '../core/assistant.js';

export function registerBoardsCommand(program: Command) {
  program
    .command('boards')
    .description('List all supported XIAO boards')
    .action(() => {
      const assistant = new XIAOAssistant();
      const boards = assistant.getAllBoards();

      console.log(pc.cyan('\n  Supported XIAO Boards\n'));
      // Column widths include the trailing space each cell renders with.
      const W = { name: 21, mcu: 18, conn: 15, feat: 33 };
      console.log(
        `  ┌${'─'.repeat(W.name)}┬${'─'.repeat(W.mcu)}┬${'─'.repeat(W.conn)}┬${'─'.repeat(W.feat)}┐`
      );
      console.log(
        `  │ ${'Board'.padEnd(W.name - 1)}│ ${'MCU'.padEnd(W.mcu - 1)}│ ${'Connectivity'.padEnd(W.conn - 1)}│ ${'Key Features'.padEnd(W.feat - 1)}│`
      );
      console.log(
        `  ├${'─'.repeat(W.name)}┼${'─'.repeat(W.mcu)}┼${'─'.repeat(W.conn)}┼${'─'.repeat(W.feat)}┤`
      );

      for (const board of boards) {
        const name = board.name.padEnd(W.name - 1).slice(0, W.name - 1);
        const mcu = board.microcontroller.padEnd(W.mcu - 1).slice(0, W.mcu - 1);
        const conn = ((board.connectivity[0] ?? 'N/A').split(' ')[0] ?? 'N/A')
          .padEnd(W.conn - 1)
          .slice(0, W.conn - 1);
        const feat = (board.builtinSensors[0] ?? board.features[0] ?? 'Basic')
          .padEnd(W.feat - 1)
          .slice(0, W.feat - 1);
        console.log(`  │ ${pc.cyan(name)}│ ${mcu}│ ${conn}│ ${feat}│`);
      }

      console.log(
        `  └${'─'.repeat(W.name)}┴${'─'.repeat(W.mcu)}┴${'─'.repeat(W.conn)}┴${'─'.repeat(W.feat)}┘`
      );
      console.log(pc.yellow(`\n  Total: ${boards.length} boards\n`));
      console.log(pc.dim('  Use "xiao pinout <board-id>" for detailed pinout information'));
    });
}
