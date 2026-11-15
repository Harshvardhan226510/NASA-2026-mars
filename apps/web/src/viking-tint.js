export function tintOpticalTile(pixels,width,height,tone,side){
 const influence=new Float32Array(side*side);
 for(let i=0;i<influence.length;i++)influence[i]=.38+.54*Math.max(0,Math.min(1,(tone[i*4]/Math.max(1,tone[i*4+2])-1)*.8));
 for(let y=0;y<height;y++){
  const v=y*(side-1)/Math.max(1,height-1),row=Math.floor(v),nextRow=Math.min(side-1,row+1),fy=v-row;
  for(let x=0;x<width;x++){
   const p=(y*width+x)*4;if(!pixels[p+3])continue;
   const u=x*(side-1)/Math.max(1,width-1),col=Math.floor(u),nextCol=Math.min(side-1,col+1),fx=u-col;
   const a=influence[row*side+col]*(1-fx)+influence[row*side+nextCol]*fx,b=influence[nextRow*side+col]*(1-fx)+influence[nextRow*side+nextCol]*fx,strength=a*(1-fy)+b*fy;
   const lum=.2126*pixels[p]+.7152*pixels[p+1]+.0722*pixels[p+2];
   pixels[p]=lum*(1+.30*strength);pixels[p+1]=lum*(1-.047*strength);pixels[p+2]=lum*(1-.39*strength);
  }
 }
}
