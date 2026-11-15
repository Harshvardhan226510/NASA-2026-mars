export const geographicBounds=(x,y,z)=>{const span=180/2**z;return [-180+x*span,90-(y+1)*span,-180+(x+1)*span,90-y*span];};
export const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
