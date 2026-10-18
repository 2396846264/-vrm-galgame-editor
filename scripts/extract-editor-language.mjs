import fs from 'node:fs';
import {parseAst} from 'rollup/parseAst';
const keys=new Set(),chinese=/[\u3400-\u9fff]/;
function add(s){s=s.trim();if(chinese.test(s)&&s.length<1000&&!/window\.|document\.|=>|throw Error|const |function |assert\(/.test(s))keys.add(s);}
function html(s){for(const m of s.matchAll(/(?:title|placeholder|aria-label|alt)="([^"\uE000]*)"/g))add(m[1]);for(const m of s.replace(/<[^>]*>/g,'\uE000').split(/\uE000|\uE001|\{\d+\}/))add(m);}
function walk(n){if(!n||typeof n!=='object')return;
 if(n.type==='Literal'&&typeof n.value==='string'){if(/<\/?[a-z][\s\S]*>/i.test(n.value))html(n.value);else add(n.value);}
 if(n.type==='TemplateLiteral'){const s=n.quasis.reduce((s,q,i)=>s+(i?`{${i-1}}`:'')+(q.value.cooked||''),'');if(/<\/?[a-z][\s\S]*>/i.test(s))html(s);else add(s);}
 for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
}
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.js')&&!f.startsWith('editor-language'))){walk(parseAst(fs.readFileSync('src/'+file,'utf8')));}
for(const file of fs.readdirSync('Desktop').filter(f=>f.endsWith('.cs')&&!/Smoke|Protected|GameResource|AgentBridge/.test(f))){const s=fs.readFileSync('Desktop/'+file,'utf8');for(const m of s.matchAll(/"((?:[^"\\]|\\.)*[\u3400-\u9fff](?:[^"\\]|\\.)*)"/g))if(!m[1].includes('\\'))add(m[1]);}
fs.writeFileSync('scripts/editor-language-source.json',JSON.stringify([...keys].sort(),null,2));console.log(keys.size+' source UI strings');
