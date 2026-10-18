// Source-authored UI only. Interpolated project values are never looked up.
import {parseAst} from 'rollup/parseAst';
import {readFileSync} from 'node:fs';
const chinese=/[\u3400-\u9fff]/;
const htmlStart=/^\s*<\/?[a-z][\s\S]*>/i;
export function editorLanguagePlugin(){return {name:'editor-language',enforce:'pre',generateBundle(){this.emitFile({type:'asset',fileName:'editor-languages.json',source:readFileSync(new URL('../src/editor-languages.json',import.meta.url),'utf8')});},transform(source,id){
 if(!/\/src\/[^?]+\.js$/.test(id.replaceAll('\\','/'))||id.includes('editor-language'))return;
 const edits=[];let used=false;
 const wrap=(node,before,after)=>{edits.push([node.start,before],[node.end,after]);used=true;};
 function walk(node,parents=[]){if(!node||typeof node!=='object')return;const parent=parents.at(-1);
  if(node.type==='CallExpression'&&(node.callee?.name==='prompt'||node.callee?.object?.name==='window'&&node.callee?.property?.name==='prompt')&&node.arguments[0])wrap(node.arguments[0],'__editorText(',')');
  if(node.type==='AssignmentExpression'&&node.operator==='='&&node.left?.property?.name==='textContent'&&chinese.test(source.slice(node.right.start,node.right.end))){
   edits.push([node.start,'__setEditorText('+source.slice(node.left.object.start,node.left.object.end)+',',node.right.start],[node.end,')']);used=true;
  }
  if(node.type==='TemplateLiteral'&&parent?.type!=='TaggedTemplateExpression'){
   const raw=node.quasis.map(q=>q.value.cooked||'').join('');
   if(chinese.test(raw)&&htmlStart.test(raw)&&htmlContext(parents))wrap(node,'__editorHtml','');
   else if(chinese.test(raw)&&uiContext(parents))wrap(node,'__editorMessage','');
  }
  if(node.type==='Literal'&&typeof node.value==='string'&&chinese.test(node.value)){
   if(htmlStart.test(node.value)&&htmlContext(parents))wrap(node,'__editorHtml([','])');
   else if(uiContext(parents))wrap(node,visibleLiteral(parents)?'__editorLabel(':'__editorText(',')');
  }
  if(visibleTextExpression(node,parent)&&(
    node.type==='MemberExpression'&&node.object?.type==='ArrayExpression'&&staticArray(node.object)&&chinese.test(source.slice(node.object.start,node.object.end))||
    node.type==='Identifier'&&staticMapLabel(node.name,parents)
  ))wrap(node,'__editorLabel(',')');
  for(const [key,value]of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))for(const child of value)walk(child,[...parents,node]);else if(value&&typeof value==='object')walk(value,[...parents,node]);}
 }
 walk(parseAst(source));if(!used)return;
 for(const [at,text,end]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,at)+text+source.slice(end??at);
 return {code:`import {editorHtml as __editorHtml,editorText as __editorText,editorMessage as __editorMessage,editorLabel as __editorLabel,setEditorText as __setEditorText} from './editor-language.js';\n`+source,map:null};
}};}
function uiContext(parents){
 for(let i=parents.length-1;i>=0;i--){const n=parents[i];
  if(n.type==='TemplateLiteral'&&/<\/?[a-z][\s\S]*>/i.test(n.quasis.map(q=>q.value.cooked||'').join('')))return true;
  if(n.type==='CallExpression'||n.type==='NewExpression'){
   const name=n.callee?.name||n.callee?.property?.name;
   if(['button','btn','field','helpLabel','preciseTransform','editorLabel','toast','notice','status','setStagePlaceholder'].includes(name))return false;
   if(['alert','confirm'].includes(name))return true;
   if(['escape','esc','createElement','setAttribute','newId','markDirty','mutate'].includes(name))return false;
   return false;
  }
  if(n.type==='AssignmentExpression'&&n.left?.property?.name==='textContent')return false;
  if(n.type==='AssignmentExpression'&&['title','placeholder'].includes(n.left?.property?.name))return true;
  if(n.type==='ArrayExpression')return false;
  if(n.type==='BinaryExpression'&&n.operator!=='+')return false;
  if(n.type==='MemberExpression'&&n.computed)return false;
  if(n.type==='AssignmentExpression')return false;
  if(['FunctionDeclaration','ArrowFunctionExpression','FunctionExpression','VariableDeclarator','Property'].includes(n.type))return false;
 }
 return false;
}
function htmlContext(parents){
 for(let i=parents.length-1;i>=0;i--){const n=parents[i];
  if(n.type==='Property'||n.type==='ArrayExpression'||n.type==='BinaryExpression'&&n.operator!=='+')return false;
  if(n.type==='CallExpression')return ['insertAdjacentHTML','createContextualFragment'].includes(n.callee?.property?.name);
  if(n.type==='AssignmentExpression')return n.left?.property?.name==='innerHTML';
  if(n.type==='ReturnStatement'||n.type==='ArrowFunctionExpression')return true;
  if(n.type==='VariableDeclarator')return /html|markup|content|header|footer|control|panel|heading|spinner|notice/i.test(n.id?.name||'');
  if(n.type==='TemplateLiteral')return htmlStart.test(n.quasis.map(q=>q.value.cooked||'').join(''));
 }
 return false;
}
function visibleTextExpression(node,parent){
 if(parent?.type!=='TemplateLiteral')return false;const index=parent.expressions.indexOf(node);if(index<0)return false;
 const before=parent.quasis.slice(0,index+1).map(q=>q.value.cooked||'').join('');return before.lastIndexOf('>')>before.lastIndexOf('<');
}
function staticArray(node){return node.type==='Literal'||node.type==='ArrayExpression'&&node.elements.every(n=>n&&staticArray(n));}
function staticMapLabel(name,parents){
 const arrowIndex=parents.findLastIndex(n=>n.type==='ArrowFunctionExpression');if(arrowIndex<0)return false;
 const arrow=parents[arrowIndex],call=parents[arrowIndex-1];if(call?.type!=='CallExpression'||call.callee?.property?.name!=='map'||call.callee.object?.type!=='ArrayExpression'||!staticArray(call.callee.object))return false;
 const has=n=>n&&(n.type==='Identifier'?n.name===name:n.type==='ArrayPattern'?n.elements.some(has):false);return arrow.params.some(has);
}
function visibleLiteral(parents){
 for(let i=parents.length-1;i>=0;i--){const n=parents[i];
  if(n.type==='TemplateLiteral'){
   const index=n.expressions.indexOf(parents[i+1]);if(index<0)return false;
   const before=n.quasis.slice(0,index+1).map(q=>q.value.cooked||'').join('');
   return before.lastIndexOf('>')>before.lastIndexOf('<');
  }
  if(!['ConditionalExpression','LogicalExpression'].includes(n.type))return false;
 }
 return false;
}
