// Coordinate the two editor windows without overwriting pending mouse/keyboard edits.
export function createEnvironmentAgentWindow(ctx){
  let locked=false;
  function unlock(){locked=false;ctx.lock(false);}
  async function control(command,payload){
    const state=ctx.read();
    if(command==='read')return state;
    if(command==='release'){unlock();return {opened:true};}
    if(state.busy)throw Error('环境窗口正在操作或保存，请等当前操作结束后重试');
    if(command==='sync'){if(locked)throw Error('MCP 正在布置场景');if(state.dirty)await ctx.save();return {opened:true,synchronized:true};}
    if(command==='lock'){
      if(state.dirty)throw Error('环境窗口有未保存修改。先调用 sync_environment_editor，再重新读取 revision');
      if(locked)throw Error('环境窗口已被另一个 MCP 操作占用');locked=true;ctx.lock(true);return {opened:true,locked:true};
    }
    if(command==='refresh'){
      if(state.dirty)throw Error('环境窗口有未保存修改，不能覆盖');
      try{await ctx.refresh(payload);return {opened:true,refreshed:true};}finally{if(!payload.keepLocked)unlock();}
    }
    if(command==='capture'){await ctx.view(payload.view);return {opened:true};}
    throw Error('未知环境窗口命令');
  }
  return {control,isLocked:()=>locked};
}
