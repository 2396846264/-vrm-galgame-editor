"""Reviewed editor terminology and primary interface copy, applied after catalog prep."""
import json, pathlib, re
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'src/editor-languages.json';c=json.loads(p.read_text('utf-8'))
for source,entry in c.items():
    text=entry['en']
    if '工程' in source:
        text=re.sub(r'\bengineering\b','project',text,flags=re.I)
        text=re.sub(r'\bconstruction\b','project',text,flags=re.I)
    if '幕' in source: text=re.sub(r'\bcurtains?\b','act',text,flags=re.I)
    if '角色' in source: text=re.sub(r'\broles?\b',lambda m:'characters' if m[0].lower().endswith('s') else 'character',text,flags=re.I)
    if '素材' in source: text=re.sub(r'\bmaterials?\b',lambda m:'assets' if m[0].lower().endswith('s') else 'asset',text,flags=re.I)
    if '存档' in source: text=re.sub(r'\barchives?\b','save',text,flags=re.I)
    if '读档' in source: text=text.replace('Read file','Load').replace('read file','load')
    if text: text=text[0].upper()+text[1:]
    entry['en']=text
    if '角色' in source: entry['ja']=entry['ja'].replace('の役割','キャラクター').replace('役割','キャラクター')
    if '幕' in source: entry['ja']=entry['ja'].replace('カーテン','チャプター')
overrides='''编辑器设置|Editor settings|エディター設定
编辑器语言|Editor language|エディターの言語
立即生效，并同步到已打开的编辑器窗口；不会翻译工程内容。|Applies immediately to all open editor windows. Project content stays in its original language.|開いているすべてのエディターにすぐ反映されます。プロジェクトの内容は翻訳されません。
公民文艺生产综合自动化系统|Civic Arts Production System|市民文芸制作総合自動化システム
场景|Scene|シーン
人物|Characters|キャラクター
角色|Characters|キャラクター
幕|Act|チャプター
对白|Dialogue|セリフ
剧情|Story|ストーリー
标题|Title|タイトル
渲染|Rendering|レンダリング
资料库|Library|資料ライブラリ
知识库|Knowledge base|ナレッジベース
物品|Items|アイテム
载具|Vehicles|乗り物
游戏 UI|Game UI|ゲーム UI
场景编辑器|Scene editor|シーンエディター
角色编辑器|Character editor|キャラクターエディター
物品编辑器|Item editor|アイテムエディター
标题编辑器|Title editor|タイトルエディター
渲染编辑器|Rendering editor|レンダリングエディター
知识库编辑器|Knowledge editor|ナレッジエディター
载具编辑器|Vehicle editor|乗り物エディター
游戏 UI编辑器|Game UI editor|ゲーム UI エディター
游戏 UI 编辑器|Game UI editor|ゲーム UI エディター
3D 环境编辑器|3D scene editor|3D シーンエディター
编辑器|Editor|エディター
新建工程|New project|新規プロジェクト
新工程名称|Project name|プロジェクト名
打开工程包|Open project|プロジェクトを開く
最近打开|Recently opened|最近開いた項目
最近打开的工程|Recent projects|最近使ったプロジェクト
新建|New|新規
打开|Open|開く
保存|Save|保存
另存为|Save as|名前を付けて保存
设置|Settings|設定
关闭|Close|閉じる
关闭 ×|Close ×|閉じる ×
取消|Cancel|キャンセル
取消 ×|Cancel ×|キャンセル ×
应用到工程|Apply to project|プロジェクトに適用
保存并应用到工程|Save and apply|保存して適用
导出游戏|Export game|ゲームを書き出す
试玩|Playtest|テストプレイ
剧情助手|Story assistant|ストーリーアシスタント
选择编辑器|Choose an editor|エディターを選択
编辑器 ▦|Editors ▦|エディター ▦
撤销|Undo|元に戻す
重做|Redo|やり直す
重播动作|Replay motion|モーションを再生
删除|Delete|削除
复制|Copy|コピー
粘贴|Paste|貼り付け
自动保存间隔|Auto-save interval|自動保存の間隔
每 5 分钟|Every 5 minutes|5 分ごと
每 10 分钟|Every 10 minutes|10 分ごと
每 30 分钟|Every 30 minutes|30 分ごと
每 1 小时|Every hour|1 時間ごと
界面外观|Appearance|外観
跟随系统 · 自动切换|System · automatic|システムに合わせる
日间 · 白色|Light|ライト
夜间 · 深灰色|Dark|ダーク
外观设置只影响编辑器；游戏外观在“游戏 UI”中选择。|Appearance applies to the editor. Choose the game appearance in Game UI.|エディターの外観設定です。ゲームの外観は「ゲーム UI」で選択できます。
第三方声明与许可|Third-party notices and licenses|サードパーティの表記とライセンス
切换到日间模式|Switch to light mode|ライトモードに切り替え
切换到夜间模式|Switch to dark mode|ダークモードに切り替え
切换夜间模式|Toggle dark mode|ダークモードを切り替え
● 未保存|● Unsaved|● 未保存
已保存|Saved|保存済み
✓ 已保存|✓ Saved|✓ 保存済み
● 未应用|● Not applied|● 未適用
✓ 已应用到工程|✓ Applied to project|✓ プロジェクトに適用済み
◌ 正在保存…|◌ Saving…|◌ 保存中…
正在保存…|Saving…|保存中…
未保存的修改|Unsaved changes|未保存の変更
保存并关闭|Save and close|保存して閉じる
直接关闭|Close without saving|保存せずに閉じる
本窗口的修改还没应用到工程。|Changes in this window have not been applied to the project.|このウィンドウの変更はまだプロジェクトに適用されていません。
环境还有未保存的修改。|The scene has unsaved changes.|シーンに未保存の変更があります。
要保存后关闭，还是直接关闭？|Save changes before closing?|変更を保存してから閉じますか？
界面风格|UI style|UI スタイル
经典玻璃|Classic glass|クラシックガラス
粉白舞台|Blush stage|桜色の舞台
青绿终端|Jade terminal|翡翠のターミナル
战术档案|Tactical archive|戦術アーカイブ
极昼终端|Daybreak terminal|白夜のターミナル
月下纸庭|Moonlit paper garden|月下の紙庭
雨幕旧刊|Rainy chronicle|雨の古書
星曜剧场|Astral theatre|星の劇場
加载动画|Loading animation|読み込みアニメーション
追光圆点|Orbiting dots|光の軌道
弧光圆环|Arc ring|光のリング
律动音阶|Rhythm bars|リズムバー
呼吸光点|Breathing dots|呼吸する光
战术雷达|Tactical radar|戦術レーダー
终端方块|Terminal tiles|ターミナルタイル
花瓣轮转|Spinning petals|回る花びら
时光沙漏|Hourglass|砂時計
动画颜色|Animation color|アニメーションの色
播放速度|Playback speed|再生速度
显示位置|Position|表示位置
居中|Center|中央
右下角|Bottom right|右下
底部居中|Bottom center|下中央
菜单布局|Menu layout|メニュー配置
跟随风格|Style default|スタイルに合わせる
底部横排|Bottom row|下部横並び
左侧目录|Left index|左側目次
右侧模块|Right modules|右側パネル
顶部导航|Top navigation|上部ナビゲーション
布局预览|Layout preview|レイアウトプレビュー
预览页面|Preview page|プレビュー画面
标题菜单|Title menu|タイトルメニュー
对白与快捷按钮|Dialogue and shortcuts|セリフとショートカット
加载画面|Loading screen|読み込み画面
标题 / 对白 / 加载|Title / Dialogue / Loading|タイトル / セリフ / 読み込み
参考配色|Color suggestions|配色の候補
作者调色盘|Author palette|制作者用パレット
恢复本套原色|Reset this palette|この配色を元に戻す
选择参考方案（不会自动应用）|Choose a suggestion|配色の候補を選択
使用所选配色|Use selected colors|選択した配色を使う
文字与描边|Text and outlines|文字と縁取り
正文文字|Body text|本文の文字
次要文字|Secondary text|補助テキスト
文字描边|Text outline|文字の縁取り
文字投影|Text shadow|文字の影
对白框与姓名牌|Dialogue and nameplate|セリフ枠と名前プレート
对白文字|Dialogue text|セリフの文字
对白背景|Dialogue background|セリフの背景
对白边框|Dialogue border|セリフ枠の線
姓名文字|Name text|名前の文字
姓名背景|Name background|名前の背景
姓名边框|Name border|名前枠の線
按钮与交互|Buttons and interaction|ボタンと操作
不透明度|Opacity|不透明度
恢复原色|Reset color|元の色に戻す
继续游戏|Continue|つづきから
开始游戏|New game|はじめから
载入游戏|Load game|ロード
系统设置|Settings|設定
附加鉴赏|Gallery|鑑賞
角色详情|Character details|キャラクター詳細
游玩进度|Progress|プレイ状況
退出游戏|Exit game|ゲームを終了
菜单|Menu|メニュー
自动播放|Auto|オート
历史|History|履歴
读档|Load|ロード
存档|Save|セーブ
物品栏|Inventory|所持品
全屏|Full screen|フルスクリーン
无|None|なし
粗调|Coarse|粗調整
微调|Fine|微調整
场景素材|Scene assets|シーン素材
全部素材|All assets|すべての素材
场景中的物品|Scene objects|シーン内のオブジェクト
参考人物|Reference characters|参考キャラクター
网格|Grid|グリッド
吸附|Snap|スナップ
快捷键|Shortcuts|ショートカット
移动|Move|移動
旋转|Rotate|回転
缩放|Scale|拡大縮小
框选|Box select|範囲選択
创建分组|Group|グループ化
拆开分组|Ungroup|グループ解除
创建地面|Add ground|地面を追加
创建灯光|Add light|ライトを追加
创建天空球|Add sky dome|スカイドームを追加
聚焦所选|Focus selection|選択対象にフォーカス
显示全景|Frame all|全体を表示
载具文件|Vehicle file|乗り物ファイル
方块与功能附件|Blocks and attachments|ブロックと機能パーツ
形状|Shape|形状
颜色|Color|色
液态玻璃|Liquid glass|リキッドガラス
液态玻璃 · 原版外观|Liquid glass · original design|リキッドガラス · オリジナル
已打开 {0}|Opened {0}|{0} を開きました
工程还有未保存的修改。|The project has unsaved changes.|プロジェクトに未保存の変更があります。
工程或其他编辑窗口还有未保存的修改。|The project or another editor has unsaved changes.|プロジェクトまたは別のエディターに未保存の変更があります。
↶ 撤销|↶ Undo|↶ 元に戻す
↷ 重做|↷ Redo|↷ やり直す
倍|×|倍
说话角色|Speaker|話者
镜头|Camera|カメラ
预设|Preset|プリセット
预设名称|Preset name|プリセット名
自然待机（自动）|Natural idle (automatic)|自然な待機（自動）'''
for row in overrides.splitlines():
    source,en,ja=row.split('|');c[source]={'en':en,'ja':ja}
p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n','utf-8')
print(f'Reviewed terminology applied to {len(c)} entries.')
