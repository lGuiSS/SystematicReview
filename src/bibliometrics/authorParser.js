/**
 * Parser de autores para redes bibliométricas
 * Normaliza nomes e extrai lista de autores de strings BibTeX/PubMed
 */

// Mapeamento de acentos para normalização
const ACCENT_MAP = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ç': 'c', 'ñ': 'n', 'ÿ': 'y',
  'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
  'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
  'Ç': 'C', 'Ñ': 'N', 'Ÿ': 'Y'
};

/**
 * Remove acentos de uma string
 */
function removeAccents(str) {
  return str.replace(/[áàãâäéèêëíìîïóòõôöúùûüçñÿÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑŸ]/g,
    match => ACCENT_MAP[match] || match
  );
}

/**
 * Normaliza um nome de autor
 * - Remove acentos
 * - Converte para lowercase
 * - Remove pontuação extra
 * - Remove espaços múltiplos
 */
function normalizeAuthorName(name) {
  if (!name || typeof name !== 'string') return null;

  let normalized = name.trim();
  normalized = removeAccents(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/[.,;:]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized || null;
}

/**
 * Gera uma chave de deduplicação para um autor
 * Considera variações como "J. Silva" vs "João Silva"
 * Usa a última palavra (sobrenome) + iniciais
 */
function generateAuthorKey(normalizedName) {
  if (!normalizedName) return null;

  const parts = normalizedName.split(' ');
  if (parts.length === 1) return normalizedName;

  // Último elemento é o sobrenome
  const surname = parts[parts.length - 1];
  // Iniciais dos nomes (primeiras letras de cada parte, exceto a última)
  const initials = parts.slice(0, -1)
    .map(p => p.charAt(0))
    .join('');

  return `${surname}_${initials}`;
}

/**
 * Divide a string de autores em array
 * Suporta formatos:
 * - BibTeX: "Author1 and Author2 and Author3"
 * - PubMed: "Author1; Author2; Author3"
 * - Variados: "Author1, Author2, Author3"
 */
function splitAuthors(authorsString) {
  if (!authorsString || typeof authorsString !== 'string') return [];

  let authors = authorsString;

  // Detectar formato e dividir
  if (authors.includes(' and ')) {
    authors = authors.split(/\s+and\s+/);
  } else if (authors.includes(';')) {
    authors = authors.split(';');
  } else if (authors.includes(',')) {
    authors = authors.split(',');
  } else {
    return [authors.trim()];
  }

  return authors
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

/**
 * Processa array de artigos e retorna:
 * - authorsMap: Map<normalizedName, { displayName, keys, publications }>
 * - authorMatrix: { authors: string[], publications: string[], matrix: number[][] }
 */
function buildAuthorshipData(articles) {
  // Mapa de nomes normalizados -> dados
  const authorData = new Map();

  // Lista de publicações
  const publications = [];

  articles.forEach((article, index) => {
    if (!article.authors) {
      return;
    }

    const authorNames = splitAuthors(article.authors)
      .filter(name => {
        const lower = name.trim().toLowerCase();
        return lower && lower !== 'autor não informado' && lower !== 'author not informed';
      });
    if (authorNames.length === 0) {
      return;
    }

    const pubId = article.id || article.doi || article.title;
    publications.push({
      id: pubId,
      title: article.title,
      year: article.year,
      authors: []
    });

    authorNames.forEach(name => {
      const normalized = normalizeAuthorName(name);
      if (!normalized) return;

      const key = generateAuthorKey(normalized);

      if (!authorData.has(normalized)) {
        authorData.set(normalized, {
          displayName: name.trim(),
          normalized,
          key,
          publications: []
        });
      }

      const author = authorData.get(normalized);
      author.publications.push(pubId);
      publications[publications.length - 1].authors.push(normalized);
    });
  });

  // Construir matriz de autoria (N autores × M publicações)
  const authorList = Array.from(authorData.keys());
  const pubIds = publications.map(p => p.id);

  // Criar índice rápido
  const authorIndex = {};
  authorList.forEach((a, i) => authorIndex[a] = i);
  const pubIndex = {};
  pubIds.forEach((p, i) => pubIndex[p] = i);

  // Matriz binária (0/1)
  const matrix = Array.from({ length: authorList.length }, () =>
    new Array(publications.length).fill(0)
  );

  publications.forEach((pub, j) => {
    pub.authors.forEach(author => {
      const i = authorIndex[author];
      if (i !== undefined) {
        matrix[i][j] = 1;
      }
    });
  });

  return {
    authorsMap: authorData,
    authorList,
    publications,
    pubIds,
    matrix,
    authorIndex,
    pubIndex
  };
}

export {
  normalizeAuthorName,
  generateAuthorKey,
  splitAuthors,
  buildAuthorshipData,
  removeAccents
};
