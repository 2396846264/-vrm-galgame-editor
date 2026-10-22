import { ensureFirepowers } from '../firepower-schema.js';
import { normalizeMotionFit } from '../motion-fit.js';
import { ensureShipLibrary } from '../vehicle-documents.js';
import { characterNameColor } from '../character-name-color.js';
import { ensureVehicleLibrary } from '../vehicle-documents.js';
import { syncAssetOrganization } from '../asset-organization.js';
import { normalizePortraitFraming } from '../portrait-framing.js';
import { normalizeSpatialCamera } from '../spatial-camera.js';
import { migrateTitleActors } from '../title-actors.js';
import { dialogueSlots, migrateDialogueCast } from '../dialogue-cast.js';
import { normalizeLoading, normalizeUiLayout } from '../game-ui-loading.js';
import { normalizeGameUi } from '../game-ui.js';
import { normalizeGamePalettes } from '../game-ui-palette.js';
import { migrateRenderPresets, renderSelection } from '../render-presets.js';
import { isEvent, normalizeEvent } from '../events/schema.js';
import { normalizeWeather } from '../weather.js';
import { migrateEnvironments } from '../environment-schema.js';

// Project data only. Session state and UI refresh stay with their owners.
export function createProject(name, uid, defaultSize = 1.15) {
  const result = {
    version: 1,
    id: uid(),
    name: name || '我的 VRM 故事',
    ui: { dialogueImageId: '', clickSoundId: '' },
    title: {
      logoImageId: '',
      backgroundId: '',
      modelId: '',
      motionId: '',
      expressionWeights: {},
      bgmId: '',
      authorNote: '',
      size: 1.7,
      offsetX: 0.65,
      offsetY: -1.15,
      offsetZ: 0,
      yaw: 0,
      pitch: 0,
      cameraAngle: 12,
    },
    renderPresetSchema: 1,
    renderPresets: [],
    render: renderSelection(),
    assets: [],
    assetFolders: [],
    characters: [],
    items: [],
    acts: [
      {
        id: uid(),
        name: '第一幕',
        backgroundId: '',
        bgmId: '',
        weather: normalizeWeather(),
        steps: [
          {
            id: uid(),
            characterId: '',
            speaker: '',
            text: '在这里写第一句对白。',
            expressionWeights: {},
            motionId: '',
            position: 'center',
            size: defaultSize,
            offsetX: 0,
            offsetY: 0,
            voiceId: '',
            choices: [],
          },
        ],
      },
    ],
  };
  ensureVehicleLibrary(result);
  ensureShipLibrary(result);
  ensureFirepowers(result);
  return result;
}

export function normalizeProject(project, uid) {
  migrateEnvironments(project);
  project.knowledgeBooks ||= [];
  project.items ||= [];
  for (const item of project.items) delete item.consumable;
  project.assets ||= [];
  project.assetFolders ||= [];
  for (const folder of project.assetFolders)
    if (folder.id === 'auto-character-portraits') folder.hidden = true;
  project.characters ||= [];
  for (const item of project.characters) {
    item.motionFit = normalizeMotionFit(item.motionFit);
    item.autoMouth = item.autoMouth !== false;
    item.nameColor = characterNameColor(item);
    item.portraitId ||= '';
    item.portraitSource ||= item.portraitId
      ? project.assets.find((asset) => asset.id === item.portraitId)?.name === '自动头像.png'
        ? 'auto'
        : 'manual'
      : '';
    item.title ||= '';
    item.description ||= '';
    item.galleryMotionId ||= '';
    item.detailsIdleId ||= '';
    item.galleryYaw = Number.isFinite(Number(item.galleryYaw)) ? Number(item.galleryYaw) : 0;
    item.galleryPoseFrame =
      Number.isFinite(Number(item.galleryPoseFrame)) && Number(item.galleryPoseFrame) >= 1
        ? Math.floor(Number(item.galleryPoseFrame))
        : Math.max(1, Math.round((Number(item.galleryPoseTime) || 0) * 30) + 1);
    item.stories = Array.from({ length: 3 }, (_, index) => ({
      text: '',
      unlockLines: 0,
      ...(item.stories?.[index] || {}),
    }));
  }
  project.acts ||= [];
  project.ui ||= { dialogueImageId: '', clickSoundId: '' };
  project.ui.clickSoundId ||= '';
  project.ui.gameTheme = normalizeGameUi(project.ui.gameTheme);
  project.ui.loading = normalizeLoading(project.ui.loading);
  project.ui.layout = normalizeUiLayout(project.ui.layout);
  project.ui.gamePalettes = normalizeGamePalettes(project.ui.gamePalettes);
  project.ui.spatialCamera = normalizeSpatialCamera(project.ui.spatialCamera);
  project.ui.portraitFraming = normalizePortraitFraming(project.ui.portraitFraming);
  project.title = {
    logoImageId: '',
    backgroundId: '',
    modelId: '',
    motionId: '',
    expressionWeights: {},
    bgmId: '',
    authorNote: '',
    size: 1.7,
    offsetX: 0.65,
    offsetY: -1.15,
    offsetZ: 0,
    yaw: 0,
    pitch: 0,
    cameraAngle: 12,
    ...project.title,
  };
  migrateTitleActors(project.title, uid);
  project.title.spatialCamera = normalizeSpatialCamera(project.title.spatialCamera);
  migrateRenderPresets(project);
  for (const item of project.acts) {
    if (isEvent(item)) {
      item.event = normalizeEvent(item.event);
      item.cast = {};
      item.castSettings = {};
      item.steps = [
        {
          id: item.steps?.[0]?.id || uid(),
          render: item.steps?.[0]?.render,
          text: '',
          speaker: '',
          characterId: '',
          choices: [],
        },
      ];
    }
    item.coverImageId ||= '';
    item.weather = normalizeWeather(item.weather);
    item.steps ||= [];
    item.castSettings ||= {};
    if (!item.cast && item.steps.some((entry) => !entry.cast)) {
      const distinct = [...new Set(item.steps.map((entry) => entry.characterId).filter(Boolean))];
      item.cast = { left: '', center: '', right: '' };
      for (const id of distinct.slice(0, dialogueSlots.length)) {
        const preferred =
          item.steps.find((entry) => entry.characterId === id)?.position || 'center';
        const slot =
          dialogueSlots.includes(preferred) && !item.cast[preferred]
            ? preferred
            : dialogueSlots.find((key) => !item.cast[key]);
        if (slot) item.cast[slot] = id;
      }
    }
    for (const entry of item.steps) entry.choices ||= [];
  }
  ensureVehicleLibrary(project);
  ensureShipLibrary(project);
  ensureFirepowers(project);
  migrateDialogueCast(project);
  syncAssetOrganization(project, uid);
  return project;
}
