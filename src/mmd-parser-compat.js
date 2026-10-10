// Use the maintained parser with the static API expected by the r180 MMD port.
import {Parser,CharsetEncoder} from 'mmd-parser';
const parser=new Parser();
export const MMDParser=Object.fromEntries(['parsePmx','parsePmd','parseVmd','parseVpd','mergeVmds','leftToRightModel','leftToRightVmd'].map(name=>[name,(...args)=>parser[name](...args)]));
export {CharsetEncoder};
