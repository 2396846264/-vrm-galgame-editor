"""Build a local, self-contained sample from the four user-provided folders.

Usage: python scripts/create_all_assets_sample.py OUTPUT.vrmg
The source assets stay in their original folders. Do not publish the resulting
archive without confirming the rights for every image and audio file.
"""

from __future__ import annotations

import json
import sys
import uuid
import zipfile
from pathlib import Path


ROOT = Path('D:/2/2')
SOURCES = {
    'bgm': ROOT / 'Audio/BGM/bgm',
    'se': ROOT / 'Audio/SE',
    'background': ROOT / 'Graphics/Picture/Background/背景图片(白天）',
    'title': ROOT / 'Graphics/System/Title',
}


def new_id(prefix: str) -> str:
    return prefix + '-' + uuid.uuid4().hex


def collect(folder: Path) -> list[Path]:
    if not folder.is_dir():
        raise FileNotFoundError(folder)
    return sorted((path for path in folder.rglob('*') if path.is_file()), key=lambda path: str(path).casefold())


def main(output: Path) -> None:
    files = {key: collect(folder) for key, folder in SOURCES.items()}
    expected = {'bgm': 26, 'se': 22, 'background': 14, 'title': 2}
    assert {key: len(value) for key, value in files.items()} == expected, 'Source files changed; inspect before rebuilding.'

    project = {
        'version': 1, 'id': new_id('showcase'), 'name': '全部素材示例 · 画面与声音巡游',
        'ui': {'dialogueImageId': '', 'clickSoundId': ''},
        'title': {'logoImageId': '', 'backgroundId': '', 'modelId': '', 'motionId': '',
                  'expressionWeights': {}, 'bgmId': '', 'authorNote': '64 个素材都可逐个体验',
                  'size': 1.7, 'offsetX': .65, 'offsetY': -1.15, 'offsetZ': 0,
                  'yaw': 0, 'pitch': 0, 'cameraAngle': 12},
        'render': {'antialias': 'standard', 'style': 'original', 'outline': 0,
                   'autoLight': True, 'lightStrength': .6, 'shadowEnabled': False,
                   'shadowAngle': 0, 'shadowOpacity': .45, 'shadowHeight': 0,
                   'paintEffect': 'none', 'paintStrength': .65},
        'assets': [], 'assetFolders': [], 'characters': [], 'acts': [],
    }
    folders = {}
    for key, label, kind in [('bgm', '背景音乐', 'audio'), ('se', '场景音效', 'audio'),
                             ('background', '白天背景', 'image'), ('title', '标题图片', 'image')]:
        folders[key] = new_id('folder')
        project['assetFolders'].append({'id': folders[key], 'type': kind, 'name': label})

    mapping: dict[str, list[tuple[Path, dict]]] = {}
    for key, paths in files.items():
        mapping[key] = []
        kind = 'audio' if key in ('bgm', 'se') else 'image'
        for index, path in enumerate(paths, 1):
            entry = {'id': new_id(key), 'type': kind, 'name': path.name,
                     'path': f'assets/{kind}/{key}-{index:02}{path.suffix.lower()}',
                     'folderId': folders[key]}
            if kind == 'audio':
                entry['galleryMusic'] = key == 'bgm'
            else:
                entry['galleryImage'] = key == 'background'
            project['assets'].append(entry)
            mapping[key].append((path, entry))

    title_by_name = {path.name: item for path, item in mapping['title']}
    project['title']['backgroundId'] = title_by_name['标题界面.png']['id']
    project['title']['bgmId'] = mapping['bgm'][0][1]['id']
    click = next(item for path, item in mapping['se'] if path.name == 'sys_0.mp3')
    project['ui']['clickSoundId'] = click['id']

    def make_act(name: str, background_id: str, bgm_id: str, lines: list[dict]) -> dict:
        return {'id': new_id('act'), 'name': name, 'backgroundId': background_id,
                'bgmId': bgm_id, 'cast': {'left': '', 'center': '', 'right': ''},
                'castSettings': {}, 'steps': lines}

    def make_step(text: str, se_id: str = '') -> dict:
        return {'id': new_id('step'), 'characterId': '', 'speaker': '素材向导',
                'text': text, 'expressionWeights': {}, 'motionId': '',
                'position': 'center', 'size': 1.15, 'offsetX': 0, 'offsetY': 0,
                'voiceId': '', 'seId': se_id, 'choices': []}

    intro_background = title_by_name['back-main.jpg']['id']
    project['acts'].append(make_act('序章 · 标题图片', intro_background,
                                    mapping['bgm'][0][1]['id'],
                                    [make_step('这里展示标题文件夹的另一张图片。点击画面空白处或按空格，继续巡游所有背景、音乐和音效。')]))
    for index, (music_path, music_item) in enumerate(mapping['bgm']):
        bg_path, bg_item = mapping['background'][index % len(mapping['background'])]
        se_path, se_item = mapping['se'][index] if index < len(mapping['se']) else (None, None)
        text = f'第 {index + 1} 站。背景：{bg_path.name}。音乐：{music_path.name}。'
        if se_path:
            text += f'这一句还会播放音效：{se_path.name}。'
        else:
            text += '这一站专心听背景音乐。'
        project['acts'].append(make_act(f'第 {index + 1:02} 站 · {bg_path.stem}', bg_item['id'],
                                        music_item['id'], [make_step(text, se_item['id'] if se_item else '')]))

    references = {project['title']['backgroundId'], project['title']['bgmId'], project['ui']['clickSoundId']}
    for act in project['acts']:
        references.update((act['backgroundId'], act['bgmId']))
        references.update(step['seId'] for step in act['steps'] if step['seId'])
    assert len(project['assets']) == 64
    assert all(item['id'] in references for item in project['assets']), 'Every source asset must be used in a playable scene.'

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', allowZip64=True) as archive:
        archive.writestr('project.json', json.dumps(project, ensure_ascii=False, indent=2).encode('utf-8'))
        for entries in mapping.values():
            for path, item in entries:
                archive.write(path, item['path'], compress_type=zipfile.ZIP_STORED)

    lines = [
        '# 全部素材示例 · 使用说明', '',
        '这是一个可直接用编辑器打开的 `.vrmg` 工程包。原始素材文件没有被移动或修改。', '',
        '## 怎么玩', '',
        '1. 打开 `VRMGalgame.exe`，点“打开”，选 `全部素材示例.vrmg`。',
        '2. 点“试玩”，再点“开始游戏”。',
        '3. 每点一次画面空白处，或按空格 / Enter，就前进一句。文字没显示完时，第一次点击会先显示完整句子。',
        '4. 标题和游戏里的按钮会响。标题页点“系统设置”，或游戏里点右上角“菜单”，可调音效音量和文字速度。',
        '5. 点击编辑器中间下方的素材库，可查看所有图片缩略图；内容多时在素材库里滚动。', '',
        '## 素材去了哪里', '',
        '| 来源 | 数量 | 在游戏里的位置 |', '| --- | ---: | --- |',
        '| BGM/bgm | 26 | 每一站用一首背景音乐 |',
        '| Audio/SE | 22 | 前 22 站各播放一个场景音效；sys_0 同时用作按钮音效 |',
        '| 背景图片(白天） | 14 | 26 站轮流展示 |',
        '| Graphics/System/Title | 2 | 标题背景和序章背景 |', '',
        '## 音量和文字', '',
        '- **总音量**：所有声音一起变大或变小。',
        '- **背景音乐**：只管 BGM。',
        '- **角色语音**：只管语音。',
        '- **按钮与场景音效**：管点击声和每站的音效。调到 0% 就静音。',
        '- **文字出现速度**：数字越大，字出来得越快。', '',
        '## 素材使用清单', '',
    ]
    for key, label in [('title', '标题图片'), ('background', '白天背景'), ('bgm', '背景音乐'), ('se', '场景音效')]:
        lines.extend([f'### {label}', ''])
        lines.extend(f'- {path.name}' for path, _ in mapping[key])
        lines.append('')
    lines.extend(['## 注意', '',
                  '这个工程使用你提供的素材。公开发布游戏或把素材上传到 GitHub 前，请确认每个素材允许这样使用。',
                  'MP3、WAV 用作声音；PNG、JPG 用作图片。不要只改扩展名来伪装格式。', ''])
    doc = output.with_name(output.stem + '_使用说明.md')
    doc.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Built {output} ({output.stat().st_size:,} bytes), {len(project["assets"])} assets, {len(project["acts"])} acts')
    print(f'Documentation: {doc}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/create_all_assets_sample.py OUTPUT.vrmg')
    main(Path(sys.argv[1]))
