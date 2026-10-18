import catalog from './editor-languages.json' with {type:'json'};
export const editorLanguages=[['zh-CN','简体中文'],['en','English'],['ja','日本語']];
const valid=value=>editorLanguages.some(([id])=>id===value)?value:'zh-CN';
let active=false,locale='zh-CN',observer;
const textSources=new Map();
export const editorLocale=()=>locale;
const formats=Object.keys(catalog).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length).map(key=>({key,parts:key.split(/(\{\d+\})/)}));
function matchFormat(source,parts){
 let position=0;const values={};
 for(let i=0;i<parts.length;i++){
  const part=parts[i],token=part.match(/^\{(\d+)\}$/);
  if(!token){if(!source.startsWith(part,position))return null;position+=part.length;continue;}
  const next=parts[i+1];if(!next&&i+2<parts.length)return null;
  const end=next?source.indexOf(next,position):source.length;if(end<0)return null;
  values[token[1]]=source.slice(position,end);position=end;
 }
 return position===source.length?values:null;
}
export function editorText(source){
 if(!active||locale==='zh-CN'||typeof source!=='string'||!/[\u3400-\u9fff]/.test(source))return source;
 const trimmed=source.trim(),entry=catalog[trimmed]?.[locale];if(entry)return source.replace(trimmed,()=>entry);
 for(const format of formats){const values=matchFormat(trimmed,format.parts);if(values){return source.replace(trimmed,()=>catalog[format.key][locale].replace(/\{(\d+)\}/g,(_,i)=>values[i]??''));}}
 return source;
}
export function editorMessage(parts,...values){const key=parts.reduce((s,p,i)=>s+(i?`{${i-1}}`:'')+p,'');return editorText(key).replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??''));}
const attr=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function editorAttributes(markup){return markup.replace(/\b(title|placeholder|aria-label|alt)="([^"\uE000]*)"/g,(all,name,value)=>active&&/[\u3400-\u9fff]/.test(value)?`${name}="${attr(editorText(value))}" data-editor-${name}="${attr(value)}"`:all);}
export function editorLabel(source){
 if(!active||typeof source!=='string'||!/[\u3400-\u9fff]/.test(source)||source.includes('<'))return source;
 return `<!--editor-text:${encodeURIComponent(source)}-->${attr(editorText(source))}<!--/editor-text-->`;
}
// Known UI textContent, with provenance for live switching.
export function setEditorText(node,source){if(!node)return;node.textContent=editorText(source);textSources.set(node,source);}
// Build-time tag: localize static HTML, keep all interpolated project values opaque.
export function editorHtml(parts,...values){
 if(!active)return parts.reduce((s,p,i)=>s+(i?values[i-1]??'':'')+p,'');
 const slots=[];let html=parts.reduce((s,p,i)=>s+(i?`\uE000${slots.push(values[i-1]??'')-1}\uE001`:'')+p,'');
 html=html.replace(/(<[^>]+>)|([^<]+)/g,(all,tag,text)=>{
  if(tag)return editorAttributes(tag);
  return text.replace(/[^\uE000\uE001]+|\uE000\d+\uE001/g,part=>/^\uE000/.test(part)?part:editorLabel(part));
 });
 return html.replace(/\uE000(\d+)\uE001/g,(_,i)=>slots[Number(i)]);
}
function refresh(root=document){
 if(!active)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_COMMENT);
 let comment;while(comment=walker.nextNode())if(comment.data.startsWith('editor-text:')){
  const next=comment.nextSibling;if(next?.nodeType===Node.TEXT_NODE)next.textContent=editorText(decodeURIComponent(comment.data.slice(12)));
 }
 const selector='[data-editor-title],[data-editor-placeholder],[data-editor-aria-label],[data-editor-alt]';
 for(const node of root.querySelectorAll?.(selector)||[])for(const name of ['title','placeholder','aria-label','alt'])if(node.hasAttribute(`data-editor-${name}`))node.setAttribute(name,editorText(node.getAttribute(`data-editor-${name}`)));
 for(const [node,source]of textSources){if(node.isConnected)node.textContent=editorText(source);else textSources.delete(node);}
}
function apply(value){locale=valid(value);document.documentElement.lang=locale;document.body.dataset.editorLanguage=locale;refresh();const picker=document.querySelector('#editor-language');if(picker)picker.value=locale;
 window.chrome?.webview?.postMessage({id:'editor-language',action:'editorLanguage',payload:{language:locale}});
 window.dispatchEvent(new CustomEvent('editorlanguagechange',{detail:{language:locale}}));
}
export function setEditorLanguage(value){
 const language=valid(value);let saved={};try{saved=JSON.parse(localStorage.getItem('vrm-editor-settings'))||{};}catch{}
 localStorage.setItem('vrm-editor-settings',JSON.stringify({...saved,language}));apply(language);
}
export function enableEditorLanguage(){if(active)return;active=true;
 let saved={};try{saved=JSON.parse(localStorage.getItem('vrm-editor-settings'))||{};}catch{}apply(saved.language);
 observer=new MutationObserver(records=>{observer.disconnect();for(const record of records)for(const node of record.addedNodes)if(node.nodeType===Node.ELEMENT_NODE)refresh(node);observe();});
 function observe(){observer.observe(document.body,{childList:true,subtree:true});}observe();
 window.addEventListener('storage',event=>{if(event.key==='vrm-editor-settings'){try{apply(JSON.parse(event.newValue)?.language);}catch{apply('zh-CN');}}});
}
