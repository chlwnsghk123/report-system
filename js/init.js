// ─── 앱 진입점 ───
window.onload=async()=>{
  db=await openDB();
  updateScale();window.addEventListener('resize',updateScale);
  initCE();
  const saved=await dbGet('appData');
  if(saved){
    Object.assign(G,{
      lessons:saved.lessons||[],students:saved.students||[],
      rates:saved.rates||{},scores:saved.scores||{},corrects:saved.corrects||{},
      wrong:saved.wrong||{},hwRec:saved.hwRec||{},tabData:saved.tabData||{},
      excelFileName:saved.fileName||G.excelFileName
    });
    populateSels();showGroups();
    setBar('ok',`✅ ${G.excelFileName}`);
    const sess=await dbGet('session');
    if(sess)restoreSession(sess);
  }
};
