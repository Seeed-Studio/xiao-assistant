import type { XIAOBoard, XIAOExample, XIAODocument, XIAOTroubleshootEntry, WikiSearchResult, XIAOKnowledge } from './types.js';
import { loadBoards, loadExamples, loadDocuments, loadTroubleshootEntries, loadSynonyms, loadKnowledge } from './data-loader.js';
import { searchWiki } from './wiki-service.js';

export class XIAOAssistant {
  private boards: Map<string, XIAOBoard> = new Map();
  private examples: XIAOExample[];
  private documents: XIAODocument[];
  private troubleshootEntries: XIAOTroubleshootEntry[];
  private knowledge: XIAOKnowledge[];
  private synonyms: Record<string, string[]>;

  constructor() {
    for (const board of loadBoards()) {
      this.boards.set(board.id, board);
    }
    this.examples = loadExamples();
    this.documents = loadDocuments();
    this.troubleshootEntries = loadTroubleshootEntries();
    this.knowledge = loadKnowledge();
    this.synonyms = loadSynonyms();
  }

  // --- Board methods ---

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

  // --- Example methods ---

  searchExamples(query: string, options?: { language?: string; board?: string }): XIAOExample[] {
    const q = query.toLowerCase();
    const expanded = this.expandQuery(q);
    const results: Array<{ example: XIAOExample; score: number }> = [];

    for (const example of this.examples) {
      if (options?.language && example.language !== options.language) continue;
      if (options?.board && !example.boards.includes(options.board)) continue;

      let score = 0;
      const fields = [
        example.title, example.description, example.category,
        ...example.boards, ...(example.requirements ?? []),
      ].map((f) => f.toLowerCase());
      const tags = (example.tags ?? []).map((t) => t.toLowerCase());

      for (const field of fields) {
        if (field.includes(q)) score += 5;
      }

      for (const tag of tags) {
        if (tag === q || q.includes(tag)) score += 5;
      }

      for (const term of expanded) {
        for (const field of fields) {
          if (field.includes(term)) score += 3;
        }
        for (const tag of tags) {
          if (tag === term || tag.includes(term)) score += 3;
        }
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

  // --- Pinout ---

  getPinout(boardName: string): string {
    const board = this.getBoard(boardName);
    if (!board) {
      throw new Error(`Board "${boardName}" not found. Available: ${Array.from(this.boards.keys()).join(', ')}`);
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

  // --- Document methods ---

  getDocuments(options?: { board?: string; category?: string }): XIAODocument[] {
    return this.documents.filter((doc) => {
      if (options?.category && doc.category !== options.category) return false;
      if (options?.board && !doc.boards.includes(options.board)) return false;
      return true;
    });
  }

  searchDocuments(query: string): XIAODocument[] {
    const q = query.toLowerCase();
    const expanded = this.expandQuery(q);
    const results: Array<{ doc: XIAODocument; score: number }> = [];

    for (const doc of this.documents) {
      let score = 0;
      const text = `${doc.title} ${doc.content} ${doc.category}`.toLowerCase();
      for (const word of q.split(/\s+/)) {
        if (text.includes(word)) score += 3;
      }
      for (const term of expanded) {
        if (text.includes(term)) score += 2;
      }
      if (score > 0) results.push({ doc, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.doc);
  }

  getQuickstart(boardName: string): XIAODocument | undefined {
    return this.documents.find((d) => d.category === 'getting-started' && d.boards.includes(boardName));
  }

  // --- Troubleshoot ---

  troubleshoot(symptoms: string, board?: string): XIAOTroubleshootEntry[] {
    const q = symptoms.toLowerCase();
    const expanded = this.expandQuery(q);
    const results: Array<{ entry: XIAOTroubleshootEntry; score: number }> = [];

    for (const entry of this.troubleshootEntries) {
      if (board && !entry.boards.includes(board)) continue;

      let score = 0;
      const symptomTexts = entry.symptoms.map((s) => s.toLowerCase());
      const allText = [...symptomTexts, entry.category.toLowerCase(), entry.title.toLowerCase()];

      for (const text of allText) {
        if (q.includes(text) || text.includes(q)) score += 5;
      }

      for (const word of q.split(/\s+/)) {
        for (const text of allText) {
          if (text.includes(word)) score += 2;
        }
        for (const symptom of symptomTexts) {
          if (symptom.includes(word)) score += 3;
        }
      }

      for (const term of expanded) {
        for (const text of allText) {
          if (text.includes(term)) score += 2;
        }
      }

      if (score > 0) results.push({ entry, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.entry);
  }

  // --- Wiki search ---

  async searchWikiOnline(query: string): Promise<WikiSearchResult[]> {
    return searchWiki(query);
  }

  // --- Knowledge search ---

  searchKnowledge(query: string, options?: { board?: string; severity?: string }): XIAOKnowledge[] {
    const q = query.toLowerCase();
    const expanded = this.expandQuery(q);
    const results: Array<{ entry: XIAOKnowledge; score: number }> = [];

    for (const entry of this.knowledge) {
      if (options?.board && !entry.boards.includes(options.board)) continue;
      if (options?.severity && entry.severity !== options.severity) continue;

      let score = 0;
      const tags = entry.tags.map((t) => t.toLowerCase());
      const fields = [entry.title, entry.summary, entry.problem, entry.solution, entry.category].map((f) => f.toLowerCase());

      for (const field of fields) {
        if (field.includes(q)) score += 5;
      }
      for (const tag of tags) {
        if (tag === q || q.includes(tag)) score += 5;
      }

      for (const term of expanded) {
        for (const field of fields) {
          if (field.includes(term)) score += 3;
        }
        for (const tag of tags) {
          if (tag === term || tag.includes(term)) score += 3;
        }
      }

      for (const word of q.split(/\s+/)) {
        for (const field of fields) {
          if (field.includes(word)) score += 2;
        }
      }

      if (score > 0) results.push({ entry, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.entry);
  }

  // --- Fallback methods ---

  async searchExamplesWithFallback(
    query: string,
    options?: { language?: string; board?: string },
  ): Promise<{ local: XIAOExample[]; wiki: WikiSearchResult[] }> {
    const local = this.searchExamples(query, options);
    if (local.length > 0) return { local, wiki: [] };

    const wiki = await searchWiki(query);
    return { local, wiki };
  }

  async searchDocumentsWithFallback(query: string): Promise<{ local: XIAODocument[]; wiki: WikiSearchResult[] }> {
    const local = this.searchDocuments(query);
    if (local.length > 0) return { local, wiki: [] };

    const wiki = await searchWiki(query);
    return { local, wiki };
  }

  // --- Private helpers ---

  private expandQuery(query: string): string[] {
    const terms: string[] = [];
    const words = query.split(/\s+/);

    for (const word of words) {
      for (const [keyword, synonyms] of Object.entries(this.synonyms)) {
        if (word === keyword || synonyms.includes(word)) {
          terms.push(keyword, ...synonyms);
        }
      }
    }

    return [...new Set(terms)];
  }
}

export { type XIAOBoard, type XIAOExample, type XIAODocument, type XIAOTroubleshootEntry, type WikiSearchResult, type XIAOKnowledge } from './types.js';
export default XIAOAssistant;
