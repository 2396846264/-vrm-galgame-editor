export const assetUrl = (asset) =>
  asset
    ? `https://project.galgame/${asset.path.split('/').map(encodeURIComponent).join('/')}${asset.revision ? `?v=${encodeURIComponent(asset.revision)}` : ''}`
    : '';
