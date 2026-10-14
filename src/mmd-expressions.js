const presets={
 happy:[[['口角上げ','にやり','にっこり'],1],[['笑い'],.6],[['にこり'],.7]],
 angry:[[['怒り'],1],[['キリッ'],.45]],sad:[[['困る','悲しい'],1],[['口角下げ'],.5]],
 relaxed:[[['なごみ','笑い'],.4]],surprised:[[['びっくり'],1],[['上'],.6]],
 aa:[[['あ','あ2'],1]],ih:[[['い','い1'],1]],ou:[[['う','う2'],1]],ee:[[['え','え1'],1]],oh:[[['お','お1'],1]],
 blink:[[['まばたき','瞬き','blink','Blink','眨眼','闭眼','閉眼'],1]],blinkLeft:[[['ウィンク','ウィンク2','blinkLeft'],1]],blinkRight:[[['ウィンク右','ウィンク2右','blinkRight'],1]]
};
const canonical=name=>name.normalize('NFKC').toLowerCase().replace(/[\s_-]/g,'');
export function createMmdExpressions(mesh){
 const dictionary=mesh.morphTargetDictionary||{},names=new Map(Object.keys(dictionary).map(name=>[canonical(name),name])),bindings=new Map(),values=new Map();
 for(const [alias,groups]of Object.entries(presets)){
  const targets=groups.flatMap(([candidates,weight])=>{const name=candidates.map(n=>names.get(canonical(n))).find(Boolean);return name?[{index:dictionary[name],weight}]:[];});
  if(targets.length)bindings.set(alias,targets);
 }
 for(const [name,index]of Object.entries(dictionary))bindings.set(name,[{index,weight:1}]);
 const mouthIndices=new Set((mesh.userData?.mmdMouthMorphs||Object.keys(dictionary).filter(name=>/^(あ|い|う|え|お)[0-9２]?|口|にやり|にっこり|ぺろ|舌|歯/.test(name))).map(name=>dictionary[name]).filter(Number.isInteger));
 for(const alias of ['aa','ih','ou','ee','oh'])for(const b of bindings.get(alias)||[])mouthIndices.add(b.index);
 const blinkTargets=bindings.get('blink')||((bindings.has('blinkLeft')&&bindings.has('blinkRight'))?[...bindings.get('blinkLeft'),...bindings.get('blinkRight')]:[]);
 const closedEyeIndices=new Set(Object.entries(dictionary).filter(([name])=>/まばたき|瞬き|ウィンク|笑い|なごみ|blink|眨眼|闭眼|閉眼/i.test(name)).map(([,index])=>index));
 for(const alias of ['blink','blinkLeft','blinkRight'])for(const target of bindings.get(alias)||[])closedEyeIndices.add(target.index);
 let restore=null,talking=null,autoBlink=0,native=false;
 return {expressions:[...bindings.keys()].map(expressionName=>({expressionName})),
  getValue:name=>values.get(name)||0,setValue(name,value){if(bindings.has(name))values.set(name,Math.max(0,Math.min(1,Number(value)||0)));},resetValues(){values.clear();},
  restore(){if(restore){mesh.morphTargetInfluences.splice(0,restore.length,...restore);restore=null;}},
  setTalkingMouthWeights(weights){talking=weights;},
  setAutoBlinkWeight(value){autoBlink=Math.max(0,Math.min(1,Number(value)||0));},
  getAuthoredBlinkWeight(){let weight=0;for(const [name,value]of values)for(const target of bindings.get(name)||[])if(closedEyeIndices.has(target.index))weight=Math.max(weight,value*target.weight);if(native)for(const index of closedEyeIndices)weight=Math.max(weight,mesh.morphTargetInfluences[index]||0);return weight;},
  update(nativeVmd=false){
   native=nativeVmd;
   if(nativeVmd)restore=[...mesh.morphTargetInfluences];else mesh.morphTargetInfluences.fill(0);
   for(const [name,value]of values)for(const target of bindings.get(name)||[])mesh.morphTargetInfluences[target.index]=Math.max(mesh.morphTargetInfluences[target.index]||0,value*target.weight);
   if(talking){for(const index of mouthIndices)mesh.morphTargetInfluences[index]=0;for(const [name,value]of Object.entries(talking))for(const target of bindings.get(name)||[])mesh.morphTargetInfluences[target.index]=Math.max(mesh.morphTargetInfluences[target.index],value*target.weight);}
   if(autoBlink>0&&![...closedEyeIndices].some(index=>mesh.morphTargetInfluences[index]>.02))for(const target of blinkTargets)mesh.morphTargetInfluences[target.index]=autoBlink*target.weight;
  }
 };
}
