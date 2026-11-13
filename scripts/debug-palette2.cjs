const fs = require('fs'); const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync('raw/referencias/f0bac687-9edc-4d41-a5b7-f9ff80eed522.png'));
const { width, height, data } = png;
const at=(x,y)=>{const i=(y*width+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]]};
const samples=[]; for(let x=0;x<width;x+=3){samples.push(at(x,0),at(x,height-1));} for(let y=0;y<height;y+=3){samples.push(at(0,y),at(width-1,y));}
const med=(v)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]};
const bg=[0,1,2].map(c=>med(samples.map(k=>k[c])));
function alphaAt(r,g,b,a){if(a<8)return 0;const dr=r-bg[0],dg=g-bg[1],db=b-bg[2];const d=Math.sqrt(dr*dr+dg*dg+db*db);return Math.max(0,Math.min(1,(d-10)/22));}
for (const bucket of [8,12,16,24,32]) {
  const palSamples=[]; for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){const [r,g,b,a]=at(x,y); if(alphaAt(r,g,b,a)>0.45) palSamples.push([r,g,b]);}
  const buckets=new Map();
  for(const [r,g,b] of palSamples){const key=(Math.floor(r/bucket)<<16)|(Math.floor(g/bucket)<<8)|Math.floor(b/bucket); let e=buckets.get(key); if(!e){e={r:0,g:0,b:0,n:0};buckets.set(key,e);} e.r+=r;e.g+=g;e.b+=b;e.n++;}
  const palette=[...buckets.values()].sort((a,b)=>b.n-a.n).slice(0,160).map(e=>[Math.round(e.r/e.n),Math.round(e.g/e.n),Math.round(e.b/e.n)]);
  const reds=palette.filter(([r,g,b])=>r>80&&r>g*1.4&&r>b*1.4);
  const whites=palette.filter(([r,g,b])=>r>200&&g>200&&b>200);
  const darks=palette.filter(([r,g,b])=>r<40&&g<40&&b<40);
  console.log('bucket',bucket,'palette',palette.length,'reds',reds.length,'whites',whites.length,'darks',darks.length,'sampleReds',reds.slice(0,6));
}
