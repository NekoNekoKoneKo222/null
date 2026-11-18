// Deterministic synthetic city and bounded, inspectable agent decision rules.
// Personality initialization can use the server AI endpoint; no generative model is executed in this engine.
export const T = 34;
export const W = 82;
export const H = 58;
const r01 = (x) => Math.max(0,Math.min(100,x));
export const fmtTime=(minutes)=>{const total=Math.floor(minutes),day=Math.floor(total/1440)+1,h=Math.floor((total%1440)/60),m=total%60;return `DAY ${String(day).padStart(2,'0')} · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;};
export const tinyTime=(minutes)=>{const t=Math.floor(minutes)%1440;return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};
export function rng(seed){let a=seed>>>0;return ()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
export function hash(x){let h=2166136261;for(const c of String(x))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const pick=(random,arr)=>arr[Math.floor(random()*arr.length)];
const SURNAMES=['青木','佐藤','田中','中村','小林','高橋','加藤','森','木村','山口','佐々木','井上','石井','松本','斎藤','清水','渡辺','山田'];
const FIRSTNAMES=['陽','みお','遥','蓮','結衣','湊','花','航','蒼','紬','凛','悠真','芽衣','直樹','真琴','大輝','咲','楓','優花'];
const CATNAMES=['こはく','すみれ','しろ','ごま','クロ','もち','むぎ','ルナ','きなこ','トラ','あずき','ソラ'];
const CATCOLORS=['#e4b779','#efeae0','#292f33','#b8bbc5','#e2c5a3','#c67b5d','#dad1bf','#3d3837','#b5a58b'];
const JOBS=['会社員','会社員','会社員','店員','看護師','学生','学生','自営業','事務員','教師','研究員','配達員','会社員','店員','無職','退職者'];
const PLACELABEL={home:'自宅',work:'仕事場',shop:'お店',park:'公園',walk:'散歩道',food:'食事場所',rest:'休憩場所',social:'交流場所'};
const ACTIONS={home:'家で過ごす',sleep:'睡眠中',commute:'移動中',work:'仕事をする',school:'勉強する',eat:'食事をする',walk:'散歩する',social:'交流する',rest:'休む',cat:'猫を眺める',wander:'周辺を探索する',groom:'毛づくろいする',hunt:'小さな獲物を探す',observe:'観察者が操作中',idle:'周囲を見渡す'};
export const actionLabel=(action)=>ACTIONS[action]||action||'生活中';
export class City {
  constructor(seed){this.seed=seed;this.random=rng(seed);this.tiles=new Uint8Array(W*H);this.buildings=[];this.parks=[];this.trees=[];this.lamps=[];this.benches=[];this.roadX=[12,33,55,75];this.roadY=[11,30,49];this.generate();}
  index(x,y){return y*W+x;}
  inWorld(x,y){return x>=0&&y>=0&&x<W&&y<H;}
  obstacle(x,y){const tx=Math.floor(x),ty=Math.floor(y);return !this.inWorld(tx,ty)||this.tiles[this.index(tx,ty)]===3;}
  free(x,y){return !this.obstacle(x,y);}
  generate(){
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if(this.roadX.some(v=>Math.abs(v-x)<=1)||this.roadY.some(v=>Math.abs(v-y)<=1))this.tiles[this.index(x,y)]=1;
      else if(this.roadX.some(v=>Math.abs(v-x)<=3)||this.roadY.some(v=>Math.abs(v-y)<=3))this.tiles[this.index(x,y)]=2;
      else this.tiles[this.index(x,y)]=0;
    }
    const overlap=(x,y,w,h,pad=1)=>{for(let yy=y-pad;yy<y+h+pad;yy++)for(let xx=x-pad;xx<x+w+pad;xx++){if(!this.inWorld(xx,yy)||this.tiles[this.index(xx,yy)]===1||this.tiles[this.index(xx,yy)]===3||this.tiles[this.index(xx,yy)]===4)return true;}return false;};
    const put=(type,count,wMin,wMax,hMin,hMax)=>{for(let n=0;n<count;n++){
      let placed=false;
      for(let tries=0;tries<500&&!placed;tries++){
        const w=wMin+Math.floor(this.random()*(wMax-wMin+1)),h=hMin+Math.floor(this.random()*(hMax-hMin+1));
        const x=3+Math.floor(this.random()*(W-w-6)),y=3+Math.floor(this.random()*(H-h-6));
        if(overlap(x,y,w,h,type==='park'?1:2))continue;
        if(type==='park'){this.parks.push({x,y,w,h,id:`park${this.parks.length}`,name:pick(this.random,['中央緑地','木陰の公園','小さな公園','遊歩道','三日月公園'])});for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.tiles[this.index(i,j)]=4;}
        else {const b={id:`b${this.buildings.length}`,x,y,w,h,type,shade:this.random(),name: type==='home'?`住宅 ${this.buildings.filter(b=>b.type==='home').length+1}`:pick(this.random,type==='shop'?['喫茶店','食料品店','花屋','商店']:['事務所','図書館','診療所','工房','学校'])};for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.tiles[this.index(i,j)]=3;this.buildings.push(b);}
        placed=true;
      }
    }};
    put('park',4,5,8,4,6);put('shop',5,4,6,3,5);put('work',8,4,7,3,5);put('home',28,3,5,3,5);
    for(const b of this.buildings){const side=pick(this.random,[0,1,2,3]);const points=[[b.x-1,b.y+Math.floor(b.h/2)],[b.x+b.w,b.y+Math.floor(b.h/2)],[b.x+Math.floor(b.w/2),b.y-1],[b.x+Math.floor(b.w/2),b.y+b.h]];let p=points[side];if(!this.free(...p)){p=points.find(c=>this.free(...c))||this.findFreeNear(b.x,b.y);}b.door={x:p[0]+.5,y:p[1]+.5};}
    for(let y=2;y<H-2;y+=2)for(let x=2;x<W-2;x+=2){const t=this.tiles[this.index(x,y)];if(t===0&&this.random()<.11)this.trees.push({x:x+.5,y:y+.5,variant:this.random(),height:2+this.random()*2});if(t===2&&this.random()<.04)this.benches.push({x:x+.5,y:y+.5});if(t===2&&this.random()<.03)this.lamps.push({x:x+.5,y:y+.5});}
    this.district=pick(this.random,['青葉区','白樺町','朝凪市','月丘地区','清風町','北野市','桜川地区','小春町'])+'・'+(this.seed%997).toString().padStart(3,'0');
  }
  findFreeNear(cx,cy){for(let r=0;r<8;r++)for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)if(this.free(x,y))return[x,y];return [2,2];}
  randomPoint(random){for(let i=0;i<100;i++){const x=2+Math.floor(random()*(W-4)),y=2+Math.floor(random()*(H-4));if(this.free(x,y))return{x:x+.5,y:y+.5};}return{x:2.5,y:2.5};}
  randomPark(random){const p=pick(random,this.parks);const x=p.x+Math.floor(random()*p.w),y=p.y+Math.floor(random()*p.h);return {x:x+.5,y:y+.5};}
  closestPlace(type,from){const places=type==='park'?this.parks:this.buildings.filter(x=>x.type===type);if(!places.length)return this.randomPoint(this.random);let best=places[0],d=Infinity;for(const p of places){const center=p.door||{x:p.x+p.w/2,y:p.y+p.h/2};const z=Math.abs(center.x-from.x)+Math.abs(center.y-from.y);if(z<d){d=z;best=p;}}return best.door||{x:best.x+best.w/2,y:best.y+best.h/2};}
  // Unweighted grid BFS. No diagonal corner-cutting and no routing through houses.
  path(start,end){const sx=Math.floor(start.x),sy=Math.floor(start.y),tx=Math.floor(end.x),ty=Math.floor(end.y);if(!this.inWorld(sx,sy)||!this.inWorld(tx,ty)||!this.free(tx,ty))return[];
    const from=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let head=0,tail=0;const src=this.index(sx,sy),dst=this.index(tx,ty);from[src]=src;q[tail++]=src;
    while(head<tail){const cur=q[head++];if(cur===dst)break;const x=cur%W,y=(cur/W)|0;for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(!this.inWorld(nx,ny)||!this.free(nx,ny))continue;const i=this.index(nx,ny);if(from[i]!==-1)continue;from[i]=cur;q[tail++]=i;}}
    if(from[dst]===-1)return[];const result=[];let c=dst;while(c!==src&&result.length<W*H){result.push({x:(c%W)+.5,y:Math.floor(c/W)+.5});c=from[c];}result.reverse();return result;
  }
}
export function makePeople(seed,count=24){const random=rng(hash(`people-${seed}`));return Array.from({length:count},(_,i)=>({id:`p${i}`,name:pick(random,SURNAMES)+' '+pick(random,FIRSTNAMES),age:17+Math.floor(random()*58),job:pick(random,JOBS)}));}
export class Simulation {
  constructor(seed,profiles=[],snapshot=null){this.seed=seed;this.city=new City(seed);this.rand=rng(hash(`agents-${seed}`));this.totalMinutes=390;this.ticks=0;this.weather='晴れ';this.weatherDay=-1;this.logs=[];this.involvements=0;this.encounters=0;this.catEncounters=0;this.distanceObserved=0;this.observerCatId='c0';this.people=[];this.cats=[];this.initialize(profiles);if(snapshot)this.loadSnapshot(snapshot);this.updateWeather(true);}
  initialize(profiles){const raw=makePeople(this.seed);const homes=this.city.buildings.filter(b=>b.type==='home'),works=this.city.buildings.filter(b=>b.type==='work'),shops=this.city.buildings.filter(b=>b.type==='shop');this.people=raw.map((p,i)=>{const home=homes[i%homes.length]||works[0],work=(p.job==='店員'?shops:works)[(i*7+3)%(p.job==='店員'?shops.length:works.length)]||home;const t=profiles.find(t=>t.id===p.id)||{sociability:.5,curiosity:.5,conscientiousness:.5,empathy:.5,stressTolerance:.5,likesCats:.5,chronotype:'neutral',description:'平均的な傾向を示す'};return {...p,type:'person',...t,home:home.id,work:work.id,x:home.door.x,y:home.door.y,hunger:20+this.rand()*35,energy:70+this.rand()*25,social:70,stress:15+this.rand()*20,mood:68+this.rand()*20,action:'home',destination:'home',route:[],nextDecision:380+this.rand()*40,inside:false,meetingAt:-999,catAt:-999,minutes:{work:0,sleep:0,social:0,walk:0}};});
    this.cats=CATNAMES.slice(0,9).map((name,i)=>{const pos=this.city.randomPark(this.rand);return{id:`c${i}`,type:'cat',name,coat:CATCOLORS[i],x:pos.x,y:pos.y,hunger:15+this.rand()*35,energy:50+this.rand()*40,social:30+this.rand()*45,stress:5+this.rand()*15,mood:65+this.rand()*20,curiosity:this.rand(),independence:this.rand(),affection:this.rand(),boldness:this.rand(),action:'wander',destination:'walk',route:[],nextDecision:390+i*2,inside:false,petAt:-999,minutes:{rest:0,walk:0,food:0}};});
    this.log('system','観察者固有の街が生成されました。9匹の猫と24人の住民が生活を開始します。');
  }
  get observed(){return this.cats.find(c=>c.id===this.observerCatId)||this.cats[0];}
  log(kind,text){this.logs.unshift({t:Math.floor(this.totalMinutes),kind,text});if(this.logs.length>160)this.logs.length=160;}
  updateWeather(initial=false){const day=Math.floor(this.totalMinutes/1440);if(this.weatherDay!==day){this.weatherDay=day;const r=rng(hash(`${this.seed}:weather:${day}`))();const next=r<.58?'晴れ':r<.81?'曇り':'雨';if(!initial&&next!==this.weather)this.log('weather',`天候が「${next}」に変わりました。`);this.weather=next;}}
  setObserved(id){if(this.observerCatId===id)return;const old=this.observed;old.nextDecision=this.totalMinutes+2;old.action='idle';old.route=[];this.observerCatId=id;const now=this.observed;now.action='observe';now.route=[];now.inside=false;this.log('observer',`観察対象を${old.name}から${now.name}へ切り替えました。${old.name}は自律行動を再開します。`);}
  blockedAt(x,y){return this.city.obstacle(x-.21,y-.21)||this.city.obstacle(x+.21,y-.21)||this.city.obstacle(x-.21,y+.21)||this.city.obstacle(x+.21,y+.21);}
  moveObserved(dx,dy,dt){const cat=this.observed;if(!cat)return;const mag=Math.hypot(dx,dy);if(!mag)return;const dist=Math.min(dt,.08)*3.5;const x=cat.x+(dx/mag)*dist,y=cat.y+(dy/mag)*dist;const ox=cat.x,oy=cat.y;if(!this.blockedAt(x,cat.y))cat.x=x;if(!this.blockedAt(cat.x,y))cat.y=y;this.distanceObserved+=Math.hypot(cat.x-ox,cat.y-oy);cat.action='observe';cat.route=[];cat.hunger=r01(cat.hunger+dt*.4);cat.energy=r01(cat.energy-dt*.25);}
  // All biological variables evolve in simulation time, while input movement runs in wall-clock time.
  step(simMinutes){const dt=Math.min(simMinutes,2);this.totalMinutes+=dt;this.ticks++;this.updateWeather();const tod=this.totalMinutes%1440;
    for(const p of this.people){p.hunger=r01(p.hunger+dt*.032);p.social=r01(p.social-dt*.018);p.energy=r01(p.energy-dt*.032);p.stress=r01(p.stress+dt*(p.hunger>78?.025:.002));if(p.action==='sleep'){p.energy=r01(p.energy+dt*.22);p.stress=r01(p.stress-dt*.08);p.minutes.sleep+=dt;}if(p.action==='eat'){p.hunger=r01(p.hunger-dt*.4);}if(p.action==='social'){p.social=r01(p.social+dt*.24);p.stress=r01(p.stress-dt*.04);p.minutes.social+=dt;}if(p.action==='work'||p.action==='school'){p.minutes.work+=dt;p.stress=r01(p.stress+dt*.011*(1-p.stressTolerance));}if(p.action==='walk'||p.action==='commute')p.minutes.walk+=dt;p.mood=r01(76-(p.hunger*.23)+(p.social-50)*.13-(p.stress*.3)+(p.energy-50)*.1);if(this.totalMinutes>=p.nextDecision)this.decidePerson(p,tod);this.advanceRoute(p,dt,p.action==='commute'?0.85:0.62);}
    for(const c of this.cats){c.hunger=r01(c.hunger+dt*.049);c.social=r01(c.social-dt*.015);c.energy=r01(c.energy-dt*.055);if(c.action==='rest'){c.energy=r01(c.energy+dt*.34);c.stress=r01(c.stress-dt*.11);c.minutes.rest+=dt;}if(c.action==='food'){c.hunger=r01(c.hunger-dt*.35);c.minutes.food+=dt;}if(c.action==='groom')c.stress=r01(c.stress-dt*.1);c.mood=r01(80-(c.hunger*.28)+(c.energy-50)*.13-(c.stress*.28));if(c.id===this.observerCatId)continue;if(this.totalMinutes>=c.nextDecision)this.decideCat(c);this.advanceRoute(c,dt,.73);if(c.action==='wander'||c.action==='hunt')c.minutes.walk+=dt;}
    // Random social effects are constrained to nearby entities and cooldown windows.
    for(const c of this.cats){for(const p of this.people){if(p.inside||Math.hypot(c.x-p.x,c.y-p.y)>1.6||this.totalMinutes-p.catAt<100)continue;
      if(this.rand()<dt*.04*(p.likesCats*.85+.1)*(c.boldness*.6+.4)){
        p.catAt=this.totalMinutes;c.petAt=this.totalMinutes;c.social=r01(c.social+12);p.social=r01(p.social+6);c.stress=r01(c.stress-8);this.catEncounters++;
        this.log('cat',`${p.name}が${c.name}に近づき、しばらく様子を見ました。`);
      }
    }}
    if(this.ticks%24===0){for(const p of this.people){if(p.inside||this.totalMinutes-p.meetingAt<125)continue;const neighbor=this.people.find(o=>o!==p&&!o.inside&&Math.hypot(o.x-p.x,o.y-p.y)<1.25);if(neighbor&&this.rand()<.23*(p.sociability+.2)){p.meetingAt=this.totalMinutes;p.social=r01(p.social+8);neighbor.social=r01(neighbor.social+6);this.encounters++;this.log('social',`${p.name}と${neighbor.name}が道端で短く話しました。`);}}}
    if(Math.floor((this.totalMinutes-dt)/1440)<Math.floor(this.totalMinutes/1440))this.log('day',`新しい一日が始まりました（${fmtTime(this.totalMinutes)}）。`);
  }
  go(p,target,action,until){p.action=action;p.inside=false;p.nextDecision=this.totalMinutes+until;const route=this.city.path(p,target);p.route=route;p.destination=action;if(!route.length && Math.hypot(p.x-target.x,p.y-target.y)>1.3){p.nextDecision=this.totalMinutes+8;p.action='idle';}else if(!route.length){p.inside=['home','sleep','work','school','eat'].includes(action);}}
  goBuilding(p,b,action,duration){if(!b){this.go(p,this.city.randomPoint(this.rand),'walk',20);return;}p.destination=b.name;p.targetBuilding=b.id;this.go(p,b.door,action,duration);}
  decidePerson(p,tod){const hour=tod/60;const evening=p.chronotype==='evening';const wake=evening?8:6.5;const bedtime=evening?1:23;const sleepy=evening?(hour<8||hour>24):(hour>=23||hour<6.5);
    if(sleepy || p.energy<15){const home=this.city.buildings.find(b=>b.id===p.home);this.goBuilding(p,home,'sleep',p.energy<15?110:160);return;}
    if(p.hunger>73){const target=this.rand()<.48?this.city.buildings.find(b=>b.id===p.home):this.city.buildings.filter(b=>b.type==='shop')[Math.floor(this.rand()*this.city.buildings.filter(b=>b.type==='shop').length)];this.goBuilding(p,target,'eat',55);return;}
    if(p.job==='学生'&&hour>=8&&hour<15){this.goBuilding(p,this.city.buildings.find(b=>b.id===p.work),'school',70);return;}
    if(!['無職','退職者'].includes(p.job)&&hour>=9&&hour<17.5&&!(this.weather==='雨'&&p.job==='配達員')){this.goBuilding(p,this.city.buildings.find(b=>b.id===p.work),'work',60+this.rand()*80);return;}
    if(p.social<42&&this.rand()<p.sociability*.9){this.go(p,this.city.randomPark(this.rand),'social',35+this.rand()*45);return;}
    if(p.stress>56&&this.rand()<p.curiosity+.2){this.go(p,this.city.randomPark(this.rand),'rest',35);return;}
    if(this.weather==='雨'&&this.rand()<.8){this.goBuilding(p,this.city.buildings.find(b=>b.id===p.home),'home',70);return;}
    if(this.rand()<.33+p.curiosity*.26){this.go(p,this.city.randomPoint(this.rand),'walk',40+this.rand()*55);return;}
    this.goBuilding(p,this.city.buildings.find(b=>b.id===p.home),'home',35+this.rand()*45);
  }
  decideCat(c){if(c.energy<36){this.go(c,this.city.randomPark(this.rand),'rest',45+this.rand()*80);return;}if(c.hunger>65){const pos=this.city.closestPlace('shop',c);this.go(c,pos,'food',32+this.rand()*32);return;}if(c.stress>60){this.go(c,this.city.randomPark(this.rand),'groom',30);return;}if(this.weather==='雨'&&this.rand()<.7){this.go(c,this.city.randomPark(this.rand),'rest',40);return;}
    if(this.rand()<.23){this.go(c,this.city.randomPark(this.rand),'rest',30+this.rand()*35);return;}
    if(this.rand()<.12+c.curiosity*.16){this.go(c,this.city.randomPoint(this.rand),'hunt',40);return;}
    this.go(c,this.rand()<.55?this.city.randomPark(this.rand):this.city.randomPoint(this.rand),'wander',25+this.rand()*45);
  }
  advanceRoute(a,dt,speed){if(!a.route?.length){if(a.action==='sleep'||a.action==='work'||a.action==='school'||a.action==='home'||a.action==='eat')a.inside=true;return;}a.inside=false;let remain=speed*dt;let budget=8;while(remain>0&&a.route.length&&budget--){const next=a.route[0],distance=Math.hypot(next.x-a.x,next.y-a.y);if(distance<1e-4){a.route.shift();continue;}const n=Math.min(remain,distance);a.x+=(next.x-a.x)/distance*n;a.y+=(next.y-a.y)/distance*n;remain-=n;if(n>=distance-.0001){a.x=next.x;a.y=next.y;a.route.shift();}}
    if(!a.route.length){if(a.action==='sleep'||a.action==='home'||a.action==='work'||a.action==='school'||a.action==='eat')a.inside=true;}
  }
  stats(){const avg=(list,k)=>Math.round(list.reduce((s,p)=>s+p[k],0)/Math.max(1,list.length));return{residents:this.people.length,cats:this.cats.length,mood:avg([...this.people,...this.cats],'mood'),hunger:avg([...this.people,...this.cats],'hunger'),catEncounters:this.catEncounters,socialEncounters:this.encounters,observerDistance:this.distanceObserved.toFixed(1),active:this.people.filter(p=>!p.inside).length};}
  snapshot(){const fields=['x','y','hunger','energy','social','stress','mood','action','nextDecision','inside','meetingAt','catAt','petAt','minutes','destination','targetBuilding'];const encode=a=>Object.fromEntries(fields.filter(k=>a[k]!==undefined).map(k=>[k,typeof a[k]==='number'?Math.round(a[k]*100)/100:a[k]]));const profiles=this.people.map(p=>({id:p.id,sociability:p.sociability,curiosity:p.curiosity,conscientiousness:p.conscientiousness,empathy:p.empathy,stressTolerance:p.stressTolerance,likesCats:p.likesCats,chronotype:p.chronotype,description:p.description}));return{version:1,seed:this.seed,simTime:this.totalMinutes,ticks:this.ticks,profiles,people:this.people.map(encode),cats:this.cats.map(encode),observerCatId:this.observerCatId,encounters:this.encounters,catEncounters:this.catEncounters,distanceObserved:this.distanceObserved,logs:this.logs.slice(0,45)};}
  loadSnapshot(s){if(!s||s.version!==1||s.seed!==this.seed||!Number.isFinite(s.simTime))return false;this.totalMinutes=Math.max(0,Math.min(1e8,s.simTime));this.ticks=Number(s.ticks)||0;this.observerCatId=this.cats.some(c=>c.id===s.observerCatId)?s.observerCatId:'c0';this.encounters=Number(s.encounters)||0;this.catEncounters=Number(s.catEncounters)||0;this.distanceObserved=Number(s.distanceObserved)||0;
    const keys=['x','y','hunger','energy','social','stress','mood','nextDecision','meetingAt','catAt','petAt'];
    for(const [list,other] of [[this.people,s.people],[this.cats,s.cats]])if(Array.isArray(other))list.forEach((a,i)=>{const src=other[i];if(!src)return;for(const k of keys){if(Number.isFinite(src[k]))a[k]=src[k];}if(typeof src.action==='string')a.action=src.action;if(typeof src.inside==='boolean')a.inside=src.inside;if(src.minutes&&typeof src.minutes==='object')a.minutes=src.minutes;if(typeof src.destination==='string')a.destination=src.destination;a.x=Math.max(1,Math.min(W-2,a.x));a.y=Math.max(1,Math.min(H-2,a.y));if(this.blockedAt(a.x,a.y))Object.assign(a,this.city.randomPoint(this.rand));a.route=[];a.nextDecision=this.totalMinutes+2;});
    this.logs=Array.isArray(s.logs)?s.logs.filter(x=>x&&Number.isFinite(x.t)&&typeof x.text==='string').slice(0,45):[];this.log('system','Cookieに保存された観測状態を復元しました。');return true;}
}
