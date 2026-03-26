/* scripts/game.js - Main Engine & Player Logic */
'use strict';

window.onload=()=>{ 
  UI.init(); 
  init(); 
  document.getElementById('loading').style.display='none';
  document.getElementById('main-menu').style.display='flex';
  document.getElementById('btn-start').onclick=startGame; 
};

let scene, camera, renderer, clock;
let groundMeshes=[], solidMeshes=[], mainSun=null;
let _frameN=0, _battleMusicOn=false;

// Player State
const player = {
  mesh:null, model:null, bones:{}, attackSphere: new THREE.Sphere(new THREE.Vector3(), 2.8),
  hp:100, maxHp:100, stamina:100, maxSt:100,
  velY:0, moveVelX:0, moveVelZ:0,
  isGrounded:true, usedDoubleJump:false,
  isAttacking:false, attackTimer:0, comboCnt:0, comboTimer:0,
  onNandi:false, weapon: null
};

const Weapons = [
  { id:'sword', name:'Ancient Sword', color:0xaaaaaa, dmg:45, range:4, model:null },
  { id:'staff', name:'Mystic Staff', color:0x884422, dmg:35, range:6, model:null },
  { id:'pistol', name:'Iron Pistol', color:0x333333, dmg:60, range:60, model:null }
];
let worldWeapons = [], isAiming=false;

const WALK=12, GRAVITY=-40, JUMP=18;
// Camera state — GTA-style: behind+slightly above, shoulder-offset right
let yaw=0, pitch=0.38;  // pitch 0.38 rad ≈ look slightly downward like GTA
const keys={};
const camSmooth=new THREE.Vector3(), camLookAt=new THREE.Vector3();
const _rayDown=new THREE.Raycaster(), _rayDir=new THREE.Vector3(0,-1,0);

let playerMixer = null;
let playerActions = {};
let currentAction = null;

function setAction(name, dur=0.2){
  if(!playerActions[name] || currentAction === playerActions[name]) return;
  const nextAction = playerActions[name];
  if(currentAction) currentAction.crossFadeTo(nextAction, dur, true);
  nextAction.reset().play();
  currentAction = nextAction;
}

/* ── Solid body collision: precise AABB push-out ── */
const _entityBox = new THREE.Box3();
const _solidBox  = new THREE.Box3();
function resolveCollision(pos, radius, height){
  _entityBox.setFromCenterAndSize(new THREE.Vector3(pos.x, pos.y+height/2, pos.z), new THREE.Vector3(radius*2, height, radius*2));
  solidMeshes.forEach(s=>{
    s.updateMatrixWorld(true);
    _solidBox.setFromObject(s);
    if(_entityBox.intersectsBox(_solidBox)){
      // AABB overlap push-out
      const dx1 = _solidBox.max.x - _entityBox.min.x;
      const dx2 = _entityBox.max.x - _solidBox.min.x;
      const dz1 = _solidBox.max.z - _entityBox.min.z;
      const dz2 = _entityBox.max.z - _solidBox.min.z;
      
      const overlapX = dx1 < dx2 ? dx1 : -dx2;
      const overlapZ = dz1 < dz2 ? dz1 : -dz2;
      
      // Push out along the shortest axis of intersection to prevent passing through
      if(Math.abs(overlapX) < Math.abs(overlapZ)){
        pos.x += overlapX;
      } else {
        pos.z += overlapZ;
      }
      
      // Refresh entity box after pushing out so subsequent objects push correctly
      _entityBox.setFromCenterAndSize(new THREE.Vector3(pos.x, pos.y+height/2, pos.z), new THREE.Vector3(radius*2, height, radius*2));
    }
  });
}

function getGroundY(x,z){
  _rayDown.set(new THREE.Vector3(x,120,z),_rayDir); _rayDown.far=200;
  const hits=_rayDown.intersectObjects(groundMeshes,false);
  return hits.length>0?hits[0].point.y:0;
}

function buildPlayer(){
  const g=new THREE.Group(); g.position.set(0,1,0);

  const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.8,0.8), new THREE.MeshStandardMaterial({color:0x333333}));
  fallback.position.y = 0.9;
  g.add(fallback);

  player.mesh=g;
  scene.add(g);
  player.attackSphere=new THREE.Vector3();

  try {
    const loader = new THREE.GLTFLoader();
    loader.load('models/Soldier.glb', gltf=>{
      g.remove(fallback);

      const model = gltf.scene;
      model.traverse(c=>{ 
        if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; 
          if(c.material) {
            c.material = c.material.clone();
            c.material.color.setHex(0xaa7744); // Adventurer tint
          }
        }
      });
      
      model.scale.setScalar(1.2);
      model.position.y = -1; 
      model.rotation.y = Math.PI; 
      g.add(model);
      player.model = model;

      let rightHand = null;
      player.bones = {};
      model.traverse(c=>{ 
        if(c.isName==='mixamorigRightHand' || c.name==='mixamorigRightHand') rightHand=c; 
        if(c.name==='mixamorigLeftUpLeg') player.bones.lLeg=c;
        if(c.name==='mixamorigRightUpLeg') player.bones.rLeg=c;
        if(c.name==='mixamorigSpine' || c.name==='mixamorigSpine1') player.bones.spine=c;
      });
      if(rightHand){
        const wGrp=new THREE.Group();
        wGrp.position.set(-0.1, 0.1, 0.1);
        wGrp.rotation.set(0, Math.PI/2, Math.PI/2);
        const mat=(c,r=.8,m=.1)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
        const sword=new THREE.Mesh(new THREE.BoxGeometry(.06,.9,.04),mat(0xaaaaaa,.3,.9)); sword.position.set(0,.4,0); wGrp.add(sword);
        const hilt=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.06),mat(0xc8a86b)); wGrp.add(hilt);
        wGrp.traverse(c=>{ if(c.isMesh) c.castShadow=true; });
        rightHand.add(wGrp);
      }

      playerMixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(a=>{
        const nm = a.name.toLowerCase();
        if(nm.includes('idle')) playerActions.idle = playerMixer.clipAction(a);
        if(nm.includes('walk')) playerActions.walk = playerMixer.clipAction(a);
        if(nm.includes('run')) playerActions.run = playerMixer.clipAction(a);
      });
      
      if(!playerActions.idle && gltf.animations.length>0) playerActions.idle = playerMixer.clipAction(gltf.animations[0]);
      if(!playerActions.walk && gltf.animations.length>1) playerActions.walk = playerMixer.clipAction(gltf.animations[1]);
      if(!playerActions.run && gltf.animations.length>2) playerActions.run = playerMixer.clipAction(gltf.animations[2]);

      if(playerActions.idle) setAction('idle', 0);
    });
  } catch(e) { console.warn('GLTFLoader missing'); }
}

function init(){
  Save.load();
  Audio3D.init();


  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('c'),
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  renderer.shadowMap.enabled  = true;
  renderer.shadowMap.type     = THREE.PCFSoftShadowMap; 
  renderer.outputEncoding     = THREE.sRGBEncoding;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping; 
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = true;

  // Rich twilight-amber sky — Varanasi at dusk
  scene = new THREE.Scene ? new THREE.Scene() : scene;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0e04);           // deep amber dark sky
  // Atmospheric volumetric fog — dense near-far gradient
  scene.fog = new THREE.FogExp2(0x4a3018, 0.004);         // warm brown fog

  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.5, 2500);
  camSmooth.set(0,6,12);
  camLookAt.set(0,1.5,0);

  clock=new THREE.Clock();

  World.init(scene);
  groundMeshes=World.getGroundMeshes();
  solidMeshes=World.getSolidMeshes();
  mainSun=World.getMainSun();
  buildPlayer();
  Combat.init(scene);

  const sv=Save.get();
  player.hp=sv.hp; player.mesh.position.set(sv.shrinePos.x,sv.shrinePos.y,sv.shrinePos.z);
  UI.setHp(player.hp,player.maxHp);
  UI.setStamina(player.stamina,player.maxSt);
  UI.refreshStones();

  window.addEventListener('resize',()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });
  document.addEventListener('keydown',e=>{ keys[e.code]=true; });
  document.addEventListener('keyup',e=>{ keys[e.code]=false; });
  document.addEventListener('mousemove',e=>{
    if(document.pointerLockElement!==document.body) return;
    // GTA-style sensitivity — non-inverted (mouse up = look up)
    const baseSens = 0.0038;
    const sens = window.Config ? Config.sens : 1.0;
    yaw   -= e.movementX * baseSens * sens;
    pitch += e.movementY * baseSens * 0.75 * sens;   // += so pulling mouse back looks up
    pitch  = Math.max(0.12, Math.min(1.1, pitch));
  });
  document.addEventListener('mousedown',e=>{
    if(document.pointerLockElement!==document.body) return;
    if(e.button===0) doAttack();
  });
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){
      if(document.pointerLockElement===document.body) document.exitPointerLock();
    }
    if(document.pointerLockElement!==document.body) return;
    if(e.code==='Space') doJump();
    if(e.code==='KeyE') doInteract();   // E = mount / dismount Nandi
    if(e.code==='KeyC') doCollect();    // C = collect stone
    ['Digit1','Digit2','Digit3','Digit4','Digit5'].forEach((k,i)=>{
      if(e.code===k){ const s=['earth','water','fire','air','aether']; Abilities.use(s[i],player); }
    });
  });

  window.addEventListener('player-hurt', (e)=>{
    player.hp -= e.detail; UI.setHp(player.hp, player.maxHp); UI.flashDamage(); Audio3D.playDeath();
    if(player.hp<=0){
      document.exitPointerLock();
      alert('You have fallen... The Cosmos resets.');
      location.reload();
    }
  });

  document.getElementById('btn-reset').onclick=()=>{ Save.reset(); location.reload(); };
  document.getElementById('btn-resume').onclick=()=>{ document.body.requestPointerLock(); };
  
  // ── Boundary Overlay Buttons ──
  document.getElementById('btn-checkpoint').onclick=()=>{ 
    UI.hideBoundary();
    const sv = Save.get();
    player.hp = sv.hp; player.mesh.position.set(sv.shrinePos.x, sv.shrinePos.y, sv.shrinePos.z);
    player.hp = sv.hp; player.mesh.position.set(sv.shrinePos.x, sv.shrinePos.y, sv.shrinePos.z);
    saveGame();
  };
  document.getElementById('btn-startover').onclick=()=>{ Save.reset(); location.reload(); };
  document.getElementById('btn-exitgame').onclick=()=>{ window.close() || (location.href = "about:blank"); };

  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===document.body){ 
      document.getElementById('pause-menu').style.display='none'; 
      if(!isIntroDone) playIntro();
    }
    else{ if(document.getElementById('main-menu').style.display==='none') document.getElementById('pause-menu').style.display='flex'; }
  });
}

let isIntroDone = false;
function playIntro(){
  isIntroDone = true;
  camera.position.set(0, 15, -40);
  camera.lookAt(0, 5, 0);
  UI.showMessage('VARANASI: LAST DAWN OF KALI YUGA');
  Dialogue.play([['Cosmos', 'Arise, warrior. The stones of power await.']]);
}

function spawnWeapons(){
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshStandardMaterial({color:0xaaaaaa, metalness:0.8}));
  sword.position.set(8, 0, -8); sword.rotation.z=Math.PI/2.5; scene.add(sword);
  worldWeapons.push({ mesh:sword, type:'sword' });
}

function startGame(){
  document.getElementById('main-menu').style.display='none';
  document.getElementById('loading').style.display='none';
  document.getElementById('hud').style.display='block';
  spawnWeapons();
  document.body.requestPointerLock();
  Audio3D.resume(); Audio3D.startAmbient();
  animate();
}

function doShoot(){
  if(player.onNandi) return;
  Audio3D.playHit();
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const flash = new THREE.PointLight(0xffff44, 20, 10);
  flash.position.copy(player.mesh.position).addScaledVector(dir, 2); flash.position.y+=1.5;
  scene.add(flash); setTimeout(()=>scene.remove(flash), 60);

  const hit = Combat.tryPlayerShoot(player.mesh.position, dir, 60);
  if(hit) Audio3D.playBossHit();
}

function doJump(){
  if(player.onNandi) return;
  if(player.isGrounded){ player.velY=JUMP; player.isGrounded=false; player.usedDoubleJump=false; Audio3D.playJump(); }
  else if(Abilities.getCanDoubleJump()&&!player.usedDoubleJump){ player.velY=JUMP*.82; player.usedDoubleJump=true; Audio3D.playJump(); }
}

function doAttack(){
  if(player.isAttacking) return;
  player.isAttacking=true; player.attackTimer=0.35;
  player.comboTimer=1.2;
  const baseDmg = player.weapon ? player.weapon.dmg : 25;
  const dmg = baseDmg + player.comboCnt * 12;

  const fw=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  
  // ── Physical Combat Lunge & Animation ──
  player.mesh.rotation.y = yaw;
  const lungeDist = player.comboCnt === 2 ? 4.5 : 2.0;
  player.mesh.position.addScaledVector(fw, lungeDist);
  resolveCollision(player.mesh.position, 0.6, 1.8);

  player.comboCnt=(player.comboCnt+1)%3;
  const range = player.weapon ? player.weapon.range : 3.0;
  player.attackSphere.copy(player.mesh.position).addScaledVector(fw, range*0.8);
  player.attackSphere.radius = range;

  const hitEnemy=Combat.tryPlayerAttack(player.attackSphere,dmg);
  const hitBoss=Boss.tryPlayerAttack(player.attackSphere);
  
  if(!hitEnemy&&!hitBoss) Audio3D.playMiss();
}

// ─ E: mount / dismount / pickup ─
function doInteract(){
  if(Dialogue.isActive()) return;
  // 1. Weapon Pickup
  for(let i=0; i<worldWeapons.length; i++){
    const w = worldWeapons[i];
    if(player.mesh.position.distanceTo(w.mesh.position) < 5){
      player.weapon = Weapons.find(wp=>wp.id === w.type);
      scene.remove(w.mesh); worldWeapons.splice(i, 1);
      UI.showMessage('Picked up: ' + player.weapon.name);
      Audio3D.playPickup(); return;
    }
  }
}

// ─ C: collect nearby stone ─
function doCollect(){
  let collected = false;
  World.getStones().forEach(s=>{
    if(s.userData.collected) return;
    if(player.mesh.position.distanceTo(s.position)<8){
      s.userData.collected=true;
      scene.remove(s); if(s.userData.glow) scene.remove(s.userData.glow);
      Save.collectStone(s.userData.key);
      UI.refreshStones();
      Audio3D.playVictory();
      Cutscene.play(s.userData.key.toUpperCase()+' STONE OBTAINED', Abilities.DEFS[s.userData.key].desc);
      collected=true;
    }
  });
  if(!collected) UI.showMessage('No stone nearby');
  if(player.mesh.position.distanceTo(new THREE.Vector3(0,0,0))<12){ Save.setShrinePos(0,1,0); UI.showMessage('Game Saved'); }
}

function checkBossTrigger(){
  const px=player.mesh.position.x, pz=player.mesh.position.z;
  const s=Save.get().stones;
  if(!s.earth && Math.abs(px)<25 && Math.abs(pz+40)<25) Boss.spawn('Stone Guardian',scene);
  if(s.earth && !s.water && Math.abs(px-150)<35 && Math.abs(pz+100)<35) Boss.spawn('River Serpent',scene);
  if(s.water && !s.fire && Math.abs(px-300)<40 && Math.abs(pz+50)<40) Boss.spawn('Flame Titan',scene);
  if(s.fire && !s.air && Math.abs(px-450)<40 && Math.abs(pz-150)<40) Boss.spawn('Storm Beast',scene);
  if(s.air && !s.aether && Math.abs(px+150)<40 && Math.abs(pz-200)<40) Boss.spawn('AI Robot',scene);
}

/* ════════════════════════
   GTA-STYLE TPP CAMERA
   ─ Camera sits 4-6 units behind the player
   ─ 1 unit right shoulder offset (over-the-shoulder)
   ─ Height driven by pitch (mouse Y)
   ─ Smooth lerp like GTA V
════════════════════════ */
function updateCamera(dt){
  const px=player.mesh.position.x;
  const py=player.mesh.position.y;
  const pz=player.mesh.position.z;
  const camDist = player.onNandi ? 9.0 : 5.5;  // pull back more on ox
  const camHeight = player.onNandi ? 4.5 : 2.8;

  // World-space camera position behind the player based on yaw
  const behind = new THREE.Vector3(
    Math.sin(yaw) * camDist,
    camHeight + pitch * 3.5,   // pitch raises/lowers view naturally
    Math.cos(yaw) * camDist
  );

  // Slight right shoulder offset (1 unit to the right of the player)
  const right = new THREE.Vector3(Math.cos(yaw) * 0.85, 0, -Math.sin(yaw) * 0.85);
  const targetCamPos = new THREE.Vector3(
    px + behind.x + right.x,
    py + behind.y,
    pz + behind.z + right.z
  );

  // Prevent camera dipping underground
  const groundUnder = getGroundY(targetCamPos.x, targetCamPos.z);
  if(targetCamPos.y < groundUnder + 1.0) targetCamPos.y = groundUnder + 1.0;

  // Smooth camera follow (GTA uses ~10 factor)
  camSmooth.lerp(targetCamPos, Math.min(1, dt * 11));
  camera.position.copy(camSmooth);

  // Always look at a point slightly above the player's head
  const lookTarget = new THREE.Vector3(px - right.x*0.3, py + 1.5, pz - right.z*0.3);
  camLookAt.lerp(lookTarget, Math.min(1, dt * 14));
  camera.lookAt(camLookAt);
}

function updateMinimap(){
  const canvas = document.getElementById('minimap');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, size, size);
  
  // Player bounds in world = roughly -150 to 500
  // Map zoom range = ~80 world units half-width
  const mapScale = size / 160; 
  const pX = player.mesh.position.x;
  const pZ = player.mesh.position.z;

  const w2s = (wx, wz) => {
    return {
      x: size/2 + (wx - pX) * mapScale,
      y: size/2 + (wz - pZ) * mapScale
    };
  };

  // Draw stones (yellow)
  World.getStones().forEach(s => {
    if(s.userData.collected) return;
    const sp = w2s(s.position.x, s.position.z);
    if(sp.x >= 0 && sp.x <= size && sp.y >= 0 && sp.y <= size){
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, Math.PI*2); ctx.fill();
    }
  });

  // Draw enemies (red)
  Combat.getEnemies().forEach(e => {
    if(e.dead) return;
    const ep = w2s(e.mesh.position.x, e.mesh.position.z);
    if(ep.x >= 0 && ep.x <= size && ep.y >= 0 && ep.y <= size){
      ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(ep.x, ep.y, 3, 0, Math.PI*2); ctx.fill();
    }
  });

  // Draw player (white triangle in center pointing up)
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(size/2, size/2);
  ctx.rotate(yaw + Math.PI); // sync map arrow rotation with looking direction
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 4);
  ctx.lineTo(-4, 4);
  ctx.fill();
  ctx.restore();
}

function updatePlayer(dt){
  const isSprint=keys['ShiftLeft']||keys['ShiftRight'];
  const mvSpd=isSprint?WALK*1.8:WALK;
  if(isSprint) player.stamina=Math.max(0,player.stamina-dt*15);
  else player.stamina=Math.min(player.maxSt,player.stamina+dt*25);
  UI.setStamina(player.stamina,player.maxSt);

  const effSpd=(isSprint&&player.stamina>1)?mvSpd:WALK;
  const fw=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)), rt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const mv=new THREE.Vector3();
  if(keys['KeyW']) mv.addScaledVector(fw,1);
  if(keys['KeyS']) mv.addScaledVector(fw,-1);
  if(keys['KeyA']) mv.addScaledVector(rt,-1);
  if(keys['KeyD']) mv.addScaledVector(rt,1);
  
  if(mv.lengthSq()>0) mv.normalize().multiplyScalar(effSpd);
  
  player.moveVelX = THREE.MathUtils.lerp(player.moveVelX || 0, mv.x, dt * 10);
  player.moveVelZ = THREE.MathUtils.lerp(player.moveVelZ || 0, mv.z, dt * 10);

  player.mesh.position.x += player.moveVelX * dt;
  player.mesh.position.z += player.moveVelZ * dt;
  const curSpeedSq = player.moveVelX*player.moveVelX + player.moveVelZ*player.moveVelZ;
  if(curSpeedSq>0.01) player.mesh.rotation.y=Math.atan2(player.moveVelX,player.moveVelZ);

  player.velY+=GRAVITY*dt;
  player.mesh.position.y+=player.velY*dt;

  const gy=getGroundY(player.mesh.position.x,player.mesh.position.z);
  if(player.mesh.position.y<=gy+1){
    player.mesh.position.y=gy+1;
    player.velY=0; player.isGrounded=true; player.usedDoubleJump=false;
  } else { player.isGrounded=false; }

  const inBorder = player.mesh.position.x > -85 && player.mesh.position.x < 485 && player.mesh.position.z > -305 && player.mesh.position.z < 305;
  if(!inBorder) UI.showBoundary();
  resolveCollision(player.mesh.position, 0.6, 1.8);

  if(mainSun){
    mainSun.position.set(player.mesh.position.x+60, player.mesh.position.y+150, player.mesh.position.z+30);
    mainSun.target.position.copy(player.mesh.position);
    mainSun.target.updateMatrixWorld();
  }

  if(playerMixer) playerMixer.update(dt);
  
  if(player.isGrounded){
    if(curSpeedSq > 40) setAction('run');
    else if(curSpeedSq > 0.1) setAction('walk');
    else setAction('idle');
  }

  if(player.isAttacking){
    player.attackTimer -= dt;
    if(player.model) player.model.rotation.x = Math.sin(player.attackTimer*20)*0.4;
    if(player.attackTimer<=0) player.isAttacking=false; 
  } else {
    if(player.model) player.model.rotation.x = THREE.MathUtils.lerp(player.model.rotation.x, 0, dt*10);
  }
  if(player.comboTimer>0){ player.comboTimer-=dt; if(player.comboTimer<=0) player.comboCnt=0; }

  let nearStone=false;
  World.getStones().forEach(s=>{
    if(s.userData.collected) return;
    if(player.mesh.position.distanceTo(s.position)<5){
      nearStone=true; UI.showInteract('[C] Collect '+s.userData.key.charAt(0).toUpperCase()+s.userData.key.slice(1)+' Stone');
    }
  });
  if(!nearStone) UI.hideInteract();

  if(_frameN%60===0) checkBossTrigger();

  if(_frameN%30===0){
    const anyNear=Combat.anyEnemyNear(player.mesh.position)||Boss.isActive();
    if(anyNear&&!_battleMusicOn){ _battleMusicOn=true; Audio3D.startBattle(); }
    else if(!anyNear&&_battleMusicOn){ _battleMusicOn=false; Audio3D.stopBattle(); }
  }

  updateCamera(dt);
  updateMinimap();
}

function animate(){
  requestAnimationFrame(animate);
  if(document.pointerLockElement!==document.body) return;
  
  const dt=Math.min(clock.getDelta(),0.1);
  const t=clock.getElapsedTime();
  _frameN++;
  
  // Fog blends depending on region!
  const px=player.mesh.position.x;
  if(px<30) { scene.fog.color.lerp(new THREE.Color(0x8aab78),0.02); scene.background.copy(scene.fog.color); }
  else if(px<200) { scene.fog.color.lerp(new THREE.Color(0x789aab),0.02); scene.background.copy(scene.fog.color); }
  else if(px<350) { scene.fog.color.lerp(new THREE.Color(0x662211),0.02); scene.background.copy(scene.fog.color); }
  else { scene.fog.color.lerp(new THREE.Color(0x88aabb),0.02); scene.background.copy(scene.fog.color); }

  updatePlayer(dt);
  World.tick(t, dt);
  Abilities.tick(dt);
  Combat.tick(dt, player.mesh);

  // ── High-End Atmospheric Dust ──
  const dust = scene.getObjectByName('dust');
  if(dust) {
    dust.position.set(player.mesh.position.x, 0, player.mesh.position.z);
  }

  renderer.render(scene, camera);
}
