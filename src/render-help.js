import {editorLabel,editorText,setEditorText} from './editor-language.js';
// Plain-language explanations shared by preset, title and dialogue editors.
export const renderHelp={
 preset:'选择已经做好的画面效果。选择“原始画面”就不用滤镜。预设内容在渲染编辑器中修改。',
 presetName:'给这份画面效果起一个容易记住的名字。名字不会改变画面。',
 brightness:'让整张画面变亮或变暗。100 是原来的亮度；越大越亮。太高会让白色细节消失。',
 contrast:'调整亮处和暗处的差别。100 是原样；调高更鲜明，调低更柔和。',
 saturation:'调整颜色有多浓。100 是原样，0 接近黑白；太高会显得刺眼。',
 toon:'把光照做成动画里的大片明暗色块。0 保留模型原来的光照；越大分层越明显。',
 toonSteps:'色块光照开启后，VRM、FBX、MMD 的光照分成几层明暗。少一些像动画，多一些更平滑。要有亮面和暗面才能看清区别。',
 toonThreshold:'色块光照开启后，移动亮面和暗面的分界。调大亮面更多，调小暗面更多。',
 toonSoftness:'色块光照开启后，让明暗交界变柔和。0 分界较硬，调大后过渡更平滑。',
 specular:'调节 FBX、MMD 和场景材质已有的反光。0 去掉反光，1 保持原样，2 加强。模型没有反光时，调这项也不会凭空发光；VRM 专用材质通常没有这类反光。',
 simplify:'合并小碎细节，让大色块更干净。0 关闭；太高可能抹掉衣服和脸上的细节。',
 posterize:'限制一张画面里颜色的层数。0 关闭；层数越少，颜色分块越明显。',
 posterMix:'已经开启色调分离时，调整分块效果占多少。0 原样，1 完全使用分块颜色。',
 ao:'让墙角、物体靠近处稍微变暗，看起来更有厚度。0 关闭；调太大容易发脏，需要三维场景。',
 aoRadius:'环境光遮蔽开启时，寻找附近物体的范围。单位是米。小值突出缝隙，大值产生较宽的阴影。',
 aoBias:'环境光遮蔽开启时，忽略很小的表面变化。调大可减少平面上的脏点，也会减少细小阴影。',
 shadowTint:'给暗的地方带上一点颜色。0 关闭，调大染色更明显。它按画面明暗染色，不生成新的投影。',
 shadowColor:'阴影染色开启时使用的颜色。蓝紫偏冷，棕橙偏暖。',
 shadowRange:'阴影染色开启时，哪些亮度算暗处。调大后较亮的部分也会染上阴影颜色。',
 highlightTint:'给画面亮的地方染色。0 关闭；调大后亮处更接近你选的颜色。深色模型没有明显亮部时，变化可能很小，暗部染色更适合它。',
 highlightColor:'亮部染色开启时使用的颜色。淡黄色常用于温暖的阳光感觉。',
 rim:'在物体外轮廓加一圈亮光，帮助人物从背景中突出。0 关闭；越大越亮，需要三维场景。',
 rimWidth:'边缘亮光开启时，这一圈亮光有多宽。单位是画面像素；调太大容易像发光描边。',
 rimSoftness:'边缘亮光开启时，让亮边的变化更柔和。调高会减弱细小轮廓上的生硬亮点。',
 rimColor:'边缘亮光开启时使用的颜色。浅蓝显冷，浅黄显暖。',
 rimDirection:'单侧亮边开启时，亮光从画面的哪个方向来。0 是右侧，90 是上侧。它不移动场景灯光。',
 rimDirectional:'0 在所有边缘加亮，1 主要照亮选定方向的一侧；中间值混合两种效果。',
 rimCharacters:'1 只给角色加亮边，0 也给场景物体加亮边。模型需要在三维画面里才能看到效果。',
 fog:'让远处物体逐渐融入雾气颜色，增加远近感。0 关闭；越大雾越浓。物体要在雾气起点之后才会变化，例如人物距离 3 米，起点设 5 米时人物不会变雾。',
 fogStart:'雾气开启时，从镜头前多少米开始变雾。这个距离以内保持清晰。',
 fogEnd:'雾气开启时，多少米处达到最浓。应大于雾气起点；距离差越大，过渡越慢。',
 fogColor:'雾气开启时使用的颜色。接近背景的颜色更自然；这项不会更换背景图片。',
 fogCharacters:'雾气开启时，角色受到多少雾气影响。0 保持角色清楚，1 和场景一样受雾气影响。',
 dof:'焦点附近清楚，离焦点太近或太远的物体变模糊。0 关闭；如果物体都在清晰范围内，开启后也不会变糊。需要三维场景，也会多用一些电脑性能。',
 dofFocus:'镜头前多少米的位置最清楚。可以点“按画面人物对焦”，再做小幅调整。',
 dofRange:'焦点周围保持清楚的前后范围。调大可让更多人物清楚；调小只突出一个位置。',
 dofBlur:'景深开启时允许的最大模糊程度。越大前后景越模糊，也可能更费性能。',
 focus:'根据参考画面里的人物，估算一个清楚的距离。只修改正在制作的预设，不会改镜头位置。',
 outline:'给三维物体画外轮廓线。0 关闭；越大线越粗。',
 outlineColor:'描边开启时的线条颜色。深色通常更像动画轮廓。',
 outlineDetail:'描边开启时，也显示物体内部的折角线。调低只保留较大的轮廓，调高衣服细节线更多。',
 outlineBackgroundAlpha:'描边开启时，场景物体的线有多明显。0 不画场景线，1 完整显示；角色线仍然保留。',
 sharpen:'让小边缘更清楚。0 关闭；太高可能产生白边和噪点。',
 blur:'轻轻抹平整张画面的细节。0 关闭；它不区分远近，想只模糊前后景请用景深。',
 emboss:'把明暗边缘做成凹凸浮雕的样子。0 关闭；越大越像刻出来的画。',
 exposure:'像相机一样整体增加或减少光。0 是原样，1 大约增加一倍；太高会过亮。',
 gamma:'主要调整中间亮度。1 是原样；调大中间色更亮，调小更暗。',
 hue:'转动整张画面的颜色。0 原样；调节后红、绿、蓝等颜色会一起变化。',
 temperature:'让画面偏暖或偏冷。正值偏暖，负值偏冷，0 原样。',
 tint:'修正绿紫偏色。正值偏紫，负值偏绿，0 原样。',
 saturationBoost:'预设里额外增加或减少色彩浓度。1 原样，0 黑白，调大颜色更浓。',
 contrastBoost:'预设里额外调整亮暗差别。1 原样；调大更鲜明，调小更灰柔。',
 sepia:'加入旧照片的棕黄色。0 关闭，1 完全变成旧照片色调。',
 monochrome:'逐渐把画面变成黑白。0 彩色，1 黑白。',
 invert:'把颜色反过来，像照片底片。0 原样，1 完全反相。',
 vignette:'给画面四周加上选定颜色，让中间更突出。0 关闭；越大边缘越明显。',
 vignetteRadius:'暗角开启时，从离中心多远的位置开始染色。调大后中央清楚的面积更大。',
 vignetteSoftness:'暗角开启时，边缘颜色渐变有多宽。调大过渡更缓，调小边界更硬。',
 vignetteColor:'暗角开启时使用的边缘颜色。黑色压暗四周，也可以选其它颜色。',
 bloom:'让亮的地方向周围散出光晕。0 关闭；开启后没有变化时，先降低“光晕亮度门槛”。画面较暗时不会自动发光。太高会让画面泛白。',
 bloomThreshold:'光晕开启时，多亮的地方才发光。调高只让最亮处发光，调低更多地方会发光。',
 bloomRadius:'光晕开启时，光向附近散开的距离。单位是像素；调大光晕更宽。',
 bloomSoftness:'光晕开启时，让刚达到发光门槛的部分慢慢起亮。0 较硬，调大更柔和。',
 bloomColor:'光晕开启时使用的颜色。白色保持自然，也可以用浅暖色。',
 tonemap:'压住刺眼的亮处，并整理亮暗层次，接近电影画面。0 原样，1 完全使用这种亮度压缩。',
 whitePoint:'电影亮度压缩开启时，设定亮部的基准。调大整体更暗、亮部更收敛，调小更亮。',
 vibrance:'优先增加比较淡的颜色，尽量少改变已经很浓的颜色。正值鲜艳，负值柔和，0 原样。',
 lift:'只给暗处抬起一点亮度，能看清阴影细节。正值抬亮，负值压暗；太大黑色会变灰。',
 shadows:'主要调整画面的暗处。正值更亮，负值更暗，0 原样。',
 highlights:'主要调整画面的亮处。正值更亮，负值更暗，0 原样。',
 pixelSize:'把画面变成一块块像素。1 原样，调大像素块更大。',
 halftone:'加上印刷漫画里的小网点。0 关闭；越大暗处网点越明显。',
 hatch:'在暗处加入漫画排线。0 关闭；越大线条越明显。',
 dither:'色调分离开启时，用交错小点混合颜色。0 关闭；调大可减轻色块之间的生硬跳变。',
 grain:'加上胶片的小颗粒。0 关闭；越大颗粒越明显，也可能让画面显脏。',
 scanlines:'加入旧显示器的横向细线。0 关闭；越大线越明显。',
 chromatic:'让红、蓝边缘稍微错开，像镜头色散。0 关闭；越大会出现更明显的彩色重影。',
 tear:'加入旧显示器偶尔出现的画面错位。0 关闭；越大错位越强。这是故障效果，正常画面建议关闭。',
 spatialEnabled:'开启后，鼠标移动时三维镜头会轻轻摆动，画面更有立体感。文字和按钮不跟着动。',
 spatialStrength:'空间镜头开启时，镜头摆动有多明显。小一些更舒适，大一些立体感更强。',
};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function helpLabel(label,key){if(!renderHelp[key])throw Error('Missing render help: '+key);return `${editorLabel(label)} <span class="render-question" role="button" tabindex="0" data-render-help="${key}" aria-label="${escape(label)}的说明">?</span>`;}
export function installRenderHelp(doc=document){
 let active=null,timer=null,box=null;const delay=2000;
 const close=()=>{clearTimeout(timer);timer=null;active?.removeAttribute('aria-describedby');active=null;box?.remove();box=null;};
 const show=()=>{if(!active?.isConnected)return close();box=doc.createElement('div');box.id='render-help-popup';box.className='render-help-popup';box.role='tooltip';setEditorText(box,renderHelp[active.dataset.renderHelp]);doc.body.append(box);active.setAttribute('aria-describedby',box.id);const a=active.getBoundingClientRect(),b=box.getBoundingClientRect(),w=doc.defaultView.innerWidth,h=doc.defaultView.innerHeight;box.style.left=Math.max(8,Math.min(a.left-b.width/2,w-b.width-8))+'px';box.style.top=Math.max(8,Math.min(a.bottom+10,h-b.height-8))+'px';};
 const start=node=>{if(active===node)return;close();active=node;timer=setTimeout(show,delay);};
 doc.addEventListener('pointerover',e=>{const node=e.target.closest?.('[data-render-help]');if(node)start(node);});
 doc.addEventListener('pointerout',e=>{if(active&&e.target===active&&!active.contains(e.relatedTarget))close();});
 doc.addEventListener('focusin',e=>{if(e.target.matches?.('[data-render-help]'))start(e.target);});
 doc.addEventListener('focusout',e=>{if(e.target===active)close();});
 doc.addEventListener('click',e=>{const node=e.target.closest?.('[data-render-help]');if(node){e.preventDefault();start(node);}});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 doc.addEventListener('scroll',()=>{const focused=active===doc.activeElement?active:null;close();if(focused?.isConnected)start(focused);},true);doc.defaultView.addEventListener('blur',close);doc.defaultView.addEventListener('resize',close);
 const observer=new MutationObserver(()=>{if(active&&!active.isConnected)close();});observer.observe(doc.body,{childList:true,subtree:true});
 return{close,delay};
}
