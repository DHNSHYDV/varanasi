/* scripts/world.js - Procedural 5 Regions, Solid Bodies, Nandi Ox */
'use strict';

const World = (() => {
  let scene3d, groundMeshes=[], solidMeshes=[], stones=[], particleAnimators=[], templePortal=null;
  let nandi=null, nandiMixer=null, nandiWalkAction=null, sky=null;
  let mainSun=null, fbxAssets={}, treeInstances = [], treeSpots = [], sunPos=new THREE.Vector3();
  const TREES_LIMIT = 600; // Super dense for high resources
  const texLoader = new THREE.TextureLoader();

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
    
    // ── Pre-load High-End FBX Assets with Proper Textures ──
    const fbxLoader = new THREE.FBXLoader();
    fbxLoader.setPath('assets/trees/realistic/');
    fbxLoader.load('TREE.fbx', model => {
      model.traverse(c=>{if(c.isMesh) { c.material.roughness=0.9; c.castShadow=true; c.receiveShadow=true;}});
      initTreeInstance(model, 0.075, 0); // Type 0: Realistic
    });

    fbxLoader.setPath('assets/trees/free/');
    fbxLoader.load('Free Pack - Tree.fbx', model => {
      initTreeInstance(model, 0.02, 1); // Type 1: Free Pack
    });

    fbxLoader.setPath('assets/temples/angkor/');
    fbxLoader.load('AnkorWat.fbx', m => { 
      m.traverse(c=>{if(c.isMesh) { c.material.map=texLoader.load('assets/temples/angkor/AngkorWatTex.jpg'); c.castShadow=true; }});
      fbxAssets['angkor']=m; buildBurningTemple(300,-50); 
    });

    fbxLoader.setPath('assets/temples/forgotten/');
    fbxLoader.load('Forgotten Temple.fbx', m => { 
      fbxAssets['forgotten']=m; buildAetherRealm(-150,200); 
    });

    buildJungle(0,0);
    buildRivergats(80,-60);   // Compressed
    buildBurningTemple(180,-30); 
    buildMountains(260,80);  
    buildAetherRealm(-90,110);
    buildNandi();
    buildSky(scene3d);
    addWorldBoundaries();
    buildWorldPaths();
    addDustParticles();
    addWorldDensity();
  }

  function addWorldDensity(){
    const grassGeo = new THREE.PlaneGeometry(0.5, 0.8);
    const grassMat = new THREE.MeshStandardMaterial({color:0x2d4020, side:THREE.DoubleSide, roughness:1.0});
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, 4000);
    const rockGeo = new THREE.SphereGeometry(0.5, 6, 4);
    const rockMat = new THREE.MeshStandardMaterial({color:0x776655, roughness:0.8});
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, 500);
    
    const dummy = new THREE.Object3D();
    for(let i=0; i<4000; i++){
      const x = (Math.random()-0.5)*600 + 150;
      const z = (Math.random()-0.5)*400;
      dummy.position.set(x, 0.4, z); dummy.rotation.y=Math.random()*Math.PI;
      dummy.scale.setScalar(0.8+Math.random()*0.8); dummy.updateMatrix();
      grassInst.setMatrixAt(i, dummy.matrix);
    }
    for(let i=0; i<500; i++){
      const x = (Math.random()-0.5)*600 + 150;
      const z = (Math.random()-0.5)*400;
      dummy.position.set(x, 0.1, z); dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.scale.set(1+Math.random(), 0.5+Math.random()*0.5, 1+Math.random()); dummy.updateMatrix();
      rockInst.setMatrixAt(i, dummy.matrix);
    }
    scene3d.add(grassInst, rockInst);
  }

  function buildSky(scene){
    sky = new THREE.Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);
    mainSun = new THREE.DirectionalLight(0xffffff, 2.5);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.set(2048, 2048);
    scene.add(mainSun);
  }

  function buildWorldPaths(){
    const pathMat = new THREE.MeshStandardMaterial({color:0x4d3828, roughness:1.0});
    // Link paths between major settlements
    const pts = [[0,0, 80,-60],[80,-60, 180,-30],[180,-30, 260,80],[0,0, -90,110]];
    pts.forEach(([x1,z1, x2,z2])=>{
      const dx=x2-x1, dz=z2-z1, len=Math.sqrt(dx*dx+dz*dz);
      const mx=(x1+x2)/2, mz=(z1+z2)/2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 8), pathMat);
      p.position.set(mx, 0.05, mz); p.rotation.x=-Math.PI/2; p.rotation.z=Math.atan2(dz,dx);
      p.receiveShadow=true; scene3d.add(p);
    });
  }

  function initTreeInstance(model, scale, index){
    // Find the primary mesh for instancing (trees usually have one mesh or we merge them)
    let mesh = null;
    model.traverse(c=>{ if(c.isMesh) mesh = c; });
    if(!mesh) return;

    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, 800);
    inst.castShadow = true; inst.receiveShadow = true;
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    
    let count = 0;
    const dummy = new THREE.Object3D();
    treeSpots.forEach(s => {
      if(s.type === index){
        dummy.position.set(s.x, 0, s.z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.scale.setScalar(scale * (0.8 + Math.random()*0.4));
        dummy.updateMatrix();
        inst.setMatrixAt(count++, dummy.matrix);
      }
    });
    inst.count = count;
    scene3d.add(inst);
  }

  function addDustParticles(){
    const geo = new THREE.BufferGeometry();
    const count = 3000, pos = new Float32Array(count*3);
    for(let i=0; i<count; i++){ pos[i*3]=(Math.random()-0.5)*150; pos[i*3+1]=Math.random()*40; pos[i*3+2]=(Math.random()-0.5)*150; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const mat = new THREE.PointsMaterial({color:0x998877, size:0.12, transparent:true, opacity:0.35});
    const pts = new THREE.Points(geo, mat); pts.name="dust"; 
    scene3d.add(pts);
    particleAnimators.push((t,dt)=>{
      const arr = pts.geometry.attributes.position.array;
      for(let i=0; i<count; i++){ 
         arr[i*3+1] -= dt*0.3; // fall slow
         if(arr[i*3+1]<0) arr[i*3+1]=40;
      }
      pts.geometry.attributes.position.needsUpdate=true;
    });
  }

  function addWorldBoundaries(){
    const bMat = new THREE.MeshStandardMaterial({visible:false});
    const bounds = [
      {p:[115,10,-310], s:[600,40,10]}, // North
      {p:[115,10,310],  s:[600,40,10]}, // South
      {p:[490,10,0],    s:[10,40,620]}, // East
      {p:[-90,10,0],    s:[10,40,620]}  // West
    ];
    bounds.forEach(b => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(...b.s), bMat);
      g.position.set(...b.p);
      scene3d.add(g); solidMeshes.push(g);
    });
  }

  /* ─── Tree helper: Pre-loaded FBX tree clone with collision ─── */
  function addTree(x,z){
    const type = Math.random() > 0.6 ? 1 : 0;
    treeSpots.push({x, z, type});
    
    // Invisible high-fidelity collider
    const col=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,15,8),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x, 7.5, z); scene3d.add(col); solidMeshes.push(col);
  }

  /* ─── New: High-End Water Reflector ─── */
  function addWater(cx, cz, w, d){
    const mirror = new (THREE.Reflector || THREE.Mesh)(new THREE.PlaneGeometry(w, d), {
      clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x223344
    });
    mirror.position.set(cx, 0.05, cz);
    mirror.rotation.x = -Math.PI/2;
    scene3d.add(mirror);
  }

  /* ─── Rock helper ─── */
  function addRock(x,y,z,s=1.8){
    const rock=mkSphere(s,0x776655);
    rock.scale.set(1+(Math.random()*.5),0.7+Math.random()*.4,1+(Math.random()*.5));
    // Normalize to 1.8u base size scaling
    rock.scale.multiplyScalar(0.85);
    rock.position.set(x,y,z); scene3d.add(rock);
    const col=new THREE.Mesh(new THREE.SphereGeometry(s*1.1,6,4),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x,y,z); scene3d.add(col); solidMeshes.push(col);
  }

  /* ─── Temple pillar helper ─── */
  function addPillar(x,y,z){
    const p=mkCyl(0.5,0.6,6.2,8,0x888070); p.position.set(x,y+3.1,z); scene3d.add(p);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,6.2,6),new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(x,y+3.1,z); scene3d.add(col); solidMeshes.push(col);
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
    // Dynamic River Reflector — high resources
    addWater(cx, cz - 10, 160, 120);
    createStone('water', cx, 5, cz-30, 0x00aaff);
  }

  /* ── 3. BURNING TEMPLE (Fire) ── */
  function buildBurningTemple(cx,cz){
    const ground=mkBox(140,4,140,0x3d1a0e,1,0); ground.position.set(cx,-2,cz); scene3d.add(ground); addGround(ground);
    // ── HIGH-END TEMPLE 1: Angkor Wat ──
    if(fbxAssets['angkor']){
      const temple = fbxAssets['angkor'].clone();
      temple.position.set(cx, 0, cz);
      temple.scale.setScalar(0.045);
      scene3d.add(temple);
      // Main collision core
      const base = mkBox(30, 15, 30, 0, 0, 0); base.position.set(cx, 7.5, cz); 
      base.visible = false; scene3d.add(base); solidMeshes.push(base);
    } else {
      const templeBase=mkBox(44,12,44,0x222222); templeBase.position.set(cx,6,cz); scene3d.add(templeBase); solidMeshes.push(templeBase);
      const tTop=mkCyl(0,22,28,4,0x1a1a1a); tTop.position.set(cx,26,cz); scene3d.add(tTop); solidMeshes.push(tTop);
    }
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
    // ── HIGH-END TEMPLE 2: Forgotten Temple ──
    if(fbxAssets['forgotten']){
      const temple = fbxAssets['forgotten'].clone();
      temple.position.set(cx, 0, cz);
      temple.scale.setScalar(0.015);
      scene3d.add(temple);
      const core = mkBox(20, 10, 20, 0, 0, 0); core.position.set(cx, 5, cz);
      core.visible = false; scene3d.add(core); solidMeshes.push(core);
    }
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
    nandi.position.set(12, 0, -5); 
    nandi.userData = { baseY:0, hp:600, maxHp:600, mounted:false, speed:0, targetYaw:Math.PI, dist:0, bodyRoll:0, bodyPitch:0 };

    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load('models/Horse.glb', gltf => {
      const model = gltf.scene;
      model.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; c.material = new THREE.MeshStandardMaterial({color:0x050505, roughness:0.25}); } });
      model.scale.setScalar(0.011); nandi.add(model); nandi.model = model;
      if(gltf.animations.length > 0){ nandiMixer = new THREE.AnimationMixer(model); nandiWalkAction = nandiMixer.clipAction(gltf.animations[0]); nandiWalkAction.play(); }
    });
    nandi.rideArrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), new THREE.MeshBasicMaterial({color:0x00ffcc}));
    nandi.rideArrow.position.set(0, 5, 0); nandi.rideArrow.rotation.z = Math.PI;
    nandi.add(nandi.rideArrow); scene3d.add(nandi);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,3.8,8), new THREE.MeshStandardMaterial({visible:false}));
    col.position.set(0, 2, 0); nandi.add(col); nandi.collider = col;
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

    // ── Nandi Procedural Animation (legs + idle sway) ──
    if(nandi && nandi.model){
      const spd = Math.abs(nandi.userData.speed || 0);
      const mounted = nandi.userData.mounted;

      // Advance the skeletal mixer if it exists (some GLTF have anims)
      if(nandiMixer) nandiMixer.update(dt);

      // ─ PROCEDURAL LEG SWING ─
      // Walk through all child meshes of the model and find leg-like names
      const gaitFreq = spd > 0.5 ? spd * 0.55 : (mounted ? 0 : 0.6); // idle subtle
      const gaitAmp  = spd > 0.5 ? 0.55 : 0.04;
      let legIdx = 0;
      nandi.model.traverse(child => {
        if(!child.isMesh) return;
        const n = child.name.toLowerCase();
        const isLeg = n.includes('leg') || n.includes('thigh') || n.includes('shin')
                   || n.includes('foot') || n.includes('hoof') || n.includes('knee')
                   || n.includes('calf');
        if(isLeg){
          // Alternate front/back legs in opposite phase
          const phase = (legIdx % 2 === 0) ? 0 : Math.PI;
          child.rotation.x = Math.sin(t * gaitFreq + phase) * gaitAmp;
          legIdx++;
        }
        // Head nod
        if(n.includes('head') || n === 's'){
          child.rotation.x = Math.sin(t * (gaitFreq*0.5 + 0.5)) * (spd > 0.5 ? 0.05 : 0.015);
        }
        // Tail sway
        if(n.includes('tail')){
          child.rotation.z = Math.sin(t * 1.8) * 0.18;
        }
      });

      // ─ IDLE BREATHING (body scale pulse) only when still ─
      if(!mounted && spd < 0.1){
        const breathe = 1 + Math.sin(t * 1.4) * 0.008;
        nandi.model.scale.set(1.4 * breathe, 1.4, 1.4 / breathe);
      } else {
        nandi.model.scale.setScalar(1.4);
      }
    }

    // ── Bull stays STILL when not mounted ──
    // (no idle wander — bull waits for the player to mount it)

    // Pulse the ride arrow
    if(nandi && nandi.rideArrow){
      const show = !nandi.userData.mounted;
      nandi.rideArrow.visible = show;
      if(show) nandi.rideArrow.position.y = 4.5 + Math.sin(t*3)*0.35;
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

  function updateSky(t){
    if(!sky) return;
    const elevation = 5 + Math.sin(t*0.05) * 45;
    const azimuth = 180 + t*0.02;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const pos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms['sunPosition'].value.copy(pos);
    if(mainSun) mainSun.position.copy(pos).multiplyScalar(400);
    if(window.UI && UI.setTemp) UI.setTemp(Math.floor(22 + elevation*0.5));
  }

  function wrappedTick(t, dt){
    updateSky(t);
    tick(t, dt);
  }

  // Public
  return {
    init,
    getGroundMeshes: ()=>groundMeshes,
    getSolidMeshes:  ()=>solidMeshes,
    getStones:       ()=>stones,
    getNandi:        ()=>nandi,
    getMainSun:      ()=>mainSun,
    tick: wrappedTick
  };
})();
