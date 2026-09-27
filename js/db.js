// ─── IndexedDB 헬퍼 ───
async function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore(STORE);
    r.onsuccess=e=>res(e.target.result);
    r.onerror=()=>rej(r.error);
  });
}
// 저장 — 트랜잭션 실패·중단 시 reject (용량 초과 등으로 영원히 대기하지 않도록)
async function dbSet(k,v){
  if(!db)throw new Error('IndexedDB를 사용할 수 없습니다');
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(v,k);
    tx.oncomplete=()=>res();
    tx.onerror=tx.onabort=()=>rej(tx.error||new Error('IndexedDB 저장 실패'));
  });
}
async function dbGet(k){
  if(!db)return null;
  return new Promise(r=>{
    try{
      const q=db.transaction(STORE,'readonly').objectStore(STORE).get(k);
      q.onsuccess=()=>r(q.result);
      q.onerror=()=>r(null);
    }catch(e){r(null);}
  });
}
