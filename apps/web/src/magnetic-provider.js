// Cesium 1.145 consumes requestImage(...).then(...), including for already
// prepared canvas textures. Keep that asynchronous contract on cached images.
export function magneticImageryProvider(C,ellipsoid,images){
 const scheme=new C.GeographicTilingScheme({ellipsoid});
 return {tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:512,tileHeight:512,minimumLevel:0,maximumLevel:0,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit('Langlais et al. (2019) · MGS/MAVEN crustal magnetic model'),getTileCredits(){return undefined;},pickFeatures(){return undefined;},async requestImage(x){return images[x];}};
}
