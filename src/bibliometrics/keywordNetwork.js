/**
 * Construção de rede de co-ocorrência de palavras-chave
 * Implementa full counting e fractional counting
 * Referência: Perianes-Rodriguez, Waltman & van Eck (2016)
 */

function normalizeKeyword(kw) {
  if (!kw || typeof kw !== 'string') return null;
  let n = kw.trim().toLowerCase();
  n = n.replace(/[.,;:!?()[\]{}"'\/\\]/g, '');
  n = n.replace(/\s+/g, ' ').trim();
  return n || null;
}

function buildKeywordCoOccurrenceData(articles) {
  const keywordData = new Map();
  const publications = [];

  articles.forEach((article) => {
    if (!article.keywords || !Array.isArray(article.keywords)) return;

    const validKeywords = article.keywords
      .map(k => normalizeKeyword(k))
      .filter(Boolean);

    if (validKeywords.length === 0) return;

    const pubId = article.id || article.doi || article.title;
    publications.push({
      id: pubId,
      title: article.title,
      year: article.year,
      keywords: validKeywords
    });

    const uniqueKeywords = [...new Set(validKeywords)];
    uniqueKeywords.forEach(kw => {
      if (!keywordData.has(kw)) {
        keywordData.set(kw, {
          displayName: article.keywords.find(
            k => normalizeKeyword(k) === kw
          ) || kw,
          occurrences: 0,
          publications: []
        });
      }
      const data = keywordData.get(kw);
      data.occurrences++;
      data.publications.push(pubId);
    });
  });

  const keywordList = Array.from(keywordData.keys());
  const pubIds = publications.map(p => p.id);

  const keywordIndex = {};
  keywordList.forEach((k, i) => { keywordIndex[k] = i; });
  const pubIndex = {};
  pubIds.forEach((p, i) => { pubIndex[p] = i; });

  const matrix = Array.from({ length: keywordList.length }, () =>
    new Array(publications.length).fill(0)
  );

  publications.forEach((pub, j) => {
    const uniqueKw = [...new Set(pub.keywords)];
    uniqueKw.forEach(kw => {
      const i = keywordIndex[kw];
      if (i !== undefined) {
        matrix[i][j] = 1;
      }
    });
  });

  return {
    keywordData,
    keywordList,
    publications,
    pubIds,
    matrix,
    keywordIndex,
    pubIndex
  };
}

function fullCountingCoOccurrence(matrix, keywordList) {
  const N = matrix.length;
  const M = matrix[0].length;
  const edges = new Map();

  for (let k = 0; k < M; k++) {
    const coKeywords = [];
    for (let i = 0; i < N; i++) {
      if (matrix[i][k] === 1) coKeywords.push(i);
    }
    if (coKeywords.length < 2) continue;

    for (let idx = 0; idx < coKeywords.length; idx++) {
      for (let jdx = idx + 1; jdx < coKeywords.length; jdx++) {
        const i = coKeywords[idx];
        const j = coKeywords[jdx];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  }

  return edges;
}

function fractionalCountingCoOccurrence(matrix, keywordList) {
  const N = matrix.length;
  const M = matrix[0].length;
  const edges = new Map();

  for (let k = 0; k < M; k++) {
    const coKeywords = [];
    for (let i = 0; i < N; i++) {
      if (matrix[i][k] === 1) coKeywords.push(i);
    }
    const n_k = coKeywords.length;
    if (n_k < 2) continue;

    const weightPerLink = 1 / (n_k - 1);

    for (let idx = 0; idx < n_k; idx++) {
      for (let jdx = idx + 1; jdx < n_k; jdx++) {
        const i = coKeywords[idx];
        const j = coKeywords[jdx];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        edges.set(key, (edges.get(key) || 0) + weightPerLink);
      }
    }
  }

  return edges;
}

function buildKeywordNetwork(coOccurrenceData, method = 'fractional') {
  const { keywordList, keywordData, matrix, publications } = coOccurrenceData;

  const edgeMap = method === 'full'
    ? fullCountingCoOccurrence(matrix, keywordList)
    : fractionalCountingCoOccurrence(matrix, keywordList);

  const edges = [];
  edgeMap.forEach((weight, key) => {
    const [i, j] = key.split('-').map(Number);
    edges.push({
      source: keywordList[i],
      target: keywordList[j],
      weight
    });
  });

  const nodes = keywordList.map(kw => {
    const data = keywordData.get(kw);
    return {
      id: kw,
      label: data?.displayName || kw,
      occurrenceCount: data?.occurrences || 0,
      clusterId: null
    };
  });

  const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);
  const maxWeight = edges.length > 0 ? Math.max(...edges.map(e => e.weight)) : 0;
  const avgWeight = edges.length > 0 ? totalWeight / edges.length : 0;
  const possibleEdges = (keywordList.length * (keywordList.length - 1)) / 2;
  const density = possibleEdges > 0 ? edges.length / possibleEdges : 0;

  const stats = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    totalWeight,
    maxWeight,
    avgWeight,
    density,
    method,
    publicationCount: publications.length
  };

  return { nodes, edges, stats };
}

export {
  normalizeKeyword,
  buildKeywordCoOccurrenceData,
  fullCountingCoOccurrence,
  fractionalCountingCoOccurrence,
  buildKeywordNetwork
};
