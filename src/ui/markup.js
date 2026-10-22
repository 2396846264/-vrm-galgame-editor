import { editorLabel, editorText, editorAttributes } from '../editor-language.js';

export const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export const options = (items, value, empty = '无') =>
  `<option value="">${editorLabel(empty)}</option>${items
    .map(
      (item) =>
        `<option value="${escape(item.id)}" ${item.id === value ? 'selected' : ''}>${escape(item.name)}</option>`,
    )
    .join('')}`;
export const field = (label, control) =>
  `<label class="field"><span>${editorLabel(label)}</span>${control}</label>`;
export const input = (key, value, placeholder = '') =>
  `<input data-field="${key}" value="${escape(value)}" placeholder="${escape(editorText(placeholder))}" data-editor-placeholder="${escape(placeholder)}">`;
export const textarea = (key, value, placeholder = '') =>
  `<textarea data-field="${key}" placeholder="${escape(editorText(placeholder))}" data-editor-placeholder="${escape(placeholder)}">${escape(value)}</textarea>`;
export const select = (key, items, value, empty) =>
  `<select data-field="${key}">${options(items, value, empty)}</select>`;
export const button = (label, action, extra = '') =>
  `<button type="button" data-action="${action}" ${editorAttributes(extra)}>${editorLabel(label)}</button>`;
