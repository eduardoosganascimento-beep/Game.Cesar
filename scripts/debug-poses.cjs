const fs=require('fs'); const {PNG}=require('pngjs');
const names=['idle-1','run-2','jump-1','jump-4','throw-1','throw-2','throw-3','throw-4','melee-2','melee-3','hurt-2','death-2'];
const S=5, pad=6;
const imgs=names.map(n=>PNG.sync.read(fs.readFileSync('public/assets/sprites/player/'+n+'.png')));
const w=Math.max(...imgs.map(i=>i.width))*S, h=Math.max(...imgs.map(i=>i.height))*S;
const cols=4, rows=Math.ceil(names.length/cols);
const W=w*cols+pad*(cols+1), H=h*rows+pad*(rows+1);
const out=new PNG({width:W,height:H}); out.data.fill(0);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;out.data[i]=25;out.data[i+1]=32;out.data[i+2]=30;out.data[i+3]=255;}
imgs.forEach((img,idx)=>{const ox=pad+(idx%cols)*(w+pad), oy=pad+Math.floor(idx/cols)*(h+pad); const sw=img.width*S, sh=img.height*S; for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const sx0=Math.floor(x/S), sy0=Math.floor(y/S); const si=(sy0*img.width+sx0)*4;if(img.data[si+3]===0)continue;const ti=((oy+y)*W+(ox+x))*4;out.data[ti]=img.data[si];out.data[ti+1]=img.data[si+1];out.data[ti+2]=img.data[si+2];out.data[ti+3]=255;}});
fs.writeFileSync('public/assets/sprites/player/debug-poses.png',PNG.sync.write(out));
console.log('ok',W,H);
