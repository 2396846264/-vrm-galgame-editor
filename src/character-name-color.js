export const defaultNameColor='#ffbfdc';
export const validNameColor=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
export const characterNameColor=role=>validNameColor(role?.nameColor)?role.nameColor.toLowerCase():defaultNameColor;
