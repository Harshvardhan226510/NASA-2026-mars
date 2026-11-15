const nasa=slug=>`https://science.nasa.gov/mission/${slug}/`;
const chronology='https://science.nasa.gov/wp-content/uploads/2024/03/44747_MSL-Landing.pdf';
const cnsa='https://www.cnsa.gov.cn/english/n6465652/n6465653/c10003737/content.html';
const exomars='https://www.esa.int/Newsroom/Press_Releases/ExoMars_on_its_way_to_solve_the_Red_Planet_s_mysteries';
const marsExpress='https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/The_mission';
const US='NASA · United States',SU='Soviet space programme · USSR';
const mission=(name,lead,launch,summary,source)=>({name,lead,launch,summary,source});

export const SPACECRAFT_MISSIONS=Object.freeze({
 msl:mission('Mars Science Laboratory',US,'2011-11-26','Investigates ancient habitability and the geology of Gale Crater.',nasa('msl-curiosity')),
 mars2020:mission('Mars 2020',US,'2020-07-30','Explores Jezero Crater and collects samples for possible return to Earth.',nasa('mars-2020-perseverance')),
 spirit:mission('Mars Exploration Rover A',US,'2003-06-10','Investigated rocks and past water at Gusev Crater.',nasa('mer-spirit')),
 opportunity:mission('Mars Exploration Rover B',US,'2003-07-08','Investigated water-altered terrain at Meridiani Planum.',nasa('mer-opportunity')),
 viking1:mission('Viking 1',US,'1975-08-20','Combined orbital mapping with experiments on the Martian surface.',nasa('viking-1')),
 viking2:mission('Viking 2',US,'1975-09-09','Combined an orbiter with a science lander at Utopia Planitia.',nasa('viking-2')),
 pathfinder:mission('Mars Pathfinder',US,'1996-12-04','Demonstrated Mars landing and mobile exploration with Sojourner.',nasa('mars-pathfinder')),
 phoenix:mission('Phoenix',US,'2007-08-04','Examined northern polar soil, water ice and atmospheric conditions.',nasa('mars-phoenix')),
 insight:mission('InSight',US,'2018-05-05','Used seismic and geophysical measurements to investigate the interior of Mars.',nasa('insight')),
 tianwen1:mission('Tianwen-1','CNSA · China','2020-07-23','Combined orbital surveying, a landing platform and the Zhurong rover.',cnsa),
 beagle2:mission('Beagle 2 / Mars Express','United Kingdom-led Beagle 2 team · carried by ESA','2003-06-02','A British surface-science lander delivered by Mars Express.',marsExpress),
 exomars:mission('ExoMars 2016','ESA and Roscosmos · Europe / Russia','2016-03-14','Combined atmospheric observations with the Schiaparelli landing demonstration.',exomars),
 mars2:mission('Mars 2',SU,'1971-05-19','An orbiter and lander mission; the lander impacted Mars.',chronology),
 mars3:mission('Mars 3',SU,'1971-05-28','An orbiter and lander mission; surface transmission ended shortly after landing.',chronology),
 mars6:mission('Mars 6',SU,'1973-08-05','A flyby carrier and descent probe; contact was lost near landing.',chronology),
 mpl:mission('Mars Polar Lander',US,'1999-01-03','A polar landing mission that was lost during arrival.',nasa('mars-polar-lander-deep-space-2')),
 ds2:mission('Deep Space 2',US,'1999-01-03','Two subsurface probes carried by Mars Polar Lander; neither established contact.',nasa('mars-polar-lander-deep-space-2')),
 mro:mission('Mars Reconnaissance Orbiter',US,'2005-08-12','Studies the surface and atmosphere and relays data from surface missions.',nasa('mars-reconnaissance-orbiter')),
 odyssey:mission('2001 Mars Odyssey',US,'2001-04-07','Maps Mars in infrared and gamma rays and relays surface-mission communications.',nasa('odyssey')),
 mars_express:mission('Mars Express','ESA · Europe','2003-06-02','Studies the surface, subsurface and atmosphere of Mars.',marsExpress),
 hope:mission('Emirates Mars Mission','UAE Space Agency / MBRSC · United Arab Emirates','2020-07-19','Studies Martian weather and atmospheric circulation.', 'https://www.mhi.com/notice/notice_200720.html'),
 maven:mission('MAVEN',US,'2013-11-18','Investigated the upper atmosphere and atmospheric escape.',nasa('maven')),
 mgs:mission('Mars Global Surveyor',US,'1996-11-07','Mapped Martian topography, surface properties and the magnetic field.',nasa('mars-global-surveyor')),
 mom:mission('Mars Orbiter Mission','ISRO · India','2013-11-05','Demonstrated interplanetary operations and investigated the surface and atmosphere.','https://www.isro.gov.in/media_isro/pdf/Missions/PSLVC25/Mars-atlas-MOM.pdf'),
 mariner9:mission('Mariner 9',US,'1971-05-30','Carried out the first orbital reconnaissance of Mars.',nasa('mariner-9')),
 mars5:mission('Mars 5',SU,'1973-07-25','A short-lived orbital investigation of the Martian environment.',chronology),
 phobos2:mission('Phobos 2',SU,'1988-07-12','Studied Mars and approached Phobos before contact was lost.',chronology)
});

export const SPACECRAFT_MISSION_IDS=Object.freeze({
 curiosity:'msl',perseverance:'mars2020',ingenuity:'mars2020',spirit:'spirit',spirit_platform:'spirit',opportunity:'opportunity',opportunity_platform:'opportunity',
 viking1:'viking1',viking1_orbiter:'viking1',viking2:'viking2',viking2_orbiter:'viking2',pathfinder:'pathfinder',sojourner:'pathfinder',phoenix:'phoenix',insight:'insight',
 tianwen1_lander:'tianwen1',zhurong:'tianwen1',tianwen1_orbiter:'tianwen1',beagle2:'beagle2',schiaparelli:'exomars',tgo:'exomars',
 mars2:'mars2',mars2_orbiter:'mars2',prop_m_mars2:'mars2',mars3:'mars3',mars3_orbiter:'mars3',prop_m_mars3:'mars3',mars6:'mars6',mars_polar_lander:'mpl',ds2_amundsen:'ds2',ds2_scott:'ds2',
 mro:'mro',odyssey:'odyssey',mars_express:'mars_express',hope:'hope',maven:'maven',mgs:'mgs',mom:'mom',mariner9:'mariner9',mars5_orbiter:'mars5',phobos2:'phobos2'
});

export const SPACECRAFT_TRAVEL=Object.freeze({
 curiosity:{kind:'surface',km:38.48016,qualifier:'Published odometer · Sol 5045',source:'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints_current.json',sol:5045,checked:'2026-10-22'},
 perseverance:{kind:'surface',km:45.223649,qualifier:'Published odometer · Sol 2009',source:'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json',sol:2009,checked:'2026-10-22'},
 spirit:{kind:'surface',km:7.73,qualifier:'Final mission total',source:nasa('mer-spirit')},
 opportunity:{kind:'surface',km:45.16,qualifier:'Final mission total',source:nasa('mer-opportunity')},
 sojourner:{kind:'surface',km:.1,qualifier:'Approximately 100 m over its mission',source:'https://science.nasa.gov/planetary-science/programs/discovery/'},
 zhurong:{kind:'surface',km:1.921,qualifier:'Reported by CNSA on 24 April 2023; not live tracking',source:cnsa},
 ingenuity:{kind:'flight',km:17,qualifier:'Approximately · 72 flights ending 18 January 2024',source:'https://science.nasa.gov/wp-content/uploads/2024/06/ingenuity-helicopter-flight-log.pdf'}
});

export const MISSION_CRUISES=Object.freeze({
 mro:{kind:'cruise',km:500000000,qualifier:'Approximate published Earth-to-Mars cruise length; excludes later orbits',source:'https://science.nasa.gov/wp-content/uploads/2024/03/44745_mro-arrival.pdf'},
 odyssey:{kind:'cruise',km:460000000,qualifier:'Published pre-launch cruise estimate; excludes later orbits',source:'https://science.nasa.gov/wp-content/uploads/2024/03/44750_odysseylaunch.pdf'},
 maven:{kind:'cruise',km:711000000,qualifier:'Approximate Earth-to-Mars cruise; excludes later orbits',source:'https://www.nasa.gov/news-release/nasa-shares-what-maven-spacecraft-has-seen-in-its-first-few-weeks-at-mars/'},
 mgs:{kind:'cruise',km:750000000,qualifier:'Approximate Earth-to-Mars cruise; excludes later orbits',source:'https://pds.nasa.gov/data/mgs-m-moc-4-sampler-v1.0/mgs_0001/document/volinfo.htm'},
 exomars:{kind:'cruise',km:496000000,qualifier:'Published cruise estimate to Mars; excludes later operations',source:'https://www.esa.int/Enabling_Support/Operations/Ready_for_the_Red_Planet'},
 tianwen1:{kind:'cruise',km:475000000,qualifier:'Approximate Earth-to-Mars cruise; excludes later operations',source:cnsa},
 mars_express:{kind:'cruise',km:400000000,qualifier:'Approximate Earth-to-Mars cruise; excludes later orbits',source:'https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_Express_Frequently_Asked_Questions_FAQs'},
 beagle2:{kind:'cruise',km:400000000,qualifier:'Approximate carrier cruise to Mars; not surface travel',source:'https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_Express_Frequently_Asked_Questions_FAQs'}
});
