import {accountBalances} from './core.mjs';
export function balanceHistory(ledger,records,unit='month'){
 const live=records.filter(r=>!r.deleted),latest=live.map(r=>r.date).sort().at(-1);if(!latest)return [];
 const months=[...new Set((ledger.snapshots||[]).filter(s=>s.position==='opening'&&s.month<=latest.slice(0,7)).map(s=>s.month))].sort();
 const points=[];
 for(const month of months){
  const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),until=end<latest?end:latest;
  if(unit==='day'){
   const cursor=new Date(month+'-01T00:00:00Z');while(cursor.toISOString().slice(0,10)<=until){const date=cursor.toISOString().slice(0,10);points.push({key:date,date,month,balances:accountBalances(ledger,live,month,date)});cursor.setUTCDate(cursor.getUTCDate()+1);}
  }else points.push({key:unit==='year'?month.slice(0,4):month,date:until,month,balances:accountBalances(ledger,live,month,until)});
 }
 if(unit!=='year')return points;
 const yearly=new Map;for(const point of points)yearly.set(point.key,point);return [...yearly.values()];
}
