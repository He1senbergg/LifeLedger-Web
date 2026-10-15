import {periodStatistics} from './statistics.mjs';
import {tagsOf} from './finance.mjs';
const icons={'住房水电':'⌂','电子设备':'▣','餐饮':'餐','交通':'车','食品饮料':'食','娱乐学习':'娱','日用服饰':'衣','医疗健康':'＋','旅行':'旅','工资奖金':'薪','公积金':'金','待分类':'?'};
export function createStatisticsUI(ctx){
 const $=id=>document.getElementById(id),{escape:e,money,table}=ctx;
 let data=null,dailyMode='expense',windowEnd=null,selection=null,lastRecords,lastMeta,lastKey='',choicesRecords,choicesMeta;
 function donut(result,currency){
  if(result.positive<=0)return '<p class="empty">此区间没有正净额分类可绘图。退款净流入仍显示在下方。</p>';
  const parts=result.groups.filter(g=>g.amount>0),radius=76,circ=2*Math.PI*radius;let offset=0,angle=-Math.PI/2;const labels=[];
  const rings=parts.map(g=>{const length=g.share*circ,mid=angle+g.share*Math.PI;angle+=g.share*2*Math.PI;if(g.share>=.04&&labels.length<6)labels.push({g,mid,right:Math.cos(mid)>=0,y:145+Math.sin(mid)*115});const item=`<circle cx="190" cy="145" r="${radius}" fill="none" stroke="${g.color}" stroke-width="28" stroke-dasharray="${Math.max(.2,length-(parts.length===1?0:2))} ${circ-Math.max(.2,length-(parts.length===1?0:2))}" stroke-dashoffset="${-offset}" transform="rotate(-90 190 145)"><title>${e(g.tag)} · ${e(money(g.amount,currency))} · ${(g.share*100).toFixed(2)}%</title></circle>`;offset+=length;return item;}).join('');
  for(const right of [false,true]){const side=labels.filter(l=>l.right===right).sort((a,b)=>a.y-b.y);side.forEach((l,i)=>l.y=Math.max(30,l.y,i?side[i-1].y+25:0));if(side.at(-1)?.y>265){const diff=side.at(-1).y-265;side.forEach(l=>l.y-=diff);}}
  const total=money(result.positive,currency),font=Math.min(20,112/(total.length*.58));
  return `<svg viewBox="0 0 380 290" class="tag-donut" role="img" aria-label="${e(currency)} 分类分布，4%以下小项隐藏外部标注">${rings}<text x="190" y="136" text-anchor="middle" class="donut-caption">${result.negative?'正净额合计':'区间合计'}</text><text x="190" y="161" text-anchor="middle" class="donut-total" style="font-size:${font}px">${e(total)}</text>${labels.map(({g,mid,right,y})=>`<polyline points="${190+Math.cos(mid)*92},${145+Math.sin(mid)*92} ${right?285:95},${y} ${right?374:6},${y}" stroke="${g.color}" fill="none"/><text x="${right?374:6}" y="${y-5}" text-anchor="${right?'end':'start'}" class="donut-label">${e(g.tag)} ${(g.share*100).toFixed(1)}%</text>`).join('')}</svg>`;
 }
 function render(records,meta){
  if(!$('statsFrom').value)$('statsFrom').value=ctx.today().slice(0,7)+'-01';if(!$('statsTo').value)$('statsTo').value=ctx.today();
  if(records!==choicesRecords||meta!==choicesMeta){choicesRecords=records;choicesMeta=meta;const tags=[...new Set(records.flatMap(r=>tagsOf(r,meta)))].sort(),chosen=$('statsTag').value;$('statsTag').innerHTML='<option value="">全部标签</option>'+tags.map(t=>`<option ${t===chosen?'selected':''}>${e(t)}</option>`).join('');}
  const from=$('statsFrom').value,to=$('statsTo').value,currency=$('statsCurrency').value,side=$('statsSide').value,key=[from,to,currency,side,$('statsTag').value].join('|');
  if(!from||!to||from>to){$('tagStats').innerHTML='<p class="notice">请选择有效的起止日期。</p>';$('dailyChart').innerHTML='';$('dailyAxis').innerHTML='';$('dailyDetail').hidden=true;$('dailyRange').textContent='请选择有效的起止日期。';$('tagMonths').innerHTML='';$('dailyPrev').disabled=true;$('dailyNext').disabled=true;data=null;return;}
  if(data&&records===lastRecords&&meta===lastMeta&&key===lastKey)return;lastRecords=records;lastMeta=meta;lastKey=key;
  data=periodStatistics(records,{from,to,currency,side,tag:$('statsTag').value,meta});data.currency=currency;data.side=side;windowEnd=null;selection=null;
  $('tagStats').innerHTML=`<div class="tag-stat-total"><strong>${e(money(data.total,currency))}</strong><span>${data.count} 笔 · ${data.pending} 笔待分类</span></div><div class="tag-distribution"><div>${donut(data,currency)}<p class="muted small">${data.negative?'环图及分类百分比按正净额合计计算；退款净流入 '+e(money(data.negative,currency))+' 单列，不绘成负扇区。':'小于4%的分类不标在图外，全部分类均列于下方。'}</p></div><div class="category-list">${data.groups.filter(g=>g.count||g.amount).map(g=>{const increase=g.change>=0,good=side==='income'?increase:!increase;return `<div class="category-stat"><span class="category-icon" style="background:${g.color}">${e(icons[g.tag]||g.tag.slice(0,1))}</span><div class="category-content"><div class="category-stat-head"><span><strong>${e(g.tag)}</strong> <small>${g.amount<0?'退款净流入':(g.share*100).toFixed(2)+'%'}</small></span><strong class="category-amount">${e(money(g.amount,currency))}</strong></div><div class="category-change ${good?'cash-in':'cash-out'}">${!data.previousComplete?'同期尚未完整分类，暂不比较':`较${data.previous.label} ${increase?'↑ +':'↓ '}${e(money(g.change,currency))}${g.changeRate===null?(g.amount?' · 新增':''):' · '+(g.changeRate>=0?'+':'')+(g.changeRate*100).toFixed(1)+'%'}`}</div><div class="category-track"><span style="background:${g.color};width:${Math.max(0,g.share*100)}%"></span></div></div></div>`;}).join('')||'<p class="muted">此区间没有匹配的收支。</p>'}</div></div><p class="muted small">对比：${data.previous.from} 至 ${data.previous.to}（${data.previous.label}）。每笔按首个标签统计一次；2025-06前 ${data.early} 笔不参与标签统计。</p>`;
  $('tagMonths').innerHTML=table(['月份','收入（含其它）','日常支出'],data.months.map(m=>[m.month,money(m.income,currency),money(m.expense,currency)]),true);
  dailyMode=side;renderDaily();
 }
 function dailyRows(){
  const map=new Map(data.days.map(d=>[d.date,d])),rows=[],end=data.to<ctx.today()?data.to:ctx.today();const cursor=new Date((data.from<'2025-06-01'?'2025-06-01':data.from)+'T00:00:00Z');
  while(cursor.toISOString().slice(0,10)<=end){const date=cursor.toISOString().slice(0,10);rows.push(map.get(date)||{date,income:0,expense:0});cursor.setUTCDate(cursor.getUTCDate()+1);}return rows;
 }
 function renderDaily(){
  if(!data)return;selection=null;const all=dailyRows();windowEnd=windowEnd===null?all.length:Math.min(all.length,windowEnd);const start=Math.max(0,windowEnd-60),rows=all.slice(start,windowEnd),series=dailyMode==='all'?['expense','income']:[dailyMode],colors={expense:'#e95f64',income:'#238052'};
  $('dailyPrev').disabled=start===0;$('dailyNext').disabled=windowEnd>=all.length;$('dailyRange').textContent=rows.length?`${rows[0].date} 至 ${rows.at(-1).date} · 共 ${all.length} 天（每段最多60天，可左右滑动）`:'此区间没有可显示的日期。';
  document.querySelectorAll('[data-daily-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dailyMode===dailyMode)));$('dailyDetail').hidden=true;
  if(!rows.length){$('dailyChart').innerHTML='';$('dailyAxis').innerHTML='';return;}
  const width=Math.max($('dailyScroll').clientWidth||320,rows.length*30+40),height=250,left=14,right=16,top=18,bottom=208,values=rows.flatMap(d=>series.map(s=>d[s])),min=Math.min(0,...values),max=Math.max(1,...values),span=Math.max(1,max-min),x=i=>left+i*(width-left-right)/Math.max(1,rows.length-1),y=v=>bottom-(v-min)/span*(bottom-top),tick=n=>Math.abs(n)>=10000?(n/10000).toFixed(1)+'万':Math.abs(n)>=1000?(n/1000).toFixed(1)+'k':n.toFixed(0);
  $('dailyAxis').innerHTML=`<svg width="42" height="250" aria-hidden="true">${[0,1,2,3,4].map(i=>{const value=min+span*i/4;return `<text x="35" y="${y(value)+4}" text-anchor="end" font-size="11" fill="#849080">${tick(value)}</text>`;}).join('')}</svg>`;
  $('dailyChart').innerHTML=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="每日收支曲线"><g>${[0,1,2,3,4].map(i=>{const value=min+span*i/4,yy=y(value);return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#e3e7df" stroke-dasharray="3 4"/>`;}).join('')}</g>${series.map(s=>`<polyline points="${rows.map((d,i)=>x(i)+','+y(d[s])).join(' ')}" fill="none" stroke="${colors[s]}" stroke-width="2.5"/>`).join('')}${rows.map((d,i)=>`<g role="button" tabindex="0" data-daily-date="${d.date}" aria-label="${d.date} 收入 ${e(money(d.income,data.currency))} 支出 ${e(money(d.expense,data.currency))}"><rect x="${x(i)-13}" y="${top}" width="26" height="${bottom-top}" fill="transparent"/>${series.map(s=>`<circle cx="${x(i)}" cy="${y(d[s])}" r="3.5" fill="${colors[s]}"/>`).join('')}${i%2===0||i===rows.length-1?`<text x="${x(i)}" y="235" text-anchor="middle" fill="#849080" font-size="11">${d.date.slice(5)}</text>`:''}</g>`).join('')}</svg>`;
  requestAnimationFrame(()=>{$('dailyScroll').scrollLeft=$('dailyScroll').scrollWidth;});
 }
 function showDay(ev){const el=ev.target.closest('[data-daily-date]');if(!el||!data)return;const date=el.dataset.dailyDate;if(selection===date){selection=null;$('dailyDetail').hidden=true;return;}selection=date;const d=data.days.find(d=>d.date===date)||{income:0,expense:0};$('dailyDetail').textContent=`${date} · 收入 ${money(d.income,data.currency)} / 日常支出 ${money(d.expense,data.currency)} / 日常收支差额 ${money(d.income-d.expense,data.currency)}（此处不扣投资净投入）`;$('dailyDetail').hidden=false;}
 $('dailyChart').onclick=showDay;$('dailyChart').onkeydown=ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();showDay(ev);}};
 document.addEventListener('click',ev=>{if(!ev.target.closest('#dailyChart')){selection=null;$('dailyDetail').hidden=true;}});
 for(const button of document.querySelectorAll('[data-daily-mode]'))button.onclick=()=>{dailyMode=button.dataset.dailyMode;renderDaily();};
 $('dailyPrev').onclick=()=>{windowEnd=Math.max(60,(windowEnd||0)-60);renderDaily();};$('dailyNext').onclick=()=>{windowEnd=(windowEnd||0)+60;renderDaily();};
 for(const id of ['statsFrom','statsTo','statsCurrency','statsSide','statsTag'])$(id).onchange=()=>render(ctx.records(),ctx.ledger().meta||{});
 let dailyWidth=0,dailyResizeFrame;
 new ResizeObserver(()=>{const width=$('dailyScroll').clientWidth;if(!data||!width||width===dailyWidth)return;dailyWidth=width;cancelAnimationFrame(dailyResizeFrame);dailyResizeFrame=requestAnimationFrame(renderDaily);}).observe($('dailyScroll'));
 return {render};
}
