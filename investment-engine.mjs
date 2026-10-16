export const marketNames={cn:'A股',us:'美股',bond:'国债',gold:'黄金'};
export const marketColors={total:'#203f36',cn:'#d15a55',us:'#437fbd',bond:'#8e71b5',gold:'#b88b24'};
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const flow=r=>['理财支出','投资支出','国债支出'].includes(r.kind);
const valuation=r=>['理财余额','投资余额','国债余额'].includes(r.kind);
export const investmentRecord=r=>flow(r)||valuation(r);
export function marketOf(r){const i=r.investment||{};return i.asset==='gold'?'gold':i.asset==='bond'||r.kind.startsWith('国债')?'bond':['cn','us'].includes(i.market)?i.market:/红利低波/.test(r.description+' '+r.category)?'cn':'us';}
export function platformOf(r){const p=r.investment?.platform;const text=p&&p!=='跨平台合计'?p:r.category;return /[|｜+＋]/.test(text)?'历史合并':/博时/.test(text)?'博时':/微众/.test(text)?'微众':/支付宝/.test(text)?'支付宝':/中行|黄金/.test(text)?'中行':text||r.account||'未指定';}
export const positionKey=(market,platform)=>market+'|'+platform;
const sorted=records=>records.filter(r=>!r.deleted&&investmentRecord(r)&&r.currency==='CNY').sort((a,b)=>a.date.localeCompare(b.date)||(a.source?.row??1e9)-(b.source?.row??1e9)||a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
const fresh=()=>({buys:0,sells:0,distributed:0,value:0,cost:0,lastValuation:null,first:null});
function engine(){
 const classes=Object.fromEntries(Object.keys(marketNames).map(k=>[k,fresh()])),groups={fund:fresh(),bond:fresh(),gold:fresh()},positions=new Map();let mixed=false,latest=null,splitDate=null;
 function apply(r){latest=r.date;const market=marketOf(r),group=['bond','gold'].includes(market)?market:'fund',g=groups[group],c=classes[market],key=positionKey(market,platformOf(r));let p=positions.get(key);if(!p){p={...fresh(),market,platform:platformOf(r),key,placeholder:valuation(r)&&group==='fund'};positions.set(key,p);}const i=r.investment||{};
  if(valuation(r)){
   g.value=r.amount;g.lastValuation=r.date;
   if(group==='fund'&&Array.isArray(i.breakdown)){
    const entries=new Map(i.breakdown.map(b=>[positionKey(b.market,b.platform),b]));for(const pos of positions.values())if(['cn','us'].includes(pos.market)){pos.value=entries.has(pos.key)?entries.get(pos.key).value:0;pos.lastValuation=r.date;}
    for(const [k,b]of entries){if(!positions.has(k))positions.set(k,{...fresh(),...b,key:k,lastValuation:r.date,placeholder:false});else{positions.get(k).value=b.value;positions.get(k).placeholder=false;}}
    for(const m of ['cn','us']){classes[m].value=round([...positions.values()].filter(p=>p.market===m).reduce((n,p)=>n+(p.value||0),0));classes[m].lastValuation=r.date;}
    for(const [key,p]of positions)if(p.market==='mixed')positions.delete(key);splitDate=r.date;
   }else if(group==='fund'){
    if(mixed){classes.cn.value=null;classes.us.value=null;}else{classes.cn.value=0;classes.us.value=r.amount;classes.us.lastValuation=r.date;}
    for(const p of positions.values())if(p.market==='mixed')p.value=null;const relevant=[...positions.values()].filter(p=>['cn','us'].includes(p.market)&&p.buys>0);for(const pos of relevant){pos.value=relevant.length===1?r.amount:null;pos.lastValuation=relevant.length===1?r.date:null;}if(Array.isArray(i.breakdownPartial))for(const part of i.breakdownPartial){const k=positionKey(part.market,part.platform),prior=positions.get(k)||{...fresh(),key:k,market:part.market,platform:part.platform};positions.set(k,{...prior,value:part.value,lastValuation:r.date});}
   }else{c.value=r.amount;c.lastValuation=r.date;p.value=r.amount;p.lastValuation=r.date;}
   return;
  }
  p.placeholder=false;if(market==='cn')mixed=true;
  const action=i.action||(r.amount>=0?'buy':'sell'),soldCost=i.costSold??(i.closed&&(!i.market||group!=='fund')?g.cost:null);const combined=positions.get(positionKey('mixed',platformOf(r)));if(combined&&combined.value!==null&&action==='buy')combined.value=round(combined.value+r.amount);for(const target of [g,c,p]){target.first??=r.date;if(action==='dividend'){target.distributed=round(target.distributed-r.amount);continue;}if(r.amount>=0){target.buys=round(target.buys+r.amount);if(target.cost!==null)target.cost=round(target.cost+r.amount);if(target.value!==null)target.value=round(target.value+r.amount);}else{target.sells=round(target.sells-r.amount);const costSold=soldCost;if(target.cost!==null&&costSold!=null)target.cost=round(Math.max(0,target.cost-costSold));else target.cost=null;}}
  if(action==='sell'){
   if(i.remainingValue!=null)g.value=i.remainingValue;
   if(i.market&&i.positionRemainingValue!=null){const previous=p.value;c.value=c.value===null?null:round(c.value-(previous||0)+i.positionRemainingValue);p.value=i.positionRemainingValue;}
   else if(group!=='fund'&&i.remainingValue!=null){c.value=i.remainingValue;p.value=i.remainingValue;}
   else if(group==='fund'&&i.remainingValue!=null){c.value=null;p.value=null;}
  }
 }
 function snapshot(date){const decorate=(v,asset)=>({...v,asset,name:marketNames[asset]||'历史投资合计',profit:v.value===null?null:round(v.value+v.sells+v.distributed-v.buys),roi:v.value===null||!v.buys?null:round(v.value+v.sells+v.distributed-v.buys)/v.buys});const cards=Object.entries(classes).map(([m,c])=>decorate(c,m)),groupRows=Object.entries(groups).map(([m,g])=>decorate(g,m)),sum=k=>round(groupRows.reduce((n,g)=>n+g[k],0)),buys=sum('buys'),profit=sum('profit');return {date,latest,splitDate,cards,positions:[...positions.values()].filter(p=>!p.placeholder&&(p.buys||p.value||p.value===null||p.lastValuation)).map(p=>{if(p.market==='mixed'){const children=[...positions.values()].filter(c=>['cn','us'].includes(c.market)&&c.platform===p.platform);p={...p,buys:round(children.reduce((n,c)=>n+c.buys,0)),sells:round(children.reduce((n,c)=>n+c.sells,0)),distributed:round(children.reduce((n,c)=>n+c.distributed,0))};}return {...decorate(p,p.market),market:p.market,platform:p.platform,key:p.key};}),groups:groupRows,overall:{buys,profit,roi:buys?profit/buys:null,value:sum('value'),sells:sum('sells'),distributed:sum('distributed')},unallocated:classes.cn.value===null||classes.us.value===null?groups.fund.value:0};}
 return {apply,snapshot};
}
export function portfolio(records,until='9999-12-31'){const e=engine();for(const r of sorted(records))if(r.date<=until)e.apply(r);return e.snapshot(until);}
const historyCache=new WeakMap();
export function profitHistory(records,{from,to,unit='month'}){let cache=historyCache.get(records);if(!cache){cache=new Map();historyCache.set(records,cache);}const key=[from,to,unit].join('|');if(cache.has(key))return cache.get(key);const rs=sorted(records).filter(r=>r.date<=to);if(!rs.length)return [];const e=engine(),points=[];let i=0;const first=rs[0].date,cursor=new Date((from>first?from:first)+'T00:00:00Z');
 while(cursor.toISOString().slice(0,10)<=to){const date=cursor.toISOString().slice(0,10);while(i<rs.length&&rs[i].date<=date)e.apply(rs[i++]);const next=new Date(cursor);next.setUTCDate(next.getUTCDate()+1);const nextDate=next.toISOString().slice(0,10);if(unit==='day'||date===to||(unit==='month'?date.slice(0,7)!==nextDate.slice(0,7):date.slice(0,4)!==nextDate.slice(0,4))){const s=e.snapshot(date),active=c=>!!(c.buys||c.sells||c.distributed||(c.value!==null&&c.value)),states=Object.fromEntries(s.cards.map(c=>[c.asset,c.value===null?'unknown':active(c)?'known':'not-started']));points.push({date,key:unit==='day'?date:unit==='year'?date.slice(0,4):date.slice(0,7),total:active(s.overall)?s.overall.profit:null,states,...Object.fromEntries(s.cards.map(c=>[c.asset,active(c)?c.profit:null]))});}cursor.setUTCDate(cursor.getUTCDate()+1);}
 if(cache.size>12)cache.clear();cache.set(key,points);return points;
}
export function buildBreakdown(rows){const seen=new Set(),result=[];for(const row of rows){const platform=String(row.platform||'').trim(),market=row.market,value=Number(row.value);if(!['cn','us'].includes(market)||!platform||/[|｜+＋]/.test(platform)||row.value===''||!Number.isFinite(value)||value<0)throw Error('请为每个平台填写非负持仓市值（无持仓填0），平台名称不能合并填写。');const key=positionKey(market,platform);if(seen.has(key))throw Error('同一平台和资产类别重复，请合并为一行。');seen.add(key);result.push({market,platform,value:round(value)});}if(!result.length)throw Error('请至少填写一项估值。');return result;}

export function portfolioBefore(records,old,date){if(!old||old.date!==date)return portfolio(records.filter(r=>r.id!==old?.id),date);const rs=sorted(records),index=rs.findIndex(r=>r.id===old.id);return portfolio(index<0?rs:rs.slice(0,index),date);}

// Crop only the unused prefix. Keep real zeroes, later missing periods and explicit unknown gaps.
export function visibleProfitPoints(points,series){const first=points.findIndex(p=>series.some(key=>Number.isFinite(p[key])));return first<0?[]:points.slice(first);}
