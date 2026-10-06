export function createEnvironmentAutosave({now=()=>Date.now(),canSave,hasChanges,save,render,interval=600000}) {
  let deadline=now()+interval,saving=false,failure='',lastSaved=0;
  function snapshot(){return {seconds:Math.max(0,Math.ceil((deadline-now())/1000)),saving,waiting:now()>=deadline&&!canSave(),failure,lastSaved};}
  function draw(){render(snapshot());}
  function saved(){deadline=now()+interval;failure='';lastSaved=now();draw();}
  async function tick(){
    draw();if(saving||now()<deadline||!canSave())return;
    if(!hasChanges()){deadline=now()+interval;draw();return;}
    saving=true;failure='';draw();
    try{await save();saved();}catch(error){failure=error.message||'保存没有完成';deadline=now()+30000;}
    finally{saving=false;draw();}
  }
  return {tick,saved,snapshot};
}
