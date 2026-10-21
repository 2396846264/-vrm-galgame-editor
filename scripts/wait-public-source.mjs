import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(!/^[0-9a-f]{40}$/.test(manifest.verifiedSourceCommit)||!process.env.GH_TOKEN||!process.env.GITHUB_REPOSITORY)throw Error('Missing verified source workflow context');
for(let attempt=0;attempt<120;attempt++){
 const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${manifest.verifiedSourceCommit}&per_page=30`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Cannot read source checks: '+response.status);
 const runs=(await response.json()).workflow_runs||[],run=runs.find(r=>r.name==='Build and test public source'&&r.event==='push');
 if(run?.status==='completed'){if(run.conclusion!=='success')throw Error('Public source checks failed: '+run.html_url);console.log('Public source checks passed: '+run.html_url);process.exit(0);}
 console.log('Waiting for public source build and tests');await new Promise(r=>setTimeout(r,15000));
}
throw Error('Public source checks did not finish in time');
