"""One-off preparation of baked UI catalogs. No service is used by the editor."""
import concurrent.futures, json, pathlib, re, time, urllib.parse, urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
keys=json.loads((root/'scripts/editor-language-source.json').read_text('utf-8'))
target=root/'src/editor-languages.json'
catalog=json.loads(target.read_text('utf-8'))
def request(q,language):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'zh-CN','tl':language,'dt':'t','q':q})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url,timeout=45) as f: data=json.load(f)
            return ''.join(x[0] for x in data[0] if x[0])
        except Exception:
            if attempt==3: raise
            time.sleep(2+attempt*3)
def batch(job):
    language,rows=job
    q='\n'.join(f'[[{i:04d}]] '+key for i,key in rows)
    result=request(q,language)
    found={int(m[1]):m[2].strip() for m in re.finditer(r'\[\[\s*(\d+)\s*\]\]\s*(.*?)(?=\[\[|\Z)',result,re.S)}
    output=[]
    for i,key in rows:
        text=found.get(i)
        if not text or set(re.findall(r'\{\d+\}',text))!=set(re.findall(r'\{\d+\}',key)):
            text=request(key,language)
        if set(re.findall(r'\{\d+\}',text))!=set(re.findall(r'\{\d+\}',key)): raise ValueError(f'Placeholder mismatch: {key}')
        output.append((key,language,text))
    return output
jobs=[]
for language in ['en','ja']:
    rows=[(i,key) for i,key in enumerate(keys) if language not in catalog.get(key,{})]
    group=[];size=0
    for row in rows:
        if size+len(row[1])>1700 or len(group)>=22:
            jobs.append((language,group));group=[];size=0
        group.append(row);size+=len(row[1])
    if group: jobs.append((language,group))
print(f'Preparing {len(jobs)} translation batches',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    futures=[pool.submit(batch,job) for job in jobs]
    errors=[]
    for i,future in enumerate(concurrent.futures.as_completed(futures)):
        try:
            for key,language,value in future.result(): catalog.setdefault(key,{})[language]=value
        except Exception as error: errors.append(str(error));print(str(error),flush=True)
        target.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n','utf-8')
        if i%10==0: print(f'{i+1}/{len(jobs)} batches complete',flush=True)
    if errors: raise RuntimeError('\n'.join(errors))
print('Catalogs prepared.',flush=True)
