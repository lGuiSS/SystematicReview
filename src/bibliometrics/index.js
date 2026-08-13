/**
 * Módulo de Redes Bibliométricas
 * Exporta funcionalidades para análise de coautoria e co-ocorrência
 */

export {
  normalizeAuthorName,
  generateAuthorKey,
  splitAuthors,
  buildAuthorshipData,
  removeAccents
} from './authorParser';

export {
  fullCounting,
  fractionalCounting,
  buildCoAuthorshipNetwork
} from './coAuthorshipNetwork';

export {
  normalizeKeyword,
  buildKeywordCoOccurrenceData,
  buildKeywordNetwork
} from './keywordNetwork';

export {
  detectCommunities,
  calculateModularity,
  generateClusterColors
} from './communityDetection';
