// Some FBX exporters embed valid PNG/JPEG bytes but omit the filename extension.
// Repair only their filename suffix, preserving every binary offset and original file.
export function normalizeEmbeddedImageNames(buffer) {
  const bytes=new Uint8Array(buffer);
  if(bytes.length<27 || new TextDecoder().decode(bytes.subarray(0,18))!=='Kaydara FBX Binary')return buffer;
  const copy=buffer.slice(0), view=new DataView(copy), data=new Uint8Array(copy);
  const version=view.getUint32(23,true),wide=version>=7500,header=wide?25:13,decoder=new TextDecoder();
  const integer=p=>wide?Number(view.getBigUint64(p,true)):view.getUint32(p,true);
  function node(start){
    if(start+header>data.length)return null;
    const end=integer(start);if(end===0)return null;
    const count=integer(start+(wide?8:4)),length=integer(start+(wide?16:8)),nameLength=data[start+(wide?24:12)];
    if(end>data.length||end<=start||count>1000000)throw Error('FBX 节点数据无效');
    const name=decoder.decode(data.subarray(start+header,start+header+nameLength)),properties=[],children=[];
    let p=start+header+nameLength;
    for(let i=0;i<count;i++){
      const type=String.fromCharCode(data[p++]);
      if(type==='S'||type==='R'){const size=view.getUint32(p,true);p+=4;if(p+size>end)throw Error('FBX 资源数据无效');properties.push({type,start:p,size});p+=size;}
      else if('fdlibc'.includes(type)){const size=view.getUint32(p+8,true);p+=12+size;}
      else {const size={Y:2,C:1,I:4,F:4,D:8,L:8}[type];if(!size)throw Error('FBX 属性类型无效');p+=size;}
      if(p>end)throw Error('FBX 属性越界');
    }
    p=start+header+nameLength+length;
    while(p+header<=end){const child=node(p);if(!child)break;children.push(child);p=child.end;}
    return {name,properties,children,end};
  }
  let changed=false;
  function repair(n){
    if(n.name==='Video'){
      const raw=n.children.find(c=>c.name==='Content')?.properties.find(p=>p.type==='R');
      if(raw){const magic=data.subarray(raw.start,raw.start+12);let extension;
        if(magic[0]===137&&magic[1]===80&&magic[2]===78&&magic[3]===71)extension='png';
        else if(magic[0]===255&&magic[1]===216&&magic[2]===255)extension='jpg';
        if(extension)for(const child of n.children.filter(c=>['Filename','FileName','RelativeFilename'].includes(c.name)))for(const p of child.properties.filter(p=>p.type==='S')){
          const name=decoder.decode(data.subarray(p.start,p.start+p.size));
          if(!/\.(png|jpg|jpeg)$/i.test(name)&&p.size>=4){data.set(new TextEncoder().encode('.'+extension),p.start+p.size-4);changed=true;}
        }
      }
    }
    n.children.forEach(repair);
  }
  for(let p=27;p+header<data.length;){const n=node(p);if(!n)break;repair(n);p=n.end;}
  return changed?copy:buffer;
}

