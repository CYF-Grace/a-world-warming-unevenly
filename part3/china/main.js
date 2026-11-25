const d3=window.d3;
const regional=d3.select('body').attr('data-page')==='regions';
const scenarios=[{id:'ssp585',label:'很高排放的未来',code:'SSP5-8.5',color:'#b64035'},{id:'ssp370',label:'高排放的未来',code:'SSP3-7.0',color:'#c56d37'},{id:'ssp245',label:'中等排放的未来',code:'SSP2-4.5',color:'#a1893a'},{id:'ssp126',label:'低排放的未来',code:'SSP1-2.6',color:'#087e83'}];
const stories=[
 {id:'california',name:'加州',points:[[-120,38]],box:[-125,-114,32,42],copy:'更少的升温，意味着减轻森林与居民承受的热压力。配合土壤水和植被碳数据，可以继续讨论森林碳库与缺水；温度本身不能换算成减少多少场火灾。'},
 {id:'india',name:'印度',points:[[78,23]],box:[68,89,7,35],copy:'减轻升温，可以降低户外劳动与作物面临的热风险。这里直接比较温度改善；工时、粮食产量和热健康影响需要额外指标。'},
 {id:'china',name:'中国',points:[[111.5,30.5]],box:[100,122,24,35],copy:'聚焦长江流域：更少升温，有助于减轻干热事件中的温度压力。土壤水、径流和净吸碳量可进一步连接供水与碳汇，但不能仅凭温度计算少停多少电。'},
 {id:'amazon',name:'亚马逊',points:[[-60,-4]],box:[-74,-50,-15,5],copy:'雨林储存碳，也依赖适宜的水热条件。减轻升温可以减少部分气候压力；是否保住更多植被碳，仍需结合水分、土地利用与碳收支数据检验。'},
 {id:'southeast',name:'东南亚沿海',points:[[105.78,10.03],[125,11.25]],box:[102,127,8,22],copy:'越南湄公河三角洲与菲律宾沿海共享长期气候风险。这里显示的是区域温度改善；海平面可另接完整预测，不能把 zos 当作总海平面，也不能由升温直接画出淹水范围。'}
];
const macro=[{id:'north_america',name:'北美',box:[-170,-50,15,75]},{id:'south_america',name:'南美',box:[-82,-34,-56,14]},{id:'europe',name:'欧洲',box:[-15,40,35,72]},{id:'north_africa',name:'北非',box:[-18,40,15,35]},{id:'sub_saharan',name:'撒哈拉以南非洲',box:[-18,52,-35,15]},{id:'west_asia',name:'西亚',box:[40,65,12,50]},{id:'south_asia',name:'南亚',box:[65,90,5,35]},{id:'east_asia',name:'东亚',box:[90,145,20,55]},{id:'southeast_asia',name:'东南亚',box:[90,145,-10,20]},{id:'oceania',name:'澳洲及周边',box:[110,180,-50,-10]}];
let dataset=null,current='ssp585',selected='california',birth=2004,year=2070,world=null;
const map=d3.select('#map'),legend=d3.select('#legend'),gap=d3.select('#gap');
const projection=d3.geoNaturalEarth1().fitExtent([[10,8],[890,468]],{type:'Sphere'}),path=d3.geoPath(projection);
map.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#e7efef');
map.append('path').datum(d3.geoGraticule10()).attr('class','graticule').attr('d',path);
const countries=map.append('g'),cells=map.append('g'),markers=map.append('g');
const colors=d3.scaleDiverging(t=>d3.interpolateRdYlBu(1-t)).domain([-2,0,6]).clamp(true);
let cellNodes=null,cellGeometry=[];
function cellPolygon(lon,lat,dx,dy){return {type:'Polygon',coordinates:[[[lon-dx/2,lat-dy/2],[lon-dx/2,lat+dy/2],[lon+dx/2,lat+dy/2],[lon+dx/2,lat-dy/2],[lon-dx/2,lat-dy/2]]]};}
function valid(v){return typeof v==='number'&&Number.isFinite(v);}
function frames(s){return dataset?.scenarios[s];}
function nearest(s){const a=frames(s);if(!a?.years.length)return null;return d3.leastIndex(a.years,y=>Math.abs(y-year));}
function frame(s){const a=frames(s),i=nearest(s);return i==null?null:{...a.frames[i],actualYear:a.years[i]};}
function fmt(v){return valid(v)?`${v>=0?'+':''}${v.toFixed(2)} °C`:'无可用数据';}
function setBirth(value){birth=Math.max(1920,Math.min(2026,Math.round(Number(value)||2004)));d3.selectAll('#birth,#birth-top').property('value',birth);const age=d3.select('#age');const min=Math.max(0,2015-birth),max=2100-birth;year=Math.max(birth+min,Math.min(birth+max,year));age.attr('min',min).attr('max',max).property('value',year-birth);render();}
d3.selectAll('#birth,#birth-top').on('change',e=>setBirth(e.target.value));
d3.select('#age').on('input',e=>{year=birth+(+e.target.value);render();});
d3.select('#region-year').on('input',e=>{year=+e.target.value;render();});
d3.select('#scenario-select').on('change',e=>{current=e.target.value;render();});
d3.select('#mode').on('change',render);
d3.select('#begin').on('click',()=>d3.select('#experience').node().scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
function selectRegion(id){selected=id;markers.selectAll('.marker').classed('active',d=>d.id===id);d3.selectAll('#region-buttons button').classed('active',d=>d.id===id).attr('aria-pressed',d=>d.id===id);renderStory();}
d3.select('#region-buttons').selectAll('button').data(stories).join('button').text(d=>d.name).on('click',(_,d)=>selectRegion(d.id));
const pins=(regional?stories:[]).flatMap(s=>s.points.map((point,i)=>({...s,point,label:s.id==='southeast'?(i?'菲律宾':'越南'):s.name})));
const pin=markers.selectAll('.marker').data(pins).join('g').attr('class','marker').attr('transform',d=>`translate(${projection(d.point)})`).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`查看${d.label}`).on('click',(_,d)=>selectRegion(d.id)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRegion(d.id);}});
pin.append('circle').attr('r',5);pin.append('text').attr('x',9).attr('y',-8).text(d=>d.label);
function renderLegend(mode){legend.selectAll('*').remove();const scale=d3.scaleLinear().domain(mode==='avoided'?[-1,4]:[-2,6]).range([180,690]);for(let i=0;i<100;i++)legend.append('rect').attr('x',180+i*5.1).attr('y',4).attr('width',5.2).attr('height',10).attr('fill',mode==='avoided'?d3.interpolateBrBG(i/99):colors(-2+8*i/99));legend.append('g').attr('class','axis').attr('transform','translate(0,14)').call(d3.axisBottom(scale).ticks(5).tickFormat(d=>`${d}°C`));legend.append('text').attr('x',15).attr('y',15).attr('font-size',13).text(mode==='avoided'?'避免的升温':'相对共同基准');}
function renderStory(){if(!regional)return;const s=stories.find(x=>x.id===selected),a=frame(current),high=frame('ssp585');const v=a?.stories?.[selected],h=high?.stories?.[selected],avoided=valid(v)&&valid(h)?h-v:null;const card=d3.select('#region-story');card.selectAll('*').remove();card.append('h3').text(s.name);card.append('p').attr('class','numbers').text(valid(v)?`代表区域 ${fmt(v)} · 相比很高排放${avoided>=0?'少升温':'多升温'} ${Math.abs(avoided).toFixed(2)} °C`:'载入数据后显示该地区的情景差异');card.append('p').text(s.copy);}
function renderGap(){gap.selectAll('*').remove();const a=frame(current),h=frame('ssp585');if(!a||!h)return;const rows=macro.map(r=>({...r,value:a.regions[r.id],high:h.regions[r.id]})).filter(r=>valid(r.value)&&valid(r.high));const domainMax=dataset.maxRegionalWarming||8,x=d3.scaleLinear().domain([Math.min(0,d3.min(rows,r=>Math.min(r.value,r.high)))||0,domainMax]).range([145,375]),y=d3.scalePoint().domain(rows.map(r=>r.id)).range([20,345]);gap.append('g').attr('class','axis').attr('transform','translate(0,370)').call(d3.axisBottom(x).ticks(4).tickFormat(d=>`${d}°C`));const row=gap.selectAll('.row').data(rows).join('g').attr('class','row').attr('transform',d=>`translate(0,${y(d.id)})`);row.append('text').attr('x',133).attr('y',4).attr('text-anchor','end').attr('font-size',13).attr('fill','#476063').text(d=>d.name);row.append('line').attr('x1',d=>x(d.value)).attr('x2',d=>x(d.high)).attr('stroke','#acc7c0').attr('stroke-width',3);row.append('circle').attr('cx',d=>x(d.high)).attr('r',4).attr('fill','#9ba7a7');row.append('circle').attr('cx',d=>x(d.value)).attr('r',5).attr('fill',scenarios.find(s=>s.id===current).color);row.append('title').text(d=>`${d.name}：当前 ${fmt(d.value)}，很高排放 ${fmt(d.high)}`);const values=rows.map(r=>r.value),highs=rows.map(r=>r.high);const spread=d3.max(values)-d3.min(values),highSpread=d3.max(highs)-d3.min(highs);d3.select('#gap-summary').text(rows.length?`地区最大差距 ${spread.toFixed(2)} °C；相比很高排放${spread<=highSpread?'缩小':'扩大'} ${Math.abs(highSpread-spread).toFixed(2)} °C。`:'该年份的地区数据不足。');}
function render(){const s=scenarios.find(x=>x.id===current),f=frame(current),h=frame('ssp585'),mode=d3.select('#mode').property('value');d3.select('#year').text(year);d3.select('#age-label').text(year-birth);d3.select('#scenario-code').text(s.code);d3.select('#scenario-title').text(s.label);d3.select('#global-value').text(fmt(f?.global));if(cellNodes&&f){cellNodes.interrupt().transition().duration(matchMedia('(prefers-reduced-motion: reduce)').matches?0:650).attr('fill',(_,i)=>{const v=f.grid[i];if(!valid(v))return 'transparent';if(mode==='avoided'){const high=h?.grid[i];return valid(high)?d3.interpolateBrBG(Math.max(0,Math.min(1,((high-v)+1)/5))):'transparent';}return colors(v);});}renderLegend(mode);renderGap();renderStory();}
// 滚动只改变全球页的情景；地区页完全由独立控件驱动。
if(!regional){
  let queued=false;
  function chooseStep(){queued=false;const target=innerHeight*.65;const nodes=d3.selectAll('.step').nodes();if(!nodes.length)return;const active=nodes.reduce((best,node)=>Math.abs(node.getBoundingClientRect().top-target)<Math.abs(best.getBoundingClientRect().top-target)?node:best);const next=d3.select(active).attr('data-scenario');if(next!==current){current=next;render();}}
  d3.select(window).on('scroll.scenario',()=>{if(queued)return;queued=true;d3.timeout(chooseStep,16);});
}
function loadData(data){if(!data.scenarios||!data.lat||!data.lon)throw Error('文件需要包含 scenarios、lat、lon。请先运行 export_web_data.py。');for(const s of scenarios){const a=data.scenarios[s.id];if(!a||a.frames.length!==a.years.length)throw Error(`缺少或损坏的情景：${s.id}`);if(a.frames.some(f=>f.grid.length!==data.lat.length*data.lon.length))throw Error('格点数量与坐标不一致');}dataset=data;const dx=Math.abs(data.lon[1]-data.lon[0]),dy=Math.abs(data.lat[1]-data.lat[0]);cellGeometry=data.lat.flatMap(lat=>data.lon.map(lon=>cellPolygon(lon,lat,dx,dy)));cellNodes=cells.selectAll('path').data(cellGeometry).join('path').attr('d',path).attr('fill','transparent').on('pointermove',(e,d)=>{const i=cellGeometry.indexOf(d),v=frame(current)?.grid[i];d3.select('#tooltip').style('display','block').style('left',`${Math.min(e.clientX+12,innerWidth-200)}px`).style('top',`${e.clientY+12}px`).text(`${year} 年 · ${fmt(v)}`);}).on('pointerleave',()=>d3.select('#tooltip').style('display','none'));d3.select('#status').text(`已载入实际数据：${data.source||'CESM2'}。`);d3.select('#baseline').text(`共同基准：${data.baseline||'2015–2034'}；居中十年平均，端点窗口缩短。颜色和地区对比尺度在情景间保持一致。`);render();}
d3.select('#upload').on('change',async e=>{try{if(e.target.files.length)loadData(JSON.parse(await e.target.files[0].text()));}catch(error){d3.select('#status').text(error.message);}});
try{world=await d3.json('world.geojson');countries.selectAll('path').data(world.features).join('path').attr('class','country').attr('d',path);}catch{}
try{loadData(await d3.json('climate.json'));}catch(error){d3.select('#status').text('未载入气候数据。请运行 export_web_data.py，再选择生成的 climate.json。没有使用虚构数值。');}
if(regional){render();selectRegion(selected);}else setBirth(birth);
