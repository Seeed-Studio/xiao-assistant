// SDK entry — importable without triggering the CLI.
// The CLI lives in index.ts (bin); this module is what package.json `exports["."]`
// resolves to, so `import { XIAOAssistant } from '@seeed-studio/xiao-assistant'`
// stays side-effect free.
export { XIAOAssistant, default } from './core/assistant.js';
export { searchWiki } from './core/wiki-service.js';
export {
  loadBoards,
  loadExamples,
  loadDocuments,
  loadTroubleshootEntries,
  loadSynonyms,
  loadKnowledge,
} from './core/data-loader.js';
export type {
  XIAOBoard,
  XIAOExample,
  XIAODocument,
  XIAOTroubleshootEntry,
  XIAOKnowledge,
  WikiSearchResult,
  XIAOPinConfig,
} from './core/types.js';
