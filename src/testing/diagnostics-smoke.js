import * as THREE from 'three';
import {normalizeWeather} from '../weather.js';
import {internalPortrait} from '../vrm-thumbnail.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
window.__vrmDiagnostics = () => ({
  directory: host.directory,
  editorAutoSaveMinutes: host.editorSettings.autoSaveMinutes,
  dirty: host.dirty,
  project: host.project?.name,
  mode: host.mode,
  modelLoaded: Boolean(host.stage?.vrm),
  modelId: host.stage?.currentModelId || '',
  motionPlaying: Boolean(host.stage?.mixer?._actions?.some(action => action.isRunning())),
  stageError: host.stageError,
  expressions: host.stage?.expressions() || [],
  dialogue: document.querySelector('#dialogue-text')?.textContent || '',
  typing: Boolean(host.typingTimer),
  textSpeed: host.textSpeed,
  assetDockVisible: Boolean(document.querySelector('.asset-dock')?.getBoundingClientRect().height),
  assetDockScrollHeight: document.querySelector('#asset-dock-body')?.scrollHeight || 0,
  assetDockHeight: document.querySelector('#asset-dock-body')?.clientHeight || 0,
  assetThumbnails: document.querySelectorAll('.asset-dock .asset-thumbnail').length,
  vrmEmbeddedThumbnails: document.querySelectorAll('.vrm-embedded-thumbnail').length,
  visibleImageAssets: host.project ? host.byType('image').length : 0,
  hiddenPortraitAssets: host.project?.assets.filter(a => internalPortrait(host.project, a)).length || 0,
  speakerPortraitVisible: Boolean(document.querySelector('#speaker-portrait:not(.hidden)')),
  speakerPortraitSrc: document.querySelector('#speaker-portrait img')?.getAttribute('src') || '',
  characterPortraitIds: host.project?.characters.map(item => ({ id:item.id, modelId:item.modelId,
    portraitId:item.portraitId, portraitSource:item.portraitSource, portraitPoseKey:item.portraitPoseKey,
    galleryMotionId:item.galleryMotionId, galleryPoseFrame:item.galleryPoseFrame })) || [],
  galleryFrameControl: (() => { const slider = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]');
    return slider ? { frame: Number(slider.value), max: Number(slider.max), disabled: slider.disabled,
      number: Number(document.querySelector('[data-gallery-frame-number]')?.value),
      label: document.querySelector('[data-gallery-output="galleryPoseFrame"]')?.textContent } : null; })(),
  visibleActorIds: [...(host.stage?.visibleRecords.keys() || [])],
  assets: host.project?.assets.length || 0
  ,playing: host.playing
  ,playerStartClass: document.querySelector('#player-start')?.className || ''
  ,playControlsClass: document.querySelector('#play-controls')?.className || ''
  ,stageWidth: Math.round(document.querySelector('.stage-frame')?.getBoundingClientRect().width || 0)
  ,stageHeight: Math.round(document.querySelector('.stage-frame')?.getBoundingClientRect().height || 0)
  ,saveSlotCount: host.mode === 'player' ? host.readSaveSlots().length : 0
  ,filledSaveSlots: host.mode === 'player' ? host.readSaveSlots().filter(Boolean).length : 0
  ,visibleSaveSlots: document.querySelectorAll('.save-slot').length
  ,autoSaveFilled: host.mode === 'player' ? Boolean(host.readSaveSlots()[0]?.auto) : false
  ,autoSaveWriteDisabled: Boolean(document.querySelector('[data-action="save-slot"][data-index="0"]:disabled'))
  ,manualSlotTwoDisabled: Boolean(document.querySelector('[data-action="save-slot"][data-index="1"]:disabled'))
  ,toastText: document.querySelector('#toast')?.textContent || ''
  ,lastClickAction: window.__lastClickAction || ''
  ,playerAutoSaveActive: Boolean(host.playerAutoSaveTimer)
  ,recentProjectCount: host.recentProjects.length
  ,recentProjectButtons: document.querySelectorAll('[data-action="open-recent"]').length
  ,lifetimeProgress: host.mode === 'player' ? host.loadLifetimeProgress() : null
  ,event: host.events.diagnostics()
  ,progressStats: host.mode === 'player' ? host.progressStatistics() : null
  ,progressModalOpen: Boolean(document.querySelector('#player-modal.progress-modal'))
  ,galleryImageCount: host.project?.assets.filter(item => item.type === 'image' && item.galleryImage !== false).length || 0
  ,galleryCharacterPickerVertical: Boolean(document.querySelector('.gallery-character-picker') && getComputedStyle(document.querySelector('.gallery-character-picker')).flexDirection === 'column')
  ,saveModalMode: host.saveModalMode
  ,transitioning: host.transitioning
  ,preparedAct: host.preparedAct
  ,preloadedModels: host.stage?.modelCache?.size || 0
  ,visibleModels: [...(host.stage?.visibleRecords?.values() || [])].filter(record => record.vrm.scene.visible).length
  ,sceneModels: host.stage?.scene?.children.filter(node => !node.isLight).map(node => ({ name: node.name, visible: node.visible, type: node.type, uuid: node.uuid })) || []
  ,castSlots: Object.fromEntries(Object.entries(host.step()?.cast||{}).map(([slot,value])=>[slot,value.characterId]))
  ,castSettings: host.step()?.cast || {}
  ,visibleActors: [...(host.stage?.visibleRecords?.entries() || [])].map(([id, record]) => ({
    attachedProps:[...(record.attachedProps?.values()||[])].map(p=>({id:p.binding.id,assetId:p.binding.assetId,bone:p.bone.name,position:p.binding.position,worldPosition:p.root.getWorldPosition(new THREE.Vector3()).toArray()})),
    id, x: record.anchor.position.x, y: record.anchor.position.y, z: record.anchor.position.z,
    shadowGroundY: host.stage?.shadowGroundHeightAt(record.anchor.position.x, record.anchor.position.z) ?? null,
    scale: record.anchor.scale.x,
    yaw: record.anchor.rotation.y, motionPlaying: record.mixer._actions?.some(action => action.isRunning()) || false,
    anchorPosition: record.anchor.position.toArray(), motionRootPosition: record.motionRoot.position.toArray(),
    happy: record.vrm.expressionManager?.getValue('happy') ?? null,
    expressionBlending: Boolean(record.expressionBlend),
    positionBlending: Boolean(record.transformBlend),
    motionId: record.currentMotionId,
    motionOptions: record.currentMotionOptions,
    actionTime: record.currentAction?.time ?? null,
    actionDuration: record.currentAction?.getClip()?.duration ?? null,
    actionPaused: record.currentAction?.paused ?? null,
    currentMotionWeight: record.currentAction?.getEffectiveWeight() ?? null,
    fadingMotionCount: record.fadeOutActions.length,
    hipsLocalPosition: record.vrm.humanoid.getNormalizedBoneNode('hips')?.position.toArray() || null,
    leftFootWorldY: record.vrm.humanoid.getNormalizedBoneNode('leftFoot')?.matrixWorld.elements[13] ?? null,
    rightFootWorldY: record.vrm.humanoid.getNormalizedBoneNode('rightFoot')?.matrixWorld.elements[13] ?? null,
    leftFootWorld: (() => { const e = record.vrm.humanoid.getNormalizedBoneNode('leftFoot')?.matrixWorld.elements; return e ? [e[12], e[13], e[14]] : null; })(),
    rightFootWorld: (() => { const e = record.vrm.humanoid.getNormalizedBoneNode('rightFoot')?.matrixWorld.elements; return e ? [e[12], e[13], e[14]] : null; })(),
    footLockActive: Boolean(record.footLock),
    footIKResidual: [record.footLock?.left?.lastResidual ?? null, record.footLock?.right?.lastResidual ?? null]
  }))
  ,editorHistory: host.editorHistory.status()
  ,actOrder: host.project?.acts.map(item => item.id) || []
  ,stepOrder: host.act()?.steps.map(item => item.id) || []
  ,assetFolders: host.project?.assetFolders || []
  ,stepCastPositions: host.step()?.castPositions || {}
  ,editorCharacterPreviewVisible: Boolean(document.querySelector('#character-preview:not(.hidden)'))
  ,editorCharacterPreviewStoryTabs: document.querySelectorAll('#character-preview [data-action="preview-story"]').length
  ,editorCharacterPreviewModel: host.stage?.currentModelId || ''
  ,stepMotionOptions: host.step()?.motionOptions || {}
  ,motionAdvancedClosed: [...document.querySelectorAll('.motion-advanced')].every(node => !node.open)
  ,dialogueBottom: document.querySelector('#dialogue') ? getComputedStyle(document.querySelector('#dialogue')).bottom : ''
  ,renderSettings: host.project?.render || {}
  ,paintEffectActive: false
  ,weather: host.stage?.weatherSettings || normalizeWeather()
  ,weatherParticles: host.stage?.weather?.particles.geometry.instanceCount || 0
  ,weatherSound: Boolean(host.stage?.weather?.audible)
  ,paintBackgroundReady: Boolean(host.stage?.paintBackgroundTexture)
  ,paintPixelRatio: host.stage?.paintPixelRatio ?? null
  ,averageFrameMs: host.stage?.averageFrameMs ?? null
  ,shadowPlaneVisible: Boolean(host.stage?.shadowPlane?.visible)
  ,shadowMapEnabled: Boolean(host.stage?.renderer?.shadowMap?.enabled)
  ,shadowPlaneOpacity: host.stage?.shadowPlane?.material?.opacity ?? null
  ,shadowLightPosition: host.stage?.shadowLight?.position?.toArray() || null
  ,backgroundLightReady: Boolean(host.stage?.currentLightProfile)
  ,outlineEnabled: Boolean(host.stage?.outlineEffect?.enabled)
  ,renderPixelRatio: host.stage?.renderer?.getPixelRatio() || 0
  ,keyLightColor: host.stage?.keyLight?.color?.getHexString() || ''
  ,nextButtons: document.querySelectorAll('[data-action="next"]').length
  ,currentScale: host.stage?.activeRecord?.anchor.scale.x || 0
  ,currentX: host.stage?.activeRecord?.anchor.position.x || 0
  ,currentY: host.stage?.activeRecord?.anchor.position.y || 0
  ,currentZ: host.stage?.activeRecord?.anchor.position.z || 0
  ,currentYaw: host.stage?.activeRecord?.anchor.rotation.y || 0
  ,currentPitch: host.stage?.activeRecord?.anchor.rotation.x || 0
  ,cameraY: host.stage?.camera?.position.y || 0
  ,activePanel: host.activePanel
  ,title: host.project?.title || {}
  ,titleMode: Boolean(document.querySelector('.stage-frame')?.classList.contains('title-mode'))
  ,titleMenuItems: document.querySelectorAll('.title-bottom-menu > *').length
  ,titleLogoImage: Boolean(document.querySelector('.title-logo-image'))
  ,titleExpressionSliders: document.querySelectorAll('[data-title-expression]').length
  ,titlePlayButtonHit: (() => {
    const button = document.querySelector('#player-start:not(.hidden) [data-action="play"]');
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('[data-action="play"]') === button;
  })()
  ,canvasVisible: document.querySelector('#stage-canvas')?.style.visibility !== 'hidden'
  ,audioSettings: host.audioSettings
  ,musicVolume: host.music.volume
  ,musicPlaying: !host.music.paused && host.music.currentTime > 0
  ,musicCurrentTime: host.music.currentTime
  ,voiceVolume: host.voice.volume
  ,autoPlay: host.autoPlay
  ,autoButtonText: document.querySelector('#auto-play-button')?.textContent || ''
  ,galleryTab: host.galleryTab
  ,galleryPage: host.galleryPage
  ,galleryTiles: document.querySelectorAll('.gallery-image-tile').length
  ,galleryLockedTiles: document.querySelectorAll('.gallery-image-tile.locked').length
  ,galleryLockedTracks: document.querySelectorAll('.gallery-track-list button.locked').length
  ,galleryCharacterSealed: Boolean(document.querySelector('.gallery-character-seal'))
  ,galleryLightbox: Boolean(document.querySelector('#gallery-lightbox'))
  ,galleryStoryTabs: document.querySelectorAll('.gallery-story-tabs button').length
  ,galleryStoryLocked: Boolean(document.querySelector('.gallery-story-locked'))
  ,galleryCharacterId: host.galleryCharacterId
  ,galleryStoryIndex: host.galleryStoryIndex
  ,galleryCharacterLoaded: Boolean(host.galleryStage?.vrm)
  ,galleryTrackCount: host.galleryTracks().length
  ,galleryTrackIndex: host.galleryTrackIndex
  ,galleryMusicPlaying: !host.galleryMusic.paused
  ,galleryRepeatOne: host.galleryRepeatOne
  ,playCharacterLineCounts: host.playCharacterLineCounts
  ,deepestSaveCounts: host.deepestSave() ? host.slotDialogueProgress(host.deepestSave()).counts : {}
  ,quickActionOrder: [...document.querySelectorAll('.scene-quick-actions [data-action]')].map(node => node.dataset.action)
  ,quickActionBottoms: [...document.querySelectorAll('.scene-quick-actions [data-action]')].map(node => Math.round(node.getBoundingClientRect().bottom))
  ,toonMaterials: [...(host.stage?.activeRecord?.materials?.keys() || [])].filter(material => material.isMToonMaterial).length
  ,toonFactor: [...(host.stage?.activeRecord?.materials?.keys() || [])].find(material => material.isMToonMaterial)?.shadingToonyFactor ?? null
  ,ambientIntensity: host.stage?.ambientLight?.intensity ?? null
  ,keyIntensity: host.stage?.keyLight?.intensity ?? null
  ,expressionSliders: document.querySelectorAll('[data-expression]').length
  ,happyWeight: host.stage?.vrm?.expressionManager?.getValue('happy') ?? null
  ,stepSize: host.step()?.size ?? null
  ,stepOffsetX: host.step()?.offsetX ?? null
  ,stepOffsetY: host.step()?.offsetY ?? null
  ,stepOffsetZ: host.step()?.offsetZ ?? null
  ,selectedStep: host.selectedStep
  ,stepCount: host.act()?.steps.length || 0
  ,selectedStepId: host.step()?.id || ''
  ,previousStepId: host.act()?.steps[host.selectedStep - 1]?.id || ''
  ,previousStepSize: host.act()?.steps[host.selectedStep - 1]?.size ?? null
  ,previousStepOffsetY: host.act()?.steps[host.selectedStep - 1]?.offsetY ?? null
  ,sameCharacterAsPrevious: host.selectedStep > 0 && host.step()?.characterId === host.act()?.steps[host.selectedStep - 1]?.characterId
  ,playAct: host.playAct
  ,playStep: host.playStep
});
}
