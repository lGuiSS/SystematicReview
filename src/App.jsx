import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, ChartArea, Download, Table, Upload, CheckCircle, Check, XCircle, BookCopy, List, ListCollapse, Clock, BarChart3, FileText, Users, Calendar, Database,DatabaseBackup,  Trash2, RefreshCw, Settings, BookOpen, Globe, Sun, Moon, ArrowUpDown, ChevronDown, Eye, PlusCircle, X, ChevronRight, CopyX, CopyCheck} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import * as htmlToImage from 'html-to-image';
import { toSvg, toPng } from 'html-to-image';
import htmlToSvg from "htmlsvg";
import { TooltipProvider, TooltipContext, Tip } from "./Tooltip";
import ArticleModal from "./ArticleModal.jsx"
import { Tooltip as ReactTooltip} from 'react-tooltip'
// import { ReactFlow } from '@xyflow/react';
import StatisticsSection from "./Statisticssection.jsx"
// import {
//   Line, Bar, Cell, Pie, PieChart, XAxis, YAxis,
//   CartesianGrid, Tooltip, Legend, ComposedChart, BarChart,
// } from 'recharts';
// import FileSaver from 'file-saver';
// import ExcelJS from "exceljs";

import { 
  saveProjectToFile, 
  loadProjectFromFile, 
  setupAutoSave, 
  loadAutoSave, 
  clearAutoSave 
} from './fileSystem.js';

import countryPatternsData from './countryPatterns_r1.json';
// import * as XLSX from 'xlsx-js-style';
import ExcelJS from "exceljs";

import { useCurrentPng, useGenerateImage } from "recharts-to-png";

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
  // console.log(theme)
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
function getPubMedField(record, field, multi = false) {
  // Captura a linha da tag + todas as linhas de continuação (6 espaços)
  const regex = new RegExp(
    `^${field}\\s{1,3}-\\s(.+?)(?=\\n[A-Z]{2,4}\\s*-|\\n\\s*$)`,
    //  ^^^^^^^^^^^^^^^^^^          aqui: \s* em vez de \s{1,3} ^^^
    "gms"
  );

  const matches = [];

  for (const match of record.matchAll(regex)) {
    const value = match[1]
      .replace(/\n\s{6}/g, " ") // Une linhas de continuação
      .replace(/\s+/g, " ")     // Normaliza espaços múltiplos
      .trim();

    matches.push(value);
  }

  if (matches.length === 0) return null;

  return multi ? matches : matches[0];
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

function splitPubmedEntries(pubmedContent) {
  const entries = [];

  // Registros MEDLINE são separados por linha em branco e sempre iniciam com PMID-
  const entryRegex = /(?=^PMID-\s)/gm;
  const matches = [...pubmedContent.matchAll(entryRegex)];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? pubmedContent.length;
    const entry = pubmedContent.substring(start, end).trim();

    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}



const extractCountriesFromAffiliation =  (affiliation) => {
  if (!affiliation) return [];
  
  const affiliationLines = affiliation.split(/\n|;/).filter(line => line.trim());
  
  const countryPatterns = countryPatternsData.map(item => ({
  regex: new RegExp(`\\b${item.name}\\b|${item.officialName}|${item.nativeName}`, "i"),
  country: item.name
}));


  const countries = new Set();
  affiliationLines.forEach(line => {
    countryPatterns.forEach(({ regex, country }) => {
      if (regex.test(line)) {
        countries.add(country);
      }
    });
  });

  return Array.from(countries);
};

const importedBibtexArticles = (bibtexContent, source = 'Scopus', numString=1, articlesLength) => {
  // Dividir o conteúdo em entradas individuais
  const entries = splitBibtexEntries(bibtexContent);

  const importedArticles = entries.map((fullEntry, index) => {
    const affiliations = getField(fullEntry, "affiliations") || getField(fullEntry, "Affiliation") || 'Afiliação não informada';
    const countries = affiliations !== 'Afiliação não informada' 
                      ? extractCountriesFromAffiliation(affiliations) 
                      : 'País não informado'
    return {
      id: `${source.toLowerCase().replace(/\s+/g, '_')}_${articlesLength + index + 1}`,
      title: getField(fullEntry, "title") || getField(fullEntry, "Title") || `Título não encontrado ${index + 1}`,
      authors: getField(fullEntry, "author") || getField(fullEntry, "Author") || 'Autor não informado',
      affiliations: affiliations || 'Afiliação não informada',
      countries: countries || 'País não informado',
      journal: getField(fullEntry, "journal") || getField(fullEntry, "booktitle") || getField(fullEntry, "Journal") || getField(fullEntry, "Booktitle") || 'Revista não informada',
      year: parseInt(getField(fullEntry, "year")) || parseInt(getField(fullEntry, "Year")) || 'Ano não informado',
      score: null,
      abstract: getField(fullEntry, "abstract") || getField(fullEntry, "Abstract") || 'Resumo não disponível',
      keywords: getField(fullEntry, "keywords")?.split(";").map(k => k.trim()) || getField(fullEntry, "Keywords")?.split(";").map(k => k.trim()) || [],
      studyType: getField(fullEntry, "type") || getField(fullEntry, "Type") || 'Não especificado',
      quality: null,
      doi: getField(fullEntry, "doi") || getField(fullEntry, "DOI"),
      language: getField(fullEntry, "language") || getField(fullEntry, "Language") || 'Não informado',
      source: source,
      numString: numString,
      isDuplicate: false,
      duplicateOf: null,
      dataProcessingStatus: 'pending',
      filter1Status: 'pending',
      filter2Status: 'pending',
      filter3Status: 'pending',
      exclusionReason: null,
      inclusionCriterion: null,
      exclusionCriterion: null,
      extractionCriteria: null,
      searchString: null,
      importDate: new Date(),
      lastModified: new Date()
    };
  });

  return importedArticles.filter(article => !article.title.startsWith('Título não encontrado'));


};

const importedPubmedArticles = (pubmedContent, source = 'PubMed', numString = 1, articlesLength) => {
  const entries = splitPubmedEntries(pubmedContent);

  const importedArticles = entries.map((fullEntry, index) => {
    // Autores: FAU = nome completo, AU = abreviado
    const authorsArray = getPubMedField(fullEntry, "FAU", true) || 
                         getPubMedField(fullEntry, "AU",  true);
    const authors = authorsArray?.join("; ") || 'Autor não informado';

    // Afiliações: AD repete na mesma ordem que FAU
    const affiliationsArray = getPubMedField(fullEntry, "AD", true);
    const affiliations = affiliationsArray?.join(" | ") || 'Afiliação não informada';

    const countries = affiliations !== 'Afiliação não informada'
      ? extractCountriesFromAffiliation(affiliations)
      : 'País não informado';

    // Ano extraído do campo DP (ex: "2020 Jul")
    const dp = getPubMedField(fullEntry, "DP");
    const yearMatch = dp?.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : 'Ano não informado';

    // DOI extraído do campo AID (ex: "10.1016/j.x [doi]")
    const aidFields = getPubMedField(fullEntry, "AID", true) || [];
    const doiEntry = aidFields.find(a => a.includes("[doi]"));
    const doi = doiEntry?.replace(/\s*\[doi\]/, "").trim() || null;

    // Keywords: OT = autor, MH = MeSH
    const keywordsArray = getPubMedField(fullEntry, "OT", true) || 
                          getPubMedField(fullEntry, "MH", true) || [];

    // Tipo de publicação (ex: "Journal Article", "Review")
    const pubTypeArray = getPubMedField(fullEntry, "PT", true) || [];
    const studyType = pubTypeArray.join("; ") || 'Não especificado';

    return {
      id: `${source.toLowerCase().replace(/\s+/g, '_')}_${articlesLength + index + 1}`,
      title:        getPubMedField(fullEntry, "TI")   || `Título não encontrado ${index + 1}`,
      authors,
      affiliations,
      countries,
      journal:      getPubMedField(fullEntry, "JT")   || 
                    getPubMedField(fullEntry, "TA")    || 'Revista não informada',
      year,
      score:        null,
      abstract:     getPubMedField(fullEntry, "AB")   || 'Resumo não disponível',
      keywords:     keywordsArray,
      studyType,
      quality:      null,
      doi,
      language:     getPubMedField(fullEntry, "LA")   || 'Não informado',
      pmid:         getPubMedField(fullEntry, "PMID")  || null,
      source,
      numString,
      isDuplicate:          false,
      duplicateOf:          null,
      dataProcessingStatus: 'pending',
      filter1Status:        'pending',
      filter2Status:        'pending',
      filter3Status:        'pending',
      exclusionReason:      null,
      inclusionCriterion:   null,
      exclusionCriterion:   null,
      extractionCriteria:   null,
      searchString:         null,
      importDate:           new Date(),
      lastModified:         new Date()
    };
  });

  return importedArticles.filter(article => !article.title.startsWith('Título não encontrado'));
};

const Overlay = ({ children, footer, onClose }) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50"
    // onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-3xl flex flex-col transition-colors duration-200"
      style={{ maxHeight: '92dvh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {footer}
    </div>
  </div>
);

// Modal para seleção de critérios
const MultiSelect = ({ isOpen, onClose, options, onSelect, type, criteria, initialSelected = [], initialValues = [] }) => {
  const [isOpenDrop, setIsOpenDrop] = useState(false);
  const [selected, setSelected] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [resultsExtraction, setResultsExtraction] = useState([]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selected.find(s => s.id === opt.id)
  );

  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    if (!acc[opt.category]) acc[opt.category] = [];
    acc[opt.category].push(opt);
    return acc;
  }, {});

  // Deve ficar ANTES do `if (!isOpen) return null` para o cleanup rodar ao fechar
  useEffect(() => {
    if (isOpen) {
      // document.body.style.overflowY = 'hidden';
      setSelected(initialSelected); // era setSelected([])
      setSearchTerm('');
      setIsOpenDrop(false);
    } else {
      // document.body.style.overflowY = '';
    }
    // return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpenDrop(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const initialResults = criteria.map(criterion => ({
      id:       criterion.id,
      label:    criterion.value,
      type:     criterion.type,
      response: criterion.type === 'text' ? '' : [],
    }));
    setResultsExtraction(initialResults);
  }, []);

  const toggleOption = (option) => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === option.id);
      return exists ? prev.filter(s => s.id !== option.id) : [...prev, option];
    });
  };

  const removeOption = (id) => setSelected(prev => prev.filter(s => s.id !== id));
  const selectAll    = () => setSelected(options);
  const clearAll     = () => setSelected([]);

  const handleCriteriaChange = useCallback((index, value, isCheckbox = false) => {
    if (isCheckbox) {
      setResultsExtraction(prev => prev.map((item, i) => {
        if (i !== index) return item;
        const cur = Array.isArray(item.response) ? item.response : [];
        const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
        return { ...item, response: next };
      }));
    } else {
      setResultsExtraction(prev =>
        prev.map((item, i) => i === index ? { ...item, response: value } : item)
      );
    }
  }, []);

  if (!isOpen) return null;

  // ── Critérios de inclusão/exclusão ───────────────────────────────────────
  if (type !== 'extraction') {
    return (
      <Overlay
        onClose={onClose}
        footer={
          <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl sm:rounded-b-xl">
            <button
              onClick={() => onSelect(selected, 'included')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60"
            >
              <CheckCircle size={16} />
              Incluir
            </button>
            <button
              onClick={() => onSelect(selected, 'excluded')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium touch-manipulation active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60"
            >
              <XCircle size={16} />
              Excluir
            </button>
          </div>
        }
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {/* Drag handle — mobile only */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full sm:hidden" />
          <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white mt-2 sm:mt-0">
            Selecionar Critérios
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            <XCircle size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4" ref={dropdownRef}>

          {/* Search Input */}
          <div
            className={`border-2 rounded-lg p-3 cursor-text transition mb-4 ${
              isOpenDrop
                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            } bg-white dark:bg-gray-700`}
            onClick={() => { setIsOpenDrop(true); inputRef.current?.focus(); }}
          >
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selected.map(item => (
                  <span
                    key={item.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${
                      item.category === 'inclusion' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      item.category === 'exclusion' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    }`}
                  >
                    {item.label}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeOption(item.id); }}
                      className="hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors touch-manipulation"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsOpenDrop(true)}
                placeholder={selected.length === 0 ? 'Buscar e adicionar critérios...' : 'Buscar mais critérios...'}
                className="flex-1 outline-none bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400"
              />
              <ChevronDown size={18} className={`text-gray-400 transition-transform flex-shrink-0 ${isOpenDrop ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 mb-4 text-sm">
            <button onClick={selectAll} className="text-gray-600 dark:text-white font-medium bg-transparent border-none p-0 cursor-pointer">
              Selecionar todos
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={clearAll} className="text-gray-600 dark:text-white font-medium bg-transparent border-none p-0 cursor-pointer">
              Limpar
            </button>
            <span className="ml-auto text-gray-500 dark:text-gray-400 font-medium">
              {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Dropdown Options */}
          {isOpenDrop && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
              {Object.keys(groupedOptions).length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <p className="text-sm">Nenhuma opção encontrada</p>
                </div>
              ) : (
                Object.entries(groupedOptions).map(([category, items], idx) => (
                  <div key={category}>
                    {idx > 0 && <div className="border-t border-gray-200 dark:border-gray-700" />}
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 font-semibold text-sm text-gray-700 dark:text-gray-300">
                      {category === 'inclusion' ? 'Critérios de Inclusão' :
                       category === 'exclusion' ? 'Critérios de Exclusão' : 'Critérios de Qualidade'}
                    </div>
                    {items.map((option, optIdx) => {
                      const isSelected = selected.find(s => s.id === option.id);
                      return (
                        <div key={option.id}>
                          {optIdx > 0 && <div className="border-t border-gray-100 dark:border-gray-800" />}
                          <div
                            onClick={() => toggleOption(option)}
                            className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors touch-manipulation ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                            {isSelected && <Check size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Selected Summary */}
          {selected.length > 0 && (
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">
                Resumo dos critérios selecionados:
              </h3>
              <div className="space-y-2">
                {selected.map(item => (
                  <div key={item.id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      item.category === 'inclusion' ? 'bg-green-500' :
                      item.category === 'exclusion' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <span className="font-medium flex-shrink-0">{item.id}</span>
                    <span className="flex-shrink-0">-</span>
                    <span className="flex-1 break-words">{item.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      ({item.category === 'inclusion' ? 'Inclusão' :
                        item.category === 'exclusion' ? 'Exclusão' : 'Qualidade'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Overlay>
    );
  }

  // ── Extração ─────────────────────────────────────────────────────────────
  return (
    <Overlay
      footer={
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSelect(resultsExtraction, 'extracted')}
            className="flex-1 sm:flex-none px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm"
          >
            Confirmar
          </button>
        </div>
      }
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full sm:hidden" />
        <h3 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white mt-2 sm:mt-0">
          Critérios de Extração
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        >
          <XCircle size={22} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
        <div className="space-y-4">
          {criteria.map((criterion, index) =>
            criterion.value !== '' && (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {criterion.value}
                </label>

                {criterion.type === 'text' && (
                  <textarea
                    rows={3}
                    onChange={(e) => handleCriteriaChange(index, e.target.value)}
                    value={resultsExtraction[index]?.response || ''}
                    placeholder="Digite sua resposta..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                               focus:ring-2 focus:ring-orange-500 focus:border-transparent
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               transition-colors duration-200 resize-none"
                  />
                )}

                {criterion.type === 'Pick on List' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {criterion.items?.map((item, itemIndex) => (
                      <label
                        key={itemIndex}
                        className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors touch-manipulation"
                      >
                        <input
                          type="radio"
                          name={`criterion-${index}`}
                          onChange={() => handleCriteriaChange(index, item)}
                          checked={resultsExtraction[index]?.response === item}
                          value={item}
                          className="w-4 h-4 text-orange-500 border-gray-300 dark:border-gray-600 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {criterion.type === 'Pick on Many' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {criterion.items?.map((item, itemIndex) => {
                      const isChecked = Array.isArray(resultsExtraction[index]?.response)
                        && resultsExtraction[index].response.includes(item);
                      return (
                        <label
                          key={itemIndex}
                          className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors touch-manipulation"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => { e.stopPropagation(); handleCriteriaChange(index, item, true); }}
                            className="w-4 h-4 text-orange-500 border-gray-300 dark:border-gray-600 rounded flex-shrink-0"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </Overlay>
  );
};


// Componente para definição do protocolo
const ProtocolSection = ({ protocol, onUpdateProtocol }) => {
  const [selectedExCriteria, setSelectedExCriteria] = useState(null);
  const [selectedInExCriteria, setSelectedInExCriteria] = useState(null);

  const x = useCallback((field, value) => {
    
    
  }, [onUpdateProtocol]);
  
  // console.log(selectedExCriteria)
  const handleProtocolChange = useCallback((field, value) => {
    onUpdateProtocol(prev => ({
      ...prev,
      [field]: value
    }));
  }, [onUpdateProtocol]);

  const handleCriteriaChange = useCallback((type, index, value, atr, subIndex) => {
    if(type === 'extractionCriteria'){
      if(atr === 'items'){
        onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].map((item, i) => 
          i === index 
            ? {
                ...item,
                [atr]: item[atr].map((subItem, j) =>
                  j === subIndex ? value : subItem
                )
              }
            : item
        )
        }));
      }else{
        onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].map((item, i) =>  i === index ? 
          {...item, [atr]: value}
          : item
        )
      }));
      }
    }else if (type === 'inclusionCriteria' || type === 'exclusionCriteria' || type === 'qualityCriteria'){
      onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].map((item, i) =>  i === index ? 
          {...item, [atr]: value}
          : item
        )
      }));
    }
    else{
      onUpdateProtocol(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? value : item)
    }));
    }
    
  }, [onUpdateProtocol]);
  const addCriteria = useCallback((type, atr, index,length) => {
    if(type === 'extractionCriteria'){
      if(atr === 'items'){
        onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].map((item, i) => 
          i === index 
            ? {
                ...item,
                items: [...item.items, '']  // Adiciona '' no final do array items
              }
            : item
        )
        }));
        }else{
          onUpdateProtocol(prev => ({
            ...prev,
            [type]: [...prev[type], {id:`EX${length+1}`, value:'', type:'text', items: ['']}]
          }))
        }
      }else if (type === 'inclusionCriteria' || type === 'exclusionCriteria' || type === 'qualityCriteria'){
        let ind
        ind = type === 'inclusionCriteria'? 'I': type === 'exclusionCriteria'? 'E': 'Q'
        onUpdateProtocol(prev => ({
          ...prev,
          [type]: [...prev[type], {id:`${ind}${length+1}`, value:''}]
        }))
      }else{
        onUpdateProtocol(prev => ({
          ...prev,
          [type]: [...prev[type], '']
      }))}
  }, [onUpdateProtocol]);

  const removeCriteria = useCallback(({type, index, atr, subIndex, length}) => {
    if(type === 'extractionCriteria'){
      if(atr === 'items'){
        onUpdateProtocol(prev => ({
          ...prev,
          [type]: prev[type].map((item, i) => 
            i === index 
              ? {
                  ...item,
                  items: item.items.filter((_, j) => j !== subIndex)  // Remove o item no subIndex
                }
              : item
          )
        }));
      }else{
        onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].filter((_, i) => i !== index)
      }));
      }
    }else{
      onUpdateProtocol(prev => ({
        ...prev,
        [type]: prev[type].filter((_, i) => i !== index)
      }));
    }
    
    
  }, [onUpdateProtocol]);
  
  
  const handleSeExCriteria = useCallback((criteria, index) => {
    setSelectedExCriteria(criteria)
    setSelectedInExCriteria(index)
  })

  useEffect(() => {
    setSelectedExCriteria
  }, [protocol]);

  useEffect(() => {
    setSelectedExCriteria(protocol['extractionCriteria'][selectedInExCriteria]);
  }, [protocol]);

  // useEffect(() => {
  //   if(selectedInExCriteria !== null){
  //     setSelectedArticle(filteredArticles[selectedInExCriteria])
  //   }
  // }, [protocol]);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Settings className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        Seção 1: Definição do Protocolo de Pesquisa
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Informações básicas */}
        <div className="space-y-6">
          <div>            
            <div className="space-y-4">
              <div>
                <label className="block text-sm sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título da Revisão Sistemática
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm "
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"
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
                    max= {new Date().getFullYear()}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"
                    value={protocol.yearRange.start}
                    onChange={(e) => handleProtocolChange('yearRange', {
                      ...protocol.yearRange,
                      start: parseInt(e.target.value)
                    })}
                  />
                  <input
                    type="number"
                    min="1900"
                    max=  {new Date().getFullYear()}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"
                    value={protocol.yearRange.end}
                    onChange={(e) => handleProtocolChange('yearRange', {
                      ...protocol.yearRange,
                      end: parseInt(e.target.value)
                    })}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Palavras-chaves</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {protocol.keywords.map((criteria, index) => (
                          <tr key={index} className="transition-colors duration-200">
                            
                            <td className="w-full">
                              <input
                                type="text"
                                // flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-20
                                className={index === 0 ? "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-tl-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm" :"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"}
                                value={criteria}
                                onChange={(e) => handleCriteriaChange('keywords', index, e.target.value)}
                                placeholder="Ex: Machine learning"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                disabled={protocol.keywords.length === 1}
                                onClick={() => removeCriteria({type:'keywords', index:index})}
                                className= "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                              >
                                <XCircle size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                    <button
                      onClick={() => addCriteria('keywords')}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <PlusCircle size={16} />
                      Adicionar Palavras-chaves
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Idiomas dos Artigos
                </h3>
                <div className="space-y-2">
                  {['English', 'Portuguese', 'Spanish', 'French', 'German', 'Italian'].map(lang => (
                    <label key={lang} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
                      <div className="relative">
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
                          className="peer sr-only"
                        />
                        <div className="relative w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all duration-200">
                        </div>
                        <Check className="absolute inset-0 m-auto w-3 h-3 text-white hidden peer-checked:block" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Bases de Dados
                </h3>
                <div className="space-y-2">
                  {['Scopus', 'Web of Science', 'PubMed'].map(db => (
                    <label key={db} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
                          <div className="relative">
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
                              className="peer sr-only"
                            />
                            <div className="relative w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all duration-200">
                            </div>
                            <Check className="absolute inset-0 m-auto w-3 h-3 text-white hidden peer-checked:block" />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{db}</span>
                        </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Critérios */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Critérios de Inclusão</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">   
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {protocol.inclusionCriteria.map((criteria, index) => (
                      <tr key={index} className="transition-colors duration-200">
                        <td className="">
                          <span className="px-4 py-2 text-gray-500 font-bold dark:text-gray-400 text-sm">{`I${index + 1}`}</span>
                           
                        </td>
                        <td className="w-full h-px">
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 !h-full resize-none text-sm"
                            value={criteria.value}
                            onChange={(e) => handleCriteriaChange('inclusionCriteria', index, e.target.value, 'value')}
                            placeholder="Ex: Estudos com população adulta"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={protocol.inclusionCriteria.length === 1}
                            onClick={() => removeCriteria({type:'inclusionCriteria', index:index})}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                <button
                  onClick={() => addCriteria('inclusionCriteria','','',protocol.inclusionCriteria.length)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  Adicionar Critério de Inclusão
                </button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Critérios de Exclusão</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {protocol.exclusionCriteria.map((criteria, index) => (
                      <tr key={index} className="transition-colors duration-200">
                        <td className="">
                          <span className="px-4 py-2 text-gray-500 font-bold dark:text-gray-400">{`E${index + 1}`}</span>
                           
                        </td>
                        <td className="w-full h-px">
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 !h-full resize-none text-sm"
                            value={criteria.value}
                            onChange={(e) => handleCriteriaChange('exclusionCriteria', index, e.target.value, 'value')}
                            placeholder="Ex:  Estudos sem grupo controle"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={protocol.exclusionCriteria.length === 1}
                            onClick={() => removeCriteria({type:'exclusionCriteria', index:index})}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                <button
                  onClick={() => addCriteria('exclusionCriteria','','',protocol.exclusionCriteria.length)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  Adicionar Critério de Exclusão
                </button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Critérios de Qualidade</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {protocol.qualityCriteria.map((criteria, index) => (
                      <tr key={index} className="transition-colors duration-200">
                        <td className="">
                          <span className="px-4 py-2 text-gray-500 font-bold dark:text-gray-400 text-sm">{`Q${index + 1}`}</span>
                        </td>
                        <td className="w-full h-px">
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 !h-full resize-none text-sm"
                            value={criteria.value}
                            onChange={(e) => handleCriteriaChange('qualityCriteria', index, e.target.value, 'value')}
                            placeholder="Ex:  Randomização adequada"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={protocol.qualityCriteria.length === 1}
                            onClick={() => removeCriteria({type:'qualityCriteria', index:index})}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                <button
                  onClick={() => addCriteria('qualityCriteria','','',protocol.qualityCriteria.length)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  Adicionar Critério de Qualidade
                </button>
              </div>
            </div>
          </div>
          {/* <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Critérios de Extração</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {protocol.extractionCriteria.map((criteria, index) => (
                      
                      <tr key={index} className="transition-colors duration-200">
                        <td className="">
                          <span className="px-4 py-2 text-gray-500 font-bold dark:text-gray-400 text-sm">{`EX${index + 1}`}</span>
                        </td>
                        <td >
                           <select
                            value={criteria.type || 'Text'}
                            onChange={(e) => handleCriteriaChange('extractionCriteria', index, e.target.value, 'type')}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm">
                            <option value="Text">Text</option>
                            <option value="Pick on List">Escolha única</option>
                            <option value="Pick on Many">Múltipla escolha</option>
                          </select>
                        </td>
                        <td className="w-full">
                          <input
                            type="text"
                            className={"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm !h-full resize-none"}
                            value={criteria.value}
                            onChange={(e) => handleCriteriaChange('extractionCriteria', index, e.target.value, 'value')}
                            placeholder="Ex: Qual a metodologia utilizada?"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={criteria.type !== 'Pick on List' && criteria.type !== 'Pick on Many' || criteria.value == ''}
                            onClick={(e) => handleSeExCriteria(criteria, index)}
                            className="text-black-600 dark:text-white-400 hover:text-white-800 dark:hover:text-white-300 p-1 rounded-full hover:bg-white-50 dark:hover:bg-white-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 "
                          >
                            <List  size={16} />
                          </button>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={protocol.extractionCriteria.length === 1}
                            onClick={() => removeCriteria({type:'extractionCriteria', index:index})}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                <button
                  onClick={() => addCriteria('extractionCriteria','','',protocol.extractionCriteria.length)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  Adicionar Critério de Extração
                </button>
              </div>
            </div>
          </div> */}
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Critérios de Extração
            </h3>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">

              {/* ── MOBILE: card list (hidden on sm+) ── */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700 sm:hidden">
                {protocol.extractionCriteria.map((criteria, index) => (
                  <div key={index} className="p-3 flex flex-col gap-2">

                    {/* header row: label + action buttons */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        {`EX${index + 1}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={
                            (criteria.type !== 'Pick on List' && criteria.type !== 'Pick on Many') ||
                            criteria.value === ''
                          }
                          onClick={() => handleSeExCriteria(criteria, index)}
                          className="p-1.5 rounded-full text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors"
                        >
                          <List size={15} />
                        </button>
                        <button
                          disabled={protocol.extractionCriteria.length === 1}
                          onClick={() => removeCriteria({ type: 'extractionCriteria', index })}
                          className="p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent transition-colors"
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>

                    {/* type select */}
                    <select
                      value={criteria.type || 'Text'}
                      onChange={(e) =>
                        handleCriteriaChange('extractionCriteria', index, e.target.value, 'type')
                      }
                      className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 transition-colors"
                    >
                      <option value="Text">Text</option>
                      <option value="Pick on List">Escolha única</option>
                      <option value="Pick on Many">Múltipla escolha</option>
                    </select>

                    {/* text input */}
                    <input
                      type="text"
                      value={criteria.value}
                      onChange={(e) =>
                        handleCriteriaChange('extractionCriteria', index, e.target.value, 'value')
                      }
                      placeholder="Ex: Qual a metodologia utilizada?"
                      className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 transition-colors"
                    />
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: original table (hidden below sm) ── */}
              <div className="hidden sm:block overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {protocol.extractionCriteria.map((criteria, index) => (
                      <tr key={index} className="transition-colors duration-200">
                        <td>
                          <span className="px-4 py-2 text-gray-500 font-bold dark:text-gray-400 text-sm">
                            {`EX${index + 1}`}
                          </span>
                        </td>
                        <td>
                          <select
                            value={criteria.type || 'Text'}
                            onChange={(e) =>
                              handleCriteriaChange('extractionCriteria', index, e.target.value, 'type')
                            }
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"
                          >
                            <option value="Text">Text</option>
                            <option value="Pick on List">Escolha única</option>
                            <option value="Pick on Many">Múltipla escolha</option>
                          </select>
                        </td>
                        <td className="w-full">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm !h-full resize-none"
                            value={criteria.value}
                            onChange={(e) =>
                              handleCriteriaChange('extractionCriteria', index, e.target.value, 'value')
                            }
                            placeholder="Ex: Qual a metodologia utilizada?"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={
                              (criteria.type !== 'Pick on List' && criteria.type !== 'Pick on Many') ||
                              criteria.value === ''
                            }
                            onClick={() => handleSeExCriteria(criteria, index)}
                            className="text-black-600 dark:text-white-400 hover:text-white-800 dark:hover:text-white-300 p-1 rounded-full hover:bg-white-50 dark:hover:bg-white-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500"
                          >
                            <List size={16} />
                          </button>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={protocol.extractionCriteria.length === 1}
                            onClick={() => removeCriteria({ type: 'extractionCriteria', index })}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Add button (shared) ── */}
              <button
                onClick={() =>
                  addCriteria('extractionCriteria', '', '', protocol.extractionCriteria.length)
                }
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium rounded-bl-lg rounded-br-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <PlusCircle size={16} />
                Adicionar Critério de Extração
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      {selectedExCriteria && (
        // document.body.overflowX = ''
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-colors duration-200">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">{selectedExCriteria.value}</h3>
                <button
                  onClick={() => handleSeExCriteria(null, null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>
              <div className="p-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedExCriteria.items.map((criteria, index) => (
                        <tr key={index} className="transition-colors duration-200">
                          
                          <td className="w-full">
                            <input
                              type="text"
                              className={index === 0 ? "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-tl-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm" :"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 text-sm"}
                              value={criteria}
                              onChange={(e) => handleCriteriaChange('extractionCriteria', selectedInExCriteria, e.target.value, 'items', index)}
                              placeholder="Ex:  Randomização adequada"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                            // (type, index, typeEx, subIndex)
                              disabled={selectedExCriteria.items.length === 1}
                              onClick={() => removeCriteria({type: 'extractionCriteria', index:selectedInExCriteria, atr:'items', subIndex:index})}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                            >
                              <XCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className=" bg-gray-50 dark:bg-gray-900/50  rounded-bl-lg rounded-br-lg " >
                  <button
                    onClick={() => addCriteria('extractionCriteria', 'items', selectedInExCriteria)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-none transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={16} />
                    Adicionar Possível Resposta
                  </button>
                </div>
            </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* <div className="text-gray-700 dark:text-gray-300"><strong>Autores:</strong> {selectedArticle.authors}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Fonte:</strong> {selectedArticle.source}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Revista:</strong> {selectedArticle.journal}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Ano:</strong> {selectedArticle.year}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>DOI:</strong> {selectedArticle.doi}</div>
                <div className="text-gray-700 dark:text-gray-300"><strong>Score:</strong> {selectedArticle.score}</div> */}
                {/* <div className="text-gray-700 dark:text-gray-300"><strong>Idioma:</strong> {selectedArticle.language}</div> */}
              </div>
              {/* <div className="mb-4">
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
              </div> */}
              
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

      {/* Sistema de Pontuação */}
      <div className="mt-8">
        <ScoringSystemConfig 
            scoringSystem={protocol.scoringSystem} 
            onUpdate={onUpdateProtocol}
          />
      </div>
      
      <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg transition-colors duration-200">
        <h4 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2">Status do Protocolo</h4>
        <p className="text-sm text-indigo-700 dark:text-indigo-400">
          {protocol.title ? '✓ Título definido' : '⚠ Título pendente'} | 
          {protocol.researchQuestion? ' ✓ Pergunta da pesquisa definida' : ' ⚠ Pergunta da pesquisa pendente'} | 
          {protocol.keywords.some(c => c.trim()) ? ' ✓ Palavras-chaves definidas' : ' ⚠ Palavras-chaves pendentes'} | 
          {protocol.inclusionCriteria.length > 1  ? ' ✓ Critérios de inclusão definidos' : ' ⚠ Critérios de inclusão pendentes'} | 
          {protocol.exclusionCriteria.length > 1  ? ' ✓ Critérios de exclusão definidos' : ' ⚠ Critérios de exclusão pendentes'} | 
          {protocol.extractionCriteria.length > 1 ? ' ✓ Critérios de extração definidos' : ' ⚠ Critérios de extração pendentes'} | 
          {protocol.qualityCriteria.length > 1  ? ' ✓ Critérios de qualidade definidos' : ' ⚠ Critérios de qualidade pendentes'} | 
          {protocol.databases.length > 0 ? ' ✓ Bases selecionadas' : ' ⚠ Bases pendentes'}
            

          {/* title: '',
    researchQuestion: '',
    yearRange: { start: 2015, end: new Date().getFullYear() },
    languages: ['English'],
    keywords: [''],
    inclusionCriteria: [''],
    exclusionCriteria: [''],
    extractionCriteria: [{value:'', type:'text', items: ['']}],
    qualityCriteria: [''],
    databases: [], */}
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
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
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
              placeholder="Ex: (machine learning OR artificial intelligence) AND (systematic review)"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              *Este campo é obrigatório para documentar a metodologia de busca
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
    <div className="bg-gray-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden transition-colors duration-200">
      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm sm:text-lg font-semibold text-blue-800 dark:text-blue-300">
              Sistema de Pontuação por Keywords
            </h4>
          </div>
          {/* <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={scoringSystem.enabled}
              onChange={(e) => handleConfigChange('enabled', e.target.checked)}
              className="peer sr-only"
              id="scoring-toggle"
            />
            <label
              htmlFor="scoring-toggle"
              className="relative w-11 h-6 bg-gray-300 peer-checked:bg-blue-500 rounded-full cursor-pointer transition-colors duration-200"
            >
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 transform peer-checked:translate-x-5"></span>
            </label>
            <span className="ml-2 text-sm font-medium text-blue-700 dark:text-blue-400">
              {scoringSystem.enabled ? 'Ativado' : 'Desativado'}
            </span>
          </div> */}
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          Artigos serão pontuados baseado na presença das palavras-chave definidas
        </p>
      </div>

      
        <div className="p-4 space-y-6">
          <div>
            <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-4">Pesos por Campo</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Título', key: 'title' },
                { label: 'Resumo', key: 'abstract' },
                { label: 'Palavras-chave', key: 'keywords' }
              ].map(field => (
                <div key={field.key} className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {field.label}
                    </label>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {scoringSystem.weights[field.key]} pts
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={scoringSystem.weights[field.key]}
                    onChange={(e) => handleWeightChange(field.key, e.target.value)}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-blue-200 dark:border-blue-800 pt-6">
            <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-4">Configurações de Busca</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  key: 'caseInsensitive',
                  label: 'Ignorar maiúsculas/minúsculas',
                  description: 'Não diferencia entre maiúsculas e minúsculas na busca'
                },
                {
                  key: 'exactMatch',
                  label: 'Busca exata',
                  description: 'Encontra apenas palavras completas'
                },
                {
                  key: 'multipleOccurrences',
                  label: 'Múltiplas ocorrências',
                  description: 'Conta cada vez que uma keyword aparece'
                }
              ].map(setting => (
                <div key={setting.key} className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={scoringSystem[setting.key]}
                        onChange={(e) => handleConfigChange(setting.key, e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-10 h-6 bg-gray-300 rounded-full peer-checked:bg-blue-500 transition-colors duration-200"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 transform peer-checked:translate-x-4"></div>
                    </div>
                    <span className="flex-1 ml-3 text-sm font-medium text-blue-700 dark:text-blue-400">{setting.label}</span>
                  </label>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">{setting.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
            <button
              onClick={() => window.recalculateAllScores && window.recalculateAllScores()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <RefreshCw className="h-4 w-4" />
              Recalcular Pontuações
            </button>
          </div> */}

          <div className="bg-blue-100 dark:bg-blue-800/50 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
            <p><strong>Como funciona:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Cada keyword encontrada soma pontos baseado no peso do campo</li>
              <li>Pontuação total = soma de todas as keywords × pesos dos campos</li>
              <li>Maior pontuação = indica maior relevância para a pesquisa</li>
            </ul>
          </div>
        </div>
      
    </div>
  );
};

// Componente para importação de dados
const ImportSection = ({articles, setArticles, onImport, isLoading, importedData, protocol, setImportedData, detectDuplicates, numStringSc, setNumStringSc, statistics }) => {
  const [showSearchStringModal, setShowSearchStringModal] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [isLoadingState, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inputFileSelected, setInputFileSelected] = useState(null);
  
  
   
  const detectDuplicatesImport = (articles, database) => {
      const duplicatesByDOI = new Map();
      const duplicatesByTitle = new Map();
      const duplicatesByAuthorsYear = new Map();
      
      articles.forEach(article => {
        if (article.isDuplicate) return; // Pular se já é marcado como duplicata
        
        // Detectar por DOI
        if (article.doi && duplicatesByDOI.has(article.doi)) {
          article.isDuplicate = true;
          article.dataProcessingStatus = 'duplicate'
          article.duplicateOf = duplicatesByDOI.get(article.doi);
        } else if (article.doi) {
          duplicatesByDOI.set(article.doi, article.id);
        }
        
        // Detectar por título 
        const normalizedTitle = article.title.toLowerCase().trim();
        if (duplicatesByTitle.has(normalizedTitle)) {
          article.isDuplicate = true;
          article.dataProcessingStatus = 'duplicate'
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
  };
  // useEffect(() => {

  //    detectDuplicates()
  // }, [articles]); // Executa sempre que articles mudar

  const handleImportRequest = (target, database) => {
    const file = target.files[0]
    if (!file) return;
    if (file.name.endsWith('.bib') || file.name.endsWith('.bibtex') || file.name.endsWith('.txt')){
      setInputFileSelected(target)
      setPendingImport({ file, database });
      setShowSearchStringModal(database);      
    }else{
      alert('Erro ao processar o arquivo. Verifique o formato.');
      throw new Error('Formato de arquivo não corresponde à base de dados selecionada.');
    }
  };
  
  const detectType = (text) => {
    // Regras simples para identificar WOS vs Scopus
    // WoS costuma ter campos como: "Publisher = {Web of Science}", "ResearcherID", "Unique-ID"
    // Scopus usa campos como: "Author = {Surname, Name}" em formato diferente, "EID", "Cited by"
    let type = "Desconhecido";
    if (/Web of Science|Unique-ID|ResearcherID/i.test(text)) {
      type = "Web of Science";
    } else if (/EID|scopus|Cited by/i.test(text)) {
      type = "Scopus";
    }
    return type;     // <-- essencial
  };
  
  const handleConfirmImport = async (searchString) => {
    if (!pendingImport) return;
    const { file, database } = pendingImport;

    setIsLoading(true);
    setShowSearchStringModal(null);
    try {
      // Ler o conteúdo do arquivo
      const fileContent = await file.text();
      const detectedType = detectType(fileContent);
      // Determinar o tipo de arquivo e processar
      let importedArticles;
      if (file.name.endsWith('.bib') || file.name.endsWith('.bibtex') || file.name.endsWith('.txt')) {
        
        // console.log('Detected type:', detectedType);
        // console.log('database:', database);
        // if(detectedType === database){
          if(database === 'Scopus' || database === 'Web of Science'){
            importedArticles = importedBibtexArticles(fileContent, database, numStringSc, articles.length);
          }else{
            importedArticles = importedPubmedArticles(fileContent, database, numStringSc, articles.length);
          }
            // Adicionar string de busca
          importedArticles = importedArticles.map(article => ({
            ...article,
            searchString: searchString
          }));
          
          // Calcular pontuações se habilitado
          if ( protocol.keywords?.length > 0) {
            const validKeywords = protocol.keywords.filter(k => k.trim());
            if (validKeywords.length > 0) {
              importedArticles = importedArticles.map(article => ({
                ...article,
                score: window.calculateArticleScore ? 
                  window.calculateArticleScore(article, validKeywords, protocol.scoringSystem) : 0
              }));
            }
          }

          
          
          // const idData = importedData.length+1
         
          const idData = importedData.reduce((max, data) => (data.id > max ? data.id : max), 0) +1;

          const newImportData = {
            id: idData,
            database,
            searchString,
            articles: importedArticles,
            importDate: new Date(),
            fileName: file.name
          };
          importedArticles = importedArticles.map(article => ({
            ...article,
            idData: idData
          }));
          setImportedData(prev => [...prev, newImportData]);
          
          onImport(importedArticles, database);
          setNumStringSc(prev => prev + 1);
        // }else{
        //   throw new Error('Formato de arquivo não corresponde à base de dados selecionada.');
        // }
      } else{
        throw new Error('Formato de arquivo não corresponde à base de dados selecionada.');
      }
      
    
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert('Erro ao processar o arquivo. Verifique o formato.');
      setResult(null);

    } finally {
      setPendingImport(null);
      setIsLoading(false);
      inputFileSelected.value = ""
          
      console.log(importedData)

    }
  };
  const handleExcludeData = (data) => {

    setImportedData(prev => 
      prev.filter(prevdata => prevdata.id !== data.id)
    );
    setArticles(prevArticles => {
      // Remove os artigos do import deletado e reseta isDuplicate de todos
      const remainingArticles = prevArticles
        .filter(article => article.idData !== data.id)
        .map(article => ({ ...article, isDuplicate: false, dataProcessingStatus: article.dataProcessingStatus === 'duplicate' ? 'pending' : article.dataProcessingStatus, duplicateOf: null }));

      // Reavalia duplicatas do zero
      const duplicatesByDOI = new Map();
      const duplicatesByTitle = new Map();

      return remainingArticles.map(article => {
        let isDuplicate = false;
        let duplicateOf = null;

        if (article.doi && duplicatesByDOI.has(article.doi)) {
          isDuplicate = true;
          duplicateOf = duplicatesByDOI.get(article.doi);
        } else if (article.doi) {
          duplicatesByDOI.set(article.doi, article.id);
        }

        const normalizedTitle = article.title.toLowerCase().trim();
        if (duplicatesByTitle.has(normalizedTitle)) {
          isDuplicate = true;
          duplicateOf = duplicatesByTitle.get(normalizedTitle);
        } else {
          duplicatesByTitle.set(normalizedTitle, article.id);
        }

        return isDuplicate
          ? { ...article, isDuplicate: true, dataProcessingStatus: 'duplicate', duplicateOf }
          : article;
      });
    });
    // setArticles(prevArticles => 
    //   prevArticles.filter(article => article.idData !== data.id)
    // );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
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
                <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-white">Scopus</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importar BibTeX</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload do arquivo Scopus
                </label>
                <input
                  type="file"
                  id="file-upload-scopus"
                  accept=".csv,.ris,.bib,.txt"
                  onChange={(e) => handleImportRequest(e.target, 'Scopus')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 dark:hover:text-white dark:hover:bg-indigo-500 hover:text-black hover:bg-gray-200 file:hidden"
                  disabled={isLoadingState}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos: BibTeX
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
                        <span className="text-orange-700 dark:text-orange-400">String {data.id}:</span>
                        <span className="font-medium text-orange-800 dark:text-orange-300">{data.articles.length} artigos</span>
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-500 break-all">
                        {data.searchString.length > 80 ? data.searchString.substring(0, 80) + '...' : data.searchString}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600 dark:text-orange-400">Duplicatas:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {statistics.importSection['duplicate' + data.id]}
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
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center mr-4">
                <Database className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-white">Web of Science</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importar BibTeX</p>
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
                  onChange={(e) => handleImportRequest(e.target, 'Web of Science')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 dark:hover:text-white dark:hover:bg-indigo-500 hover:text-black hover:bg-gray-200 file:hidden"
                  disabled={isLoadingState}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos: BibTeX
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
                          {statistics.importSection['duplicate' + data.id]}
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

        {/* PubMed */}
        {protocol.databases.includes('PubMed') && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 transition-colors duration-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12  bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center mr-4">
                <Database className="h-6 w-6 text-sky-700  dark:text-sky-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-white">PubMed</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importar PubMed</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload do arquivo PubMed
                </label>
                <input
                  type="file"
                  accept=".csv,.ris,.bib,.txt"
                  onChange={(e) => handleImportRequest(e.target, 'PubMed')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 dark:hover:text-white dark:hover:bg-indigo-500 hover:text-black hover:bg-gray-200 file:hidden"
                  disabled={isLoadingState}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos: PubMed (.txt)
                </p>
              </div>

              {importedData.filter(data => data.database === 'PubMed').length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-800 dark:text-blue-300">Status</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {importedData.filter(data => data.database === 'PubMed').map((data, index) => (
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
                          {statistics.importSection['duplicate' + data.id]}
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
        <div className="mt-8 bg-gray-100 dark:bg-gray-900/50 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Dados Importados por String e Base</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visualização detalhada dos artigos importados organizados por string de busca e base de dados
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full ">
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
                  <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                   
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-50 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {importedData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        data.database === 'Scopus' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' :
                        data.database === 'Web of Science' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300' :
                        data.database === 'PubMed' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300' :
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
                        {statistics.importSection['unique' + data.id]}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {statistics.importSection['duplicate' + data.id]}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(data.importDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-1 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <button
                        onClick={() => {
                          handleExcludeData(data)
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"
                        title="Excluir"
                      >
                        <XCircle size={16} />
                      </button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumo geral da importação */}
      <div className="mt-8 bg-gray-100 dark:bg-gray-900/50 p-6 rounded-lg transition-colors duration-200">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-4">Resumo da Importação</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
              {importedData.filter(d => d.database === 'Scopus').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Scopus</p>
          </div>
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-violet-600 dark:text-violet-400">
              {importedData.filter(d => d.database === 'Web of Science').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Web of Science</p>
          </div>
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-sky-600 dark:text-sky-400">
              {importedData.filter(d => d.database === 'PubMed').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">PubmMed</p>
          </div>
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-gray-600 dark:text-gray-400">
              {importedData.filter(d => d.database !== 'Scopus' && d.database !== 'Web of Science'  && d.database !== 'PubMed').reduce((acc, d) => acc + d.articles.length, 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Outras Bases</p>
          </div>
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
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
  const [duplicates, setDuplicates] = useState(0)
  
  // useEffect(() => {
  //   setDuplicates(articles.filter(a => a.isDuplicate == true))
  // }, [articles]);
  // console.log(duplicates)
  // const duplicates = articles.filter(a => a.isDuplicate);
  // const unique = articles.filter(a => !a.isDuplicate);

  const handleClassifyDuplicates = () => {
    const statusField = 'dataProcessingStatus';
    
    // Marcar todas as duplicatas como excluídas
    articles.forEach(article => {
      if(article.isDuplicate){
        handleDuplicate(article.id)
        // onUpdateStatus(article.id, statusField, 'duplicate', null);
        console.log(article)
      } 
      
    })

    // Mostrar mensagem de confirmação
    setTimeout(() => {
      alert(`${duplicates.length} duplicatas foram identificadas e classificadas automaticamente. Elas não avançarão para as próximas seções.`);
    }, 100);
  };

  const handleExcludeScore = () => {
    const statusField = 'dataProcessingStatus';
    
    // Marcar todas as duplicatas como excluídas

    const pendingArticles = articles.filter((article)=>article.dataProcessingStatus=="pending")

    pendingArticles.forEach(article => {
      if(article.score === 0){
        onUpdateStatus(article.id, statusField, 'excluded', null);
      }       
    })

    const zeroScore = pendingArticles.filter(a => a.score === 0);
    // Mostrar mensagem de confirmação
    setTimeout(() => {
      alert(`${zeroScore.length} trabalhos com score igual a zero foram identificados e classificados como excluídos automaticamente. Eles não avançarão para as próximas seções.`);
    }, 100);
  };

  const handleIncludePendents = () => {
    const statusField = 'dataProcessingStatus';
    
    // Marcar todas as duplicatas como excluídas

    const pendingArticles = articles.filter((article)=>article.dataProcessingStatus=="pending")

    pendingArticles.forEach(article => {
        onUpdateStatus(article.id, statusField, 'included', null);
    })

    // Mostrar mensagem de confirmação
    setTimeout(() => {
      alert(`${pendingArticles.length} trabalhos foram identificados e incluídos automaticamente.`);
    }, 100);
  };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        Seção 3: Tratamento de Dados
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Artigos Importados</h3>
          <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{articles.length}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Duplicatas</h3>
          <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-200">{statistics.dataProcessing.duplicate}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Aprovados</h3>
          <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-200">{statistics.dataProcessing.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-200">{statistics.dataProcessing.excluded}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-6">
        {/* <div>
          <div className="space-y-1 mb-1">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 ">Configuração de Detecção de Duplicatas</h3>
            <span className='block text-sm font-medium text-gray-700 dark:text-gray-300 '>Os trabalhos duplicatos são identificados por meio da comparação do título, resumo e palavras-chaves</span>
          </div>
          
          <div className="mt-3">
            <button
              onClick={handleClassifyDuplicates}
              className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <Database className="h-4 w-4" />
              Classificar Duplicatas Automaticamente
            </button>
            
          </div>
        </div> */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-gray-800 dark:text-gray-300 mb-2">Processo de Tratamento</h4>
          <ul className="text-sm text-gray-700 dark:text-gray-400 space-y-1">
            <li>• Identificação e remoção de duplicatas</li>
            <li>• Verificação de formato dos dados</li>
            <li>• Validação de metadados</li>
          </ul>
        </div>
        <div>
          <div className="space-y-1 mb-1">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 ">Exclusão automática por meio do valor do score</h3>
            <span className='block text-sm font-medium text-gray-700 dark:text-gray-300 '>Os trabalhos com score igual a 0 são automaticamente excluídos</span>
          </div>
          
          <div className="mt-3">
            <button
              onClick={handleExcludeScore}
              className="w-full bg-red-200 dark:bg-red-900/30 hover:bg-red-300 dark:hover:bg-red-900/30 text-red-800 dark:text-red-300 border border-gray-300 dark:border-gray-600  px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <CopyX className="h-4 w-4" />
              Remoção dos trabalhos com score 0
            </button>
            
          </div>
          <div className="space-y-1 mb-1">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 ">Aceite automática dos trabalhos pendentes</h3>
            <span className='block text-sm font-medium text-gray-700 dark:text-gray-300 '></span>
          </div>
          
          <div className="mt-3">
            <button
              onClick={handleIncludePendents}
              className="w-full bg-green-200 dark:bg-green-900/30 hover:bg-green-300 dark:hover:bg-green-900/30 text-green-800 dark:text-green-300 border border-gray-300 dark:border-gray-600  px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
            >
              <CopyCheck className="h-4 w-4" />
              Aceite automática dos trabalhos pendentes
            </button>
            
          </div>
        </div>
       
        
        <div>
          {/* <h3 className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Status do Tratamento</h3>
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
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-green-600 dark:text-green-400" />
        Seção 4: Filtro 1 - Triagem por título, palavras-chave e resumo
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Tratamento</h3>
          <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{filter1Articles.length}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-gray-800 dark:text-gray-300 mb-2">Pendentes</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-200">{statistics.filter1.pending}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter1.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter1.excluded}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
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
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        Seção 5: Filtro 2 - Triagem por introdução e conclusão
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Filtro 1</h3>
          <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{filter2Articles.length}</p>
        </div>
         <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-gray-800 dark:text-gray-300 mb-2">Pendentes</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-200">{statistics.filter2.pending}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter2.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter2.excluded}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Componente para Filtro 3
const Filter3Section = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, extractionCriteria, statistics }) => {
  const filter3Articles = articles.filter(a => a.filter2Status === 'included');
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
      <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <Filter className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        Seção 6: Filtro 3 - Triagem por texto completo
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Do Filtro 2</h3>
          <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-200">{filter3Articles.length}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-gray-800 dark:text-gray-300 mb-2">Pendentes</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-200">{statistics.filter3.pending}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Incluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-200">{statistics.filter3.included}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Excluídos</h3>
          <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-200">{statistics.filter3.excluded}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Critérios de inclusão</h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
              {
                inclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                  <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
              ))}
          </ul>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Critérios de exclusão</h4>
          <ul className="text-sm text-red-900 dark:text-red-200 space-y-1">
            {
              exclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                <li key={index}>• {criterion.id + ' - ' + criterion.value}</li>
              ))}
          </ul>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg transition-colors duration-200">
          <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">Critérios de extração</h4>
          {/* <ul className="text-sm text-orange-900 dark:text-orange-200 space-y-1">
            {
              // extractionCriteria.filter(c => c.trim()).map((criterion, index) => (
              //   <li key={index}>• {criterion}</li>
              // ))}
          </ul> */}
        </div>
      </div>
    </div>
  );
};
  
  
// Componente para Análise
// const StatisticsSection = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, statistics, theme }) => {
//   const filter3Articles = articles.filter(a => a.filter2Status === 'included');
//   const [openMenuId, setOpenMenuId] = useState(null);
//   const chartRef = useRef(null);
//   const [keywordsCount, setKeywordsCount] = useState([]);
//   const [countriesCount, setCountriesCount] = useState([]);
//   const [publicationsYearScopus, setPublicationYearScopus] = useState([]);
//   const [publicationsYearWOS, setPublicationYearWOS] = useState([]);
//   const [publicationsYearTotal, setPublicationYearTotal] = useState([]);
//   const [stroke, setStroke] = useState(null);
//   const [criterionsCount, setCriterionsCount] = useState(
//     {
//       dataProcessing: [
//         {"name": "included", value: 0},
//         {"name": "excluded", value: 0},
//         {"name": "unclassified", value: 0}
//       ],
//       filter1: [
//         {"name": "included", value: 0},
//         {"name": "excluded", value: 0},
//         {"name": "unclassified", value: 0}
//       ],
//       filter2: [
//         {"name": "included", value: 0},
//         {"name": "excluded", value: 0},
//         {"name": "unclassified", value: 0}
//       ],
//       filter3: [
//         {"name": "included", value: 0},
//         {"name": "excluded", value: 0},
//         {"name": "unclassified", value: 0}
//       ],
//     }
//   );

//   console.log(criterionsCount)
//   const nodeTypes = {
//     custom: CustomNode,
//   };
//   const handleSource = (source, duplicate) => {
//     console.log(duplicate)
//     const ar = duplicate? articles.filter((a) => a.isDuplicate === false) : articles
//     return source === "Total"? ar : ar.filter((a) => a.source.toLowerCase() === source.toLowerCase())
//   }
//   const initNodes = [
//     {
//       id: 'n1',
//       position: { x: -75, y: -50 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Scopus', number: handleSource('Scopus').length, handleTop: false},
//     },
//     {
//       id: 'n2',
//       position: { x: 75, y: -50 }, 
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Web of Science', number: handleSource('Web of Science').length, handleTop: false },
//     },
//     {
//       id: 'n3',
//       position: { x: 0, y: 50 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Identificados', number: handleSource('Total').length },

//     },
//     {
//       id: 'n4',
//       position: { x: 0, y: 150 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos após a remoção dos duplicados', number: statistics.dataProcessing.duplicate },
//     },
//     {
//       id: 'n5',
//       position: { x: 100, y: 250 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos excluídos após o filtro 1', number: statistics.filter1.excluded },
//       },
//     {
//       id: 'n6',
//       position: { x: 0, y: 350 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos incluídos após o filtro 1' , number: statistics.filter1.included  },
//     },
//     {
//       id: 'n7',
//       position: { x: 100, y: 450 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos excluídos após o filtro 2', number: statistics.filter2.excluded },
//     },
//     {
//       id: 'n8',
//       position: { x: 0, y: 550 },
//       origin: [0.5, 0.5],
//       data: { label: 'Trabalhos incluídos após o filtro 2', number: statistics.filter2.included  },
//       type: 'custom',
//     },
//     {
//       id: 'n9',
//       position: { x: 100, y: 650 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos excluídos após o filtro 3', number: statistics.filter3.excluded },
//     },
//     {
//       id: 'n10',
//       position: { x: 0, y: 750 },
//       origin: [0.5, 0.5],
//       type: 'custom',
//       data: { label: 'Trabalhos incluídos após o filtro 3', number: statistics.filter3.included, handleBottom: false  },
//     },
//   ];
//   const initEdges = [
//     { id: 'n1-n3', source: 'n1', target: 'n3' }, 
//     { id: 'n2-n3', source: 'n2', target: 'n3' },
//     { id: 'n3-n4', source: 'n3', target: 'n4' },
//     { id: 'n4-n5', source: 'n4', target: 'n5' },
//     { id: 'n5-n6', source: 'n5', target: 'n6' },
//     { id: 'n6-n7', source: 'n6', target: 'n7' },
//     { id: 'n7-n8', source: 'n7', target: 'n8' },
//     { id: 'n8-n9', source: 'n8', target: 'n9' },
//     { id: 'n9-n10', source: 'n9', target: 'n10' },
//   ];
//   const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
//   const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

//   const labelsCriterions = {
//     included: 'Incluído',
//     excluded: 'Excluído',
//     unclassified: 'Não Classificado'
//   };
//   const colors = {
//     included: '#4ade80',
//     excluded: '#f87171',
//     unclassified: '#94a3b8'
//   };
  
//   const criterionsStatus = () => {
//     const includedDataProcessing = statistics.dataProcessing.included
//     const includedFilter1 = statistics.filter1.included
//     const includedFilter2 = statistics.filter2.included
//     const includedFilter3 = statistics.filter3.included

//     const excludedDataProcessing = statistics.dataProcessing.excluded
//     const excludedFilter1 = statistics.filter1.excluded
//     const excludedFilter2 = statistics.filter2.excluded
//     const excludedFilter3 = statistics.filter3.excluded

//     const pendingDataProcessing = statistics.dataProcessing.pending
//     const pendingFilter1 = statistics.filter1.pending
//     const pendingFilter2 = statistics.filter2.pending
//     const pendingFilter3 = statistics.filter3.pending

//     return {
//       dataProcessing: [
//         {"name": "included", value: includedDataProcessing},
//         {"name": "excluded", value: excludedDataProcessing},
//         {"name": "unclassified", value: pendingDataProcessing}
//       ],
//       filter1: [
//         {"name": "included", value: includedFilter1},
//         {"name": "excluded", value: excludedFilter1},
//         {"name": "unclassified", value: pendingFilter1}
//       ],
//       filter2: [
//         {"name": "included", value: includedFilter2},
//         {"name": "excluded", value: excludedFilter2},
//         {"name": "unclassified", value: pendingFilter2}
//       ],
//       filter3: [
//         {"name": "included", value: includedFilter3},
//         {"name": "excluded", value: excludedFilter3},
//         {"name": "unclassified", value: pendingFilter3}
//       ],
//     }
//   }


//   const chartRefScopus = useRef(null);
//   const chartRefWebOfScience = useRef(null);
//   const chartRefTotal = useRef(null);
//   const chartRefKeywords = useRef(null);
//   const chartRefCountries = useRef(null);

//   const chartRefPaFilter1 = useRef(null);
//   const chartRefPaFilter2 = useRef(null);
//   const chartRefPaFilter3 = useRef(null);

//   const chartRefPrisma = useRef(null);


//   const [getPng1, { ref: exportRef1 }] = useCurrentPng();

//   const toggleMenu = (id) => {
//     console.log(id, openMenuId)
//     setOpenMenuId(openMenuId === id ? null : id);
//   };

//   useEffect(() => {
//     setKeywordsCount(contarKeywords(handleSource('Total')).filter(a => a.count >= 5));
//     setCountriesCount(contarCountries(handleSource('Total')).sort(function(a, b){return a.count - b.count}));
//     setPublicationYearScopus(publicationsByYear(handleSource('Scopus')));
//     setPublicationYearWOS(publicationsByYear(handleSource('Web of Science',false)));
//     setPublicationYearTotal(publicationsByYear(handleSource('Total',true)));
//   }, [articles]);
//   useEffect(() => {
//     setStroke(theme === "dark" ? "#fff" : "#000");
//   }, [theme]);
//   useEffect(() => {
//     setCriterionsCount(criterionsStatus())
//   }, [statistics]);

//   // console.log()
  

//   const publicationsByYear = (articles) => { 
//     return Object.entries(
//     articles.reduce((acc, article) => {
//       acc[article.year] = (acc[article.year] || 0) + 1;
//       return acc;
//     }, {})
//   ).map(([year, count]) => ({ year, count }))};
  
//   function contarCountries(array) {
//     // Filtra artigos que têm países identificados
//     const articlesWithCountries = array.filter(a => 
//       a.countries && 
//       a.countries.length > 0 && 
//       !a.countries.includes('País não informado')
//     );
//     // Achata o array (flatMap) - cada artigo pode ter múltiplos países
//     const allCountries = articlesWithCountries.flatMap(a => a.countries);
    
//     // Conta e ordena
//     return Object.entries(
//       allCountries.reduce((acc, country) => {
//         acc[country] = (acc[country] || 0) + 1;
//         return acc;
//       }, {})
//     ).map(([country, count]) => ({ country, count }))
//     .sort((a, b) => b.count - a.count);
  
//   }
  
//    // Contabilizar keywords
//   const contarKeywords = (array) => {
//     const count = array.reduce((acc, obj) => {
//       obj.keywords.forEach(keyword => {
//         const existing = acc.find(item => item.keyword === keyword);
//         if (existing) {
//           existing.count++;
//         } else {
//           acc.push({ keyword: keyword, count: 1 });
//         }
//       });
//       return acc;
//     }, []);
    
//     return count;
//   }
  
  
  
//   const chartData = (() => {
//     const centerX = 0;
//     const centerY = 0;
//     const sorted = keywordsCount.sort((a, b) => b.count - a.count);
    
//     // Posicionamento inicial
//     let points = sorted.map((item, index, array) => {
//       const maxCount = array[0].count;
//       const minCount = array[array.length - 1].count;
//       const normalizedSize = (item.count - minCount) / (maxCount - minCount || 1);
//       const radius = (1 - normalizedSize) * 200 + 50; // +50 para raio mínimo
//       const angle = (index / array.length) * 2 * Math.PI;
      
//       return {
//         x: centerX + radius * Math.cos(angle),
//         y: centerY + radius * Math.sin(angle),
//         z: item.count * 10,
//         keyword: item.keyword,
//         count: item.count,
//         size: (item.count * 10) / 2
//       };
//   });
  
//   // Aplica força de repulsão (simulação simples)
//   for (let iteration = 0; iteration < 100; iteration++) {
//     points.forEach((p1, i) => {
//       points.forEach((p2, j) => {
//         if (i !== j) {
//           const dx = p1.x - p2.x;
//           const dy = p1.y - p2.y;
//           const distance = Math.sqrt(dx * dx + dy * dy);
//           const minDist = p1.size + p2.size + 40;
          
//           if (distance < minDist && distance > 0) {
//             const force = (minDist - distance) / distance;
//             const fx = (dx / distance) * force * 0.5;
//             const fy = (dy / distance) * force * 0.5;
            
//             p1.x += fx;
//             p1.y += fy;
//           }
//         }
//       });
//     });
//   }
    
//     return points;
//   })();

//   const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
//     const RADIAN = Math.PI / 180;
//     if (value === 0 || percent === 0) {
//       return null;
//     }
//     if (cx == null || cy == null || innerRadius == null || outerRadius == null) {
//       return null;
//     }
//     const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
//     const x = cx + radius * Math.cos(-midAngle * RADIAN);
//     const y = cy + radius * Math.sin(-midAngle * RADIAN);

//     return (
//       <text 
//         x={x} 
//         y={y} 
//         fill="white" 
//         textAnchor="middle"
//         dominantBaseline="central"
//         className="text-sm sm:text-lg font-semibold"
//       >
//         {`${(percent * 100).toFixed(0)}%`}
//       </text>
//     );
//   };

  
//   const CustomLegend = ({ data }) => (
    
//     <div className='flex justify-center flex-wrap gap-5'>
//       {data.filter(item => item.value > 0).map((entry, index) => (
//         <div key={index} className='flex justify-center gap-2'>
//           <div className='size-5 rounded-full'
//           style={{ 
//             backgroundColor: colors[entry.name],
//           }} />

//             <span
//                 className={'font-medium color-gray-700 dark:color-gray-300'}>
                
//               {labelsCriterions[entry.name]}: {entry.value}
//             </span>
//         </div>
//       ))}
//     </div>
//   );

//   const ChartExport = ({ id, isOpen, onToggle, chartRef, data, getPng }) => {
    
//     const changeColors = (svgClone) => {
//         svgClone.querySelectorAll("g > g > g.recharts-cartesian-grid-horizontal > line").forEach( current => {
//           current.setAttribute('stroke', '#000');
//         })
//         svgClone.querySelectorAll("g > g > g.recharts-cartesian-grid-vertical > line").forEach( current => {
//           current.setAttribute('stroke', '#000');
//         })
//         svgClone.querySelectorAll("g > g.recharts-cartesian-axis-tick-labels.recharts-xAxis-tick-labels>g").forEach( (current) => {
//             current.children[0].setAttribute('fill', '#000')
//         })
//         svgClone.querySelectorAll("g > g.recharts-cartesian-axis-tick-labels.recharts-yAxis-tick-labels>g").forEach( (current) => {
//             current.children[0].setAttribute('fill', '#000')
//         })
//         svgClone.querySelectorAll("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > line").forEach( (current) => {
//             current.setAttribute('stroke', '#000')
//         })
//         svgClone.querySelectorAll("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > line").forEach( (current) => {
//             current.setAttribute('stroke', '#000')
//         })
//         svgClone.querySelectorAll("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > g > g > g").forEach( (current) => {
//             current.children[0].setAttribute('stroke', '#000')
//         })
//         svgClone.querySelectorAll("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > g > g > g").forEach( (current) => {
//             current.children[0].setAttribute('stroke', '#000')
//         }) 
      
//     }
//     const exportToPNG = async () => {
//       const chartElement = chartRef.current;
//       if (!chartElement) return;

//       const svgElement = chartElement.querySelector('svg');
//       if (!svgElement) return;

//       try {
//         // Clone o SVG para não modificar o original
//         const svgClone = svgElement.cloneNode(true);
        
//         // Pega as dimensões reais do SVG
//         const svgRect = svgElement.getBoundingClientRect();
        
//         // ESCALA ALTA para melhor qualidade (3x ou 4x)
//         const scale = 4; // Aumente para 4 ou 5 para qualidade máxima
//         const width = svgRect.width * scale;
//         const height = svgRect.height * scale;

//         // Configura atributos do SVG clone
//         svgClone.setAttribute('width', width);
//         svgClone.setAttribute('height', height);
//         svgClone.setAttribute('viewBox', `0 0 ${svgRect.width} ${svgRect.height}`);

//         // console.log(svgClone)
//         // console.log(theme)
        
//        changeColors(svgClone);

//         // Garante que fontes e estilos sejam incluídos
//         const style = document.createElement('style');
//         style.textContent = `
//           @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
//           * {
//             font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//           }
//         `;
//         svgClone.insertBefore(style, svgClone.firstChild);

//         // Serializa o SVG com encoding UTF-8
//         const svgString = new XMLSerializer().serializeToString(svgClone);
//         const svgBlob = new Blob([svgString], { 
//           type: 'image/svg+xml;charset=utf-8' 
//         });
//         const url = URL.createObjectURL(svgBlob);

//         // Cria canvas com alta resolução
//         const canvas = document.createElement('canvas');
//         canvas.width = width;
//         canvas.height = height;
//         const ctx = canvas.getContext('2d', { 
//           alpha: true,
//           desynchronized: false,
//           willReadFrequently: false
//         });

//         // Melhora a qualidade do rendering
//         ctx.imageSmoothingEnabled = true;
//         ctx.imageSmoothingQuality = 'high';

//         // Aplica fundo branco (ou a cor desejada)
//         ctx.clearRect(0, 0, width, height);

//         // Carrega e desenha a imagem
//         const img = new Image();
//         img.crossOrigin = 'anonymous';
        
//         await new Promise((resolve, reject) => {
//           img.onload = () => {
//             // Desenha com antialiasing
//             ctx.drawImage(img, 0, 0, width, height);
//             resolve();
//           };
//           img.onerror = reject;
//           img.src = url;
//         });

//         // Converte para blob com máxima qualidade
//         canvas.toBlob((blob) => {
//           if (blob) {
//             FileSaver.saveAs(blob, `${id}.png`);
//           }
//           URL.revokeObjectURL(url);
//           onToggle(id);
//         }, 'image/png', 1.0); // 1.0 = 100% de qualidade

//       } catch (error) {
//         console.error('Erro ao exportar PNG:', error);
//         alert('Erro ao exportar a imagem. Tente novamente.');
//       }
//     };

//     const exportToSVG = async () => {
//       if (chartRef == chartRefPrisma) {
        
//         // const chartElement = chartRef.current;
//         const imageWidth = 1024;
//         const imageHeight = 768;
//         // we calculate a transform for the nodes so that all nodes are visible
//         // we then overwrite the transform of the `.react-flow__viewport` element
//         // with the style option of the html-to-image library
              


//         const chartElement = document.querySelector("div.react-flow__viewport")
//         htmlToImage
//         .toPng(chartElement)
//         .then(function (dataUrl) {
//           var link = document.createElement('a');
//           link.download = 'my-image-name.png';
//           link.href = dataUrl;
//           link.click();
//         });
//         // const svgConfig = {
//         //   downloadSvg: true,
//         //   filename: "htmltosvg",
//         // };
//         // const htmlElement = chartElement;
//         // const svg = await htmlToSvg(htmlElement, svgConfig);
//       } else{
//         const chartElement = chartRef.current;
//         if (!chartElement) return;

//         const svgElement = chartElement.querySelector('svg');
//         if (!svgElement) return;

//         const svgClone = svgElement.cloneNode(true);
        
//         changeColors(svgClone)

//         const style = document.createElement('style');
//           style.textContent = `
//             @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
//             * {
//               font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//             }
//           `;
//         svgClone.insertBefore(style, svgClone.firstChild);

//         const svgData = new XMLSerializer().serializeToString(svgClone);
//         const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
//         const url = URL.createObjectURL(svgBlob);

//         const link = document.createElement('a');
//         link.download = 'grafico.svg';
//         link.href = url;
//         link.click();
//         URL.revokeObjectURL(url);
//         onToggle(id); // Fecha o menu
//       }
//     };
//     const downloadSvg = async () => {
      
//     };

//     const exportToXLSX = async () => {
//       const workbook = new ExcelJS.Workbook();
//       const wsData = workbook.addWorksheet("Data");
//       if (data.length > 0) {
//         wsData.columns = Object.keys(data[0]).map(key => ({
//           header: key,
//           key: key,
//           width: 15
//         }));
//         data.forEach((item) => {
//           wsData.addRow(item);
//         });
//       }
//       const buffer = await workbook.xlsx.writeBuffer();

//       const blob = new Blob([buffer], {
//         type:
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       });

//       const url = URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = "data.xlsx";
//       a.click();
//       URL.revokeObjectURL(url);
//     };
//     return (
//       <div className="absolute top-5 right-2 z-10">
//         <button
//           onClick={() => onToggle(id)}
//           className="bg-gray-900 border-none rounded-full cursor-pointer transition-all duration-300 ease-in-out hover:scale-110"
//           // bg-gray-50 dark:bg-gray-900 border-none rounded-full w-14 h-14 flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out hover:scale-110
//           style={{
//             transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
//           }}
//         >
//           {isOpen ? <X size={14} color="white" /> : <Download size={14} color="white" />}
//         </button>

//         {/* IMPORTANTE: Condicional para mostrar/ocultar o menu */}
//         {isOpen && (
//           <div className="absolute top-10 right-0 bg-zinc-800 rounded-lg p-2 min-w-[200px] z-50">
//             <button
//               onClick={exportToPNG}
//               className="w-full text-left px-4 py-3 text-white bg-transparent hover:bg-zinc-700 rounded transition-colors duration-200 cursor-pointer border-none text-base"
//             >
//               Exportar como PNG
//             </button>

//             <button
//               onClick={exportToSVG}
//               className="w-full text-left px-4 py-3 text-white bg-transparent hover:bg-zinc-700 rounded transition-colors duration-200 cursor-pointer border-none text-base"
//             >
//               Exportar como SVG
//             </button>

//             <button
//               onClick={exportToXLSX}
//               className="w-full text-left px-4 py-3 text-white bg-transparent hover:bg-zinc-700 rounded transition-colors duration-200 cursor-pointer border-none text-base"
//             >
//               Exportar como XLSX
//             </button>
//           </div>
//         )}
//       </div>
//     );
//   };


//   return (
//     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
//       <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
//         <ChartArea className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
//         Seção 7: Estátisticas e Análises
//       </h2>
     
//       <div className={handleSource('Scopus').length > 0 && handleSource('Web of Science').length > 0 ? "grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6": "grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 "}>
//         {handleSource('Scopus').length > 0 && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center ">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300'>Número de publicações por ano - Scopus</h3>
//             <div className="relative w-full  ">

//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart1" 
//                 isOpen={openMenuId === 'chart1'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefScopus}
//                 data={publicationsYearScopus}
//               />
//               <div ref={chartRefScopus} style={{ width: '100%', height: '100%' }} >
//                 <ComposedChart 
//                   style={{ width: '100%', height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
//                   responsive
//                   data={publicationsYearScopus}
//                   margin={{
//                     top: 5,
//                     right: 0,
//                     left: 0,
//                     bottom: 5,
//                   }}
//                 >
//                   <CartesianGrid  stroke={stroke} strokeWidth={0.5}/>
//                   <XAxis dataKey="year" width="auto" stroke={stroke}/>
//                   <YAxis  dataKey="count" width="auto" stroke={stroke}/>
//                   <Tooltip  
//                     content={({ active, payload }) => {
//                       if (active && payload && payload.length) {
//                         const data = payload[0].payload;
//                         return (
//                           <div style={{ 
//                             backgroundColor: '#1a1a1a', 
//                             padding: '10px', 
//                             border: '1px solid #444',
//                             borderRadius: '8px',
//                             boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                           }}>
//                             <p style={{ margin: 0, fontWeight: 'bold', color:'#fff' }}>{data.year}</p>
//                             <p style={{ margin: '5px 0 0 0', color: '#fb923c' }}>Quant.: {data.count}
//                             </p>
//                           </div>
//                         );
//                       }
//                       return null;
//                     }}/>
//                   <Line type="monotone" dataKey="count" stroke="#fb923c" strokeWidth={2} name="Quant." />
//                   <Bar type="monotone" dataKey="count" fill='#3b2b2b'  strokeWidth={2} name="Quant." />
//                 </ComposedChart>
//               </div>
//           </div>
//         </div>)}
//         {handleSource('Web of Science').length > 0 && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Número de publicações por ano - Web of Science</h3>
//           <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart2" 
//                 isOpen={openMenuId === 'chart2'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRef}
//                 data={publicationsYearWOS}
//               />
//               <div ref={chartRef} style={{ width: '100%', height: '100%' }}>
//               <ComposedChart 
//                 style={{ width: '100%', height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
//                 responsive
//                 data={publicationsYearWOS}
//                 margin={{
//                   top: 5,
//                   right: 0,
//                   left: 0,
//                   bottom: 5,
//                 }}
//               >
//                 <CartesianGrid  stroke={stroke} strokeWidth={0.5}/>
//                 <XAxis dataKey="year" width="auto" stroke={stroke} />
//                 <YAxis  dataKey="count" width="auto" stroke={stroke}/>
//                 <Tooltip  
//                   content={({ active, payload }) => {
//                     if (active && payload && payload.length) {
//                       const data = payload[0].payload;
//                       return (
//                         <div style={{ 
//                           backgroundColor: '#1a1a1a', 
//                           padding: '10px', 
//                           border: '1px solid #444',
//                           borderRadius: '8px',
//                           boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                         }}>
//                           <p style={{ margin: 0, fontWeight: 'bold', color:'#fff' }}>{data.year}</p>
//                           <p style={{ margin: '5px 0 0 0', color: '#d4d0e3' }}>Quant.: {data.count}
//                           </p>
//                         </div>
//                       );
//                     }
//                     return null;
//                   }}/>
//                 <Line type="monotone" dataKey="count" stroke="#d4d0e3" strokeWidth={2} name="Quant." />
//                 <Bar type="monotone" dataKey="count" fill='#592aaa'  strokeWidth={2} name="Quant." />
//             </ComposedChart>
//             </div>
//           </div>
//         </div>)}
//         {( handleSource('Web of Science').length > 0 || handleSource('Scopus').length > 0) && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Número de publicações por ano - Total</h3>
//           <div className="relative w-full">
//             {/* Menu de Exportação */}
//             <ChartExport 
//               id="chart3" 
//               isOpen={openMenuId === 'chart3'}
//               onToggle={toggleMenu}
//               chartRef={chartRefTotal}
//               data={publicationsYearTotal}
//             />
//             <div ref={chartRefTotal} style={{ width: '100%', height: '100%' }}>
//               <ComposedChart 
//                 style={{ width: '100%', height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
//                 responsive
//                 data={publicationsYearTotal}
//                 margin={{
//                   top: 5,
//                   right: 0,
//                   left: 0,
//                   bottom: 5,
//                 }}
//               >
//                 <CartesianGrid  stroke={stroke} strokeWidth={0.5}/>
//                 <XAxis dataKey="year" width="auto" stroke={stroke} />
//                 <YAxis  dataKey="count" width="auto" stroke={stroke}/>
//                 <Tooltip
//                   content={({ active, payload }) => {
//                     if (active && payload && payload.length) {
//                       const data = payload[0].payload;
//                       return (
//                         <div style={{ 
//                           backgroundColor: '#1a1a1a', 
//                           padding: '10px', 
//                           border: '1px solid #444',
//                           borderRadius: '8px',
//                           boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                         }}>
//                           <p style={{ margin: 0, fontWeight: 'bold', color:'#fff' }}>{data.year}</p>
//                           <p style={{ margin: '5px 0 0 0', color: '#646464' }}>Quant.: {data.count}
//                           </p>
//                         </div>
//                       );
//                     }
//                     return null;
//                   }}
//                   />
//                 <Line type="monotone" dataKey="count" stroke="#646464" strokeWidth={2} name="Quant." />
//                 {/* <Label 
//                   value="Centered Label" 
//                   position="insideBottom" 
//                   textAnchor="middle" 
//                   fill="#666" 
//                   offset={-40}
//                 /> */}
//                 <Bar type="monotone" dataKey="count" fill='#3f3f3fff'  strokeWidth={2} name="Quant." />
//             </ComposedChart>
//             <h4 style={{ color: "#666" }}>*Trabalhos duplicados não contabilizados</h4>

//           </div>
//           </div>
//         </div>)}
//       </div>

//       {( handleSource('Web of Science').length > 0 || handleSource('Scopus').length > 0) && (
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
//         {/* <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center"> */}
//           {/* <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Keywords com maiores ocorrências</h3> */}
//           {/* <div className="relative w-full "> */}
//             {/* Menu de Exportação
//             <ChartExport 
//               id="chart4" 
//               isOpen={openMenuId === 'chart4'}
//               onToggle={toggleMenu}
//               chartRef={chartRefKeywords}
//               data={chartData}
//             /> */}
//             {/* <div ref={chartRefKeywords} style={{ width: '100%', height: '100%' }}>
//               <ScatterChart
//                 style={{ width: '100%',  height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
//                 responsive
//                 margin={{
//                   top: 20,
//                   right: 20,
//                   bottom: 20,
//                   left: 20,
//                 }}
//               >
//                 <CartesianGrid  vertical={false} horizontal={false} />
//                 <XAxis hide={true} type="number" dataKey="x" stroke="white" />
//                 <YAxis hide={true} type="number" dataKey="y" stroke="white" />

//                 <Tooltip 
//                   cursor={false}
//                   content={({ active, payload }) => {
//                     if (active && payload && payload.length) {
//                       const data = payload[0].payload;
//                       return (
//                         <div style={{ 
//                           backgroundColor: 'white', 
//                           padding: '10px', 
//                           border: '1px solid #ccc',
//                           borderRadius: '4px'
//                         }}>
//                           <p style={{ margin: 0, fontWeight: 'bold', color:'#000' }}>{data.keyword}</p>
//                           <p style={{ margin: '5px 0 0 0', color: '#666' }}>Contagem: {data.count}
//                           </p>
//                         </div>
//                       );
//                     }
//                     return null;
//                   }}
//                 />
//                 <Scatter data={chartData} fill="#8884d8">
//                   <LabelList dataKey="count" fill="black" />
//                 </Scatter>
//                 <ZAxis  range={[900, 4000]} dataKey="z" />
//               </ScatterChart>
//             </div> */}
//           {/* </div> */}
//         {/* </div> */}
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Número de publicações por país</h3>
//             <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart5" 
//                 isOpen={openMenuId === 'chart5'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefCountries}
//                 data={countriesCount}
//               />
//               <div ref={chartRefCountries} style={{ width: '100%', height: '100%' }}>
//                   <BarChart 
//                     layout="vertical"
//                     style={{ width: '100%', height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
//                     responsive
//                     data={countriesCount}
//                     margin={{
//                       top: 5,
//                       right: 0,
//                       left: 0,
//                       bottom: 5,
//                     }}
//                   >

//                     <CartesianGrid  stroke={stroke} strokeWidth={0.5}/>
//                     <XAxis type="number" dataKey="count" width="auto" stroke={stroke} />
//                     <YAxis type="category" dataKey="country" width="auto" stroke={stroke}/>
//                     <Tooltip  
//                       content={({ active, payload }) => {
//                         if (active && payload && payload.length) {
//                           const data = payload[0].payload;
//                           return (
//                             <div style={{ 
//                               backgroundColor: '#1a1a1a', 
//                               padding: '10px', 
//                               border: '1px solid #444',
//                               borderRadius: '8px',
//                               boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
//                             }}>
//                               <p style={{ margin: 0, fontWeight: 'bold', color:'#fff' }}>{data.country}</p>
//                               <p style={{ margin: '5px 0 0 0', color: '#646464' }}>Quant.: {data.count}
//                               </p>
//                             </div>
//                           );
//                         }
//                         return null;
//                       }}/>
//                     <Bar type="monotone" dataKey="count" fill='#646464'  strokeWidth={2} name="Quant." />
//                 </BarChart>
//               </div>
//             </div>
//         </div>
//       </div>)}
      
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
//         {(criterionsCount["filter1"][0]["value"]!==0 || criterionsCount["filter1"][1]["value"]!==0 || criterionsCount["filter1"][2]["value"]!==0) && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Panorama Filtro 1</h3>
//             <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart6" 
//                 isOpen={openMenuId === 'chart6'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefPaFilter1}
//                 data={criterionsCount["filter1"]}
//               />
//               <div ref={chartRefPaFilter1} style={{ width: '100%', height: '100%' }}>
//                   <PieChart style={{ width: '100%', maxHeight: '70vh', aspectRatio: 1 }} responsive>
//                     <Pie
//                       data={criterionsCount["filter1"]}
//                       dataKey="value"
//                       // innerRadius={150}  // Remove o ring (era algo como 60)
//                       label={renderCustomizedLabel}  // Adiciona labels
//                       stroke="none"
//                       labelLine={false}
//                       fill="#8884d8"
//                       isAnimationActive={false}
//                     >
//                        {criterionsCount["filter1"].map((entry, index) => {
//                         // Define cores para cada tipo
//                         return <Cell key={`cell-${index}`} fill={colors[entry.name]} />;
//                       })}
//                   </Pie>
//                   <Legend 
//                     verticalAlign="bottom" 
//                     height={36}
//                     content={<CustomLegend data={criterionsCount["filter1"]} />}
//                     formatter={(value) => {
//                       // Traduz os nomes se necessário
//                       const translations = {
//                         included: 'Incluído',
//                         excluded: 'Excluído',
//                         unclassified: 'Não Classificado'
//                       };
//                       return translations[value] || value;
//                     }}
//                   />
//                 </PieChart>
//               </div>
//             </div>
//         </div>)}
//         {( criterionsCount["filter2"][0]["value"]!==0 || criterionsCount["filter2"][1]["value"]!==0 || criterionsCount["filter2"][2]["value"]!==0) && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Panorama Filtro 2</h3>
//             <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart7" 
//                 isOpen={openMenuId === 'chart7'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefPaFilter2}
//                 data={criterionsCount["filter2"]}
//               />
//               <div ref={chartRefPaFilter2} style={{ width: '100%', height: '100%' }}>
//                   <PieChart style={{ width: '100%', maxHeight: '70vh', aspectRatio: 1 }} responsive>
//                     <Pie
//                       data={criterionsCount["filter2"]}
//                       dataKey="value"
//                       // innerRadius={150}  // Remove o ring (era algo como 60)
//                       label={renderCustomizedLabel}  // Adiciona labels
//                       stroke="none"
//                       labelLine={false}
//                       fill="#8884d8"
//                       isAnimationActive={false}
//                     >
//                        {criterionsCount["filter2"].map((entry, index) => {
//                         // Define cores para cada tipo

                        
//                         return <Cell key={`cell-${index}`} fill={colors[entry.name]} />;
//                       })}
//                   </Pie>
//                   <Legend 
//                     verticalAlign="bottom" 
//                     height={36}
//                     content={<CustomLegend data={criterionsCount["filter2"]} />}
//                     formatter={(value) => {
//                       // Traduz os nomes se necessário
//                       const translations = {
//                         included: 'Incluído',
//                         excluded: 'Excluído',
//                         unclassified: 'Não Classificado'
//                       };
//                       return translations[value] || value;
//                     }}
//                   />
//                 </PieChart>
//               </div>
//             </div>
//         </div>)}
//         {( criterionsCount["filter3"][0]["value"]!==0 || criterionsCount["filter3"][1]["value"]!==0 || criterionsCount["filter3"][2]["value"]!==0) && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Panorama Filtro 3</h3>
//             <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               <ChartExport 
//                 id="chart8" 
//                 isOpen={openMenuId === 'chart8'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefPaFilter3}
//                 data={criterionsCount["filter3"]}
//               />
//               <div ref={chartRefPaFilter3} style={{ width: '100%', height: '100%' }}>
//                   <PieChart style={{ width: '100%', maxHeight: '70vh', aspectRatio: 1 }} responsive>
//                     <Pie
//                       data={criterionsCount["filter3"]}
//                       dataKey="value"
//                       // innerRadius={150}  // Remove o ring (era algo como 60)
//                       label={renderCustomizedLabel}  // Adiciona labels
//                       stroke="none"
//                       labelLine={false}
//                       fill="#8884d8"
//                       isAnimationActive={false}
//                     >
//                        {criterionsCount["filter3"].map((entry, index) => {
//                         // Define cores para cada tipo                     
//                         return <Cell  key={`cell-${index}`} fill={colors[entry.name]} />;
//                       })}
//                   </Pie>
//                   <Legend 
//                     verticalAlign="bottom" 
//                     height={36}
//                     content={<CustomLegend data={criterionsCount["filter3"]} />}
//                     formatter={(value) => {
//                       // Traduz os nomes se necessário
//                       const translations = {
//                         included: 'Incluído',
//                         excluded: 'Excluído',
//                         unclassified: 'Não Classificado'
//                       };
//                       return translations[value] || value;
//                     }}
//                   />
//                 </PieChart>
//               </div>
//             </div>
//         </div>)}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
//         {( criterionsCount["filter1"]) && (
//         <div className="grid grid-cols-1 lg:grid-cols-1 gap-3 justify-items-center">
//           <h3 className='text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-300 '>Fluxograma Prisma</h3>
//             <div className="relative w-full ">
//               {/* Menu de Exportação */}
//               {/* <ChartExport 
//                 id="chart9" 
//                 isOpen={openMenuId === 'chart9'}
//                 onToggle={toggleMenu}
//                 chartRef={chartRefPrisma}
//                 data={criterionsCount["filter1"]}
//               /> */}
              
//               <div   style={{ width: '100%', maxHeight: '100vh', aspectRatio: 1 }}>
//                 <ReactFlow ref={chartRefPrisma} nodes={initNodes} edges={initEdges} nodeTypes={nodeTypes} fitView zoomOnScroll={false}   panOnDrag={false}>
                      
//                       {/* <DownloadButton /> */}
//                       {/* <Controls >
//                         <ControlButton onClick={() => {
//                             if(chartRefPrisma.current === null) return
//                             toSvg(chartRefPrisma.current, {
//                                 filter: node => !(
//                                     node?.classList?.contains('react-flow__minimap') ||
//                                     node?.classList?.contains('react-flow__controls')
//                                 ),
//                             }).then(dataUrl => {
//                                 const a = document.createElement('a');
//                                 a.setAttribute('download', 'reactflow.svg');
//                                 a.setAttribute('href', dataUrl);
//                                 a.click();
//                             });
//                         }}>
//                             <img src="assets/export.png" alt="Export" width="16px" height="16px" />
//                         </ControlButton>
//                       </Controls> */}
//                 </ReactFlow>
              
//               </div>
//             </div>
//         </div>)}
  
//       </div>
       

//     </div>
//   );
// };

// Componente melhorado para lista de artigos
const ArticlesList = ({ articles, currentFilter, onUpdateStatus, protocol }) => {
  const [pagination, setPagination] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  // Filtrar artigos baseado no status (pendente, incluído, excluído)
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showCriterionModal, setShowCriterionModal] = useState(null);
  const [itemsPerPage] = useState(50);
  const [contextMenu, setContextMenu] = useState(null);
  const [interval, setInterval] = useState(0);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [criterias, setCriterias] = useState([]);
  const [optionExtraction, setOptionExtraction] = useState(null);
  // Obter página atual para a seção específica
  const currentPage = pagination[currentFilter] || 1;
  const janelaRef = useRef(null);
  useEffect(() => {
      const allEmpty = protocol.extractionCriteria.every(
        criterion => criterion.value === ''
      );
      setOptionExtraction(allEmpty);
  }, [protocol]);

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
        article.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
        // article.journal.toLowerCase().includes(searchTerm.toLowerCase())
        // article.authors.toLowerCase().includes(searchTerm.toLowerCase()) 
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
  const totalArticles = filteredArticles.length
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

  const handleExtraction = (article, criterion = null) => {
    const statusField = getStatusField(currentFilter);
    onUpdateStatus(article.id, statusField, 'extracted', null, criterion);
    setShowCriterionModal(null);
  }

  const handleDuplicate = (article, criterion = null) => {
    console.log(currentFilter)
    const statusField = getStatusField(currentFilter);
    onUpdateStatus(article.id, statusField, 'duplicate', criterion);
    // setShowCriterionModal(null);

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
      case 'statistics': return 'Estátisticas e Análises';
      default: return 'Artigos';
    }
  };

  const getCurrentArticle = (article) => {
    setSelectedArticle(article)
    const index = filteredArticles.findIndex(a => a === article);
    if (index !== -1) {
      setCurrentArticle(index);
    }
  }

  useEffect(() => {
    setSelectedArticle(filteredArticles[currentArticle]);
  }, [currentArticle]);
  
  useEffect(() => {
    if(selectedArticle !== null){
      if (janelaRef.current) {
        janelaRef.current.scrollTo({
          top: 0,
        });
      }
    }
  }, [currentArticle]);

  useEffect(() => {
    if(selectedArticle !== null){
      setSelectedArticle(filteredArticles[currentArticle])
    }
  }, [articles]);

  

  // const statusArtSelected = useMemo(() => {
  //     console.log(selectedArticle)
  //     console.log(selectedArticle[getStatusField(currentFilter)])
  //   // selectedArticle !== null? getStatusField(currentFilter) : null;
  // }, [selectedArticle]);

  // console.log(statusArtSelected)
  // console.log(selectedArticle)

  useEffect(() => {
    const scores = articles.map(article => article.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    setInterval(maxScore - minScore);
  }, [articles]);
  
  useEffect(() => {
    const criterias  = []
    protocol.inclusionCriteria.filter(c => c.value.trim()).map((criteria)=>{
      criterias.push({id:criteria.id, label:criteria.value, category: 'inclusion'})
    })
    protocol.exclusionCriteria.filter(c => c.value.trim()).map((criteria)=>{
      criterias.push({id:criteria.id, label:criteria.value, category: 'exclusion'})
    })
    protocol.qualityCriteria.filter(c => c.value.trim()).map((criteria)=>{
      criterias.push({id:criteria.id, label:criteria.value, category: 'quality'})
    })
    setCriterias(criterias)
  }, [protocol]);

  const quadrants = (quadrant, score) => {  
    const ver = score > quadrant*(interval/10) ? true : false;
    return ver;
  };

  const tooltipContent = (
    <div>
      <strong className="block mb-1.5 text-sm text-white">Tooltip rico 🎉</strong>
      <p className="text-xs leading-relaxed text-gray-400">
        Coloque qualquer <em className="text-violet-400">JSX</em> aqui — ícones, links, formatação…
      </p>
    </div>
  );


  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-200">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-xl font-semibold text-gray-800 dark:text-white">
            Artigos {statusFilter==="pending"?'pendentes':statusFilter==="included"?'incluídos':statusFilter==="excluded"?'excluídos':statusFilter==="duplicate"?'duplicados':''} no {getSectionTitle()} ({filteredArticles.length} total)
          </h3>
        </div>
        
        {/* Barra de busca e filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Busca por título, palavras-chaves ou resumo..."
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
      
      <div className="overflow-x-auto ">
        <table className="w-full ">
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
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Autores
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th> */}
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
                  className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  onContextMenu={(e) => handleContextMenu(e, article)}
                >
                  <td className="px-6 py-4 max-w-80">
                    <div className="max-w-md"
                      title={article.abstract}
                    >

                      <div className="text-sm font-medium text-gray-900 dark:text-white break-words" data-tooltip-id="tooltip-rico">
                        {article.title}
                      </div>
                      {/* <ReactTooltip id="tooltip-rico" >
                        <div className="text-sm max-w-3xs borde">
                          <strong>Informação importante: </strong>{article.abstract}
                
                        </div>
                      </ReactTooltip> */}

                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {article.authors}
                      </div>
                    </div>
                  </td>
                  {/* <td className="px-6 py-4 max-w-10">
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {article.authors}
                    </div>
                  </td> */}
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 ">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      article.source === 'Scopus' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' :
                      article.source === 'Web of Science' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300' :
                      article.source === 'PubMed' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300' :
                      'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300'
                    }`}>
                      {article.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 ">
                    {article.year}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 ">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        quadrants(8, article.score || 0) ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                        quadrants(5, article.score || 0) ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                        quadrants(2, article.score || 0) ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                        'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400'
                      }`}>
                        {article.score === null? '-' : article.score}
                      </span>
                  </td>
                  <td className="px-6 py-4 ">
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
                  <td className="px-1 py-4 text-sm font-medium">
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
                            // incluir direto no filtro 1 sem abrir modal
                            handleExclude(article);
                          } else {
                            setShowCriterionModal({ type: 'exclude', article });
                          }
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"
                        title="Excluir"
                      >
                        <XCircle size={16} />
                      </button>
                      <button
                        onClick={() => {handleDuplicate(article)}}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"

                        title="Duplicata"
                      >
                            <BookCopy size={16} />
                      </button>
                      
                      <button
                          onClick={() => getCurrentArticle(article)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 transition-colors duration-200"
                          title="Ver detalhes"
                        >
                          <Eye size={16} />
                      </button>
                    
                      {/* {currentFilter === "filter3" && (
                        <button
                          onClick={() => setSelectedArticle(article)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 transition-colors duration-200"
                          title="Ver detalhes"
                        >
                          <ListCollapse size={16} />
                        </button>
                      )}              */}
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
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal para seleção de critério */}

      <MultiSelect
        isOpen={showCriterionModal !== null}
        onClose={() => setShowCriterionModal(null)}
        options={criterias}
        onSelect={(criterion, status) => {
          if (status === 'included') {
            handleInclude(showCriterionModal.article, criterion);
          } else if (status === 'excluded') {
            handleExclude(showCriterionModal.article, criterion);
          } else if (status === 'extracted') {
            handleExtraction(showCriterionModal.article, criterion);
          } 
        }}
        criteria={showCriterionModal?.type === 'include' ? protocol.inclusionCriteria : showCriterionModal?.type === 'exclude'? protocol.exclusionCriteria: protocol.extractionCriteria}
        type={showCriterionModal?.type === 'include' ? 'inclusion' : showCriterionModal?.type === 'exclude'? 'exclusion': 'extraction'}

      />
      {/* Modal de detalhes */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          currentFilter={currentFilter}
          getStatusField={getStatusField}
          currentArticle={currentArticle}
          totalArticles={totalArticles}
          setCurrentArticle={setCurrentArticle}
          handleInclude={handleInclude}
          handleExclude={handleExclude}
          handleDuplicate={handleDuplicate}
          setShowCriterionModal={setShowCriterionModal}
          optionExtraction={optionExtraction}
          janelaRef={janelaRef}
        />
        // <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-49">
        //   <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[95vh]  transition-colors scroll-smooth duration-200">
        //     <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        //       <div className="flex justify-between items-start">
        //         <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">{selectedArticle.title}</h3>
        //         <button
        //           onClick={() => setSelectedArticle(null)}
        //           className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        //         >
        //           <XCircle size={24} />
        //         </button>
        //       </div>
        //       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
        //           selectedArticle[getStatusField(currentFilter)] === 'included' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
        //           selectedArticle[getStatusField(currentFilter)] === 'excluded' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
        //           selectedArticle[getStatusField(currentFilter)] === 'duplicate' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' : // ✅ NOVO
        //           'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
        //         }`}>
        //           {selectedArticle[getStatusField(currentFilter)] === 'included' ? 'Incluído' : 
        //           selectedArticle[getStatusField(currentFilter)] === 'excluded' ? 'Excluído' : 
        //           selectedArticle[getStatusField(currentFilter)] === 'duplicate' ? 'Duplicata' : // ✅ NOVO
        //           'Pendente'}
        //       </span>
        //     </div>
        //     <div className="p-6 overflow-y-auto max-h-[60vh] scroll-smooth" ref={janelaRef}>
        //       <div className="grid grid-cols-2 gap-3 mb-4">
        //         <div className="text-gray-700 dark:text-gray-300"><strong>Autores:</strong> {selectedArticle.authors}</div>
        //         <div className="text-gray-700 dark:text-gray-300"><strong>Fonte:</strong> {selectedArticle.source}</div>
        //         <div className="text-gray-700 dark:text-gray-300"><strong>Revista:</strong> {selectedArticle.journal}</div>
        //         <div className="text-gray-700 dark:text-gray-300"><strong>Ano:</strong> {selectedArticle.year}</div>
        //         <div className="text-gray-700 dark:text-gray-300"> <strong>DOI:</strong> 
        //           <span
        //               onClick={() => window.open(`https://doi.org/${selectedArticle.doi}`, '_blank') }
        //               className="hover:text-blue-600 hover:dark:text-blue-400 hover:underline ml-1 cursor-pointer"
        //           > 
        //               {selectedArticle.doi} 
        //           </span>
        //         </div>
        //           <div className="text-gray-700 dark:text-gray-300"><strong>Score:</strong> {selectedArticle.score}</div>
        //         {/* <div className="text-gray-700 dark:text-gray-300"><strong>Idioma:</strong> {selectedArticle.language}</div> */}
        //       </div>
        //       <div className="mb-2">
        //         <strong className="text-gray-700 dark:text-gray-300">Palavras-chave:</strong>
        //         <div className="mt-2 flex flex-wrap gap-2">
        //           {selectedArticle.keywords.map((keyword, index) => (
        //             <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs rounded-full">
        //               {keyword}
        //             </span>
        //           ))}
        //         </div>
        //       </div>
        //       <div className="mb-2">
        //         <strong className="text-gray-700 dark:text-gray-300">Resumo:</strong>
        //         <p className="mt-2 text-gray-700 dark:text-gray-300">{selectedArticle.abstract}</p>
        //       </div>
              
              
              
        //       {/* {selectedArticle.inclusionCriterion && (
        //         <div className="mb-4">
        //           <strong className="text-green-700 dark:text-green-300">Critério de Inclusão:</strong>
        //           <p className="mt-1 text-green-600 dark:text-green-400 text-sm">{selectedArticle.inclusionCriterion}</p>
        //         </div>
        //       )}
        //       {selectedArticle.exclusionCriterion && (
        //         <div className="mb-4">
        //           <strong className="text-red-700 dark:text-red-300">Critério de Exclusão:</strong>
        //           <p className="mt-1 text-red-600 dark:text-red-400 text-sm">{selectedArticle.exclusionCriterion}</p>
        //         </div>
        //       )} */}
        //     </div>
        //     <div className="flex flex-row gap-1 max-w-m justify-center items-center mt-2 mb-2">
        //       <div className="flex flex-col gap-1 max-w-m justify-center items-center">
        //         <div className="flex gap-1 max-w-m justify-center ">
        //           <button
        //             onClick={() => {
        //               if (currentFilter === 'dataprocessing') {
        //                 // incluir direto no filtro 1 sem abrir modal
        //                 handleInclude(selectedArticle);
        //               } else {
        //                 setShowCriterionModal({ type: 'include', article: selectedArticle });
        //               }
        //             }}
        //             className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 p-1 transition-colors duration-200"
        //             title="Incluir"
        //           >
        //             <CheckCircle size={16} />
        //           </button>

        //           <button
        //             onClick={() => {
        //               if (currentFilter === 'dataprocessing') {
        //                 handleExclude(selectedArticle);
        //                 setSelectedArticle(selectedArticle)
        //               } else {
        //                 console.log(selectedArticle)
        //                 setShowCriterionModal({ type: 'exclude', article: selectedArticle });
        //               }
        //             }}
        //             className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"
        //             title="Excluir"
        //           >
        //             <XCircle size={16} />
        //           </button>
        //           <button
        //             onClick={() => {handleDuplicate(selectedArticle)}}
        //             className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 transition-colors duration-200"

        //             title="Duplicata"
        //           >
        //                 <BookCopy size={16} />
        //           </button>
        //             {currentFilter === "filter3" && (
                     
        //               <button
        //                 onClick={() => {   setShowCriterionModal({ type: 'extraction', article: selectedArticle }) }}
        //                 className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1 transition-colors duration-200 disabled:cursor-not-allowed disabled:text-gray-500"
        //                 title="Extração"
        //                 disabled={optionExtraction}
        //               >
        //                 <ListCollapse size={16} />
        //               </button>
        //               )}   
        //           </div>  
                     
                    
        //       </div>
        //       <div className="flex gap-2">
        //         <button
        //           onClick={() => setCurrentArticle(Math.max(0, currentArticle - 1))}
        //           disabled={currentArticle === 0}
        //           className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
        //         >
        //           Anterior
        //         </button>
        //         <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
        //           {currentArticle +1} / {totalArticles}
        //         </span>
        //         <button
        //           onClick={() => setCurrentArticle(Math.min(totalArticles-1, currentArticle + 1))}
        //           disabled={currentArticle === totalArticles-1}
        //           className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-200"
        //         >
        //           Próximo
        //         </button>
        //       </div> 
        //     </div>
        //   </div>
          
        // </div>
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
              {protocol.inclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                <button
                  key={`inc-${index}`}
                  onClick={() => handleContextMenuAction('include', criterion.value, contextMenu.article)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors duration-150"
                  title={criterion.value}
                >
                  <span className="block truncate">
                    {criterion.value.length > 35 ? criterion.value.substring(0, 35) + '...' : criterion.value}
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
              {protocol.exclusionCriteria.filter(c => c.value.trim()).map((criterion, index) => (
                <button
                  key={`exc-${index}`}
                  onClick={() => handleContextMenuAction('exclude', criterion.value, contextMenu.article)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-150"
                  title={criterion.value}
                >
                  <span className="block truncate">
                    {criterion.value.length > 35 ? criterion.value.substring(0, 35) + '...' : criterion.value}
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
  const [numStringSc, setNumStringSc] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState('protocol');
  const { theme, toggleTheme } = useTheme();
  const [importedData, setImportedData] = useState([]);
  const [completeProtocol, setCompleteProtocol] = useState(false);

  // Estado do protocolo
  const [protocol, setProtocol] = useState({
    title: '',
    researchQuestion: '',
    yearRange: { start: 2015, end: new Date().getFullYear() },
    languages: ['English'],
    keywords: [''],
    inclusionCriteria: [{id:'I1', value:''}],
    exclusionCriteria: [{id: 'E1',value:''}],
    extractionCriteria: [{id: 'EX1', value:'', type:'text', items: ['']}],
    qualityCriteria: [{id:'Q1', value:''}],
    databases: ['Scopus', 'Web of Science'],
    scoringSystem: {
      enabled: true,
      weights: {
        title: 3,      // Peso para keywords no título
        abstract: 2,   // Peso para keywords no resumo
        keywords: 1    // Peso para keywords nas palavras-chave
      },
      caseInsensitive: true,
      exactMatch: true, // false = busca parcial, true = palavra completa
      multipleOccurrences: true // contar múltiplas ocorrências da mesma keyword
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

  useEffect(() => {

    const completeInclusion = protocol.inclusionCriteria.map(a => a.value).some(c => c.trim())
    const completeExclusion = protocol.exclusionCriteria.map(a => a.value).some(c => c.trim())
    const completeQuality = protocol.qualityCriteria.map(a => a.value).some(c => c.trim())
    const completeDatabases = protocol.databases.length > 0
    const completeKeywords = protocol.keywords.some(c => c.trim())

    
    if(protocol.title && protocol.researchQuestion && completeInclusion && completeExclusion && completeQuality && completeDatabases && completeKeywords){
      setCompleteProtocol(true)
    }else{
      setCompleteProtocol(false)
    }

  }, [protocol]);

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
    if (!protocolKeywords.length) return 0;
    
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
    if (articles.length > 0 ) {
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

  const handleSaveProject = async () => {
    const state = { protocol, articles, currentSection, importedData, statistics };
    const result = await saveProjectToFile(state);
    
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
      inclusionCriteria: [{id:'I1', value:''}],
      exclusionCriteria: [{id: 'E1',value:''}],
      extractionCriteria: [{id: 'EX1', value:'', type:'text', items: ['']}],
      qualityCriteria: [{id:'Q1', value:''}],
      databases: ['Scopus', 'Web of Science'],
      scoringSystem: {
        enabled: true,
        weights: {
          title: 3,      // Peso para keywords no título
          abstract: 2,   // Peso para keywords no resumo
          keywords: 1    // Peso para keywords nas palavras-chave
        },
        caseInsensitive: true,
        exactMatch: true, // false = busca parcial, true = palavra completa
        multipleOccurrences: true // contar múltiplas ocorrências da mesma keyword
      }
    });
    setArticles([]);
    setCurrentSection('protocol');
    setImportedData([]);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    clearAutoSave();
  };

  const handleExportXLSX = async () => {

      const colorHeader = 'BFBFBF'
      const colors = ['F2F2F2', 'FFFFFF'];

      const copyProtocol = [{
        title: protocol.title,
        researchQuestion: protocol.researchQuestion,
        yearRange: `${protocol.yearRange.start} - ${protocol.yearRange.end}`,
        languages: protocol.languages.join("; "),
      }];

      const headerProtocol = {
        title: "Title",
        researchQuestion: "Research Question",
        yearRange: "Year Range",
        languages: "Languages",
      };

      protocol.inclusionCriteria.forEach((criterion, index) => {
        copyProtocol[0][`I${index + 1}`] = criterion.value || "";
        headerProtocol[`I${index + 1}`] = `Inclusion Criterion ${index + 1}`;
      });

      protocol.exclusionCriteria.forEach((criterion, index) => {
        copyProtocol[0][`E${index + 1}`] = criterion.value || "";
        headerProtocol[`E${index + 1}`] = `Exclusion Criterion ${index + 1}`;
      });

      protocol.qualityCriteria.forEach((criterion, index) => {
        copyProtocol[0][`Q${index + 1}`] = criterion.value || "";
        headerProtocol[`Q${index + 1}`] = `Quality Criterion ${index + 1}`;
      });

      protocol.extractionCriteria.forEach((criterion, index) => {
        copyProtocol[0][`EX${index + 1}`] = criterion.value || "";
        headerProtocol[`EX${index + 1}`] = `Extraction Criterion ${index + 1}`;
      });
      const workbook = new ExcelJS.Workbook();
      const wsProtocol = workbook.addWorksheet("Protocolo");
      // Colunas (header + key)
      wsProtocol.columns = Object.keys(headerProtocol).map(key => ({
        header: headerProtocol[key],
        key,
        width: 30,
      }));

      // Linha de dados
      wsProtocol.addRow(copyProtocol[0]);

      const row = wsProtocol.getRow(2);

      row.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { vertical: "middle"};
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colors[0] },
        };
        cell.border = {
          left: {style:'thin'},
          right: {style:'thin'}
        };
      });

      // Estilo do header
      wsProtocol.getRow(1).eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorHeader },
        };
        cell.border = {
          left: {style:'thin'},
          right: {style:'thin'}
        };
      });

      const copyArticles = articles.map(article => {
        const {
          quality,
          numString,
          duplicateOf,
          exclusionReason,
          extractionCriteria,
          ...resto
        } = article;

        const extractionAttributes = article.extractionCriteria
          ? article.extractionCriteria.reduce((acc, item) => {
              acc[item.id] = item.response ?? "";
              return acc;
            }, {})
          : {};
          
        console.log(article.countries)
        return {
          ...resto,
          isDuplicate: article.isDuplicate ? "Yes" : "No",
          keywords: article.keywords ? article.keywords.join("; ") : "",
          countries: !article.countries.includes('País não informado') ? article.countries.join("; ") : "",
          inclusionCriterion: article.inclusionCriterion
            ? article.inclusionCriterion.join("; ")
            : "",
          exclusionCriterion: article.exclusionCriterion
            ? article.exclusionCriterion.join("; ")
            : "",
          qualityCriteria: article.qualityCriteria
            ? article.qualityCriteria.join("; ")
            : "",
          ...extractionAttributes,
        };
      });
      const headerArticles = {
        title: "Title",
        authors: "Authors",
        abstract: "Abstract",
        keywords: "Keywords",
        year: "Year",
        studyType: "Study Type",
        journal: "Journal",
        affiliations: "Affiliations",
        countries: "Countries",
        language: "Language",
        doi: "DOI",
        source: "Source",
        searchString: "Search String",
        score: "Score",
        isDuplicate: "Is Duplicate",
        dataProcessingStatus: "Data Processing Status",
        filter1Status: "Filter 1 Status",
        filter2Status: "Filter 2 Status",
        filter3Status: "Filter 3 Status",
        inclusionCriterion: "Inclusion Criteria",
        exclusionCriterion: "Exclusion Criteria",
        qualityCriteria: "Quality Criteria",
        importDate: "Imported Date",
        lastModified: "Last Modified",
      };
      const wsArticles = workbook.addWorksheet("Articles");

      wsArticles.columns = Object.keys(headerArticles).map(key => ({
        header: headerArticles[key],
        key,
        width: 30,
      }));

      // Adiciona linhas
      copyArticles.forEach((article, index) => {
        wsArticles.addRow(article);
        
        const rowNumber = index + 2; // +1 header, +1 índice base 0
        const row = wsArticles.getRow(rowNumber);

        const currentColor = index % 2 === 0 ? colors[0] : colors[1];

        row.eachCell({ includeEmpty: true }, cell => {
          cell.alignment = { vertical: "middle"};
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: currentColor },
          };
          cell.border = {
            left: {style:'thin'},
            right: {style:'thin'}
          };
        });
      });

      // Estilo do header
      wsArticles.getRow(1).eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorHeader },
        };
        cell.border = {
          left: {style:'thin'},
          right: {style:'thin'}
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob([buffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "protocol-and-articles.xlsx";
      a.click();
      URL.revokeObjectURL(url);
  }

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
        
    // articles.filter(a => a.dataProcessingStatus === 'duplicate' && !a.isDuplicate).length
    // console.log(importedData)
    const importSection = {};
    importedData.forEach(data => {

      console.log(articles.filter(a => a.idData === data.id ))
      console.log(articles.filter(a =>  a.isDuplicate ))
      console.log(articles.filter(a =>  a.idData === data.id && a.isDuplicate ))

      importSection['unique' + data.id] = articles.filter(
        a => a.idData === data.id && !a.isDuplicate
      ).length;
      importSection['duplicate' + data.id] = articles.filter(
        a => a.idData === data.id && a.isDuplicate
      ).length;
    });

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
    
    return {importSection, dataProcessing, filter1, filter2, filter3 };
  }, [articles, importedData]);
    
  const handleImport = useCallback((newArticles, source) => {
    setLoading(true);
    // setTimeout(() => {
      
      // setArticles(prev => [...prev, ...newArticles]);
      setArticles(prev => {
        const allArticles = [...prev, ...newArticles];
        
        const duplicatesByDOI = new Map();
        const duplicatesByTitle = new Map();

        return allArticles.map(article => {
          // if (article.isDuplicate) return article;

          let isDuplicate = false;
          let duplicateOf = article.duplicateOf;

          if (article.doi && duplicatesByDOI.has(article.doi)) {
            isDuplicate = true;
            duplicateOf = duplicatesByDOI.get(article.doi);
          } else if (article.doi) {
            duplicatesByDOI.set(article.doi, article.id);
          }

          const normalizedTitle = article.title.toLowerCase().trim();
          if (duplicatesByTitle.has(normalizedTitle)) {
            isDuplicate = true;
            duplicateOf = duplicatesByTitle.get(normalizedTitle);
          } else {
            duplicatesByTitle.set(normalizedTitle, article.id);
          }

          return isDuplicate
            ? { ...article, isDuplicate: true, dataProcessingStatus: 'duplicate', duplicateOf }
            : article;
        });
      });
      setLoading(false);
    // }, 1500);
  }, []);
  
  const handleUpdateStatus = useCallback((id, statusType, status, reason = null, criterion = null) => {
    // criterions agora é um array de critérios selecionados
    // Se for chamada pelço modo "rápido", será passado um array apenas com um critério
    // parametro multiselect indica se é múltipla seleção

    if(status === 'extracted'){
      const extractionCriteria = criterion
      setArticles(prev => prev.map(article => 
          article.id === id 
            ? { 
                ...article, 
                [statusType]: status, 
                extractionCriteria: extractionCriteria,
                lastModified: new Date() 
              }
            : article
      ));
      
    }else{
      if(criterion && Array.isArray(criterion)){

        const inclusionCriteria = criterion.filter(c => c.category === 'inclusion').map(c => c.id)
        const exclusionCriteria = criterion.filter(c => c.category === 'exclusion').map(c => c.id)
        const qualityCriteria = criterion.filter(c => c.category === 'quality').map(c => c.id)
        setArticles(prev => prev.map(article => 
          article.id === id 
            ? { 
                ...article, 
                [statusType]: status, 
                exclusionReason: reason,
                inclusionCriterion: inclusionCriteria.length !== 0 ? inclusionCriteria : article.inclusionCriterion,
                exclusionCriterion: exclusionCriteria.length !== 0 ? exclusionCriteria : article.exclusionCriterion,
                qualityCriteria: qualityCriteria.length !== 0 ? qualityCriteria : article.qualityCriteria,
                lastModified: new Date() 
              }
            : article
        ));

      }else{
        console.log(statusType, status)
        if(status === 'duplicate'){
          setArticles(prev => prev.map(article => 
            article.id === id 
              ? { 
                  ...article, 
                  [statusType]: status, 
                  isDuplicate: status === 'duplicate'? true: false,
                  lastModified: new Date() 
                }
              : article
          ));
        }else{
          criterion = [criterion]
          setArticles(prev => prev.map(article => 
            article.id === id 
              ? { 
                  ...article, 
                  [statusType]: status, 
                  exclusionReason: reason,
                  inclusionCriterion: status === 'included' ? criterion : article.inclusionCriterion,
                  exclusionCriterion: status === 'excluded' ? criterion : article.exclusionCriterion,
                  isDuplicate: false,
                  lastModified: new Date() 
                }
              : article
          ));
        }
        
      }
    }
    
    

  }, []);

  // Função para detectar duplicatas por diferentes critérios
  const detectDuplicates = useCallback(() => {
    console.log(articles)
    const duplicatesByDOI = new Map();
    const duplicatesByTitle = new Map();
    // const duplicatesByAuthorsYear = new Map();
    
    const updatedArticles = articles.map(article => {
      // if (article.isDuplicate) return article;

      let isDuplicate = false;
      let duplicateOf = article.duplicateOf;

      if (article.doi && duplicatesByDOI.has(article.doi)) {
        isDuplicate = true;
        duplicateOf = duplicatesByDOI.get(article.doi);
      } else if (article.doi) {
        duplicatesByDOI.set(article.doi, article.id);
      }

      const normalizedTitle = article.title.toLowerCase().trim();
      if (duplicatesByTitle.has(normalizedTitle)) {
        isDuplicate = true;
        duplicateOf = duplicatesByTitle.get(normalizedTitle);
      } else {
        duplicatesByTitle.set(normalizedTitle, article.id);
      }
      console.log(isDuplicate)
      if (isDuplicate) {
        return { ...article, isDuplicate: true, dataProcessingStatus: 'duplicate', duplicateOf }; // ✅ novo objeto
      }else{
        return { ...article, isDuplicate: false, dataProcessingStatus: 'pending' }; // ✅ novo objeto
      }

      return article;
    });

    // articles.forEach(article => {
    //   if (article.isDuplicate) return; // Pular se já é marcado como duplicata
      
    //   // Detectar por DOI
    //   if (article.doi && duplicatesByDOI.has(article.doi)) {
    //     article.isDuplicate = true;
    //     article.dataProcessingStatus = 'duplicate'
    //     article.duplicateOf = duplicatesByDOI.get(article.doi);
    //   } else if (article.doi) {
    //     duplicatesByDOI.set(article.doi, article.id);
    //   }
      
    //   // Detectar por título 
    //   const normalizedTitle = article.title.toLowerCase().trim();
    //   if (duplicatesByTitle.has(normalizedTitle)) {
    //     article.isDuplicate = true;
    //     article.dataProcessingStatus = 'duplicate'
    //     article.duplicateOf = duplicatesByTitle.get(normalizedTitle);
    //   } else {
    //     duplicatesByTitle.set(normalizedTitle, article.id);
    //   }
      
    //   // Detectar por autores + ano
    //   // const authorYearKey = `${article.authors.toLowerCase()}_${article.year}`;
    //   // if (duplicatesByAuthorsYear.has(authorYearKey)) {
    //   //   article.isDuplicate = true;
    //   //   article.duplicateOf = duplicatesByAuthorsYear.get(authorYearKey);
    //   // } else {
    //   //   duplicatesByAuthorsYear.set(authorYearKey, article.id);
    //   // }
    // });

    setArticles(updatedArticles);
    // console.log(articles.filter(a => a.isDuplicate).length);
  }, [articles]);

  const FileMenu = () => (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowFileMenu(!showFileMenu)}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
      >
        <FileText className="h-5 w-5" />
        <div className="hidden sm:block">
          Arquivo
        </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
        {/* Arquivo */}
        
      </button>

      {showFileMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 z-50">
          <button
            onClick={handleNewProject}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Novo Projeto
          </button>
          
          <label className="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
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
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Salvar Projeto
            {hasUnsavedChanges && <span className="text-red-500 text-xs">●</span>}
          </button>

           <button
            onClick={handleExportXLSX}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Table className="h-4 w-4" />
            Exportar .xlsx
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
  const sectionsToCheck = ['Tratamento', 'Filtro 1', 'Filtro 2', 'Filtro 3', 'Estatísticas']
  const sections = [
    { id: 'protocol', name: 'Protocolo', icon: Settings },
    { id: 'import', name: 'Importação', icon: Upload },
    { id: 'dataprocessing', name: 'Tratamento', icon: Database },
    { id: 'filter1', name: 'Filtro 1', icon: Filter },
    { id: 'filter2', name: 'Filtro 2', icon: Filter },
    { id: 'filter3', name: 'Filtro 3', icon: Filter },
    { id: 'statistics', name: 'Estatísticas', icon: ChartArea }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 m-0 p-0 transition-colors duration-200">
      <div className="w-full h-full px-4 py-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
          <div className="flex justify-between items-start mb-4 gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white leading-tight">
                Sistema de Revisão Sistemática da Literatura
              </h1>
              <StatusIndicator />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
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
                  disabled={sectionsToCheck.includes(section.name) && articles.length === 0}
                  title={sectionsToCheck.includes(section.name) && articles.length === 0 ? 'Importe artigos para ver as estatísticas' : ''}
                  className={sectionsToCheck.includes(section.name) && articles.length === 0 ? `text-sm px-4 py-2 rounded-lg flex items-center gap-2 border-none bg-gray-100 dark:bg-gray-900 hover:border-none disabled:cursor-not-allowed disabled:text-gray-400` :` text-sm x-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 ${
                    currentSection === section.id
                      ? ' text-sm bg-indigo-600 text-white dark:bg-indigo-500'
                      : ' text-sm bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 '
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
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                 {completeProtocol? '✓' : '○'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Protocolo</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{articles.length}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Importados</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.dataProcessing.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Tratados</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter1.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Filtro 1</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter2.included}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Filtro 2</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{statistics.filter3.included}</p>
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
            setArticles={setArticles}
            onImport={handleImport} 
            isLoading={loading} 
            protocol={protocol} 
            importedData={importedData}
            setImportedData={setImportedData}
            detectDuplicates={detectDuplicates}
            numStringSc={numStringSc}
            setNumStringSc={setNumStringSc}
            statistics={statistics}
            />
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
            extractionCriteria = {protocol.extractionCriteria}
            statistics={statistics}
          />
        )}

        {currentSection === 'statistics' && (
          <StatisticsSection 
            articles={articles}
            onUpdateStatus={handleUpdateStatus}
            inclusionCriteria = {protocol.inclusionCriteria} 
            exclusionCriteria = {protocol.exclusionCriteria}
            extractionCriteria = {protocol.extractionCriteria}
            statistics={statistics}
            theme={theme}
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