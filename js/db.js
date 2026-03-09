// ─── IndexedDB 헬퍼 ───
async function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore(STORE);
    r.onsuccess=e=>res(e.target.result);
    r.onerror=rej;
  });
}
async function dbSet(k,v){
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(v,k);
  return new Promise(r=>tx.oncomplete=r);
}
async function dbGet(k){
  return new Promise(r=>{
    const q=db.transaction(STORE,'readonly').objectStore(STORE).get(k);
    q.onsuccess=()=>r(q.result);
    q.onerror=()=>r(null);
  });
}
