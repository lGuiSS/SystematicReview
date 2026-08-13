/**
 * Detecção de comunidades usando algoritmo de Louvain
 * Wrapper sobre graphology-communities-louvain
 */
import Graph from 'graphology';
import { assign } from 'graphology-communities-louvain';

/**
 * Detecta comunidades no grafo usando Louvain
 * @param {Object} network - { nodes, edges } da rede
 * @returns {Object} { nodes, communityCount, modularity }
 */
function detectCommunities(network) {
  const { nodes, edges } = network;

  if (nodes.length === 0 || edges.length === 0) {
    return {
      ...network,
      communityCount: 0,
      modularity: 0
    };
  }

  // Preserve stats from original network
  const inputStats = network.stats || {};

  // Criar grafo graphology
  const graph = new Graph({ multi: false });

  // Adicionar nós
  nodes.forEach(node => {
    graph.addNode(node.id, {
      label: node.label,
      publicationCount: node.publicationCount
    });
  });

  // Adicionar arestas
  edges.forEach(edge => {
    // Verificar se ambos os nós existem
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addEdge(edge.source, edge.target, {
        weight: edge.weight
      });
    }
  });

  // Rodar Louvain - assign modifica o grafo diretamente, atribuindo 'community' a cada nó
  assign(graph, {
    resolution: 1,
    random: false,
    seed: 42, // Para reprodutibilidade
    nodeCommunityAttribute: 'community'
  });

  // Mapear comunidades para nós (lê do grafo, não de retorno)
  const communityMap = {};
  const nodesWithCommunities = nodes.map(node => {
    const attrs = graph.getNodeAttributes(node.id);
    const community = attrs?.community ?? 0;
    if (!communityMap[community]) {
      communityMap[community] = Object.keys(communityMap).length;
    }
    return {
      ...node,
      clusterId: communityMap[community]
    };
  });

  const communityCount = Object.keys(communityMap).length;

  // Calcular modularidade (aproximação)
  const modularity = calculateModularity(graph);

  return {
    nodes: nodesWithCommunities,
    edges,
    stats: inputStats,
    communityCount,
    modularity
  };
}

/**
 * Calcula a modularidade do grafo
 * Q = (1/2m) Σ_ij (A_ij − k_i k_j / 2m) δ(c_i, c_j)
 */
function calculateModularity(graph) {
  const m = graph.reduceEdges((acc) => acc + 1, 0);

  if (m === 0) return 0;

  let Q = 0;

  graph.forEachNode((nodeA) => {
    const attrsA = graph.getNodeAttributes(nodeA);
    const communityA = attrsA?.community ?? 0;
    const degreeA = graph.degree(nodeA);

    graph.forEachNode((nodeB) => {
      const attrsB = graph.getNodeAttributes(nodeB);
      const communityB = attrsB?.community ?? 0;
      const degreeB = graph.degree(nodeB);

      if (communityA !== communityB) return;

      const A_ij = graph.hasEdge(nodeA, nodeB) ? 1 : 0;
      Q += A_ij - (degreeA * degreeB) / (2 * m);
    });
  });

  return Q / (2 * m);
}

/**
 * Gera paleta de cores para clusters
 * @param {number} count - Número de clusters
 * @returns {string[]} Array de cores hex
 */
function generateClusterColors(count) {
  const BASE_COLORS = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#10B981', // emerald
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#E11D48', // rose
  ];

  if (count <= BASE_COLORS.length) {
    return BASE_COLORS.slice(0, count);
  }

  // Gerar cores extras para counts maiores
  const colors = [...BASE_COLORS];
  for (let i = BASE_COLORS.length; i < count; i++) {
    const hue = (i * 137.508) % 360; // Ângulo áureo
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }

  return colors;
}

export {
  detectCommunities,
  calculateModularity,
  generateClusterColors
};
