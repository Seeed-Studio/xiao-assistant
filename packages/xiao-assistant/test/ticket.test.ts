import { describe, it, expect } from 'vitest';
import { analyzeTicket } from '../src/core/ticket.js';
import { XIAOAssistant } from '../src/core/assistant.js';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const assistant = new XIAOAssistant();

// Real-world samples (shaped by the adversarial verification rounds, where the
// naive full-blob search misrouted all three of these).
const SAMPLES = {
  espUpload: `我的 XIAO ESP32C3(SKU 113991054)上传程序失败,IDE 一直显示:
Connecting........_____.....____
A fatal error occurred: Failed to connect to ESP32-C3.`,
  panic: `ESP32S3 crashes every few minutes:
Guru Meditation Error: Core 1 panic'ed (StoreProhibited).
rst:0x1 (POWERON)`,
  hotBoard: '板子发烫,USB 电流很大,担心短路了',
  compile: "esp32c3 sketch fails: 'LED_BUILTIN' was not declared in this scope",
  nothing: '你好,我想问一下这个产品什么时候发货',
};

describe('analyzeTicket', () => {
  it('extracts board + SKU + upload fingerprint, triages L1', () => {
    const a = analyzeTicket(SAMPLES.espUpload, assistant);
    expect(a.detectedBoards).toContain('esp32c3');
    expect(a.detectedSkus).toContain('113991054');
    expect(a.fingerprints).toContain('esp-connect-failed');
    expect(a.triage).toBe('L1-selfserve');
    expect(a.matches.troubleshooting.map((e) => e.id)).toContain('upload-timeout');
    expect(a.reply).toContain('建议按以下步骤处理');
  });

  it('panic logs route to runtime-crash, not camera/display', () => {
    const a = analyzeTicket(SAMPLES.panic, assistant);
    expect(a.detectedBoards).toContain('esp32s3');
    expect(a.fingerprints).toContain('runtime-crash');
    expect(a.triage).toBe('L1-selfserve');
  });

  it('hardware signals escalate to L3 with a safety-first reply', () => {
    const a = analyzeTicket(SAMPLES.hotBoard, assistant);
    expect(a.triage).toBe('L3-hardware');
    expect(a.reply).toContain('断开');
    expect(a.reply).not.toContain('建议按以下步骤处理'); // never self-fix advice
  });

  it('compile errors surface the LED_BUILTIN knowledge', () => {
    const a = analyzeTicket(SAMPLES.compile, assistant);
    expect(a.fingerprints).toContain('compile-error');
    expect(a.triage).not.toBe('L3-hardware');
  });

  it('no fingerprints -> L2 with follow-up questions', () => {
    const a = analyzeTicket(SAMPLES.nothing, assistant);
    expect(a.triage).toBe('L2-need-info');
    expect(a.followUp.length).toBeGreaterThan(0);
  });
});

describe('query log (records loop)', () => {
  it('records accumulate and stats expose zero-hit + entry hits', async () => {
    const home = join('/tmp', 'xiao-log-test-' + Math.random().toString(36).slice(2));
    process.env.XIAO_HOME = home;
    const { recordQuery, readStats } = await import('../src/core/query-log.js');
    recordQuery({ tool: 'search', query: '蓝牙', hits: 3, matched: ['blink-arduino'] });
    recordQuery({ tool: 'search', query: 'zzz-no-match', hits: 0, matched: [] });
    recordQuery({ tool: 'search', query: 'zzz-no-match', hits: 0, matched: [] });
    recordQuery({ tool: 'ticket', query: 'esp-connect-failed', hits: 2, matched: ['upload-timeout'] });
    const s = readStats();
    expect(s.total).toBe(4);
    expect(s.byTool.search).toBe(3);
    expect(s.zeroHit[0]?.query).toContain('zzz-no-match');
    expect(s.zeroHit[0]?.count).toBe(2);
    expect(s.entryHits).toContainEqual({ id: 'upload-timeout', count: 1 });
    delete process.env.XIAO_HOME;
    rmSync(home, { recursive: true, force: true });
  });
});

describe('audit-fix regressions (phase-2 adversarial audit)', () => {
  it('multi-board tickets do not filter by the first board', () => {
    const a = analyzeTicket(
      'ESP32S3 upload failure: Failed to connect. Also my ESP32C3 wifi does not connect.',
      assistant
    );
    expect(a.detectedBoards.length).toBe(2);
    expect(a.reply).toContain('多个板型');
  });

  it('Chinese upload phrasings hit the connect-failed fingerprint', () => {
    for (const text of ['上传总是失败', '一直卡在 Connecting', '烧录一直失败']) {
      const a = analyzeTicket(text, assistant);
      expect(a.fingerprints, text).toContain('esp-connect-failed');
    }
  });

  it('code-point-safe error truncation (no U+FFFD)', async () => {
    const { compileSketch } = await import('../src/core/compiler.js');
    // fake cli emitting an error line with an emoji at the cut boundary
    const fs = await import('node:fs');
    const fake = '/tmp/fake-err-cli.sh';
    fs.writeFileSync(
      fake,
      '#!/bin/bash\necho "error: ' + 'x'.repeat(150) + '🎉🎉🎉 broken line"\nexit 1\n',
      { mode: 0o755 }
    );
    const board = assistant.getBoard('samd21');
    if (!board) throw new Error('no board');
    const res = compileSketch({ board, sketchName: 't', code: 'void setup(){}', cliPath: fake });
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).not.toContain('�');
  });

  it('readStats survives a directory at the log path and malformed lines', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const home = '/tmp/xiao-audit-fix-' + Math.random().toString(36).slice(2);
    process.env.XIAO_HOME = home;
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(path.join(home, 'query-log.jsonl')); // directory at log path
    const { readStats } = await import('../src/core/query-log.js');
    const s1 = readStats(); // must not throw
    expect(s1.total).toBe(0);
    fs.rmdirSync(path.join(home, 'query-log.jsonl'));
    fs.writeFileSync(
      path.join(home, 'query-log.jsonl'),
      '[not-a-record]\n' + JSON.stringify({ tool: 'search', query: '蓝牙', hits: 1, matched: [] }) + '\n'
    );
    const s2 = readStats();
    expect(s2.total).toBe(1);
    expect(s2.byTool.search).toBe(1);
    delete process.env.XIAO_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  });
});

describe('compile timeout branch (audit fix)', () => {
  it('reports a real timeout message instead of "install arduino-cli"', async () => {
    const { compileSketch } = await import('../src/core/compiler.js');
    const fs = await import('node:fs');
    const fake = '/tmp/fake-slow-cli.sh';
    fs.writeFileSync(fake, '#!/bin/bash\nsleep 30\n', { mode: 0o755 });
    const board = assistant.getBoard('samd21');
    if (!board) throw new Error('no board');
    const res = compileSketch({
      board,
      sketchName: 't',
      code: 'void setup(){}',
      cliPath: fake,
      timeoutMs: 600,
    });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/timed out after 600 ms/);
    expect(res.errors[0]).not.toMatch(/Install it/);
    fs.rmSync(fake);
  });
});
