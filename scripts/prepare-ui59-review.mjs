import fs from 'node:fs';
import './prepare-language58-review.mjs';
let html=fs.readFileSync('dist/language58-review.html','utf8');
html=html.replace("ui:{}","ui:{gameTheme:'tactical',gamePalettes:{tactical:{accent:'#ff0000'}}}")
 .replace("characters:[{id:'role',name:'保存',modelId:'',description:'这是作者原文 Save 日本語'}]","characters:[{id:'role',name:'保存',modelId:'',description:'这是作者原文 Save 日本語'},{id:'role2',name:'保存',modelId:'',description:'第二个角色'}]")
 .replace("id:'line',text:'保存',speaker:'保存',choices:[]","id:'line',text:'保存',speaker:'保存',characterId:'role',choices:[]");
html=html.replace('knowledgeBooks:[]',`knowledgeBooks:${JSON.stringify([
 {id:'book1',name:'西岬灯塔公共维护手册',unlockActId:''},
 {id:'book2',name:'潮汐节节目单与未寄出的信',unlockActId:''},
 {id:'book3',name:'LettersFromTomorrowAndTheLighthouseMaintenanceArchive',unlockActId:'act'},
 {id:'book4',name:'明日へ届ける手紙と灯台の記録',unlockActId:''}
])}`);
fs.writeFileSync('dist/ui59-review.html',html);
console.log('Prepared development-only ui59-review.html.');
