# VRM Galgame 편집기 · 0.0.10

[简体中文](../README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

![편집기 기능 안내 그림](images/overview.svg)

3D VRM 캐릭터로 비주얼 노벨을 만드는 Windows 편집기입니다. 캐릭터, 대사, 동작, 배경, 소리를 배치하고 별도 창에서 시험 실행한 뒤 플레이 가능한 게임으로 내보낼 수 있습니다. 위 그림은 **기능 안내용 그림**이며 실제 화면 캡처는 아닙니다.

0.0.10에서는 GLB 물품의 뼈대 연결, 대사별 등장인물, 여러 타이틀 인물 및 Logo 숨기기를 추가했습니다. [중국어 그림 안내](物品绑定与多人标题_v0.0.10.md)를 참고하세요.

![0.0.10](images/v010/title-actors.png)

이번 버전은 미리보기 아래 소재 라이브러리를 이미지, VRM, 동작, 소리, 동영상 다섯 탭으로 정리했습니다. 이미지 썸네일, 폴더 이동, 더블클릭 가져오기, 파일 및 폴더 드래그 앤 드롭을 지원하며 그림자 높이와 프레임 번호 포즈 선택도 계속 사용할 수 있습니다. 이전의 초 단위 설정은 프레임으로 바뀌며 직접 올린 초상화는 유지됩니다. 유화 효과, 초상화만 있는 캐릭터, 화면 밖 대사, 흰색 편집기와 야간 모드도 계속 사용할 수 있습니다.

HarmonyOS Sans SC의 저작권은 Huawei Device Co., Ltd.에 있습니다. 전체 라이선스는 소스의 `../public/fonts/HarmonyOS_Sans_SC_LICENSE.txt`와 Windows 다운로드의 `web/fonts/`에서 확인할 수 있습니다.

## 주요 기능

- 막 단위로 이야기와 대사를 편집하고 VRM 표정, 동작, 위치, 앞뒤 거리를 설정합니다.
- 이미지, 동영상 배경, 음악, 효과음을 가져옵니다.
- 별도 창에서 시험 실행한 뒤 Windows 게임으로 내보냅니다.
- 프로젝트를 하나의 `.vrmg` 파일로 저장합니다.
- 저장, 자동 저장, 읽기 진행률, 감상 갤러리를 제공합니다.
- 공통 캐릭터 그림자를 포함한 렌더링 옵션을 조정합니다.

## 예시 및 효과 이미지

아래는 편집기, 제목 화면, 플레이 화면의 예시와 효과 이미지입니다. 이미지 속 예시 캐릭터와 배경 등의 소재는 **공개 다운로드 파일에 포함되지 않습니다**.

**이야기 편집 예시:** 막, 대사, 캐릭터, 배경을 배치합니다.

![이야기 편집 예시 및 효과 이미지](images/editor-story.png)

**제목 화면 효과 이미지:** 메뉴와 VRM 캐릭터의 예시입니다.

![제목 화면 예시 및 효과 이미지](images/title-screen.png)

**플레이 화면 효과 이미지:** 캐릭터, 배경, 대사를 함께 보여 줍니다.

![플레이 화면 예시 및 효과 이미지](images/gameplay.png)

![소재에서 게임까지의 흐름](images/workflow.svg)

## 다운로드와 시작

1. [GitHub Releases](https://github.com/2396846264/-vrm-galgame-editor/releases)에서 `VRMGalgame-0.0.7-win-x64.zip`을 다운로드합니다.
2. ZIP **전체를 압축 해제**하고 `VRMGalgame.exe`를 실행합니다.
3. 새 프로젝트를 만들거나 기존 `.vrmg` 파일을 엽니다.
4. 자신의 소재를 가져와 캐릭터와 이야기를 편집하고, 시험 실행으로 확인한 뒤 게임을 내보냅니다.

Windows 10/11 x64와 Microsoft Edge WebView2 Runtime이 필요합니다. 배포 ZIP에는 .NET 런타임이 포함됩니다.

지원 형식: 캐릭터 `.vrm`, 동작 `.vrma` / Mixamo `.fbx`, 이미지 `.png` / `.jpg` / `.jpeg` / `.webp`, 오디오 `.mp3` / `.wav` / `.ogg`, 동영상 배경 `.mp4` / `.webm`.

## 소스 빌드

Windows에 Node.js, npm, .NET 10 SDK를 설치하고 저장소 루트에서 실행합니다.

```powershell
npm ci
npm run build
dotnet publish Desktop/Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
Copy-Item -Recurse dist publish/web
```

`publish/VRMGalgame.exe`를 실행합니다. `WebView2Loader.dll`이 있으면 EXE 옆에 유지하세요. 제삼자 소재는 포함되지 않습니다. 이 저장소는 프로젝트 소스의 재사용 라이선스를 부여하지 않습니다.

제작자 Bilibili: [尸工U5十三世](https://b23.tv/krcyQ8I).




![Current character page example and visual preview](images/character-gallery-v0711.png)

[Step-by-step Chinese guide with asset rules](新手说明书.md)


![진행 상황 예시 및 효과 이미지](images/progress.png)


## 0.0.7

대사, 캐릭터 이름, 소개를 일괄 검색·바꾸기하고 실행 취소할 수 있습니다. 게임 이름은 제목 설정에서 변경합니다. PDF 지식 라이브러리는 지정한 막의 대사를 모두 읽으면 잠금이 해제되며, 잠긴 책은 흑백 표지와 빨간 띠로 표시합니다. 오프라인 양면 보기, 종이와 책등 그림자, 입체 페이지 넘기기, 방향키·스와이프·확대·읽던 위치 저장을 지원합니다. 막별 렌더링·색 보정·표지·재플레이와 유백색 유리 메뉴, 검은 글자, 그림자가 있는 테두리 없는 대사를 추가했습니다. 책 버튼, 설정 스크롤, 제목 음악, 실행 충돌, 중복 자동 초상화도 수정했습니다.

[Illustrated guide / 図解 / 그림 설명](新功能说明_0.0.7.md)

![PDF library preview](images/library-shelf-v0722.png)
