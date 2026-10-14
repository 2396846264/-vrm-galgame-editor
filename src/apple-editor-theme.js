import appleStyles from './apple-editor.css?inline';
const style=document.createElement('style');style.id='apple-editor-theme';style.textContent=appleStyles;document.head.append(style);
export function resolvedEditorTheme(preference='system'){return preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;}
export function watchEditorTheme(){
 document.body.classList.add('apple-module');
 const apply=()=>{let theme='system';try{const saved=JSON.parse(localStorage.getItem('vrm-editor-settings'));if(saved?.appearanceVersion===51)theme=saved.theme||'system';}catch{}document.body.dataset.editorTheme=resolvedEditorTheme(theme);};
 apply();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply);window.addEventListener('storage',apply);
}
