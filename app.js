/* ====== 해커스 보카 (DAY 1~7) ====== */
const WORDS = window.WORDS || [];
const LS_PROG = "voca_progress_v2";   // {id:{box,due,seen,ok,no,learned}}
const LS_MNEMO = "voca_mnemo_v2";     // {id:"경선식 연상법"}

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
function wMeaning(w){ return w.senses.map(s=>s.meaning).join(" / "); }
function wSyns(w){ const all=[]; w.senses.forEach(s=>s.synonyms.forEach(x=>{ if(!all.includes(x)) all.push(x); })); return all; }
function boldWord(sentence, word){
  // bold the headword (and simple inflections) in example
  const base = word.split(" ")[0].replace(/[^a-zA-Z]/g,"");
  if(!base) return esc(sentence);
  const re = new RegExp("\\b("+base+"[a-z]*)\\b","gi");
  return esc(sentence).replace(re, "<b>$1</b>");
}

/* ---- elements ---- */
const $ = s => document.querySelector(s);
const sections = ["home","study","quiz","done"];
function show(sec){ sections.forEach(s=>$("#"+s).classList.toggle("hidden", s!==sec)); window.scrollTo(0,0); }
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1600); }
function esc(s){ return (s+"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---- home ---- */
function dueCount(){ return WORDS.filter(w=>isDue(w.id)).length; }
function learnedCount(){ return WORDS.filter(w=>isLearned(w.id)).length; }
function renderHome(){
  const cs = $("#catSel");
  cs.innerHTML = `<option value="__all">전체</option>` + DAYS.map(d=>`<option value="${d}">DAY ${d}</option>`).join("");
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
  const day = $("#catSel").value;
  return WORDS.filter(w=> day==="__all" || w.day===parseInt(day,10));
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

function startStudy(mode){
  const list = buildSession(mode);
  if(!list.length){ toast(mode==="review"?"오늘 복습할 단어가 없어요 👍":"학습할 단어가 없어요"); return; }
  S = { mode, list, i:0, ok:0, no:0, revealed:false };
  $("#studyTitle").textContent = mode==="review"?"복습":mode==="syn"?"동의어":"외우기";
  show("study"); renderCard();
}

function renderCard(){
  clearTimer(); S.revealed=false;
  const w = S.list[S.i];
  $("#studyIdx").textContent = `${S.i+1} / ${S.list.length}`;
  const qcard = $("#qcard");
  $("#afterArea").innerHTML = "";
  const stars = "★".repeat(w.stars||0);
  if(S.mode==="syn"){
    qcard.innerHTML = `
      <div class="qcat">DAY ${w.day} · 동의어로 단어 맞히기</div>
      <div class="syns" style="justify-content:center;margin-top:14px">
        ${wSyns(w).slice(0,8).map(s=>`<span class="syn">${esc(s)}</span>`).join("")||'<span class="small">동의어 없음</span>'}
      </div>
      <div class="qhint">탭하면 정답 공개</div>`;
  } else {
    qcard.innerHTML = `
      <div class="qcat">DAY ${w.day} <span class="stars">${stars}</span></div>
      <div class="qword">${esc(w.word)}</div>
      ${w.pron?`<div class="pron">[${esc(w.pron)}]</div>`:""}
      <div class="qhint">탭하면 뜻 공개</div>`;
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
  const w = S.list[S.i];
  const stars = "★".repeat(w.stars||0);
  $("#qcard").innerHTML = `
    <div class="qcat">DAY ${w.day} <span class="stars">${stars}</span></div>
    <div class="qword">${esc(w.word)}</div>
    ${w.pron?`<div class="pron">[${esc(w.pron)}]</div>`:""}`;

  const senses = w.senses.map(s=>`
    <div class="sense">
      <div><span class="pos">${esc(s.pos)}</span><span class="mn">${esc(s.meaning)}</span></div>
      <div class="syns" style="margin-top:7px">${s.synonyms.map(x=>`<span class="syn">${esc(x)}</span>`).join("")}</div>
      ${s.example?`<div class="example"><div class="en">${boldWord(s.example,w.word)}</div><div class="ko">${esc(s.example_ko||"")}</div></div>`:""}
    </div>`).join("");

  const deriv = (w.derivatives&&w.derivatives.length)?`<div class="deriv">파생어 ${w.derivatives.map(d=>`<span>${esc(d)}</span>`).join("")}</div>`:"";
  const tip = w.exam_tip?`<button class="tipbtn" id="tipBtn">💡 최신출제포인트 보기</button><div class="tipbox hidden" id="tipBox">${esc(w.exam_tip)}</div>`:"";

  $("#afterArea").innerHTML = `
    <div class="reveal">
      ${senses}
      ${deriv}
      ${tip}
      <div class="sec-title" style="margin-top:14px">경선식 연상법 ✏️</div>
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
    ? `<div class="mnemo" id="mClick">${esc(m)}</div>`
    : `<div class="mnemo empty" id="mClick">+ 경선식 연상법 추가 (사진 보고 입력)</div>`;
  $("#mClick").onclick=()=>editMnemo(w);
}
function editMnemo(w){
  $("#mnemoView").innerHTML = `
    <textarea id="mEdit" placeholder="경선식 연상법 입력...">${esc(mnemo[w.id]||"")}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="ghost" id="mSave" style="background:var(--green);color:#fff">저장</button>
      <button class="ghost" id="mCancel">취소</button>
    </div>`;
  const ta=$("#mEdit"); ta.focus();
  $("#mSave").onclick=()=>{ const v=ta.value.trim(); if(v) mnemo[w.id]=v; else delete mnemo[w.id]; save(LS_MNEMO,mnemo); renderMnemo(w); toast("연상법 저장됨"); };
  $("#mCancel").onclick=()=>renderMnemo(w);
}

function answer(correct){ const w=S.list[S.i]; grade(w.id,correct); if(correct)S.ok++; else S.no++; next(); }
function next(){ S.i++; if(S.i>=S.list.length){ finish(); return; } renderCard(); }

/* ================= QUIZ ================= */
let Q=null;
function startQuiz(){
  const list=buildSession("study");
  if(list.length<4){ toast("퀴즈는 최소 4단어 필요"); return; }
  Q={list,i:0,score:0}; show("quiz"); renderQuiz();
}
function renderQuiz(){
  const w=Q.list[Q.i]; const e2k=Math.random()<0.5;
  $("#quizIdx").textContent=`${Q.i+1} / ${Q.list.length}`;
  $("#quizScore").textContent=`${Q.score}점`;
  const others=shuffle(WORDS.filter(x=>x.id!==w.id)).slice(0,3);
  const opts=shuffle([w,...others]);
  $("#quizQ").innerHTML = e2k
    ? `<div class="qcat">뜻 고르기</div><div class="qword" style="font-size:32px">${esc(w.word)}</div>`
    : `<div class="qcat">단어 고르기</div><div class="meaning" style="margin:6px 0;font-size:20px">${esc(wMeaning(w))}</div>`;
  const box=$("#quizOpts"); box.innerHTML="";
  opts.forEach(o=>{
    const b=document.createElement("button"); b.className="opt";
    b.textContent = e2k ? wMeaning(o) : o.word;
    b.onclick=()=>{
      const right=o.id===w.id;
      [...box.children].forEach(c=>c.disabled=true);
      b.classList.add(right?"correct":"wrong");
      if(!right){ const ans=e2k?wMeaning(w):w.word; [...box.children].forEach(c=>{ if(c.textContent===ans) c.classList.add("correct"); }); }
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
  $("#doneSub").textContent=S.mode==="review"?"복습 끝":"세션 끝";
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
    renderHome(); toast("가져오기 완료 ✅");
  }catch{ toast("파일을 읽을 수 없어요"); } };
  r.readAsText(f); e.target.value="";
};
$("#resetBtn").onclick=()=>{
  if(confirm("진도(외운 단어/복습 일정)를 모두 초기화할까요?\n경선식 연상법은 유지됩니다.")){
    prog={}; save(LS_PROG,prog); renderHome(); toast("초기화 완료");
  }
};

renderHome();
