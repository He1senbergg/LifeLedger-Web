export const KINDS=['支出','收入','其它','-','理财支出','理财余额','国债支出','国债余额','历史净额','未分类'];
export const ACCOUNTS=['微信','支付宝','中行','招行','建行','微众','现金','校园卡','莫奈卡','日元现金','ICOCA','理财余额','国债余额','历史未记录'];
export function validateRecord(r){
 if(!r || typeof r.id!=='string'||!r.id||typeof r.version!=='string')throw Error('记录缺少编号或版本');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('日期无效');
 if(typeof r.amount!=='number'||!Number.isFinite(r.amount)||Math.abs(r.amount)>1e12)throw Error('金额无效');
 if(!['CNY','USD','JPY','GBP','HKD','EUR'].includes(r.currency))throw Error('币种无效');
 for(const k of ['kind','category','description','account'])if(typeof r[k]!=='string'||r[k].length>10000)throw Error('字段无效：'+k);
 return r;
}
export function validateLedger(d){
 if(!d||d.schema!==1||!Array.isArray(d.records)||d.records.length>100000)throw Error('不是支持的账本文件');
 const ids=new Set; for(const r of d.records){validateRecord(r);if(ids.has(r.id))throw Error('账本含重复编号');ids.add(r.id);} return d;
}
export function mergePending(remote,pending){
 validateLedger(remote); const records=new Map(remote.records.map(r=>[r.id,r])); const conflicts=[]; const applied=[];
 for(const op of pending){validateRecord(op.record);const current=records.get(op.record.id);
  if(current?.version===op.record.version){applied.push(op.record.id);continue;}
  if((current?.version??null)!==op.baseVersion){conflicts.push({id:op.record.id,local:op.record,remote:current??null,baseVersion:op.baseVersion});continue;}
  records.set(op.record.id,op.record);applied.push(op.record.id);
 }
 return {ledger:{...remote,records:[...records.values()]},conflicts,applied};
}
export function visibleRecords(ledger,pending){const m=new Map(ledger.records.map(r=>[r.id,r]));for(const p of pending)m.set(p.record.id,p.record);return [...m.values()].filter(r=>!r.deleted);}
export function queueRecord(state,record,old){
 const first=state.pending.find(p=>p.record.id===record.id);
 if(first&&first.record.version!==old?.version)throw Error('这笔记录已在另一个窗口修改，请重新打开后编辑。');
 const baseVersion=first?first.baseVersion:old?.version??null;
 return {...state,pending:state.pending.filter(p=>p.record.id!==record.id).concat({baseVersion,record})};
}
export function acknowledge(state,ledger,ops,metaOps,lastSync){
 const processed=new Map(ops.map(o=>[o.record.id,o]));
 const pending=state.pending.filter(o=>processed.get(o.record.id)?.record.version!==o.record.version).map(o=>{const done=processed.get(o.record.id);return done&&o.baseVersion===done.baseVersion?{...o,baseVersion:done.record.version}:o;});
 const pendingMeta={...state.pendingMeta};for(const[k,v]of Object.entries(metaOps)){if(JSON.stringify(pendingMeta[k])===JSON.stringify(v))delete pendingMeta[k];else if(k.startsWith('project:')&&pendingMeta[k]&&pendingMeta[k]._baseVersion===v._baseVersion)pendingMeta[k]={...pendingMeta[k],_baseVersion:v.version};}
 return {...state,ledger,pending,pendingMeta,lastSync};
}
export function totals(records,currency='CNY'){
 let income=0,expense=0,investment=0,legacyNet=0;const cents=v=>Math.round(v*100);
 for(const r of records){if(r.deleted||r.currency!==currency)continue;
  if(r.kind==='收入')income-=cents(r.amount);
  if(r.kind==='支出')expense+=cents(r.amount);
  if(['理财支出','国债支出'].includes(r.kind))investment+=cents(r.amount);
  if(r.kind==='历史净额')legacyNet+=cents(r.amount);
 }return {income:income/100,expense:expense/100,investment:investment/100,legacyNet:legacyNet/100,net:(income-expense-investment)/100};
}
export function accountBalances(ledger,records,month,asOf=null){
 const snapshot=(ledger.snapshots??[]).find(s=>s.month===month&&s.position==='opening'); if(!snapshot)return [];
 const map=new Map(snapshot.balances.map(b=>[b.account.replace(/\s*\(\$\)/g,'').trim(),{...b,account:b.account.replace(/\s*\(\$\)/g,'').trim()}]));
 const rs=records.filter(r=>!r.deleted&&r.date.startsWith(month)&&(!asOf||r.date<=asOf)).sort((a,b)=>a.date.localeCompare(b.date)||((a.source?.row??1e9)-(b.source?.row??1e9))||a.updatedAt.localeCompare(b.updatedAt));
 for(const r of rs){
  if(['理财余额','国债余额'].includes(r.kind)){map.set(r.kind,{account:r.kind,currency:r.currency,amount:r.amount});continue;}
  if(['理财支出','国债支出'].includes(r.kind)){const key=r.kind==='理财支出'?'理财余额':'国债余额',b=map.get(key)||{account:key,currency:r.currency,amount:0};b.amount=Math.round((b.amount+r.amount)*100)/100;map.set(key,b);}
  const b=map.get(r.account);if(b&&b.currency===r.currency)b.amount=Math.round((b.amount-r.amount)*100)/100;
 }return [...map.values()];
}
export function currencyBalances(balances){
 const totals=new Map();
 for(const b of balances){const total=totals.get(b.currency)||{currency:b.currency,cents:0,accounts:0};total.cents+=Math.round(b.amount*100);total.accounts++;totals.set(b.currency,total);}
 const order=['CNY','USD','JPY','GBP','HKD','EUR'];
 return [...totals.values()].sort((a,b)=>order.indexOf(a.currency)-order.indexOf(b.currency)).map(({currency,cents,accounts})=>({currency,amount:cents/100,accounts}));
}
export function csv(records){
 const safe=v=>{let s=String(v??'');if(/^[=+@\t\r]/.test(s)||(/^\-/.test(s)&&Number.isNaN(Number(s))))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const rows=[['日期','类型','类1','类2 / 备注','账户','币种','原始金额（支出正、入账负）','来源文件','来源月份','来源行'],...records.filter(r=>!r.deleted).map(r=>[r.date,r.kind,r.category,r.description,r.account,r.currency,r.amount,r.source?.file,r.source?.sheet,r.source?.row])];
 return '\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n');
}
