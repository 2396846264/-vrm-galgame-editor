import fs from 'node:fs';
import path from 'node:path';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {voxelPreset} from '../src/vehicle-documents.js';
import {compileAircraft,aircraftModel,aircraftTriangles,disposeAircraft} from '../src/aircombat-models.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result='data:'+blob.type+';base64,'+Buffer.from(value).toString('base64');this.onloadend?.();});}};
const output=path.resolve(process.argv[2]),manifest=[];fs.mkdirSync(output,{recursive:true});
for(const kit of ['stuka','b25','bf109','shinden']){const blueprint=voxelPreset(kit),spec=compileAircraft(blueprint),model=aircraftModel(spec);model.name=blueprint.name;model.traverse(o=>{if(o.isMesh&&o.geometry.index?.count===0)o.visible=false;});const buffer=await new GLTFExporter().parseAsync(model,{binary:true});fs.writeFileSync(path.join(output,kit+'.glb'),Buffer.from(buffer));fs.writeFileSync(path.join(output,kit+'.json'),JSON.stringify(blueprint,null,2));manifest.push({kit,name:blueprint.name,gridSize:blueprint.gridSize,halfBlocks:blueprint.blocks.length,parts:blueprint.parts.length,triangles:aircraftTriangles(model),mass:Math.round(spec.mass),horsepower:spec.powerHp,wingArea:spec.wingArea,frontalArea:spec.frontalArea,gearDownArea:spec.gearProjections.at(-1).area,gearUpArea:spec.gearProjections[0].area});disposeAircraft(model);}
fs.writeFileSync(path.join(output,'样机清单.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({ok:true,output,templates:manifest}));
