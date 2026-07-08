import React, { useState, useEffect } from 'react';
import crimeHistory from '../data/crime_history.json';
import {
  CW, VC, MAJOR_VIOLENT, MAJOR_PROPERTY,
  formatPop, formatGeoName, expandCrime, expandCrimeTitle, toOrdinalPrecinct,
  getPrePandemicRecovery, renderMarkdown, calcPct,
  RTCI_GROUPS, RTCI_FALLBACK, RTCI_FALLBACK_PERIOD, RTCI_FALLBACK_UPDATED, rtciRate,
  Users, Download,
} from '../shared';

/* ------------------------------------------------------------------ */
/* NATIONAL COMPARISON SIDEBAR — Real-Time Crime Index                 */
/* Compact version of the old full-width "National" section.           */
/* ------------------------------------------------------------------ */
const NationalSidebar = ({ rtciData, downloadCSV }) => {
  const metrics = [
    { key: 'murder', label: 'Murder' },
    { key: 'violent', label: 'Violent' },
    { key: 'property', label: 'Property' },
  ];
  const [activeMetric, setActiveMetric] = useState(() => {
    try { return localStorage.getItem('rtci_metric') || 'murder'; } catch { return 'murder'; }
  });
  const [activeGroup, setActiveGroup] = useState(() => {
    try { return localStorage.getItem('rtci_group') || 'largest5'; } catch { return 'largest5'; }
  });
  useEffect(() => { try { localStorage.setItem('rtci_metric', activeMetric); } catch {} }, [activeMetric]);
  useEffect(() => { try { localStorage.setItem('rtci_group', activeGroup); } catch {} }, [activeGroup]);
  const group = RTCI_GROUPS.find(g => g.key === activeGroup) || RTCI_GROUPS[0];

  const allCities = rtciData?.cities || {};
  const period = rtciData?.period || RTCI_FALLBACK_PERIOD;
  const updated = rtciData?.updated || RTCI_FALLBACK_UPDATED;

  const citiesForGroup = group.cities.map(name => {
    if (allCities[name]) return allCities[name];
    const fb = RTCI_FALLBACK.find(c => c.city === name);
    return fb || null;
  }).filter(Boolean);

  if (!citiesForGroup.find(c => c.isNYC)) {
    const nyc = allCities['New York City'] || RTCI_FALLBACK.find(c => c.isNYC);
    if (nyc) citiesForGroup.unshift(nyc);
  }

  // Cities reporting a zero for the active metric haven't submitted data to RTCI for
  // this window (e.g. Jacksonville) — showing them as "0 crime" would rank them safest.
  // Exclude them from the chart and disclose the exclusion below.
  const reporting = citiesForGroup.filter(c => c[activeMetric] > 0);
  const missing = citiesForGroup.filter(c => !(c[activeMetric] > 0)).map(c => c.city);

  const ranked = reporting.map(c => ({ ...c, rate: rtciRate(c[activeMetric], c.pop) }))
    .sort((a, b) => a.rate - b.rate);
  const maxRate = ranked.length > 0 ? ranked[ranked.length - 1].rate : 1;

  return (
    <aside className="p-5 bg-gray-50 rounded-sm border border-gray-200 h-full">
      <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">How NYC Compares</h3>
      <p className="text-[12px] font-serif text-gray-600 mt-0.5 mb-3">12-month rolling rate per 100k residents</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {metrics.map(m => (
          <button key={m.key} onClick={() => setActiveMetric(m.key)}
            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wide rounded-sm border ${activeMetric === m.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {RTCI_GROUPS.map(g => (
          <button key={g.key} onClick={() => setActiveGroup(g.key)}
            className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-sm ${activeGroup === g.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-gray-600'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {ranked.map(c => {
          const barW = maxRate > 0 ? (c.rate / maxRate) * 100 : 0;
          const isNYC = c.isNYC;
          return (
            <div key={c.city} className="flex items-center gap-2">
              <span className={`w-[86px] text-right text-[11px] leading-tight truncate ${isNYC ? 'font-black text-gray-900' : 'font-medium text-gray-500'}`} title={c.city}>
                {c.city === 'New York City' ? 'New York' : c.city}
              </span>
              <div className="flex-1 h-3.5 bg-gray-200 rounded-sm overflow-hidden">
                <div className={`h-full rounded-sm ${isNYC ? 'bg-gray-900' : 'bg-gray-400'}`} style={{ width: `${barW}%` }} />
              </div>
              <span className={`w-12 text-[11px] tabular-nums ${isNYC ? 'font-black text-gray-900' : 'font-medium text-gray-500'}`}>
                {c.rate.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="mt-2.5 text-[10px] text-gray-400 italic leading-snug">
          No data reported for {missing.join(', ')} in this window — excluded rather than shown as zero.
        </p>
      )}
      {activeMetric === 'murder' && (
        <p className="mt-2.5 text-[10px] font-serif italic text-gray-500 leading-snug">
          Murder is the most reliably comparable category across cities; violent and property totals are more affected by classification and reporting differences.
        </p>
      )}
      <div className="mt-3 pt-2.5 border-t border-gray-200 flex flex-col gap-1.5">
        <p className="text-[9px] text-gray-400 leading-snug">Data through {period} · Updated {updated} · UCR Part I offenses</p>
        <div className="flex items-center gap-2.5">
          <a href="https://realtimecrimeindex.com/" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
            Real-Time Crime Index ↗
          </a>
          {downloadCSV && (
            <button
              onClick={() => {
                const header = ['City', 'Population', 'Murder', 'Violent Crime', 'Property Crime', 'Murder per 100k', 'Violent per 100k', 'Property per 100k'];
                const data = ranked.map(c => [c.city, c.pop, c.murder, c.violent, c.property, rtciRate(c.murder, c.pop), rtciRate(c.violent, c.pop), rtciRate(c.property, c.pop)]);
                downloadCSV(`city_comparison_${activeMetric}_${activeGroup}.csv`, [header, ...data]);
              }}
              title="Download city comparison as CSV"
              className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-black border border-gray-300 rounded px-1.5 py-0.5 hover:bg-white transition-colors flex items-center gap-1">
              <Download size={9} /> CSV
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

/* ------------------------------------------------------------------ */
/* HEADLINES TAB                                                       */
/* Topline trends in a fixed order (major index → violent subset →     */
/* property subset), then notable patterns as bullets, with the        */
/* national comparison as a right-hand sidebar.                        */
/* ------------------------------------------------------------------ */
export default function Headlines({ parsedData, hotspots, activeTab, activeGeo, isTouristPrecinct, activePop, rtciData, downloadCSV }) {
  const { totals, felonies, driver, period, localAnomaly, localBrightSpot, topSurge, topDrop } = parsedData;

  // Violent / property subsets of the 7-felony major index.
  const subset = (names) => {
    let cur = 0, pri = 0;
    felonies.forEach(f => { if (names.includes(f.name)) { cur += f.current; pri += f.prior; } });
    return { cur, pri, pct: calcPct(cur, pri) };
  };
  const violent = subset(MAJOR_VIOLENT);
  const property = subset(MAJOR_PROPERTY);

  const endYear = period?.week_end ? new Date(period.week_end).getFullYear() : new Date().getFullYear();
  const yy = (y) => `’${String(y).slice(-2)}`;
  const periodWord = activeTab === 'ytd' ? 'YTD' : 'this week';

  const fmtTrendPct = (pct) => {
    if (typeof pct !== 'number') return '—';
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '•';
    return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
  };

  const statLines = [
    { label: 'Major crime index', sub: 'All 7 major felonies', cur: totals.mCur, pri: totals.mPri, pct: totals.mPct },
    { label: 'Violent index', sub: 'Murder, rape, robbery, felony assault', cur: violent.cur, pri: violent.pri, pct: violent.pct },
    { label: 'Property index', sub: 'Burglary, grand larceny, auto theft', cur: property.cur, pri: property.pri, pct: property.pct },
  ];

  // Notable patterns — the old "In context" box plus the three stat cards, folded into
  // one bulleted list. Each bullet leads with a bolded headline.
  const bullets = [];
  if (activeGeo === 'citywide') {
    const ineq = hotspots?.inequality;
    if (ineq) {
      bullets.push(`**Crime is concentrated geographically:** the ${ineq.topCount} highest-crime precincts (${formatPop(ineq.topPop)} residents) match the violent crime total of the ${ineq.bottomCount} safest (${formatPop(ineq.bottomPop)} residents).`);
    }
    if (driver && driver.name && Math.abs(driver.share) >= 5) {
      const direction = totals.diff > 0 ? 'increase' : 'decline';
      bullets.push(`**The biggest driver of the ${direction} is ${expandCrime(driver.name)}:** it accounts for ${Math.round(Math.abs(driver.share))}% of the citywide ${direction} in the index total (${Math.abs(driver.diff).toLocaleString()} ${driver.diff < 0 ? 'fewer' : 'more'} cases than last year).`);
    }
    const recovery = getPrePandemicRecovery(felonies, crimeHistory.citywide);
    if (recovery && recovery.total > 0) {
      if (recovery.above.length === 0) {
        bullets.push(`**All ${recovery.total} major felonies are tracking at or below their pre-pandemic baseline** (2017–19 average), projected to full year.`);
      } else {
        const names = recovery.above.map(a => expandCrimeTitle(a.name));
        const joined = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
        bullets.push(`**${names.length === 1 ? 'One crime type is' : `${names.length} crime types are`} still tracking above the pre-pandemic baseline** (2017–19 average): ${joined}. The other ${recovery.below} major felonies are at or below it.`);
      }
    }
    const spike = hotspots?.topPctSpike;
    if (spike && typeof spike.pct === 'number' && spike.pct >= 25) {
      bullets.push(`**The sharpest local shift is ${expandCrime(spike.crime)} in the ${toOrdinalPrecinct(spike.precinct)}:** up ${Math.round(spike.pct)}% ${periodWord}, from ${spike.prior.toLocaleString()} to ${spike.current.toLocaleString()}.`);
    }
    const drop = hotspots?.topPctDrop;
    if (drop && typeof drop.pct === 'number' && drop.pct <= -25) {
      bullets.push(`**The sharpest local improvement is ${expandCrime(drop.crime)} in the ${toOrdinalPrecinct(drop.precinct)}:** down ${Math.round(Math.abs(drop.pct))}% ${periodWord}, from ${drop.prior.toLocaleString()} to ${drop.current.toLocaleString()}.`);
    }
  } else {
    if (driver && driver.share >= 25) {
      bullets.push(`**The local trajectory is driven by ${expandCrime(driver.name)}:** the change in its volume accounts for ${Math.round(driver.share)}% of this area's overall shift.`);
    }
    if (localAnomaly && !isTouristPrecinct) {
      bullets.push(`**Elevated local risk — ${expandCrime(localAnomaly.name)}:** the rate here is ${localAnomaly.localRate.toFixed(1)} per 100k residents, ${localAnomaly.ratio.toFixed(1)}x the citywide average (${localAnomaly.cityRate.toFixed(1)}).`);
    } else if (topSurge && topSurge.pct > 0) {
      bullets.push(`**${expandCrimeTitle(topSurge.name)} is rising:** up ${Math.round(topSurge.pct)}% compared to last year (${topSurge.prior.toLocaleString()} → ${topSurge.current.toLocaleString()}).`);
    }
    if (localBrightSpot && !isTouristPrecinct) {
      bullets.push(`**Local bright spot — ${expandCrime(localBrightSpot.name)}:** the rate here sits ${Math.round((1 - localBrightSpot.ratio) * 100)}% below the citywide average.`);
    } else if (topDrop && topDrop.pct < 0) {
      bullets.push(`**${expandCrimeTitle(topDrop.name)} is falling:** down ${Math.round(Math.abs(topDrop.pct))}% compared to last year (${topDrop.prior.toLocaleString()} → ${topDrop.current.toLocaleString()}).`);
    }
  }

  return (
    <div>
      {isTouristPrecinct && <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-400 text-sm font-serif italic text-gray-700"><strong>Context Note:</strong> {formatGeoName(activeGeo)} is a high-traffic hub with few residents; crime rates primarily reflect commercial/visitor density.</div>}

      {/* Topline trends, in a fixed hierarchy: overall index, then its violent and property subsets */}
      <section className="mb-8 relative">
        {activeGeo === 'citywide' && (() => {
          const cwTotals = CW.map(d => d.BU + d.FA + d.GA + d.GL + d.MU + d.RA + d.RO);
          const maxT = Math.max(...cwTotals);
          const w = 220; const h = 56;
          const pts = cwTotals.map((v, i) => `${(i / (cwTotals.length - 1)) * w},${h - (v / maxT) * h}`).join(' ');
          const area = pts + ` ${w},${h} 0,${h}`;
          return (
            <svg width={w} height={h} className="absolute bottom-0 left-0 opacity-[0.07] pointer-events-none" preserveAspectRatio="none">
              <polygon points={area} fill={VC.black} />
            </svg>
          );
        })()}
        <h1 className="text-2xl sm:text-3xl font-black leading-[1.12] tracking-tight mb-5 text-black max-w-3xl">
          Major index offenses are {totals.diff > 0 ? 'up' : 'down'} {Math.abs(totals.mPct).toFixed(1)}% {activeTab === 'ytd' ? 'year-to-date' : 'this week'} {activeGeo === 'citywide' ? '' : `in the ${activeGeo} `}vs. prior year.
        </h1>
        <div className="divide-y divide-gray-100 border-y border-gray-200 max-w-3xl">
          {statLines.map((s, i) => (
            <div key={s.label} className="flex items-baseline gap-4 py-2.5 flex-wrap">
              <span className={`w-40 flex-shrink-0 ${i === 0 ? 'text-[14px] font-black' : 'text-[13px] font-bold text-gray-700 pl-4'}`}>{s.label}</span>
              <span className={`tabular-nums font-black w-28 whitespace-nowrap ${i === 0 ? 'text-[22px]' : 'text-[17px]'}`} style={{ color: (s.pct ?? 0) > 0 ? '#c2410c' : (s.pct ?? 0) < 0 ? '#15803d' : '#374151' }}>
                {fmtTrendPct(s.pct)}
              </span>
              <span className="text-[13px] text-gray-600 tabular-nums">
                {s.cur.toLocaleString()} in {yy(endYear)} {periodWord} vs {s.pri.toLocaleString()} in {yy(endYear - 1)} {periodWord}
              </span>
              <span className="text-[11px] text-gray-400 italic hidden md:inline">{s.sub}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2.5 text-[12px] text-gray-400">
          <span>{activeTab === 'ytd' ? `Year-to-date through ${period?.week_end || '—'}` : `Week of ${period?.week_start || '—'} – ${period?.week_end || '—'}`}</span>
          {activePop && activeGeo !== 'citywide' && !isTouristPrecinct && (
            <span className="flex items-center gap-1 text-gray-500"><Users size={12} /> {((totals.mCur / activePop) * 100000).toFixed(1)} per 100k residents (citywide: {(totals.citywideRate || 0).toFixed(1)})</span>
          )}
        </div>
      </section>

      {/* Notable patterns + national comparison sidebar */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 p-6 bg-white rounded-sm border border-gray-200">
          <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 mb-4">Patterns and outliers</h2>
          {bullets.length === 0 ? (
            <p className="font-serif text-[15px] text-gray-500 italic">Nothing unusual stands out in this period's data.</p>
          ) : (
            <ul className="space-y-3.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-3 font-serif text-[15px] leading-relaxed text-gray-700">
                  <span className="text-gray-300 flex-shrink-0 mt-[1px]">▪</span>
                  <span>{renderMarkdown(b)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <NationalSidebar rtciData={rtciData} downloadCSV={downloadCSV} />
      </section>
    </div>
  );
}
