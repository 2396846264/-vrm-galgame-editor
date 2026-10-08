export function showExportChooser(){
 document.querySelector('#export-game-modal')?.remove();
 document.body.insertAdjacentHTML('beforeend','<section id="export-game-modal" class="android-export-overlay" role="dialog" aria-modal="true" aria-label="导出游戏"><div class="android-export-card"><h2>导出 Windows 游戏</h2><p>模型、图片、声音和剧情会打包到加密资源包中。</p><div class="android-export-actions"><button data-action="export-windows">导出 Windows 电脑版</button><button data-action="close-export">取消</button></div></div></section>');
}
