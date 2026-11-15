import {SITE_CRITERIA,SITE_METHOD_SOURCES,siteWeight} from './site-evaluation.js';
const n=(v,u='')=>Number.isFinite(v)?v.toFixed(2)+u:'Unknown';
const safe=v=>String(v??'').replace(/[\r\n|]/g,' ');
export function siteComparisonReport(results){
 return ['# Mars landing and base-site comparison','Project scenario assessment. No automatic winner is declared. Compare recorded settings, constraint results, evidence coverage and score bounds together.',...results.flatMap((r,i)=>[
  `## ${i+1}. ${safe(r.name)} — ${r.options.mode==='base'?'Base station':'Landing site'}`,
  `**Suitability:** ${n(r.score)}/100 over assessed criteria. **Weighted evidence coverage:** ${n(r.coverage*100)}%. **Full-weight bounds:** ${n(r.lower)}–${n(r.upper)}/100.`,
  `**Resolved constraint result:** ${r.constraint_status}.`,
  '### Recorded scenario',
  `Centre: ${r.options.lat}°N, ${r.options.lon}°E. Footprint: ${r.options.length} × ${r.options.width} m ellipse; heading ${r.options.heading}° clockwise from north.`,
  `Start: ${r.options.at}; duration: ${r.options.sols} sols. Slope limit: ${r.options.slope}°; roughness limit: ${r.options.roughness} m; required connected area: ${r.options.requiredArea} km²; landing elevation ceiling: ${r.options.maxElevation} m (landing only); resource search radius: ${r.options.radius} km.`,
  ...(r.terrain.surroundings?.buffer_m?[`Outer terrain buffer ${r.terrain.surroundings.buffer_m} m. Resolved samples ${r.terrain.surroundings.known}/${r.terrain.surroundings.total}, with ${r.terrain.surroundings.within_limits} within slope and roughness limits.`]:[]),
  '### Measurements and estimates',
  '| Metric | Result |\n|---|---|\n'+[
   ['Terrain source',`${r.source.label}; ≈${n(r.source.sample_m)} m sampling`],['Analysis / metric stencil',`${n(r.source.analysis_spacing_m)} / ${n(r.terrain.sample_m)} m`],['Valid footprint samples',`${r.terrain.known}/${r.terrain.total}`],['95th-percentile / maximum slope',`${n(r.terrain.slope_p95)} / ${n(r.terrain.slope_max)}°`],['95th-percentile roughness',n(r.terrain.roughness_p95,' m')],['Minimum / maximum elevation',`${n(r.terrain.elevation_min)} / ${n(r.terrain.elevation_max)} m`],['Connected usable area',n(r.terrain.connected_km2,' km²')],['Lit hours per sol',n(r.sun.lit_hours_per_sol)],['Equivalent incidence hours per sol',n(r.sun.equivalent_hours_per_sol)]
  ].map(([k,v])=>`| ${k} | ${safe(v)} |`).join('\n'),
  '### Preference breakdown',
  '| Criterion | Score / 100 | Weight |\n|---|---|---|\n'+Object.entries(SITE_CRITERIA).map(([k,title])=>`| ${title} | ${n(r.criteria[k])} | ${siteWeight(r.options.weights,k)} |`).join('\n'),
  '### Reasons and limits',
  [...r.violations.map(v=>`- Outside scenario: ${v}`),...r.unassessed.map(v=>`- Unassessed: ${v}`),...r.notes.map(v=>`- ${v}`),`- ${r.source.warning??'See source sampling.'}`,`- Sunlight is evaluated at the candidate centre; terrain shadow search extends to ${n(r.sun.shadow_radius_m)} m. Distant obstructions may be missed.`].join('\n'),
  '### Nearby resource evidence',
  r.resources?.targets?.length?r.resources.targets.map(t=>`- ${safe(t.name)}: ${n(t.distance_km)} km straight-line; ${t.sources.map(s=>s.url).join(', ')}`).join('\n'):'No sourced targets available within the search radius. Resource absence is not established.',
  '### Source provenance',
  `Topography: ${r.source.terrain_url}\n\nSolar geometry: ${r.source.solar_url}`,
  ...r.source.reference.map(ref=>`- ${ref.key}: ${n(ref.value)} ${safe(ref.units)}; sampling: ${safe(ref.sampling)}. ${safe(ref.note)}\n${(ref.sources??[]).map(s=>`  - ${s.url??s.title}`).join('\n')}${ref.packet_sha256?`\n  - Verified packet SHA-256: ${ref.packet_sha256}`:''}`)
 ]),'## Research behind the priorities',...SITE_METHOD_SOURCES.map(([title,url])=>`- [${title}](${url})`)].join('\n\n');
}
