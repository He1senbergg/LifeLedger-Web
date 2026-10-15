import {tagsOf} from './finance.mjs';
export function comparisonRange(from,to){
 const date=s=>new Date(s+'T00:00:00Z'),fmt=d=>d.toISOString().slice(0,10),one=86400000;
 if(from.slice(0,7)===to.slice(0,7)){
  const shift=s=>{const d=date(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return fmt(d);};
  const last=new Date(Date.UTC(date(to).getUTCFullYear(),date(to).getUTCMonth()+1,0)).getUTCDate();
  const previousEnd=from.endsWith('-01')&&date(to).getUTCDate()===last?fmt(new Date(Date.UTC(date(to).getUTCFullYear(),date(to).getUTCMonth(),0))):shift(to);
  return {from:shift(from),to:previousEnd,label:'上月同期'};
 }
 const days=Math.round((date(to)-date(from))/one)+1,end=new Date(date(from)-one),start=new Date(end-(days-1)*one);return {from:fmt(start),to:fmt(end),label:'上一等长区间'};
}
const palette=['#ff6842','#ffad36','#25bd8c','#93cb65','#4289ed','#00a9de','#06b7a0','#b17be8','#ed7db4','#778da9','#bd8256','#7aaf59','#ef656a','#5c88b6','#9f9cc5','#b5a345','#508a80','#d79a79','#65bccc','#878787'];
const known=['住房水电','电子设备','餐饮','交通','食品饮料','娱乐学习','日用服饰','医疗健康','人情往来','通信订阅','旅行','工资奖金','公积金','利息','退款赔付','报销回款','红包补贴','劳务收入','快递','待分类'];
export function categoryColor(tag){const index=known.indexOf(tag);let hash=0;for(const c of tag)hash=(hash*31+c.codePointAt(0))>>>0;return palette[index<0?hash%palette.length:index];}
export function combinedInvestment(summaries){
 const sum=key=>Math.round(summaries.reduce((n,s)=>n+Math.round(s[key]*100),0))/100;
 const buys=sum('buys'),profit=sum('profit');return {buys,profit,value:sum('value'),sells:sum('sells'),distributed:sum('distributed'),roi:buys?profit/buys:null,incomplete:summaries.some(s=>!!s.warning)};
}
export function periodStatistics(records,{from,to,currency='CNY',side='expense',tag='',meta={}}){
 const previous=comparisonRange(from,to),groups=new Map,days=new Map,months=new Map;let total=0,count=0,early=0,pending=0,previousTotal=0;
 for(const r of records){if(r.deleted||r.currency!==currency)continue;const current=r.date>=from&&r.date<=to,prior=r.date>=previous.from&&r.date<=previous.to;if(!current&&!prior)continue;
  const direction=r.kind==='支出'?'expense':['收入','其它','其他'].includes(r.kind)?'income':null;if(!direction)continue;
  if(r.date<'2025-06-01'){if(current&&direction===side)early++;continue;}
  const tags=tagsOf(r,meta);if(tag&&!tags.includes(tag))continue;const primary=tags[0]||'待分类',amount=Math.round((direction==='expense'?r.amount:-r.amount)*100);
  if(current){const day=days.get(r.date)||{date:r.date,income:0,expense:0};day[direction]+=amount;days.set(r.date,day);const month=r.date.slice(0,7),m=months.get(month)||{month,income:0,expense:0};m[direction]+=amount;months.set(month,m);}
  if(direction!==side)continue;const g=groups.get(primary)||{tag:primary,amount:0,previous:0,count:0,color:categoryColor(primary)};
  if(current){g.amount+=amount;g.count++;total+=amount;count++;if(primary==='待分类')pending++;}if(prior){g.previous+=amount;previousTotal+=amount;}groups.set(primary,g);
 }
 const positive=[...groups.values()].reduce((n,g)=>n+Math.max(0,g.amount),0),negative=[...groups.values()].reduce((n,g)=>n+Math.min(0,g.amount),0);
 const rows=[...groups.values()].filter(g=>g.amount||g.previous||g.count).map(g=>({...g,amount:g.amount/100,previous:g.previous/100,change:(g.amount-g.previous)/100,changeRate:g.previous?(g.amount-g.previous)/Math.abs(g.previous):null,share:positive&&g.amount>0?g.amount/positive:0})).sort((a,b)=>b.amount-a.amount);
 return {from,to,previous,previousComplete:previous.from>='2025-06-01',total:total/100,previousTotal:previousTotal/100,count,early,pending,positive:positive/100,negative:negative/100,groups:rows,days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({...d,income:d.income/100,expense:d.expense/100})),months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({...m,income:m.income/100,expense:m.expense/100}))};
}
