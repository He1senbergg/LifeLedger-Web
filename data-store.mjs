// Cache one merged array per immutable state revision, not one merge per row.
export function createLedgerCache(){
 let source,pending,records=[],active=[],snapshotMeta,pendingMeta,meta={},base,merged,builds=0;
 return {get(state){
  let changed=false;
  if(source!==state.ledger.records||pending!==state.pending){source=state.ledger.records;pending=state.pending;const map=new Map(source.map(r=>[r.id,r]));for(const op of pending)map.set(op.record.id,op.record);records=[...map.values()];active=records.filter(r=>!r.deleted);builds++;changed=true;}
  if(snapshotMeta!==state.ledger.meta||pendingMeta!==state.pendingMeta){snapshotMeta=state.ledger.meta;pendingMeta=state.pendingMeta;meta={...snapshotMeta,...pendingMeta};changed=true;}
  if(changed||base!==state.ledger){base=state.ledger;merged={...base,records,meta};}
  return {ledger:merged,records:active,builds};
 }};
}
