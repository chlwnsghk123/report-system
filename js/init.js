// ─── 마스코트 이미지 스캔 ───
async function loadMascotImages(){
  const tiers=['high','mid','low'];
  for(const tier of tiers){
    try{
      const res=await fetch('img/mascots/'+tier+'/');
      if(!res.ok)continue;
      const html=await res.text();
      // 디렉토리 리스팅에서 이미지 파일명 추출
      const re=/href="([^"]+\.(?:png|jpg|jpeg|gif|webp|svg))"/gi;
      const files=[];let m;
      while((m=re.exec(html))!==null)files.push(m[1]);
      if(files.length)registerMascots(tier,files);
    }catch(e){}
  }
}

// ─── 앱 진입점 ───
window.onload=async()=>{
  db=await openDB();
  updateScale();window.addEventListener('resize',updateScale);
  initCE();initReportListeners();
  loadMascotImages();
  // 항상 새로 시작 — 이전 세션 자동 복원 없음
};
