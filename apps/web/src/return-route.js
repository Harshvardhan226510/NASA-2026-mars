export const RETURN_ROUTE={name:'Return',color:'#d1a5ed',description:'Purple dashed · B → return point (A unless changed). Independently minimizes modeled walking energy on the same terrain grid; no science detours. Uphill and downhill costs differ.'};
export function returnRouteEntry(result){
 if(!result)return null;
 if(!result.metadata?.round_trip&&!result.return_route)return ['return_route',RETURN_ROUTE,{status:'not_included',reason:'This plan has no return journey. Enable round trip in the Marswalk mission plan and recalculate.'}];
 return ['return_route',RETURN_ROUTE,result.return_route??{status:'failed',reason:'No return route is saved. Recalculate the round trip.'}];
}
