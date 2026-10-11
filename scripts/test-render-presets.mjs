import assert from 'node:assert/strict';
import {normalizeRender,effectiveStyle,mergeRender,customFilterSpecs} from '../src/render-style.js';
import {migrateRenderPresets,resolveRender,resolveTitleRender,resolveDialogueRender,newRenderPreset,renderSelection,deleteRenderPreset} from '../src/render-presets.js';
import {renderHelp,helpLabel} from '../src/render-help.js';
import {insertEditorCopy} from '../src/editor-copy.js';
import {mergeEditorProject} from '../src/editor-project-merge.js';
const old={id:'p',render:{preset:'zzz',strength:.7,brightness:83},title:{render:{preset:'tno',contrast:111}},acts:[{id:'a',render:{preset:'tno',saturation:88},steps:[{id:'l',render:{brightness:122}},{id:'l2',render:{preset:'custom',filters:{fog:.4,dof:.5}}}]}]};
const inherited=old.render,expected=old.acts[0].steps.map(l=>mergeRender(mergeRender(inherited,old.acts[0].render),l.render)),title=mergeRender(inherited,old.title.render);
migrateRenderPresets(old);assert.equal(old.renderPresetSchema,1);assert.equal(old.acts[0].render,undefined);
for(let i=0;i<expected.length;i++){const actual=resolveDialogueRender(old,old.acts[0],old.acts[0].steps[i]);assert.deepEqual(effectiveStyle(actual),effectiveStyle(expected[i]));for(const key of ['brightness','contrast','saturation'])assert.equal(actual[key],expected[i][key]);}
assert.deepEqual(effectiveStyle(resolveTitleRender(old)),effectiveStyle(title));
const once=JSON.stringify(old);migrateRenderPresets(old);assert.equal(JSON.stringify(old),once,'Migration not idempotent');
const selection=old.acts[0].steps[0].render,preset=old.renderPresets.find(p=>p.id===selection.presetId);preset.settings.filters.rim=.8;assert.equal(resolveDialogueRender(old,old.acts[0],old.acts[0].steps[0]).filters.rim,.8,'References did not update');old.acts[0].render={preset:'zzz'};assert.equal(resolveDialogueRender(old,old.acts[0],old.acts[0].steps[0]).filters.rim,.8,'Act still bound');delete old.acts[0].render;
const count=old.renderPresets.length,copy=insertEditorCopy(old,'renderPreset',preset,{},()=> 'new-preset');assert.equal(old.renderPresets.length,count+1);copy.settings.filters.rim=.2;assert.equal(preset.settings.filters.rim,.8);assert.notEqual(copy.id,preset.id);
deleteRenderPreset(old,preset.id);assert.equal(selection.presetId,'');assert.equal(resolveRender(old,selection).filters.rim,0);
const neutral={renderPresets:[],render:renderSelection(),title:{},acts:[]};assert.equal(resolveRender(neutral).preset,'custom');assert.equal(resolveRender(neutral).filters.toon,0);assert.equal(resolveRender(neutral,{presetId:'missing'}).filters.outline,0);
neutral.renderPresets.push(newRenderPreset('t','test',{brightness:80,contrast:120}));assert.equal(resolveRender(neutral,{presetId:'t',brightness:150}).brightness,120);
for(const [key,label] of customFilterSpecs){assert.ok(renderHelp[key]?.length>10,'Missing explanation '+key);assert.ok(helpLabel(label,key).includes('data-render-help'));}
const base=structuredClone(old),root=structuredClone(base),module=structuredClone(base);root.acts[0].steps[0].text='root text';module.renderPresets[0].settings.filters.rim=.9;const merged=mergeEditorProject(base,root,module);assert.equal(merged.acts[0].steps[0].text,'root text');assert.equal(merged.renderPresets[0].settings.filters.rim,.9);
console.log(`PASS: legacy appearance preserved; independent presets; global references; neutral view; copy, delete, persistence and module merge; ${customFilterSpecs.length} render explanations.`);
