const cheyava='https://science.nasa.gov/resource/perseverance-finds-a-rock-with-leopard-spots/';
const depot='https://www.jpl.nasa.gov/images/pia25682-perseverances-three-forks-sample-depot-map/';
const boxwork='https://www.jpl.nasa.gov/images/pia26559-curiositys-first-360-degree-view-of-boxwork-patterns/';

export const EVA_SCENARIOS=[
 {
  id:'bright-angel',name:'Read the rocks at Bright Angel',region:'Jezero · Perseverance',start:[77.30104,18.49190],goal:[77.30650,18.49900],
  objective:'Document how veins, spots and host rock relate across the outcrop. Look for textures that could distinguish fluid-driven alteration from other processes.',
  evidence:'Perseverance observed calcium sulfate veins and millimetre-scale spots in Cheyava Falls. Their origin remains a research question.',
  source:{title:'NASA · Cheyava Falls and the WATSON observations',url:cheyava},photo:{title:'Perseverance WATSON close-up',url:cheyava,image:'/eva-evidence/cheyava-falls.webp',credit:'NASA/JPL-Caltech/MSSS'},
  stops:[
   {name:'Bright Angel approach',point:[77.30324,18.49300],question:'Where do lighter outcrops start along the channel?',equipment:'Context camera, field notebook',expected:'A sequence of georeferenced contact photos with notes on bedding and vein orientation.',minutes:15},
   {name:'Cheyava Falls study area',point:[77.30513,18.49744],question:'Do spot textures and vein relationships repeat in nearby exposures?',equipment:'Macro camera, scale card, hand lens',expected:'Scaled close-ups of spotted and unspotted rock, with relative positions recorded.',minutes:30}
  ]
 },
 {
  id:'three-forks',name:'Survey the Three Forks depot',region:'Jezero · Perseverance',start:[77.39950,18.45050],goal:[77.40500,18.45350],
  objective:'Rehearse how a crew would document depot access and reconcile field observations with the published sample locations.',
  evidence:'Perseverance deposited ten tubes in a mapped zigzag pattern. The stations are area survey points. Individual tubes require the published depot map and local observation.',
  source:{title:'JPL · Three Forks sample depot map',url:depot},photo:{title:'Perseverance’s published depot map',url:depot,image:'/eva-evidence/three-forks.webp',credit:'NASA/JPL-Caltech'},
  stops:[
   {name:'Depot approach survey',point:[77.40176,18.45007],question:'What surface features would help a crew identify the depot approach?',equipment:'Depot map, context camera',expected:'A repeatable approach description and images of useful reference features.',minutes:20},
   {name:'Depot context survey',point:[77.40310,18.45220],question:'What information would verify a visually identified tube before any handling?',equipment:'Depot map, camera, scale card',expected:'A sample identification checklist covering location, imagery and uncertainty.',minutes:25}
  ]
 },
 {
  id:'gale-boxwork',name:'Trace Mount Sharp’s boxwork ridges',region:'Gale · Curiosity',start:[137.38772,-4.79689],goal:[137.38204,-4.81202],
  objective:'Compare ridge crests, surrounding rock and the hollows to investigate whether mineral cement in fractures controlled the relief.',
  evidence:'Curiosity Mastcam documented networks of low hardened ridges. Groundwater moving through ancient fractures is a published interpretation.',
  source:{title:'JPL · Curiosity’s boxwork panorama',url:boxwork},photo:{title:'Curiosity Mastcam boxwork panorama',url:boxwork,image:'/eva-evidence/gale-boxwork.webp',credit:'NASA/JPL-Caltech/MSSS'},
  stops:[
   {name:'Ridge texture survey',point:[137.38211,-4.80191],question:'How do crest textures compare with adjacent bedrock?',equipment:'Context camera, scale card, hand lens',expected:'Paired texture images and notes on ridge width and continuity.',minutes:25},
   {name:'Hollow and ridge contact',point:[137.37984,-4.80689],question:'Do ridge orientations or intersections suggest multiple fracture sets?',equipment:'Camera, orientation scale, field notebook',expected:'An annotated sketch and measured relative orientations.',minutes:25}
  ]
 }
];

export function scenarioTargets(scenario){
 return scenario.stops.map((stop,index)=>({id:`eva-${scenario.id}-${index+1}`,name:stop.name,point:[...stop.point],score:100}));
}
