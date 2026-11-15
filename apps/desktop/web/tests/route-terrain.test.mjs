import test from 'node:test';
import assert from 'node:assert/strict';
import {missionWindow} from '../src/route-geometry.js';
import {routeTilePlan} from '../src/route-tile-plan.js';
import {globalRouteGrid} from '../src/route-terrain.js';
import {geographicBounds} from '../src/planet-grid.js';
import {TileQueue} from '../src/tile-queue.js';

test('terrain tile selection follows actual nodes across the dateline and at both poles',()=>{
 for(const points of [[[179,20],[-178,20]],[[0,89.8],[180,89.8]],[[0,-89.8],[180,-89.8]]]){
  const spec=missionWindow(points,100),plan=routeTilePlan(spec),keys=new Set(plan.tiles.map(a=>`${a.z}/${a.y}/${a.x}`));
  assert.equal(keys.size,plan.tiles.length);
  for(const a of plan.tiles){assert.ok(a.x>=0&&a.x<2**(a.z+1));assert.ok(a.y>=0&&a.y<2**a.z);}
  for(let r=0;r<spec.size;r+=17)for(let c=0;c<spec.size;c+=17)assert.ok(keys.has(plan.key(spec.point(r,c))));
  if(points[0][1]===20)assert.ok(plan.tiles.length<25,'dateline must not load a full longitude band');
  else assert.ok(plan.tiles.length>36,'polar windows are allowed to touch more than the old 36-tile cap');
 }
});
test('a route wider than 150 km loads its measured terrain with bounded concurrency and reuses it',async()=>{
 const queue=new TileQueue(3,48),calls=[],progress=[],points=[[-77,-8],[-68,-8]];let active=0,peak=0;
 const loadTile=async(x,y,z)=>{calls.push([x,y,z]);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;return {grid:new Float32Array(513*513).fill(-3500),width:513,bounds:geographicBounds(x,y,z)};};
 const grid=await globalRouteGrid(points,100,undefined,m=>progress.push(m),{loadTile,queue});
 assert.ok(grid.source.window_width_m>150000);assert.equal(grid.source.requested_spacing_m,100);assert.equal(grid.source.unknown_cells,0);assert.ok(grid.rows>129&&grid.rows<=513);assert.ok(peak<=3&&peak>1);
 assert.equal(calls.length,grid.source.terrain_tiles);assert.ok(grid.elevation_matrix.every(row=>row.every(h=>h===-3500)));
 assert.ok(progress.some(s=>s.startsWith('Reading measured terrain')));const loaded=calls.length;
 await globalRouteGrid(points,100,undefined,undefined,{loadTile,queue});assert.equal(calls.length,loaded);
 assert.ok(Buffer.byteLength(JSON.stringify(grid))<4_000_000);
});
test('unknown regional cells stay blocked and cancellation stops a queued terrain read',async()=>{
 const queue=new TileQueue(2,48),points=[[179,20],[-178,20]],loadTile=async(x,y,z)=>({grid:new Float32Array(513*513).fill(-3000),width:513,bounds:geographicBounds(x,y,z),fallback:x===0});
 const grid=await globalRouteGrid(points,200,undefined,undefined,{loadTile,queue});assert.ok(grid.source.unknown_cells>0);assert.ok(grid.elevation_matrix.flat().includes(null));
 const controller=new AbortController();controller.abort();await assert.rejects(globalRouteGrid(points,200,controller.signal,undefined,{loadTile,queue}),{name:'AbortError'});
 await assert.rejects(globalRouteGrid(points,200,undefined,undefined,{queue:new TileQueue(3),loadTile:async(x,y,z)=>({...await loadTile(x,y,z),fallback:true})}),/coarse MOLA/);
});
test('local regional routing uses 50 m search cells and explicitly discloses its coarser measured source',async()=>{
 const points=[[77.4,18.45],[77.41,18.46]],queue=new TileQueue(3,48);
 const loadTile=async(x,y,z)=>({grid:new Float32Array(513*513).fill(-3000),width:513,bounds:geographicBounds(x,y,z)});
 const grid=await globalRouteGrid(points,50,undefined,undefined,{loadTile,queue});
 assert.equal(grid.resolution_meters,50);assert.equal(grid.source.requested_spacing_m,50);
 assert.ok(grid.source.sample_m>=200);assert.equal(grid.source.interpolated,true);assert.match(grid.source.warning,/do not provide 50 m measured terrain detail/);
 assert.equal(grid.source.unknown_cells,0);assert.ok(grid.rows<=513);
 const wide=await globalRouteGrid([[77.4,18.45],[78.4,18.45]],50,undefined,undefined,{loadTile,queue});
 assert.ok(wide.resolution_meters>50);assert.ok(wide.rows<=513);assert.equal(wide.source.requested_spacing_m,50);
});
