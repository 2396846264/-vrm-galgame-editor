export const modelTypes = ['vrm', 'fbxCharacter', 'mmdCharacter'],
  collections = {
    environment: 'environments',
    act: 'acts',
    character: 'characters',
    item: 'items',
    book: 'knowledgeBooks',
    renderPreset: 'renderPresets',
    asset: 'assets',
    folder: 'assetFolders',
  };

export const projectAgentFields = {
  environment: ['name', 'background', 'camera', 'lighting'],
  project: ['name', 'authoring'],
  ui: [
    'gameTheme',
    'gamePalettes',
    'loading',
    'layout',
    'dialogueImageId',
    'clickSoundId',
    'spatialCamera',
    'roleDetailsRender',
  ],
  title: [
    'subtitle',
    'logoImageId',
    'environmentId',
    'backgroundId',
    'bgmId',
    'authorNote',
    'render',
    'spatialCamera',
  ],
  act: ['name', 'backgroundId', 'bgmId', 'environmentId', 'coverImageId', 'weather', 'event'],
  dialogue: [
    'offstage',
    'text',
    'speaker',
    'characterId',
    'voiceId',
    'seId',
    'render',
    'camera',
    'cast',
    'sceneAnimations',
    'itemGrants',
  ],
  character: [
    'name',
    'nameColor',
    'title',
    'description',
    'modelId',
    'portraitId',
    'portraitSource',
    'autoMouth',
    'detailsIdleId',
    'galleryMotionId',
    'motionFit',
    'motionFitOverrides',
    'stories',
  ],
  titleActor: [
    'characterId',
    'modelId',
    'motionId',
    'motionOptions',
    'expressionWeights',
    'size',
    'offsetX',
    'offsetY',
    'offsetZ',
    'yaw',
    'pitch',
    'props',
  ],
  prop: ['name', 'assetId', 'bone', 'position', 'rotation', 'scale'],
  choice: ['text', 'actId', 'requirements', 'consumeRequired'],
  item: ['name', 'imageId', 'description'],
  book: ['name', 'pdfId', 'coverId', 'description', 'unlockActId'],
  renderPreset: ['name', 'settings'],
  asset: ['name', 'description', 'tags', 'folderId', 'audioKind', 'galleryImage', 'galleryMusic'],
  folder: ['name', 'type', 'audioKind'],
};

export function projectTextFields(p) {
  const out = [],
    add = (o, k, label) => {
      if (typeof o?.[k] === 'string') out.push({ object: o, key: k, label });
    };
  for (const a of p.acts) {
    add(a, 'name', '幕名称');
    if (a.kind === 'event') {
      for (const k of [
        'title',
        'body',
        'paperName',
        'date',
        'quote',
        'buttonText',
        'countryA',
        'countryB',
      ])
        add(a.event, k, '事件 ' + a.name);
      for (const row of a.event?.declarations || [])
        for (const k of ['countryA', 'countryB', 'body']) add(row, k, '连发事件');
    }
    for (const l of a.steps || []) {
      add(l, 'speaker', '显示名字');
      add(l, 'text', '对白');
      for (const c of l.choices || []) add(c, 'text', '分支选项');
    }
  }
  for (const r of p.characters) {
    for (const k of ['name', 'title', 'description']) add(r, k, '角色 ' + r.name);
    for (const s of r.stories || []) for (const k of ['title', 'text']) add(s, k, '角色故事');
  }
  for (const i of [...(p.items || []), ...(p.knowledgeBooks || [])])
    for (const k of ['name', 'description']) add(i, k, '物品或书本');
  add(p.title, 'authorNote', '制作说明');
  return out;
}
