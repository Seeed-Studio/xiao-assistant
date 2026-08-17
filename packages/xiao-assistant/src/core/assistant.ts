import type {
  XIAOBoard,
  XIAOExample,
  XIAODocument,
  XIAOTroubleshootEntry,
  WikiSearchResult,
  XIAOKnowledge,
} from './types.js';
import {
  loadBoards,
  loadExamples,
  loadDocuments,
  loadTroubleshootEntries,
  loadSynonyms,
  loadKnowledge,
} from './data-loader.js';
import { searchWiki } from './wiki-service.js';
import MiniSearch from 'minisearch';

type IdDoc = { id: string };

export class XIAOAssistant {
  private boards: Map<string, XIAOBoard> = new Map();
  private examples: XIAOExample[];
  private documents: XIAODocument[];
  private troubleshootEntries: XIAOTroubleshootEntry[];
  private knowledge: XIAOKnowledge[];
  private synonyms: Record<string, string[]>;

  // MiniSearch indexes: fuzzy/prefix matching beats the old substring scoring
  // (misspellings like "temprature" used to return nothing).
  private exampleIndex: MiniSearch<IdDoc>;
  private docIndex: MiniSearch<IdDoc>;
  private troubleshootIndex: MiniSearch<IdDoc>;
  private knowledgeIndex: MiniSearch<IdDoc>;

  /** Map keys must go through the same normalization as lookups, or ids like
   *  "esp32s3-sense" (normalized "esp32s3sense") would never be found. */
  private static normalizeId(id: string): string {
    return id.toLowerCase().replace(/[\s_-]/g, '');
  }

  constructor() {
    for (const board of loadBoards()) {
      this.boards.set(XIAOAssistant.normalizeId(board.id), board);
    }
    this.examples = XIAOAssistant.dedupeById(loadExamples());
    this.documents = XIAOAssistant.dedupeById(loadDocuments());
    this.troubleshootEntries = XIAOAssistant.dedupeById(loadTroubleshootEntries());
    this.knowledge = XIAOAssistant.dedupeById(loadKnowledge());
    this.synonyms = loadSynonyms();

    this.exampleIndex = new MiniSearch({
      fields: ['title', 'description', 'category', 'tags', 'boards'],
      storeFields: [],
      searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
    });
    this.exampleIndex.addAll(
      this.examples.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        tags: (e.tags ?? []).join(' '),
        boards: e.boards.join(' '),
      }))
    );

    this.docIndex = new MiniSearch({
      fields: ['title', 'content', 'category', 'boards'],
      storeFields: [],
      searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
    });
    this.docIndex.addAll(
      this.documents.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        category: d.category,
        boards: d.boards.join(' '),
      }))
    );

    this.troubleshootIndex = new MiniSearch({
      fields: ['title', 'symptoms', 'category', 'boards'],
      storeFields: [],
      searchOptions: { boost: { symptoms: 3, title: 2 }, prefix: true, fuzzy: 0.2 },
    });
    this.troubleshootIndex.addAll(
      this.troubleshootEntries.map((t) => ({
        id: t.id,
        title: t.title,
        symptoms: t.symptoms.join(' '),
        category: t.category,
        boards: t.boards.join(' '),
      }))
    );

    this.knowledgeIndex = new MiniSearch({
      fields: ['title', 'summary', 'problem', 'solution', 'tags', 'category', 'boards'],
      storeFields: [],
      searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
    });
    this.knowledgeIndex.addAll(
      this.knowledge.map((k) => ({
        id: k.id,
        title: k.title,
        summary: k.summary,
        problem: k.problem,
        solution: k.solution,
        tags: k.tags.join(' '),
        category: k.category,
        boards: k.boards.join(' '),
      }))
    );
  }

  /** Blank queries match everything; treat them as no-match. */
  private static normalizeQuery(query: string): string | null {
    const q = query.trim().toLowerCase();
    return q.length > 0 ? q : null;
  }

  /**
   * MiniSearch throws on duplicate ids, which would brick every entry point
   * (CLI/SDK/MCP) until someone hand-edits YAML. Hand-curated data WILL get
   * duplicate ids eventually; skip the later ones and keep going.
   */
  private static dedupeById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  /** Original query + synonym expansion as a multi-query (MiniSearch merges scores). */
  private searchIndex(index: MiniSearch<IdDoc>, q: string): string[] {
    const expanded = this.expandQuery(q);
    return index.search({ queries: [q, ...expanded] }).map((r) => r.id);
  }

  // --- Board methods ---

  getBoard(boardName: string): XIAOBoard | undefined {
    const normalized = XIAOAssistant.normalizeId(boardName);
    if (!normalized) return undefined; // '' is contained by every field — would match the first board
    if (this.boards.has(normalized)) return this.boards.get(normalized);

    for (const board of this.boards.values()) {
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

  /**
   * A base board and its variants form one hardware family: an example that
   * runs on the base generally runs on the variant (Sense boards are
   * supersets). Searching "--board esp32s3" should not silently drop every
   * esp32s3-sense-only example (e.g. camera).
   */
  boardGroup(boardId: string): string[] {
    const group = [boardId];
    for (const b of this.boards.values()) {
      if (b.variantOf === boardId) group.push(b.id);
    }
    return group;
  }

  resolveBoard(query: string): XIAOBoard[] {
    const q = XIAOAssistant.normalizeQuery(query);
    if (!q) return [];
    // Natural-language selection ("battery BLE <10µA", "低功耗") only works if
    // power data is indexed and synonyms (低功耗 -> deep sleep/low power) apply.
    const terms = [q, ...q.split(/\s+/), ...this.expandQuery(q)];

    const results: Array<{ board: XIAOBoard; score: number }> = [];

    for (const board of this.boards.values()) {
      let score = 0;
      const fields = [
        board.id,
        board.name,
        board.fullName,
        board.microcontroller,
        board.architecture,
        ...board.features,
        ...board.connectivity,
        ...board.builtinSensors,
        ...(board.lowPowerMode ? [board.lowPowerMode] : []),
      ].map((f) => f.toLowerCase());

      for (const term of terms) {
        for (const field of fields) {
          if (field === term) score += 10;
          else if (field.includes(term)) score += 5;
        }
      }

      if (score > 0) results.push({ board, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.board);
  }

  // --- Example methods ---

  searchExamples(query: string, options?: { language?: string; board?: string }): XIAOExample[] {
    const q = XIAOAssistant.normalizeQuery(query);
    if (!q) return [];
    const ids = this.searchIndex(this.exampleIndex, q);
    // Base-board filters widen to the board family (base + Sense variants).
    const boardGroup = options?.board ? new Set(this.boardGroup(options.board)) : null;
    const byId = new Map(this.examples.map((e) => [e.id, e]));
    return ids
      .map((id) => byId.get(id))
      .filter((e): e is XIAOExample => {
        if (!e) return false;
        if (options?.language && e.language !== options.language) return false;
        if (boardGroup && !e.boards.some((b) => boardGroup.has(b))) return false;
        return true;
      });
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
      const ids = Array.from(this.boards.values(), (b) => b.id).join(', ');
      throw new Error(`Board "${boardName}" not found. Available: ${ids}`);
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
      ...(board.lowPowerMode ? [`║  LOW POWER:   ${board.lowPowerMode}`] : []),
      `╠══════════════════════════════════════════════╣`,
      `║  Wiki: ${board.wikiUrl}`,
      `╚══════════════════════════════════════════════╝`
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
    const q = XIAOAssistant.normalizeQuery(query);
    if (!q) return [];
    const ids = this.searchIndex(this.docIndex, q);
    const byId = new Map(this.documents.map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter((d): d is XIAODocument => d !== undefined);
  }

  getQuickstart(boardName: string): XIAODocument | undefined {
    // Exact board first; then the board family (variant or base share docs);
    // then a doc that covers the family at all.
    const board = this.getBoard(boardName);
    if (!board) return undefined;
    const group = new Set<string>([board.id]);
    if (board.variantOf) group.add(board.variantOf);
    for (const b of this.boards.values()) {
      if (b.variantOf === board.id) group.add(b.id);
    }
    return (
      this.documents.find(
        (d) => d.category === 'getting-started' && d.boards.some((b) => group.has(b))
      ) ??
      this.documents.find((d) => d.category === 'getting-started' && d.boards.includes(board.id))
    );
  }

  // --- Troubleshoot ---

  troubleshoot(symptoms: string, board?: string): XIAOTroubleshootEntry[] {
    const q = XIAOAssistant.normalizeQuery(symptoms);
    if (!q) return [];
    const ids = this.searchIndex(this.troubleshootIndex, q);
    const byId = new Map(this.troubleshootEntries.map((t) => [t.id, t]));
    return ids
      .map((id) => byId.get(id))
      .filter((e): e is XIAOTroubleshootEntry => {
        if (!e) return false;
        return !board || e.boards.includes(board);
      });
  }

  // --- Wiki search ---

  async searchWikiOnline(query: string): Promise<WikiSearchResult[]> {
    return searchWiki(query);
  }

  // --- Knowledge search ---

  searchKnowledge(query: string, options?: { board?: string; severity?: string }): XIAOKnowledge[] {
    const q = XIAOAssistant.normalizeQuery(query);
    if (!q) return [];
    const ids = this.searchIndex(this.knowledgeIndex, q);
    const byId = new Map(this.knowledge.map((k) => [k.id, k]));
    return ids
      .map((id) => byId.get(id))
      .filter((e): e is XIAOKnowledge => {
        if (!e) return false;
        if (options?.board && !e.boards.includes(options.board)) return false;
        if (options?.severity && e.severity !== options.severity) return false;
        return true;
      });
  }

  // --- Fallback methods ---

  async searchExamplesWithFallback(
    query: string,
    options?: { language?: string; board?: string }
  ): Promise<{ local: XIAOExample[]; wiki: WikiSearchResult[] }> {
    const local = this.searchExamples(query, options);
    if (local.length > 0) return { local, wiki: [] };

    const wiki = await searchWiki(query);
    return { local, wiki };
  }

  async searchDocumentsWithFallback(
    query: string
  ): Promise<{ local: XIAODocument[]; wiki: WikiSearchResult[] }> {
    const local = this.searchDocuments(query);
    if (local.length > 0) return { local, wiki: [] };

    const wiki = await searchWiki(query);
    return { local, wiki };
  }

  // --- Private helpers ---

  private expandQuery(query: string): string[] {
    const terms: string[] = [];
    const q = query.toLowerCase();
    const words = q.split(/\s+/);

    for (const [keyword, synonyms] of Object.entries(this.synonyms)) {
      const candidates = [keyword, ...synonyms];
      // Word-level hit (single-word synonyms), whole-phrase hit (multi-word
      // synonyms like "deep sleep" never match after word splitting), or CJK
      // compound hit ("上传失败" contains "上传", "温度传感器" contains "温度").
      const hit =
        words.some((w) => candidates.includes(w)) ||
        candidates.some((c) => c.includes(' ') && q.includes(c)) ||
        candidates.some(
          (c) => c.length >= 2 && !c.includes(' ') && words.some((w) => w.includes(c))
        );
      if (hit) terms.push(...candidates);
    }

    return [...new Set(terms)];
  }
}

export {
  type XIAOBoard,
  type XIAOExample,
  type XIAODocument,
  type XIAOTroubleshootEntry,
  type WikiSearchResult,
  type XIAOKnowledge,
} from './types.js';
export default XIAOAssistant;
