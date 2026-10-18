import {investmentRecord,marketOf,platformOf,marketNames} from './investment-engine.mjs';
export const eventPageSize=100;
export const actionNames={buy:'买入',sell:'卖出',valuation:'估值',dividend:'现金分红'};
export function eventAction(r){return r.investment?.action||(['理财余额','投资余额','国债余额'].includes(r.kind)?'valuation':r.amount<0?'sell':'buy');}
export function eventAsset(r){return r.investment?.breakdown?'股票平台拆分估值':r.investment?.breakdownPartial?'平台已拆，市场部分待拆':['理财余额','投资余额'].includes(r.kind)?'股票合并估值':marketNames[marketOf(r)];}
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1');
export function createInvestmentEventIndex(){
 let source=null,index=[],generation=0;const cache=new Map();
 function query(records,{from='',to='',search='',page=1}={}){
  if(source!==records){source=records;generation++;cache.clear();index=records.filter(r=>!r.deleted&&investmentRecord(r)).sort((a,b)=>b.date.localeCompare(a.date)||(b.source?.row??0)-(a.source?.row??0)||(b.orderAt||b.updatedAt).localeCompare(a.orderAt||a.updatedAt)||a.id.localeCompare(b.id)).map(record=>({record,text:normalize([record.date,record.category,record.description,record.account,record.kind,record.kind.replaceAll('理财','投资'),record.currency,record.amount,Math.abs(record.amount).toFixed(2),record.investment?.positionValue,eventAsset(record),marketNames[marketOf(record)],platformOf(record),actionNames[eventAction(record)],record.investment?.action,...(record.tags||[]),record.source?.file,record.source?.sheet,...(record.investment?.breakdown||record.investment?.breakdownPartial||[]).map(p=>p.platform+' '+(marketNames[p.market]||'混合')+' '+p.value)].join(' '))}));}
  if(from&&to&&from>to)return {valid:false,rows:[],total:0,page:1,pages:1,generation};
  const terms=normalize(search).trim().split(/\s+/).filter(Boolean),key=JSON.stringify([from,to,terms]);let matches=cache.get(key);
  if(!matches){matches=index.filter(({record:r,text})=>(!from||r.date>=from)&&(!to||r.date<=to)&&terms.every(term=>text.includes(term))).map(i=>i.record);if(cache.size>=8)cache.clear();cache.set(key,matches);}
  const pages=Math.max(1,Math.ceil(matches.length/eventPageSize)),current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1))),offset=(current-1)*eventPageSize;
  return {valid:true,rows:matches.slice(offset,offset+eventPageSize),matches,total:matches.length,page:current,pages,offset,generation};
 }
 return {query};
}
