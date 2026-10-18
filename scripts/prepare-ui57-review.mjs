import fs from 'node:fs';
const index=fs.readFileSync('dist/index.html','utf8');
const main=index.match(/src="(.\/assets\/main-[^"]+\.js)"/)?.[1];
if(!main)throw Error('Build the front end before preparing the local review host.');
const styles=[...index.matchAll(/<link rel="stylesheet"[^>]+>/g)].map(m=>m[0]).join('');
const source=fs.readFileSync('ui-module-review57.html','utf8').replace("'./src/main.js'",JSON.stringify(main)).replace('<div id="app">',styles+'<div id="app">');
fs.writeFileSync('dist/ui-module-review57.html',source);
console.log('Local mock host prepared. Remove dist/ui-module-review57.html before signing a release.');
