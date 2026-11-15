import {coverageGrid} from './comms-model.js';

let grid;
self.onmessage=({data:{terrain,scenario,id}})=>{
 if(terrain)grid=terrain;
 try{
  const result=coverageGrid(grid,scenario);
  self.postMessage({id,result},[result.states.buffer,result.margins.buffer]);
 }catch(error){self.postMessage({id,error:error.message});}
};
