import { field, escape, button } from '../../ui/markup.js';
import { assetUrl } from '../../platform/asset-url.js';

// Read-only markup; editing and asynchronous work belong to the controller.
export function renderItemPanel({ item, asset }) {
  return item
    ? `<div class="inspector-content"><h2>玩家物品设置</h2>${field('名字', `<input data-item-field="name" maxlength="100" value="${escape(item.name)}">`)}${asset(item.imageId) ? `<img class="inventory-editor-image" src="${escape(assetUrl(asset(item.imageId)))}" alt="${escape(item.name)}">` : '<p class="tip">还没有立绘。</p>'}${button('上传物品立绘（自动整理为 1:1）', 'upload-inventory-image')}${field('物品介绍（建议约 100 字）', `<textarea data-item-field="description" maxlength="3000" placeholder="写清用途、来历和特点">${escape(item.description || '')}</textarea>`)}<p class="tip">所有物品统一管理。名字、立绘、介绍都填写后才可用于对白；是否扣除由分支选项决定。</p>${button('删除物品', 'delete-inventory-item', 'class="danger"')}</div>`
    : '<p class="tip">先新增物品。</p>';
}
