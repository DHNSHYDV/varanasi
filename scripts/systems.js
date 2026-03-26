/* scripts/systems.js - Systems & Managers for Varanasi */
'use strict';

/* ═══ STATE & SETTINGS ═══ */
const Config = {
  graphics: 'high',
  sens: 1.0,
  init: function(){
    try{ 
      let saved = localStorage.getItem('varanasi_cfg'); 
      if(saved){
        let s = JSON.parse(saved);
        this.graphics = s.graphics || 'high';
        this.sens = s.sens || 1.0;
        document.getElementById('set-graphics').value = this.graphics;
        document.getElementById('set-sens').value = this.sens;
      }
    }catch(e){}
    document.getElementById('set-graphics').addEventListener('change', (e)=>{
      this.graphics = e.target.value; this.save();
    });
    document.getElementById('set-sens').addEventListener('change', (e)=>{
      this.sens = parseFloat(e.target.value); this.save();
    });
  },
  save: function(){ localStorage.setItem('varanasi_cfg', JSON.stringify({graphics: this.graphics, sens: this.sens})); }
};

const Save = (() => {
  const KEY = 'varanasi_save';
  const DEFAULT = { stones:{earth:false,water:false,fire:false,air:false,aether:false},
    hp:100, region:0, shrinePos:{x:0,y:1,z:0}, stonesCollected:0 };
  let data = {...DEFAULT};
  function load(){ try{ const s=localStorage.getItem(KEY); if(s) data={...DEFAULT,...JSON.parse(s)}; }catch(e){} }
  function save(){ try{ localStorage.setItem(KEY,JSON.stringify(data)); }catch(e){} }
  function reset(){ data={...DEFAULT}; localStorage.removeItem(KEY); }
  function setShrinePos(x,y,z){ data.shrinePos={x,y,z}; save(); }
  function collectStone(k){ data.stones[k]=true; data.stonesCollected=Object.values(data.stones).filter(Boolean).length; save(); }
  function get(){ return data; }
  return { load, save, reset, setShrinePos, collectStone, get };
})();

/* ═══ AUDIO SYSTEM (Web Audio API) ═══ */
const Audio3D = (() => {
  let ctx=null, masterGain=null;
  let ambientOsc=null, ambientGain=null;
  let battleOsc=null, battleGain=null;
  let bossActive=false;

  function init(){
    try{
      ctx=new(window.AudioContext||window.webkitAudioContext)();
      masterGain=ctx.createGain(); masterGain.gain.value=0.45;
      masterGain.connect(ctx.destination);
    }catch(e){ ctx=null; }
  }

  function playTone(freq,dur,vol=0.15,type='sine',delay=0){
    if(!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(0,ctx.currentTime+delay);
    g.gain.linearRampToValueAtTime(vol,ctx.currentTime+delay+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    o.connect(g); g.connect(masterGain);
    o.start(ctx.currentTime+delay); o.stop(ctx.currentTime+delay+dur+0.02);
  }

  function playHit(){ playTone(220,0.12,0.25,'square'); playTone(110,0.08,0.1,'sawtooth',0.05); }
  function playPickup(){ [523,659,784].forEach((f,i)=>playTone(f,0.3,0.18,'sine',i*0.1)); }
  function playSword(){ playTone(440,0.08,0.3,'sawtooth'); playTone(880,0.05,0.2,'sawtooth',0.06); }
  function playJump(){ playTone(330,0.12,0.12,'sine'); playTone(440,0.1,0.08,'sine',0.08); }
  function playDeath(){ [220,196,164,130].forEach((f,i)=>playTone(f,0.6,0.2,'sine',i*0.25)); }
  function playVictory(){ [523,659,784,1046].forEach((f,i)=>playTone(f,0.8,0.3,'sine',i*0.18)); }
  function playBossHit(){ playTone(55,0.3,0.35,'sawtooth'); playTone(110,0.2,0.2,'square',0.05); }
  function playBullSnort(){ playTone(70,0.5,0.4,'sawtooth'); playTone(45,0.6,0.3,'square',0.1); }
  function playBullStep(){ playTone(140,0.06,0.18,'square'); playTone(80,0.08,0.2,'sine',0.03); }

  function startAmbient(type='earth'){
    if(!ctx) return;
    stopAmbient();
    const freqs={earth:[120,180],water:[90,160],fire:[60,100],air:[200,300],aether:[80,140]};
    const f=freqs[type]||freqs.earth;
    ambientOsc=ctx.createOscillator();
    ambientOsc.type='sine'; ambientOsc.frequency.value=f[0];
    ambientGain=ctx.createGain(); ambientGain.gain.value=0;
    ambientOsc.connect(ambientGain); ambientGain.connect(masterGain);
    ambientOsc.start();
    ambientGain.gain.linearRampToValueAtTime(0.06,ctx.currentTime+2);
  }
  function stopAmbient(){
    if(ambientGain){ ambientGain.gain.setValueAtTime(ambientGain.gain.value,ctx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(0,ctx.currentTime+1); }
    try{ if(ambientOsc) ambientOsc.stop(ctx.currentTime+1.1); }catch(e){}
    ambientOsc=null; ambientGain=null;
  }

  function startBattle(){
    if(!ctx||battleOsc) return;
    battleOsc=ctx.createOscillator(); battleOsc.type='square'; battleOsc.frequency.value=55;
    battleGain=ctx.createGain(); battleGain.gain.value=0;
    battleOsc.connect(battleGain); battleGain.connect(masterGain);
    battleOsc.start();
    battleGain.gain.linearRampToValueAtTime(0.08,ctx.currentTime+0.5);
    ambientGain&&(ambientGain.gain.value*=0.3);
  }
  function stopBattle(){
    if(!battleOsc) return;
    battleGain.gain.setValueAtTime(battleGain.gain.value,ctx.currentTime);
    battleGain.gain.linearRampToValueAtTime(0,ctx.currentTime+1.5);
    try{ battleOsc.stop(ctx.currentTime+1.6); }catch(e){}
    battleOsc=null; battleGain=null;
  }

  function resume(){ if(ctx&&ctx.state==='suspended') ctx.resume(); }
  return { init, resume, playHit, playPickup, playSword, playJump, playDeath, playVictory, playBossHit, playBullSnort, playBullStep, startAmbient, stopAmbient, startBattle, stopBattle };
})();

/* ═══ ABILITY SYSTEM ═══ */
const Abilities = (() => {
  const DEFS = {
    earth:{ name:'Earth Shield',   emoji:'🌿', duration:6, cooldown:20, desc:'+60% defense for 6s' },
    water:{ name:'Water Slow',     emoji:'💧', duration:5, cooldown:25, desc:'40% slow + 15% heal' },
    fire: { name:'Fire Surge',     emoji:'🔥', duration:8, cooldown:30, desc:'+150% damage for 8s' },
    air:  { name:'Air Dash',       emoji:'🌬', duration:0, cooldown:8,  desc:'Double jump + dash' },
    aether:{ name:'Aether Stop',   emoji:'✨', duration:4, cooldown:40, desc:'Freeze all enemies 4s' },
  };
  const cooldowns={earth:0,water:0,fire:0,air:0,aether:0};
  const active={earth:false,water:false,fire:false,air:false,aether:false};
  let canDoubleJump=false;

  function has(key){ return Save.get().stones[key]; }

  function use(key, playerRef){
    if(!has(key)||cooldowns[key]>0) return false;
    const def=DEFS[key];
    cooldowns[key]=def.cooldown;
    active[key]=true;
    UI.showMessage(def.emoji+' '+def.name+'\n'+def.desc);
    if(key==='air') canDoubleJump=true;
    if(key==='water'&&playerRef){ playerRef.hp=Math.min(playerRef.maxHp, playerRef.hp+playerRef.maxHp*0.15); }
    if(def.duration>0) setTimeout(()=>{ active[key]=false; },def.duration*1000);
    Audio3D.playPickup();
    return true;
  }

  function tick(dt){
    Object.keys(cooldowns).forEach(k=>{ 
      if(cooldowns[k]>0) cooldowns[k]=Math.max(0,cooldowns[k]-dt); 
      UI.updateCooldown(k, cooldowns[k]);
    });
  }

  function getDamageMultiplier(){ return active.fire?2.5:1; }
  function getDefenseMultiplier(){ return active.earth?0.4:1; }
  function isSlowActive(){ return active.water; }
  function isTimeStopActive(){ return active.aether; }
  function getCanDoubleJump(){ return canDoubleJump; }

  return { DEFS, has, use, tick, getDamageMultiplier, getDefenseMultiplier, isSlowActive, isTimeStopActive, getCanDoubleJump };
})();

/* ═══ DIALOGUE & CUTSCENE ═══ */
const Dialogue = (() => {
  let queue=[], onDone=null;
  let el, nameEl, textEl;

  function init(){
    el=document.getElementById('dialogue');
    nameEl=document.getElementById('dlg-name');
    textEl=document.getElementById('dlg-text');
    el.addEventListener('click',next);
  }

  function play(lines, cb){
    queue=[...lines]; onDone=cb||null;
    next();
  }

  function next(){
    if(!queue.length){ el.style.display='none'; if(onDone) onDone(); onDone=null; return; }
    const item=queue.shift();
    const [name,text]=Array.isArray(item)?item:['',item];
    nameEl.textContent=name;
    textEl.textContent='';
    el.style.display='block';
    
    let i=0;
    const iv=setInterval(()=>{
      textEl.textContent=text.slice(0,++i);
      if(i>=text.length) clearInterval(iv);
    },22);
  }

  function isActive(){ return el&&el.style.display!=='none'; }
  return { init, play, isActive };
})();

const Cutscene = (() => {
  let cs, csTitle, csBody;
  function init(){
    cs=document.getElementById('cutscene');
    csTitle=document.getElementById('cs-title');
    csBody=document.getElementById('cs-body');
  }
  function play(title, body, duration=5000, cb){
    csTitle.textContent=title; csBody.textContent=body;
    cs.style.display='flex';
    cs.style.animation='none'; cs.style.opacity=1;
    setTimeout(()=>{
      cs.style.transition='opacity 1s'; cs.style.opacity=0;
      setTimeout(()=>{ cs.style.display='none'; cs.style.transition=''; if(cb) cb(); },1000);
    }, duration);
  }
  return { init, play };
})();

/* ═══ UI MANAGER ═══ */
const UI = {
  hpBar:null, stBar:null, prompt:null, dmg:null, bossHud:null, bossName:null, bossHp:null, count:null,
  init: function(){
    this.hpBar = document.getElementById('hp-bar');
    this.stBar = document.getElementById('stamina-bar');
    this.prompt = document.getElementById('interact-prompt');
    this.dmg = document.getElementById('damage-overlay');
    this.bossHud = document.querySelector('.boss-hud');
    this.bossName = document.getElementById('boss-name');
    this.bossHp = document.getElementById('boss-hp');
    this.count = document.getElementById('stone-count');
    Config.init();
    Dialogue.init();
    Cutscene.init();
    this.refreshStones();
  },
  setHp: function(cur, mx){ this.hpBar.style.width = (cur/mx*100)+'%'; },
  setStamina: function(cur, mx){ this.stBar.style.width = (cur/mx*100)+'%'; },
  showInteract: function(txt){ this.prompt.textContent = txt; this.prompt.style.opacity = 1; },
  hideInteract: function(){ this.prompt.style.opacity = 0; },
  showNandiPrompt: function(){ this.showInteract('[E] Mount Nandi'); },
  hideNandiPrompt: function(){ this.hideInteract(); },
  showMessage: function(txt){ this.showInteract(txt); setTimeout(()=>this.hideInteract(), 3000); },
  flashDamage: function(){
    this.dmg.style.opacity = 0.8;
    setTimeout(()=>{ this.dmg.style.opacity = 0; }, 300);
  },
  showBoss: function(name, cur, mx){
    this.bossHud.style.display='block';
    this.bossName.textContent = name;
    this.bossHp.style.width = (cur/mx*100)+'%';
  },
  hideBoss: function(){ this.bossHud.style.display='none'; },
  refreshStones: function(){
    const s = Save.get();
    this.count.textContent = s.stonesCollected;
    ['earth','water','fire','air','aether'].forEach(k=>{
      const el = document.getElementById('s-'+k);
      const ab = document.getElementById('a-'+k);
      if(s.stones[k]){
        if(el) el.classList.add('active');
        if(ab) ab.classList.add('unlocked');
      } else {
        if(el) el.classList.remove('active');
        if(ab) ab.classList.remove('unlocked');
      }
    });
  },
  updateCooldown: function(key, val){
    const el = document.getElementById('cd-'+key);
    if(el) {
      if(val<=0) el.style.display='none';
      else { el.style.display='flex'; el.textContent = Math.ceil(val)+'s'; }
    }
  }
};
