import assert from 'node:assert/strict';
import {initializeCarrierLaunch,stepCarrierLaunch} from '../src/carrier-launch.js';
import {warshipPreset} from '../src/warship-schema.js';
import {createShip} from '../src/warship-runtime.js';
import {createFlight} from '../src/aircombat-physics.js';
import {historicalPreset,normalizeCombat} from '../src/aircombat-schema.js';
const plane=team=>({team,flight:createFlight(historicalPreset('bf109'))}),carrier=()=>({team:'ally',flight:createShip(warshipPreset('carrier'))});
function fixture(count,ships=1,ground=true){return {config:{startOnGround:ground,altitude:600},keys:new Set(),units:[plane('player'),...Array.from({length:count},()=>plane('ally')),...Array.from({length:ships},carrier)]};}
assert.equal(normalizeCombat({allies:15}).allies,15);
const one=fixture(6);initializeCarrierLaunch(one);assert.equal(one.launchTickets.length,6);assert.equal(one.launchTickets.filter(t=>t.unit.team==='ally').length,5);assert.equal(one.launchAirborneFallback.length,1);assert.equal(one.launchTickets.at(-1).unit.team,'player');
for(let i=0;i<6000;i++)stepCarrierLaunch(one,1/60);assert.equal(one.launchEvents.filter(e=>e.kind==='takeoff').length,5);assert.equal(one.activeLaunch.unit.team,'player');assert.equal(one.activeLaunch.status,'ready');one.keys.add('KeyW');for(let i=0;i<600;i++)stepCarrierLaunch(one,1/60);assert.equal(one.launchEvents.at(-1).team,'player');
const two=fixture(6,2);initializeCarrierLaunch(two);assert.equal(two.launchTickets.length,7);assert.equal(two.launchAirborneFallback.length,0);assert.equal(two.launchTickets.filter(t=>t.carrier===two.units.at(-2)).length,6);assert.equal(two.launchTickets.filter(t=>t.carrier===two.units.at(-1)).length,1);
const many=fixture(15,2);initializeCarrierLaunch(many);assert.equal(many.launchTickets.length,12);assert.equal(many.launchAirborneFallback.length,4);assert.equal(many.launchTickets.at(-1).unit.team,'player');
const air=fixture(6,2,false);initializeCarrierLaunch(air);assert.equal(air.launchTickets.length,0);
const land=fixture(2,0);initializeCarrierLaunch(land);assert.equal(land.launchTickets.length,3);assert(land.launchTickets.every(t=>!t.carrier));
const lost=fixture(1);initializeCarrierLaunch(lost);lost.units.at(-1).flight.alive=false;for(let i=0;i<10;i++)stepCarrierLaunch(lost,.1);assert(lost.launchTickets.every(t=>t.status==='departed'));assert(lost.units.slice(0,2).every(u=>!u.flight.carrierLaunch&&u.flight.position.y>=600));
console.log('PASS carrier84: six-slot player reservation, AI-first/player-last launch gate, second-carrier allocation, airborne overflow, air-start exclusion, platform fallback, destroyed carrier recovery.');
