import {readFile,writeFile,open,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
async function run(script,file,data){await writeFile(file,JSON.stringify(data));const result=spawnSync(process.execPath,[script,file],{stdio:'inherit'});if(result.status!==0)throw Error('Release reconstruction failed');}
await run('scripts/assemble-release-delta.mjs','baseline-manifest.json',manifest.base.baselineManifest);
await rename(manifest.base.baselineManifest.name,manifest.base.name);
await run('scripts/assemble-release.mjs','patch-manifest.json',manifest.patch);
const base=await open(manifest.base.name,'r'),patch=await open(manifest.patch.name,'r'),out=await open(manifest.name,'w'),hash=createHash('sha256');let size=0;
try{for(const segment of manifest.segments){if(!['base','patch'].includes(segment.source)||!Number.isSafeInteger(segment.offset)||!Number.isSafeInteger(segment.bytes)||segment.offset<0||segment.bytes<0||segment.offset+segment.bytes>manifest[segment.source].bytes)throw Error('Invalid segment');const file=segment.source==='base'?base:patch;for(let pos=0;pos<segment.bytes;){const buffer=Buffer.alloc(Math.min(1048576,segment.bytes-pos)),result=await file.read(buffer,0,buffer.length,segment.offset+pos);if(result.bytesRead!==buffer.length)throw Error('Truncated data');await out.writeFile(buffer);hash.update(buffer);size+=buffer.length;pos+=buffer.length;}}}finally{await Promise.all([base.close(),patch.close(),out.close()]);}
if(size!==manifest.bytes||hash.digest('hex')!==manifest.sha256)throw Error('Package differs from locally tested version');
console.log('Verified exact local Windows package.');
