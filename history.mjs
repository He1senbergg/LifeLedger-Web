import {accountBalances,applyBalanceRecord} from './core.mjs';
export function balanceHistory(ledger,records,unit='month'){
 const live=records.filter(r=>!r.deleted),latest=live.reduce((date,r)=>r.date>date?r.date:date,'');if(!latest)return [];
 const months=[...new Set((ledger.snapshots||[]).filter(s=>s.position==='opening'&&s.month<=latest.slice(0,7)).map(s=>s.month))].sort();
 if(months.length){let m=months.at(-1);while(m<latest.slice(0,7)){const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);m=d.toISOString().slice(0,7);months.push(m);}}
 const points=[],byMonth=new Map;
 for(const r of live){const month=r.date.slice(0,7);if(!byMonth.has(month))byMonth.set(month,[]);byMonth.get(month).push(r);}
 for(const month of months){
  const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),until=end<latest?end:latest;
  const initial=accountBalances(ledger,live.filter(r=>r.date<month+'-01'),month),map=new Map(initial.map(b=>[b.account,b]));
  const rs=(byMonth.get(month)||[]).filter(r=>r.date<=until).sort((a,b)=>a.date.localeCompare(b.date)||(a.source?.row??1e9)-(b.source?.row??1e9)||(a.orderAt||a.updatedAt).localeCompare(b.orderAt||b.updatedAt));
  const point=date=>({key:unit==='year'?month.slice(0,4):unit==='month'?month:date,date,month,balances:[...map.values()].map(b=>({...b}))});
  if(unit==='day'){
   let index=0;const cursor=new Date(month+'-01T00:00:00Z');while(cursor.toISOString().slice(0,10)<=until){const date=cursor.toISOString().slice(0,10);while(index<rs.length&&rs[index].date<=date)applyBalanceRecord(map,rs[index++]);points.push(point(date));cursor.setUTCDate(cursor.getUTCDate()+1);}
  }else{for(const r of rs)applyBalanceRecord(map,r);points.push(point(until));}
 }
 if(unit!=='year')return points;
 const yearly=new Map;for(const point of points)yearly.set(point.key,point);return [...yearly.values()];
}
