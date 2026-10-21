import assert from 'node:assert/strict';
import * as T from 'three';
import {warshipPreset,normalizeWarship,validateWarship} from '../src/warship-schema.js';
import {carrierDeckErrors,deckClearance} from '../src/carrier-deck.js';
import {createShip} from '../src/warship-runtime.js';
import {createFlight,stepFlight} from '../src/aircombat-physics.js';
import {voxelPreset} from '../src/vehicle-documents.js';
import {carrierSurface,serviceOnCarrier} from '../src/carrier-landing.js';
import {createFleets,normalizeFleets,stepFleets} from '../src/naval-formations.js';
const carrier=warshipPreset('carrier');assert.deepEqual(validateWarship(carrier),[]);
const deck=carrier.parts.find(p=>p.type==='ship_flight_deck');assert.equal(deck.deckLength,240);assert.equal(deck.deckWidth,32);assert.equal(deckClearance(deck).getSize(new T.Vector3()).z,480);
const missing=structuredClone(carrier);missing.parts=missing.parts.filter(p=>p.type!=='ship_flight_deck');assert(carrierDeckErrors(missing).length);
const obstruction=structuredClone(carrier);obstruction.blocks.push({cell:[0,6,119],kind:'ship_hull',shape:'cube',shapeRotation:[0,0,0]});assert(carrierDeckErrors(obstruction).some(e=>e.includes('方块')),'120 m approach corridor must reject blocks');obstruction.blocks.at(-1).cell[2]=122;assert.deepEqual(carrierDeckErrors(obstruction),[]);
for(const [length,width]of [[170,27],[350,45]]){const c=structuredClone(carrier);c.parts=c.parts.filter(p=>['ship_engine','ship_flight_deck'].includes(p.type));Object.assign(c.parts.find(p=>p.type==='ship_flight_deck'),{deckLength:length,deckWidth:width});assert.deepEqual(carrierDeckErrors(c),[]);const compiled=createShip(normalizeWarship(c));assert.deepEqual(compiled.spec.parts.find(p=>p.type==='ship_flight_deck').def.size,[width,2,length]);}
const ship={team:'ally',flight:createShip(carrier)},plane={team:'player',flight:createFlight(voxelPreset('bf109'))},f=plane.flight;f.position.set(0,11+f.spec.contactHeight+.1,0);f.velocity.set(0,-1,-2);f.throttle=0;f.brake=1;f.surface='land';
const support=carrierSurface(plane,[ship]);assert(support&&support.top===11);f.groundLevel=support.top;stepFlight(f,.1);assert(f.alive&&f.grounded,'Safe gear-down landing must survive');
f.velocity.copy(ship.flight.velocity);f.ammo=0;for(const p of f.spec.parts){if(p.ammo)p.ammo=0;if(p.health>10)p.health-=5;}for(let i=0;i<6;i++)serviceOnCarrier(f,support,1);assert(f.carrierResupplied&&f.ammo>0);assert(f.spec.parts.every(p=>p.health===p.maxHealth));assert.equal(carrierSurface({...plane,team:'enemy'},[ship]),null);
ship.flight.spec.parts.find(p=>p.type==='ship_flight_deck').health=0;assert.equal(carrierSurface(plane,[ship]),null,'Destroyed deck must not support landing');
const units=['ally','enemy'].flatMap(team=>[{team,flight:createShip(warshipPreset('destroyer'))},{team,flight:createShip(carrier)}]),fleets=createFleets(units,normalizeFleets());assert.equal(fleets.length,4);
for(const team of ['ally','enemy']){const front=fleets.find(x=>x.team===team&&x.role==='surface'),rear=fleets.find(x=>x.team===team&&x.role==='carrier');assert.equal(front.anchor.distanceTo(rear.anchor),45000);}
for(let i=0;i<600;i++)stepFleets(fleets,1);for(const rear of fleets.filter(f=>f.role==='carrier')){assert.equal(rear.carrierMode,'rearPatrol');assert(!rear.tactical);const front=fleets.find(f=>f.team===rear.team&&f.role==='surface');assert(rear.anchor.distanceTo(front.anchor)>35000);}
console.log('PASS carrier83: required deck, size boundaries, 120 m clearance, dynamic collision size, gear-down landing, friendly resupply, destroyed deck rejection, separate 45 km rear patrol.');
