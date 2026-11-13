const fs = require('fs'); const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync('raw/referencias/f0bac687-9edc-4d41-a5b7-f9ff80eed522.png'));
const { width, height, data } = png;
const at=(x,y)=>{const i=(y*width+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]]};
const samples=[]; for(let x=0;x<width;x+=3){samples.push(at(x,0),at(x,height-1));} for(let y=0;y<height;y+=3){samples.push(at(0,y),at(width-1,y));}
const med=(v)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]};
const bg=[0,1,2].map(c=>med(samples.map(k=>k[c])));
console.log('bg',bg,'size',width,height);
function alphaAt(r,g,b,a){if(a<8)return 0;const dr=r-bg[0],dg=g-bg[1],db=b-bg[2];const d=Math.sqrt(dr*dr+dg*dg+db*db);return Math.max(0,Math.min(1,(d-10)/22));}
const paletteSamples=[]; let masked=0; const families=new Map();
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const [r,g,b,a]=at(x,y); if(alphaAt(r,g,b,a)>0.45){masked++; if(x%3===0&&y%3===0)paletteSamples.push([r,g,b]); const fam = r>80&&r>g*1.5&&r>b*1.5?'red':(r<30&&g<30&&b<30?'black':(r>200&&g>200&&b>200?'white':'other')); families.set(fam,(families.get(fam)||0)+1);}}
console.log('masked',masked,'families',Object.fromEntries(families),'samples',paletteSamples.length);
const counts=new Map(); for(const [r,g,b] of paletteSamples){const key=(r<<16)|(g<<8)|b; counts.set(key,(counts.get(key)||0)+1);}
const entries=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
console.log('unique',entries.length);
console.log('top30:', entries.slice(0,30).map(([k,n])=>[ (k>>16)&255,(k>>8)&255,k&255,n ]));
console.log('reds in top110:', entries.slice(0,110).filter(([k])=>{const r=(k>>16)&255,g=(k>>8)&255,b=k&255;return r>80&&r>g*1.5&&r>b*1.5;}).length);
