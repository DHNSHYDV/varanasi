/* scripts/world.js - Procedural 5 Regions, Solid Bodies, Nandi Ox */
'use strict';

const World = (() => {
  let scene3d, groundMeshes=[], solidMeshes=[], stones=[], particleAnimators=[], templePortal=null;
  let nandi=null, nandiMixer=null, nandiWalkAction=null;
  let mainSun=null;

  // ── Primitive helpers ──
  function mkBox(w,h,d,c,r=.85,m=.05){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
    mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
  }
  function mkCyl(rt,rb,h,s,c,r=.85,m=.05){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s),new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
    mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
  }
  function mkSphere(rad,c,r=.85,m=.05){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(rad,12,8),new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
    mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
  }

  // Add a solid (cylindrical/box) collider object to solidMeshes
  function addSolid(mesh){ solidMeshes.push(mesh); }
  function addGround(mesh){ groundMeshes.push(mesh); }

  function init(sceneRef){
    scene3d=sceneRef;
    groundMeshes=[]; solidMeshes=[]; stones=[]; particleAnimators=[];
    buildJungle(0,0);
    buildRivergats(150,-100);
    buildBurningTemple(300,-50);
    buildMountains(450,150);
    buildAetherRealm(-150,200);
    buildNandi();
    buildLights(scene3d);
  }

  /* ─── Tree helper: trunk + leaves + SOLID collider ─── */
  function addTree(x,z){
    const trunk=mkCyl(0.7,1.1,8,6,0x4a3010); trunk.position.set(x,4,z); scene3d.add(trunk);
    const leaves=mkSphere(3.5,0x224d20); leaves.position.set(x,10,z); leaves.scale.set(1,1.2,1); scene3d.add(leaves);
    // Invisible solid box for collision
    const col=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,10,8),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x,5,z); scene3d.add(col); solidMeshes.push(col);
  }

  /* ─── Rock helper ─── */
  function addRock(x,y,z,s=1){
    const rock=mkSphere(s,0x776655);
    rock.scale.set(1+(Math.random()*.5),0.7+Math.random()*.4,1+(Math.random()*.5));
    rock.position.set(x,y,z); scene3d.add(rock);
    const col=new THREE.Mesh(new THREE.SphereGeometry(s*1.1,6,4),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x,y,z); scene3d.add(col); solidMeshes.push(col);
  }

  /* ─── Temple pillar helper ─── */
  function addPillar(x,y,z){
    const p=mkCyl(0.5,0.6,6,8,0x888070); p.position.set(x,y+3,z); scene3d.add(p);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,6,6),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x,y+3,z); scene3d.add(col); solidMeshes.push(col);
  }

  /* ── 1. JUNGLE (Earth) ── */
  function buildJungle(cx,cz){
    // Terrain
    const ground=mkBox(180,2,180,0x2d4020,1,0); ground.position.set(cx,-1,cz); scene3d.add(ground); addGround(ground);
    // Raised terrain details
    const hill=mkSphere(25,0x3a5520); hill.scale.set(2,0.3,2); hill.position.set(cx+40,0,cz+30); scene3d.add(hill); addGround(hill);
    // Trees with collision
    const rng=[[-45,-45],[-30,50],[55,-30],[60,40],[-55,20],[40,-60],[20,55],[-50,-60],[65,0],[0,60],[-60,60],[-70,-30],[75,25]];
    rng.forEach(([dx,dz])=>addTree(cx+dx, cz+dz));
    // Rocks
    [[20,0,10],[-30,0,-20],[50,0,-35]].forEach(([x,y,z])=>addRock(cx+x,y,cz+z,2));
    // Shrine platform (walkable + solid sides)
    const shrine=mkCyl(9,11,4,8,0x554433); shrine.position.set(cx,2,cz); scene3d.add(shrine); addGround(shrine);
    const wall=mkCyl(9.5,9.5,5,8,0x443322,.9,.1); wall.position.set(cx,4.5,cz); wall.material.side=THREE.BackSide;
    scene3d.add(wall);
    // Four corner pillars
    [[-7,-7],[7,-7],[-7,7],[7,7]].forEach(([dx,dz])=>addPillar(cx+dx,4,cz+dz));
    createStone('earth', cx, 6.5, cz, 0x00ff44);
  }

  /* ── 2. RIVER GHATS (Water) ── */
  function buildRivergats(cx,cz){
    const ground=mkBox(140,2,180,0x6b5e4a,1,0); ground.position.set(cx,-1,cz); scene3d.add(ground); addGround(ground);
    // Water
    const water=mkBox(70,1,180,0x1a4b66,.05,.9); water.position.set(cx+60,-0.6,cz);
    water.material.transparent=true; water.material.opacity=0.75; scene3d.add(water);
    // Ghat steps
    for(let i=0;i<6;i++){
      const s=mkBox(18,1.2,180,0x9a8870); s.position.set(cx+10+i*3,(i*0.3)-1,cz); scene3d.add(s);
      if(i<3) addGround(s);
    }
    // Riverside trees
    [[-30,-60],[-30,0],[-30,50],[-50,-40]].forEach(([dx,dz])=>addTree(cx+dx,cz+dz));
    // Decorative shrine pillars
    [[-10,-20],[-10,20],[10,-20],[10,20]].forEach(([dx,dz])=>addPillar(cx+dx,0,cz+dz));
    const roofSlab=mkBox(30,1,50,0x7a6a5a); roofSlab.position.set(cx,5.5,cz); scene3d.add(roofSlab);
    createStone('water', cx, 5, cz-30, 0x00aaff);
  }

  /* ── 3. BURNING TEMPLE (Fire) ── */
  function buildBurningTemple(cx,cz){
    const ground=mkBox(140,4,140,0x3d1a0e,1,0); ground.position.set(cx,-2,cz); scene3d.add(ground); addGround(ground);
    // Main temple
    const templeBase=mkBox(44,12,44,0x222222); templeBase.position.set(cx,6,cz); scene3d.add(templeBase); solidMeshes.push(templeBase);
    const tTop=mkCyl(0,22,28,4,0x1a1a1a); tTop.position.set(cx,26,cz); scene3d.add(tTop); solidMeshes.push(tTop);
    // Pillars around temple
    [[-20,-20],[20,-20],[-20,20],[20,20],[-20,0],[20,0],[0,-20],[0,20]].forEach(([dx,dz])=>addPillar(cx+dx,0,cz+dz));
    // Perimeter wall
    const wallMat=new THREE.MeshStandardMaterial({color:0x282010}); 
    [[0,-50],[0,50],[-50,0],[50,0]].forEach(([dx,dz])=>{
      const wall=new THREE.Mesh(new THREE.BoxGeometry(dx?4:100,6,dz?100:4),wallMat);
      wall.position.set(cx+dx,3,cz+dz); wall.castShadow=true; scene3d.add(wall); solidMeshes.push(wall);
    });
    // Lava pools
    for(let i=0;i<4;i++){
      const lava=mkBox(8,0.5,8,0xff2200,.05,.4);
      lava.position.set(cx+(i%2?15:-15),0.1,cz+(i<2?15:-15));
      lava.material.emissive.setHex(0xff2200); lava.material.emissiveIntensity=0.6;
      scene3d.add(lava);
    }
    // Fire particles
    const pg=new THREE.BufferGeometry();
    const len=400, pos=new Float32Array(len*3);
    for(let i=0;i<len;i++){ pos[i*3]=cx+(Math.random()-.5)*90; pos[i*3+1]=Math.random()*20; pos[i*3+2]=cz+(Math.random()-.5)*90; }
    pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const fmat=new THREE.PointsMaterial({color:0xff6600,size:0.9,transparent:true,blending:THREE.AdditiveBlending});
    const pts=new THREE.Points(pg,fmat); scene3d.add(pts);
    particleAnimators.push((t,dt)=>{
      const arr=pts.geometry.attributes.position.array;
      for(let i=0;i<len;i++){ arr[i*3+1]+=dt*(4+Math.random()*4); arr[i*3]+=Math.sin(t*2+i)*.06; if(arr[i*3+1]>30) arr[i*3+1]=0; }
      pts.geometry.attributes.position.needsUpdate=true;
    });
    createStone('fire', cx, 4, cz-20, 0xff4400);
  }

  /* ── 4. MOUNTAINS (Air) ── */
  function buildMountains(cx,cz){
    const ground=mkBox(200,2,200,0x8a9095,1,0); ground.position.set(cx,-1,cz); scene3d.add(ground); addGround(ground);
    // Mountain peaks (solid)
    [[cx-30,40,cz-30,26,70],[cx+40,55,cz+20,32,90],[cx-60,35,cz+50,20,60]].forEach(([mx,my,mz,rb,h])=>{
      const m=mkCyl(0,rb,h,6,0x667788); m.position.set(mx,my,mz); scene3d.add(m); solidMeshes.push(m); addGround(m);
    });
    // Snow caps
    [[cx-30,85,cz-30],[cx+40,102,cz+20],[cx-60,67,cz+50]].forEach(([sx,sy,sz])=>{
      const s=mkSphere(8,0xeeeeff,.1,0); s.scale.set(1.5,.6,1.5); s.position.set(sx,sy,sz); scene3d.add(s);
    });
    // Cliff platform (walkable ledge)
    const ledge=mkBox(30,3,15,0x778085); ledge.position.set(cx,8,cz); scene3d.add(ledge); addGround(ledge); solidMeshes.push(ledge);
    // Boulders
    [[-20,0,-20],[30,0,20],[-40,0,30],[20,0,-40]].forEach(([dx,dy,dz])=>addRock(cx+dx,dy,cz+dz,3.5));
    createStone('air', cx, 5, cz-30, 0xeeeeff);
  }

  /* ── 5. AETHER REALM (Cosmic) ── */
  function buildAetherRealm(cx,cz){
    // Floating platform
    const pt=mkBox(80,2,80,0x1a053a,.4,.8); pt.position.set(cx,-1,cz); groundMeshes.push(pt); scene3d.add(pt);
    // Cosmic pillars
    [[-25,-25],[25,-25],[-25,25],[25,25]].forEach(([dx,dz])=>{
      const p=mkCyl(.8,.8,20,8,0x8833cc,.5,.5); p.position.set(cx+dx,10,cz+dz); p.material.emissive.setHex(0x5500aa); p.material.emissiveIntensity=0.5; scene3d.add(p); solidMeshes.push(p);
    });
    // Rings
    [1,2,3].forEach(i=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(12+i*5,0.6,10,64),new THREE.MeshBasicMaterial({color:0xb040ff}));
      ring.position.set(cx,5+i*3,cz); ring.rotation.x=Math.PI/2; scene3d.add(ring);
    });
    templePortal=new THREE.Mesh(new THREE.CylinderGeometry(14,14,3,6),new THREE.MeshBasicMaterial({color:0xb040ff,transparent:true,opacity:0.25}));
    templePortal.position.set(cx,4,cz); scene3d.add(templePortal);
    // Floating rocks
    [[20,10,15],[-20,8,-15],[0,15,20]].forEach(([dx,dy,dz])=>addRock(cx+dx,dy,cz+dz,2.5));
    createStone('aether', cx, 6, cz, 0xcc44ff);
  }

  function createStone(key,x,y,z,clr){
    const s=new THREE.Mesh(new THREE.OctahedronGeometry(1.4,0),new THREE.MeshStandardMaterial({color:clr,emissive:clr,emissiveIntensity:0.6,roughness:.2,metalness:.5}));
    s.position.set(x,y,z); s.userData={key,baseY:y,collected:false};
    const glow=new THREE.PointLight(clr,3,12); glow.position.set(x,y,z); s.userData.glow=glow; scene3d.add(glow);
    scene3d.add(s); stones.push(s);
  }

  /* ══════════════════════════════════════════════
     NANDI — Realistic 3D Bull Asset (Bull.gltf)
  ══════════════════════════════════════════════ */
  function buildNandi(){
    nandi = new THREE.Group();
    nandi.position.set(0, 0, -10);
    nandi.userData = { baseY:0, hp:500, maxHp:500, mounted:false, speed:0, targetYaw:0, dist:0 };

    // Placeholder box until model loads
    const fallback = mkBox(2,2,4,0x888888); 
    fallback.position.y=2;
    nandi.add(fallback);

    const loader = new THREE.GLTFLoader();
      loader.load(
        'assets/Bull/Bull.gltf',
        gltf => {
          // Success — remove fallback gray box
          nandi.remove(fallback);
          const model = gltf.scene;

          // Native BBox: W=0.77, H=1.80, D=3.09
          // scale=1.4 → ~2.5u tall, correct for a large ox next to 1.8u player
          model.scale.setScalar(1.4);
          // Bull GLTF is -Z forward; rotate so he faces +Z (same as player)
          model.rotation.y = Math.PI;
          // Sit his hooves on y=0 (native minY = -0.10)
          model.position.set(0, 0.14, 0);

          model.traverse(c => {
            if(c.isMesh){
              c.castShadow = true;
              c.receiveShadow = true;
              if(c.material){
                c.material.roughness = 0.85;
                c.material.metalness = 0.05;
                c.material.needsUpdate = true;
              }
            }
          });

          nandi.add(model);
          nandi.model = model;
          console.log('Nandi bull loaded successfully!');

          // Animation mixer
          if(gltf.animations && gltf.animations.length > 0){
            nandiMixer = new THREE.AnimationMixer(model);
            nandiWalkAction = nandiMixer.clipAction(gltf.animations[0]);
            nandiWalkAction.timeScale = 0;
            nandiWalkAction.play();
          }
        },
        xhr => { console.log('Bull loading:', Math.round(xhr.loaded/xhr.total*100)+'%'); },
        err => {
          console.error('Bull GLTF load error:', err);
          // Keep fallback visible so Nandi is still interactive
        }
      );

    // ── Ride indicator arrow (floats above Nandi) ──
    const arrowGeo = new THREE.ConeGeometry(0.35, 0.9, 8);
    nandi.rideArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({color:0x00ffcc}));
    nandi.rideArrow.position.set(0, 5.0, 0);
    nandi.rideArrow.rotation.z = Math.PI; // point down
    nandi.add(nandi.rideArrow);

    nandi.traverse(c => { if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });
    scene3d.add(nandi);

    // Invisible collision volume — solid physics bounding box
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,3.8,8),
      new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(0, 2, 0);
    nandi.add(col);
    nandi.collider = col;
  }


  /* ── Cinematic Lighting ── */
  function buildLights(scene){
    // Rich deep sky: warm amber hemisphere
    const hemi = new THREE.HemisphereLight(0xff9944, 0x0a050f, 0.55);
    scene.add(hemi);

    // Primary sun — golden hour, Varanasi sunset
    const sun = new THREE.DirectionalLight(0xffcc66, 3.2);
    sun.position.set(120, 300, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);   // Ultra shadow resolution
    sun.shadow.camera.left   = -120;
    sun.shadow.camera.right  =  120;
    sun.shadow.camera.top    =  120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.camera.far    = 800;
    sun.shadow.bias          = -0.0003;
    sun.shadow.normalBias    =  0.02;
    scene.add(sun); mainSun = sun;

    // Blue-violet rim light from opposite side (atmospheric scatter)
    const rim = new THREE.DirectionalLight(0x3344cc, 0.6);
    rim.position.set(-80, 100, -200);
    scene.add(rim);

    // Ambient fill with warm orange bounce
    const fill = new THREE.AmbientLight(0x4a2808, 0.7);
    scene.add(fill);

    // Glow under Aether platform
    const aetherGlow = new THREE.PointLight(0xaa44ff, 3.5, 90);
    aetherGlow.position.set(-150, 10, 200);
    scene.add(aetherGlow);

    // Temple lava glow
    const lavaGlow = new THREE.PointLight(0xff3300, 4.0, 60);
    lavaGlow.position.set(300, 5, -50);
    scene.add(lavaGlow);
  }

  function tick(t, dt){
    particleAnimators.forEach(fn=>fn(t,dt));

    if(nandiMixer){
      nandiMixer.update(dt);
      if(nandiWalkAction){
        // Adjust animation speed based on movement speed
        const spd = nandi && nandi.userData ? nandi.userData.speed : 0;
        nandiWalkAction.timeScale = spd > 0.1 ? spd/16 : 0.0;
      }
    }

    // Nandi idle wander
    if(nandi && !nandi.userData.mounted){
      if(Math.random()<0.004) nandi.userData.targetYaw = nandi.rotation.y + (Math.random()-0.5)*1.5;
      nandi.rotation.y += (nandi.userData.targetYaw - nandi.rotation.y) * dt * 0.7;
      nandi.userData.speed = 1.2;
      nandi.position.addScaledVector(
        new THREE.Vector3(-Math.sin(nandi.rotation.y),0,-Math.cos(nandi.rotation.y)), 
        nandi.userData.speed*dt
      );
      nandi.position.y = Math.max(0, nandi.userData.baseY);
    }
    // Pulse the ride arrow
    if(nandi && nandi.rideArrow){
      const show = !nandi.userData.mounted;
      nandi.rideArrow.visible = show;
      if(show) nandi.rideArrow.position.y = 7.2 + Math.sin(t*3)*0.4; // bob up/down
    }

    // Stone float animation
    stones.forEach(s=>{
      if(s.userData.collected) return;
      s.rotation.y=t*1.5; s.rotation.x=Math.sin(t*.7)*.2;
      s.position.y=s.userData.baseY+Math.sin(t*1.7)*.38;
      if(s.userData.glow){ s.userData.glow.position.copy(s.position); }
    });

    if(templePortal){
      templePortal.rotation.y=t*.5;
      const sc=Save.get().stonesCollected;
      templePortal.material.opacity=sc===5?(.55+.3*Math.sin(t*3)):(.15+.05*Math.sin(t*2));
      if(sc===5) templePortal.scale.setScalar(1.08+.07*Math.sin(t*4));
    }
  }

  // Public
  return {
    init,
    getGroundMeshes: ()=>groundMeshes,
    getSolidMeshes:  ()=>solidMeshes,
    getStones:       ()=>stones,
    getNandi:        ()=>nandi,
    getMainSun:      ()=>mainSun,
    tick
  };
})();
