import fs from 'node:fs';
import path from 'node:path';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {partKit,createPart,sockets} from '../src/aircombat-schema.js';
import {partModel,aircraftTriangles,disposeAircraft} from '../src/aircombat-models.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result='data:'+blob.type+';base64,'+Buffer.from(value).toString('base64');this.onloadend?.();});}};
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});const manifest={units:'meters, kg, horsepower',forward:'-Z',up:'+Y',cockpitOpaque:true,parts:[]};
for(const [type,definition] of Object.entries(partKit)){const part=createPart(type),model=partModel({...part,def:definition});model.name=definition.name;const buffer=await new GLTFExporter().parseAsync(model,{binary:true});fs.writeFileSync(path.join(output,type+'.glb'),Buffer.from(buffer));manifest.parts.push({type,file:type+'.glb',...definition,sockets:sockets(type),triangles:aircraftTriangles(model)});disposeAircraft(model);}
fs.writeFileSync(path.join(output,'组件参数.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({ok:true,output,components:manifest.parts.length,triangles:manifest.parts.map(p=>[p.type,p.triangles])}));
