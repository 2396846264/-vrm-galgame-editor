import {defineConfig} from 'vite';
import {editorLanguagePlugin} from './scripts/editor-language-plugin.mjs';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const approved = {'three':'0.180.0','@pixiv/three-vrm':'3.5.5','@pixiv/three-vrm-animation':'3.5.5',
  '@moeru/three-mmd':'0.0.5','mmd-parser':'1.1.4','ammojs-typed':'1.1.0','pdfjs-dist':'6.3.289'};
function componentManifest(){return {name:'approved-commercial-components',generateBundle(_options,bundle){
  const used=new Map();
  for(const chunk of Object.values(bundle))if(chunk.type==='chunk')for(const [id,module]of Object.entries(chunk.modules)){
    if(!module.renderedLength)continue;
    const normalized=id.replaceAll('\\','/'),match=normalized.match(/node_modules\/(?:.*\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
    if(!match)continue;
    const name=match[1],meta=JSON.parse(readFileSync(new URL(`./node_modules/${name}/package.json`,import.meta.url),'utf8'));
    if(approved[name]!==meta.version)throw Error(`Dependency requires license review: ${name}@${meta.version}`);
    if(normalized.includes('/three/examples/jsm/libs/')&&!normalized.endsWith('/fflate.module.js'))throw Error(`Vendor file requires license review: ${normalized}`);
    used.set(name,{name,version:meta.version,license:meta.license});
  }
  this.emitFile({type:'asset',fileName:'third-party-components.json',source:JSON.stringify({version:'0.0.70',components:[...used.values()].sort((a,b)=>a.name.localeCompare(b.name)),embedded:[{name:'fflate',version:'0.8.2',license:'MIT',via:'three/examples/jsm/libs/fflate.module.js'}]},null,2)});
}};}
export default defineConfig({base:'./',publicDir:false,server:{watch:{ignored:['**/Desktop/**','**/AgentHost/**','**/tools/**','**/publish/**','**/bin/**','**/obj/**','**/work/**']}},plugins:[editorLanguagePlugin(),componentManifest()],
  resolve:{alias:[{find:'@noname0310/mmd-parser',replacement:fileURLToPath(new URL('./src/mmd-parser-compat.js',import.meta.url))},
    {find:/^ammojs-typed$/,replacement:fileURLToPath(new URL('./src/ammo-wasm-compat.js',import.meta.url))}]},
  build:{rollupOptions:{input:{index:'index.html',player:'player.html',environment:'environment.html',aircraft:'aircraft.html',firepower:'firepower.html'}}}});
