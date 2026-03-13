import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Download, Upload, CheckCircle, XCircle, BookCopy, ListCollapse, Clock, BarChart3, FileText, Users, Calendar, Database, Trash2, RefreshCw, Settings, BookOpen, Globe, Sun, Moon, ArrowUpDown, ChevronDown, Eye } from 'lucide-react';
import { 
  saveProjectToFile, 
  loadProjectFromFile, 
  setupAutoSave, 
  loadAutoSave, 
  clearAutoSave 
} from './fileSystem.js';

// Hook personalizado para gerenciar o tema
const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    // Usar padrão claro já que localStorage não está disponível
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remover classes anteriores
    root.classList.remove('light', 'dark');
    
    // Adicionar a classe do tema atual
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};

// Componente Toggle
const ThemeToggle = ({ theme, toggleTheme }) => {
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-colors duration-200 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
      title={`Alternar para ${theme === 'light' ? 'escuro' : 'claro'}`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      ) : (
        <Sun className="h-5 w-5 text-yellow-500" />
      )}
    </button>
  );
};

// Simulando dados de artigos científicos com campos para duplicatas
const generateMockArticles = (count = 500, source = 'Scopus') => {
  const journals = ['Nature', 'Science', 'Cell', 'NEJM', 'Lancet', 'JAMA', 'BMJ', 'PLOS ONE', 'Scientific Reports', 'PNAS'];
  const authors = ['Silva JA', 'Santos MB', 'Oliveira CR', 'Ferreira LM', 'Costa AR', 'Pereira ST', 'Rodrigues FM', 'Almeida PC'];
  const keywords = ['machine learning', 'systematic review', 'meta-analysis', 'randomized trial', 'cohort study', 'biomarkers', 'treatment', 'diagnosis', 'prevention', 'therapy'];
  const languages = ['English', 'Portuguese', 'Spanish', 'French'];
  
  const articles = Array.from({ length: count }, (_, i) => {
    const baseTitle = `Investigação sobre ${keywords[Math.floor(Math.random() * keywords.length)]}`;
    return {
      id: `${source.toLowerCase().replace(' ', '_')}_${i + 1}`,
      title: `${baseTitle} - Estudo ${i + 1}`,
      authors: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => authors[Math.floor(Math.random() * authors.length)]).join(', '),
      journal: journals[Math.floor(Math.random() * journals.length)],
      year: 2015 + Math.floor(Math.random() * 10),
      score: null,
      abstract: `Este estudo investiga aspectos relacionados a ${keywords[Math.floor(Math.random() * keywords.length)]} através de metodologia ${Math.random() > 0.5 ? 'quantitativa' : 'qualitativa'}. Os resultados demonstram significância estatística nos grupos analisados.`,
      keywords: Array.from({ length: Math.floor(Math.random() * 4) + 2 }, () => keywords[Math.floor(Math.random() * keywords.length)]),
      studyType: ['RCT', 'Cohort', 'Case-Control', 'Cross-sectional', 'Review'][Math.floor(Math.random() * 5)],
      quality: Math.floor(Math.random() * 5) + 1,
      doi: `10.1000/journal.${source.toLowerCase()}.${i + 1000}`,
      language: languages[Math.floor(Math.random() * languages.length)],
      source: source,
      isDuplicate: false,
      duplicateOf: null,
      dataProcessingStatus: 'pending',
      filter1Status: 'pending',
      filter2Status: 'pending',
      filter3Status: 'pending',
      exclusionReason: null,
      inclusionCriterion: null,
      exclusionCriterion: null,
      searchString: null,
      importDate: new Date(),
      lastModified: new Date()
    };
  });
  
  // Criar algumas duplicatas intencionais (5-10%)
  const duplicateCount = 10;
  for (let i = 0; i < duplicateCount; i++) {
    if (i < articles.length) {
      const original = articles[i];
      const duplicate = { ...original };
      duplicate.id = `${source.toLowerCase().replace(' ', '_')}_dup_${i}`;
      duplicate.source = source;
      duplicate.isDuplicate = false;
      duplicate.duplicateOf = original.id;
      duplicate.doi = `${original.doi}.dup`;
      articles.push(duplicate);
    }
  }
  
  return articles;
};

function getField(bibtex, field) {
  // Regex mais robusta para capturar campos BibTeX
  const regex = new RegExp(`${field}\\s*=\\s*[{"](.*?)["}]`, "is");
  const match = bibtex.match(regex);
  
  if (match) {
    return match[1]
      .replace(/\{|\}/g, '') // Remove chaves extras
      .replace(/\s+/g, ' ')   // Normaliza espaços
      .trim();
  }
  
  return null;
}

const validateBibtexFormat = (content) => {
  // Verificar se contém entradas BibTeX válidas
  const hasValidEntries = /@(article|book|inproceedings|conference|misc|techreport|mastersthesis|phdthesis)\s*\{/i.test(content);
  const hasRequiredFields = /title\s*=/i.test(content);
  
  return hasValidEntries && hasRequiredFields;
};

// Função melhorada para dividir entradas BibTeX
function splitBibtexEntries(bibtexContent) {
  const entries = [];
  const entryRegex = /@(\w+)\s*\{/g;
  
  let match;
  let lastIndex = 0;
  const matches = [];
  
  // Encontra todas as posições de @tipo{
  while ((match = entryRegex.exec(bibtexContent)) !== null) {
    matches.push(match.index);
  }
  
  // Divide o conteúdo nas posições encontradas
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i];
    const end = matches[i + 1] || bibtexContent.length;
    const entry = bibtexContent.substring(start, end).trim();
    
    if (entry) {
      entries.push(entry);
    }
  }
  
  return entries;
}


const importedBibtexArticles = (bibtexContent, source = 'Scopus') => {
  // Dividir o conteúdo em entradas individuais
  const entries = splitBibtexEntries(bibtexContent);

  const articles = entries.map((fullEntry, index) => {
    return {
      id: `${source.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
      title: getField(fullEntry, "title") || `Título não encontrado ${index + 1}`,
      authors: getField(fullEntry, "author") || 'Autor não informado',
      journal: getField(fullEntry, "journal") || getField(fullEntry, "booktitle") || 'Revista não informada',
      year: parseInt(getField(fullEntry, "year")) || new Date().getFullYear(),
      score: null,
      abstract: getField(fullEntry, "abstract") || 'Resumo não disponível',
      keywords: getField(fullEntry, "keywords")?.split(";").map(k => k.trim()) || [],
      studyType: getField(fullEntry, "type") || 'Não especificado',
      quality: null,
      doi: getField(fullEntry, "doi"),
      language: getField(fullEntry, "language") || 'English',
      source: source,
      isDuplicate: false,
      duplicateOf: null,
      dataProcessingStatus: 'pending',
      filter1Status: 'pending',
      filter2Status: 'pending',
      filter3Status: 'pending',
      exclusionReason: null,
      inclusionCriterion: null,
      exclusionCriterion: null,
      searchString: null,
      importDate: new Date(),
      lastModified: new Date()
    };
  });

  return articles.filter(article => !article.title.startsWith('Título não encontrado'));


};

// Modal para seleção de critérios
const CriterionModal = ({ isOpen, onClose, onSelect, criteria, type, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full transition-colors duration-200">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {criteria.filter(c => c.trim()).map((criterion, index) => (
              <button
                key={index}
                onClick={() => onSelect(criterion)}
                className={`w-full p-3 text-left rounded-lg border transition-colors duration-200 ${
                  type === 'inclusion' 
                    ? 'border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/30' 
                    : 'border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30'
                }`}
              >
                <span className="text-gray-900 dark:text-gray-100">{criterion}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para definição do protocolo
const ProtocolSection = ({ protocol, onUpdateProtocol }) => {
  const handleProtocolChange = useCallback((field, value) => {
    onUpdateProtocol(prev => ({
      ...prev,
      [field]: value
    }));
  }, [onUpdateProtocol]);

  const handleCriteriaChange = useCallback((type, index, value) => {
    onUpdateProtocol(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? value : item)
    }));
  }, [onUpdateProtocol]);

  const addCriteria = useCallback((type) => {
    onUpdateProtocol(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }));
  }, [onUpdateProtocol]);

  const removeCriteria = useCallback((type, index) => {
    onUpdateProtocol(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  }, [onUpdateProtocol]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Settings className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        Seção 1: Definição do Protocolo de Pesquisa
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Informações básicas */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Informações Gerais</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título da Revisão Sistemática
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  value={protocol.title}
                  onChange={(e) => handleProtocolChange('title', e.target.value)}
                  placeholder="Ex: Eficácia do Machine Learning em Diagnósticos Médicos"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pergunta de Pesquisa
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  rows={3}
                  value={protocol.researchQuestion}
                  onChange={(e) => handleProtocolChange('researchQuestion', e.target.value)}
                  placeholder="Descreva a pergunta da pesquisa"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Período de Publicação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="1900"
                    max="2024"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    value={protocol.yearRange.start}
                    onChange={(e) => handleProtocolChange('yearRange', {
                      ...protocol.yearRange,
                      start: parseInt(e.target.value)
                    })}
                  />
                  <input
                    type="number"
                    min="1900"
                    max="2024"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    value={protocol.yearRange.end}
                    onChange={(e) => handleProtocolChange('yearRange', {
                      ...protocol.yearRange,
                      end: parseInt(e.target.value)
                    })}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Palavras-chaves</h3>
                <div className="space-y-3">
                  {protocol.keywords.map((criteria, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                        value={criteria}
                        onChange={(e) => handleCriteriaChange('keywords', index, e.target.value)}
                        placeholder="Ex: Machine learning"
                      />
                      <button
                        onClick={() => removeCriteria('keywords', index)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 transition-colors duration-200"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addCriteria('keywords')}
                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium rounded-lg transition-colors duration-200"
                  >
                    + Adicionar Palavras-chaves
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Idiomas dos Artigos
                </label>
                <div className="space-y-2">
                  {['English', 'Portuguese', 'Spanish', 'French', 'German', 'Italian'].map(lang => (
                    <label key={lang} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={protocol.languages.includes(lang)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleProtocolChange('languages', [...protocol.languages, lang]);
                          } else {
                            handleProtocolChange('languages', protocol.languages.filter(l => l !== lang));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Critérios */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Critérios de Inclusão</h3>
            <div className="space-y-3">
              {protocol.inclusionCriteria.map((criteria, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    value={criteria}
                    onChange={(e) => handleCriteriaChange('inclusionCriteria', index, e.target.value)}
                    placeholder="Ex: Estudos com população adulta"
                  />
                  <button
                    onClick={() => removeCriteria('inclusionCriteria', index)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 transition-colors duration-200"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addCriteria('inclusionCriteria')}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-sm font-medium rounded-lg transition-colors duration-200"
              >
                + Adicionar Critério de Inclusão
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Critérios de Exclusão</h3>
            <div className="space-y-3">
              {protocol.exclusionCriteria.map((criteria, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    value={criteria}
                    onChange={(e) => handleCriteriaChange('exclusionCriteria', index, e.target.value)}
                    placeholder="Ex: Estudos sem grupo controle"
                  />
                  <button
                    onClick={() => removeCriteria('exclusionCriteria', index)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 transition-colors duration-200"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addCriteria('exclusionCriteria')}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium rounded-lg transition-colors duration-200"
              >
                + Adicionar Critério de Exclusão
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Critérios de Qualidade</h3>
            <div className="space-y-3">
              {protocol.qualityCriteria.map((criteria, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                    value={criteria}
                    onChange={(e) => handleCriteriaChange('qualityCriteria', index, e.target.value)}
                    placeholder="Ex: Randomização adequada"
                  />
                  <button
                    onClick={() => removeCriteria('qualityCriteria', index)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 transition-colors duration-200"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addCriteria('qualityCriteria')}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium rounded-lg transition-colors duration-200"
              >
                + Adicionar Critério de Qualidade
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Bases de Dados</h3>
            <div className="space-y-2">
              {['Scopus', 'Web of Science'].map(db => (
                <label key={db} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={protocol.databases.includes(db)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleProtocolChange('databases', [...protocol.databases, db]);
                      } else {
                        handleProtocolChange('databases', protocol.databases.filter(d => d !== db));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{db}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Sistema de Pontuação */}
        <div className="mt-6">
          <ScoringSystemConfig 
            scoringSystem={protocol.scoringSystem} 
            onUpdate={onUpdateProtocol}
          />
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg transition-colors duration-200">
        <h4 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2">Status do Protocolo</h4>
        <p className="text-sm text-indigo-700 dark:text-indigo-400">
          {protocol.title ? '✓ Título definido' : '⚠ Título pendente'} | 
          {protocol.inclusionCriteria.some(c => c.trim()) ? ' ✓ Critérios de inclusão definidos' : ' ⚠ Critérios de inclusão pendentes'} | 
          {protocol.databases.length > 0 ? ' ✓ Bases selecionadas' : ' ⚠ Bases pendentes'}
        </p>
      </div>
    </div>
  );
};

// Modal para string de busca
const SearchStringModal = ({ isOpen, onClose, onConfirm, database }) => {
  const [searchString, setSearchString] = useState('');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (searchString.trim()) {
      onConfirm(searchString.trim());
      setSearchString('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full transition-colors duration-200">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            String de Busca - {database}
          </h3>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Digite a string de busca utilizada *
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              rows={4}
              value={searchString}
              onChange={(e) => setSearchString(e.target.value)}
              placeholder="Ex: (machine learning OR artificial intelligence) AND (medical diagnosis) AND (systematic review)"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Este campo é obrigatório para documentar a metodologia de busca
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!searchString.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              Confirmar Importação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente de configuração do sistema de pontuação
const ScoringSystemConfig = ({ scoringSystem, onUpdate }) => {
  const handleWeightChange = (field, value) => {
    const numValue = Math.max(0, Math.min(10, parseInt(value) || 0));
    onUpdate(prev => ({
      ...prev,
      scoringSystem: {
        ...prev.scoringSystem,
        weights: {
          ...prev.scoringSystem.weights,
          [field]: numValue
        }
      }
    }));
  };

  const handleConfigChange = (field, value) => {
    onUpdate(prev => ({
      ...prev,
      scoringSystem: {
        ...prev.scoringSystem,
        [field]: value
      }
    }));
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg transition-colors duration-200">
      <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Sistema de Pontuação por Keywords
      </h4>
      
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={scoringSystem.enabled}
            onChange={(e) => handleConfigChange('enabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-blue-700 dark:text-blue-400 font-medium">Ativar sistema de pontuação</span>
        </label>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Artigos serão pontuados baseado na presença das palavras-chave definidas
        </p>
      </div>

      {scoringSystem.enabled && (
        <div className="space-y-4">
          <div>
            <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-3">Pesos por Campo</h5>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Título ({scoringSystem.weights.title} pts)
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={scoringSystem.weights.title}
                  onChange={(e) => handleWeightChange('title', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Resumo ({scoringSystem.weights.abstract} pts)
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={scoringSystem.weights.abstract}
                  onChange={(e) => handleWeightChange('abstract', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Palavras-chave ({scoringSystem.weights.keywords} pts)
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={scoringSystem.weights.keywords}
                  onChange={(e) => handleWeightChange('keywords', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div>
            <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-3">Configurações de Busca</h5>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={scoringSystem.caseInsensitive}
                  onChange={(e) => handleConfigChange('caseInsensitive', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-blue-700 dark:text-blue-400">Ignorar maiúsculas/minúsculas</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={scoringSystem.exactMatch}
                  onChange={(e) => handleConfigChange('exactMatch', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-blue-700 dark:text-blue-400">
                  Busca exata (palavra completa apenas)
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={scoringSystem.multipleOccurrences}
                  onChange={(e) => handleConfigChange('multipleOccurrences', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-blue-700 dark:text-blue-400">
                  Contar múltiplas ocorrências da mesma keyword
                </span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
            <button
              onClick={() => window.recalculateAllScores && window.recalculateAllScores()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <RefreshCw className="h-4 w-4" />
              Recalcular Pontuações
            </button>
          </div>

          <div className="bg-blue-100 dark:bg-blue-800/50 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
            <p><strong>Como funciona:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Cada keyword encontrada soma pontos baseado no peso do campo</li>
              <li>Pontuação total = soma de todas as keywords × pesos dos campos</li>
              <li>Maior pontuação = maior relevância para a pesquisa</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para importação de dados
const ImportSection = ({articles, onImport, isLoading, importedData, protocol, setImportedData, detectDuplicates }) => {
  const [showSearchStringModal, setShowSearchStringModal] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [isLoadingState, setIsLoading] = useState(false);

  // useEffect(() => {
    // if (articles.length > 0) {
      detectDuplicates();
    // }
  // }, [articles]); // Executa sempre que articles mudar

  const handleImportRequest = (file, database) => {
    if (!file) return;
    
    setPendingImport({ file, database });
    setShowSearchStringModal(database);
  };

  const handleConfirmImport = async (searchString) => {
    if (!pendingImport) return;
    
    const { file, database } = pendingImport;
    setIsLoading(true);
    setShowSearchStringModal(null);
    try {
      // Ler o conteúdo do arquivo
      const fileContent = await file.text();
      
      // Determinar o tipo de arquivo e processar
      let articles;
      if (file.name.endsWith('.bib') || file.name.endsWith('.bibtex')) {
        articles = importedBibtexArticles(fileContent, database);
      } 
      // else {
      //   // Para outros formatos, manter o mock temporariamente
      //   articles = generateMockArticles(500, database);
      // }
      
      // Adicionar string de busca
      articles = articles.map(article => ({
        ...article,
        searchString: searchString
      }));
      
      // Calcular pontuações se habilitado
      if (protocol.scoringSystem?.enabled && protocol.keywords?.length > 0) {
        const validKeywords = protocol.keywords.filter(k => k.trim());
        if (validKeywords.length > 0) {
          articles = articles.map(article => ({
            ...article,
            score: window.calculateArticleScore ? 
              window.calculateArticleScore(article, validKeywords, protocol.scoringSystem) : 0
          }));
        }
      }
      
      const newImportData = {
        database,
        searchString,
        articles: articles,
        importDate: new Date(),
        fileName: file.name
      };
      
      setImportedData(prev => [...prev, newImportData]);
      onImport(articles, database);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert('Erro ao processar o arquivo. Verifique o formato.');
    } finally {
      
      setPendingImport(null);
      setIsLoading(false);
    }
  };
  

      

  // const scopusData = importedData.filter(data => data.database === 'Scopus')
  // console.log('Scopus count:', scopusData.length);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        Seção 2: Importação de Dados
      </h2>

      {protocol.databases.length === 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg transition-colors duration-200">
          <p className="text-yellow-800 dark:text-yellow-300">
            ⚠ Defina primeiro as bases de dados no protocolo de pesquisa.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scopus */}
        {protocol.databases.includes('Scopus') && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 transition-colors duration-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mr-4">
                <Database className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Scopus</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importar CSV/RIS/BibTeX</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload do arquivo Scopus
                </label>
                <input
                  type="file"
                  accept=".csv,.ris,.bib,.txt"
                  onChange={(e) => handleImportRequest(e.target.files[0], 'Scopus')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 dark:hover:text-white dark:hover:bg-indigo-500 hover:text-black hover:bg-gray-200"
                  disabled={isLoadingState}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos: CSV, RIS, BibTeX
                </p>
              </div>
             
              {importedData.filter(data => data.database === 'Scopus').length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg transition-colors duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-orange-800 dark:text-orange-300">Status</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {importedData.filter(data => data.database === 'Scopus').map((data, index) => (
                    <div key={index} className="space-y-1 text-sm mb-3 last:mb-0">
                      <div className="flex justify-between">
                        <span className="text-orange-700 dark:text-orange-400">String {index + 1}:</span>
                        <span className="font-medium text-orange-800 dark:text-orange-300">{data.articles.length} artigos</span>
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-500 break-all">
                        {data.searchString.length > 80 ? data.searchString.substring(0, 80) + '...' : data.searchString}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600 dark:text-orange-400">Duplicatas:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {data.articles.filter(a => a.isDuplicate).length}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isLoadingState && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-orange-600 dark:text-orange-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Processando...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Web of Science */}
        {protocol.databases.includes('Web of Science') && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 transition-colors duration-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Web of Science</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importar CSV/RIS/BibTeX</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload do arquivo WoS
                </label>
                <input
                  type="file"
                  accept=".csv,.ris,.bib,.txt"
                  onChange={(e) => handleImportRequest(e.target.files[0], 'Web of Science')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 dark:hover:text-white dark:hover:bg-indigo-500 hover:text-black hover:bg-gray-200"
                  disabled={isLoadingState}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos: CSV, RIS, BibTeX
                </p>
              </div>

              {importedData.filter(data => data.database === 'Web of Science').length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-800 dark:text-blue-300">Status</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {importedData.filter(data => data.database === 'Web of Science').map((data, index) => (
                    <div key={index} className="space-y-1 text-sm mb-3 last:mb-0">
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-400">String {index + 1}:</span>
                        <span className="font-medium text-blue-800 dark:text-blue-300">{data.articles.length} artigos</span>
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-500 break-all">
                        {data.searchString.length > 80 ? data.searchString.substring(0, 80) + '...' : data.searchString}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 dark:text-blue-400">Duplicatas:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {data.articles.filter(a => a.isDuplicate).length}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isLoadingState && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Processando...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabela de dados importados */}
      {importedData.length > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Dados Importados por String e Base</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visualização detalhada dos artigos importados organizados por string de busca e base de dados
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Base de Dados
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    String de Busca
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Únicos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duplicatas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Data Import.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {importedData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        data.database === 'Scopus' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' :
                        data.database === 'Web of Science' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300'
                      }`}>
                        {data.database}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate" title={data.searchString}>
                        {data.searchString}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {data.articles.length}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {data.articles.filter(a => !a.isDuplicate).length}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {data.articles.filter(a => a.isDuplicate).length}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {data.importDate.toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumo geral da importação */}
      <div className="mt-8 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg transition-colors duration-200">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-4">Resumo da Importação</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {importedData.filter(d => d.database === 'Scopus').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Scopus</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {importedData.filter(d => d.database === 'Web of Science').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Web of Science</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {importedData.filter(d => d.database !== 'Scopus' && d.database !== 'Web of Science').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Outras Bases</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {importedData.reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          </div>
        </div>
      </div>

      {/* Modal para string de busca */}
      <SearchStringModal
        isOpen={showSearchStringModal !== null}
        onClose={() => {
          setShowSearchStringModal(null);
          setPendingImport(null);
        }}
        onConfirm={handleConfirmImport}
        database={showSearchStringModal}
      />
    </div>
  );
};

// Componente para Tratamento de Dados
const DataProcessingSection = ({ articles, currentFilter, setArticles, onUpdateStatus, detectDuplicates, statistics }) => {
    
  const [duplicateDetection, setDuplicateDetection] = useState({
    byTitle: true,
    byDOI: true,
    byAuthors: true,
    similarityThreshold: 1
  });

  const duplicates = articles.filter(a => a.isDuplicate);
  const unique = articles.filter(a => !a.isDuplicate);

  const handleClassifyDuplicates = () => {
    const statusField = 'dataProcessingStatus';
    
    // Marcar todas as duplicatas como excluídas
    articles.forEach(article => {
      if(article.isDuplicate){
        onUpdateStatus(article.id, statusField, 'duplicate', null);
        console.log(article)
      } 
      
    })

    // Mostrar mensagem de confirmação
    setTimeout(() => {
      alert(`${duplicates.length} duplicatas foram identificadas e classificadas automaticamente. Elas não avançarão para as próximas seções.`);
    }, 100);
  };



  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        Seção 3: Tratamento de Dados
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Artigos Importados</h3>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{articles.length}</p>
        </div>
        
        {/* <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Artigos Únicos</h3>
          <p className="text-2xl font-bold text-green-900 dark:text-green-200">{unique.length}</p>
        </div> */}
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Aprovados</h3>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">{statistics.dataProcessing.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Duplicatas</h3>
          <p className="text-2xl font-bold text-red-900 dark:text-red-200">{duplicates.length}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Configuração de Detecção de Duplicatas</h3>
          <div className="space-y-3">
            <span className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Os trabalhos duplicatos são identificados por meio da comparação do título, resumo e palavras-chaves</span>
          </div>
          
          <div className="mt-6 space-y-3">
            {/* <button
              onClick={detectDuplicates}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 mb-3"
            >
              <RefreshCw className="h-4 w-4" />
              Re-detectar Duplicatas
            </button> */}
            <button
              onClick={handleClassifyDuplicates}
              className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <Database className="h-4 w-4" />
              Classificar Duplicatas Automaticamente
            </button>
            
          </div>
        </div>
        
        <div>
          {/* <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Status do Tratamento</h3>
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg flex justify-between transition-colors duration-200">
              <span className="text-gray-700 dark:text-gray-300">Pendentes:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{statistics.dataProcessing.pending}</span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg flex justify-between transition-colors duration-200">
              <span className="text-green-700 dark:text-green-300">Incluídos:</span>
              <span className="font-semibold text-green-700 dark:text-green-300">{statistics.dataProcessing.included}</span>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg flex justify-between transition-colors duration-200">
              <span className="text-red-700 dark:text-red-300">Excluídos:</span>
              <span className="font-semibold text-red-700 dark:text-red-300">{statistics.dataProcessing.excluded}</span>
            </div>
          </div> */}
          
          {/* <div className="mt-4 p-4 border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 rounded-lg transition-colors duration-200">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Processo de Tratamento</h4>
            <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
              <li>• Identificação e remoção de duplicatas</li>
              <li>• Verificação de formato dos dados</li>
              <li>• Validação de metadados</li>
              <li>• Aprovação para análise posterior</li>
            </ul>
          </div> */}
        </div>
      </div>
    </div>
  );
};

// Componente para Filtro 1
const Filter1Section = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, statistics }) => {
  const filter1Articles = articles.filter(a => 
    a.dataProcessingStatus === 'included' && !a.isDuplicate && a.dataProcessingStatus !== 'duplicate'
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-green-600 dark:text-green-400" />
        Seção 4: Filtro 1 - Triagem por título, palavras-chave e resumo
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Tratamento</h3>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{filter1Articles.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos</h3>
          <p className="text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter1.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter1.excluded}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
      </div>

      
    </div>
  );
};

// Componente para Filtro 2
const Filter2Section = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, statistics }) => {
  const filter2Articles = articles.filter(a => a.filter1Status === 'included');
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        Seção 5: Filtro 2 - Triagem por introdução e conclusão
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Filtro 1</h3>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{filter2Articles.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos</h3>
          <p className="text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter2.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter2.excluded}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Componente para Filtro 3
const Filter3Section = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, statistics }) => {
  const filter3Articles = articles.filter(a => a.filter2Status === 'included');
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        Seção 6: Filtro 3 - Triagem por texto completo
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Filtro 2</h3>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{filter3Articles.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos Final</h3>
          <p className="text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter3.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter3.excluded}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>

        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de extração</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <li key={index}>• {criterion}</li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Componente melhorado para lista de artigos
const ArticlesList = ({ articles, currentFilter, onUpdateStatus, protocol }) => {
  const [pagination, setPagination] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  // Filtrar artigos baseado no status (pendente, incluído, excluído)
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showCriterionModal, setShowCriterionModal] = useState(null);
  const [itemsPerPage] = useState(20);
  const [contextMenu, setContextMenu] = useState(null);

  // Obter página atual para a seção específica
  const currentPage = pagination[currentFilter] || 1;
  
  const getStatusField = (filter) => {
    switch(filter) {
      case 'dataprocessing': return 'dataProcessingStatus';
      case 'filter1': return 'filter1Status';
      case 'filter2': return 'filter2Status';
      case 'filter3': return 'filter3Status';
      default: return 'dataProcessingStatus';
    }
  };


  const setCurrentPage = (page) => {
    setPagination(prev => ({
      ...prev,
      [currentFilter]: page
    }));
  };
  
  

  // Filtrar artigos baseado na seção atual
  const filteredArticles = useMemo(() => {
    let filtered = [];
    
    switch(currentFilter) {
      case 'dataprocessing':
        filtered = articles;
        // filtered = articles.filter(a => !a.isDuplicate);
        break;
      case 'filter1':
        filtered = articles.filter(a => 
          a.dataProcessingStatus === 'included' && !a.isDuplicate && a.dataProcessingStatus !== 'duplicate'
        );
      break;
      case 'filter2':
        filtered = articles.filter(a => a.filter1Status === 'included');
        break;
      case 'filter3':
        filtered = articles.filter(a => a.filter2Status === 'included');
        break;
      default:
        filtered = articles;
    }

    // Aplicar busca
    if (searchTerm) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.authors.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.journal.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar filtro de status
    if (statusFilter !== 'all') {
      const statusField = getStatusField(currentFilter);
      filtered = filtered.filter(article => {
        const status = article[statusField];
        return status === statusFilter;
      });
    }

    // Aplicar ordenação
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [articles, currentFilter, searchTerm, statusFilter, sortConfig]);

  
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredArticles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredArticles, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);

  // Resetar paginação quando os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleInclude = (article, criterion = null) => {
    const statusField = getStatusField(currentFilter);
    onUpdateStatus(article.id, statusField, 'included', null, criterion);
    setShowCriterionModal(null);
  };

  const handleExclude = (article, criterion = null) => {
    const statusField = getStatusField(currentFilter);
    onUpdateStatus(article.id, statusField, 'excluded', criterion);
    setShowCriterionModal(null);

    if(statusField === 'dataProcessingStatus'){
      onUpdateStatus(article.id, 'filter1Status', null, criterion)
      onUpdateStatus(article.id, 'filter2Status', null, criterion)
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
    if(statusField === 'filter1Status'){
      onUpdateStatus(article.id, 'filter2Status', null, criterion)
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
    if(statusField === 'filter2Status'){
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
  
  };

  const handleDuplicate = (article, criterion = null) => {
    const statusField = getStatusField(currentFilter);
    onUpdateStatus(article.id, statusField, 'duplicate', criterion);
    setShowCriterionModal(null);

    if(statusField === 'dataProcessingStatus'){
      onUpdateStatus(article.id, 'filter1Status', null, criterion)
      onUpdateStatus(article.id, 'filter2Status', null, criterion)
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
    if(statusField === 'filter1Status'){
      onUpdateStatus(article.id, 'filter2Status', null, criterion)
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
    if(statusField === 'filter2Status'){
      onUpdateStatus(article.id, 'filter3Status', null, criterion)
    }
  
  };

  const handleContextMenu = (e, article) => {
    e.preventDefault();
    
    // Não mostrar menu de contexto na seção de tratamento de dados
    if (currentFilter === 'dataprocessing') {
      return;
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      article: article
    });
  };

  const handleContextMenuAction = (action, criterion, article) => {
    if (action === 'include') {
      handleInclude(article, criterion);
    } else if (action === 'exclude') {
      handleExclude(article, criterion);
    }
    setContextMenu(null);
  };

  // Fechar menu de contexto ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    const handleScroll = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true); // true para capturar em qualquer elemento
      window.addEventListener('scroll', handleScroll);
      
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [contextMenu]);

  const getSectionTitle = () => {
    switch(currentFilter) {
      case 'dataprocessing': return 'Tratamento de Dados';
      case 'filter1': return 'Filtro 1';
      case 'filter2': return 'Filtro 2';
      case 'filter3': return 'Filtro 3';
      default: return 'Artigos';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
            Artigos para {getSectionTitle()} ({filteredArticles.length} total)
          </h3>
        </div>
        
        {/* Barra de busca e filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por título, autor ou revista..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="included">Incluídos</option>
              <option value="excluded">Excluídos</option>
              <option value="duplicate">Duplicatas</option> {/* ✅ NOVO */}
            </select>
          </div>
        </div>

      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Título
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <button
                  onClick={() => handleSort('source')}
                  className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Fonte
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <button
                  onClick={() => handleSort('year')}
                  className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Ano
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <button
                  onClick={() => handleSort('score')}
                  className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Score
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedArticles.map((article) => {
              const statusField = getStatusField(currentFilter);
              const status = article[statusField];
              
              return (
               
                <tr 
                  key={article.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  onContextMenu={(e) => handleContextMenu(e, article)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-md">
                      {article.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {article.authors}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      article.source === 'Scopus' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' :
                      article.source === 'Web of Science' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                      article.source === 'PubMed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                      'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300'
                    }`}>
                      {article.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {article.year}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (article.score || 0) > 5 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                        (article.score || 0) > 2 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                        (article.score || 0) > 0 ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400'
                      }`}>
                        {article.score || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      status === 'included' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                      status === 'excluded' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                      status === 'duplicate' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' : // ✅ NOVO
                      'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      {status === 'included' ? 'Incluído' : 
                      status === 'excluded' ? 'Excluído' : 
                      status === 'duplicate' ? 'Duplicata' : // ✅ NOVO
                      'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (currentFilter === 'dataprocessing') {
                            // incluir direto no filtro 1 sem abrir modal
                            handleInclude(article);
                          } else {
                            setShowCriterionModal({ type: 'include', article });
                          }
                        }}
                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 p-1 transition-colors duration-200"
                        title="Incluir"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (currentFilter === 'dataprocessing') {
                            // excluir direto sem abrir modal
                            handleDuplicate(article);
                          } else {
                            setShowCriterionModal({ type: 'exclude', article });
                          }
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"
                        
                        title={currentFilter === 'dataprocessing' ? "Duplicata" : "Excluir"}
                      >
                        {currentFilter === "dataprocessing" && (<BookCopy size={16} />)}
                        {currentFilter !== "dataprocessing" && (<XCircle size={16} />)}

                      </button>
                      {currentFilter !== "dataprocessing" && (
                        <button
                          onClick={() => setSelectedArticle(article)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 transition-colors duration-200"
                          title="Ver detalhes"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {currentFilter === "filter3" && (
                        <button
                          onClick={() => setSelectedArticle(article)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 transition-colors duration-200"
                          title="Ver detalhes"
                        >
                          <ListCollapse size={16} />
                        </button>
                      )}             
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Paginação */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Página {currentPage} de {totalPages} ({filteredArticles.length} artigos)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para seleção de critério */}
      <CriterionModal
        isOpen={showCriterionModal !== null}
        onClose={() => setShowCriterionModal(null)}
        onSelect={(criterion) => {
          if (showCriterionModal?.type === 'include') {
            handleInclude(showCriterionModal.article, criterion);
          } else {
            handleExclude(showCriterionModal.article, criterion);
          }
        }}
        criteria={showCriterionModal?.type === 'include' ? protocol.inclusionCriteria : protocol.exclusionCriteria}
        type={showCriterionModal?.type === 'include' ? 'inclusion' : 'exclusion'}
        title={showCriterionModal?.type === 'include' ? 'Selecionar Critério de Inclusão' : 'Selecionar Critério de Exclusão'}
      />
      
      {/* Modal de detalhes */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-colors duration-200">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedArticle.title}</h3>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-gray-700 dark:text-gray-300"><strong>Autores:</strong> {selectedArticle.authors}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Fonte:</strong> {selectedArticle.source}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Revista:</strong> {selectedArticle.journal}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Ano:</strong> {selectedArticle.year}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>DOI:</strong> {selectedArticle.doi}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Score:</strong> {selectedArticle.score}</div>
                {/* <div className="text-gray-700 dark:text-gray-300"><strong>Idioma:</strong> {selectedArticle.language}</div> */}
              </div>
              <div className="mb-4">
                <strong className="text-gray-700 dark:text-gray-300">Palavras-chave:</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedArticle.keywords.map((keyword, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs rounded-full">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <strong className="text-gray-700 dark:text-gray-300">Resumo:</strong>
                <p className="mt-2 text-gray-700 dark:text-gray-300">{selectedArticle.abstract}</p>
              </div>
              
              {/* {selectedArticle.inclusionCriterion && (
                <div className="mb-4">
                  <strong className="text-green-700 dark:text-green-300">Critério de Inclusão:</strong>
                  <p className="mt-1 text-green-600 dark:text-green-400 text-sm">{selectedArticle.inclusionCriterion}</p>
                </div>
              )}
              {selectedArticle.exclusionCriterion && (
                <div className="mb-4">
                  <strong className="text-red-700 dark:text-red-300">Critério de Exclusão:</strong>
                  <p className="mt-1 text-red-600 dark:text-red-400 text-sm">{selectedArticle.exclusionCriterion}</p>
                </div>
              )} */}
            </div>
          </div>
        </div>
      )}

      {/* Menu de contexto */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 z-50 min-w-[120px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 130),
            top: Math.min(contextMenu.y, window.innerHeight - 120)
          }}
        >
          {/* Opção Incluir com submenu */}
          <div className="relative group">
            <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors duration-150 cursor-pointer flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                <span>Incluir</span>
              </div>
              <ChevronDown className="h-3 w-3 text-gray-400 transform -rotate-90" />
            </div>
            
            {/* Submenu de critérios de inclusão */}
            <div 
              className={`absolute bottom-0 ml-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-[200px] max-w-[250px] max-h-[300px] overflow-y-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${
                contextMenu.x > window.innerWidth - 350 ? 'right-full mr-1 ml-0' : 'left-full'
              }`}
            >
              <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-600 mb-1 sticky top-0 bg-white dark:bg-gray-800">
                Critérios de Inclusão
              </div>
              {protocol.inclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <button
                  key={`inc-${index}`}
                  onClick={() => handleContextMenuAction('include', criterion, contextMenu.article)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors duration-150"
                  title={criterion}
                >
                  <span className="block truncate">
                    {criterion.length > 35 ? criterion.substring(0, 35) + '...' : criterion}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>

          {/* Opção Excluir com submenu */}
          <div className="relative group">
            <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-150 cursor-pointer flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                <span>Excluir</span>
              </div>
              <ChevronDown className="h-3 w-3 text-gray-400 transform -rotate-90" />
            </div>
            
            {/* Submenu de critérios de exclusão */}
            <div 
              className={`absolute bottom-0 ml-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-[200px] max-w-[250px] max-h-[300px] overflow-y-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${
                contextMenu.x > window.innerWidth - 350 ? 'right-full mr-1 ml-0' : 'left-full'
              }`}
            >
              <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-600 mb-1 sticky top-0 bg-white dark:bg-gray-800">
                Critérios de Exclusão
              </div>
              {protocol.exclusionCriteria.filter(c => c.trim()).map((criterion, index) => (
                <button
                  key={`exc-${index}`}
                  onClick={() => handleContextMenuAction('exclude', criterion, contextMenu.article)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-150"
                  title={criterion}
                >
                  <span className="block truncate">
                    {criterion.length > 35 ? criterion.substring(0, 35) + '...' : criterion}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      
    </div>
  );
};

// Componente principal
const SystematicReviewTool = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState('protocol');
  const { theme, toggleTheme } = useTheme();
  const [importedData, setImportedData] = useState([]);

  // Estado do protocolo
  const [protocol, setProtocol] = useState({
    title: '',
    researchQuestion: '',
    yearRange: { start: 2015, end: 2024 },
    languages: ['English'],
    keywords: [''],
    inclusionCriteria: [''],
    exclusionCriteria: [''],
    qualityCriteria: [''],
    databases: [],
    scoringSystem: {
    enabled: true,
    weights: {
      title: 3,      // Peso para keywords no título
      abstract: 2,   // Peso para keywords no resumo
      keywords: 1    // Peso para keywords nas palavras-chave
    },
    caseInsensitive: true,
    exactMatch: false, // false = busca parcial, true = palavra completa
    multipleOccurrences: false // contar múltiplas ocorrências da mesma keyword
  }
  });

  // Estado de salvamento
  const [autoSaveInterval, setAutoSaveInterval] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  
  // Auto-save setup
  useEffect(() => {
    const getState = () => ({
      protocol,
      articles,
      currentSection,
      importedData
    });

    const interval = setupAutoSave(getState, 5);
    setAutoSaveInterval(interval);

    const autoSaveResult = loadAutoSave();
    if (autoSaveResult.success && autoSaveResult.data.articles?.length > 0) {
      const shouldRestore = window.confirm(
        `Backup automático encontrado de ${new Date(autoSaveResult.data.metadata?.autoSavedAt || Date.now()).toLocaleString()}. Restaurar?`
      );
      
      if (shouldRestore) {
        restoreState(autoSaveResult.data);
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Detectar mudanças
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [articles, protocol, currentSection, importedData]);

  // Warning antes de fechar
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => setShowFileMenu(false);
    if (showFileMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFileMenu]);

  // Função para calcular pontuação de um artigo
  const calculateArticleScore = useCallback((article, protocolKeywords, scoringConfig) => {
    if (!scoringConfig.enabled || !protocolKeywords.length) return 0;
    
    let totalScore = 0;
    const { weights, caseInsensitive, exactMatch, multipleOccurrences } = scoringConfig;
    
    protocolKeywords.forEach(keyword => {
      if (!keyword.trim()) return;
      
      const searchKeyword = caseInsensitive ? keyword.toLowerCase() : keyword;
      let keywordScore = 0;
      
      const countOccurrences = (text, searchTerm) => {
        if (!text) return 0;
        
        const searchText = caseInsensitive ? text.toLowerCase() : text;
        
        if (exactMatch) {
          const regex = new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          const matches = searchText.match(regex);
          return matches ? matches.length : 0;
        } else {
          if (multipleOccurrences) {
            const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const matches = searchText.match(regex);
            return matches ? matches.length : 0;
          } else {
            return searchText.includes(searchTerm) ? 1 : 0;
          }
        }
      };
      
      const titleCount = countOccurrences(article.title, searchKeyword);
      const abstractCount = countOccurrences(article.abstract, searchKeyword);
      const keywordsCount = countOccurrences(article.keywords?.join(' '), searchKeyword);
      
      if (multipleOccurrences) {
        keywordScore += titleCount * weights.title;
        keywordScore += abstractCount * weights.abstract;
        keywordScore += keywordsCount * weights.keywords;
      } else {
        keywordScore += (titleCount > 0 ? 1 : 0) * weights.title;
        keywordScore += (abstractCount > 0 ? 1 : 0) * weights.abstract;
        keywordScore += (keywordsCount > 0 ? 1 : 0) * weights.keywords;
      }
      
      totalScore += keywordScore;
    });
    
    return totalScore;
  }, []);

  // Função para remover duplicatas permanentemente
  const removeDuplicateArticles = useCallback((duplicateIds) => {
    setArticles(prev => prev.filter(article => !duplicateIds.includes(article.id)));
  }, []);

  // Disponibilizar função globalmente
  useEffect(() => {
    window.removeDuplicateArticles = removeDuplicateArticles;
    
    return () => {
      delete window.removeDuplicateArticles;
    };
  }, [removeDuplicateArticles]);


  // Função para recalcular todas as pontuações
  const recalculateAllScores = useCallback(() => {
    if (!protocol.scoringSystem.enabled) return;
    
    const validKeywords = protocol.keywords.filter(k => k.trim());
    if (validKeywords.length === 0) return;
    
    setArticles(prev => prev.map(article => ({
      ...article,
      score: calculateArticleScore(article, validKeywords, protocol.scoringSystem)
    })));
  }, [protocol.keywords, protocol.scoringSystem, calculateArticleScore]);

// useEffect para recálculo automático de pontuações
  useEffect(() => {
    // Disponibilizar funções globalmente
    window.recalculateAllScores = recalculateAllScores;
    window.calculateArticleScore = calculateArticleScore;
    
    // Auto-recalcular quando keywords ou configurações mudarem
    if (articles.length > 0 && protocol.scoringSystem?.enabled) {
      const timeoutId = setTimeout(() => {
        recalculateAllScores();
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timeoutId);
    }
    
    return () => {
      delete window.recalculateAllScores;
      delete window.calculateArticleScore;
    };
  }, [protocol.keywords, protocol.scoringSystem, articles.length, recalculateAllScores, calculateArticleScore]);

  const handleSaveProject = () => {
    const state = { protocol, articles, currentSection, importedData };
    const result = saveProjectToFile(state);
    
    if (result.success) {
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      clearAutoSave();
      alert(`Projeto salvo: ${result.filename}`);
    } else {
      alert(`Erro: ${result.error}`);
    }
  };

  const handleLoadProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (hasUnsavedChanges) {
      const shouldProceed = window.confirm('Há alterações não salvas. Continuar?');
      if (!shouldProceed) {
        event.target.value = '';
        return;
      }
    }

    loadProjectFromFile(file)
      .then(result => {
        if (result.success) {
          restoreState(result.data);
          setHasUnsavedChanges(false);
          clearAutoSave();
          
          const message = result.migrated 
            ? `Projeto carregado e migrado da versão ${result.originalVersion}`
            : 'Projeto carregado com sucesso!';
          alert(message);
        }
      })
      .catch(error => {
        alert(`Erro ao carregar: ${error.error}`);
      });

    event.target.value = '';
  };

  const handleNewProject = () => {
    if (hasUnsavedChanges && !window.confirm('Há alterações não salvas. Continuar?')) {
      return;
    }

    setProtocol({
      title: '',
      researchQuestion: '',
      yearRange: { start: 2015, end: 2024 },
      keywords: [''],
      languages: ['English'],
      inclusionCriteria: [''],
      exclusionCriteria: [''],
      qualityCriteria: [''],
      databases: []
    });
    setArticles([]);
    setCurrentSection('protocol');
    setImportedData([]);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    clearAutoSave();
  };

  const restoreState = (data) => {
    setProtocol(data.protocol || {});
    setArticles(data.articles || []);
    setCurrentSection(data.currentSection || 'protocol');
    setImportedData(data.importedData || []);
    setLastSaved(data.metadata?.savedAt ? new Date(data.metadata.savedAt) : null);
  };

  // Estatísticas calculadas
  // Substituir o cálculo das estatísticas (linha ~1147)
  const statistics = useMemo(() => {
    const dataProcessing = {
      pending: articles.filter(a => a.dataProcessingStatus === 'pending' && !a.isDuplicate).length,
      included: articles.filter(a => a.dataProcessingStatus === 'included' && !a.isDuplicate).length,
      excluded: articles.filter(a => a.dataProcessingStatus === 'excluded').length,
      duplicate: articles.filter(a => a.dataProcessingStatus === 'duplicate' || a.isDuplicate).length
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
  }, [articles]);
    
  const handleImport = useCallback((newArticles, source) => {
    setLoading(true);
    // setTimeout(() => {
      setArticles(prev => [...prev, ...newArticles]);
      setLoading(false);
    // }, 1500);
  }, []);
  
  const handleUpdateStatus = useCallback((id, statusType, status, reason = null, criterion = null) => {
    setArticles(prev => prev.map(article => 
      article.id === id 
        ? { 
            ...article, 
            [statusType]: status, 
            exclusionReason: reason,
            inclusionCriterion: status === 'included' ? criterion : article.inclusionCriterion,
            exclusionCriterion: status === 'excluded' ? reason : article.exclusionCriterion,
            lastModified: new Date() 
          }
        : article
    ));
  }, []);

  // Função para detectar duplicatas por diferentes critérios
  const detectDuplicates = useCallback(() => {
    const duplicatesByDOI = new Map();
    const duplicatesByTitle = new Map();
    const duplicatesByAuthorsYear = new Map();
    
    articles.forEach(article => {
      if (article.isDuplicate) return; // Pular se já é marcado como duplicata
      
      // Detectar por DOI
      if (article.doi && duplicatesByDOI.has(article.doi)) {
        article.isDuplicate = true;
        article.duplicateOf = duplicatesByDOI.get(article.doi);
      } else if (article.doi) {
        duplicatesByDOI.set(article.doi, article.id);
      }
      
      // Detectar por título 
      const normalizedTitle = article.title.toLowerCase().trim();
      if (duplicatesByTitle.has(normalizedTitle)) {
        article.isDuplicate = true;
        article.duplicateOf = duplicatesByTitle.get(normalizedTitle);
      } else {
        duplicatesByTitle.set(normalizedTitle, article.id);
      }
      
      // Detectar por autores + ano
      // const authorYearKey = `${article.authors.toLowerCase()}_${article.year}`;
      // if (duplicatesByAuthorsYear.has(authorYearKey)) {
      //   article.isDuplicate = true;
      //   article.duplicateOf = duplicatesByAuthorsYear.get(authorYearKey);
      // } else {
      //   duplicatesByAuthorsYear.set(authorYearKey, article.id);
      // }
    });

    setArticles(articles);
    console.log(articles.filter(a => a.isDuplicate).length);
  }, [articles]);

  const FileMenu = () => (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowFileMenu(!showFileMenu)}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        Arquivo
        <ChevronDown className={`h-4 w-4 transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
      </button>

      {showFileMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 z-50">
          <button
            onClick={handleNewProject}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Novo Projeto
          </button>
          
          <label className="w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" />
            Abrir Projeto
            <input
              type="file"
              accept=".srp,.json"
              onChange={handleLoadProject}
              className="hidden"
            />
          </label>
          
          <button
            onClick={handleSaveProject}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Salvar Projeto
            {hasUnsavedChanges && <span className="text-red-500 text-xs">●</span>}
          </button>
        </div>
      )}
    </div>
  );

  const StatusIndicator = () => (
    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      {hasUnsavedChanges && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          Não salvo
        </span>
      )}
      {lastSaved && (
        <span className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4 text-green-600" />
          Salvo: {lastSaved.toLocaleTimeString()}
        </span>
      )}
    </div>
  );

  const sections = [
    { id: 'protocol', name: 'Protocolo', icon: Settings },
    { id: 'import', name: 'Importação', icon: Upload },
    { id: 'dataprocessing', name: 'Tratamento', icon: Database },
    { id: 'filter1', name: 'Filtro 1', icon: Filter },
    { id: 'filter2', name: 'Filtro 2', icon: Filter },
    { id: 'filter3', name: 'Filtro 3', icon: Filter }
  ];

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 m-0 p-0 transition-colors duration-200">
      <div className="w-full h-full px-4 py-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Sistema de Revisão Bibliográfica Sistemática
              </h1>
              <StatusIndicator />
            </div>
            
            <div className="flex items-center gap-3">
              <FileMenu />
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </div>
          </div>
          
          {/* Navegação entre seções */}
          <nav className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(section.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 ${
                    currentSection === section.id
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon size={16} />
                  {section.name}
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Resumo geral */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {protocol.title ? '✓' : '○'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Protocolo</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{articles.length}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Importados</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.dataProcessing.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Tratados</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter1.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Filtro 1</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter2.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Filtro 2</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter3.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Final</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Conteúdo das seções */}
        {currentSection === 'protocol' && (
          <ProtocolSection protocol={protocol} onUpdateProtocol={setProtocol} />
        )}
        
        {currentSection === 'import' && (
          <ImportSection 
            articles={articles}
            onImport={handleImport} 
            isLoading={loading} 
            protocol={protocol} 
            importedData={importedData}
            setImportedData={setImportedData}
            detectDuplicates={detectDuplicates}/>
        )}
        
        {currentSection === 'dataprocessing' && (
          <DataProcessingSection 
            articles={articles}
            currentFilter={currentSection}
            setArticles={setArticles}
            onUpdateStatus={handleUpdateStatus}
            statistics={statistics}
            detectDuplicates={detectDuplicates}
            // handleExclude={handleUpdateStatus}
          />
        )}

        {currentSection === 'filter1' && (
          <Filter1Section 
            articles={articles}
            onUpdateStatus={handleUpdateStatus}
            inclusionCriteria = {protocol.inclusionCriteria}
            exclusionCriteria = {protocol.exclusionCriteria}
            statistics={statistics}
          />
        )}
        
        {currentSection === 'filter2' && (
          <Filter2Section 
            articles={articles}
            onUpdateStatus={handleUpdateStatus}
            inclusionCriteria = {protocol.inclusionCriteria} 
            exclusionCriteria = {protocol.exclusionCriteria}
            statistics={statistics}
          />
        )}
        
        {currentSection === 'filter3' && (
          <Filter3Section 
            articles={articles}
            onUpdateStatus={handleUpdateStatus}
            inclusionCriteria = {protocol.inclusionCriteria} 
            exclusionCriteria = {protocol.exclusionCriteria}
            statistics={statistics}
          />
        )}
        
        {/* Lista de artigos para a seção atual */}
        {(currentSection === 'dataprocessing' || currentSection === 'filter1' || currentSection === 'filter2' || currentSection === 'filter3') && (
          <ArticlesList 
            articles={articles}
            currentFilter={currentSection}
            onUpdateStatus={handleUpdateStatus}
            protocol={protocol}
          />
        )}

        
      </div>
    </div>
  );
};

export default SystematicReviewTool;