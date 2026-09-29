# VRM Galgame エディター · 0.0.6

[简体中文](../README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

![エディターの機能イメージ](images/overview.svg)

VRM の 3D キャラクターを使ってビジュアルノベルを作る Windows 用エディターです。キャラクター、台詞、モーション、背景、音声を配置し、別ウィンドウで試遊してからゲームを書き出せます。上の画像は**機能の説明図**であり、実際の画面写真ではありません。

**0.0.6 は最新の公開版です。**ローカル版 v0.7.15 の機能を含み、旧版 0.0.3 も引き続きダウンロードできます。VRM モデル、Mixamo モーション、サンプル作品の素材は含まれません。利用権のある素材を読み込んでください。

この版では、プレビュー下の素材ライブラリを画像、VRM、モーション、音声、動画の5タブに整理しました。画像サムネイル、フォルダー移動、ダブルクリック読み込み、ファイルやフォルダーのドラッグ＆ドロップに対応し、影の高さ調整とフレーム番号によるポーズ指定も引き続き使えます。旧版の秒数はフレームに変換され、手動の顔写真は変更されません。油彩風効果、画像だけのキャラクター、画面外からの台詞、白いエディターと夜間モードも引き続き使えます。

HarmonyOS Sans SC の著作権は Huawei Device Co., Ltd. に帰属します。ライセンス全文はソースの `../public/fonts/HarmonyOS_Sans_SC_LICENSE.txt`、Windows ダウンロードの `web/fonts/` にあります。

## 主な機能

- 「幕」ごとに台詞と場面を編集し、VRM の表情、モーション、位置、奥行きを設定。
- 画像、動画背景、音楽、効果音を読み込み。
- 別ウィンドウで試遊し、Windows 用のゲームを書き出し。
- 作品を単一の `.vrmg` ファイルに保存。
- セーブ、自動セーブ、読了進捗、鑑賞モード。
- レンダリング設定と、任意で有効にできる共通のキャラクター影。

## サンプルと効果イメージ

以下はエディター、タイトル画面、プレイ画面のサンプルと効果イメージです。画像に写っている人物や背景などのサンプル素材は**公開ダウンロードには含まれません**。

**物語編集のサンプル**：幕、台詞、人物、背景を配置します。

![物語編集のサンプルと効果イメージ](images/editor-story.png)

**タイトル画面の効果イメージ**：メニューと VRM 人物の例です。

![タイトル画面のサンプルと効果イメージ](images/title-screen.png)

**プレイ画面の効果イメージ**：人物、背景、台詞を組み合わせた例です。

![プレイ画面のサンプルと効果イメージ](images/gameplay.png)

![素材からゲームまでの流れ](images/workflow.svg)

## ダウンロードと使い方

1. [GitHub Releases](https://github.com/2396846264/-vrm-galgame-editor/releases) から `VRMGalgame-0.0.6-win-x64.zip` を入手します。
2. ZIP を**すべて展開**し、`VRMGalgame.exe` を起動します。
3. 新しいプロジェクトを作るか、既存の `.vrmg` を開きます。
4. 自分の素材を読み込み、キャラクターと物語を編集し、「試遊」で確認してからゲームを書き出します。

Windows 10/11 x64 と Microsoft Edge WebView2 Runtime が必要です。.NET ランタイムは配布用 ZIP に含まれます。

対応形式：キャラクター `.vrm`、モーション `.vrma` / Mixamo `.fbx`、画像 `.png` / `.jpg` / `.jpeg` / `.webp`、音声 `.mp3` / `.wav` / `.ogg`、動画背景 `.mp4` / `.webm`。

## ソースからビルド

Windows に Node.js、npm、.NET 10 SDK を用意し、リポジトリのルートで実行します。

```powershell
npm ci
npm run build
dotnet publish Desktop/Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
Copy-Item -Recurse dist publish/web
```

`publish/VRMGalgame.exe` を起動します。`WebView2Loader.dll` が生成された場合は EXE の隣に残してください。第三者の素材は同梱していません。このリポジトリは本プロジェクトのソースコードについて再利用ライセンスを付与していません。

作者の Bilibili：[尸工U5十三世](https://b23.tv/krcyQ8I)。




![Current character page example and visual preview](images/character-gallery-v0711.png)

[Step-by-step Chinese guide with asset rules](新手说明书.md)


![進行状況のサンプルと効果イメージ](images/progress.png)
