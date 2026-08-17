import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync } from 'node:fs';
import { XIAOAssistant } from '../core/assistant.js';
import { analyzeTicket } from '../core/ticket.js';
import { recordQuery } from '../core/query-log.js';

/**
 * `xiao ticket` - paste a whole support ticket (logs + prose, zh/en), get a
 * triaged diagnosis and a ready-to-send reply. Local pure function: no ticket
 * system integration lives here; paste in, copy the reply out.
 */
export function registerTicketCommand(program: Command) {
  program
    .command('ticket [text...]')
    .description('Diagnose a pasted support ticket and draft a customer reply')
    .option('-f, --file <path>', 'read the ticket from a file instead of an argument')
    .usage(
      'xiao ticket "整段工单文本..." | xiao ticket -f ticket.txt | cat ticket.txt | xiao ticket'
    )
    .action(async (textParts: string[], options: { file?: string }) => {
      let text = textParts.join(' ');
      if (options.file) {
        try {
          text = readFileSync(options.file, 'utf-8');
        } catch (err) {
          console.error(pc.red(`Cannot read ${options.file}: ${(err as Error).message}`));
          process.exitCode = 1;
          return;
        }
      }
      if (!text.trim() && !process.stdin.isTTY) {
        text = await readStdin();
      }
      if (!text.trim()) {
        console.error(pc.red('No ticket text. Pass it as an argument, -f <file>, or pipe it in.'));
        process.exitCode = 1;
        return;
      }

      const assistant = new XIAOAssistant();
      const analysis = analyzeTicket(text, assistant);

      recordQuery({
        tool: 'ticket',
        query: analysis.fingerprints.join('+') || '(no-fingerprint)',
        board: analysis.detectedBoards[0],
        hits: analysis.matches.troubleshooting.length + analysis.matches.knowledge.length,
        matched: [
          ...analysis.matches.troubleshooting.map((e) => e.id),
          ...analysis.matches.knowledge.map((k) => k.id),
        ],
      });

      console.log(pc.cyan('\n  ═══ 工单诊断 ═══\n'));
      console.log(
        `  板卡: ${analysis.detectedBoards.length ? analysis.detectedBoards.join(', ') : pc.yellow('未识别 — 需追问')}` +
          (analysis.detectedSkus.length
            ? pc.dim(`  (SKU: ${analysis.detectedSkus.join(', ')})`)
            : '')
      );
      console.log(
        `  指纹: ${analysis.fingerprints.length ? analysis.fingerprints.join(' + ') : pc.yellow('无匹配')}`
      );
      const triageLabel: Record<string, string> = {
        'L1-selfserve': pc.green('L1 可自解(知识库命中)'),
        'L2-need-info': pc.yellow('L2 信息不足(需追问)'),
        'L3-hardware': pc.red('L3 硬件风险(停止上电,走 RMA)'),
      };
      console.log(`  分级: ${triageLabel[analysis.triage]}`);
      if (analysis.matches.troubleshooting.length + analysis.matches.knowledge.length > 0) {
        console.log(
          `  命中: ${[
            ...analysis.matches.troubleshooting.map((e) => e.id),
            ...analysis.matches.knowledge.map((k) => k.id),
          ].join(', ')}`
        );
      }

      console.log(pc.cyan('\n  ── 可发送的回复 ──\n'));
      console.log(
        analysis.reply
          .split('\n')
          .map((l) => (l.trim() ? `  ${l}` : ''))
          .join('\n')
      );

      if (analysis.followUp.length > 0) {
        console.log(pc.cyan('\n  ── 需向客户追问 ──'));
        for (const q of analysis.followUp) console.log(`    ? ${q}`);
      }
      console.log(pc.dim('\n  (诊断已记录到本地查询日志: xiao knowledge --stats 查看)\n'));
    });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    // Safety: don't hang forever on a TTY-less but empty stream.
    setTimeout(() => resolve(data), 1000);
  });
}
