import createAmmo from 'ammojs-typed/wasm';
import wasmUrl from 'ammojs-typed/ammo.wasm.wasm?url';
// The existing MMD adapter expects Ammo's initialized API on the factory.
// Keep that API while using the same Bullet build through WebAssembly.
let ready;
function Ammo(){return ready||=(createAmmo.call(Ammo,{locateFile:()=>wasmUrl}).then(api=>{Object.assign(Ammo,api);return api;}));}
export default Ammo;
