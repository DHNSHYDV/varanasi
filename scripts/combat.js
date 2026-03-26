/* scripts/combat.js - Enemies, AI & Boss Fights */
'use strict';

const Combat = (() => {
  let enemies=[];
  let scene3d=null;

  function mkEnemyMesh(clr){
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:clr,roughness:0.7});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,2.4,8),mat); body.position.y=1.2; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8),new THREE.MeshStandardMaterial({color:0xffaaaa})); head.position.y=2.8; head.castShadow=true; g.add(head);
    // Weapon
    const wpn=new THREE.Mesh(new THREE.BoxGeometry(0.2,2.5,0.2),new THREE.MeshStandardMaterial({color:0x444444}));
    wpn.position.set(1, 1.5, 0.5); wpn.rotation.x=Math.PI/4; g.add(wpn);
    return g;
  }

  function init(scene, regions){
    scene3d=scene; enemies=[];
    // Map enemies closely to zones
    const zones = [
      {cx:0,cz:-40,clr:0x224422},    // Earth
      {cx:150,cz:-80,clr:0x224488},  // Water
      {cx:300,cz:-30,clr:0x882222},  // Fire
      {cx:450,cz:120,clr:0x667788}   // Air
    ];
    zones.forEach(z=>{
      for(let i=0;i<4;i++){ spawnEnemy(z.cx+(Math.random()-.5)*40, z.cz+(Math.random()-.5)*40, z.clr); }
    });
  }

  function spawnEnemy(x,z,clr){
    const mesh=mkEnemyMesh(clr); mesh.position.set(x,0,z); scene3d.add(mesh);
    enemies.push({ mesh, hp:100, maxHp:100, dead:false, timer:0, state:'idle', sx:x, sz:z, attTimer:0 });
  }

  function getEnemies(){ return enemies; }

  function tick(dt, playerMesh){
    if(!playerMesh) return;
    const px=playerMesh.position.x, pz=playerMesh.position.z;
    enemies.forEach(e=>{
      if(e.dead) return;
      const dx=px-e.mesh.position.x, dz=pz-e.mesh.position.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      
      e.mesh.position.y = 0; // Stick to ground (simplified)
      
      if(e.state==='hit'){
        e.timer-=dt;
        e.mesh.children[0].material.color.setHex(0xffffff); // flash white
        if(e.timer<=0){ e.state='chase'; e.mesh.children[0].material.color.setHex(0xaa3333); }
      }
      else if(dist<15){
        e.state='chase';
        e.mesh.rotation.y = Math.atan2(-dx,-dz);
        if(dist>2.5){
          e.mesh.position.x+=Math.sin(e.mesh.rotation.y)*-dt*4;
          e.mesh.position.z+=Math.cos(e.mesh.rotation.y)*-dt*4;
        } else {
          // Attack
          e.attTimer-=dt;
          if(e.attTimer<=0){
            e.attTimer=1.5;
            // Simple player damage logic applies via global game call or event
            const defMult = window.Abilities ? window.Abilities.getDefenseMultiplier() : 1;
            window.dispatchEvent(new CustomEvent('player-hurt', {detail:15 * defMult}));
          }
        }
      } else {
        // Idle roam
        e.timer-=dt;
        if(e.timer<=0){ e.timer=2+Math.random()*2; e.mesh.rotation.y=Math.random()*Math.PI*2; }
        e.mesh.position.x+=Math.sin(e.mesh.rotation.y)*-dt*1.5;
        e.mesh.position.z+=Math.cos(e.mesh.rotation.y)*-dt*1.5;
      }
    });

    Boss.tick(dt, playerMesh);
  }

  function tryPlayerAttack(sphere, dmg){
    let hit=false;
    enemies.forEach(e=>{
      if(e.dead) return;
      if(sphere.distanceTo(e.mesh.position) < 3.5){
        e.hp -= dmg; e.state='hit'; e.timer=0.2; hit=true;
        Audio3D.playHit();
        if(e.hp<=0) killEnemy(e);
      }
    });
    return hit;
  }

  function killEnemy(e){
    e.dead=true; e.mesh.rotation.x=-Math.PI/2;
    e.mesh.position.y=-0.8;
  }

  function anyEnemyNear(pos){
    return enemies.some(e=>!e.dead && e.mesh.position.distanceTo(pos)<25);
  }

  return { init, tick, getEnemies, tryPlayerAttack, anyEnemyNear, killEnemy };
})();

const Boss = (() => {
  let activeBoss=null, bMesh=null;
  const bosses = {
    'Stone Guardian':{x:0,z:0,hp:400,clr:0x445544,scale:2.5},
    'River Serpent':{x:150,z:-100,hp:500,clr:0x226688,scale:2.8},
    'Flame Titan':{x:300,z:-50,hp:650,clr:0xff3300,scale:3.2},
    'Storm Beast':{x:450,z:150,hp:700,clr:0x88aacc,scale:2.5},
    'AI Robot':{x:-150,z:200,hp:1000,clr:0xaa22ff,scale:4.0}
  };

  function spawn(name, scene3d){
    if(activeBoss) return;
    const def = bosses[name];
    if(!def) return;
    
    bMesh=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:def.clr,roughness:0.4,metalness:0.3});
    // Boss shape
    const body=new THREE.Mesh(new THREE.BoxGeometry(2,3,2),mat); body.position.y=1.5; body.castShadow=true; bMesh.add(body);
    const head=new THREE.Mesh(new THREE.DodecahedronGeometry(1.2),new THREE.MeshStandardMaterial({color:0xffccaa,emissive:def.clr,emissiveIntensity:0.5})); head.position.y=3.5; head.castShadow=true; bMesh.add(head);
    
    bMesh.scale.setScalar(def.scale);
    bMesh.position.set(def.x, 0, def.z);
    scene3d.add(bMesh);

    activeBoss={ name, hp:def.hp, maxHp:def.hp, mesh:bMesh, state:'active', timer:0, px:def.x, pz:def.z };
    UI.showBoss(name, def.hp, def.hp);
    Audio3D.startBattle();
  }

  function tick(dt, pMesh){
    if(!activeBoss) return;
    const dx=pMesh.position.x - activeBoss.mesh.position.x;
    const dz=pMesh.position.z - activeBoss.mesh.position.z;
    const dist=Math.sqrt(dx*dx+dz*dz);

    if(activeBoss.state==='hit'){
      activeBoss.timer-=dt;
      activeBoss.mesh.children[0].material.color.setHex(0xffffff);
      if(activeBoss.timer<=0){ activeBoss.state='active'; activeBoss.mesh.children[0].material.color.setHex(bosses[activeBoss.name].clr); }
    } else {
       activeBoss.mesh.rotation.y = Math.atan2(-dx,-dz);
       if(dist>4){
          // Chase slowly
          activeBoss.mesh.position.x+=Math.sin(activeBoss.mesh.rotation.y)*-dt*3;
          activeBoss.mesh.position.z+=Math.cos(activeBoss.mesh.rotation.y)*-dt*3;
       } else {
          // Smash attack
          activeBoss.timer-=dt;
          if(activeBoss.timer<=0){
            activeBoss.timer = 1.8;
            const defMult = window.Abilities ? window.Abilities.getDefenseMultiplier() : 1;
            window.dispatchEvent(new CustomEvent('player-hurt', {detail:30 * defMult}));
          }
       }
    }
  }

  function tryPlayerAttack(sphere){
    if(!activeBoss) return false;
    if(sphere.distanceTo(activeBoss.mesh.position) < 5 * (bosses[activeBoss.name].scale/2)){
      const dmg = 25 * (window.Abilities ? window.Abilities.getDamageMultiplier() : 1);
      activeBoss.hp -= dmg;
      activeBoss.state='hit'; activeBoss.timer=0.2;
      Audio3D.playBossHit();
      UI.showBoss(activeBoss.name, Math.max(0,activeBoss.hp), activeBoss.maxHp);
      
      if(activeBoss.hp<=0){
        // Boss killed!
        Audio3D.playVictory();
        activeBoss.mesh.rotation.x = -Math.PI/2;
        UI.hideBoss();
        Audio3D.stopBattle();
        activeBoss = null;
      }
      return true;
    }
    return false;
  }

  function getDef(name){ return bosses[name]; }
  function isActive(){ return activeBoss!==null; }

  return { spawn, tick, tryPlayerAttack, getDef, isActive };
})();
