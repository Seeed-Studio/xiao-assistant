import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { XIAOBoard } from './types.js';

/**
 * Shared arduino-cli compile layer used by `xiao verify` (CLI) and the MCP
 * compile_sketch tool. Compilation is the one place this package executes an
 * external binary: inputs are bounded and each run gets a temp sketch dir
 * that is removed afterwards. On timeout only the direct arduino-cli child is
 * killed - compiler grandchildren may run to completion on their own.
 */

export interface FqbnResolution {
  fqbn: string | undefined;
  /** true when found via `arduino-cli board listall` on the user's cores */
  discovered: boolean;
  /** human-readable hint when nothing resolved */
  hint: string;
}

export function resolveFqbn(board: XIAOBoard, cliPath: string): FqbnResolution {
  if (board.fqbn) {
    return { fqbn: board.fqbn, discovered: false, hint: 'verified board data' };
  }
  const listall = spawnSync(cliPath, ['board', 'listall', board.name], { encoding: 'utf-8' });
  if (listall.status === 0) {
    const rows = (listall.stdout ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+/.test(l));
    const firstName = board.name.toLowerCase().split(' ')[0] ?? board.id;
    const hit = rows.find((l) => l.toLowerCase().includes(firstName));
    const fromRow = (hit ?? rows[0])?.match(/([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)/)?.[1];
    if (fromRow) {
      return { fqbn: fromRow, discovered: true, hint: 'discovered from installed cores' };
    }
  }
  return {
    fqbn: undefined,
    discovered: false,
    hint: `install the board's core (xiao quickstart ${board.id}), then retry - FQBN discovery uses YOUR installed cores`,
  };
}

export interface CompileResult {
  ok: boolean;
  fqbn: string;
  discovered: boolean;
  /** e.g. "Sketch uses 34100 bytes (13%)..." */
  sizeLine?: string;
  /** bounded compiler error lines (max 6, each truncated) */
  errors: string[];
}

export function compileSketch(opts: {
  board: XIAOBoard;
  sketchName: string;
  code: string;
  cliPath: string;
  timeoutMs?: number;
}): CompileResult {
  const resolution = resolveFqbn(opts.board, opts.cliPath);
  if (!resolution.fqbn) {
    return {
      ok: false,
      fqbn: '',
      discovered: false,
      errors: [`No FQBN for ${opts.board.fullName}: ${resolution.hint}`],
    };
  }

  const dir = mkdtempSync(join(tmpdir(), 'xiao-compile-'));
  const safeName = opts.sketchName.replace(/[^a-zA-Z0-9_-]/g, '-') || 'sketch';
  try {
    const sketchDir = join(dir, safeName);
    mkdirSync(sketchDir, { recursive: true });
    writeFileSync(join(sketchDir, `${safeName}.ino`), opts.code);
    const res = spawnSync(opts.cliPath, ['compile', '--fqbn', resolution.fqbn, safeName], {
      cwd: dir,
      encoding: 'utf-8',
      timeout: opts.timeoutMs ?? 120_000,
    });
    if (res.error) {
      // Distinguish the two real-world failures: timeout (first builds
      // download toolchains and legitimately take minutes) vs binary missing.
      // ETIMEDOUT previously fell into the "install arduino-cli" branch.
      const code = (res.error as NodeJS.ErrnoException).code;
      const msg =
        code === 'ETIMEDOUT'
          ? `compile timed out after ${opts.timeoutMs ?? 120_000} ms - first builds download toolchains and can take minutes, retry`
          : `arduino-cli failed to start (${res.error.message}). Install it from https://arduino.github.io/arduino-cli/ and make sure it is on PATH.`;
      return {
        ok: false,
        fqbn: resolution.fqbn,
        discovered: resolution.discovered,
        errors: [msg],
      };
    }
    const out = (res.stdout ?? '') + (res.stderr ?? '');
    const sizeLine = out.split('\n').find((l) => l.includes('Sketch uses'));
    if (res.status === 0) {
      return {
        ok: true,
        fqbn: resolution.fqbn,
        discovered: resolution.discovered,
        sizeLine: sizeLine?.trim(),
        errors: [],
      };
    }
    const errs = out
      .split('\n')
      // 错误/失败: Chinese-only compiler error lines were dropped entirely
      .filter((l) => /error|Error|fatal|timed out|错误|失败/.test(l))
      .slice(0, 6)
      // Code-point-safe truncation: slicing UTF-16 units can split an emoji
      // surrogate pair and emit U+FFFD (found by adversarial audit).
      .map((l) => Array.from(l.trim()).slice(0, 200).join(''));
    return {
      ok: false,
      fqbn: resolution.fqbn,
      discovered: resolution.discovered,
      errors: errs.length > 0 ? errs : ['compile failed (no error lines captured)'],
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
