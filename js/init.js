// ─── 앱 진입점 ───
window.onload=async()=>{
  db=await openDB();
  updateScale();window.addEventListener('resize',updateScale);
  initCE();initReportListeners();
  // 항상 새로 시작 — 이전 세션 자동 복원 없음
};
