// ─── StatisticsSection ───────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { ChartArea, Download, X, Map, Earth } from 'lucide-react';
import {
  Line, Bar, Cell, Pie, PieChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ComposedChart, BarChart,
} from 'recharts';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import FileSaver from 'file-saver';
import ExcelJS from "exceljs";
import countryPatternsData from './countryPatterns/countryPatterns_v2.json';

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA
// ─────────────────────────────────────────────────────────────────────────────
const PrismaFlowchart = forwardRef(({ statistics, scopusCount, wosCount, totalCount, isDark }, ref) => {
  const nodeBg = isDark ? '#374151' : '#ffffff';
  const border = '#a8a29e';
  const txt    = isDark ? '#f3f4f6' : '#111827';
  const numTxt = isDark ? '#d1d5db' : '#6b7280';
  const line   = isDark ? '#6b7280' : '#9ca3af';
  const mainX = 280, sideX = 490, nW = 200, sW = 180, nH = 56, r = 6;
  const rows = { n1:50,n2:50,n3:150,n4:200,n5:250,n6:300,n7:350,n8:400,n9:450,n10:500,n11:550 };

  const Box = ({ cx, cy, w, h = nH, label, count }) => {
    const lns = label.includes('\n') ? label.split('\n') : label.length > 24 ? [label.slice(0,24), label.slice(24)] : [label];
    const lineH = 15;
    const totalTextH = lns.length * lineH + 10;
    const startY = cy - totalTextH / 2 + lineH / 2;
    return (
      <g>
        <rect x={cx-w/2+2} y={cy-h/2+3} width={w} height={h} rx={r} ry={r} fill="rgba(0,0,0,0.12)" />
        <rect x={cx-w/2}   y={cy-h/2}   width={w} height={h} rx={r} ry={r} fill={nodeBg} stroke={border} strokeWidth={2} />
        {lns.map((ln, i) => (
          <text key={i} x={cx} y={startY + i*lineH} textAnchor="middle" fill={txt}
                fontSize={14} fontWeight="700" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">{ln}</text>
        ))}
        <text x={cx} y={startY + lns.length*lineH + 4} textAnchor="middle" fill={numTxt}
              fontSize={13} fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">{count}</text>
      </g>
    );
  };
  const Arrow = ({ x1, y1, x2, y2 }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={line} strokeWidth={1.5} markerEnd="url(#prisma-arrow)" />
  );

  return (
    <svg ref={ref} viewBox="0 0 680 640" width="100%" style={{ maxHeight:'70vh' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="prisma-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={line} />
        </marker>
      </defs>
      <Arrow x1={mainX-100} y1={rows.n1+nH/2} x2={mainX-30} y2={rows.n3-nH/2} />
      <Arrow x1={mainX+100} y1={rows.n2+nH/2} x2={mainX+30} y2={rows.n3-nH/2} />
      <Arrow x1={mainX} y1={rows.n3+nH/2} x2={mainX} y2={rows.n5-nH/2} />
      <Arrow x1={mainX} y1={rows.n5+nH/2} x2={mainX} y2={rows.n7-nH/2} />
      <Arrow x1={mainX} y1={rows.n6}       x2={sideX-sW/2} y2={rows.n6} />
      <Arrow x1={mainX} y1={rows.n7+nH/2} x2={mainX} y2={rows.n9-nH/2} />
      <Arrow x1={mainX} y1={rows.n8}       x2={sideX-sW/2} y2={rows.n8} />
      <Arrow x1={mainX} y1={rows.n9+nH/2} x2={mainX} y2={rows.n11-nH/2} />
      <Arrow x1={mainX} y1={rows.n10}      x2={sideX-sW/2} y2={rows.n10} />
      <Arrow x1={mainX} y1={rows.n4}       x2={sideX-sW/2} y2={rows.n4} />
      <Box cx={mainX-100} cy={rows.n1}  w={160} label="Scopus"                    count={scopusCount} />
      <Box cx={mainX+100} cy={rows.n2}  w={160} label="Web of Science"            count={wosCount} />
      <Box cx={mainX}     cy={rows.n3}  w={nW}  label="Identificados"             count={totalCount} />
      <Box cx={sideX}     cy={rows.n4}  w={sW}  label="Duplicados"                count={statistics.dataProcessing.duplicate} />
      <Box cx={mainX}     cy={rows.n5}  w={nW}  label={"Após remoção\nde duplicados"} count={statistics.dataProcessing.included} />
      <Box cx={sideX}     cy={rows.n6}  w={sW}  label="Excluídos - Filtro 1"      count={statistics.filter1.excluded} />
      <Box cx={mainX}     cy={rows.n7}  w={nW}  label="Incluídos - Filtro 1"      count={statistics.filter1.included} />
      <Box cx={sideX}     cy={rows.n8}  w={sW}  label="Excluídos - Filtro 2"      count={statistics.filter2.excluded} />
      <Box cx={mainX}     cy={rows.n9}  w={nW}  label="Incluídos - Filtro 2"      count={statistics.filter2.included} />
      <Box cx={sideX}     cy={rows.n10} w={sW}  label="Excluídos - Filtro 3"      count={statistics.filter3.excluded} />
      <Box cx={mainX}     cy={rows.n11} w={nW}  label="Incluídos - Filtro 3"      count={statistics.filter3.included} />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Exportação
// ─────────────────────────────────────────────────────────────────────────────
const changeColors = (svgClone) => {
  const fix = (sel, attr, val, useChild = false) =>
    svgClone.querySelectorAll(sel).forEach(el => {
      if (useChild) el.children[0]?.setAttribute(attr, val);
      else el.setAttribute(attr, val);
    });
  fix("g > g > g.recharts-cartesian-grid-horizontal > line", 'stroke', '#000');
  fix("g > g > g.recharts-cartesian-grid-vertical > line",   'stroke', '#000');
  fix("g > g.recharts-cartesian-axis-tick-labels.recharts-xAxis-tick-labels > g", 'fill', '#000', true);
  fix("g > g.recharts-cartesian-axis-tick-labels.recharts-yAxis-tick-labels > g", 'fill', '#000', true);
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > line", 'stroke', '#000');
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > line", 'stroke', '#000');
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-xAxis.xAxis > g > g > g", 'stroke', '#000', true);
  fix("g > g.recharts-layer.recharts-cartesian-axis.recharts-yAxis.yAxis > g > g > g", 'stroke', '#000', true);
};

const exportSvgElement = async (svgEl, filename) => {
  const clone = svgEl.cloneNode(true);
  changeColors(clone);
  const style = document.createElement('style');
  style.textContent = `* { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type:'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename; a.href = url; a.click();
  URL.revokeObjectURL(url);
};

const exportSvgToPng = async (svgEl, filename) => {
  const clone = svgEl.cloneNode(true);
  changeColors(clone);
  const { width:w, height:h } = svgEl.getBoundingClientRect();
  const scale = 4;
  clone.setAttribute('width',   w*scale);
  clone.setAttribute('height',  h*scale);
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const style = document.createElement('style');
  style.textContent = `* { font-family: -apple-system, sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type:'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  canvas.width = w*scale; canvas.height = h*scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const img = new Image(); img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  ctx.drawImage(img, 0, 0, w*scale, h*scale);
  canvas.toBlob(blob => { FileSaver.saveAs(blob, filename); URL.revokeObjectURL(url); }, 'image/png', 1);
};

const exportToXLSX = async (data, filename) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Data');
  if (data?.length) {
    ws.columns = Object.keys(data[0]).map(k => ({ header:k, key:k, width:20 }));
    data.forEach(row => ws.addRow(row));
  }
  const buf = await workbook.xlsx.writeBuffer();
  FileSaver.saveAs(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// WorldHeatmap — mapa de calor usando dados de countriesCount
// ─────────────────────────────────────────────────────────────────────────────
// ── Lookups derivados do JSON de países ───────────────────────────────────────

const COUNTRY_NAMES_MAP = Object.fromEntries(
  countryPatternsData.map(c => [c.cca3, c.name])
);

const NUMERIC_TO_ISO_MAP = {
  4:"AFG",8:"ALB",10:"ATA",12:"DZA",24:"AGO",32:"ARG",36:"AUS",40:"AUT",31:"AZE",
  50:"BGD",51:"ARM",56:"BEL",64:"BTN",68:"BOL",70:"BIH",72:"BWA",76:"BRA",
  100:"BGR",108:"BDI",112:"BLR",116:"KHM",120:"CMR",124:"CAN",140:"CAF",
  144:"LKA",152:"CHL",156:"CHN",170:"COL",174:"COM",178:"COG",180:"COD",
  188:"CRI",191:"HRV",192:"CUB",196:"CYP",203:"CZE",208:"DNK",218:"ECU",
  222:"SLV",231:"ETH",232:"ERI",246:"FIN",250:"FRA",266:"GAB",268:"GEO",
  275:"PSE",276:"DEU",288:"GHA",300:"GRC",320:"GTM",324:"GIN",332:"HTI",
  340:"HND",348:"HUN",356:"IND",360:"IDN",364:"IRN",368:"IRQ",372:"IRL",
  376:"ISR",380:"ITA",384:"CIV",388:"JAM",392:"JPN",398:"KAZ",400:"JOR",
  404:"KEN",408:"PRK",410:"KOR",414:"KWT",418:"LAO",422:"LBN",426:"LSO",
  430:"LBR",434:"LBY",438:"LIE",440:"LTU",442:"LUX",450:"MDG",454:"MWI",
  458:"MYS",466:"MLI",480:"MUS",484:"MEX",492:"MCO",496:"MNG",499:"MNE",
  504:"MAR",508:"MOZ",512:"OMN",516:"NAM",524:"NPL",528:"NLD",554:"NZL",
  558:"NIC",562:"NER",566:"NGA",578:"NOR",586:"PAK",591:"PAN",598:"PNG",
  600:"PRY",604:"PER",608:"PHL",616:"POL",620:"PRT",630:"PRI",634:"QAT",
  642:"ROU",643:"RUS",646:"RWA",682:"SAU",686:"SEN",688:"SRB",690:"SYC",
  694:"SLE",703:"SVK",704:"VNM",705:"SVN",706:"SOM",710:"ZAF",716:"ZWE",
  724:"ESP",729:"SDN",748:"SWZ",752:"SWE",756:"CHE",760:"SYR",762:"TJK",
  764:"THA",768:"TGO",780:"TTO",784:"ARE",788:"TUN",792:"TUR",800:"UGA",
  804:"UKR",807:"MKD",818:"EGY",826:"GBR",834:"TZA",840:"USA",854:"BFA",
  858:"URY",860:"UZB",862:"VEN",887:"YEM",894:"ZMB",
};


// Lookup nome → ISO gerado a partir do JSON (name, officialName, nativeName → cca3)
const normalizeStr = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CTRY_TO_ISO = (() => {
  const map = {};
  countryPatternsData.forEach(({ cca3, name, officialName, nativeName }) => {
    if (name)         map[normalizeStr(name)]         = cca3;
    if (officialName) map[normalizeStr(officialName)] = cca3;
    if (nativeName)   map[normalizeStr(nativeName)]   = cca3;
  });
  return map;
})();

const resolveCountryISO = (str) => {
  if (!str) return null;
  const nkey = normalizeStr(str);
  if (CTRY_TO_ISO[nkey]) return CTRY_TO_ISO[nkey];
  // fallback parcial — prefere match mais curto
  const found = Object.keys(CTRY_TO_ISO)
    .filter(k => k.includes(nkey) || nkey.includes(k))
    .sort((a, b) => a.length - b.length)[0];
  return found ? CTRY_TO_ISO[found] : null;
};

const getHeatColor = (count, maxCount, isDark) => {
  if (!count || maxCount === 0) return isDark ? '#2d3748' : '#d1d5db';
  const t = Math.pow(count / maxCount, 0.5);
  const lo = isDark ? 80  : 200;
  const hi = isDark ? 240 : 30;
  const v  = Math.round(lo + (hi - lo) * t);
  return `rgb(${v},${v},${v})`;
};

const WorldHeatmap = forwardRef(({ countriesCount, isDark }, svgExportRef) => {
  const [svgPaths,    setSvgPaths]    = useState(null);
  const [tooltip,     setTooltip]     = useState(null);
  const [hoveredISO,  setHoveredISO]  = useState(null);
  const containerRef = useRef(null);

  const isoCountMap = {};
  const maxCount = (countriesCount || []).reduce((m, d) => Math.max(m, d.count), 0);
  (countriesCount || []).forEach(({ country, count }) => {
    const iso = resolveCountryISO(country);
    if (iso) isoCountMap[iso] = (isoCountMap[iso] || 0) + count;
  });

  useEffect(() => {
    const countries = feature(worldTopology, worldTopology.objects.countries);
    const proj = geoNaturalEarth1().scale(158).translate([490, 340]);
    const path = geoPath().projection(proj);
    const paths = countries.features.map(f => {
      const iso = NUMERIC_TO_ISO_MAP[parseInt(f.id, 10)];
      const d   = path(f);
      if (!d) return null;
      return { d, iso, id: f.id };
    }).filter(Boolean);
    setSvgPaths(paths);
  }, []);

  const oceanColor  = isDark ? '#0c1829' : '#ffffff';
  const strokeColor = isDark ? '#0f172a' : '#ffffff';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {svgPaths === null ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">Carregando mapa…</div>
      ) : svgPaths === 'error' ? (
        <div className="flex items-center justify-center h-48 text-sm text-red-400">Erro ao carregar mapa</div>
      ) : (
        <svg ref={svgExportRef} viewBox="0 0 1010 630" style={{ width:'100%', height:'auto', display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect width="1010" height="630" fill={oceanColor} rx="8" />
          <g opacity={isDark ? 0.06 : 0.12} stroke="#94a3b8" strokeWidth="0.5" fill="none">
            {[-60,-30,0,30,60].map(lat => (
              <line key={lat} x1="20" y1={340 - lat * 3.3} x2="990" y2={340 - lat * 3.3} />
            ))}
            {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
              <line key={lon} x1={490 + lon * 2.6} y1="30" x2={490 + lon * 2.6} y2="630" />
            ))}
          </g>
          {svgPaths.map((c, i) => {
            const count = isoCountMap[c.iso] || 0;
            const fill  = c.iso === hoveredISO
              // ↓ COR DE SELEÇÃO (hover) — altere aqui
              ? (isDark ? '#4f46e5' : '#4f46e5')
              : getHeatColor(count, maxCount, isDark);
            return (
              <path key={i} d={c.d} fill={fill} stroke={strokeColor} strokeWidth="0.5"
                style={{ cursor: count > 0 ? 'pointer' : 'default', transition: 'fill 0.12s' }}
                onMouseMove={e => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, iso: c.iso, count });
                  setHoveredISO(c.iso);
                }}
                onMouseLeave={() => { setTooltip(null); setHoveredISO(null); }}
              />
            );
          })}
          {/* ── Escala de cores (embutida no SVG para exportação) ── */}
          <defs>
            <linearGradient id="heatScaleGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={isDark ? '#2d3748' : '#d1d5db'} />
              <stop offset="100%" stopColor={isDark ? 'rgb(240,240,240)' : 'rgb(30,30,30)'} />
            </linearGradient>
          </defs>
          <rect x="20" y="580" width="300" height="10" rx="5" fill="url(#heatScaleGrad)" />
          <text x="20"  y="600" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize="11" fontFamily="sans-serif">0</text>
          <text x="322" y="600" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize="11" fontFamily="sans-serif" textAnchor="end">{maxCount} pub.</text>
        </svg>
      )}

      {tooltip && (
        <div style={{ position:'absolute', left: tooltip.x + 14, top: tooltip.y - 12, pointerEvents:'none', zIndex:20 }}
          className="bg-gray-900 border border-indigo-500/40 rounded-lg px-3 py-2 shadow-xl text-white text-xs">
          <div className="font-semibold text-sm mb-0.5">
            {COUNTRY_NAMES_MAP[tooltip.iso] || tooltip.iso || 'Desconhecido'}
          </div>
          <div className="text-indigo-300 font-medium">
            {tooltip.count > 0 ? `${tooltip.count} publicaç${tooltip.count === 1 ? 'ão' : 'ões'}` : 'Sem dados'}
          </div>
        </div>
      )}
    </div>
  );
});
WorldHeatmap.displayName = 'WorldHeatmap';

// ─────────────────────────────────────────────────────────────────────────────
// ContinentHeatmap
// ─────────────────────────────────────────────────────────────────────────────
const ISO_TO_CONTINENT = {
  // América do Norte
  USA:"América do Norte",CAN:"América do Norte",MEX:"América do Norte",
  GTM:"América do Norte",BLZ:"América do Norte",HND:"América do Norte",
  SLV:"América do Norte",NIC:"América do Norte",CRI:"América do Norte",
  PAN:"América do Norte",CUB:"América do Norte",JAM:"América do Norte",
  HTI:"América do Norte",DOM:"América do Norte",PRI:"América do Norte",
  // América do Sul
  BRA:"América do Sul",ARG:"América do Sul",CHL:"América do Sul",
  COL:"América do Sul",VEN:"América do Sul",PER:"América do Sul",
  ECU:"América do Sul",BOL:"América do Sul",PRY:"América do Sul",
  URY:"América do Sul",GUY:"América do Sul",SUR:"América do Sul",
  // Europa
  GBR:"Europa",FRA:"Europa",DEU:"Europa",ITA:"Europa",ESP:"Europa",
  PRT:"Europa",NLD:"Europa",BEL:"Europa",CHE:"Europa",AUT:"Europa",
  SWE:"Europa",NOR:"Europa",DNK:"Europa",FIN:"Europa",POL:"Europa",
  CZE:"Europa",HUN:"Europa",ROU:"Europa",BGR:"Europa",HRV:"Europa",
  SVK:"Europa",SVN:"Europa",LTU:"Europa",LVA:"Europa",EST:"Europa",
  GRC:"Europa",TUR:"Europa",UKR:"Europa",BLR:"Europa",MDA:"Europa",
  ALB:"Europa",MKD:"Europa",SRB:"Europa",BIH:"Europa",MNE:"Europa",
  RUS:"Europa",ISL:"Europa",IRL:"Europa",LUX:"Europa",MLT:"Europa",
  CYP:"Europa",LIE:"Europa",MCO:"Europa",
  // Ásia
  CHN:"Ásia",JPN:"Ásia",KOR:"Ásia",IND:"Ásia",IDN:"Ásia",
  THA:"Ásia",VNM:"Ásia",PHL:"Ásia",MYS:"Ásia",SGP:"Ásia",
  MMR:"Ásia",KHM:"Ásia",LAO:"Ásia",BGD:"Ásia",PAK:"Ásia",
  LKA:"Ásia",NPL:"Ásia",AFG:"Ásia",IRN:"Ásia",IRQ:"Ásia",
  SAU:"Ásia",ARE:"Ásia",QAT:"Ásia",KWT:"Ásia",ISR:"Ásia",
  JOR:"Ásia",LBN:"Ásia",SYR:"Ásia",YEM:"Ásia",OMN:"Ásia",
  BHR:"Ásia",KAZ:"Ásia",UZB:"Ásia",TKM:"Ásia",KGZ:"Ásia",
  TJK:"Ásia",AZE:"Ásia",ARM:"Ásia",GEO:"Ásia",MNG:"Ásia",
  PRK:"Ásia",TWN:"Ásia",HKG:"Ásia",PSE:"Ásia",
  // África
  EGY:"África",NGA:"África",ZAF:"África",ETH:"África",KEN:"África",
  TZA:"África",UGA:"África",RWA:"África",GHA:"África",CMR:"África",
  SEN:"África",CIV:"África",MLI:"África",BFA:"África",NER:"África",
  TCD:"África",CAF:"África",COD:"África",COG:"África",AGO:"África",
  ZMB:"África",ZWE:"África",MOZ:"África",MDG:"África",SDN:"África",
  LBY:"África",TUN:"África",DZA:"África",MAR:"África",SWZ:"África",
  LSO:"África",MWI:"África",NAM:"África",BWA:"África",
  BEN:"África",BDI:"África",ERI:"África",SLE:"África",LBR:"África",
  SOM:"África",GAB:"África",GIN:"África",TGO:"África",
  // Oceania
  AUS:"Oceania",NZL:"Oceania",PNG:"Oceania",FJI:"Oceania",
};

const CONTINENT_LABELS = [
  "América do Norte","América do Sul","Europa","Ásia","África","Oceania",
];

const ContinentHeatmap = forwardRef(({ countriesCount, isDark }, svgExportRef) => {
  const [svgPaths,   setSvgPaths]   = useState(null);
  const [tooltip,    setTooltip]    = useState(null);
  const [hoveredCont,setHoveredCont]= useState(null);
  const containerRef = useRef(null);

  // Agrupa contagens por continente
  const contCount = {};
  (countriesCount || []).forEach(({ country, count }) => {
    const iso  = resolveCountryISO(country);
    const cont = iso ? ISO_TO_CONTINENT[iso] : null;
    if (!cont) return;
    contCount[cont] = (contCount[cont] || 0) + count;
  });
  const maxCount = Math.max(...Object.values(contCount), 0);

  useEffect(() => {
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'),
    ])
      .then(() => fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'))
      .then(r => r.json())
      .then(topology => {
        const countries = window.topojson.feature(topology, topology.objects.countries);
        const proj = window.d3.geoNaturalEarth1().scale(200).translate([490, 280]);
        const path = window.d3.geoPath().projection(proj);
        const paths = countries.features.map(f => {
          const iso  = NUMERIC_TO_ISO_MAP[parseInt(f.id, 10)];
          const cont = iso ? ISO_TO_CONTINENT[iso] : null;
          const d    = path(f);
          if (!d) return null;
          return { d, iso, cont, id: f.id };
        }).filter(Boolean);
        setSvgPaths(paths);
      })
      .catch(() => setSvgPaths('error'));
  }, []);

  const oceanColor  = isDark ? '#0c1829' : '#ffffff';
  const strokeColor = isDark ? '#0f172a' : '#ffffff';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {svgPaths === null ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">Carregando mapa…</div>
      ) : svgPaths === 'error' ? (
        <div className="flex items-center justify-center h-48 text-sm text-red-400">Erro ao carregar mapa</div>
      ) : (
        <svg ref={svgExportRef} viewBox="0 0 1010 680" style={{ width:'100%', height:'auto', display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect width="1010" height="680" fill={oceanColor} rx="8" />
          <g opacity={isDark ? 0.06 : 0.12} stroke="#94a3b8" strokeWidth="0.5" fill="none">
            {[-60,-30,0,30,60].map(lat => (
              <line key={lat} x1="20" y1={340 - lat * 3.3} x2="990" y2={340 - lat * 3.3} />
            ))}
            {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
              <line key={lon} x1={490 + lon * 2.6} y1="30" x2={490 + lon * 2.6} y2="630" />
            ))}
          </g>
          {svgPaths.map((c, i) => {
            const count = c.cont ? (contCount[c.cont] || 0) : 0;
            const isHov = c.cont && c.cont === hoveredCont;
            const fill  = isHov
              // ↓ COR DE SELEÇÃO (hover) — altere aqui
              ? (isDark ? '#4f46e5' : '#4f46e5')
              : getHeatColor(count, maxCount, isDark);
            return (
              <path key={i} d={c.d} fill={fill} stroke={strokeColor} strokeWidth="0.5"
                style={{ cursor: count > 0 ? 'pointer' : 'default', transition: 'fill 0.12s' }}
                onMouseMove={e => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect || !c.cont) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, cont: c.cont, count });
                  setHoveredCont(c.cont);
                }}
                onMouseLeave={() => { setTooltip(null); setHoveredCont(null); }}
              />
            );
          })}
          {/* ── Legenda de continentes ── */}
          {CONTINENT_LABELS.map((cont, i) => {
            const count = contCount[cont] || 0;
            const col   = getHeatColor(count, maxCount, isDark);
            const x     = 20 + i * 165;
            return (
              <g key={cont}>
                <rect x={x} y={589} width={14} height={14} rx={3} fill={col} />
                <text x={x + 18} y={600} fill={isDark ? '#9ca3af' : '#4b5563'} fontSize={11} fontFamily="sans-serif">
                  {cont} {count > 0 ? `(${count})` : ''}
                </text>
              </g>
            );
          })}
          {/* ── Escala de cores ── */}
          <defs>
            <linearGradient id="contScaleGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={isDark ? '#2d3748' : '#d1d5db'} />
              <stop offset="100%" stopColor={isDark ? 'rgb(240,240,240)' : 'rgb(30,30,30)'} />
            </linearGradient>
          </defs>
          <text x="20"  y="640" fill={isDark ? '#6b7280' : '#9ca3af'} fontSize={10} fontFamily="sans-serif">0</text>
          <rect x="20" y="620" width="300" height="8" rx="4" fill="url(#contScaleGrad)" />
          <text x="280" y="640" fill={isDark ? '#6b7280' : '#9ca3af'} fontSize={10} fontFamily="sans-serif">{maxCount} pub.</text>
        </svg>
      )}

      {tooltip && (
        <div style={{ position:'absolute', left: tooltip.x + 14, top: tooltip.y - 12, pointerEvents:'none', zIndex:20 }}
          className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 shadow-xl text-white text-xs">
          <div className="font-semibold text-sm mb-0.5">{tooltip.cont}</div>
          <div className="text-gray-300">
            {tooltip.count > 0 ? `${tooltip.count} publicaç${tooltip.count === 1 ? 'ão' : 'ões'}` : 'Sem dados'}
          </div>
        </div>
      )}
    </div>
  );
});
ContinentHeatmap.displayName = 'ContinentHeatmap';
// ─────────────────────────────────────────────────────────────────────────────
const ChartExport = ({ id, isOpen, onToggle, chartRef, data, svgOnly = false }) => {
  const getSvgEl = () => chartRef?.current?.tagName === 'svg'
    ? chartRef.current : chartRef?.current?.querySelector('svg') ?? null;
  const handlePNG  = async () => { const el = getSvgEl(); if (!el) return; await exportSvgToPng(el,   `${id}.png`);  onToggle(id); };
  const handleSVG  = async () => { const el = getSvgEl(); if (!el) return; await exportSvgElement(el, `${id}.svg`);  onToggle(id); };
  const handleXLSX = async () => { await exportToXLSX(data, `${id}.xlsx`); onToggle(id); };
  return (
    <div className="relative">
      <button onClick={() => onToggle(id)} title="Exportar gráfico"
        className="bg-gray-800 dark:bg-gray-600 border-none rounded-full p-1.5 cursor-pointer transition-all duration-200 hover:scale-110 flex items-center justify-center"
        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
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
// SourcePicker — troca a importação exibida naquele slot
// Recebe `sources` como array de strings (labels das importações + "Total")
// e `usedSources` como Set para marcar as já ocupadas em outros slots
// ─────────────────────────────────────────────────────────────────────────────
const SourcePicker = ({ slotId, currentSource, sources, usedSources, isOpen, onToggle, onChange }) => {
  const pickerId = `${slotId}-src`;

  return (
    <div className="relative">
      <button
        onClick={() => onToggle(pickerId)}
        title="Alterar importação"
        className="bg-indigo-600 dark:bg-indigo-500 border-none rounded-full px-2.5 py-1 cursor-pointer
                   transition-all duration-200 hover:scale-110 hover:bg-indigo-500 flex items-center"
      >
        <span className="text-[11px] text-white font-semibold leading-none">{displaySource(currentSource)}</span>
      </button>
      {isOpen && (
        <div className="absolute top-8 right-0 bg-zinc-800 rounded-lg p-1.5 min-w-[170px] z-50 shadow-xl">
          {sources.map(src => {
            const isActive   = src === currentSource;
            const isOccupied = !isActive && usedSources.has(src);
            return (
              <button
                key={src}
                disabled={isOccupied}
                onClick={() => { if (!isOccupied) { onChange(src); onToggle(pickerId); } }}
                className={`w-full text-left px-4 py-2 text-sm rounded border-none
                  ${isActive   ? 'text-indigo-400 bg-zinc-700 font-semibold cursor-default' : ''}
                  ${isOccupied ? 'text-zinc-500 bg-transparent cursor-not-allowed' : ''}
                  ${!isActive && !isOccupied ? 'text-white bg-transparent hover:bg-zinc-700 cursor-pointer' : ''}`}
              >
                {displaySource(src)}
                {isActive   && <span className="ml-1 text-xs">✓</span>}
                {isOccupied && <span className="ml-1 text-xs opacity-50">(em uso)</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MultiToggle / SectionWrapper / ChartInstance
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
              : 'text-gray-500 dark:text-gray-400 bg-transparent hover:text-gray-700 dark:hover:text-gray-200'}`}
        >{opt}</button>
      );
    })}
  </div>
);

const SectionWrapper = ({ title, controls, children }) => (
  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {controls}
    </div>
    {children}
  </div>
);

const ChartInstance = ({ id, label, chartRef, data, openMenuId, onToggle, svgOnly, sourcePicker, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        {sourcePicker}
        <ChartExport id={id} isOpen={openMenuId===id} onToggle={onToggle} chartRef={chartRef} data={data} svgOnly={svgOnly} />
      </div>
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Cores por database
// ─────────────────────────────────────────────────────────────────────────────
const DB_LINE_COLOR = { 'Scopus': '#fb923c', 'Web of Science': '#d4d0e3' };
const DB_BAR_COLOR  = { 'Scopus': '#3b2b2b', 'Web of Science': '#592aaa' };
const TOTAL_LINE = '#646464';
const TOTAL_BAR  = '#3f3f3f';
const getLineColor = (db) => DB_LINE_COLOR[db] ?? TOTAL_LINE;
const getBarColor  = (db) => DB_BAR_COLOR[db]  ?? TOTAL_BAR;

const displaySource = (source) =>
  source.startsWith('Total:') ? `Total (${source.split(':')[1]})` : source;
// ─────────────────────────────────────────────────────────────────────────────
// StatisticsSection
// ─────────────────────────────────────────────────────────────────────────────
const StatisticsSection = ({  articles, onUpdateStatus,  inclusionCriteria,  exclusionCriteria,  statistics,  theme,  importedData = [], }) => {

  // ── importOptions ─────────────────────────────────────────────────────────
  // Cada entrada de importedData vira uma opção de fonte nos pickers.
  // Label: "Scopus #1", "WoS #2", etc.
  const importOptions = importedData.map(imp => ({
    id:       imp.id,
    database: imp.database,
    label:    `${imp.database === 'Web of Science' ? 'WoS' : imp.database} #${imp.id}`,
  }));

  // Lista de fontes disponíveis no MultiToggle e SourcePicker.
  // "Total" agrega todos os artigos (sem duplicatas) e aparece ao final.
  const availableDatabases = [
    ...Array.from(new Set(importOptions.map(o => o.database))),
    ...(importOptions.length > 0 ? ['Total'] : []),
  ];
// ── sourcesForDatabase ────────────────────────────────────────────────────
  // Retorna os labels de importação disponíveis para uma base específica.
  const sourcesForDatabase = useCallback((database) => {
    if (database === 'Total') return ['Total'];
    return [
      ...importOptions.filter(o => o.database === database).map(o => o.label),
      `Total:${database}`,  // ← "Total:Scopus", "Total:Web of Science"
    ];
  }, [importOptions]);

  const defaultSourceForDatabase = useCallback((database) => {
    if (database === 'Total') return 'Total';
    return importOptions.find(o => o.database === database)?.label ?? 'Total';
  }, [importOptions]);
  // ── tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'bibliometria', label: 'Panorama Geral' },
    { id: 'processo',     label: 'Processo de Seleção' },
  ];
  const [activeTab, setActiveTab] = useState('bibliometria');
  const TabNav = () => (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-6 w-fit">
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer border-none
            ${activeTab===tab.id
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 bg-transparent hover:text-gray-700 dark:hover:text-gray-200'}`}
        >{tab.label}</button>
      ))}
    </div>
  );

  // ── refs dinâmicos ────────────────────────────────────────────────────────
  // Usamos mapas de refs chaveados pelo label da fonte ("Scopus #1", "Total", etc.)
  // para suportar qualquer quantidade de importações sem declarar refs estáticos.
  const pubYearRefsMap  = useRef({});
  const pubScoreRefsMap = useRef({});

  // Retorna (criando se necessário) o ref para uma chave num mapa dinâmico
  const getDynRef = (map, key) => {
    if (!map.current[key]) map.current[key] = { current: null };
    return map.current[key];
  };

  // Refs estáticos (seções sem slots)
  const filterRefs         = { filter1: useRef(null), filter2: useRef(null), filter3: useRef(null) };
  const prismaRef          = useRef(null);
  const countriesRef       = useRef(null);
  const countriesMapRef    = useRef(null);
  const continentMapRef    = useRef(null);
  const pubJournalRefs     = useRef(null);
  const criterionChartRefs = { Exclusão: useRef(null), Inclusão: useRef(null), Total: useRef(null) };

  // ── ui state ──────────────────────────────────────────────────────────────
  const [openMenuId,    setOpenMenuId]    = useState(null);
  const [stroke,        setStroke]        = useState('#000');
  const [topNCountries, setTopNCountries] = useState(10);
  const [countryView, setCountryView] = useState('bar'); // 'bar' | 'map' | 'continent'
  const [showCountriesMap, setShowCountriesMap] = useState(false);
  const [topNJournals,  setTopNJournals]  = useState(5);
  const [scoreBinSize,  setScoreBinSize]  = useState(5);

  // ── slots ─────────────────────────────────────────────────────────────────
  // Cada slot: { id: string, source: label da importação ou "Total" }
  // O slot inicial exibe "Total". O usuário pode adicionar/remover via MultiToggle
  // e trocar a fonte individual via SourcePicker.
 const [pubYearSlots, setPubYearSlots] = useState([
    { id: 'py-0', database: 'Total', source: 'Total' }
  ]);
  const [pubScoreSlots, setPubScoreSlots] = useState([
    { id: 'ps-0', database: 'Total', source: 'Total' }
  ]);

  // ── estados simples (sem slots) ───────────────────────────────────────────
  const [filterSelected,    setFilterSelected]    = useState(new Set(['filter1']));
  const [criterionSelected, setCriterionSelected] = useState(new Set(['Exclusão','Inclusão','Total']));
  const [criterionsCount,   setCriterionsCount]   = useState({
    dataProcessing: [{name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter1: [{name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter2: [{name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
    filter3: [{name:'included',value:0},{name:'excluded',value:0},{name:'unclassified',value:0}],
  });

  // ── dados derivados ───────────────────────────────────────────────────────
  // Dicionários chaveados pelo label da fonte: { 'Scopus #1': [...], 'Total': [...] }
  const [pubYearData,  setPubYearData]  = useState({});
  const [pubScoreData, setPubScoreData] = useState({});
  const [countriesCount, setCountriesCount] = useState([]);
  const [journalCount,   setJournalCount]   = useState([]);
  const [criterionChartData, setCriterionChartData] = useState({ Exclusão:[], Inclusão:[], Total:[] });

  // ── handleSource ──────────────────────────────────────────────────────────
  // "Total" → todos os artigos (sem duplicatas se deduplicate=true)
  // label de importação → artigos onde article.idData === importOption.id
  const handleSource = useCallback((sourceLabel, deduplicate = false, database = null) => {
    const ar = deduplicate ? articles.filter(a => !a.isDuplicate) : articles;

    if (sourceLabel === 'Total') {
      // "Total" global → todos
      if (!database) return ar;
      // "Total" de uma base → só artigos daquela base
      return ar.filter(a => a.source === database);
    }

    const opt = importOptions.find(o => o.label === sourceLabel);
    if (!opt) return [];
    return ar.filter(a => a.idData === opt.id);
  }, [articles, importedData]);

  // ── helpers de processamento ──────────────────────────────────────────────
  const publicationsByYear = (arts) =>
    Object.entries(arts.reduce((acc,a) => { acc[a.year]=(acc[a.year]||0)+1; return acc; }, {}))
      .map(([year, count]) => ({ year, count }));

  const publicationsByScore = (arts, binSize = 1) => {
    const total = arts.length;
    if (total === 0) return [];
    const scores = arts.map(a => Number(a.score));
    const mean = scores.reduce((s,v)=>s+v,0)/total;
    const std  = Math.sqrt(scores.reduce((s,v)=>s+(v-mean)**2,0)/total);
    const binMap = {};
    arts.forEach(a => { const b=Math.floor(Number(a.score)/binSize)*binSize; binMap[b]=(binMap[b]||0)+1; });
    const minBin=Math.floor(Math.min(...scores)/binSize)*binSize;
    const maxBin=Math.floor(Math.max(...scores)/binSize)*binSize;
    const allBins=[];
    for (let b=minBin; b<=maxBin; b+=binSize) allBins.push({ binStart:b, count:binMap[b]||0 });
    let acc=0;
    return allBins.map(({ binStart, count }) => {
      acc+=count;
      const mid=binStart+binSize/2;
      const label=binSize===1?String(binStart):`${binStart}-${binStart+binSize-1}`;
      const gaussian=std>0?total*binSize*(1/(std*Math.sqrt(2*Math.PI)))*Math.exp(-0.5*((mid-mean)/std)**2):0;
      return { score:label, count, pct:Math.round((count/total)*100), cumulative:Math.round((acc/total)*100), gaussian };
    });
  };

  const publicationsByJounal = (array) => {
    const c={};
    array.filter(a=>a.journal?.length&&!a.journal.includes('Revista não informada'))
         .forEach(a=>{ const k=a.journal.trim().toLowerCase(); c[k]=(c[k]||0)+1; });
    return Object.entries(c).map(([journal,count])=>({ journal,count })).sort((a,b)=>b.count-a.count);
  };

  const contarCountries = (array) => {
    const all=array.filter(a=>a.countries?.length&&!a.countries.includes('País não informado')).flatMap(a=>a.countries);
    return Object.entries(all.reduce((acc,c)=>{ acc[c]=(acc[c]||0)+1; return acc; },{}))
      .map(([country,count])=>({ country,count })).sort((a,b)=>b.count-a.count);
  };

  // ── effects ───────────────────────────────────────────────────────────────
  // pubYearData
  useEffect(() => {
    const yearData = { Total: publicationsByYear(handleSource('Total', true)) };

    importOptions.forEach(opt => {
      yearData[opt.label] = publicationsByYear(handleSource(opt.label));
    });

    // "Total por base" — ex: chave "Total:Scopus", "Total:Web of Science"
    Array.from(new Set(importOptions.map(o => o.database))).forEach(db => {
      yearData[`Total:${db}`] = publicationsByYear(handleSource('Total', false, db));
    });

    setPubYearData(yearData);
    setCountriesCount(contarCountries(handleSource('Total',true)));
    setJournalCount(publicationsByJounal(handleSource('Total')));
  }, [articles, importedData]);

  // pubScoreData — idem
  useEffect(() => {
    const scoreData = { Total: publicationsByScore(handleSource('Total', true), scoreBinSize) };

    importOptions.forEach(opt => {
      scoreData[opt.label] = publicationsByScore(handleSource(opt.label), scoreBinSize);
    });

    Array.from(new Set(importOptions.map(o => o.database))).forEach(db => {
      scoreData[`Total:${db}`] = publicationsByScore(handleSource('Total', true, db), scoreBinSize);
    });

    setPubScoreData(scoreData);
  }, [articles, importedData, scoreBinSize]);

  useEffect(() => { setStroke(theme==='dark'?'#fff':'#000'); }, [theme]);

  useEffect(() => {
    const mk=(key)=>[
      { name:'included',     value:statistics[key].included },
      { name:'excluded',     value:statistics[key].excluded  },
      { name:'unclassified', value:statistics[key].pending   },
    ];
    setCriterionsCount({ dataProcessing:mk('dataProcessing'), filter1:mk('filter1'), filter2:mk('filter2'), filter3:mk('filter3') });
  }, [statistics]);

  const buildCriterionChartData = useCallback((category) => {
    const countMap={}, labelMap={};
    const tally=(field)=>articles.forEach(article=>(article[field]??[]).filter(c=>c!=null).forEach(c=>{
      countMap[c.id]=(countMap[c.id]||0)+1;
      labelMap[c.id]=(c.label&&c.label!=='undefined')?c.label:'Outros';
    }));
    if (category!=='inclusion') tally('exclusionCriterion');
    if (category!=='exclusion') tally('inclusionCriterion');
    return Object.entries(countMap).map(([id,value])=>({ id,name:labelMap[id],value })).sort((a,b)=>b.value-a.value);
  }, [articles]);

  useEffect(() => {
    setCriterionChartData({
      Exclusão: buildCriterionChartData('exclusion'),
      Inclusão: buildCriterionChartData('inclusion'),
      Total:    buildCriterionChartData('total'),
    });
  }, [articles, buildCriterionChartData]);

  // ── toggle helpers para slots ─────────────────────────────────────────────
  // ── makeSlotToggle atualizado ─────────────────────────────────────────────
  // Ordem canônica das bases
  const DB_ORDER = ['Scopus', 'Web of Science', 'Total'];
  const makeSlotToggle = (setSlots, prefix) => (database) =>
  setSlots(prev => {
    const exists = prev.find(s => s.database === database);
    if (exists) return prev.length === 1 ? prev : prev.filter(s => s.database !== database);
    const next = [...prev, {
      id:       `${prefix}-${Date.now()}`,
      database,
      source:   defaultSourceForDatabase(database),
    }];
    // ← ordena pelo índice canônico
    return next.sort((a, b) => DB_ORDER.indexOf(a.database) - DB_ORDER.indexOf(b.database));
  });
  const togglePubYear  = makeSlotToggle(setPubYearSlots,  'py');
  const togglePubScore = makeSlotToggle(setPubScoreSlots, 'ps');

  // SourcePicker: troca a source de um slot específico sem afetar os outros
  const makeSourceChanger = (setSlots) => (slotId, newSource) =>
        setSlots(prev => prev.map(s => s.id === slotId ? { ...s, source: newSource } : s));
  const changePubYearSource  = makeSourceChanger(setPubYearSlots);
  const changePubScoreSource = makeSourceChanger(setPubScoreSlots);

  // Toggles sem slots
  const toggleFilter = (fk) => setFilterSelected(prev => {
    const next=new Set(prev); if(next.has(fk)&&next.size===1)return next;
    next.has(fk)?next.delete(fk):next.add(fk); return next;
  });
  const toggleCriterion = (ctr) => setCriterionSelected(prev => {
    const next=new Set(prev); if(next.has(ctr)&&next.size===1)return next;
    next.has(ctr)?next.delete(ctr):next.add(ctr); return next;
  });
  const toggleMenu = (id) => setOpenMenuId(prev=>prev===id?null:id);

  // ── derived ───────────────────────────────────────────────────────────────
  const hasAny = importedData.length > 0 && articles.length > 0;
  const filterTabs = ['filter1','filter2','filter3'].filter(k=>criterionsCount[k].some(e=>e.value!==0));
  const hasExclusion   = (a) => Array.isArray(a.exclusionCriterion)&&a.exclusionCriterion.some(c=>c!=null);
  const hasInclusionFn = (a) => Array.isArray(a.inclusionCriterion)&&a.inclusionCriterion.some(c=>c!=null);
  const hasAnyCriterion = articles.some(a=>hasExclusion(a)||hasInclusionFn(a));
  const availableCriterions = [
    articles.some(hasExclusion)   && 'Exclusão',
    articles.some(hasInclusionFn) && 'Inclusão',
    hasAnyCriterion               && 'Total',
  ].filter(Boolean);

  const visibleCountries = countriesCount.slice(0, topNCountries);
  const visibleJournals  = journalCount.slice(0, topNJournals);

  const gridClass = (count) =>
    count===1?'grid grid-cols-1':
    count===2?'grid grid-cols-1 md:grid-cols-2 gap-4':
              'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';

  // ── paletas / helpers visuais ─────────────────────────────────────────────
  const pieColors = { included:'#4ade80', excluded:'#f87171', unclassified:'#94a3b8' };
  const pieLabels = { included:'Incluído', excluded:'Excluído', unclassified:'Não Classificado' };
  const EXCLUSION_COLORS=['#f87171','#ef4444','#dc2626','#fca5a5','#fb7185','#f43f5e','#e11d48','#fda4af','#b91c1c','#ff6b6b'];
  const INCLUSION_COLORS=['#4ade80','#22c55e','#16a34a','#86efac','#34d399','#10b981','#059669','#6ee7b7','#15803d','#a7f3d0'];
  const TOTAL_COLORS    =['#6366f1','#f59e0b','#06b6d4','#8b5cf6','#14b8a6','#f97316','#ec4899','#3b82f6','#a855f7','#0ea5e9'];
  const getCriterionColors=(ctr)=>ctr.includes('Exclus')?EXCLUSION_COLORS:ctr.includes('Inclus')?INCLUSION_COLORS:TOTAL_COLORS;

  const toTitleCase = (str) => String(str).replace(/\b\w/g,c=>c.toUpperCase());
  const formatVehicle = (str, max=20) => {
    if(str.length<=max)return toTitleCase(str);
    const m=str.match(/\b([A-Z]{2,})\s*(\d{4})\b/); if(m)return `${m[1]} ${m[2]}`;
    const s=str.match(/\b([A-Z]{3,})\b/); if(s)return s[1];
    return toTitleCase(str.slice(0,max).trimEnd())+'...';
  };
  
  const toExportId = (title, source) =>
  `${title}-${displaySource(source)}`
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/_+/g, '_');

  const sharedTooltip = (labelKey, color) => ({
    content:({ active, payload }) => {
      if(!active||!payload?.length)return null;
      const d=payload[0].payload;
      return (
        <div style={{ background:'#1a1a1a',padding:'10px',border:'1px solid #444',borderRadius:'8px' }}>
          <p style={{ margin:0,fontWeight:'bold',color:'#fff' }}>{toTitleCase(d[labelKey])}</p>
          <p style={{ margin:'5px 0 0',color }}>Quant.: {d.count}</p>
        </div>
      );
    },
  });
  const criterionTooltip = {
    content:({ active, payload }) => {
      if(!active||!payload?.length)return null; const d=payload[0].payload;
      return (
        <div style={{ background:'#1a1a1a',padding:'10px',border:'1px solid #444',borderRadius:'8px' }}>
          <p style={{ margin:0,fontWeight:'bold',color:'#fff',maxWidth:220,fontSize:12 }}>{d.name}</p>
          <p style={{ margin:'4px 0 0',color:'#94a3b8',fontSize:12 }}>Artigos: {d.value}</p>
        </div>
      );
    },
  };

  const renderCustomizedLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent,value }) => {
    if(!value||!percent)return null;
    const R=Math.PI/180, radius=innerRadius+(outerRadius-innerRadius)*0.5;
    return <text x={cx+radius*Math.cos(-midAngle*R)} y={cy+radius*Math.sin(-midAngle*R)}
                 fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="600">
      {`${(percent*100).toFixed(0)}%`}</text>;
  };
  const renderCriterionLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent,value }) => {
    if(!value||!percent||percent<0.03)return null; const R=Math.PI/180;
    if(percent<0.07){ const radius=outerRadius+18, x=cx+radius*Math.cos(-midAngle*R), y=cy+radius*Math.sin(-midAngle*R);
      return <text x={x} y={y} textAnchor={x>cx?'start':'end'} dominantBaseline="central" fontSize={11} fill="#9ca3af">{`${(percent*100).toFixed(0)}%`}</text>; }
    const radius=innerRadius+(outerRadius-innerRadius)*0.5;
    return <text x={cx+radius*Math.cos(-midAngle*R)} y={cy+radius*Math.sin(-midAngle*R)}
                 fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="600">
      {`${(percent*100).toFixed(0)}%`}</text>;
  };
  const CustomLegend = ({ data }) => (
    <div className="flex justify-center flex-wrap gap-3 mt-2">
      {data.filter(i=>i.value>0).map((entry,i)=>(
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor:pieColors[entry.name] }} />
          <span className="text-xs text-gray-700 dark:text-gray-300">{pieLabels[entry.name]}: {entry.value}</span>
        </div>
      ))}
    </div>
  );
  const CriterionLegend = ({ data, ctr }) => {
    const cols=getCriterionColors(ctr);
    return (
      <div className={data.length<=3?`flex justify-center flex-wrap gap-3 mt-2`:`grid gap-x-8 gap-y-1 mt-2 max-h-36 pr-1 mx-auto w-fit grid-cols-2`}>
        {data.map((entry,i)=>(
          <div key={entry.id} className="flex items-start gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor:cols[i%cols.length] }} />
            <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
              <span className="font-semibold">{entry.id}:</span>
              <span className="text-gray-300"> ({entry.value})</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ── renderSlotSection ─────────────────────────────────────────────────────
  // Helper que renderiza uma SectionWrapper com slots e SourcePicker integrado.
  //
  // Props:
  //   title          — título da seção
  //   slots          — array de { id, source }
  //   toggleSlot     — fn chamada pelo MultiToggle
  //   changeSource   — fn(slotId, newSource) chamada pelo SourcePicker
  //   getRef         — fn(sourceLabel) => ref dinâmico
  //   data           — { [sourceLabel]: dataArray }
  //   extraControls  — JSX extra ao lado do MultiToggle (ex: range de binSize)
  //   renderChart    — fn(slot, chartRef) => JSX do gráfico interno
  // ── renderSlotSection: usedDatabases para o MultiToggle ──────────────────
  const renderSlotSection = ({ title, slots, toggleSlot, changeSource, getRef, data, extraControls, renderChart }) => {
    const usedDatabases = new Set(slots.map(s => s.database));  // ← bases, não sources
    const usedSources   = new Set(slots.map(s => s.source));    // ← para o SourcePicker

    return (
      <SectionWrapper
        title={title}
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <MultiToggle
              options={availableDatabases}     // ← bases únicas
              selected={usedDatabases}          // ← bases ativas
              onToggle={toggleSlot}
            />
            {extraControls}
          </div>
        }
      >
        <div className={gridClass(slots.length)}>
          {slots.map(slot => {
            const chartRef        = getRef(slot.source);
            const slotSources     = sourcesForDatabase(slot.database);  // ← filtrado pela base
            const slotUsedSources = new Set(
              slots.filter(s => s.id !== slot.id).map(s => s.source)   // ← outros slots bloqueados
            );

            return (
              <ChartInstance
                key={slot.id}
                id={`${title}-${displaySource(slot.source)}`
                  .toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[()]/g, '')
                }
                label={displaySource(slot.source)}   // ← era: label={slot.source}
                chartRef={chartRef}
                data={data[slot.source] ?? []}
                openMenuId={openMenuId}
                onToggle={toggleMenu}
                sourcePicker={
                  <SourcePicker
                    slotId={slot.id}
                    currentSource={slot.source}
                    sources={slotSources}         // ← só importações da base deste slot
                    usedSources={slotUsedSources} // ← bloqueia só o que outros slots já usam
                    isOpen={openMenuId === `${slot.id}-src`}
                    onToggle={toggleMenu}
                    onChange={(src) => changeSource(slot.id, src)}
                  />
                }
              >
                {renderChart(slot, chartRef)}
              </ChartInstance>
            );
          })}
        </div>
      </SectionWrapper>
    );
  };

  // Retorna o database de uma fonte (null para "Total")
  const slotDatabase = (sourceLabel) => {
    if (sourceLabel==='Total') return null;

    const db = sourceLabel.includes(':')?sourceLabel.includes(':')?sourceLabel.split(":")[1]:sourceLabel:importOptions.find(o=>o.label===sourceLabel)?.database ?? null

    return db;
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors duration-200">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
        <ChartArea className="h-6 w-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        Seção 7: Estatísticas e Análises
      </h2>

      <TabNav />

      {/* ═══ ABA BIBLIOMETRIA ════════════════════════════════════════════════ */}
      {activeTab==='bibliometria' && (
        <>
          {/* 1. Publicações por ano */}
          {hasAny && renderSlotSection({
            title: 'Publicações por ano',
            slots: pubYearSlots,
            toggleSlot:   togglePubYear,
            changeSource: changePubYearSource,
            getRef: (src) => getDynRef(pubYearRefsMap, src),
            data:   pubYearData,
            renderChart: (slot, chartRef) => {
              const db        = slotDatabase(slot.source);
              const lineColor = db ? getLineColor(db) : TOTAL_LINE;
              const barColor  = db ? getBarColor(db)  : TOTAL_BAR;
              return (
                <>
                  <div ref={chartRef}>
                    <ComposedChart
                      style={{ width:'100%', aspectRatio:pubYearSlots.length>1?1:1, maxHeight:'60vh' }}
                      responsive data={pubYearData[slot.source]??[]} margin={{ top:5,right:4,left:0,bottom:5 }}
                    >
                      <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                      <XAxis dataKey="year"  stroke={stroke} tick={{ fontSize:14 }} />
                      <YAxis dataKey="count" stroke={stroke} tick={{ fontSize:14 }} />
                      <Tooltip {...sharedTooltip('year', lineColor)} />
                      <Bar  dataKey="count" fill={barColor}  strokeWidth={2} name="Quant." />
                      <Line dataKey="count" stroke={lineColor} strokeWidth={2} type="monotone" name="Quant." dot={false} />
                    </ComposedChart>
                  </div>
                  {slot.source==='Total' && <p className="text-xs text-gray-400 mt-1">* Duplicatas não contabilizadas</p>}
                </>
              );
            },
          })}

          {/* 2. Países */}
          {hasAny && (
            <SectionWrapper
              title={
                countryView === 'bar'       ? `Publicações por país — Top ${topNCountries}` :
                countryView === 'map'       ? 'Publicações por país — Mapa'                 :
                                             'Publicações por continente — Mapa'
              }
              controls={
                <div className="flex items-center gap-2">
                  {/* Botão: mapa de países */}
                  <button
                    onClick={() => setCountryView(countryView === 'map' ? 'bar' : 'map')}
                    title={countryView === 'map' ? 'Voltar ao gráfico' : 'Mapa por país'}
                    className={`rounded-full p-1.5 cursor-pointer transition-all duration-200 hover:scale-110 flex items-center justify-center border-none
                      ${countryView === 'map' ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-800 dark:bg-gray-600'}`}
                  >
                    <Map size={12} color="white" />
                  </button>
                  {/* Botão: mapa de continentes */}
                  <button
                    onClick={() => setCountryView(countryView === 'continent' ? 'bar' : 'continent')}
                    title={countryView === 'continent' ? 'Voltar ao gráfico' : 'Mapa por continente'}
                    className={`rounded-full p-1.5 cursor-pointer transition-all duration-200 hover:scale-110 flex items-center justify-center border-none
                      ${countryView === 'continent' ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-800 dark:bg-gray-600'}`}
                    style={{ width: 24, height: 24, fontSize: 11 }}
                  >
                    <Earth size={12} color="white" />
                  </button>
                  {/* Controle Top N (só visível no modo gráfico) */}
                  {countryView === 'bar' && (
                    <>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Top</span>
                      <input type="range" min={1} max={Math.max(1,countriesCount.length)} value={topNCountries}
                        onChange={e=>setTopNCountries(Number(e.target.value))} className="w-32 accent-indigo-600 cursor-pointer" />
                      <input type="number" min={1} max={Math.max(1,countriesCount.length)} value={topNCountries}
                        onChange={e=>setTopNCountries(Math.min(Math.max(Number(e.target.value),1),Math.max(1,countriesCount.length)))}
                        className="w-14 text-center text-xs rounded-md border border-gray-300 dark:border-gray-600
                                   bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500 px-1 py-1" />
                    </>
                  )}
                </div>
              }
            >
              {countryView === 'map' ? (
                <ChartInstance id="countries-map" label="" chartRef={countriesMapRef} data={null} openMenuId={openMenuId} onToggle={toggleMenu} svgOnly>
                  <WorldHeatmap ref={countriesMapRef} countriesCount={countriesCount} isDark={theme === 'dark'} />
                </ChartInstance>
              ) : countryView === 'continent' ? (
                <ChartInstance id="continents-map" label="" chartRef={continentMapRef} data={null} openMenuId={openMenuId} onToggle={toggleMenu} svgOnly>
                  <ContinentHeatmap ref={continentMapRef} countriesCount={countriesCount} isDark={theme === 'dark'} />
                </ChartInstance>
              ) : (
                <ChartInstance id="countries" label="" chartRef={countriesRef} data={visibleCountries} openMenuId={openMenuId} onToggle={toggleMenu}>
                  <div ref={countriesRef}>
                    <BarChart layout="vertical" style={{ width:'100%',aspectRatio:1.618,maxHeight:'70vh' }}
                      responsive data={visibleCountries} margin={{ top:5,right:4,left:0,bottom:5 }}>
                      <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                      <XAxis type="number"   dataKey="count"   stroke={stroke} tick={{ fontSize:14 }} />
                      <YAxis type="category" dataKey="country" stroke={stroke} width={90} tick={{ fontSize:14 }} />
                      <Tooltip {...sharedTooltip('country','#94a3b8')} />
                      <Bar dataKey="count" fill="#646464" strokeWidth={2} name="Quant." />
                    </BarChart>
                  </div>
                </ChartInstance>
              )}
            </SectionWrapper>
          )}

          {/* 3. Veículos */}
          {hasAny && (
            <SectionWrapper
              title={`Publicações por veículo — Top ${topNJournals}`}
              controls={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Top</span>
                  <input type="range" min={1} max={Math.max(1,journalCount.length)} value={topNJournals}
                    onChange={e=>setTopNJournals(Number(e.target.value))} className="w-32 accent-indigo-600 cursor-pointer" />
                  <input type="number" min={1} max={Math.max(1,journalCount.length)} value={topNJournals}
                    onChange={e=>setTopNJournals(Math.min(Math.max(Number(e.target.value),1),Math.max(1,journalCount.length)))}
                    className="w-14 text-center text-xs rounded-md border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 px-1 py-1" />
                </div>
              }
            >
              <ChartInstance id="journals" label="" chartRef={pubJournalRefs} data={visibleJournals} openMenuId={openMenuId} onToggle={toggleMenu}>
                <div ref={pubJournalRefs}>
                  <BarChart layout="vertical" style={{ width:'100%',aspectRatio:1.618,maxHeight:'70vh' }}
                    responsive data={visibleJournals} margin={{ top:5,right:4,left:0,bottom:5 }}>
                    <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                    <XAxis type="number"   dataKey="count"   stroke={stroke} tick={{ fontSize:14 }} />
                    <YAxis type="category" dataKey="journal" stroke={stroke} width={90} tick={{ fontSize:14 }}
                           tickFormatter={v=>formatVehicle(v,25)} />
                    <Tooltip {...sharedTooltip('journal','#94a3b8')} />
                    <Bar dataKey="count" fill="#646464" strokeWidth={2} name="Quant." />
                  </BarChart>
                </div>
              </ChartInstance>
            </SectionWrapper>
          )}
        </>
      )}

      {/* ═══ ABA PROCESSO DE SELEÇÃO ═════════════════════════════════════════ */}
      {activeTab==='processo' && (
        <>
          {/* 4. Panorama de Classificação */}
          {filterTabs.length>0 && (
            <SectionWrapper
              title="Panorama de Classificação"
              controls={
                <MultiToggle
                  options={filterTabs.map(k=>k.replace('filter','Filtro '))}
                  selected={new Set([...filterSelected].map(k=>k.replace('filter','Filtro ')))}
                  onToggle={label=>toggleFilter(label.replace('Filtro ','filter'))}
                />
              }
            >
              <div className={gridClass([...filterSelected].filter(fk=>filterTabs.includes(fk)).length)}>
                {filterTabs.filter(fk=>filterSelected.has(fk)).map(fk=>(
                  <ChartInstance key={fk} id={`filter-${fk}`} label={fk.replace('filter','Filtro ')}
                                 chartRef={filterRefs[fk]} data={criterionsCount[fk]} openMenuId={openMenuId} onToggle={toggleMenu}>
                    <div ref={filterRefs[fk]}>
                      <PieChart style={{ width:'100%',aspectRatio:1,maxHeight:'50vh' }} responsive>
                        <Pie data={criterionsCount[fk]} dataKey="value" label={renderCustomizedLabel}
                             stroke="none" labelLine={false} isAnimationActive={false}>
                          {criterionsCount[fk].map((e,i)=><Cell key={i} fill={pieColors[e.name]} />)}
                        </Pie>
                        <Legend verticalAlign="bottom" content={<CustomLegend data={criterionsCount[fk]} />} />
                      </PieChart>
                    </div>
                  </ChartInstance>
                ))}
              </div>
            </SectionWrapper>
          )}

          {/* 5. Panorama dos Critérios */}
          {availableCriterions.length>0 && (
            <SectionWrapper
              title="Panorama dos Critérios"
              controls={<MultiToggle options={availableCriterions} selected={criterionSelected} onToggle={toggleCriterion} />}
            >
              <div className={gridClass([...criterionSelected].filter(c=>availableCriterions.includes(c)).length)}>
                {availableCriterions.filter(ctr=>criterionSelected.has(ctr)).map(ctr=>{
                  const data=criterionChartData[ctr]??[], cols=getCriterionColors(ctr);
                  return (
                    <ChartInstance key={ctr} id={`criterion-${ctr}`} label={ctr}
                                   chartRef={criterionChartRefs[ctr]} data={data} openMenuId={openMenuId} onToggle={toggleMenu}>
                      {data.length===0
                        ? <p className="text-xs text-gray-400 text-center py-6">Nenhum critério registrado</p>
                        : <div ref={criterionChartRefs[ctr]}>
                            <PieChart style={{ width:'100%',aspectRatio:1,maxHeight:'50vh' }} responsive>
                              <Pie data={data} dataKey="value" label={renderCriterionLabel}
                                   labelLine={false} stroke="none" isAnimationActive={false}>
                                {data.map((_,i)=><Cell key={i} fill={cols[i%cols.length]} />)}
                              </Pie>
                              <Tooltip {...criterionTooltip} />
                              <Legend verticalAlign="bottom" content={<CriterionLegend data={data} ctr={ctr} />} />
                            </PieChart>
                          </div>
                      }
                    </ChartInstance>
                  );
                })}
              </div>
            </SectionWrapper>
          )}

          {/* 6. Fluxograma PRISMA */}
          <SectionWrapper
            title="Fluxograma Prisma"
            controls={<ChartExport id="prisma" isOpen={openMenuId==='prisma'} onToggle={toggleMenu} chartRef={prismaRef} data={null} svgOnly />}
          >
            <PrismaFlowchart
              ref={prismaRef} statistics={statistics}
              scopusCount={articles.filter(a=>a.source==='Scopus').length}
              wosCount={articles.filter(a=>a.source==='Web of Science').length}
              totalCount={articles.length}
              isDark={theme==='dark'}
            />
          </SectionWrapper>

          {/* 7. Histograma do score */}
          {hasAny && renderSlotSection({
            title: 'Histograma do score',
            slots: pubScoreSlots,
            toggleSlot:   togglePubScore,
            changeSource: changePubScoreSource,
            getRef: (src) => getDynRef(pubScoreRefsMap, src),
            data:   pubScoreData,
            extraControls: (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Intervalo</span>
                <input type="range" min={1} max={5} value={scoreBinSize}
                  onChange={e=>setScoreBinSize(Number(e.target.value))} className="w-32 accent-indigo-600 cursor-pointer" />
                <input type="number" min={1} max={5} value={scoreBinSize}
                  onChange={e=>setScoreBinSize(Math.min(Math.max(Number(e.target.value),1),5))}
                  className="w-14 text-center text-xs rounded-md border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 px-1 py-1" />
              </div>
            ),
            renderChart: (slot, chartRef) => {
              const db        = slotDatabase(slot.source);
              const lineColor = db ? getLineColor(db) : TOTAL_LINE;
              const barColor  = db ? getBarColor(db)  : TOTAL_BAR;
              return (
                <>
                  <div ref={chartRef}>
                    <ComposedChart
                      style={{ width:'100%', aspectRatio:pubScoreSlots.length>1?1:1.618, maxHeight:'60vh' }}
                      responsive data={pubScoreData[slot.source]??[]} margin={{ top:5,right:4,left:0,bottom:5 }} barCategoryGap={2}
                    >
                      <CartesianGrid stroke={stroke} strokeWidth={0.5} />
                      <XAxis dataKey="score" stroke={stroke} tick={{ fontSize:14 }} />
                      <YAxis dataKey="count" stroke={stroke} tick={{ fontSize:14 }} />
                      <Tooltip {...sharedTooltip('score', lineColor)} />
                      <Bar  dataKey="count"    fill={barColor}  strokeWidth={1} name="Quant." />
                      <Line dataKey="gaussian" stroke={lineColor} strokeWidth={2} type="natural" name="Gauss" dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </div>
                  {slot.source==='Total' && <p className="text-xs text-gray-400 mt-1">* Duplicatas não contabilizadas</p>}
                </>
              );
            },
          })}

          {/* 8. Fonte */}
          {statistics.filter3.included>0 && (
            <SectionWrapper title="Fonte">
              <div className={gridClass([...filterSelected].filter(fk=>filterTabs.includes(fk)).length)}>
                {filterTabs.filter(fk=>filterSelected.has(fk)).map(fk=>(
                  <ChartInstance key={fk} id={`fonte-${fk}`} label={fk.replace('filter','Filtro ')}
                                 chartRef={filterRefs[fk]} data={criterionsCount[fk]} openMenuId={openMenuId} onToggle={toggleMenu}>
                    <div ref={filterRefs[fk]}>
                      <PieChart style={{ width:'100%',aspectRatio:1,maxHeight:'50vh' }} responsive>
                        <Pie data={criterionsCount[fk]} dataKey="value" label={renderCustomizedLabel}
                             stroke="none" labelLine={false} isAnimationActive={false}>
                          {criterionsCount[fk].map((e,i)=><Cell key={i} fill={pieColors[e.name]} />)}
                        </Pie>
                        <Legend verticalAlign="bottom" content={<CustomLegend data={criterionsCount[fk]} />} />
                      </PieChart>
                    </div>
                  </ChartInstance>
                ))}
              </div>
            </SectionWrapper>
          )}
        </>
      )}
    </div>
  );
};

export default StatisticsSection;