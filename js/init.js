// ─── 마스코트 이미지 수동 등록 ───
function loadMascotImages(){
  const mascotFiles={
    high:[
      '01_char_r0_c0.png','01_char_r0_c0_.png','01_char_r0_c0__.png','01_char_r0_c0___.png',
      '02_char_r0_c1.png','02_char_r0_c1_.png','02_char_r0_c1__.png','02_char_r0_c1___.png',
      '03_char_r0_c2.png','03_char_r0_c2__.png',
      '04_char_r0_c3.png','05_char_r0_c4.png',
      '06_char_r1_c0.png','06_char_r1_c0__.png',
      '07_char_r1_c1.png','07_char_r1_c1__.png',
      '08_char_r1_c2.png','08_char_r1_c2__.png',
      '11_char_r2_c0.png','12_char_r2_c1.png'
    ],
    mid:[
      '03_char_r0_c2_.png','05_char_r0_c4___.png',
      '06_char_r1_c0.png','07_char_r1_c1.png','08_char_r1_c2.png',
      '09_char_r1_c3_.png','09_char_r1_c3__.png',
      '10_char_r1_c4.png','10_char_r1_c4_.png','10_char_r1_c4__.png',
      '14_char_r2_c3_.png'
    ],
    low:[
      '03_char_r0_c2___.png',
      '04_char_r0_c3_.png','04_char_r0_c3___.png',
      '05_char_r0_c4__.png',
      '13_char_r2_c2_.png'
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
  // PDF 데이터 복원
  await restorePdfData();
  // 항상 새로 시작 — 이전 세션 자동 복원 없음
};
