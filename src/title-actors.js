const actorFields = ['modelId','motionId','motionOptions','expressionWeights','size','offsetX','offsetY','offsetZ','yaw','pitch'];

export function newTitleActor(id, modelId = '', index = 0) {
  return {id,modelId,characterId:'',motionId:'',motionOptions:{},expressionWeights:{},
    size:1.15,offsetX:index === 0 ? 0 : (index % 2 ? -1 : 1) * Math.ceil(index/2) * .65,
    offsetY:0,offsetZ:0,yaw:0,pitch:0,props:[]};
}

export function migrateTitleActors(title, nextId) {
  if (!Array.isArray(title.actors)) {
    title.actors = title.modelId ? [Object.assign(newTitleActor(nextId(), title.modelId),
      Object.fromEntries(actorFields.filter(key=>title[key] !== undefined).map(key=>[key,structuredClone(title[key])])))] : [];
  }
  const seen = new Set();
  title.actors = title.actors.map((entry,index)=>{
    const id = entry.id && !seen.has(entry.id) ? entry.id : nextId(); seen.add(id);
    const actor = {...newTitleActor(id,'',index),...entry,id};
    actor.props = Array.isArray(actor.props) ? [...new Set(actor.props)] : [];
    actor.expressionWeights ||= {}; actor.motionOptions ||= {};
    return actor;
  });
  for(const key of actorFields)delete title[key];
  return title;
}
