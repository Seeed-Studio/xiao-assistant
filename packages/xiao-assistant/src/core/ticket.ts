import type { XIAOAssistant } from './assistant.js';
import type { XIAOTroubleshootEntry, XIAOKnowledge } from './types.js';

/**
 * Ticket diagnosis: turn a whole pasted support ticket (mixed prose + logs,
 * Chinese or English) into a triaged diagnosis and a ready-to-send reply.
 *
 * The naive approach - searching with the full blob - drowns the signal
 * (esptool logs hit WiFi entries, panic logs hit camera entries). Instead we
 * first extract fingerprints (board, SKU, error classes), then query the
 * knowledge sources with those.
 */

export type TriageLevel = 'L1-selfserve' | 'L2-need-info' | 'L3-hardware';

export interface TicketAnalysis {
  detectedBoards: string[];
  detectedSkus: string[];
  fingerprints: string[];
  triage: TriageLevel;
  matches: {
    troubleshooting: XIAOTroubleshootEntry[];
    knowledge: XIAOKnowledge[];
  };
  /** Chinese, ready to paste back to the customer */
  reply: string;
  followUp: string[];
}

/** Regex fingerprints, ordered; first match of a class wins for queries. */
const FINGERPRINTS: Array<{ id: string; label: string; re: RegExp; query: string }> = [
  {
    id: 'esp-connect-failed',
    label: '上传时连接开发板失败(卡 Connecting / Failed to connect)',
    re: /A fatal error occurred[^\n]*Failed to connect|Failed to connect to ESP32|Connecting[.\s_]{12,}|espcomm_(open|failed)|上传.{0,6}失败|烧录.{0,6}失败|刷机.{0,6}失败|一直\s*卡|卡在?\s*connecting|连不上开发板/i,
    query: 'upload fails connecting timeout',
  },
  {
    id: 'compile-error',
    label: '编译错误(identifier 未声明 / 缺头文件)',
    re: /was not declared in this scope|compilation (error|terminated)|No such file or directory[^\n]*\.h|编译错误|编译不过/i,
    query: 'compile error not declared',
  },
  {
    id: 'runtime-crash',
    label: '运行时崩溃(panic / watchdog / 反复重启)',
    re: /Guru Meditation|rst:0x|panic|watchdog|backtrace|反复重启|一直重启|死机/i,
    query: 'crash reboot watchdog reset',
  },
  {
    id: 'port-missing',
    label: '串口不出现 / 找不到设备',
    re: /no serial port|port not found|could not open port|找不到串口|没有串口|识别不到设备|unknown device/i,
    query: 'no serial port device not detected driver',
  },
  {
    id: 'port-permission',
    label: '串口权限/占用(Linux)',
    re: /permission denied|device or resource busy|access denied|串口被占用|没有权限/i,
    query: 'permission denied port busy',
  },
  {
    id: 'wifi-issue',
    label: 'WiFi 连接问题',
    re: /wifi[^\n]{0,40}(fail|error|disconnect|not connect)|wlcm|wifi\s*连不上|无线连不上/i,
    query: 'wifi not connecting',
  },
  {
    id: 'flash-ok-dead',
    label: '上传成功但没反应',
    re: /upload (succeed|success|ok)[^\n]{0,40}(but|nothing|no)|烧录成功[^\n]{0,20}(没|不)|上传成功[^\n]{0,20}(没|不)/i,
    query: 'upload success but nothing runs',
  },
];

/** Hardware-safety signals escalate straight to L3 - never advise self-fix. */
const HARDWARE_SIGNALS =
  /发烫|过热|烫手|hot to touch|冒烟|smoke|烧(了|毁|焦)|burnt|大电流|short\s*circuit|短路|鼓包|swollen|battery (leak|swollen)|漏液/i;

const SKU_RE = /\b\d{9}\b/;

export function analyzeTicket(rawText: string, assistant: XIAOAssistant): TicketAnalysis {
  const text = rawText.trim();

  // 1) Board detection: exact ids/names, plus SKU cross-check against data.
  const detectedBoards: string[] = [];
  for (const board of assistant.getAllBoards()) {
    const idNoSep = board.id.replace(/-/g, '');
    const tokens = [
      board.id.toLowerCase(),
      idNoSep,
      board.name.toLowerCase(),
      board.fullName.toLowerCase(),
    ];
    if (tokens.some((t) => text.toLowerCase().includes(t))) {
      detectedBoards.push(board.id);
    }
  }
  const detectedSkus = text.match(new RegExp(SKU_RE, 'g')) ?? [];
  for (const sku of detectedSkus) {
    for (const b of assistant.getAllBoards()) {
      if (String(b.sku) === sku && !detectedBoards.includes(b.id)) detectedBoards.push(b.id);
    }
  }
  // Multiple boards detected (e.g. a ticket quoting both an S3 and a C3):
  // filtering by the first one misattributed wiki links (found by audit) -
  // query unfiltered and let the reply name both boards.
  const board = detectedBoards.length === 1 ? detectedBoards[0] : undefined;

  // 2) Fingerprint extraction.
  const fingerprints = FINGERPRINTS.filter((f) => f.re.test(text));
  const hardwareFlag = HARDWARE_SIGNALS.test(text);

  // 3) Query with fingerprints (not the blob), filtered by detected board.
  const troubleshooting: XIAOTroubleshootEntry[] = [];
  const knowledge: XIAOKnowledge[] = [];
  for (const fp of fingerprints.slice(0, 2)) {
    for (const e of assistant.troubleshoot(fp.query, board)) {
      if (!troubleshooting.some((x) => x.id === e.id)) troubleshooting.push(e);
    }
    for (const k of assistant.searchKnowledge(fp.query, board ? { board } : undefined)) {
      if (!knowledge.some((x) => x.id === k.id)) knowledge.push(k);
    }
  }

  // 4) Triage.
  let triage: TriageLevel = 'L2-need-info';
  if (hardwareFlag) triage = 'L3-hardware';
  else if (troubleshooting.length > 0 || knowledge.length > 0) triage = 'L1-selfserve';

  // 5) Reply + follow-ups.
  const reply = buildReply({
    fingerprints,
    troubleshooting,
    knowledge,
    triage,
    board,
    detectedBoards,
  });
  const followUp = buildFollowUp({ fingerprints, board, detectedBoards });

  return {
    detectedBoards,
    detectedSkus,
    fingerprints: fingerprints.map((f) => f.id),
    triage,
    matches: { troubleshooting: troubleshooting.slice(0, 3), knowledge: knowledge.slice(0, 2) },
    reply,
    followUp,
  };
}

function buildReply(ctx: {
  fingerprints: Array<{ id: string; label: string }>;
  detectedBoards?: string[];
  troubleshooting: XIAOTroubleshootEntry[];
  knowledge: XIAOKnowledge[];
  triage: TriageLevel;
  board?: string;
}): string {
  if (ctx.triage === 'L3-hardware') {
    return [
      '您好,根据您描述的情况(设备发烫/异常电流/疑似短路),这属于硬件安全风险,请立即:',
      '1. 断开 USB 与电池供电,不要再通电尝试',
      '2. 检查外围接线是否有短路(尤其 5V/VBUS 与 GND、裸露引脚相碰)',
      '3. 拍照(板子正反面 + 接线)提交售后工单申请检测/更换(RMA)',
      '',
      '为避免误判,请勿在故障排除前继续烧录或通电。给您带来不便非常抱歉,我们会尽快处理。',
    ].join('\n');
  }

  const lines: string[] = ['您好,感谢您的反馈。根据日志分析:'];
  if (ctx.detectedBoards && ctx.detectedBoards.length > 1) {
    lines.push(`检测到多个板型(${ctx.detectedBoards.join('、')}),以下步骤请按您的板型选择适用项。`);
  }
  if (ctx.fingerprints.length > 0) {
    lines.push(`问题定位:${ctx.fingerprints.map((f) => f.label).join(' + ')}`);
  }
  const steps: string[] = [];
  for (const e of ctx.troubleshooting.slice(0, 2)) {
    for (const s of e.solutions.slice(0, 3)) steps.push(s);
  }
  for (const k of ctx.knowledge.slice(0, 1)) {
    steps.push(k.solution);
  }
  if (steps.length > 0) {
    lines.push('', '建议按以下步骤处理:');
    steps.slice(0, 5).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  } else {
    lines.push('', '暂未能自动定位到已知问题,我们已记录您的案例并会人工跟进。');
  }
  const wikis = [
    ...ctx.troubleshooting
      .slice(0, 2)
      .map((e) => e.wikiUrl)
      .filter((u): u is string => !!u),
  ];
  if (wikis.length > 0) lines.push('', `参考文档:${[...new Set(wikis)].join(' , ')}`);
  return lines.join('\n');
}

function buildFollowUp(ctx: {
  fingerprints: Array<{ id: string }>;
  board?: string;
  detectedBoards: string[];
}): string[] {
  const qs: string[] = [];
  if (!ctx.board) qs.push('您使用的是哪一款 XIAO 板?(板子丝印或购买链接)');
  if (ctx.fingerprints.some((f) => f.id === 'esp-connect-failed')) {
    qs.push('上传时 IDE 底部完整报错文本(截图或复制全文)');
    qs.push('操作系统,以及使用的 USB 线是否确认支持数据传输');
  }
  if (ctx.fingerprints.length === 0) {
    qs.push('问题现象的具体描述:什么时候发生、报错原文、期望行为');
  }
  return qs;
}
