import {Simulation,makePeople,rng,hash,fmtTime,tinyTime,actionLabel,T} from './sim.js';
import {View} from './view.js';
const $=(s)=>document.querySelector(s);
const escapeHTML=(text)=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
const COOKIE_PREFIX='ow_state_';
const COOKIE_META='ow_chunks';
const COOKIE_MAX=2800;
const chunkMax=25;
const duration=60*60*24*365;
const cookieOpts=()=>`; Path=/; Max-Age=${duration}; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
function getCookie(name){return document.cookie.split('; ').find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function restoreCookie(){try{const count=Number(getCookie(COOKIE_META));if(!Number.isInteger(count)||count<1||count>chunkMax)return null;let encoded='';for(let i=0;i<count;i++){const part=getCookie(COOKIE_PREFIX+i);if(!part)return null;encoded+=part;}const s=JSON.parse(decodeURIComponent(encoded));return s?.version===1&&Number.isSafeInteger(s.seed)?s:null;}catch{return null;}}
function saveCookie(data){try{const encoded=encodeURIComponent(JSON.stringify(data));const parts=encoded.match(new RegExp(`.{1,${COOKIE_MAX}}`,'g'))||[];if(!parts.length||parts.length>chunkMax)throw Error('cookie size limit');const old=Number(getCookie(COOKIE_META))||0;for(let i=0;i<parts.length;i++)document.cookie=`${COOKIE_PREFIX+i}=${parts[i]}${cookieOpts()}`;document.cookie=`${COOKIE_META}=${parts.length}${cookieOpts()}`;for(let i=parts.length;i<old;i++)document.cookie=`${COOKIE_PREFIX+i}=; Path=/; Max-Age=0; SameSite=Lax`;if(Number(getCookie(COOKIE_META))!==parts.length)throw Error('cookies disabled');return{ok:true,bytes:encoded.length,chunks:parts.length};}catch(error){return{ok:false,error:error.message};}}
function clearCookies(){const count=Number(getCookie(COOKIE_META))||0;for(let i=0;i<Math.max(chunkMax,count);i++)document.cookie=`${COOKIE_PREFIX+i}=; Path=/; Max-Age=0; SameSite=Lax`;document.cookie=`${COOKIE_META}=; Path=/; Max-Age=0; SameSite=Lax`;}
const randomSeed=()=>{const raw=new Uint32Array(1);crypto.getRandomValues(raw);return raw[0]||1;};
const fallbackProfiles=(people,seed)=>people.map(p=>{const r=rng(hash(`person-${seed}-${p.id}`)),trait=()=>Math.round((.12+r()*.76)*100)/100;return{id:p.id,sociability:trait(),curiosity:trait(),conscientiousness:trait(),empathy:trait(),stressTolerance:trait(),likesCats:trait(),chronotype:['morning','neutral','evening'][Math.floor(r()*3)],description:'初期条件に基づく性格傾向を持ち、環境に応じて意思決定します。'};});
let sim,view,aiMode='procedural',paused=false,speed=1,lastStamp=0,uiTick=0,inspectedId=null,lastSaveStamp=0,toastTimer;
const keys=new Set(),touchDirs=new Set();
const sendToast=(text)=>{const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);};
async function init(){let saved=restoreCookie(),seed=saved?.seed??randomSeed(),profiles=[],resumed=!!saved;
  $('#observer-label').textContent=seed.toString(16).toUpperCase().padStart(8,'0');
  $('#boot-msg').textContent=resumed?'Cookieから世界の状態を復元しています':'住民の性格と生活習慣を初期設定しています';
  if(resumed){profiles=Array.isArray(saved.profiles)?saved.profiles:[];aiMode=saved.aiMode||'procedural';}
  else {try{const res=await fetch('/api/personalities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed,people:makePeople(seed)})});if(!res.ok)throw Error(`HTTP ${res.status}`);const result=await res.json();profiles=result.profiles;aiMode=result.mode||'procedural';}catch(error){console.warn('Personality fallback:',error);profiles=fallbackProfiles(makePeople(seed),seed);aiMode='offline';}}
  sim=new Simulation(seed,profiles,saved);sim.observerCatId=saved?.observerCatId||'c0';view=new View($('#world'),sim);inspectedId=sim.observerCatId;$('#district-label').textContent=sim.city.district;$('#cat-count').textContent=`${sim.cats.length} 匹`;$('#people-count').textContent=`住民 ${sim.people.length} 人`;
  $('#ai-label').textContent=aiMode==='gemini'?'性格生成: Gemini AI 使用':aiMode==='offline'?'性格生成: ブラウザ内の規則':'性格生成: 規則ベース（AIキー未設定）';
  $('#state-label').textContent='SIMULATION ONLINE';$('#boot-screen').hidden=true;
  wireEvents();refreshUI();lastStamp=performance.now();requestAnimationFrame(frame);
  if(!resumed)saveNow(false);
}
function bootError(error){$('#boot-msg').textContent='世界の起動に失敗しました。再読み込みしてください。';console.error(error);}
const personOrCat=(id)=>[...sim.cats,...sim.people].find(a=>a.id===id);
function bar(name,n,color=''){return `<div class="bar-row"><div class="bar-header"><span>${escapeHTML(name)}</span><b>${Math.round(n)}%</b></div><div class="bar-track"><div class="bar-fill ${color}" style="width:${limit(n,0,100)}%"></div></div></div>`;}
function renderCats(){const root=$('#cat-list');const current=sim.observerCatId;root.innerHTML=sim.cats.map(c=>`<button class="cat-item ${c.id===current?'active':''}" data-cat="${c.id}"><span class="cat-identity"><span class="cat-dot">🐈</span><span><strong>${escapeHTML(c.name)}</strong><small>${c.id===current?'観察者が操作中':actionLabel(c.action)}</small></span></span><span class="cat-state">${Math.round(c.mood)}% ♡</span></button>`).join('');}
function renderSelected(){const c=sim.observed;$('#selected-info').innerHTML=`<div class="selection-header"><span class="face">🐈</span><div><b>${escapeHTML(c.name)}</b><small>現在：${escapeHTML(actionLabel(c.action))}</small></div></div>${bar('空腹度',c.hunger,'orange')}${bar('体力',c.energy)}${bar('交流欲求',100-c.social,'blue')}${bar('安心度',100-c.stress)}`;}
function renderMetrics(){const stats=sim.stats();const data=[['平均幸福度',`${stats.mood}%`],['活動中の住民',`${stats.active}人`],['人同士の交流',`${stats.socialEncounters}回`],['人と猫の交流',`${stats.catEncounters}回`],['平均空腹度',`${stats.hunger}%`],['観察介入距離',`${stats.observerDistance}m`]];$('#metrics').innerHTML=data.map(([title,val])=>`<div class="metric"><strong>${escapeHTML(val)}</strong><span>${escapeHTML(title)}</span></div>`).join('');}
function renderLogs(){const el=$('#event-log');if(!sim.logs.length){el.textContent='まだ記録はありません。';return;}el.innerHTML=sim.logs.slice(0,23).map(event=>`<div class="log"><div class="log-time">${tinyTime(event.t)} <span>DAY ${String(Math.floor(event.t/1440)+1).padStart(2,'0')}</span></div><div class="log-text">${escapeHTML(event.text)}</div></div>`).join('');}
const traitNames={sociability:'社交性',curiosity:'好奇心',conscientiousness:'誠実性',empathy:'共感性',stressTolerance:'ストレス耐性',likesCats:'猫への親和性',independence:'独立性',affection:'愛着傾向',boldness:'大胆さ'};
function renderInspector(){const a=personOrCat(inspectedId)||sim.observed;const isCat=a.type==='cat';const attrs=isCat?['curiosity','independence','affection','boldness']:['sociability','curiosity','conscientiousness','empathy','stressTolerance','likesCats'];$('#inspector').innerHTML=`<div class="selection-header"><span class="face">${isCat?'🐈':'◉'}</span><div><b>${escapeHTML(a.name)}</b><small>${isCat?'野良猫（仮想個体）':`${a.age}歳 / ${escapeHTML(a.job)}`}</small></div></div><div>現在：<strong>${escapeHTML(actionLabel(a.action))}</strong></div><div>気分：<strong>${Math.round(a.mood)} / 100</strong>　疲労：<strong>${Math.round(100-a.energy)} / 100</strong></div>${!isCat?`<p>${escapeHTML(a.description||'')}</p>`:''}<div class="traits">${attrs.map(k=>`<div class="trait"><b>${Math.round((Number(a[k])||0)*100)}</b><span>${traitNames[k]}</span></div>`).join('')}</div>`;}
function refreshUI(){if(!sim)return;$('#clock-label').textContent=fmtTime(sim.totalMinutes);$('#weather-label').textContent=`天候 ${sim.weather}`;$('#tick-label').textContent=`TICK ${String(sim.ticks).padStart(6,'0')}`;$('#activity-label').textContent=`${escapeHTML(actionLabel(sim.observed.action))} / ${sim.weather}`;$('#follow-label').textContent=view.follow?'● 猫の視点を追跡中':'○ 自由観察中';$('#map-scale').textContent=`Z ${Math.round(view.zoom*100)}%`;renderCats();renderSelected();renderMetrics();renderLogs();renderInspector();}
function frame(now){const dt=Math.min((now-lastStamp)/1000,.08);lastStamp=now;
  if(!paused){const dx=(keys.has('KeyD')||keys.has('ArrowRight')||touchDirs.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touchDirs.has('left')?1:0);const dy=(keys.has('KeyS')||keys.has('ArrowDown')||touchDirs.has('down')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')||touchDirs.has('up')?1:0);if(dx||dy){sim.moveObserved(dx,dy,dt);view.follow=true;}const simStep=dt*speed*1.8;let remaining=simStep;while(remaining>.00001){const amount=Math.min(2,remaining);sim.step(amount);remaining-=amount;}}
  view.frame(dt);uiTick+=dt;lastSaveStamp+=dt;if(uiTick>.6){uiTick=0;refreshUI();}if(lastSaveStamp>16){lastSaveStamp=0;saveNow(false);}requestAnimationFrame(frame);
}
function saveNow(notify=true){if(!sim)return;const snap={...sim.snapshot(),aiMode};const result=saveCookie(snap);$('#save-status').textContent=result.ok?`Cookieへ保存済（${result.chunks} 個のCookie / ${Math.round(result.bytes/1024)} KB）`:'Cookie保存不可：'+result.error;if(notify)sendToast(result.ok?'観測状態をCookieに保存しました':'Cookieへの保存に失敗しました');return result;}
function download(name,content,type){const blob=new Blob([content],{type});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csv(){const rows=[['day','time','type','event'],...sim.logs.slice().reverse().map(e=>[Math.floor(e.t/1440)+1,tinyTime(e.t),e.kind,e.text])];return '\ufeff'+rows.map(row=>row.map(cell=>'"'+String(cell??'').replaceAll('"','""')+'"').join(',')).join('\r\n');}
function wireEvents(){const canvas=$('#world'),wrap=$('#canvas-wrap');new ResizeObserver(()=>view.resize()).observe(wrap);
  $('#speed-controls').addEventListener('click',e=>{const button=e.target.closest('[data-speed]');if(!button)return;speed=Number(button.dataset.speed);for(const b of $('#speed-controls').querySelectorAll('button'))b.classList.toggle('active',b===button);sendToast(`時間倍率を ${speed}× に設定`);});
  $('#pause-btn').addEventListener('click',()=>{paused=!paused;$('#pause-btn').textContent=paused?'▶ 再開':'⏸ 一時停止';$('#state-label').textContent=paused?'PAUSED':'SIMULATION ONLINE';});
  $('#center-btn').addEventListener('click',()=>view.recenter());$('#zoom-out').addEventListener('click',()=>view.setZoom(view.zoom-.16));$('#zoom-in').addEventListener('click',()=>view.setZoom(view.zoom+.16));
  $('#cat-list').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;sim.setObserved(b.dataset.cat);inspectedId=b.dataset.cat;view.recenter();refreshUI();});
  $('#save-btn').addEventListener('click',()=>saveNow());
  $('#export-csv').addEventListener('click',()=>download('observed-world-events.csv',csv(),'text/csv;charset=utf-8'));
  $('#export-json').addEventListener('click',()=>download('observed-world-snapshot.json',JSON.stringify({...sim.snapshot(),aiMode},null,2),'application/json;charset=utf-8'));
  $('#import-btn').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('ファイルが大きすぎます');const s=JSON.parse(await file.text());if(s.version!==1||!Number.isSafeInteger(s.seed)||!Array.isArray(s.profiles)||s.profiles.length>40)throw Error('対応していない形式です');const result=saveCookie(s);if(!result.ok)throw Error('Cookieに保存できません');location.reload();}catch(error){sendToast(`読み込み失敗: ${error.message}`);}finally{e.target.value='';}});
  $('#reset-btn').addEventListener('click',()=>{if(!confirm('観察者の世界を再生成しますか？ 今の世界のCookie保存データは消えます。必要ならJSONでバックアップしてください。'))return;clearCookies();location.reload();});
  const blockedKeys=new Set(['KeyA','KeyS','KeyD','KeyW','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  window.addEventListener('keydown',e=>{if(blockedKeys.has(e.code)){keys.add(e.code);e.preventDefault();}if(e.code==='Space'&&!e.repeat){e.preventDefault();$('#pause-btn').click();}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();touchDirs.clear();});
  let pointer=null;canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>7)pointer.drag=true;if(pointer.drag)view.pan(dx,dy);pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
  canvas.addEventListener('pointerup',e=>{if(!pointer)return;if(!pointer.drag){const rect=canvas.getBoundingClientRect(),hit=view.hitTest(e.clientX-rect.left,e.clientY-rect.top);if(hit){inspectedId=hit.id;view.selected=hit;renderInspector();sendToast(`${hit.name}：${actionLabel(hit.action)}`);}}pointer=null;});
  canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();view.setZoom(view.zoom+(e.deltaY<0?.10:-.10));},{passive:false});
  for(const button of document.querySelectorAll('#touch-pad button')){const dir=button.dataset.dir;const on=e=>{e.preventDefault();touchDirs.add(dir);button.classList.add('pressed');button.setPointerCapture(e.pointerId);};const off=e=>{e.preventDefault();touchDirs.delete(dir);button.classList.remove('pressed');};button.addEventListener('pointerdown',on);button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('lostpointercapture',off);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();touchDirs.clear();saveNow(false);lastStamp=performance.now();}});window.addEventListener('pagehide',()=>saveNow(false));
}
init().catch(bootError);
