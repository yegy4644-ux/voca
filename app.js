/* ====== 해커스 보카 (DAY 1~7) ====== */
const WORDS = window.WORDS || [];
const LS_PROG = "voca_progress_v2";   // {id:{box,due,seen,ok,no,learned}}
const LS_MNEMO = "voca_mnemo_v2";     // {id:"경선식 연상법"}
const LS_SESS = "voca_session_v1";    // 진행 중 외우기 세션 (이어하기)
const LS_RANGE = "voca_range_v1";     // DAY 범위 선택 기억

/* ---- storage ---- */
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let prog = load(LS_PROG, {});
let mnemo = load(LS_MNEMO, {});

/* ---- date / SRS ---- */
const todayStr = () => { const d = new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); };
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset()*60000) / 86400000);
const INTERVALS = [0, 1, 2, 4, 7, 15, 30];

function getP(id){ return prog[id] || {box:0, due:0, seen:0, ok:0, no:0, learned:false}; }
function isDue(id){ const p = prog[id]; return p && p.learned && p.due <= dayNum(); }
function isLearned(id){ const p = prog[id]; return p && p.learned; }
function grade(id, correct){
  const p = getP(id);
  p.seen++;
  if(correct){ p.ok++; p.box = Math.min(p.box+1, INTERVALS.length-1); p.learned = true; }
  else { p.no++; p.box = 0; p.learned = true; }
  p.due = dayNum() + INTERVALS[p.box];
  prog[id] = p; save(LS_PROG, prog);
}

/* ---- word helpers (new schema with senses) ---- */
const DAYS = [...new Set(WORDS.map(w=>w.day))].sort((a,b)=>a-b);
const norm = s => (s+"").toLowerCase().replace(/\s+/g," ").trim();
function wMeaning(w){ return w.senses.map(s=>s.meaning).join(" / "); }
function wSyns(w){ const all=[]; w.senses.forEach(s=>s.synonyms.forEach(x=>{ if(!all.includes(x)) all.push(x); })); return all; }
function isKey(w,x){ return w.keys && w.keys.includes(norm(x)); }
function synChip(w,x){ return `<span class="syn${isKey(w,x)?' key':''}">${esc(x)}</span>`; }
function pickSyn(o){ const s=wSyns(o); return s.length? s[Math.floor(Math.random()*s.length)] : null; }

/* ---- 발음 (Web Speech API) ---- */
let VOICES=[];
function loadVoices(){ try{ VOICES=window.speechSynthesis.getVoices()||[]; }catch{} }
if("speechSynthesis" in window){ loadVoices(); window.speechSynthesis.onvoiceschanged=loadVoices; }
function speak(text){
  if(!("speechSynthesis" in window)){ toast("이 브라우저는 발음을 지원하지 않아요"); return; }
  try{
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-US"; u.rate=0.92;
    const v=VOICES.find(v=>/en[-_]US/i.test(v.lang)) || VOICES.find(v=>/^en/i.test(v.lang));
    if(v) u.voice=v;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function speakMany(list){
  if(!("speechSynthesis" in window)){ toast("이 브라우저는 발음을 지원하지 않아요"); return; }
  try{
    window.speechSynthesis.cancel();
    const v=VOICES.find(v=>/en[-_]US/i.test(v.lang)) || VOICES.find(v=>/^en/i.test(v.lang));
    list.filter(Boolean).forEach(t=>{
      const u=new SpeechSynthesisUtterance(t); u.lang="en-US"; u.rate=0.92; if(v) u.voice=v;
      window.speechSynthesis.speak(u);   // 여러 개 호출하면 순서대로 큐에 쌓여 차례로 읽음
    });
  }catch(e){}
}
const autoOn = ()=> !$("#autoSpeak") || $("#autoSpeak").checked;
function mountSpk(word, auto){
  const b=document.getElementById("spkBtn");
  if(b) b.onclick=(e)=>{ e.stopPropagation(); speak(word); };
  wireCopy(word);
  if(auto && autoOn()) setTimeout(()=>speak(word), 250);
}
function mountSpkMany(list, auto){
  const b=document.getElementById("spkBtn");
  if(b) b.onclick=(e)=>{ e.stopPropagation(); speakMany(list); };
  wireCopy(list[0]);
  if(auto && autoOn()) setTimeout(()=>speakMany(list), 200);
}
const SPKBTN = `<button class="spk" id="spkBtn" title="발음 듣기">🔊</button>`;

/* ---- 복사 ---- */
function fallbackCopy(text,done){
  try{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); ta.remove(); done&&done(); }
  catch(e){ toast("복사 실패"); }
}
function copy(text){
  const done=()=>toast("복사됨: "+text);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done));
  } else fallbackCopy(text,done);
}
function wireCopy(word){ const cb=document.getElementById("copyBtn"); if(cb) cb.onclick=(e)=>{ e.stopPropagation(); copy(word); }; }
const COPYBTN = `<button class="cpy" id="copyBtn" title="단어 복사">📋</button>`;

/* ---- 메모 굵게 (**텍스트** -> 볼드) ---- */
function mdBold(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
function boldWord(sentence, word){
  // bold the headword (and simple inflections) in example
  const base = word.split(" ")[0].replace(/[^a-zA-Z]/g,"");
  if(!base) return esc(sentence);
  const re = new RegExp("\\b("+base+"[a-z]*)\\b","gi");
  return esc(sentence).replace(re, "<b>$1</b>");
}

/* ---- elements ---- */
const $ = s => document.querySelector(s);
const sections = ["home","study","quiz","sheet","done"];
function show(sec){ sections.forEach(s=>$("#"+s).classList.toggle("hidden", s!==sec)); window.scrollTo(0,0); }
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1600); }
function esc(s){ return (s+"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---- home ---- */
function dueCount(){ return WORDS.filter(w=>isDue(w.id)).length; }
function learnedCount(){ return WORDS.filter(w=>isLearned(w.id)).length; }
function renderHome(){
  const cf = $("#catFrom"), ct = $("#catTo");
  if(cf && !cf.children.length){
    const opts = DAYS.map(d=>`<option value="${d}">DAY ${d}</option>`).join("");
    cf.innerHTML = opts; ct.innerHTML = opts;
    const r = load(LS_RANGE, null);
    if(r && DAYS.includes(r.from) && DAYS.includes(r.to)){ cf.value = r.from; ct.value = r.to; }
    else { cf.value = DAYS[Math.max(0, DAYS.length-3)]; ct.value = DAYS[DAYS.length-1]; }  // 기본: 최근 3일치
    const onch = ()=> save(LS_RANGE, {from:parseInt(cf.value,10), to:parseInt(ct.value,10)});
    cf.onchange = onch; ct.onchange = onch;
  }
  const total = WORDS.length, learned = learnedCount(), due = dueCount();
  $("#homeBar").style.width = (total? (learned/total*100):0) + "%";
  $("#homeProg").textContent = `${learned} / ${total} 외움`;
  $("#homeDue").textContent = `오늘 복습 ${due}개`;
  $("#reviewBadge").textContent = `오늘 ${due}개`;
  $("#hstat").textContent = `${learned}/${total}`;
  $("#totalCount").textContent = total;
}

/* ---- session ---- */
function pool(){
  const a = parseInt($("#catFrom").value,10), b = parseInt($("#catTo").value,10);
  const lo = Math.min(a,b), hi = Math.max(a,b);
  let arr = WORDS.filter(w=> w.day>=lo && w.day<=hi);
  if($("#ksOnly") && $("#ksOnly").checked) arr = arr.filter(w=>w.ks_has);
  return arr;
}
function ksHtml(w){
  if(!w.ks_has) return "";
  let html = `<div class="sec-title" style="margin-top:14px">📖 경선식 (안 외워질 때 펴보기)</div><div class="ks">`;
  if(w.ks_head && w.ks_head.length){
    html += `<div class="ks-head">표제어 ${esc(w.word)} · ${w.ks_head.map(p=>"p."+p).join(", ")}</div>`;
  }
  let ss = (w.ks_syn||[]).slice().sort((a,b)=>(b.k?1:0)-(a.k?1:0));
  if(ss.length){
    const shown = ss.slice(0,5).map(s=>`<span class="${s.k?'kk':''}">${esc(s.t)} ${s.p.map(p=>"p."+p).join("/")}</span>`).join(" · ");
    const more = ss.length>5 ? ` <span class="small">외 ${ss.length-5}개</span>` : "";
    html += `<div class="ks-syn">동의어 · ${shown}${more}</div>`;
  }
  html += `</div>`;
  return html;
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function buildSession(mode){
  const count = parseInt($("#countSel").value,10);
  if(mode==="review"){
    let arr = WORDS.filter(w=>isDue(w.id));
    arr.sort((a,b)=>getP(a.id).due - getP(b.id).due);
    return arr;
  }
  let arr = pool();
  if($("#newFirst").checked){
    arr = shuffle(arr.filter(w=>!isLearned(w.id))).concat(shuffle(arr.filter(w=>isLearned(w.id))));
  } else arr = shuffle(arr);
  return arr.slice(0, count);
}

/* ================= STUDY / REVIEW / SYN ================= */
let S = null, timerId = null;
function clearTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

/* ---- 세션 저장/이어하기 (외우기·동의어 회독) ---- */
function scopeSig(mode){   // 범위+모드만으로 식별 → 단어수/정렬 옵션이 리로드로 초기화돼도 이어하기 유지
  return [mode, $("#catFrom").value, $("#catTo").value].join("|");
}
function saveSession(){
  if(!S || !S.loop) return;
  const ids = S.queue.map(w=>w.id);
  if(S.cur) ids.unshift(S.cur.id);   // 현재 카드도 포함해 이어하기 시 다시 표시
  save(LS_SESS, { sig:S.sig, round:S.round, roundTotal:S.roundTotal, total:S.total,
    mastered:S.mastered, ok:S.ok, no:S.no, queueIds:ids, wrongIds:S.wrong.map(w=>w.id) });
}
function clearSession(){ localStorage.removeItem(LS_SESS); }

function startStudy(mode){
  const loop = (mode==="study"||mode==="syn");   // 회독 방식: 1회독 다 돌고 → 못 외운 것만 다음 회독
  if(loop){   // 같은 범위의 진행 중 세션이 있으면 이어하기
    const saved = load(LS_SESS, null);
    const cur = scopeSig(mode);
    // 앞 3개(모드|from|to)만 비교 → 예전(단어수/옵션 포함) 형식도 인식
    const sigMatch = saved && saved.sig && saved.sig.split("|").slice(0,3).join("|")===cur;
    if(sigMatch && saved.queueIds && saved.queueIds.length){
      const byId = {}; WORDS.forEach(w=>byId[w.id]=w);
      const q = saved.queueIds.map(id=>byId[id]).filter(Boolean);
      if(q.length){
        S = { mode, loop, queue:q, wrong:(saved.wrongIds||[]).map(id=>byId[id]).filter(Boolean),
          round:saved.round||1, roundTotal:saved.roundTotal||q.length, total:saved.total||q.length,
          mastered:saved.mastered||0, ok:saved.ok||0, no:saved.no||0, revealed:false, cur:null, sig:saved.sig };
        $("#studyTitle").textContent = mode==="syn"?"동의어":"외우기";
        toast("이어서 진행 ▶"); show("study"); nextCard(); return;
      }
    }
  }
  const list = buildSession(mode);
  if(!list.length){ toast(mode==="review"?"오늘 복습할 단어가 없어요 👍":"학습할 단어가 없어요"); return; }
  const q = list.slice();
  S = { mode, loop, queue:q, wrong:[], round:1, roundTotal:q.length, total:list.length,
        mastered:0, ok:0, no:0, revealed:false, cur:null, sig: loop?scopeSig(mode):null };
  $("#studyTitle").textContent = mode==="review"?"복습":mode==="syn"?"동의어":"외우기";
  show("study"); nextCard();
}
function nextCard(){
  if(!S.queue.length){
    if(S.loop && S.wrong.length){   // 이번 회독 끝 → 못 외운 것만 모아 다음 회독
      S.round++; S.queue = shuffle(S.wrong); S.wrong = []; S.roundTotal = S.queue.length;
    } else { if(S.loop) clearSession(); finish(); return; }
  }
  S.cur = S.queue.shift();
  if(S.loop) saveSession();
  renderCard();
}

function renderCard(){
  clearTimer(); S.revealed=false;
  const w = S.cur;
  $("#studyIdx").textContent = S.loop
    ? `${S.round}회독 · ${S.roundTotal - S.queue.length}/${S.roundTotal} · 익힘 ${S.mastered}`
    : `${S.total - S.queue.length} / ${S.total}`;
  const qcard = $("#qcard");
  $("#afterArea").innerHTML = "";
  const stars = "★".repeat(w.stars||0);
  if(S.mode==="syn"){
    qcard.innerHTML = `
      <div class="qcat">DAY ${w.day} · 동의어로 단어 맞히기</div>
      <div class="syns" style="justify-content:center;margin-top:14px">
        ${wSyns(w).slice(0,8).map(s=>synChip(w,s)).join("")||'<span class="small">동의어 없음</span>'}
      </div>
      <div class="qhint">탭하면 정답 공개</div>`;
  } else {
    qcard.innerHTML = `
      <div class="qcat">DAY ${w.day} <span class="stars">${stars}</span></div>
      <div class="qword">${esc(w.word)}</div>
      ${w.pron?`<div class="pron">[${esc(w.pron)}]</div>`:""}
      <div>${SPKBTN}${COPYBTN}</div>
      <div class="qhint">탭하면 뜻 공개</div>`;
    mountSpk(w.word, true);
  }
  const limit = parseInt($("#timeSel").value,10);
  const bar = $("#timerBar"), fill = $("#timerFill");
  bar.classList.remove("warn","danger");
  if(limit>0 && S.mode!=="review"){
    bar.style.visibility="visible"; let remain=limit*1000; const total=remain; fill.style.width="100%";
    timerId=setInterval(()=>{
      remain-=100; const pct=Math.max(0,remain/total*100); fill.style.width=pct+"%";
      bar.classList.toggle("warn",pct<50&&pct>=20); bar.classList.toggle("danger",pct<20);
      if(remain<=0){ clearTimer(); reveal(); }
    },100);
  } else bar.style.visibility="hidden";
}

function reveal(){
  if(S.revealed) return;
  S.revealed=true; clearTimer();
  const w = S.cur;
  const stars = "★".repeat(w.stars||0);
  $("#qcard").innerHTML = `
    <div class="qcat">DAY ${w.day} <span class="stars">${stars}</span></div>
    <div class="qword">${esc(w.word)}</div>
    ${w.pron?`<div class="pron">[${esc(w.pron)}]</div>`:""}
    <div>${SPKBTN}${COPYBTN}</div>`;
  // 공개되면 표제어 + 동의어들을 순서대로 자동 발음
  mountSpkMany([w.word].concat(wSyns(w).slice(0,8)), true);

  const senses = w.senses.map(s=>`
    <div class="sense">
      <div>${s.pos?`<span class="pos">${esc(s.pos)}</span>`:""}<span class="mn">${esc(s.meaning)}</span></div>
      <div class="syns" style="margin-top:7px">${s.synonyms.map(x=>synChip(w,x)).join("")}</div>
      ${s.example?`<div class="example"><div class="en">${boldWord(s.example,w.word)}</div><div class="ko">${esc(s.example_ko||"")}</div></div>`:""}
    </div>`).join("");

  const legend = `<div class="legend"><b>파란 칩</b> = 핵심(시험 출제) 동의어</div>`;
  const etym = w.etym?`<div class="sec-title" style="margin-top:14px">🧩 어원 / 구조</div><div class="etym">${mdBold(w.etym)}</div>`:"";
  const nuance = w.nuance?`<div class="sec-title" style="margin-top:14px">어감 / 뉘앙스</div><div class="nuance">${esc(w.nuance)}</div>`:"";
  const deriv = (w.derivatives&&w.derivatives.length)?`<div class="deriv">파생어 ${w.derivatives.map(d=>`<span>${esc(d)}</span>`).join("")}</div>`:"";
  const tip = w.exam_tip?`<button class="tipbtn" id="tipBtn">💡 최신출제포인트 보기</button><div class="tipbox hidden" id="tipBox">${esc(w.exam_tip)}</div>`:"";

  $("#afterArea").innerHTML = `
    <div class="reveal">
      ${senses}
      ${legend}
      ${etym}
      ${nuance}
      ${ksHtml(w)}
      ${deriv}
      ${tip}
      <div class="sec-title" style="margin-top:14px">📝 내 메모</div>
      <div id="mnemoView"></div>
      <div class="grid grade">
        <button class="gbtn no" id="bNo">✕ 몰랐음</button>
        <button class="gbtn ok" id="bOk">○ 알았음</button>
      </div>
    </div>`;
  if(w.exam_tip){ $("#tipBtn").onclick=()=>{ $("#tipBox").classList.toggle("hidden"); }; }
  renderMnemo(w);
  $("#bOk").onclick=()=>answer(true);
  $("#bNo").onclick=()=>answer(false);
}

function renderMnemo(w){
  const box=$("#mnemoView"); const m=mnemo[w.id]||"";
  box.innerHTML = m
    ? `<div class="mnemo" id="mClick">${mdBold(m)}</div>`
    : `<div class="mnemo empty" id="mClick">+ 메모 추가 (탭해서 입력 — **별표**로 굵게)</div>`;
  $("#mClick").onclick=()=>editMnemo(w);
}
function editMnemo(w){
  $("#mnemoView").innerHTML = `
    <textarea id="mEdit" placeholder="메모 입력... (별표로 감싸면 **굵게**)">${esc(mnemo[w.id]||"")}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="ghost" id="mSave" style="background:var(--green);color:#fff">저장</button>
      <button class="ghost" id="mCancel">취소</button>
    </div>`;
  const ta=$("#mEdit"); ta.focus();
  $("#mSave").onclick=()=>{ const v=ta.value.trim(); if(v) mnemo[w.id]=v; else delete mnemo[w.id]; save(LS_MNEMO,mnemo); renderMnemo(w); toast("메모 저장됨"); };
  $("#mCancel").onclick=()=>renderMnemo(w);
}

function answer(correct){
  const w=S.cur; grade(w.id,correct);
  if(correct){ S.ok++; S.mastered++; }
  else { S.no++; if(S.loop) S.wrong.push(w); }
  nextCard();
}

/* ================= QUIZ ================= */
let Q=null;
function startQuiz(){
  if($("#sheetMode") && $("#sheetMode").checked){ startSheet(); return; }
  const list=buildSession("study");
  if(list.length<4){ toast("퀴즈는 최소 4단어 필요"); return; }
  Q={list,i:0,score:0,type:($("#quizType")?$("#quizType").value:"syn")}; show("quiz"); renderQuiz();
}

/* ===== 한 문제 생성 (시험지/단문제 공용) ===== */
function makeQ(w, baseMode){
  let mode = baseMode==="mix" ? (Math.random()<0.5?"syn":"mean") : baseMode;
  if(mode==="syn" && wSyns(w).length===0) mode="mean";
  let answer, options, sub="";
  if(mode==="syn"){
    const keyList=wSyns(w).filter(x=>isKey(w,x));
    answer=(keyList.length?keyList:wSyns(w))[0];
    const used=new Set(wSyns(w).map(norm)); const ds=[];
    for(const o of shuffle(WORDS)){ if(ds.length>=3)break; if(o.id===w.id)continue; const s=pickSyn(o); if(s&&!used.has(norm(s))){ds.push(s);used.add(norm(s));} }
    options=shuffle([answer,...ds]); sub=wMeaning(w);
  } else {
    answer=wMeaning(w);
    const used=new Set([norm(answer)]); const ds=[];
    for(const o of shuffle(WORDS)){ if(ds.length>=3)break; if(o.id===w.id)continue; const m=wMeaning(o); if(!used.has(norm(m))){ds.push(m);used.add(norm(m));} }
    options=shuffle([answer,...ds]);
  }
  return {w, mode, answer, options, sub};
}

/* ===== 시험지 모드 ===== */
let SH=null;
const CIRC="ⓐⓑⓒⓓ";
function startSheet(){
  const list=buildSession("study");
  if(list.length<4){ toast("시험지는 최소 4단어 필요"); return; }
  const type=$("#quizType")?$("#quizType").value:"syn";
  SH={ qs:list.map(w=>makeQ(w,type)), graded:false };
  $("#sheetInfo").textContent = type==="mean" ? "단어의 우리말 뜻을 고르세요" : "왼쪽 단어의 동의어를 고르세요";
  renderSheet(); show("sheet");
}
function renderSheet(){
  const body=$("#sheetBody");
  body.innerHTML = SH.qs.map((q,qi)=>`
    <div class="sq" id="sq${qi}">
      <div class="sqw">${qi+1}. ${esc(q.w.word)} <button class="spk mini" data-w="${esc(q.w.word)}">🔊</button><button class="cpy mini" data-w="${esc(q.w.word)}">📋</button></div>
      ${q.sub?`<div class="sqsub">${esc(q.sub)}</div>`:""}
      <div class="sqopts">
        ${q.options.map((o,oi)=>`<button class="sopt" data-q="${qi}" data-correct="${o===q.answer?1:0}">${CIRC[oi]||"·"} ${esc(o)}</button>`).join("")}
      </div>
    </div>`).join("") + `<button class="fullbtn" id="gradeBtn">채점하기</button>`;

  body.querySelectorAll(".sopt").forEach(b=>{
    b.onclick=()=>{
      if(SH.graded) return;
      const qi=b.dataset.q;
      body.querySelectorAll(`.sopt[data-q="${qi}"]`).forEach(x=>x.classList.remove("sel"));
      b.classList.add("sel");
    };
  });
  body.querySelectorAll(".spk.mini").forEach(b=>{ b.onclick=(e)=>{ e.stopPropagation(); speak(b.dataset.w); }; });
  body.querySelectorAll(".cpy.mini").forEach(b=>{ b.onclick=(e)=>{ e.stopPropagation(); copy(b.dataset.w); }; });
  $("#gradeBtn").onclick=gradeSheet;
}
function gradeSheet(){
  if(SH.graded) return; SH.graded=true;
  let score=0;
  SH.qs.forEach((q,qi)=>{
    const wrap=document.getElementById("sq"+qi);
    const sel=wrap.querySelector(".sopt.sel");
    const correctBtn=wrap.querySelector('.sopt[data-correct="1"]');
    if(correctBtn) correctBtn.classList.add("correct");
    let right=false;
    if(sel){ if(sel===correctBtn) right=true; else sel.classList.add("wrong"); }
    if(right) score++;
    grade(q.w.id, right);
    wrap.querySelectorAll(".sopt").forEach(b=>b.disabled=true);
  });
  const gb=$("#gradeBtn");
  gb.outerHTML = `<div class="sheet-score">${score} / ${SH.qs.length} 정답</div>
    <button class="fullbtn" id="sheetAgain">다시 풀기</button>
    <button class="fullbtn" id="sheetHome" style="background:var(--card2)">홈으로</button>`;
  $("#sheetAgain").onclick=startSheet;
  $("#sheetHome").onclick=()=>{ show("home"); renderHome(); };
  renderHome();
  window.scrollTo(0,0);
}
function renderQuiz(){
  const w=Q.list[Q.i];
  $("#quizIdx").textContent=`${Q.i+1} / ${Q.list.length}`;
  $("#quizScore").textContent=`${Q.score}점`;
  let mode=Q.type==="mix" ? (Math.random()<0.5?"syn":"mean") : Q.type;
  if(mode==="syn" && wSyns(w).length===0) mode="mean";   // fallback
  const box=$("#quizOpts"); box.innerHTML="";
  let answerText, options;

  if(mode==="syn"){
    const keyList=wSyns(w).filter(x=>isKey(w,x));
    answerText=(keyList.length?keyList:wSyns(w))[0];
    const used=new Set(wSyns(w).map(norm));   // exclude this word's own synonyms from distractors
    const ds=[];
    for(const o of shuffle(WORDS)){
      if(ds.length>=3) break;
      if(o.id===w.id) continue;
      const s=pickSyn(o);
      if(s && !used.has(norm(s))){ ds.push(s); used.add(norm(s)); }
    }
    options=shuffle([answerText,...ds]);
    $("#quizQ").innerHTML=`<div class="qcat">동의어 고르기</div><div class="qword" style="font-size:30px">${esc(w.word)}</div><div class="pron" style="margin-top:6px">${esc(wMeaning(w))}</div><div>${SPKBTN}${COPYBTN}</div>`;
  } else {
    answerText=wMeaning(w);
    const used=new Set([norm(answerText)]); const ds=[];
    for(const o of shuffle(WORDS)){
      if(ds.length>=3) break;
      if(o.id===w.id) continue;
      const m=wMeaning(o);
      if(!used.has(norm(m))){ ds.push(m); used.add(norm(m)); }
    }
    options=shuffle([answerText,...ds]);
    $("#quizQ").innerHTML=`<div class="qcat">우리말 뜻 맞추기</div><div class="qword" style="font-size:30px">${esc(w.word)}</div><div>${SPKBTN}${COPYBTN}</div>`;
  }
  mountSpk(w.word, true);

  options.forEach(opt=>{
    const b=document.createElement("button"); b.className="opt"; b.textContent=opt;
    b.onclick=()=>{
      const right = opt===answerText;
      [...box.children].forEach(c=>c.disabled=true);
      b.classList.add(right?"correct":"wrong");
      if(!right){ [...box.children].forEach(c=>{ if(c.textContent===answerText) c.classList.add("correct"); }); }
      grade(w.id,right); if(right)Q.score++;
      setTimeout(()=>{ Q.i++; if(Q.i>=Q.list.length) finishQuiz(); else renderQuiz(); }, right?500:1100);
    };
    box.appendChild(b);
  });
}
function finishQuiz(){
  clearTimer();
  $("#doneEmoji").textContent=Q.score===Q.list.length?"🏆":Q.score>=Q.list.length*0.7?"🎉":"💪";
  $("#doneTitle").textContent=`${Q.score} / ${Q.list.length} 정답`;
  $("#doneSub").textContent="퀴즈 완료";
  $("#dOk").textContent=Q.score; $("#dNo").textContent=Q.list.length-Q.score; $("#dDue").textContent=dueCount();
  $("#againBtn").onclick=()=>startQuiz();
  show("done"); renderHome();
}

/* ================= finish (study) ================= */
function finish(){
  clearTimer();
  $("#doneEmoji").textContent=S.no===0?"🏆":"🎉";
  $("#doneTitle").textContent="완료!";
  $("#doneSub").textContent=S.mode==="review"?"복습 끝":S.loop?`${S.total}단어 모두 익힘 🎯`:"세션 끝";
  $("#dOk").textContent=S.ok; $("#dNo").textContent=S.no; $("#dDue").textContent=dueCount();
  $("#againBtn").onclick=()=>startStudy(S.mode);
  show("done"); renderHome();
}

/* ================= events ================= */
document.querySelectorAll(".mode-btn").forEach(b=>{
  b.onclick=()=>{ const m=b.dataset.mode; if(m==="quiz") startQuiz(); else startStudy(m); };
});
$("#qcard").addEventListener("click", ()=>{ if(S && !S.revealed) reveal(); });
$("#quitStudy").onclick=()=>{ clearTimer(); show("home"); renderHome(); };
$("#quitQuiz").onclick=()=>{ show("home"); renderHome(); };
$("#quitSheet").onclick=()=>{ show("home"); renderHome(); };
$("#homeBtn").onclick=()=>{ show("home"); renderHome(); };

/* ---- backup / restore ---- */
$("#exportBtn").onclick=()=>{
  const data={progress:prog,mnemo:mnemo,exported:todayStr(),v:2};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`hackers-voca-backup-${todayStr()}.json`; a.click();
  toast("백업 파일 저장됨");
};
$("#importBtn").onclick=()=>$("#importFile").click();
$("#importFile").onchange=(e)=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result);
    if(d.progress){ prog=d.progress; save(LS_PROG,prog); }
    if(d.mnemo){ mnemo=d.mnemo; save(LS_MNEMO,mnemo); }
    clearSession(); renderHome(); toast("가져오기 완료 ✅");
  }catch{ toast("파일을 읽을 수 없어요"); } };
  r.readAsText(f); e.target.value="";
};
$("#resetBtn").onclick=()=>{
  if(confirm("진도(외운 단어/복습 일정)를 모두 초기화할까요?\n내 메모는 유지됩니다.")){
    prog={}; save(LS_PROG,prog); clearSession(); renderHome(); toast("초기화 완료");
  }
};

renderHome();
