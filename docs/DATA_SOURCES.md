# Pyxis Data Sources: NASA & Non-NASA Source Registry

> **Two-Source Classification Architecture**  
> Based on the organization or archive publishing each linked reference—not simply the spacecraft or mission that originally collected the observations.  
> **37 original dataset entries** • **23 entries with NASA-linked references** • **24 entries with non-NASA-linked references** • **10 appearing in both sections**

---

### Interpretation & Provenance Rules
* **NASA Grouping**: JPL, NAIF, NASA PDS, NASA GSFC, NASA GISS, and NASA-operated project services are grouped with NASA.
* **Non-NASA Grouping**: USGS, NOAA, ESA/DLR, Caltech, university/institute publishers, Esri, scientific journals, and Zenodo are grouped with Non-NASA.
* **External Hosting**: NASA mission-derived observations hosted by external organizations remain listed under that external publisher.
* **Internal References**: Pyxis GitHub catalogs and manifests are retained as internal supporting references, not independent observational data sources (`[Pyxis internal]`).
* **Mixed Entries**: An entry appears in both groups only when its original reference links are published by both types of organization. Each table lists only the links relevant to its section. Original dataset names and descriptions are unchanged.

---

## 1. NASA DATA SOURCES
*NASA/JPL, NASA-operated repositories, NASA PDS, and project services.*

### Map Imagery and Terrain
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **Viking MDIM 2.1 colorized mosaic, 232 m/px** | Provides global color context and fills CTX gaps and polar coverage. Its colors can tint finer grayscale imagery. | [NASA Mars Trek Viking Product](https://trek.nasa.gov/mars/) · [NASA Trek Layer Catalog](https://trek.nasa.gov/mars/) |
| **MRO HiRISE orthoimages & stereo terrain models** | Supplies selected high-resolution observation imagery, terrain, coverage footprints, and local analysis. | [HiRISE PDS Image Archive](https://pds-imaging.jpl.nasa.gov/volumes/mro.html) |
| **MGS MOLA MEGDR, 4 samples/degree** | Provides coarse global terrain in coverage gaps and an independent reference for detecting gross terrain height errors. | [NASA PDS MOLA Data Directory](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/) |
| **Mars 2020 Jezero CTX DTM & Gale HiRISE DTM** | Supplies packaged elevation grids for Bright Angel, Three Forks, and Gale boxwork EVA planning. | [NASA Trek Gale DTM](https://trek.nasa.gov/mars/) |
| **HiRISE COLOR, Mars Express HRSC Color & ExoMars CaSSIS** | Selected enhanced-color or multiband imagery collected for preparation archive. Prepared display coverage varies by product. | [NASA PDS CaSSIS Products](https://pds-geosciences.wustl.edu/) |

### Geology and Resources
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **Mars Express OMEGA & MRO CRISM hydrous detections** | Supplies hydrated-mineral detection points used in the science catalog and research-target density layers. | [NASA PDS Hydrous-Site Tables](https://pds-geosciences.wustl.edu/) |
| **Mars Odyssey GRS elemental maps** | Supplies regional potassium, thorium, and water-equivalent hydrogen overlays with published uncertainties. | [NASA PDS GRS Tables](https://pds-geosciences.wustl.edu/mors/m01-m-grs-5-elemental-v1/) |
| **JPL MRO120D gravity & Langlais crustal magnetic coefficients** | Provides gravity-anomaly and modeled magnetic-strength and component overlays. | [NASA PDS Mars Gravity Data](https://pds-geosciences.wustl.edu/mro/mro-m-rss-5-sdp-v1/) |

### Weather, Sunlight and Radiation
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **NASA Mars Explorer EMARS model grids** | Provides historical climate analogues for wind, temperatures, pressure, dust and cloud optical depths, vapor, frost, snow, and relative UV. Feeds overlays and mission scenarios. | [NASA GSFC Mars Explorer](https://marsexplorer.gsfc.nasa.gov/) |
| **Curiosity REMS corrected UV observations** | Provides local historical UV charts grouped by sol and local mean solar time. | [NASA PDS REMS UV Tables](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html) |
| **Mars24 solar geometry & IAU solar radius** | Calculates local solar time, daylight, Sun position, and size. Terrain heights support shadow checks and solar planning. | [NASA GISS Mars24 Algorithm](https://www.giss.nasa.gov/tools/mars24/) |
| **Curiosity RAD dose-rate quicklooks** | Plots local silicon and tissue-equivalent plastic detector dose-rate timelines. | [NASA ISWA RAD Data Feed](https://iswa.gsfc.nasa.gov/) · [NASA SPDF RAD Science Archive](https://spdf.gsfc.nasa.gov/) |
| **Mars Express ASPERA-3 IMA particle counts** | Plots orbital particle indicator and penetrating-particle background counts. | [NASA ISWA Mars Express Feed](https://iswa.gsfc.nasa.gov/) |
| **NASA CCMC iPATH Mars proton runs** | Displays modeled Mars proton flux, energy spectra, and forecast validity windows. | [NASA CCMC iPATH Model & Runs](https://ccmc.gsfc.nasa.gov/) |
| **NASA CCMC DONKI WSA–ENLIL runs** | Displays modeled coronal mass ejection and shock arrival windows for runs explicitly targeting Mars. | [NASA DONKI Data Browser](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) |

### Rovers, Spacecraft and Mission Planning
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **Perseverance Navcam 360° panorama at Jezero** | Provides ground-level panorama anchored using published rover localization. | [JPL PIA24422 Panorama](https://photojournal.jpl.nasa.gov/catalog/PIA24422) · [NASA M20 Localization Data](https://mars.nasa.gov/mars2020/) |
| **Curiosity boxwork 360° panorama at Gale** | Provides ground-level panorama and context for guided boxwork expedition. | [JPL PIA26559 Panorama](https://photojournal.jpl.nasa.gov/catalog/PIA26559) · [NASA Curiosity Location Map](https://mars.nasa.gov/msl/mission/where-is-the-rover/) |
| **Perseverance Cheyava Falls close-up & Three Forks depot map** | Provides ground imagery for Bright Angel and sample-site context for Three Forks scenario. | [NASA Cheyava Falls Image](https://photojournal.jpl.nasa.gov/) · [JPL Three Forks Map](https://mars.nasa.gov/mars2020/) |
| **Rover & helicopter tracks and landing coordinates** | Maps published positions and traverses of Curiosity, Perseverance, Ingenuity, Spirit, and Opportunity, plus historical landers. | [Curiosity Waypoints](https://mars.nasa.gov/) · [Perseverance Waypoints](https://mars.nasa.gov/) · [Ingenuity Flight Waypoints](https://mars.nasa.gov/) · [PDS Spirit & Opportunity Traverses](https://pds-geosciences.wustl.edu/) · [PDS Mars Landing Sites](https://pds-geosciences.wustl.edu/) |
| **Published spacecraft mission records** | Supplies mission dates, summaries, and reported travel distances for spacecraft profiles. | [NASA Ingenuity Flight Log](https://mars.nasa.gov/technology/helicopter/) |
| **Mars spacecraft & Phobos and Deimos 3D assets** | Displays agency-published geometry in spacecraft detail views and the Mars system. | [NASA Spacecraft Model Assets](https://nasa3d.arc.nasa.gov/) |
| **JPL Horizons ephemerides & NAIF SPICE kernels** | Positions orbiters and moons, draws dated orbital paths, and estimates geometric orbiter visibility for relay planning. | [JPL Horizons Ephemeris API](https://ssd.jpl.nasa.gov/horizons/) · [NAIF Mars Satellite Ephemeris](https://naif.jpl.nasa.gov/pub/naif/) |
| **InSight SEIS & Apollo passive-seismic archives** | Provides event context for Seismic Lab. Demonstration traces use real spectral envelopes. | [NASA PDS InSight SEIS](https://pds-geosciences.wustl.edu/missions/insight/seis.htm) · [NASA PDS Apollo Seismic Archive](https://pds-geosciences.wustl.edu/) |

---

## 2. NON-NASA DATA SOURCES
*Sources published by organizations outside NASA. `[Pyxis internal]` labels identify local catalogs/manifests and do not imply an external research dataset.*

### Map Imagery and Terrain
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **MRO Global CTX Mosaic V01, 5 m/px** | Supplies grayscale basemap and fine surface texture across globe, 2D map, and overview. | [Caltech CTX Mosaic & Downloads](http://murray-lab.caltech.edu/CTX/) · [Esri CTX Tile Service](https://www.arcgis.com/home/item.html) |
| **NASA Trek regional mosaics for Jezero and Gale** | Streams extra optical detail at Perseverance and Curiosity landing regions. | [USGS Jezero CTX Mosaic](https://astrogeology.usgs.gov/) · [USGS Jezero HiRISE Mosaic](https://astrogeology.usgs.gov/) · [NASA Trek Mosaic Product IDs [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **MRO HiRISE orthoimages & stereo terrain models** | Supplies selected high-resolution observation imagery, terrain, coverage footprints, and local analysis. | [HiRISE Stereo Terrain Catalog](https://www.uahirise.org/dtm/) · [Prepared Observation Index [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **USGS HRSC & MOLA blended elevation, 200 m** | Builds regional 3D terrain and supports terrain derivatives, routing, site screening, and radio line-of-sight. | [USGS Blended DEM](https://astrogeology.usgs.gov/search/map/Mars/Topography/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp) · [Esri Elevation Tile Service](https://www.arcgis.com/) |
| **Mars 2020 Jezero CTX DTM & Gale HiRISE DTM** | Supplies packaged elevation grids for Bright Angel, Three Forks, and Gale boxwork EVA planning. | [USGS Jezero CTX DTM](https://astrogeology.usgs.gov/) |
| **Mars Odyssey THEMIS daytime infrared mosaic** | Provides separate thermal-infrared tile source in map API. | [USGS Controlled THEMIS Mosaics](https://astrogeology.usgs.gov/) |
| **IAU & USGS planetary gazetteer** | Supplies official feature names, coordinates, and extents for search, region labels, and map context. | [USGS Gazetteer GIS Downloads](https://planetarynames.wr.usgs.gov/) |
| **HiRISE COLOR, Mars Express HRSC color & ExoMars CaSSIS** | Selected enhanced-color or multiband imagery collected for preparation archive. Prepared display coverage varies by product. | [USGS HiRISE COLOR Catalog](https://astrogeology.usgs.gov/) · [DLR HRSC Color Products](https://www.dlr.de/) |

### Geology and Resources
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **USGS Geologic Map of Mars, SIM 3292** | Supplies mapped rock units, contacts, and structures for geology overlay. Official unit descriptions label the legend. | [USGS SIM 3292 Map & Data](https://pubs.usgs.gov/sim/3292/) · [USGS Unit Attributes](https://astrogeology.usgs.gov/) · [ArcGIS Geology Tile Service](https://www.arcgis.com/) |
| **Mars Global Surveyor TES mineral grids** | Powers mineral overlays for olivine, feldspar, hematite, pyroxenes, and glass or sheet-silicate signatures. | [ASU Mars Data Archive](http://tes.asu.edu/) · [Pyxis Numeric Raster Manifest [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **TES albedo, thermal inertia, rock abundance & dust-cover index** | Supplies surface brightness and thermal-property overlays, plus regional estimates of rock coverage and fine surface dust. | [ASU Mars Data Archive](http://tes.asu.edu/) · [TES Rock-Abundance Study](https://doi.org/10.1029/2000JE001305) · [TES Dust-Index Data](https://doi.org/10.1029/2001JE001557) |
| **Mars Odyssey MONS hydrogen reconstruction** | Shows global neutron-derived water-equivalent hydrogen, including both poles. | [Wilson et al. Product Reference](https://doi.org/10.1016/j.icarus.2017.08.028) · [Pyxis Numeric Raster Manifest [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **SWIM4IMIM subsurface ice consistency composites** | Shows agreement among ice indicators for 0–1 m, 1–5 m, and deeper sensing bands. Informs landing and site evaluation. | [PSI SWIM Product Archive](https://swim.psi.edu/) |
| **JPL MRO120D gravity & Langlais crustal magnetic coefficients** | Provides gravity-anomaly and modeled magnetic-strength and component overlays. | [Langlais et al. (2019) Magnetic Model Coefficients](https://doi.org/10.1016/j.pss.2019.01.006) |
| **Landing candidates & science or resource sites** | Supplies field targets, mapped candidate polygons, and nearby evidence for landing and base-site evaluation. | [Pyxis Catalog with Per-Record Sources [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) · [Amazonis Candidate Landing Maps](https://astrogeology.usgs.gov/) · [Phlegra Study Sites](https://astrogeology.usgs.gov/) · [Landing Candidate Study](https://doi.org/10.1016/j.pss.2020.105089) |

### Weather, Sunlight and Radiation
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **NASA Mars Explorer EMARS model grids** | Provides historical climate analogues for wind, temperatures, pressure, dust and cloud optical depths, vapor, frost, snow, and relative UV. Feeds overlays and mission scenarios. | [EMARS Dataset Reference](https://doi.org/10.1002/2014JD022696) |
| **MRO MARCI Mars Dust Activity Database v1.1** | Supplies historical storm-footprint masks and dates for observing past dust activity. | [MDAD Data and Downloads](https://doi.org/10.1016/j.icarus.2019.03.013) |
| **Mars24 solar geometry & IAU solar radius** | Calculates local solar time, daylight, Sun position, and size. Terrain heights support shadow checks and solar planning. | [IAU Nominal Solar Radius](https://doi.org/10.1007/s10569-015-9640-3) |
| **NOAA GOES, SWPC & Sun–Earth L1 feeds** | Provides Earth-view context for X-rays, protons, flares, EUV, 10.7 cm solar flux, solar wind, magnetic field, and storm scales. | [NOAA GOES Data Feeds](https://www.swpc.noaa.gov/) · [NOAA Real-Time Solar Wind & Field](https://www.swpc.noaa.gov/) · [NOAA Storm Scales](https://www.swpc.noaa.gov/) |

### Rovers, Spacecraft and Mission Planning
| Data Used | How Pyxis Uses It | Original Reference Links |
| :--- | :--- | :--- |
| **Published spacecraft mission records** | Supplies mission dates, summaries, and reported travel distances for spacecraft profiles. | [Mission Records with Publisher Links [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **Mars spacecraft & Phobos and Deimos 3D assets** | Displays agency-published geometry in spacecraft detail views and the Mars system. | [Individual Pyxis Asset Source Register [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) · [Phobos and Deimos Asset Register [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **JPL Horizons ephemerides & NAIF SPICE kernels** | Positions orbiters and moons, draws dated orbital paths, and estimates geometric orbiter visibility for relay planning. | [Moon Kernel Source Register [Pyxis internal]](file:///c:/Users/Harshvardhan/NASA-2026-mars/packages/data/README.md) |
| **InSight SEIS & Apollo passive-seismic archives** | Provides event context for Seismic Lab. Demonstration traces use real spectral envelopes. | [InSight Marsquake Catalog (MQS)](https://doi.org/10.12686/a14) |
| **Minetti et al. human walking energy measurements** | Published slope-dependent walking-cost fit informs terrain-aware route energy and EVA resource estimates. | [Minetti et al. (2002) Walking Energy Study](https://doi.org/10.1152/japplphysiol.01177.2001) |
