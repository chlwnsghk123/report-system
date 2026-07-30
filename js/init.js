// ─── 마스코트 이미지 수동 등록 ───
function loadMascotImages(){
  const mascotFiles={
    // 75% 이상 (high): 밝은 표정 동물 8종
    high:[
      'v2_75plus_kids_01_B_cat.png','v2_75plus_kids_02_B_puppy.png',
      'v2_75plus_kids_03_B_bunny.png','v2_75plus_kids_04_B_squirrel.png',
      'v2_75plus_kids_05_B_polar_bear.png','v2_75plus_kids_06_B_bear.png',
      'v2_75plus_kids_07_B_panda.png','v2_75plus_kids_08_B_hamster.png'
    ],
    // 30% 이상 ~ 75% 미만 (mid): 동물 8종 (B)
    mid:[
      'v3_30below_01_B_cat.png','v3_30below_02_B_puppy.png',
      'v3_30below_03_B_bunny.png','v3_30below_04_B_squirrel.png',
      'v3_30below_05_B_polar_bear.png','v3_30below_06_B_bear.png',
      'v3_30below_07_B_panda.png','v3_30below_08_B_hamster.png'
    ],
    // 30% 미만 (low): 동물 8종 (A)
    low:[
      'v3_30below_01_A_cat.png','v3_30below_02_A_puppy.png',
      'v3_30below_03_A_bunny.png','v3_30below_04_A_squirrel.png',
      'v3_30below_05_A_polar_bear.png','v3_30below_06_A_bear.png',
      'v3_30below_07_A_panda.png','v3_30below_08_A_hamster.png'
    ]
  };
  for(const tier of ['high','mid','low']){
    registerMascots(tier,mascotFiles[tier]);
  }
}

// ─── 전역 키보드 핸들러 ───
document.addEventListener('keydown',function(e){
  // ESC: 열려있는 모달 닫기 (비고 > 수업설정 우선순위)
  if(e.key==='Escape'){
    // 동적 모달 닫기 (학생관리, 도움말 등)
    const dynModals=document.querySelectorAll('.stu-modal-overlay,.help-overlay');
    if(dynModals.length){dynModals.forEach(m=>m.remove());e.preventDefault();return;}
    const memo=$$('memoModalOverlay');
    if(memo&&memo.style.display==='flex'){closeMemo();e.preventDefault();return;}
    const lesson=$$('lessonModalOverlay');
    if(lesson&&lesson.style.display==='flex'){
      // 수업설정은 날짜 뷰가 있을 때만 닫기
      if(G.selDate&&G.lessons.length){closeLessonModal();switchView('date');e.preventDefault();}
      return;
    }
  }
  // Ctrl+S: 저장
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){
    e.preventDefault();
    const memo=$$('memoModalOverlay');
    if(memo&&memo.style.display==='flex'){
      saveMemo();return;
    }
    const lesson=$$('lessonModalOverlay');
    if(lesson&&lesson.style.display==='flex'){
      _showModalToast('lessonModalOverlay','저장되었습니다');
      saveAppData();return;
    }
    // 일반 화면: 파일 저장
    const btn=$$('btnSave');
    if(btn&&btn.style.display!=='none'&&!btn.disabled)saveToExcel();
  }
});

// ─── 패널 리사이즈 ───
function initPanelResize(){
  const handle=$$('panelResize'),panel=document.querySelector('.panel');
  if(!handle||!panel)return;
  let startX,startW;
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();startX=e.clientX;startW=panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor='col-resize';document.body.style.userSelect='none';
    const onMove=ev=>{
      const w=Math.max(280,Math.min(700,startW+(ev.clientX-startX)));
      panel.style.width=w+'px';
    };
    const onUp=()=>{
      handle.classList.remove('dragging');
      document.body.style.cursor='';document.body.style.userSelect='';
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      setTimeout(updateScale,50);
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

// ─── 앱 진입점 ───
window.onload=async()=>{
  db=await openDB();
  updateScale();window.addEventListener('resize',updateScale);
  initCE();initReportListeners();
  loadMascotImages();
  initPanelResize();
  // PDF 데이터 초기화 (매 로드 시 리셋)
  G.studentPdfs={};
  try{await dbSet('studentPdfs',null);}catch(e){}
  // 항상 새로 시작 — 이전 세션 자동 복원 없음
  // 미저장 상태에서 사이트 닫기 경고
  window.addEventListener('beforeunload',e=>{
    if(G.unsaved){e.preventDefault();}
  });
};
