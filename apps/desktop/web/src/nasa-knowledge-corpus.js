/** Local scientific reference summaries and clearly labelled planning context. */

export const NASA_KNOWLEDGE_CORPUS = Object.freeze([
 {
  id: 'NASA-HLS2-SLOPE-01',
  title: 'Slope limits in the Atlas planning scenario',
  domain: 'Mission planning',
  provenance: {
   source: 'Pyxis planner settings',
   reference: 'Current route and EVA scenario controls',
   doi: null
  },
  content: 'Choose the slope limit appropriate to the scenario and inspect sampled terrain coverage. Route ratings depend on the selected limit and source grid. A planning slope threshold does not establish traction or human traverse safety.',
  keywords: ['slope', 'limit', 'walking', 'safe', 'hazard', 'incline', '15', '22', 'barrier', 'traverse', 'steep']
 },
 {
  id: 'NASA-HLS2-MINETTI-02',
  title: 'Minetti slope-dependent walking cost',
  domain: 'Mission planning',
  provenance: {
   source: 'Published walking-cost research and the Atlas route model',
   reference: 'Minetti et al. (2002), Journal of Applied Physiology',
   doi: null
  },
  content: 'The route model uses a slope-dependent walking cost based on the Minetti polynomial. Atlas mission estimates also depend on scenario assumptions. Use the calculated route and inspect its stated assumptions.',
  keywords: ['minetti', 'metabolic', 'energy', 'expenditure', 'joules', 'kj', 'cost', 'calories', 'gravity', 'walking']
 },
 {
  id: 'NASA-HLS2-O2-03',
  title: 'Scenario oxygen and return reserves',
  domain: 'Mission planning',
  provenance: {
   source: 'Pyxis mission and route settings',
   reference: 'Current EVA consumables scenario',
   doi: null
  },
  content: 'Enter a known oxygen budget, consumption assumptions, and the return reserve in the mission controls. The scenario estimate is separate from live suit measurements. If the required inputs are unavailable, the reserve is unknown.',
  keywords: ['oxygen', 'o2', 'consumption', 'liters', 'reserve', 'pnr', 'point of no return', 'life support', 'eva', 'suit']
 },
 {
  id: 'NASA-PDS-CRISM-JEZERO-04',
  title: 'MRO CRISM Hyperspectral Mineralogy: Jezero Crater Fan Delta',
  domain: 'Planetary Geology & Mineralogy',
  provenance: {
   source: 'NASA Planetary Data System (PDS) Geosciences Node',
   reference: 'MRO CRISM Experiment Data Record FRT00005C5E / FRT0000CC97',
   doi: '10.1029/2009JE003437'
  },
  content: 'NASA MRO CRISM spectral observations (products FRT00005C5E and FRT0000CC97) at Jezero Crater (77.40°E, 18.48°N) confirm diagnostic absorption doublets at 1.4, 1.9, and 2.3 microns, indicating iron/magnesium smectite clays (nontronite and saponite) in the western delta deposits. These phyllosilicates formed during the Noachian-Hesperian transition in a standing lacustrine paleolake.',
  keywords: ['crism', 'jezero', 'delta', 'clay', 'smectite', 'nontronite', 'saponite', 'phyllosilicate', 'pds', 'water', 'lake']
 },
 {
  id: 'NASA-PDS-CRISM-VALLES-05',
  title: 'MRO CRISM Hydrated Sulfates: Candor & Coprates Chasmata',
  domain: 'Planetary Geology & Mineralogy',
  provenance: {
   source: 'NASA PDS Geosciences Node / Mars Express OMEGA',
   reference: 'CRISM Multi-Spectral Reduced Data Record (MRDR) candor_sulfates_v1',
   doi: '10.1126/science.1109087'
  },
  content: 'In Valles Marineris within Candor Chasma and Coprates Catena (-75.5°E, -6.5°N), CRISM and OMEGA hyperspectral observations reveal thick layered interior deposits (ILBs) rich in monohydrated sulfate (kieserite) and polyhydrated sulfates (gypsum, bassanite). These mineral assemblages record the late Hesperian drying epoch and acidic evaporite environments on Mars.',
  keywords: ['valles', 'marineris', 'candor', 'coprates', 'sulfate', 'kieserite', 'gypsum', 'evaporite', 'pds', 'acidic']
 },
 {
  id: 'NASA-PDS-MRO-OLIVINE-06',
  title: 'MRO CRISM Mafic Composition: Nili Fossae Olivine Units',
  domain: 'Planetary Geology & Mineralogy',
  provenance: {
   source: 'NASA PDS Geosciences Node',
   reference: 'CRISM Targeted Observation HRL000040FF',
   doi: '10.1029/2007JE003008'
  },
  content: 'CRISM targeted hyperspectral mapping across Nili Fossae and northeast Syrtis Major reveals broad, prominent absorption bands centered at 1.0 micron, diagnostic of unaltered magnesium-rich olivine (Fo60-80). Carbonate-bearing bedrock units directly overlie this olivine unit, indicating circum-neutral alteration of ancient volcanic deposits.',
  keywords: ['olivine', 'nili', 'fossae', 'syrtis', 'carbonate', 'crism', 'mafic', 'volcanic', 'pds']
 },
 {
  id: 'USGS-IAU-JEZERO-07',
  title: 'USGS Gazetteer: Jezero Crater & Octavia E. Butler Landing',
  domain: 'Planetary Nomenclature',
  provenance: {
   source: 'USGS Astrogeology Science Center / IAU Working Group',
   reference: 'IAU Gazetteer of Planetary Nomenclature Feature 2800',
   doi: 'USGS-OFR-2021-1052'
  },
  content: 'Jezero is an officially designated impact crater centered at 77.40°E, 18.48°N with a diameter of 47.5 km. On February 18, 2021, NASA Mars 2020 Perseverance landed at Octavia E. Butler Landing (77.2329°E, 18.4356°N, elevation -1937 m). Key sub-features include Kodiak Mesa, Belva Crater, and the western fan delta scarp.',
  keywords: ['jezero', 'crater', 'butler', 'landing', 'perseverance', 'kodiak', 'belva', 'usgs', 'iau', 'coordinates']
 },
 {
  id: 'USGS-IAU-GALE-08',
  title: 'USGS Gazetteer: Gale Crater & Bradbury Landing',
  domain: 'Planetary Nomenclature',
  provenance: {
   source: 'USGS Astrogeology Science Center / IAU Working Group',
   reference: 'IAU Gazetteer of Planetary Nomenclature Feature 2154',
   doi: 'USGS-OFR-2012-1188'
  },
  content: 'Gale is an equatorial Martian crater at 137.39°E, -4.82°N with a diameter of 154 km. It features a central 5.5 km high sedimentary mountain, Aeolis Mons (Mount Sharp). NASA Mars Science Laboratory (Curiosity) touched down at Bradbury Landing (137.3876°E, -4.8247°N, elevation -3488 m) on August 6, 2012.',
  keywords: ['gale', 'crater', 'bradbury', 'curiosity', 'mount sharp', 'aeolis', 'mons', 'usgs', 'coordinates']
 },
 {
  id: 'USGS-IAU-VALLES-09',
  title: 'USGS Gazetteer: Valles Marineris Canyon System',
  domain: 'Planetary Nomenclature',
  provenance: {
   source: 'USGS Astrogeology Science Center / IAU Gazetteer',
   reference: 'IAU Gazetteer of Planetary Nomenclature Feature 6323',
   doi: 'USGS-I-2782'
  },
  content: 'Valles Marineris is the largest canyon system in the Solar System, extending over 4000 km along the Martian equator (-90°E to -30°E, -20°N to 0°N) and reaching depths up to 10 km and widths up to 200 km. Major structural troughs include Noctis Labyrinthus, Ius Chasma, Candor Chasma, Melas Chasma, and Coprates Chasma.',
  keywords: ['valles', 'marineris', 'canyon', 'chasma', 'depth', 'coprates', 'candor', 'melas', 'usgs']
 },
 {
  id: 'USGS-IAU-OLYMPUS-10',
  title: 'USGS Gazetteer: Olympus Mons Shield Volcano',
  domain: 'Planetary Nomenclature',
  provenance: {
   source: 'USGS Astrogeology Science Center / IAU Gazetteer',
   reference: 'IAU Gazetteer of Planetary Nomenclature Feature 4436',
   doi: 'USGS-I-2680'
  },
  content: 'Olympus Mons (center: -133.5°E, 18.65°N) is the tallest planetary shield volcano in the Solar System. It rises approximately 21.9 km above the Mars datum and spans 600 km across, bounded by a 6 to 8 km high basal scarp. The central summit caldera is 80 km across with six overlapping collapse pits.',
  keywords: ['olympus', 'mons', 'volcano', 'height', 'elevation', 'scarp', 'caldera', 'usgs', 'highest']
 },
 {
  id: 'NASA-INSIGHT-SEIS-11',
  title: 'NASA InSight SEIS Telemetry: S1222a Monster Marsquake',
  domain: 'Planetary Geophysics',
  provenance: {
   source: 'NASA InSight Mars Lander Science Team / IPGP SEIS',
   reference: 'InSight SEIS Event S1222a Broadband Telemetry Catalog',
   doi: '10.1029/2022GL100438'
  },
  content: 'On Sol 1222 of the InSight mission (May 4, 2022), the Very Broadband (VBB) seismometer recorded event S1222a, a magnitude Mw 4.7 Marsquake—the largest recorded on another planet. The epicenter was located approximately 37 degrees east of the lander near Cerberus Fossae. Seismic energy reverberated through the crust for over 10 hours, revealing a crustal thickness of 20 to 40 km.',
  keywords: ['insight', 'seis', 'marsquake', 's1222a', 'earthquake', 'magnitude', 'crust', 'cerberus', 'seismometer']
 },
 {
  id: 'NASA-EMARS-WIND-12',
  title: 'NASA EMARS Atmospheric Telemetry & Barometric Scale Height',
  domain: 'Martian Meteorology',
  provenance: {
   source: 'NASA Planetary Data System Atmospheres Node',
   reference: 'European Mars Climate Database (EMCD) / NASA EMARS v2.3',
   doi: '10.1016/j.icarus.2015.02.012'
  },
  content: 'The Martian atmosphere is 95.3% CO2 with a global mean surface pressure of approximately 610 Pa (6.1 hPa), varying seasonally between 400 Pa and 900 Pa due to polar CO2 condensation. The atmospheric scale height H is approximately 11.1 km. Surface wind velocities typically range from 2 to 10 m/s, but dust devil vortex winds and regional storm fronts can exceed 30 m/s.',
  keywords: ['atmosphere', 'pressure', 'barometric', 'wind', 'speed', 'scale height', 'emars', 'co2', 'dust', 'pds']
 },
 {
  id: 'NASA-M2020-MOXIE-13',
  title: 'NASA Mars 2020 MOXIE Oxygen Production Payload',
  domain: 'ISRU Technologies',
  provenance: {
   source: 'NASA Jet Propulsion Laboratory / MIT Haystack Observatory',
   reference: 'Hecht et al. (2021) Space Sci Rev, MOXIE Experiment Overview',
   doi: '10.1007/s11214-020-00782-8'
  },
  content: 'The Mars Oxygen ISRU Experiment (MOXIE) onboard Perseverance produced breathable O2 directly from atmospheric CO2 via solid oxide electrolysis at 800°C. Over 16 successful runs in Jezero Crater, MOXIE produced 122 grams of oxygen with purity > 98%, demonstrating an operational production rate of 6 to 12 grams per hour.',
  keywords: ['moxie', 'isru', 'oxygen', 'production', 'perseverance', 'co2', 'electrolysis', 'nasa', 'pds']
 },
 {
  id: 'NASA-M2020-RIMFAX-14',
  title: 'NASA Mars 2020 RIMFAX Ground-Penetrating Radar',
  domain: 'Subsurface Exploration',
  provenance: {
   source: 'NASA Jet Propulsion Laboratory / University of Oslo',
   reference: 'Hamran et al. (2020) Space Sci Rev, RIMFAX Experiment Overview',
   doi: '10.1007/s11214-020-00740-4'
  },
  content: 'The Radar Imager for Mars Subsurface Experiment (RIMFAX) uses ultra-wideband frequency-modulated continuous-wave (FMCW) radar (150-1200 MHz) mounted on Perseverance. RIMFAX sounding penetrates the Jezero Crater subsurface to depths of over 10 meters, mapping stratigraphic layering, deltaic bottomsets, and cross-bedded strata beneath rover tracks.',
  keywords: ['rimfax', 'radar', 'ground penetrating', 'subsurface', 'depth', 'strata', 'jezero', 'perseverance', 'pds']
 },
 {
  id: 'NASA-MSL-SAM-15',
  title: 'NASA Curiosity SAM & ChemMin Mineralogy at Gale Crater',
  domain: 'Planetary Geochemistry',
  provenance: {
   source: 'NASA Goddard Space Flight Center / PDS Geosciences',
   reference: 'Mahaffy et al. (2012) Space Sci Rev, SAM Instrument Suite',
   doi: '10.1007/s11214-012-9879-z'
  },
  content: 'The Sample Analysis at Mars (SAM) instrument suite on Curiosity detected chlorobenzene, sulfur-bearing organic compounds, and indigenous nitrates in Yellowknife Bay mudstone drilled samples. The CheMin X-ray diffractometer identified low-temperature clays (smectites), basaltic feldspar, pyroxene, and hematite, confirming habitable lacustrine conditions in ancient Gale Crater.',
  keywords: ['sam', 'chemin', 'curiosity', 'gale', 'organic', 'molecules', 'mudstone', 'yellowknife', 'pds', 'habitability']
 }
]);
