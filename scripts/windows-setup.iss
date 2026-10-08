#ifndef PackageRoot
  #error PackageRoot is required
#endif
[Setup]
AppId={{A3A46892-17CA-4D01-8A3B-63D3395A84C5}
AppName=VRM Galgame 编辑器
AppVersion=0.0.32
AppPublisher=VRM Galgame
DefaultDirName={localappdata}\Programs\VRMGalgame
DefaultGroupName=VRM Galgame
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=installer-output
OutputBaseFilename=VRMGalgame-Setup-0.0.32
SetupIconFile=..\Desktop\app.ico
UninstallDisplayIcon={app}\VRMGalgame.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=yes
[Messages]
SetupWindowTitle=安装 %1
WelcomeLabel1=欢迎使用 [name] 安装向导
WelcomeLabel2=将把编辑器安装到你的电脑上。点击“下一步”继续。
ButtonNext=下一步(&N) >
ButtonBack=< 上一步(&B)
ButtonInstall=安装(&I)
ButtonCancel=取消
ButtonFinish=完成
InstallingLabel=正在安装，请稍候。
FinishedHeadingLabel=[name] 安装完成
[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; Flags: unchecked
[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\VRM Galgame 编辑器"; Filename: "{app}\VRMGalgame.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\VRM Galgame 编辑器"; Filename: "{app}\VRMGalgame.exe"; WorkingDir: "{app}"; Tasks: desktopicon
[Run]
Filename: "{app}\VRMGalgame.exe"; Description: "启动编辑器"; Flags: nowait postinstall skipifsilent
