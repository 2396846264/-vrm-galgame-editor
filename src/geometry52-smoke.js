export function geometry52Plan(){
 const primitives=[{name:'彩色地块',shape:'box',position:[-30,0,-5],size:[.5,.3,.5],repeat:{count:[120,1,120],spacing:[.5,0,.5],colorPalette:['#6f8962','#789269','#84996f'],colorMode:'checker'}},{name:'港口石板',shape:'box',position:[-15,.22,-9],size:[.5,.25,.5],repeat:{count:[60,1,10],spacing:[.5,0,.5],colorPalette:['#afb5b5','#929f9d','#c0c8c1'],colorMode:'checker'}}];
 for(const [i,x]of [-22,-15,-8,0,8,15,22].entries()){const z=i%2?-1:1;primitives.push({name:'沿岸房屋',shape:'box',position:[x,2,z],size:[4,4,4],color:['#d7bc8b','#b4c6c8','#cba3a0'][i%3]},{name:'屋顶',shape:'pyramid',position:[x,4.7,z],size:[4.8,1.6,4.8],color:i%2?'#7d9896':'#a96852'},{name:'窗户',shape:'box',position:[x-1.2,2,z+2.02],size:[.65,1,.1],color:'#416d87',repeat:{count:[3,1,1],spacing:[1.2,0,0]}},{name:'房门',shape:'box',position:[x,.8,z+2.03],size:[.8,1.6,.11],color:'#705442'});}
 for(let i=0;i<18;i++){const x=(i%9)*5-20,z=i<9?12:20;primitives.push({name:'树干',shape:'cylinder',position:[x,1.2,z],size:[.5,2.4,.5],color:'#7d5d3e'},{name:'树冠',shape:i%2?'cone':'sphere',position:[x,3,z],size:[2.7,3,2.7],color:i%3?'#477457':'#6e9155'});}
 primitives.push({name:'城门拱顶',shape:'arch',position:[0,3.8,9],size:[5.5,3,1],color:'#d8c9a5'},{name:'城门石柱',shape:'box',position:[-2.5,1.5,9],size:[.7,3,1],color:'#bdaf91',repeat:{count:[2,1,1],spacing:[5,0,0]}},{name:'斜坡',shape:'wedge',position:[0,.6,5],size:[4,1,4],color:'#ada89d'},{name:'环形雕塑',shape:'torus',position:[12,2.5,-7],size:[3,3,.7],color:'#e0bd6f'},{name:'码头立柱',shape:'capsule',position:[-10,1,-7],size:[.45,2,.45],color:'#687883',repeat:{count:[11,1,1],spacing:[2,0,0]}});
 for(const p of primitives){if(p.name==='窗户'||p.name==='房门')p.position[2]-=4.05;}
 primitives.splice(primitives.findIndex(p=>p.name==='环形雕塑'),1);
 const add=(name,shape,position,size,color,extra={})=>primitives.push({name,shape,position,size,color,...extra});
 for(let i=0;i<5;i++)add('背后山丘','sphere',[-24+i*12,3,26],[19,10+i%2*3,22],i%2?'#537e58':'#67875a');
 add('拖船船体','box',[-3,.6,-18],[10,1.2,3.6],'#263c40');add('绿色船舷','box',[-3,1.3,-18],[10,.35,3.6],'#41725d');add('船首','wedge',[-8.7,.7,-18],[2,1.4,3.6],'#263c40',{rotationDegrees:[0,90,0]});
 add('驾驶室','box',[-2,2.65,-18],[3.8,2.5,2.8],'#e5e0c8');add('驾驶室窗','box',[-3.3,3.05,-19.42],[.75,.7,.05],'#477888',{repeat:{count:[3,1,1],spacing:[1.2,0,0]}});add('烟囱','cylinder',[-1.2,5.1,-18],[1,3.5,1],'#b34f43');add('烟囱浅色条','cylinder',[-1.2,5.3,-18],[1.02,1.2,1.02],'#e5dcc3');
 add('橡胶护舷','torus',[-6.8,1.2,-19.9],[1,1,.38],'#283136',{repeat:{count:[7,1,1],spacing:[1.25,0,0]}});add('船首护栏','arch',[-5.8,2,-18],[2.2,1.3,3],'#a65f4e',{rotationDegrees:[0,90,0]});
 return {name:'绿丘港口与拖船',primitives,gridSize:.05,camera:{position:[14,8,-30],target:[-1,3,-10],fov:48},water:{position:[0,-.03,-20],width:75,height:38,color:'#5d9eb1',waveHeight:.06,waveScale:3,flowSpeed:.3,flowAngle:0,opacity:.95}};
}
export function geometry52GardenPlan(){
 const primitives=[];const add=(name,shape,position,size,color,extra={})=>primitives.push({name,shape,position,size,color,...extra});
 add('庭院草地','box',[-20,0,-20],[.5,.3,.5],'#88a56d',{repeat:{count:[80,1,80],spacing:[.5,0,.5],colorPalette:['#7d9c62','#88a56d','#93ad73'],colorMode:'checker'}});
 add('暖色住宅','box',[-3,2.65,-8],[10,5,7],'#d5c59a');add('山墙屋顶后坡','wedge',[-3,5.8,-9.85],[11.2,2.2,4.4],'#68766c');add('山墙屋顶前坡','wedge',[-3,5.8,-6.15],[11.2,2.2,4.4],'#68766c',{rotationDegrees:[0,180,0]});
 add('门廊地板','box',[-7,.4,-3.4],[.5,.5,2],'#b7a68a',{repeat:{count:[17,1,1],spacing:[.5,0,0]}});add('柱子','box',[-7,2.4,-4.42],[.22,4.4,.2],'#796e52',{repeat:{count:[5,1,1],spacing:[2,0,0]}});add('木质横梁','box',[-3,4.6,-4.45],[10,.2,.2],'#796e52');
 for(let i=0;i<4;i++){const x=-6.6+i*2.4;add('玻璃窗','box',[x,2.6,-4.54],[1.5,2.4,.12],'#638786');add('窗框竖栏','box',[x-.6,2.6,-4.63],[.1,2.5,.1],'#c9c6a7',{repeat:{count:[3,1,1],spacing:[.6,0,0]}});add('窗框横栏','box',[x,2.6,-4.64],[1.5,.1,.1],'#c9c6a7');add('圆拱窗饰','arch',[x,4.05,-4.6],[1.6,.65,.12],'#c9c6a7');}
 add('花盆桌','box',[2,1,-3],[1.8,.16,.7],'#b7ac87');add('桌脚','box',[1.35,.6,-3],[.15,.8,.15],'#b7ac87',{repeat:{count:[2,1,1],spacing:[1.3,0,0]}});
 for(let i=0;i<13;i++){const x=i<7?(i%7)*5-16:i<10?-17:17,z=i<7?-15:i<10?-7+(i-7)*7:-12+(i-10)*5;add('树干','cylinder',[x,2.3,z],[.6,4.3,.6],'#726046');for(let j=0;j<3;j++)add('层叠树冠','sphere',[x+(j-1)*1.2,5+j%2,z],[4.6,4.1,4.6],['#3f6d50','#548057','#709155'][j]);}
 for(let i=0;i<12;i++){const x=-12+(i%6)*4,z=i<6?-.5:9;add('低矮灌木','capsule',[x,.85,z],[2.8,1.4,2.2],i%2?'#6c8e53':'#55784d');add('花丛','sphere',[x-1,1.1,z-.8],[.3,.3,.3],'#dfaaa9',{repeat:{count:[6,1,3],spacing:[.38,0,.35],colorPalette:['#d4a9b8','#e8dec4','#dc917f'],colorMode:'cycle'}});}
 for(let i=0;i<15;i++)add('石板路','sphere',[-2+Math.sin(i*.7)*.5,.23,-2+i*.85],[1.4,.17,.65],'#b7b8a1');
 add('池塘石环','torus',[9,.35,3],[10,8,.4],'#a8ac98',{rotationDegrees:[90,0,0]});add('木桥','box',[9,.6,3],[6,.3,1.4],'#998168');add('桥栏','box',[9,1.3,2.3],[6,.12,.12],'#877159');add('桥栏支柱','cylinder',[6.5,.95,2.3],[.13,.8,.13],'#877159',{repeat:{count:[6,1,1],spacing:[1,0,0]}});add('石灯笼','box',[4,.8,5],[.5,1.3,.5],'#c6c8b1');add('灯笼帽','pyramid',[4,1.65,5],[1,.6,1],'#879787');add('尖叶灌木','cone',[-11,1.2,3],[1.5,2.1,1.5],'#547c58');
 add('墙边藤叶','sphere',[-7.85,1.2,-4.68],[.4,.4,.16],'#779661',{repeat:{count:[3,9,1],spacing:[.3,.4,0],colorPalette:['#60834e','#839f62','#a3b575'],colorMode:'checker'}});
 return{name:'花园住宅与石板路',primitives,gridSize:.05,camera:{position:[14,10,20],target:[-1,2,-3],fov:48},water:{position:[9,.22,3],width:7,height:5,color:'#719d91',waveHeight:.03,waveScale:3,flowSpeed:.15,flowAngle:0,opacity:.95}};
}
export function verifyStoryButtons(){
 const buttons=[...document.querySelectorAll('.story-left .sidebar .heading-actions button')];if(buttons.length!==4)throw Error('幕列表四个按钮缺失');
 for(const b of buttons){if(getComputedStyle(b).whiteSpace!=='nowrap'||b.scrollWidth>b.clientWidth+1)throw Error('幕列表按钮仍然折行或溢出：'+b.textContent);}
 const parent=buttons[0].parentElement.getBoundingClientRect();if(buttons.some(b=>b.getBoundingClientRect().right>parent.right+1))throw Error('幕按钮超出侧栏');return{ok:true,width:innerWidth,height:innerHeight,buttons:buttons.map(b=>({text:b.textContent,width:b.clientWidth,height:b.clientHeight})),singleLine:true};
}
