// IAU 2012 B2 (au) and IAU 2015 B3 (nominal solar radius), SI metres.
// https://arxiv.org/abs/1510.07674
export const AU_METERS=149597870700;
export const SUN_RADIUS_METERS=695700000;
export const SUN_TEXTURE_SIZE=256;
export function sunModel(sun){
 const {distance_au,subsolar_lon,declination}=sun??{};
 if(![distance_au,subsolar_lon,declination].every(Number.isFinite)||distance_au<=SUN_RADIUS_METERS/AU_METERS||Math.abs(declination)>90)throw Error('Invalid Sun geometry.');
 const distance_m=distance_au*AU_METERS,lon=subsolar_lon*Math.PI/180,dec=declination*Math.PI/180;
 // Mars24 declination is the direction of the solar ray above the equator.
 // This is a centre-to-centre vector, not ellipsoid altitude/latitude.
 return {distance_m,position:[distance_m*Math.cos(dec)*Math.cos(lon),distance_m*Math.cos(dec)*Math.sin(lon),distance_m*Math.sin(dec)],diameter_m:2*SUN_RADIUS_METERS,angular_diameter_deg:2*Math.asin(SUN_RADIUS_METERS/distance_m)*180/Math.PI};
}
