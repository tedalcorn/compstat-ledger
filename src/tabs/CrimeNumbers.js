import React, { useState, useMemo } from 'react';
import crimeHistory from '../data/crime_history.json';
import {
  VC, VOLATILITY_THRESHOLD, offenseClass, expandCrimeTitle, formatGeoName,
  getHistoricalContext, ContextSparkline, MiniSparkline, Download,
} from '../shared';

/* ------------------------------------------------------------------ */
/* CRIME NUMBERS TAB                                                   */
/* One table for every tracked offense: volume, trend and historical   */
/* context move together, and every column sorts on click. Replaces    */
/* the old side-by-side volume/trajectory charts and the separate      */
/* "Detailed Data Ledger".                                             */
/* ------------------------------------------------------------------ */
export default function CrimeNumbers({ parsedData, activeTab, activeGeo, isTouristPrecinct, downloadCSV }) {
  const [sortBy, setSortBy] = useState('current');
  const [sortDir, setSortDir] = useState('desc');
  const [classFilter, setClassFilter] = useState('all'); // all | Person | Property

  const currentYear = parsedData.period?.week_end ? new Date(parsedData.period.week_end).getFullYear() : new Date().getFullYear();
  const isCitywide = activeGeo === 'citywide';

  const rows = useMemo(() => {
    let r = parsedData.all;
    if (classFilter !== 'all') r = r.filter(o => offenseClass(o.name) === classFilter);
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (o) => {
      if (sortBy === 'name') return o.name.toLowerCase();
      if (sortBy === 'pct') return typeof o.pct === 'number' ? o.pct : -Infinity * dir;
      return o[sortBy] ?? 0;
    };
    return [...r].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [parsedData.all, classFilter, sortBy, sortDir]);

  const maxCurrent = Math.max(1, ...parsedData.all.map(o => o.current || 0));

  const handleSort = (field, defaultDir = 'desc') => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir(defaultDir); }
  };

  const SortTh = ({ field, children, align = 'right', defaultDir = 'desc', className = '' }) => {
    const active = sortBy === field;
    return (
      <th className={`py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
        <button
          onClick={() => handleSort(field, defaultDir)}
          className={`group inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors ${active ? 'text-black' : 'text-gray-400 hover:text-black'}`}
        >
          <span className="underline decoration-dotted decoration-gray-300 underline-offset-[3px] group-hover:decoration-black">{children}</span>
          <span className={`inline-block text-[11px] leading-none ${active ? 'opacity-100' : 'opacity-30 group-hover:opacity-70'}`}>{active ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}</span>
        </button>
      </th>
    );
  };

  const classChip = (name) => {
    const cls = offenseClass(name);
    if (!cls) return null;
    return (
      <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-[1px] rounded-sm flex-shrink-0 ${cls === 'Person' ? 'bg-pink-100 text-pink-700' : 'bg-indigo-100 text-indigo-700'}`}>
        {cls}
      </span>
    );
  };

  const toneClass = (tone) => tone === 'green' ? 'bg-green-50 text-green-700 border-green-200'
    : tone === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200'
    : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-5 gap-4">
        <div>
          <h2 className="text-2xl font-black font-serif">Crime Numbers</h2>
          <p className="text-sm text-gray-500 font-serif mt-1">
            Every offense NYPD tracks {isCitywide ? 'citywide' : `in the ${formatGeoName(activeGeo)}`}, {activeTab === 'ytd' ? 'year-to-date' : 'this week'} vs. the same period last year. Click any column header to sort.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-gray-100 p-1 rounded border border-gray-200">
            {[['all', 'All'], ['Person', 'Person'], ['Property', 'Property']].map(([val, label]) => (
              <button key={val} onClick={() => setClassFilter(val)} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${classFilter === val ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>{label}</button>
            ))}
          </div>
          <button
            onClick={() => {
              const header = ['Offense', 'Person/Property', 'Current', 'Prior Year', 'YTD change (incidents)', 'YTD change (%)', 'Rate per 100k', 'Citywide Rate per 100k'];
              const data = rows.map(r => [
                r.name,
                offenseClass(r.name) || '',
                r.current,
                r.prior,
                r.diff,
                typeof r.pct === 'number' ? r.pct.toFixed(2) : '',
                r.currentRate != null ? r.currentRate.toFixed(2) : '',
                parsedData.citywideRates?.[r.name] != null ? parsedData.citywideRates[r.name].toFixed(2) : '',
              ]);
              const geo = isCitywide ? 'citywide' : activeGeo.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
              const period = (parsedData.period?.week_end || 'period').replace(/[^a-z0-9]+/gi, '-');
              downloadCSV(`compstat_${geo}_${activeTab}_${period}.csv`, [header, ...data]);
            }}
            title="Download this table as CSV"
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {isCitywide && (
        <div className="hidden md:flex items-center gap-5 mb-4 text-[11px] text-gray-500">
          <span className="font-black uppercase tracking-widest text-[10px] text-gray-400">How to read the trend column:</span>
          <span className="flex items-center gap-1.5"><svg width="22" height="10"><polyline points="1,7 6,5 11,6 16,2 21,3" fill="none" stroke="#9ca3af" strokeWidth="1.5" /></svg> Annual count, ~2013–now</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: '#dbeafe' }} /> 2017–19 pre-pandemic range</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: VC.green }} /> This year (projected to full year)</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b-2 border-black">
              <SortTh field="name" align="left" defaultDir="asc">Offense</SortTh>
              <th className="py-3 text-left pl-4"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Volume</span></th>
              <SortTh field="current">{activeTab === 'ytd' ? 'This yr' : 'This wk'}</SortTh>
              <SortTh field="prior">Prior yr</SortTh>
              <SortTh field="diff">{activeTab === 'ytd' ? 'YTD change (incidents)' : 'Change (incidents)'}</SortTh>
              <SortTh field="pct">{activeTab === 'ytd' ? 'YTD change (%)' : 'Change (%)'}</SortTh>
              {isCitywide && <th className="py-3 text-center hidden md:table-cell"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400" title="Annual citywide count since ~2013; blue band = 2017–19 pre-pandemic range; dot = this year projected to full year">Trend since '13</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(item => {
              const isVolatile = item.prior < VOLATILITY_THRESHOLD;
              const cls = offenseClass(item.name);
              const barColor = cls === 'Person' ? VC.magenta : cls === 'Property' ? VC.indigo : VC.periwinkle;
              const barW = Math.max(2, (item.current / maxCurrent) * 100);
              const ctx = isCitywide ? getHistoricalContext(crimeHistory.citywide, item, currentYear) : null;
              const primaryBadge = ctx?.sinceSuperlative || ctx?.outlierBadge || ctx?.pandemicBadge;
              return (
                <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-3 font-bold text-sm text-black">
                    <div className="flex items-center gap-2 flex-wrap">
                      {classChip(item.name)}
                      <span title={expandCrimeTitle(item.name)}>{item.name}{isVolatile && <span className="ml-1 text-gray-400">*</span>}</span>
                      {primaryBadge && (
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${toneClass(primaryBadge.tone)}`} title={ctx?.pandemicBadge?.label && ctx.pandemicBadge !== primaryBadge ? `${primaryBadge.label} · ${ctx.pandemicBadge.label}` : primaryBadge.label}>
                          {primaryBadge.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pl-4 w-[160px] min-w-[120px]">
                    <div className="h-[10px] bg-gray-100 rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm" style={{ width: `${barW}%`, background: barColor, opacity: isVolatile ? 0.45 : 0.9 }} />
                    </div>
                  </td>
                  <td className={`py-2.5 text-right tabular-nums text-black ${isVolatile ? 'opacity-50' : ''}`}>
                    <div className="text-sm font-black">{item.current.toLocaleString()}</div>
                    {item.currentRate !== null && !isTouristPrecinct && <div className="text-[10px] font-normal text-gray-500">{item.currentRate.toFixed(1)}/100k{!isCitywide && parsedData.citywideRates[item.name] != null ? ` (CW: ${parsedData.citywideRates[item.name].toFixed(1)})` : ''}</div>}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums text-gray-500 text-sm ${isVolatile ? 'opacity-50' : ''}`}>{item.prior.toLocaleString()}</td>
                  <td className={`py-2.5 text-right tabular-nums text-sm font-bold ${item.diff > 0 ? 'text-orange-700' : item.diff < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}
                  </td>
                  <td className={`py-2.5 text-right text-xs font-bold tabular-nums ${item.pct > 0 ? 'text-orange-600' : item.pct < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    <span aria-label={`${item.pct > 0 ? 'Up' : 'Down'} ${Math.abs(item.pct ?? 0).toFixed(1)} percent`}>
                      <span aria-hidden="true">{item.pct > 0 ? '▲' : item.pct < 0 ? '▼' : '•'}</span> {typeof item.pct === 'number' ? Math.abs(item.pct).toFixed(1) + '%' : '—'}
                    </span>
                  </td>
                  {isCitywide && (
                    <td className="py-2.5 text-center hidden md:table-cell">
                      {ctx ? (
                        <ContextSparkline series={ctx.series} annualized={ctx.annualized} preLow={ctx.preLow} preHigh={ctx.preHigh} />
                      ) : (
                        <MiniSparkline points={[item.prior, item.current]} minY={0} />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-[11px] font-serif italic text-gray-500 border-t border-gray-100 pt-4 space-y-1">
        <div><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: VC.magenta }} /> Person crimes · <span className="inline-block w-2 h-2 align-middle mr-1" style={{ background: VC.indigo }} /> Property crimes · * Base sample under 30 (statistically volatile).</div>
        {isCitywide && <div>Trend column shows the offense's annual citywide count back to the early 2010s. The blue band marks the 2017–2019 pre-pandemic range. Dot = current year, projected to a full-year equivalent from year-to-date data. Badges appear only for the 10 major offenses tracked in the 30-year history.</div>}
      </div>
    </div>
  );
}
