import {readFile,writeFile,open} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
for(const [part,name] of [[manifest.base,'release-base.json'],[manifest.patch,'release-patch.json']]){
 await writeFile(name,JSON.stringify(part));
 const result=spawnSync(process.execPath,['scripts/assemble-release.mjs',name],{stdio:'inherit'});
 if(result.status!==0)throw Error('Release data integrity verification failed');
}
if(!/^[A-Za-z0-9._-]+\.zip$/.test(manifest.name))throw Error('Invalid release filename');
const base=await open(manifest.base.name,'r'),patch=await open(manifest.patch.name,'r'),output=await open(manifest.name,'w');
const hash=createHash('sha256');let total=0;
try{
 for(const segment of manifest.segments){
  if(!['base','patch'].includes(segment.source)||!Number.isSafeInteger(segment.offset)||!Number.isSafeInteger(segment.bytes)||segment.offset<0||segment.bytes<0)throw Error('Invalid segment');
  const source=segment.source==='base'?base:patch,limit=manifest[segment.source].bytes;
  if(segment.offset+segment.bytes>limit)throw Error('Out of bounds segment');
  let remaining=segment.bytes,position=segment.offset;
  while(remaining){const buffer=Buffer.alloc(Math.min(1024*1024,remaining));const {bytesRead}=await source.read(buffer,0,buffer.length,position);if(bytesRead!==buffer.length)throw Error('Truncated segment');await output.writeFile(buffer);hash.update(buffer);position+=bytesRead;remaining-=bytesRead;total+=bytesRead;}
 }
}finally{await Promise.all([base.close(),patch.close(),output.close()]);}
if(total!==manifest.bytes||hash.digest('hex')!==manifest.sha256)throw Error('Final package differs from locally tested release');
console.log('The final Windows package matches the tested local ZIP.');
