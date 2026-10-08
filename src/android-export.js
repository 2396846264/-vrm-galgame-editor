export function showExportChooser(){
 document.querySelector('#export-game-modal')?.remove();
 document.body.insertAdjacentHTML('beforeend','<section id="export-game-modal" class="android-export-overlay" role="dialog" aria-modal="true" aria-label="导出游戏"><div class="android-export-card"><h2>导出游戏</h2><p>选择玩家使用的设备。</p><div class="android-export-actions"><button data-action="export-windows">Windows 电脑版</button><button data-action="export-android">Android 手机 APK</button></div><p>手机版固定横屏 16:9，多出的屏幕区域用白色填充。首次导出会自动下载打包工具，需要联网。</p><small>打包工具使用 Android SDK 和 Eclipse Temurin。<a href="https://developer.android.com/studio/terms" target="_blank" rel="noopener">Android SDK 条款</a> · <a href="https://adoptium.net/about/" target="_blank" rel="noopener">Temurin</a></small><button data-action="close-export">取消</button></div></section>');
}
export function androidExportProgress(status){
 if(status.finished){document.querySelector('#android-export-progress')?.remove();return;}
 let node=document.querySelector('#android-export-progress');
 if(!node){document.body.insertAdjacentHTML('beforeend','<section id="android-export-progress" class="android-export-overlay" role="dialog" aria-modal="true" aria-label="正在导出 Android 游戏"><div class="android-export-card"><h2>正在导出 Android 游戏</h2><p data-apk-message></p><progress max="100" value="0"></progress><p>正在处理，请保持编辑器打开。工程和素材会保留。</p></div></section>');node=document.querySelector('#android-export-progress');}
 node.querySelector('[data-apk-message]').textContent=status.message||'准备导出';node.querySelector('progress').value=Math.max(0,Math.min(100,Number(status.percent)||0));
}
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selectedIcon='',iconLoading=false,iconRequest=0;
export function showAndroidSettings(project){
 document.querySelector('#export-game-modal')?.remove();document.querySelector('#android-export-settings')?.remove();
 const saved=project.authoring?.androidExport||{};iconRequest++;iconLoading=false;selectedIcon=saved.iconDataUrl||'';
 document.body.insertAdjacentHTML('beforeend',`<section id="android-export-settings" class="android-export-overlay" role="dialog" aria-modal="true" aria-label="Android 打包设置"><div class="android-export-card"><h2>Android 打包设置</h2><label class="field"><span>App 名称（显示在手机桌面）</span><input id="apk-app-name" maxlength="80" value="${escape(saved.appName||project.name)}"></label><label class="field"><span>App 版本</span><input id="apk-version-name" maxlength="32" placeholder="例如：1.0.0" value="${escape(saved.versionName||'1.0.0')}"></label><label class="field"><span>App 图标</span><div class="apk-icon-preview">${selectedIcon?`<img src="${escape(selectedIcon)}" alt="App 图标">`:'<span>请上传图标</span>'}</div><input id="apk-icon-file" type="file" accept="image/png,image/jpeg,image/webp"></label><p>建议使用正方形图片。图片会完整缩放居中，不裁剪。更新时会沿用本工程的签名，内部更新编号自动递增。</p><div class="android-export-actions"><button data-action="start-android-export">选择保存位置并导出</button><button data-action="close-export">取消</button></div></div></section>`);
}
export async function selectAndroidIcon(file){
 if(!file)return;if(file.size>16*1024*1024)throw Error('图标图片太大，请选择 16 MB 以内的图片。');
 const ticket=++iconRequest;iconLoading=true;let bitmap;try{bitmap=await createImageBitmap(file);if(bitmap.width>8192||bitmap.height>8192)throw Error('图标图片尺寸过大。');const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const scale=Math.min(512/bitmap.width,512/bitmap.height);canvas.getContext('2d').drawImage(bitmap,(512-bitmap.width*scale)/2,(512-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);if(ticket!==iconRequest)return;selectedIcon=canvas.toDataURL('image/png');}finally{bitmap?.close();if(ticket===iconRequest)iconLoading=false;}
 const preview=document.querySelector('.apk-icon-preview');if(preview)preview.innerHTML=`<img src="${selectedIcon}" alt="App 图标">`;
}
export function readAndroidSettings(){
 if(iconLoading)throw Error('正在读取图标，请稍候再导出。');
 const appName=document.querySelector('#apk-app-name')?.value.trim(),versionName=document.querySelector('#apk-version-name')?.value.trim();
 if(!appName)throw Error('请填写 App 名称。');if(!versionName||!/^\d{1,4}(\.\d{1,4}){0,3}(-[A-Za-z0-9.-]+)?$/.test(versionName))throw Error('请填写有效版本，例如 1.0.0。');if(!selectedIcon)throw Error('请上传 App 图标。');
 return {appName,versionName,iconDataUrl:selectedIcon};
}
