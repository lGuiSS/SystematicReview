// ─── StatisticsSection ───────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { ChartArea, Download, X, CheckSquare, Square } from 'lucide-react';
import {
  Line, Bar, Cell, Pie, PieChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ComposedChart, BarChart,
} from 'recharts';
import FileSaver from 'file-saver';
import ExcelJS from "exceljs";

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA — SVG puro, sem fundo, exportação apenas SVG
// ─────────────────────────────────────────────────────────────────────────────
const PrismaFlowchart = forwardRef(({ statistics, scopusCount, wosCount, totalCount, isDark }, ref) => {
  // Fiel ao CustomNode original: bg branco/gray-700, borda stone-400, sombra
  const nodeBg  = isDark ? '#374151' : '#ffffff';
  const border  = '#a8a29e'; // stone-400
  const txt     = isDark ? '#f3f4f6' : '#111827'; // label bold escuro
  const numTxt  = isDark ? '#d1d5db' : '#6b7280'; // gray-500 / gray-300
  const line    = isDark ? '#6b7280' : '#9ca3af';

  const mainX = 280;
  const sideX = 490;
  const nW    = 200;
  const sW    = 180;
  const nH    = 56;
  const r     = 6; // rounded-md ≈ 6px

  const rows = { n1:50, n2:50, n3:150, n4:200, n5:250, n6:300, n7:350, n8:400, n9:450, n10:500, n11:550};

  const Box = ({ cx, cy, w, h = nH, label, count }) => {
    const lns = label.includes('\n') ? label.split('\n') : label.length > 24 ? [label.slice(0, 24), label.slice(24)] : [label];
    const lineH = 15;
    const totalTextH = lns.length * lineH + 4 + 6; // linhas + gap + número
    const startY = cy - totalTextH / 2 + lineH / 2;
    return (
      <g>
        {/* sombra simulada */}
        <rect x={cx - w/2 + 2} y={cy - h/2 + 3} width={w} height={h} rx={r} ry={r} fill="rgba(0,0,0,0.12)" />
        <rect x={cx - w/2} y={cy - h/2} width={w} height={h} rx={r} ry={r}
              fill={nodeBg} stroke={border} strokeWidth={2} />
        {lns.map((ln, i) => (
          <text key={i} x={cx} y={startY + i * lineH}
                textAnchor="middle" fill={txt} fontSize={14} fontWeight="700"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">{ln}</text>
        ))}
        <text x={cx} y={startY + lns.length * lineH + 4}
              textAnchor="middle" fill={numTxt} fontSize={13} fontWeight="400"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">{count}</text>
      </g>
    );
  };

  const Arrow = ({ x1, y1, x2, y2 }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={line} strokeWidth={1.5} markerEnd="url(#prisma-arrow)" />
  );

  return (
    <svg ref={ref} viewBox="0 0 680 640" width="100%"
         style={{ maxHeight: '70vh' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="prisma-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={line} />
        </marker>
      </defs>

      {/* Scopus + WoS → Identificados */}
      <Arrow x1={mainX - 100}   y1={rows.n1 + nH/2} x2={mainX - 30} y2={rows.n3 - nH/2} />
      <Arrow x1={mainX + 100}   y1={rows.n2 + nH/2} x2={mainX + 30} y2={rows.n3 - nH/2} />
      {/* Identificados → Duplicados */}
      <Arrow x1={mainX} y1={rows.n3 + nH/2} x2={mainX}       y2={rows.n5 - nH/2} />
      {/* Duplicados → Excluídos F1 (side) + Incluídos F1 */}
      <Arrow  x1={mainX} y1={rows.n5 + nH/2} x2={mainX}       y2={rows.n7 - nH/2} stroke={line} strokeWidth={1.5} />
      <Arrow x1={mainX} y1={rows.n6}         x2={sideX - sW/2} y2={rows.n6} />
      {/* Incluídos F1 → Excluídos F2 + Incluídos F2 */}
      <Arrow  x1={mainX} y1={rows.n7 + nH/2} x2={mainX}       y2={rows.n9 - nH/2} stroke={line} strokeWidth={1.5} />
      <Arrow x1={mainX} y1={rows.n8}         x2={sideX - sW/2} y2={rows.n8} />
      {/* Incluídos F2 → Excluídos F3 + Incluídos F3 */}
      <Arrow x1={mainX} y1={rows.n10}  x2={sideX - sW/2} y2={rows.n10} />
      <Arrow  x1={mainX} y1={rows.n9 + nH/2} x2={mainX}       y2={rows.n11- nH/2} stroke={line} strokeWidth={1.5} />
      {/* <Arrow x1={mainX} y1={rows.n11 - nH/2 - 4} x2={mainX}  y2={rows.n11 - nH/2} /> */}


      <Arrow x1={mainX} y1={rows.n4} x2={sideX - sW/2} y2={rows.n4} />

      <Box cx={mainX-100}   cy={rows.n1}  w={160} label="Scopus"                       count={scopusCount} />
      <Box cx={mainX+100}   cy={rows.n2}  w={160} label="Web of Science"               count={wosCount} />
      <Box cx={mainX} cy={rows.n3}  w={nW}  label="Identificados"                count={totalCount} />

      <Box cx={sideX} cy={rows.n4}  w={sW}  label="Duplicados"                count={statistics.dataProcessing.duplicate} />

      <Box cx={mainX} cy={rows.n5}  w={nW}  label={"Após remoção\nde duplicados"} count={statistics.dataProcessing.included} />
      <Box cx={sideX} cy={rows.n6}  w={sW}  label="Excluídos – Filtro 1"         count={statistics.filter1.excluded} />
      <Box cx={mainX} cy={rows.n7}  w={nW}  label="Incluídos – Filtro 1"         count={statistics.filter1.included} />
      <Box cx={sideX} cy={rows.n8}  w={sW}  label="Excluídos – Filtro 2"         count={statistics.filter2.excluded} />
      <Box cx={mainX} cy={rows.n9}  w={nW}  label="Incluídos – Filtro 2"         count={statistics.filter2.included} />
      <Box cx={sideX} cy={rows.n10}  w={sW}  label="Excluídos – Filtro 3"         count={statistics.filter3.excluded} />
      <Box cx={mainX} cy={rows.n11} w={nW}  label="Incluídos – Filtro 3"         count={statistics.filter3.included} />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários de exportação
// ─────────────────────────────────────────────────────────────────────────────
const changeColors = (svgClone) => {
  const fix = (sel, attr, val, useChild = false) =>
    svgClone.querySelectorAll(sel).forEach(el => {
      if (useChild) el.children[0]?.setAttribute(attr, val);
      else          el.setAttribute(attr, val);
    });
  fix("g > g > g.recharts-cartesian-grid-horizontal > line",                           'stroke', '#000');
  fix("g > g > g.recharts-cartesian-grid-vertical > line",                             'stroke', '#000');
  fix("g > g.recharts-cartesian-axis-tick-labels.recharts-xAxis-tick-labels > g",      'fill',   '#000', true);
  fix("g > g.recharts-cartesian-axis-tick-labels.recharts-yAxis-tick-labels > g",      'fill',   '#000', true);
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > line",      'stroke', '#000');
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > line",      'stroke', '#000');
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > g > g > g", 'stroke', '#000', true);
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > g > g > g", 'stroke', '#000', true);
};

const exportSvgElement = async (svgEl, filename) => {
  const clone = svgEl.cloneNode(true);
  changeColors(clone);
  const style = document.createElement('style');
  style.textContent = `* { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.download = filename; a.href = url; a.click();
  URL.revokeObjectURL(url);
};

const exportSvgToPng = async (svgEl, filename) => {
  const clone = svgEl.cloneNode(true);
  changeColors(clone);
  const { width: w, height: h } = svgEl.getBoundingClientRect();
  const scale = 4;
  clone.setAttribute('width',   w * scale);
  clone.setAttribute('height',  h * scale);
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const style = document.createElement('style');
  style.textContent = `* { font-family: -apple-system, sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  canvas.width  = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  ctx.drawImage(img, 0, 0, w * scale, h * scale);
  canvas.toBlob(blob => { FileSaver.saveAs(blob, filename); URL.revokeObjectURL(url); }, 'image/png', 1);
};

const exportToXLSX = async (data, filename) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Data');
  if (data?.length) {
    ws.columns = Object.keys(data[0]).map(k => ({ header: k, key: k, width: 20 }));
    data.forEach(row => ws.addRow(row));
  }
  const buf = await workbook.xlsx.writeBuffer();
  FileSaver.saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// ChartExport — botão individual por instância de gráfico
// ─────────────────────────────────────────────────────────────────────────────
const ChartExport = ({ id, isOpen, onToggle, chartRef, data, svgOnly = false }) => {
  const getSvgEl = () => chartRef?.current?.tagName === 'svg'
    ? chartRef.current
    : chartRef?.current?.querySelector('svg') ?? null;

  const handlePNG = async () => {
    const svgEl = getSvgEl(); if (!svgEl) return;
    await exportSvgToPng(svgEl, `${id}.png`); onToggle(id);
  };
  const handleSVG = async () => {
    const svgEl = getSvgEl(); if (!svgEl) return;
    await exportSvgElement(svgEl, `${id}.svg`); onToggle(id);
  };
  const handleXLSX = async () => {
    await exportToXLSX(data, `${id}.xlsx`); onToggle(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => onToggle(id)}
        title="Exportar gráfico"
        className="bg-gray-800 dark:bg-gray-600 border-none rounded-full p-1.5 cursor-pointer transition-all duration-200 hover:scale-110 flex items-center justify-center"
        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        {isOpen ? <X size={12} color="white" /> : <Download size={12} color="white" />}
      </button>
      {isOpen && (
        <div className="absolute top-8 right-0 bg-zinc-800 rounded-lg p-1.5 min-w-[190px] z-50 shadow-xl">
          {!svgOnly && <button onClick={handlePNG}  className="w-full text-left px-4 py-2 text-sm text-white bg-transparent hover:bg-zinc-700 rounded cursor-pointer border-none">Exportar como PNG</button>}
          <button         onClick={handleSVG}  className="w-full text-left px-4 py-2 text-sm text-white bg-transparent hover:bg-zinc-700 rounded cursor-pointer border-none">Exportar como SVG</button>
          {!svgOnly && <button onClick={handleXLSX} className="w-full text-left px-4 py-2 text-sm text-white bg-transparent hover:bg-zinc-700 rounded cursor-pointer border-none">Exportar como XLSX</button>}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MultiToggle — pills com seleção múltipla dentro de uma seção
// ─────────────────────────────────────────────────────────────────────────────
const MultiToggle = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
    {options.map(opt => {
      const active = selected.has(opt);
      return (
        <button key={opt} onClick={() => onToggle(opt)}
          className={`px-3 py-1 text-xs sm:text-sm rounded-md font-medium transition-all duration-150 cursor-pointer border-none
            ${active
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 bg-transparent hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SectionWrapper — card externo que agrupa os gráficos de mesmo tipo
// ─────────────────────────────────────────────────────────────────────────────
const SectionWrapper = ({ title, controls, children }) => (
  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {controls}
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ChartInstance — card individual dentro de uma seção (com botão de export)
// ─────────────────────────────────────────────────────────────────────────────
const ChartInstance = ({ id, label, chartRef, data, openMenuId, onToggle, svgOnly, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <ChartExport
        id={id}
        isOpen={openMenuId === id}
        onToggle={onToggle}
        chartRef={chartRef}
        data={data}
        svgOnly={svgOnly}
      />
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// StatisticsSection
// ─────────────────────────────────────────────────────────────────────────────
const StatisticsSection = ({ articles, onUpdateStatus, inclusionCriteria, exclusionCriteria, statistics, theme }) => {

  // ── refs por instância ───────────────────────────────────────────────────
  const pubYearRefs  = { Scopus: useRef(null), 'Web of Science': useRef(null), Total: useRef(null) };
  const filterRefs   = { filter1: useRef(null), filter2: useRef(null), filter3: useRef(null) };
  const prismaRef    = useRef(null);
  const countriesRef = useRef(null);
  const criterionChartRefs = { Exclusão: useRef(null), Inclusão: useRef(null), Total: useRef(null),
  };
  // ── ui state ────────────────────────────────────────────────────────────
  const [openMenuId,       setOpenMenuId]       = useState(null);
  const [stroke,           setStroke]           = useState('#000');
  const [topNCountries,    setTopNCountries]    = useState(10);

  // multi-select por seção — Set das opções ativas
  const [pubYearSelected,  setPubYearSelected]  = useState(new Set(['Total']));
  const [filterSelected,   setFilterSelected]   = useState(new Set(['filter1']));
  const [criterionSelected,   setCriterionSelected]   = useState(new Set(['Exclusão','Inclusão','Total']));

  const [criterionsCount, setCriterionsCount] = useState({
    dataProcessing: [{ name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter1:        [{ name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter2:        [{ name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter3:        [{ name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
  });

  const [pubYearData, setPubYearData] = useState({
    Scopus: [], 'Web of Science': [], Total: [],
  });
  const [countriesCount, setCountriesCount] = useState([]);

  // ── helpers ─────────────────────────────────────────────────────────────
  const handleSource = useCallback((source, deduplicate = false) => {
    const ar = deduplicate ? articles.filter(a => !a.isDuplicate) : articles;
    return source === 'Total' ? ar : ar.filter(a => a.source.toLowerCase() === source.toLowerCase());
  }, [articles]);

  // const handleSource = useCallback((source, deduplicate = false) => {
  //   const ar = deduplicate ? articles.filter(a => !a.isDuplicate) : articles;
  //   return source === 'Total' ? ar : ar.filter(a => a.source.toLowerCase() === source.toLowerCase());
  // }, [articles]);

  const publicationsByYear = (arts) =>
    Object.entries(arts.reduce((acc, a) => { acc[a.year] = (acc[a.year] || 0) + 1; return acc; }, {}))
      .map(([year, count]) => ({ year, count }));

  const contarCountries = (array) => {
    const all = array
      .filter(a => a.countries?.length > 0 && !a.countries.includes('País não informado'))
      .flatMap(a => a.countries);
    return Object.entries(all.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {}))
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  };

  // ── effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setPubYearData({
      Scopus:           publicationsByYear(handleSource('Scopus')),
      'Web of Science': publicationsByYear(handleSource('Web of Science')),
      Total:            publicationsByYear(handleSource('Total', true)),
    });
    setCountriesCount(contarCountries(handleSource('Total')));
  }, [articles]);

  useEffect(() => { setStroke(theme === 'dark' ? '#fff' : '#000'); }, [theme]);

  useEffect(() => {
    const mk = (key) => [
      { name: 'included',     value: statistics[key].included },
      { name: 'excluded',     value: statistics[key].excluded  },
      { name: 'unclassified', value: statistics[key].pending   },
    ];
    setCriterionsCount({
      dataProcessing: mk('dataProcessing'),
      filter1: mk('filter1'), filter2: mk('filter2'), filter3: mk('filter3'),
    });
  }, [statistics]);

  const buildCriterionChartData = useCallback((category) => {
  const countMap = {};
  const labelMap = {};

  const tally = (field) => {
    articles.forEach(article => {
      (article[field] ?? [])
        .filter(c => c != null)
        .forEach(c => {
          countMap[c.id] = (countMap[c.id] || 0) + 1;
          labelMap[c.id] = (c.label && c.label !== 'undefined') ? c.label : 'Outros'; // ← fix
        });
    });
  };

  if (category !== 'inclusion') tally('exclusionCriterion');
  if (category !== 'exclusion') tally('inclusionCriterion');

  return Object.entries(countMap)
    .map(([id, value]) => ({ id, name: labelMap[id], value }))
    .sort((a, b) => b.value - a.value);
  }, [articles]);
  const [criterionChartData, setCriterionChartData] = useState({
    Exclusão: [], Inclusão: [], Total: [],
  });

  useEffect(() => {
    setCriterionChartData({
      Exclusão: buildCriterionChartData('exclusion'),
      Inclusão: buildCriterionChartData('inclusion'),
      Total:    buildCriterionChartData('total'),
    });
  }, [articles, buildCriterionChartData]);

  // ── toggle helpers ───────────────────────────────────────────────────────
  const togglePubYear = (src) => {
    setPubYearSelected(prev => {
      const next = new Set(prev);
      if (next.has(src) && next.size === 1) return next; // manter ao menos 1
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  };

  const toggleFilter = (fk) => {
    setFilterSelected(prev => {
      const next = new Set(prev);
      if (next.has(fk) && next.size === 1) return next;
      next.has(fk) ? next.delete(fk) : next.add(fk);
      return next;
    });
  };

   const toggleCriterion = (ctr) => {
    setCriterionSelected(prev => {
      const next = new Set(prev);
      if (next.has(ctr) && next.size === 1) return next;
      next.has(ctr) ? next.delete(ctr) : next.add(ctr);
      return next;
    });
  };

  const toggleMenu = (id) => setOpenMenuId(prev => prev === id ? null : id);

  // ── derived ──────────────────────────────────────────────────────────────
  const hasScopus = handleSource('Scopus').length > 0;
  const hasWOS    = handleSource('Web of Science').length > 0;
  const hasAny    = hasScopus || hasWOS;

  const availableSources = [hasScopus && 'Scopus', hasWOS && 'Web of Science', hasAny && 'Total'].filter(Boolean);

  const filterTabs = ['filter1', 'filter2', 'filter3'].filter(k => criterionsCount[k].some(e => e.value !== 0));

  const hasExclusion = (article) =>
  Array.isArray(article.exclusionCriterion) &&
  article.exclusionCriterion.some(c => c != null);
  const hasInclusion = (article) =>
  Array.isArray(article.inclusionCriterion) &&
  article.inclusionCriterion.some(c => c != null);
  const hasAnyCriterion = articles.some(a => hasExclusion(a) || hasInclusion(a));


  const availableCriterions = [articles.some(hasExclusion) && 'Exclusão', articles.some(hasExclusion) && 'Inclusão', hasAnyCriterion && 'Total'].filter(Boolean);

  const visibleCountries = countriesCount.slice(0, topNCountries);

  // grid class baseado em quantos estão selecionados
  const gridClass = (count) =>
    count === 1 ? 'grid grid-cols-1' :
    count === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' :
                  'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';

  // ── shared chart components ──────────────────────────────────────────────
  const colors           = { included: '#4ade80', excluded: '#f87171', unclassified: '#94a3b8' };
  const labelsCriterions = { included: 'Incluído', excluded: 'Excluído', unclassified: 'Não Classificado' };

  const pubYearColors  = { Scopus: '#fb923c', 'Web of Science': '#d4d0e3', Total: '#646464' };
  const pubYearBarFill = { Scopus: '#3b2b2b', 'Web of Science': '#592aaa', Total: '#3f3f3f' };;

  const EXCLUSION_COLORS = [
    '#f87171','#ef4444','#dc2626','#fca5a5','#fb7185',
    '#f43f5e','#e11d48','#fda4af','#b91c1c','#ff6b6b',
  ];
  const INCLUSION_COLORS = [
    '#4ade80','#22c55e','#16a34a','#86efac','#34d399',
    '#10b981','#059669','#6ee7b7','#15803d','#a7f3d0',
  ];
  const TOTAL_COLORS = [
    '#6366f1','#f59e0b','#06b6d4','#8b5cf6','#14b8a6',
    '#f97316','#ec4899','#3b82f6','#a855f7','#0ea5e9',
  ];

  const getCriterionColors = (ctr) => {
    if (ctr.includes('Exclus')) return EXCLUSION_COLORS;
    if (ctr.includes('Inclus')) return INCLUSION_COLORS;
    return TOTAL_COLORS;
  };
  const CriterionLegend = ({ data, ctr }) => {
    const colors = getCriterionColors(ctr); // chamada única
    return (
  
      <div className={data.length <= 3 ? `flex justify-center flex-wrap gap-3 mt-2` : `grid gap-x-8 gap-y-1 mt-2 max-h-36 pr-1 mx-auto w-fit grid-cols-2`}>
        {data.map((entry, i) => (
          <div key={entry.id} className="flex items-start gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
              <span className="font-semibold">{entry.id}:</span>
              <span className="text-gray-300"> ({entry.value})</span>
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  
  const sharedTooltip = (labelKey, color) => ({
    content: ({ active, payload }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div style={{ background: '#1a1a1a', padding: '10px', border: '1px solid #444', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,.1)' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#fff' }}>{d[labelKey]}</p>
          <p style={{ margin: '5px 0 0', color }}>Quant.: {d.count}</p>
        </div>
      );
    },
  });

  const criterionTooltip = {
    content: ({ active, payload }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div style={{ background: '#1a1a1a', padding: '10px', border: '1px solid #444', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#fff', maxWidth: 220, fontSize: 12 }}>{d.name}</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>Artigos: {d.value}</p>
        </div>
      );
    },
  };
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    if (!value || !percent) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text x={cx + radius * Math.cos(-midAngle * RADIAN)}
            y={cy + radius * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  const renderCriterionLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    if (!value || !percent || percent < 0.03) return null;
    const RADIAN = Math.PI / 180;

    if (percent < 0.07) {
      // pequeno demais para dentro — exibe fora com linha implícita
      const radius = outerRadius + 18;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      return (
        <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'}
              dominantBaseline="central" fontSize={11} fill="#9ca3af">
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    }

    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text x={cx + radius * Math.cos(-midAngle * RADIAN)}
            y={cy + radius * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central"
            fontSize={13} fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomLegend = ({ data }) => (
    <div className="flex justify-center flex-wrap gap-3 mt-2">
      {data.filter(item => item.value > 0).map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[entry.name] }} />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {labelsCriterions[entry.name]}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors duration-200">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <ChartArea className="h-6 w-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        Seção 7: Estatísticas e Análises
      </h2>

      {/* ── 1. Publicações por ano ─────────────────────────────────────────── */}
      {hasAny && (
        <SectionWrapper
          title="Publicações por ano"
          controls={
            <MultiToggle options={availableSources} selected={pubYearSelected} onToggle={togglePubYear} />
          }
        >
          <div className={gridClass(pubYearSelected.size)}>
            {availableSources.filter(src => pubYearSelected.has(src)).map(src => (
              <ChartInstance
                key={src}
                id={`pubyear-${src.replace(/\s+/g, '-')}`}
                label={src}
                chartRef={pubYearRefs[src]}
                data={pubYearData[src]}
                openMenuId={openMenuId}
                onToggle={toggleMenu}
              >
                <div ref={pubYearRefs[src]}>
                  <ComposedChart
                    style={{ width: '100%', aspectRatio: pubYearSelected.size > 1 ? 1 : 1.618, maxHeight: '60vh' }}
                    responsive
                    data={pubYearData[src]}
                    margin={{ top: 5, right: 4, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                    <XAxis dataKey="year"  stroke={stroke} tick={{ fontSize: 14 }} />
                    <YAxis dataKey="count" stroke={stroke} tick={{ fontSize: 14 }} />
                    <Tooltip {...sharedTooltip('year', pubYearColors[src])} />
                    <Bar  dataKey="count" fill={pubYearBarFill[src]} strokeWidth={2} name="Quant." />
                    <Line dataKey="count" stroke={pubYearColors[src]} strokeWidth={2} type="monotone" name="Quant." dot={false} />
                  </ComposedChart>
                </div>
                {src === 'Total' && (
                  <p className="text-xs text-gray-400 mt-1">* Duplicatas não contabilizadas</p>
                )}
              </ChartInstance>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* ── 2. Países ─────────────────────────────────────────────────────── */}
      {hasAny && (
        <SectionWrapper
          title={`Publicações por país — Top ${topNCountries}`}
          controls={
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Top</span>
              <input type="range" min={3} max={Math.max(3, countriesCount.length)} value={topNCountries}
                onChange={e => setTopNCountries(Number(e.target.value))}
                className="w-24 accent-indigo-600 cursor-pointer" />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 w-6 text-right">
                {topNCountries}
              </span>
            </div>
          }
        >
          <ChartInstance
            id="countries"
            label=""
            chartRef={countriesRef}
            data={visibleCountries}
            openMenuId={openMenuId}
            onToggle={toggleMenu}
          >
            <div ref={countriesRef}>
              <BarChart
                layout="vertical"
                style={{ width: '100%', aspectRatio: 1.618, maxHeight: '70vh' }}
                responsive
                data={visibleCountries}
                margin={{ top: 5, right: 4, left: 0, bottom: 5 }}
              >
                <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                <XAxis type="number"   dataKey="count"   stroke={stroke} tick={{ fontSize: 14 }} />
                <YAxis type="category" dataKey="country" stroke={stroke} width={90} tick={{ fontSize: 14 }} />
                <Tooltip {...sharedTooltip('country', '#94a3b8')} />
                <Bar dataKey="count" fill="#646464" strokeWidth={2} name="Quant." />
              </BarChart>
            </div>
          </ChartInstance>
        </SectionWrapper>
      )}

      {/* ── 3. Panorama de filtros ─────────────────────────────────────────── */}
      {filterTabs.length > 0 && (
        <SectionWrapper
          title="Panorama de Classificação"
          controls={
            <MultiToggle
              options={filterTabs.map(k => k.replace('filter', 'Filtro '))}
              selected={new Set([...filterSelected].map(k => k.replace('filter', 'Filtro ')))}
              onToggle={label => toggleFilter(label.replace('Filtro ', 'filter'))}
            />
          }
        >
          <div className={gridClass([...filterSelected].filter(fk => filterTabs.includes(fk)).length)}>
            {filterTabs.filter(fk => filterSelected.has(fk)).map(fk => (
              <ChartInstance
                key={fk}
                id={`filter-${fk}`}
                label={fk.replace('filter', 'Filtro ')}
                chartRef={filterRefs[fk]}
                data={criterionsCount[fk]}
                openMenuId={openMenuId}
                onToggle={toggleMenu}
              >
                <div ref={filterRefs[fk]}>
                  <PieChart
                    style={{ width: '100%', aspectRatio: 1, maxHeight: '50vh' }}
                    responsive
                  >
                    <Pie data={criterionsCount[fk]} dataKey="value"
                         label={renderCustomizedLabel} stroke="none" labelLine={false} isAnimationActive={false}>
                      {criterionsCount[fk].map((entry, i) => <Cell key={i} fill={colors[entry.name]} />)}
                    </Pie>
                    <Legend verticalAlign="bottom" content={<CustomLegend data={criterionsCount[fk]} />} />
                  </PieChart>
                </div>
              </ChartInstance>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* ── 4. Panorama de critérios ─────────────────────────────────────────── */}
      {availableCriterions.length > 0 && (
        <SectionWrapper
          title="Panorama dos Critérios"
          controls={
            <MultiToggle
              options={availableCriterions}
              selected={criterionSelected}
              onToggle={toggleCriterion}
            />
          }
        >
          <div className={gridClass([...criterionSelected].filter(c => availableCriterions.includes(c)).length)}>
            {availableCriterions
            .filter(ctr => criterionSelected.has(ctr))
            .map(ctr => {
              const data   = criterionChartData[ctr] ?? [];
              const colors = getCriterionColors(ctr); // ← paleta por categoria
              return (
                <ChartInstance
                  key={ctr}
                  id={`criterion-${ctr}`}
                  label={ctr}
                  chartRef={criterionChartRefs[ctr]}
                  data={data}
                  openMenuId={openMenuId}
                  onToggle={toggleMenu}
                >
                  {data.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Nenhum critério registrado</p>
                  ) : (
                    <div ref={criterionChartRefs[ctr]}>
                      <PieChart style={{ width: '100%', aspectRatio: 1, maxHeight: '50vh' }} responsive>
                        <Pie
                          data={data}
                          dataKey="value"
                          label={renderCriterionLabel}   // ← label adaptativo
                          labelLine={false}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {data.map((_, i) => (
                            <Cell key={i} fill={colors[i % colors.length]} /> // ← paleta correta
                          ))}
                        </Pie>
                        <Tooltip {...criterionTooltip} />
                        <Legend verticalAlign="bottom" content={<CriterionLegend data={data} ctr={ctr} />} />
                      </PieChart>
                    </div>
                  )}
                </ChartInstance>
              );
            })}
          </div>
        </SectionWrapper>
      )}

      {/* ── 5. Fluxograma PRISMA — SVG puro, apenas exportação SVG ───────── */}
      <SectionWrapper
        title="Fluxograma Prisma"
        controls={
          <ChartExport
            id="prisma"
            isOpen={openMenuId === 'prisma'}
            onToggle={toggleMenu}
            chartRef={prismaRef}
            data={null}
            svgOnly
          />
        }
      >
        <PrismaFlowchart
          ref={prismaRef}
          statistics={statistics}
          scopusCount={handleSource('Scopus').length}
          wosCount={handleSource('Web of Science').length}
          totalCount={handleSource('Total').length}
          isDark={theme === 'dark'}
        />
      </SectionWrapper>

    </div>
  );
};

export default StatisticsSection;