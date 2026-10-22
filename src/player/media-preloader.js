import { actMediaAssets } from '../act-resources.js';
import { assetUrl } from '../platform/asset-url.js';

export function createMediaPreloader({ project: getProject }) {
  let activePreparedMedia = new Map(),
    activePreparedImages = [];
  function releasePreparedMedia() {
    for (const item of activePreparedMedia.values()) {
      item.pause?.();
      item.removeAttribute?.('src');
      item.load?.();
    }
    activePreparedMedia.clear();
    activePreparedImages = [];
  }
  function takePreparedAudio(id) {
    const item = activePreparedMedia.get(id);
    if (!item || item.tagName !== 'AUDIO') return null;
    activePreparedMedia.delete(id);
    return item;
  }
  async function prepareMedia(item, bundle) {
    if (!item) return;
    const node =
      item.type === 'image'
        ? new Image()
        : document.createElement(item.type === 'video' ? 'video' : 'audio');
    node.preload = 'auto';
    node.muted = true;
    bundle.media.push(node);
    bundle.mediaMap.set(item.id, node);
    await new Promise((resolve) => {
      let timer;
      const finish = () => {
        clearTimeout(timer);
        node.removeEventListener('load', finish);
        node.removeEventListener('loadeddata', finish);
        node.removeEventListener('error', finish);
        resolve();
      };
      node.addEventListener(item.type === 'image' ? 'load' : 'loadeddata', finish, { once: true });
      node.addEventListener('error', finish, { once: true });
      timer = setTimeout(finish, 5000);
      node.src = assetUrl(item);
      node.load?.();
    });
  }
  async function prepareCurrentActMedia(target, valid = () => true) {
    releasePreparedMedia();
    const bundle = { media: [], mediaMap: new Map() };
    await Promise.all(
      actMediaAssets(getProject(), target).map((item) => prepareMedia(item, bundle)),
    );
    if (!valid()) {
      for (const item of bundle.media) {
        item.pause?.();
        item.removeAttribute('src');
        item.load?.();
      }
      return;
    }
    activePreparedMedia = bundle.mediaMap;
    activePreparedImages = bundle.media.filter((item) => item.tagName === 'IMG');
  }
  return { releasePreparedMedia, takePreparedAudio, prepareCurrentActMedia };
}
