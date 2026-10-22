export function addInventoryItem(project, uid) {
  const item = { id: uid(), name: `物品${project.items.length + 1}`, description: '', imageId: '' };
  project.items.push(item);
  return item;
}

export function removeInventoryItem(project, index) {
  return project.items.splice(index, 1)[0];
}

export function addInventoryRow(holder, key, itemId) {
  holder[key] ||= [];
  holder[key].push({ itemId, quantity: 1 });
}

export function removeInventoryRow(holder, key, index) {
  holder[key].splice(index, 1);
}
