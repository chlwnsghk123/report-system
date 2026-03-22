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
      '04_char_r0_c3_.png','04_char_r0_c3__.png','04_char_r0_c3___.png',
      '05_char_r0_c4__.png',
      '13_char_r2_c2_.png','14_char_r2_c3.png','15_char_r2_c4.png'
    ]
  };
  for(const tier of ['high','mid','low']){
    registerMascots(tier,mascotFiles[tier]);
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
