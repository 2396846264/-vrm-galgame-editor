import {emptyDialogueCast} from './dialogue-cast.js';
export function createNextDialogue(previous,id){
 return previous?{...structuredClone(previous),id,text:''}:{id,characterId:'',speaker:'',text:'',cast:emptyDialogueCast(),voiceId:'',choices:[]};
}
