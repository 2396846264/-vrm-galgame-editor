import appleStyles from './apple-editor.css?inline';
import {enableEditorLanguage} from './editor-language.js';
const style=document.createElement('style');style.id='apple-editor-theme';style.textContent=appleStyles;document.head.append(style);
export function resolvedEditorTheme(preference='system'){return preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;}
export function watchEditorTheme(){
 enableEditorLanguage();
 document.body.classList.add('apple-module');
 const apply=()=>{let theme='system';try{const saved=JSON.parse(localStorage.getItem('vrm-editor-settings'));if(saved?.appearanceVersion===51)theme=saved.theme||'system';}catch{}document.body.dataset.editorTheme=resolvedEditorTheme(theme);};
 apply();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply);window.addEventListener('storage',apply);
}

const languageStyle=document.createElement('style');languageStyle.textContent='body[data-editor-language=ja]{font-family: "Yu Gothic UI",Meiryo,"HarmonyOS Sans",sans-serif}';document.head.append(languageStyle);
