// fileSystem.js - Sistema de salvamento e abertura de arquivos

// Versão atual do schema do arquivo
const CURRENT_SCHEMA_VERSION = "1.1.0";

// Schemas de versões para compatibilidade retroativa
const SCHEMA_VERSIONS = {
  "1.0.0": {
    requiredFields: ["version", "protocol", "articles", "statistics", "metadata"],
    migrations: [] 
  },
  "1.1.0": {
    requiredFields: ["version", "protocol", "articles", "statistics", "metadata"],
    migrations: [migrateFrom1_0_0to1_1_0]
  }
  // Futuras versões serão adicionadas aqui:
  // "1.2.0": {
  //   requiredFields: [...],
  //   migrations: [migrateFrom1_0_0to1_1_0]
  // }
};
// Remove exclusionReason dos artigos, movendo seu valor para exclusionCriterion
function migrateFrom1_0_0to1_1_0(data) {
  const { protocol } = data;

  // Mapas id → label para lookup eficiente
  const exclusionMap = Object.fromEntries(
    (protocol.exclusionCriteria ?? []).map(c => [c.id, c.value])
  );
  const inclusionMap = Object.fromEntries(
    (protocol.inclusionCriteria ?? []).map(c => [c.id, c.value])
  );

  const toObject = (id, map, category) =>
    id && typeof id === "string"
      ? { id, label: map[id] ?? id, category }
      : id; // já é objeto (idempotência) ou inválido

  return {
    ...data,
    version: "1.1.0",
    articles: data.articles.map(article => {
      const { exclusionReason, exclusionCriterion, inclusionCriterion, qualityCriteria = [], ...rest } = article;
      // --- exclusionCriterion ---
      const existingExclusion = Array.isArray(exclusionCriterion) ? exclusionCriterion : [];
      const incoming          = Array.isArray(exclusionReason)
                                  ? exclusionReason
                                  : exclusionReason != null ? [exclusionReason] : [];

      const mergedExclusionIds = [...new Set([...existingExclusion, ...incoming])].filter(Boolean);
      const newExclusionCriterion = mergedExclusionIds
        .map(id => toObject(id, exclusionMap, "exclusion"))
        .filter(Boolean);

      // --- inclusionCriterion ---
      const inclusionIds = Array.isArray(inclusionCriterion)
        ? inclusionCriterion
        : inclusionCriterion != null ? [inclusionCriterion] : [];

      const newInclusionCriterion = inclusionIds
        .filter(Boolean)
        .map(id => toObject(id, inclusionMap, "inclusion"))
        .filter(Boolean);

      // --- qualityCriterion ---
      const newQualityCriterion = Array.isArray(qualityCriteria) ? qualityCriteria : [];  

      return {
        ...rest,
        exclusionCriterion: newExclusionCriterion,
        inclusionCriterion: newInclusionCriterion,
        qualityCriteria: newQualityCriterion,
      };
    }),
  };
}
// Função para criar o estado padrão
const createDefaultState = () => ({
  protocol: {
    title: '',
    researchQuestion: '',
    yearRange: { start: 2015, end: 2024 },
    languages: ['English'],
    inclusionCriteria: [''],
    exclusionCriteria: [''],
    qualityCriteria: [''],
    databases: []
  },
  articles: [],
  currentSection: 'protocol',
  importedData: []
});

// Função para validar se um objeto tem todas as propriedades necessárias
const validateSchema = (data, version) => {
  const schema = SCHEMA_VERSIONS[version];
  if (!schema) {
    throw new Error(`Versão do schema não suportada: ${version}`);
  }

  const missingFields = schema.requiredFields.filter(field => !(field in data));
  if (missingFields.length > 0) {
    throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
  }

  return true;
};

// Função para migrar dados de versões antigas
const migrateData = (data) => {
  let currentData = { ...data };
  const fromVersion = currentData.version || "1.0.0";
  
  // Se já está na versão atual, não precisa migrar
  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    return currentData;
  }

  // Aplicar migrações sequencialmente
  const versions = Object.keys(SCHEMA_VERSIONS).sort();
  const currentVersionIndex = versions.indexOf(CURRENT_SCHEMA_VERSION);
  const fromVersionIndex = versions.indexOf(fromVersion);

  if (fromVersionIndex === -1) {
    throw new Error(`Versão de origem desconhecida: ${fromVersion}`);
  }

  // Aplicar migrações da versão antiga até a atual
  for (let i = fromVersionIndex; i < currentVersionIndex; i++) {
    const nextVersion = versions[i + 1];
    const migrations = SCHEMA_VERSIONS[nextVersion].migrations;
    
    for (const migration of migrations) {
      currentData = migration(currentData);
    }
  }

  // Atualizar versão
  currentData.version = CURRENT_SCHEMA_VERSION;
  
  return currentData;
};

// Função para adicionar campos ausentes com valores padrão
const addMissingFields = (data) => {
  const defaultState = createDefaultState();
  
  return {
    ...defaultState, // valores padrão primeiro
    ...data, // dados carregados sobrescrevem os padrão
    protocol: {
      ...defaultState.protocol,
      ...data.protocol
    }
  };
};

// Função principal de salvamento
export const saveProjectToFile = async (state) => {
  try {
    const saveData = {
      version: CURRENT_SCHEMA_VERSION,
      protocol: state.protocol,
      articles: state.articles,
      statistics: state.statistics,
      metadata: {
        savedAt: new Date().toISOString(),
        totalArticles: state.articles.length,
        duplicates: state.articles.filter(a => a.isDuplicate).length,
        appVersion: CURRENT_SCHEMA_VERSION,
      },
      currentSection: state.currentSection,
      importedData: state.importedData || [],
      warnAfterMin: state.warnAfterMin
    };

    const jsonData = JSON.stringify(saveData, null, 2);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const suggestedName = `systematic-review-${timestamp}.srp`;

    // Verificar suporte à API
    if (typeof window.showSaveFilePicker !== 'function') {
      console.warn('showSaveFilePicker não suportado, usando download padrão.');
      return fallbackDownload(jsonData, suggestedName);
    }

    const fileHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Systematic Review Project',
          accept: { 'application/json': ['.srp'] },
        },
      ],
    });

    const writable = await fileHandle.createWritable();
    await writable.write(jsonData);
    await writable.close();

    return { success: true, filename: fileHandle.name };

  } catch (error) {
    // Log completo para diagnóstico
    console.error('Erro ao salvar:', error, '| name:', error?.name, '| message:', error?.message);

    if (error?.name === 'AbortError') {
      return { success: false, error: 'Operação cancelada pelo usuário.' };
    }

    return { success: false, error: error?.message || `Erro desconhecido: ${error}` };
  }
};

// Fallback para browsers sem suporte
const fallbackDownload = (jsonData, filename) => {
  try {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true, filename };
  } catch (error) {
    return { success: false, error: error?.message || 'Falha no download de fallback.' };
  }
};

// Função principal de abertura
export const loadProjectFromFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        // Parse do JSON
        const rawData = JSON.parse(event.target.result);
        
        // Determinar versão do arquivo
        const fileVersion = rawData.version || "1.0.0";
        console.log(`Carregando arquivo versão: ${fileVersion}`);
        
        // Validar schema básico
        try {
          validateSchema(rawData, fileVersion);
        } catch (validationError) {
          console.warn('Falha na validação do schema, tentando recuperar:', validationError.message);
        }
        
        // Migrar dados se necessário
        let migratedData = migrateData(rawData);
        
        // Adicionar campos ausentes com valores padrão
        const completeData = addMissingFields(migratedData);
        
        // Validar dados migrados
        validateSchema(completeData, CURRENT_SCHEMA_VERSION);
        
        // Log de sucesso
        console.log(`Arquivo carregado com sucesso. Versão original: ${fileVersion}, Versão atual: ${CURRENT_SCHEMA_VERSION}`);
        console.log(`Total de artigos: ${completeData.articles.length}`);
        
        resolve({
          success: true,
          data: completeData,
          originalVersion: fileVersion,
          migrated: fileVersion !== CURRENT_SCHEMA_VERSION
        });
        
      } catch (error) {
        console.error('Erro ao carregar arquivo:', error);
        reject({
          success: false,
          error: error.message,
          details: error
        });
      }
    };
    
    reader.onerror = () => {
      reject({
        success: false,
        error: 'Erro ao ler o arquivo'
      });
    };
    
    reader.readAsText(file);
  });
};

// Função auxiliar para calcular estatísticas
const calculateStatistics = (articles) => {
  const dataProcessing = {
    pending: articles.filter(a => a.dataProcessingStatus === 'pending' && !a.isDuplicate).length,
    included: articles.filter(a => a.dataProcessingStatus === 'included' && !a.isDuplicate).length,
    excluded: articles.filter(a => a.dataProcessingStatus === 'excluded' || a.isDuplicate).length
  };

  const filter1 = {
    pending: articles.filter(a => 
      a.dataProcessingStatus === 'included' && 
      !a.isDuplicate && 
      a.filter1Status === 'pending'
    ).length,
    included: articles.filter(a => a.filter1Status === 'included').length,
    excluded: articles.filter(a => 
      a.dataProcessingStatus === 'included' && 
      !a.isDuplicate && 
      a.filter1Status === 'excluded'
    ).length
  };
  
  const filter2 = {
    pending: articles.filter(a => a.filter1Status === 'included' && a.filter2Status === 'pending').length,
    included: articles.filter(a => a.filter2Status === 'included').length,
    excluded: articles.filter(a => a.filter1Status === 'included' && a.filter2Status === 'excluded').length
  };
  
  const filter3 = {
    pending: articles.filter(a => a.filter2Status === 'included' && a.filter3Status === 'pending').length,
    included: articles.filter(a => a.filter3Status === 'included').length,
    excluded: articles.filter(a => a.filter2Status === 'included' && a.filter3Status === 'excluded').length
  };
  
  return { dataProcessing, filter1, filter2, filter3 };
};

// Função para auto-save (salvamento automático periódico)
export const setupAutoSave = (getState, intervalMinutes = 5) => {
  const interval = intervalMinutes * 60 * 1000; // converter para ms
  
  return setInterval(() => {
    try {
      const state = getState();
      
      // Só fazer auto-save se houver dados relevantes
      if (state.articles.length > 0 || state.protocol.title.trim()) {
        const autoSaveData = {
          ...state,
          metadata: {
            ...state.metadata,
            autoSavedAt: new Date().toISOString(),
            isAutoSave: true
          }
        };
        
        // Salvar no localStorage como backup
        localStorage.setItem('systematic-review-autosave', JSON.stringify(autoSaveData));
        console.log('Auto-save realizado:', new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Erro no auto-save:', error);
    }
  }, interval);
};

// Função para recuperar auto-save
export const loadAutoSave = () => {
  try {
    const autoSaveData = localStorage.getItem('systematic-review-autosave');
    if (autoSaveData) {
      const parsedData = JSON.parse(autoSaveData);
      return {
        success: true,
        data: parsedData,
        isAutoSave: true
      };
    }
    return { success: false, error: 'Nenhum auto-save encontrado' };
  } catch (error) {
    console.error('Erro ao carregar auto-save:', error);
    return { success: false, error: error.message };
  }
};

// Função para limpar auto-save
export const clearAutoSave = () => {
  try {
    localStorage.removeItem('systematic-review-autosave');
    return { success: true };
  } catch (error) {
    console.error('Erro ao limpar auto-save:', error);
    return { success: false, error: error.message };
  }
};

// Exemplo de migração para futura versão 1.1.0
// const migrateFrom1_0_0to1_1_0 = (data) => {
//   return {
//     ...data,
//     // Adicionar novos campos com valores padrão
//     newField: 'defaultValue',
//     protocol: {
//       ...data.protocol,
//       newProtocolField: []
//     },
//     // Migrar artigos se necessário
//     articles: data.articles.map(article => ({
//       ...article,
//       newArticleField: 'defaultValue'
//     }))
//   };
// };