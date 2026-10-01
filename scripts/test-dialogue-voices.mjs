import assert from 'node:assert/strict';
import { syncDialogueVoices, voicesForCharacter, voiceFolderId, clearVoiceReferences } from '../src/dialogue-voices.js';
const p = { characters: [{ id: 'a', name: '角色甲' }, { id: 'b', name: '角色乙' }], assetFolders: [],
  assets: [{ id: 'only', type: 'audio', name: 'old.wav', path: 'assets/audio/only.wav' }, { id: 'shared', type: 'audio', name: 'music.wav', path: 'assets/audio/shared.wav' }],
  acts: [{ id: 'chapter', bgmId: 'shared', steps: [
    { id: '1', characterId: 'a', text: '第一句\n全文。', voiceId: 'only' },
    { id: '2', characterId: 'b', text: '第二句。', voiceId: 'shared' },
    { id: '3', characterId: '', speaker: '', text: '旁白。', voiceId: 'only' }
  ] }, { kind: 'event', event: { voiceId: 'shared' }, steps: [] }] };
syncDialogueVoices(p, { migrateLegacy: true });
assert.equal(p.assets.some(a => a.id === 'only'), false); assert(p.assets.some(a => a.id === 'shared' && a.type === 'audio'));
assert.equal(p.assets.filter(a => a.type === 'voice').length, 3); assert.equal(p.characters.length, 3);
assert(p.assetFolders.filter(f => f.type === 'voice').every(f => f.locked)); assert.equal(p.assetFolders.filter(f => f.type === 'voice').length, 3);
assert.equal(voicesForCharacter(p, 'a')[0].name, '第一句\n全文。'); assert.equal(voicesForCharacter(p, 'a').length, 1);
const first = p.acts[0].steps[0], firstVoiceId = first.voiceId;
p.characters[0].name = '新角色名'; first.text = '重命名后的对白全文。'; syncDialogueVoices(p);
assert.equal(p.assetFolders.find(f => f.id === voiceFolderId('a')).name, '新角色名'); assert.equal(p.assets.find(a => a.id === firstVoiceId).name, first.text);
first.characterId = 'b'; syncDialogueVoices(p); assert.equal(first.voiceId, '');
first.characterId = 'a'; first.voiceId = firstVoiceId; clearVoiceReferences(p, firstVoiceId); assert.equal(first.voiceId, '');
p.characters.splice(0,1); syncDialogueVoices(p); assert(p.assetFolders.find(f => f.id === voiceFolderId('a')).locked); assert(p.assetFolders.find(f => f.id === voiceFolderId('a')).characterDeleted);
const before = JSON.stringify(p); syncDialogueVoices(p); assert.equal(JSON.stringify(p), before);
console.log('PASS: legacy migration, shared music preservation, dedicated locked folders, narrator compatibility, full-text naming, role rename, cross-role rejection, deletion unbinding, deleted-role archive and idempotence');
