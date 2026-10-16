import {createInvestmentUI} from './investment-ui.mjs';
import {createStatisticsUI} from './statistics-ui.mjs';
import {combinedInvestment} from './statistics.mjs';
import {allocation,investmentSummary,tagStats,tagsOf,savingBaseline,reachMonth,kindLabel} from './finance.mjs';
export function createFinanceUI(ctx){
 const $=id=>document.getElementById(id),{escape:e,money,table}=ctx;
 let baselineKey='',amountNow=null,dateNow='',lastRecords=[],lastMeta={};
 const colors=['#466c59','#d2a44d','#8e71b5','#e48064','#5f91b3','#8ba762','#bc7c9e','#879390'];
 function pie(items,total,label){
  if(!items.length||total<=0||items.some(i=>i.amount<0))return '<p class="muted">当前没有可绘制的正余额；负值请查看明细。</p>';
  let angle=-Math.PI/2;const parts=items.filter(i=>i.amount>0),labels=[];
  const paths=parts.map((v,index)=>{const a=angle,b=angle+v.amount/total*Math.PI*2;angle=b;const x=t=>250+Math.cos(t)*102,y=t=>155+Math.sin(t)*102,mid=(a+b)/2,right=Math.cos(mid)>=0;labels.push({v,index,mid,right,y:155+Math.sin(mid)*130});return b-a>Math.PI*2-.001?`<circle cx="250" cy="155" r="102" fill="${v.color||colors[index%colors.length]}"/>`:`<path d="M250,155 L${x(a)},${y(a)} A102,102 0 ${b-a>Math.PI?1:0},1 ${x(b)},${y(b)} Z" fill="${v.color||colors[index%colors.length]}" stroke="white" stroke-width="2"/>`;});
  for(const right of [false,true]){const side=labels.filter(l=>l.right===right).sort((a,b)=>a.y-b.y);side.forEach((l,i)=>l.y=Math.max(35,Math.min(263,l.y),i?side[i-1].y+46:0));if(side.at(-1)?.y>273){const shift=side.at(-1).y-273;side.forEach(l=>l.y-=shift);}}
  const mobileLabels=labels.map(({v,mid,index})=>{const slot=index===0?{x:487,y:42,anchor:'end'}:index===1?{x:250,y:330,anchor:'middle'}:{x:13,y:42,anchor:'start'};const x1=250+Math.cos(mid)*93,y1=175+Math.sin(mid)*93;return `<polyline points="${x1},${y1} ${index===1?250:index===0?385:115},${slot.y} ${slot.x},${slot.y}" fill="none" stroke="${v.color||'#81917a'}"/><text x="${slot.x}" y="${slot.y-23}" text-anchor="${slot.anchor}" class="pie-name">${e(v.name)} ${(v.amount/total*100).toFixed(2)}%</text><text x="${slot.x}" y="${slot.y-3}" text-anchor="${slot.anchor}" class="pie-money">${e(money(v.amount))}</text>`;}).join('');
  const mobile=`<svg class="allocation-svg pie-mobile" viewBox="0 0 500 350" role="img" aria-label="${e(label)}"><g transform="translate(0 20)">${paths.join('')}</g>${mobileLabels}</svg>`;
  return mobile+`<svg class="allocation-svg pie-desktop" viewBox="0 0 500 310" role="img" aria-label="${e(label)}">${paths.join('')}${labels.map(({v,mid,right,y})=>{const x1=250+Math.cos(mid)*95,y1=155+Math.sin(mid)*95,x2=right?372:128,x3=right?487:13,anchor=right?'end':'start';return `<polyline points="${x1},${y1} ${x2},${y} ${x3},${y}" fill="none" stroke="${v.color||'#81917a'}"/><text x="${x3}" y="${y-18}" text-anchor="${anchor}" class="pie-name">${e(v.name)} ${(v.amount/total*100).toFixed(2)}%</text><text x="${x3}" y="${y-4}" text-anchor="${anchor}" class="pie-money">${e(money(v.amount))}</text>`;}).join('')}</svg>`;
 }
 function accounts(balances,records,ledger,rates,date){
  const a=allocation(balances,rates);$('assetAllocation').innerHTML=a.missing?'<p class="muted">等待完整汇率后显示分布。</p>':pie(a.items,a.total,'现金存款、国债、投资分布');
  $('assetAllocationRows').innerHTML=a.items.map(i=>`<div class="allocation-row"><span><i style="background:${i.color}"></i>${i.name}</span><strong>${a.missing?'—':e(money(i.amount))}</strong><span>${a.missing?'—':(i.share*100).toFixed(2)+'%'}</span></div>`).join('');
  amountNow=a.missing?null:a.total;dateNow=date;lastRecords=records;lastMeta=ledger.meta||{};
  const key=date+'|'+records.map(r=>r.version).join('|');if(key!==baselineKey){baselineKey=key;const b=savingBaseline(records.filter(r=>r.date<=date),date,ledger.meta);$('forecastBasis').textContent=`参考最近 ${b.months.length} 个完整月（${b.months[0]||'—'} 至 ${b.months.at(-1)||'—'}）：工资与日常开销用月度中位数，设备/旅行预算用期间月均折年；其它入账、公积金、年终奖暂不作为固定工资。`;
   for(const[id,value]of [['forecastSalary',b.salary],['forecastExpense',b.routine],['forecastBig',b.annualBig]])if(!$(id).dataset.edited)$(id).value=value;
  }if($('milestoneDisclosure').open)renderMilestones();
 }
 $('milestoneDisclosure').ontoggle=()=>{if($('milestoneDisclosure').open)renderMilestones();};
 function renderMilestones(){
  const monthly=Number($('forecastSalary').value)-Number($('forecastExpense').value)-Number($('forecastBig').value)/12,rate=Number($('forecastReturn').value)/100,targets=[5e5,1e6,2e6,5e6,1e7,2e7,5e7,1e8];
  const amounts=[['50万',5e5],['100万',1e6],['200万',2e6],['500万',5e6],['1000万',1e7],['2000万',2e7],['5000万',5e7],['1亿',1e8]];
  $('forecastMonthly').textContent=`按此假设，每月新增资产 ${money(monthly)}；年收益假设 ${(rate*100).toFixed(1)}%。不把投资转账重复当作新增资产。`;
  const points=(ctx.history?.()||[]).filter(p=>p.date<=dateNow);
  $('milestones').innerHTML=amounts.map(([name,target])=>{const hit=points.find(p=>p.amount!==null&&p.amount>=target),months=amountNow===null?null:reachMonth(amountNow,monthly,rate,target);let when='100年内未达到';if(months!==null){const d=new Date(dateNow+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);when=months===0?'当前已达到':d.toISOString().slice(0,7)+'（约 '+Math.ceil(months/12)+' 年）';}if(amountNow===null)when='等待汇率';return `<div class="milestone"><div><strong>${name}</strong><span>${hit?'最早记录达标 '+hit.date:when}</span></div><progress max="100" value="${Math.min(100,Math.max(0,(amountNow||0)/target*100))}"></progress><small>${amountNow===null?'—':((amountNow||0)/target*100).toFixed(2)+'%'} · 距目标 ${money(Math.max(0,target-(amountNow||0)))}</small></div>`;}).join('');
 }
 for(const id of ['forecastSalary','forecastExpense','forecastBig','forecastReturn'])$(id).oninput=()=>{$(id).dataset.edited='1';renderMilestones();};
 $('saveForecast').onclick=()=>ctx.saveMeta('forecastAssumptions',{salary:Number($('forecastSalary').value),expense:Number($('forecastExpense').value),big:Number($('forecastBig').value),rate:Number($('forecastReturn').value)}).then(()=>ctx.toast('预测假设已保存，随账本同步。'));
 let loadedForecast=false;
 function loadForecast(meta){if(loadedForecast||!meta.forecastAssumptions)return;loadedForecast=true;const f=meta.forecastAssumptions;for(const[id,key]of [['forecastSalary','salary'],['forecastExpense','expense'],['forecastBig','big'],['forecastReturn','rate']])if(Number.isFinite(f[key])){$(id).value=f[key];$(id).dataset.edited='1';}}
 const investmentUI=createInvestmentUI(ctx);
 const statisticsUI=createStatisticsUI(ctx);
 return {accounts:(...args)=>{loadForecast(args[2].meta||{});accounts(...args);},investments:(_balances,records,date)=>investmentUI.render(records,date),openSplit:investmentUI.openSplit,statistics:statisticsUI.render,pie};
}
