import {readFile,open,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Release automation reconstructs the locally tested archive from temporary
// GitHub blob objects. No signing or project-encryption credentials enter CI.
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
if(!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY)throw Error('Missing GitHub workflow context');
if(!/^[A-Za-z0-9._-]+\.zip$/.test(manifest.name))throw Error('Invalid release filename');
const file=await open(manifest.name,'w');const hash=createHash('sha256');let total=0;
try{
  const download=async chunk=>{
    if(!/^[0-9a-f]{40}$/.test(chunk.sha))throw Error('Invalid blob SHA');
    const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/git/blobs/${chunk.sha}`,{
      headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      signal:AbortSignal.timeout(120000)
    });
    if(!response.ok)throw Error(`Package download failed: HTTP ${response.status}`);
    const blob=await response.json();if(blob.encoding!=='base64')throw Error('Unexpected blob encoding');
    const bytes=Buffer.from(blob.content,'base64');if(bytes.length!==chunk.bytes)throw Error('Chunk length mismatch');
    const gitHash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if(gitHash!==chunk.sha)throw Error('Chunk integrity mismatch');
    return bytes;
  };
  for(let index=0;index<manifest.chunks.length;index+=4){
    const parts=await Promise.all(manifest.chunks.slice(index,index+4).map(download));
    for(const bytes of parts){await file.writeFile(bytes);hash.update(bytes);total+=bytes.length;}
    console.log(`Received ${total} / ${manifest.bytes} bytes`);
  }
}finally{await file.close();}
if(total!==manifest.bytes || hash.digest('hex')!==manifest.sha256)throw Error('Release package integrity mismatch');
await writeFile('SHA256SUMS.txt',`${manifest.sha256}  ${path.basename(manifest.name)}\n`);
console.log('The reconstructed archive matches the tested local package.');
