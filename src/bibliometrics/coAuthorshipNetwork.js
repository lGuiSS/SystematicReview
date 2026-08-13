/**
 * Construção de rede de coautoria
 * Implementa full counting e fractional counting
 * Referência: Perianes-Rodriguez, Waltman & van Eck (2016)
 */

/**
 * Calcula a rede de coautoria usando full counting
 * U = A · Aᵀ (diagonal zerada)
 * Cada coautoria conta como 1
 */
function fullCounting(matrix, authorList) {
  const N = matrix.length;
  const M = matrix[0].length;
  const edges = new Map();

  // Para cada publicação
  for (let k = 0; k < M; k++) {
    // Encontrar autores desta publicação
    const coauthors = [];
    for (let i = 0; i < N; i++) {
      if (matrix[i][k] === 1) {
        coauthors.push(i);
      }
    }

    // Ignorar publicações com menos de 2 autores
    if (coauthors.length < 2) continue;

    // Adicionar peso 1 para cada par
    for (let idx = 0; idx < coauthors.length; idx++) {
      for (let jdx = idx + 1; jdx < coauthors.length; jdx++) {
        const i = coauthors[idx];
        const j = coauthors[jdx];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  }

  return edges;
}

/**
 * Calcula a rede de coautoria usando fractional counting
 * U*_ij = Σ_k (a_ik · a_jk) / (n_k - 1)
 * onde n_k = número de autores da publicação k
 * 
 * IMPORTANTE: O denominador é (n_k - 1), não n_k
 * Isso garante que cada "ação" de coautoria tenha peso total 1
 */
function fractionalCounting(matrix, authorList) {
  const N = matrix.length;
  const M = matrix[0].length;
  const edges = new Map();

  // Para cada publicação
  for (let k = 0; k < M; k++) {
    // Encontrar autores desta publicação
    const coauthors = [];
    for (let i = 0; i < N; i++) {
      if (matrix[i][k] === 1) {
        coauthors.push(i);
      }
    }

    const n_k = coauthors.length;

    // Ignorar publicações com menos de 2 autores
    if (n_k < 2) continue;

    // Peso fractional: 1 / (n_k - 1)
    const weightPerLink = 1 / (n_k - 1);

    // Adicionar peso fractional para cada par
    for (let idx = 0; idx < n_k; idx++) {
      for (let jdx = idx + 1; jdx < n_k; jdx++) {
        const i = coauthors[idx];
        const j = coauthors[jdx];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        edges.set(key, (edges.get(key) || 0) + weightPerLink);
      }
    }
  }

  return edges;
}

/**
 * Constrói a rede de coautoria completa
 * @param {Object} authorshipData - Retornado por buildAuthorshipData
 * @param {'full' | 'fractional'} method - Método de contagem
 * @returns {Object} { nodes, edges, stats }
 */
function buildCoAuthorshipNetwork(authorshipData, method = 'fractional') {
  const { authorList, matrix, authorsMap, publications } = authorshipData;

  // Calcular arestas conforme método
  const edgeMap = method === 'full'
    ? fullCounting(matrix, authorList)
    : fractionalCounting(matrix, authorList);

  // Converter arestas para formato do grafo
  const edges = [];
  edgeMap.forEach((weight, key) => {
    const [i, j] = key.split('-').map(Number);
    edges.push({
      source: authorList[i],
      target: authorList[j],
      weight
    });
  });

  // Criar nós com metadados
  const nodes = authorList.map(author => {
    const data = authorsMap.get(author);
    return {
      id: author,
      label: data?.displayName || author,
      publicationCount: data?.publications.length || 0,
      clusterId: null // Será preenchido pela detecção de comunidades
    };
  });

  // Calcular estatísticas
  const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);
  const maxWeight = edges.length > 0
    ? Math.max(...edges.map(e => e.weight))
    : 0;
  const avgWeight = edges.length > 0 ? totalWeight / edges.length : 0;

  // Densidade: arestas possíveis = N*(N-1)/2
  const possibleEdges = (authorList.length * (authorList.length - 1)) / 2;
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

  return {
    nodes,
    edges,
    stats
  };
}

export {
  fullCounting,
  fractionalCounting,
  buildCoAuthorshipNetwork
};
