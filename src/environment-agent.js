import {environmentCoordinates,environmentSummary,describeEnvironment,newAgentEnvironment,editAgentEnvironment,environmentOwner} from './environment-agent-operations.js';
import {inspectSceneAsset} from './environment-agent-inspect.js';

export const environmentAgentTools=new Set(['get_environments','get_environment','inspect_scene_asset','create_environment','edit_environment','set_environment_reference','open_environment','capture_environment','sync_environment_editor']);
export const environmentAgentWrites=new Set(['create_environment','edit_environment','set_environment_reference']);
export function createEnvironmentAgent(ctx){
  const project=()=>ctx.project();
  const find=id=>{const env=project().environments?.find(e=>e.id===id);if(!env)throw Error('环境不存在，请先读取环境列表');return env;};
  const revision=()=>ctx.revision();
  async function call(name,args){
    if(name==='sync_environment_editor'){const result=await ctx.control('sync');return {...result,revision:revision()};}
    if(name==='get_environments'){const state=await ctx.control('read');return {environments:environmentSummary(project()),coordinates:environmentCoordinates,editor:editorSummary(state),revision:revision()};}
    if(name==='get_environment'){
      const state=await ctx.control('read'),current=state.dirty&&state.environment?.id===args.environmentId?state.environment:find(args.environmentId);
      return {environment:describeEnvironment(current),editor:editorSummary(state),unsavedInEnvironmentEditor:Boolean(state.dirty&&state.environment?.id===args.environmentId),revision:revision()};
    }
    if(name==='inspect_scene_asset'){
      const state=await ctx.control('read'),asset=project().assets.find(a=>a.id===args.assetId)||state.assets?.find(a=>a.id===args.assetId);
      const rev=revision(),id=project().id,result=await inspectSceneAsset(asset,asset?ctx.assetUrl(asset):'');
      if(revision()!==rev||project().id!==id)throw Error('查看模型时工程已变化，请重新读取');return {...result,revision:rev};
    }
    if(name==='create_environment'){
      const env=newAgentEnvironment(args.name,project().assets);ctx.begin();project().environments.push(env);await ctx.changed('MCP 创建环境');return {environment:describeEnvironment(env),revision:revision()};
    }
    if(name==='edit_environment'){
      const env=find(args.environmentId);if(!Number.isInteger(args.expectedEnvironmentRevision)||args.expectedEnvironmentRevision!==(env.revision||0))throw Error('环境版本已变化，请重新读取 get_environment');
      const result=editAgentEnvironment(env,args.operations,project().assets);
      if(result.changed){ctx.begin();project().environments[project().environments.indexOf(env)]=result.environment;await ctx.changed('MCP 布置环境');}
      return {...result,environment:describeEnvironment(result.environment),revision:revision(),undoSteps:result.changed?1:0};
    }
    if(name==='set_environment_reference'){
      const owner=environmentOwner(project(),args);if(args.environmentId)find(args.environmentId);if(typeof args.environmentId!=='string')throw Error('需要环境 ID，空字符串表示默认天空');
      if((owner.environmentId||'')!==args.environmentId){ctx.begin();owner.environmentId=args.environmentId;await ctx.changed('MCP 指定幕场景');}
      return {target:args.target,actId:args.actId||'',environmentId:owner.environmentId,revision:revision()};
    }
    if(name==='open_environment'||name==='capture_environment'){
      const env=find(args.environmentId);await ctx.open(env);await ctx.refreshEnvironmentWindow({keepLocked:true});const state=await ctx.control('read');
      if(state.environment?.id!==env.id)throw Error('环境窗口还没有切换完成，请重试');
      if(name==='open_environment')return {opened:true,environmentId:env.id,revision:revision()};
      const result=await ctx.control('capture',{view:args.view||'game'});return {...result,environmentId:env.id,revision:revision()};
    }
    throw Error('未知的环境操作');
  }
  return {call,summary:environmentSummary,coordinates:environmentCoordinates};
}
export function editorSummary(state){return {opened:Boolean(state.opened),environmentId:state.environment?.id||'',dirty:Boolean(state.dirty),busy:Boolean(state.busy),pendingAssets:state.assets?.length||0};}
