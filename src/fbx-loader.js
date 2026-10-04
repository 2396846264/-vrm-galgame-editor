import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {normalizeEmbeddedImageNames} from './fbx-embedded-images.js';
export class CompatibleFBXLoader extends FBXLoader {
  parse(buffer,path){return super.parse(normalizeEmbeddedImageNames(buffer),path);}
}
