import type { XIAOBoard, XIAOExample, XIAODocument } from './types.js';
import { allBoards } from './boards/index.js';
import { allExamples } from './examples/index.js';
import { allDocuments } from './docs/index.js';

export class XIAOAssistant {
  private boards: Map<string, XIAOBoard> = new Map();
  private examples: XIAOExample[];
  private documents: XIAODocument[];

  constructor() {
    for (const board of allBoards) {
      this.boards.set(board.id, board);
    }
    this.examples = allExamples;
    this.documents = allDocuments;
  }

  getBoard(boardName: string): XIAOBoard | undefined {
    const normalized = boardName.toLowerCase().replace(/[\s_-]/g, '');
    if (this.boards.has(normalized)) return this.boards.get(normalized);

    for (const [id, board] of this.boards) {
      if (
        board.name.toLowerCase().includes(normalized) ||
        board.fullName.toLowerCase().includes(normalized) ||
        board.microcontroller.toLowerCase().includes(normalized)
      ) {
        return board;
      }
    }
    return undefined;
  }

  getAllBoards(): XIAOBoard[] {
    return Array.from(this.boards.values());
  }

  resolveBoard(query: string): XIAOBoard[] {
    const q = query.toLowerCase();
    const results: Array<{ board: XIAOBoard; score: number }> = [];

    for (const board of this.boards.values()) {
      let score = 0;
      const fields = [
        board.id, board.name, board.fullName, board.microcontroller,
        board.architecture, ...board.features, ...board.connectivity,
        ...board.builtinSensors,
      ].map((f) => f.toLowerCase());

      for (const field of fields) {
        if (field === q) score += 10;
        else if (field.includes(q)) score += 5;
      }

      for (const word of q.split(/\s+/)) {
        for (const field of fields) {
          if (field.includes(word)) score += 2;
        }
      }

      if (score > 0) results.push({ board, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.board);
  }

  searchExamples(query: string, options?: { language?: string; board?: string }): XIAOExample[] {
    const q = query.toLowerCase();
    const results: Array<{ example: XIAOExample; score: number }> = [];

    for (const example of this.examples) {
      if (options?.language && example.language !== options.language) continue;
      if (options?.board && !example.boards.includes(options.board)) continue;

      let score = 0;
      const fields = [
        example.title, example.description, example.category,
        ...example.boards, ...(example.requirements ?? []),
      ].map((f) => f.toLowerCase());

      for (const field of fields) {
        if (field.includes(q)) score += 5;
      }

      for (const word of q.split(/\s+/)) {
        for (const field of fields) {
          if (field.includes(word)) score += 2;
        }
      }

      if (score > 0) results.push({ example, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.example);
  }

  getExampleById(id: string): XIAOExample | undefined {
    return this.examples.find((e) => e.id === id);
  }

  getAllExamples(): XIAOExample[] {
    return this.examples;
  }

  getPinout(boardName: string): string {
    const board = this.getBoard(boardName);
    if (!board) {
      throw new Error(`Board "${boardName}" not found. Available: ${this.boards.keys().toArray().join(', ')}`);
    }

    const lines: string[] = [
      `╔══════════════════════════════════════════════╗`,
      `║  ${board.fullName.padEnd(42)}  ║`,
      `║  ${board.microcontroller} @ ${board.clockSpeed}`.padEnd(47) + '║',
      `╠══════════════════════════════════════════════╣`,
      `║  SPECIFICATIONS`,
      `║  Flash: ${board.flashSize}`,
      `║  RAM:   ${board.ramSize}`,
      `║  Arch:  ${board.architecture}`,
      `║  Power: ${board.lowPowerMode}`,
      `╠══════════════════════════════════════════════╣`,
      `║  PINS`,
      `║  Digital: ${board.pins.digital.join(', ')}`,
      `║  Analog:  ${board.pins.analog.join(', ')}`,
      `║  PWM:     ${board.pins.pwm.join(', ')}`,
    ];

    const i2c = board.pins.i2c[0];
    if (i2c) {
      lines.push(`║  I2C:     SDA=${i2c.sda}, SCL=${i2c.scl}`);
    }
    const spi = board.pins.spi[0];
    if (spi) {
      lines.push(`║  SPI:     MOSI=${spi.mosi}, MISO=${spi.miso}, SCK=${spi.sck}, CS=${spi.cs}`);
    }
    const uart = board.pins.uart[0];
    if (uart) {
      lines.push(`║  UART:    TX=${uart.tx}, RX=${uart.rx}`);
    }

    lines.push(
      `╠══════════════════════════════════════════════╣`,
      `║  CONNECTIVITY: ${board.connectivity.join(', ') || 'None'}`,
      `║  SENSORS:      ${board.builtinSensors.join(', ') || 'None'}`,
      `║  FEATURES:     ${board.features.join(', ')}`,
      `║  LANGUAGES:    ${board.supportedLanguages.join(', ')}`,
      `╠══════════════════════════════════════════════╣`,
      `║  Wiki: ${board.wikiUrl}`,
      `╚══════════════════════════════════════════════╝`,
    );

    return lines.join('\n');
  }

  getDocuments(options?: { board?: string; category?: string }): XIAODocument[] {
    return this.documents.filter((doc) => {
      if (options?.category && doc.category !== options.category) return false;
      if (options?.board && !doc.boards.includes(options.board)) return false;
      return true;
    });
  }

  searchDocuments(query: string): XIAODocument[] {
    const q = query.toLowerCase();
    const results: Array<{ doc: XIAODocument; score: number }> = [];

    for (const doc of this.documents) {
      let score = 0;
      const text = `${doc.title} ${doc.content} ${doc.category}`.toLowerCase();
      for (const word of q.split(/\s+/)) {
        if (text.includes(word)) score += 3;
      }
      if (score > 0) results.push({ doc, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.doc);
  }

  getQuickstart(boardName: string): XIAODocument | undefined {
    return this.documents.find((d) => d.category === 'getting-started' && d.boards.includes(boardName));
  }
}

export { type XIAOBoard, type XIAOExample, type XIAODocument, type XIAOPinConfig } from './types.js';
export default XIAOAssistant;
