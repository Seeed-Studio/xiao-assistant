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
