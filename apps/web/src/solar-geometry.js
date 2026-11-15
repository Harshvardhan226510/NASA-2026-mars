// NASA GISS Mars24 / Allison & McEwen (2000), revised NASA equations, 2025.
export const SOLAR_SOURCE='https://www.giss.nasa.gov/tools/mars24/help/algorithm.html';
const rad=Math.PI/180,sin=x=>Math.sin(x*rad),cos=x=>Math.cos(x*rad),mod=(x,n)=>((x%n)+n)%n;
export function marsSun(at){
 const utc=Number(new Date(at));if(!Number.isFinite(utc)||utc<Date.parse('2000-01-01T00:00Z')||utc>Date.parse('2030-12-31T23:59Z'))throw Error('Solar calculation supports 2000–2030.');
 const leap=utc>=Date.parse('2017-01-01')?37:utc>=Date.parse('2015-07-01')?36:utc>=Date.parse('2012-07-01')?35:utc>=Date.parse('2009-01-01')?34:utc>=Date.parse('2006-01-01')?33:32;
 const jd=2440587.5+utc/86400000+(leap+32.184)/86400,d=jd-2451545,M=19.3871+.52402073*d,fms=270.3871+.524038496*d;
 const perturb=[[.0071,2.2353,49.409],[.0057,2.7543,168.173],[.0039,1.1177,191.837],[.0037,15.7866,21.736],[.0021,2.1354,15.704],[.002,2.4694,95.528],[.0018,32.8493,49.095]].reduce((s,[a,t,p])=>s+a*cos(.985626*d/t+p),0);
 const centre=(10.691+3e-7*d)*sin(M)+.623*sin(2*M)+.05*sin(3*M)+.005*sin(4*M)+.0005*sin(5*M)+perturb,ls=mod(fms+centre,360),eot=2.861*sin(2*ls)-.071*sin(4*ls)+.002*sin(6*ls)-centre;
 const mst=mod(24*((jd-2451549.5)/1.0274912517+44796-.0009626),24),declination=Math.asin(.42565*sin(ls))/rad+.25*sin(ls),west=mod(mst*15+eot+180,360),distance=1.52367934*(1.00436-.09309*cos(M)-.004336*cos(2*M)-.00031*cos(3*M)-.00003*cos(4*M));
 return {at:new Date(utc).toISOString(),ls,mst,eot,declination,subsolar_lon:mod(-west+180,360)-180,distance_au:distance,tt_minus_utc_s:leap+32.184};
}
export function solarAt(sun,lon,lat){
 if(!sun||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90)return null;
 // Atlas coordinates are planetocentric; Mars24's local angles are planetographic.
 const phi=Math.atan(Math.tan(lat*rad)*(3396190/3376200)**2)/rad,hour=sun.subsolar_lon-lon;
 const cosine=Math.max(-1,Math.min(1,sin(sun.declination)*sin(phi)+cos(sun.declination)*cos(phi)*cos(hour))),elevation=Math.asin(cosine)/rad;
 const azimuth=mod(Math.atan2(sin(hour),cos(phi)*Math.tan(sun.declination*rad)-sin(phi)*cos(hour))/rad,360);
 return {elevation,azimuth,illumination:Math.max(0,cosine),local_true_hour:mod(sun.mst+lon/15+sun.eot/15,24)};
}

export function solarFlux(distance_au){
 if(!Number.isFinite(distance_au)||distance_au<=0)return 590;
 return 1361/(distance_au*distance_au);
}

export function daylightHours(lat,declination){
 if(!Number.isFinite(lat)||!Number.isFinite(declination))return 12.33;
 const phi=Math.atan(Math.tan(lat*rad)*(3396190/3376200)**2);
 const cosArg=-Math.tan(phi)*Math.tan(declination*rad);
 if(cosArg<=-1)return 24.66;
 if(cosArg>=1)return 0;
 return (24*Math.acos(cosArg)/Math.PI)*1.02749;
}

export function solarPanelMetrics(solar,flux){
 if(!solar)return null;
 const elev=solar.elevation,isDay=elev>0;
 const direct=isDay?flux*Math.sin(elev*rad):0;
 const diffuse=isDay?flux*0.12*Math.max(0.1,Math.sin(elev*rad)):(elev>-6?flux*0.02:0);
 const total=Math.round(direct+diffuse);
 const shadowRatio=elev>0.5?1/Math.tan(elev*rad):null;
 return {isDay,directFlux:Math.round(direct),diffuseFlux:Math.round(diffuse),totalSurfaceFlux:total,shadowRatio};
}
