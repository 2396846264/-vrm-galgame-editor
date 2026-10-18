import fs from 'node:fs';
import path from 'node:path';
import {warshipPreset,shipClasses} from '../src/warship-schema.js';
import {voxelPreset} from '../src/vehicle-documents.js';
const output=path.resolve(process.argv[2]||'naval70-examples');
fs.mkdirSync(output,{recursive:true});
for(const [key,row] of Object.entries(shipClasses)){
 const blueprint=warshipPreset(key);delete blueprint.vehicleId;blueprint.fireSounds={};
 fs.writeFileSync(path.join(output,key+'.warship.json'),JSON.stringify({format:'vrm-warship',version:1,blueprint,assets:[]}));
}
const blueprint=voxelPreset('b25');delete blueprint.vehicleId;blueprint.fireSounds={};
fs.writeFileSync(path.join(output,'b25.aircraft.json'),JSON.stringify({format:'vrm-aircraft',version:1,blueprint,assets:[]}));
console.log('Generated six warships and a B-25; zip each JSON under warship.json / aircraft.json for native import.');
