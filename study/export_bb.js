const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname, '..', 'src', 'core.js'),'utf8').replace('else root.MurphyCore = api;','else root.MurphyCore = api; root.__pc = prismCorners;');
const m={exports:{}};const w={};const C=new Function('module','exports','window',src+';return typeof MurphyCore!=="undefined"?MurphyCore:(typeof module.exports.build==="function"?module.exports:window.MurphyCore);')(m,m.exports,w)||w.MurphyCore||m.exports;
const ov = JSON.parse(process.argv[2]||'{}');
const M=C.build(C.normParams(Object.assign({},C.defaults,ov)));
const out=M.parts.map(p=>{let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const s of p.solids){for(const c of w.__pc(s)){for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],c[k]);hi[k]=Math.max(hi[k],c[k]);}}}
 return {mark:p.mark,name:p.name,kind:p.kind,hw:!!p.hw,bed:!!p.bed,bb:[...lo,...hi].map(v=>+v.toFixed(1))};});
fs.writeFileSync(process.argv[3]||'parts.json', JSON.stringify({G:{yC:M.G.yC,yFb:M.G.yFb,yF:M.G.yF,zBm0:M.G.zBm0,zBm1:M.G.zBm1,zTopB:M.G.zTopB,zTop:M.G.zTop,xJ:M.G.xJ,xB:M.G.xB,zF1:M.G.zF1,pinY:M.G.pinY,flapZ:M.G.flapZ}, parts:out}));
console.log(out.length);
