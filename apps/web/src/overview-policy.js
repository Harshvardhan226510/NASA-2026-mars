const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// The overview already resolves a whole globe at screen scale. Switch by view
// scale, uniformly across the viewport, rather than by individual tile arrival.
export const globeDetailWeight=height=>1-smooth(Math.log(1_200_000),Math.log(3_200_000),Math.log(Math.max(1,height)));
export const flatDetailWeight=zoom=>smooth(3,5,zoom);
export function elevationLayerWeights(detail,total=.7){
 const fine=total*Math.max(0,Math.min(1,detail));
 return {fine,overview:(total-fine)/(1-fine)};
}
