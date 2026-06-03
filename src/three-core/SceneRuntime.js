import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export default class SceneRuntime {
  constructor ({ container, config, mode, onEvent, options }) {
    this.container = container
    this.config = config
    this.mode = mode
    this.options = options || {}
    this.onEvent = onEvent || (() => {})
    this.clock = new THREE.Clock()

    this.sceneStack = []
    this.nodes = new Map()
    this.devices = new Map()
    this.clickables = []
    this.animations = new Map()

    // Tour state
    this.tour = { active: false, index: 0, wait: 0, paused: false }

    // Follow state (robot mode)
    this.followMode = false
    this.followCamPos = null
    this.followCamTar = null

    // Camera fly state
    this.fly = null

    // --- Scene setup ---
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x020811, 96, 310)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x020811, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.domElement.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'
    container.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = false

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this.layers = {}
    ;['base', 'device', 'label', 'route', 'alarm', 'effect'].forEach(k => {
      this.layers[k] = new THREE.Group()
      this.scene.add(this.layers[k])
    })

    this.scene.add(new THREE.AmbientLight(0xb7f8ff, 0.82))
    const dl = new THREE.DirectionalLight(0xffffff, 1.25)
    dl.position.set(80, 130, 70)
    this.scene.add(dl)
    const pl = new THREE.PointLight(0x00f5ff, 4, 180)
    pl.position.set(0, 48, 0)
    this.scene.add(pl)

    // --- Event bindings ---
    this.pick = this.pick.bind(this)
    this.resize = this.resize.bind(this)
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onWheel = this.onWheel.bind(this)

    this.renderer.domElement.addEventListener('pointerdown', this.pick)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.addEventListener('wheel', this.onWheel)
    window.addEventListener('resize', this.resize)
    this.resize()
  }

  /* ========== Lifecycle ========== */

  start (sceneId) {
    this.sceneStack = [sceneId]
    this.loadScene(sceneId, true)
    this.running = true
    this.loop()
  }

  dispose () {
    this.running = false
    cancelAnimationFrame(this.raf)
    clearTimeout(this.resumeTimer)
    window.removeEventListener('resize', this.resize)
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.pick)
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
      this.renderer.domElement.removeEventListener('wheel', this.onWheel)
    }
    this.clearScene()
    this.controls.dispose()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }

  /* ========== Event handlers ========== */

  emit (type, payload) {
    this.onEvent({ type, ...payload })
  }

  onPointerDown () {
    // User drags → pause tour + exit follow, hand control to OrbitControls
    if (this.tour.active) {
      this.tour.paused = true
      clearTimeout(this.resumeTimer)
      this.resumeTimer = setTimeout(() => { this.tour.paused = false }, 10000)
    }
    if (this.followMode) {
      this.followMode = false
    }
  }

  onWheel () {
    if (this.tour.active) {
      this.tour.paused = true
      clearTimeout(this.resumeTimer)
      this.resumeTimer = setTimeout(() => { this.tour.paused = false }, 10000)
    }
  }

  /* ========== Command dispatch ========== */

  execute (cmd) {
    if (!cmd) return
    switch (cmd.type) {
      case 'FOCUS_PRESET': this.focusPreset(cmd.preset); break
      case 'FOCUS_NODE': this.focusNode(cmd.nodeId); break
      case 'DRILL_TO': this.drillTo(cmd.sceneId, cmd.fromNodeId); break
      case 'BACK_SCENE': this.backScene(); break
      case 'SHOW_ALARM': this.showAlarm(cmd.deviceId || cmd.nodeId); break
      case 'START_TOUR': this.startTour(); break
      case 'STOP_TOUR': this.stopTour(); break
      case 'FOLLOW_ROBOT': this.startFollow(); break
    }
  }

  /* ========== Core loop ========== */

  loop () {
    if (!this.running) return
    this.raf = requestAnimationFrame(() => this.loop())
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = performance.now() / 1000

    this.updateRobot(dt)
    this.updateTour(dt)
    this.updateFly(dt)
    this.controls.update()
    this.followUpdate()
    this.clampCamera()
    this.animations.forEach(fn => fn(t, dt))
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  /* ========== Scene management ========== */

  resize () {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  clearScene () {
    Object.values(this.layers).forEach(g => {
      while (g.children.length) {
        this.disposeObject(g.children[0])
        g.remove(g.children[0])
      }
    })
    this.nodes.clear()
    this.devices.clear()
    this.clickables = []
    this.animations.clear()
  }

  disposeObject (o) {
    if (!o) return
    if (o.element?.parentNode) {
      o.element.parentNode.removeChild(o.element)
    }
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.())
    }
    if (o.children) {
      o.children.slice().forEach(c => this.disposeObject(c))
    }
  }

  loadScene (sceneId, instant) {
    const cfg = this.config.scenes[sceneId]
    if (!cfg) return
    this.clearScene()
    this.followMode = false
    this.fly = null
    this.currentSceneId = sceneId
    this.currentConfig = cfg
    this.applyControls(cfg.controls)

    if (this.mode === 'robot') {
      this.buildRobot(cfg)
    } else {
      cfg.type === 'floor' ? this.buildIotFloor(cfg) : this.buildIotPark(cfg)
    }

    const p = cfg.cameraPresets.default
    if (p) this.flyTo(p.position, p.target, instant ? 0.01 : 1.2)
    this.emit('scene-change', { title: cfg.title, sceneId })
  }

  applyControls (c = {}) {
    this.controls.minDistance = c.minDistance || 36
    this.controls.maxDistance = c.maxDistance || 180
    this.controls.maxPolarAngle = Math.PI / 2.08
  }

  /* ========== Building helpers ========== */

  mat (color, opacity = 0.78, emissive = 0x00384c) {
    return new THREE.MeshStandardMaterial({
      color, transparent: true, opacity,
      roughness: 0.46, metalness: 0.22, emissive, emissiveIntensity: 0.5
    })
  }

  edges (mesh, color = 0x00eaff, opacity = 0.7) {
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    ))
  }

  label (text, alarm) {
    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText = `color:#eaffff;font-size:13px;white-space:nowrap;background:${alarm ? 'rgba(70,18,20,.88)' : 'rgba(1,26,36,.84)'};border:1px solid ${alarm ? 'rgba(255,85,79,.75)' : 'rgba(0,245,255,.62)'};padding:5px 10px;box-shadow:0 0 14px rgba(0,245,255,.3);pointer-events:none`
    return new CSS2DObject(el)
  }

  ring (radius, color = 0x00f5ff) {
    const g = new THREE.Group()
    const r = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.64, radius, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
    )
    r.rotation.x = -Math.PI / 2
    g.add(r)
    g.userData.update = t => { r.rotation.z = t * 0.6 }
    return g
  }

  addClickable (object, meta, bucket) {
    object.userData.meta = meta
    this.clickables.push(object)
    if (bucket === 'device') {
      this.devices.set(meta.id, { object, meta })
    } else {
      this.nodes.set(meta.id, { object, meta })
    }
  }

  /* ========== IOT Park scene ========== */

  buildIotPark (cfg) {
    this.addGrid(210)
    this.addRoads()
    cfg.buildings.forEach(b => this.createBuilding(b))
    cfg.devices.forEach(d => this.createDevice(d))
  }

  buildIotFloor (cfg) {
    this.addGrid(145, 150, 96)
    cfg.rooms.forEach(r => this.createRoom(r, cfg.title))
    cfg.devices.forEach(d => this.createDevice(d))
    const walls = [[-74,0,1,92],[74,0,1,92],[0,-47,148,1],[0,47,148,1],[18,-14,94,1],[18,14,94,1]]
    walls.forEach(w => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 5.6, w[3]), this.mat(0x244b5a, 0.34, 0x002b34))
      m.position.set(w[0], 2.8, w[1])
      this.layers.base.add(m)
    })
  }

  addGrid (size, w = 220, h = 220) {
    const grid = new THREE.GridHelper(size, 40, 0x00ffff, 0x0b4050)
    grid.material.transparent = true
    grid.material.opacity = 0.2
    this.layers.base.add(grid)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat(0x071520, 0.96, 0))
    ground.rotation.x = -Math.PI / 2
    this.layers.base.add(ground)
  }

  addRoads () {
    const roads = [[0,8,172,12],[36,-10,12,128],[-46,25,84,9],[64,40,58,9]]
    roads.forEach(r => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(r[2], r[3]),
        new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
      )
      m.rotation.x = -Math.PI / 2
      m.position.set(r[0], 0.1, r[1])
      this.layers.base.add(m)
    })
  }

  createBuilding (b) {
    const g = new THREE.Group()
    const [px, py, pz] = b.position
    g.position.set(px, py, pz)

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(...b.size),
      this.mat(b.alarm ? 0x351719 : 0x0c4d67, 0.78, b.alarm ? 0x401010 : 0x00384c)
    )
    body.position.y = b.size[1] / 2
    this.edges(body, b.alarm ? 0xff554f : 0x00eaff)
    g.add(body)

    const lab = this.label(b.title, b.alarm)
    lab.position.set(0, b.size[1] + 9, 0)
    g.add(lab)

    const rg = this.ring(b.alarm ? 11 : 9, b.alarm ? 0xff554f : 0x00f5ff)
    rg.position.set(px, 0.12, pz)
    this.layers.effect.add(rg)
    this.animations.set(`ring_${b.id}`, t => rg.userData.update(t))

    const meta = {
      ...b,
      type: '楼栋 / 区域',
      location: '智慧物业园区',
      action: 'drill',
      desc: '点击后切换到楼层内部视角，展示设备点位。',
      camera: {
        position: [px + 38, 38, pz + 44],
        target: [px, 8, pz]
      }
    }

    this.layers.base.add(g)
    this.addClickable(g, meta)
  }

  createRoom (r, sceneTitle) {
    const g = new THREE.Group()
    const [rx, rz] = r.position

    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(r.size[0], r.size[1]),
      new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: r.alarm ? 0.22 : 0.18, side: THREE.DoubleSide })
    )
    p.rotation.x = -Math.PI / 2
    p.position.set(rx, 0.2, rz)

    const bd = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(r.size[0], 0.18, r.size[1])),
      new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.72 })
    )
    bd.position.set(rx, 0.34, rz)
    g.add(p, bd)

    const lab = this.label(r.title, r.alarm)
    lab.position.set(rx, 5.4, rz)
    this.layers.label.add(lab)

    const meta = {
      ...r,
      type: '楼层房间 / 区域',
      location: sceneTitle,
      status: r.alarm ? '存在异常' : '正常',
      desc: '楼层内部区域，可查看房间设备点位、告警、视频与工单。',
      camera: {
        position: [rx + 18, 34, rz + 22],
        target: [rx, 0, rz]
      }
    }

    this.layers.base.add(g)
    this.addClickable(g, meta)
  }

  createDevice (d) {
    const g = new THREE.Group()
    const [dx, dy, dz] = d.position
    g.position.set(dx, dy, dz)

    const c = d.alarm ? 0xff554f : 0x00f5ff
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 32, 16),
      new THREE.MeshStandardMaterial({
        color: c, emissive: c,
        emissiveIntensity: d.alarm ? 1.7 : 1.05,
        transparent: true, opacity: 0.92
      })
    )

    const lab = this.label(`${d.icon || '●'} ${d.title}`, d.alarm)
    lab.position.set(0, 6.2, 0)
    g.add(ball, lab)
    this.layers.device.add(g)

    const meta = {
      ...d,
      desc: d.alarm ? '设备异常，支持联动视频、派单、复位与趋势查看。' : '设备在线，运行状态正常。',
      camera: {
        position: [dx + 20, dy + 20, dz + 22],
        target: [dx, dy, dz]
      }
    }
    this.addClickable(g, meta, 'device')
    this.animations.set(`dev_${d.id}`, t => {
      ball.scale.setScalar(1 + Math.sin(t * (d.alarm ? 7 : 3)) * (d.alarm ? 0.22 : 0.08))
    })
  }

  /* ========== Robot scene ========== */

  buildRobot (cfg) {
    this.addGrid(178, 182, 116)
    cfg.rooms.forEach(r => this.createRobotRoom(r))
    this.createRobotPath(cfg.waypoints)
    this.createRobot()
  }

  createRobotRoom (r) {
    const g = new THREE.Group()
    const [rx, rz] = r.position

    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(r.size[0], r.size[1]),
      new THREE.MeshBasicMaterial({
        color: r.color, transparent: true,
        opacity: r.status === '执行中' ? 0.32 : 0.17,
        side: THREE.DoubleSide
      })
    )
    p.rotation.x = -Math.PI / 2
    p.position.set(rx, 0.18, rz)
    g.add(p)

    const lab = this.label(r.title)
    lab.position.set(rx, 5.4, rz)
    this.layers.label.add(lab)

    const meta = {
      ...r,
      type: '清洁区域',
      location: '3F',
      desc: '机器人在该区域按清洁策略执行任务，确保覆盖质量。',
      camera: {
        position: [rx + 22, 38, rz + 30],
        target: [rx, 0, rz]
      }
    }
    this.layers.base.add(g)
    this.addClickable(g, meta)
  }

  createRobotPath (wps) {
    this.waypoints = wps.map(p => ({
      ...p,
      vector: new THREE.Vector3(...p.position)
    }))

    const curve = new THREE.CatmullRomCurve3(
      this.waypoints.map(p => p.vector),
      false, 'catmullrom', 0.16
    )
    this.layers.route.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(240)),
      new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.8 })
    ))

    // Animated dots along the path
    for (let i = 0; i < 16; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x8fffff, transparent: true, opacity: 0.75 })
      )
      this.layers.route.add(dot)
      this.animations.set(`dot_${i}`, ((idx) => t => {
        const u = (idx / 16 + t * 0.025) % 1
        dot.position.copy(curve.getPoint(u))
        dot.position.y = 1.65
      })(i))
    }
  }

  createRobot () {
    const robot = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 5.1, 2.8, 40),
      new THREE.MeshStandardMaterial({ color: 0xeaf3f3, roughness: 0.48, metalness: 0.18, emissive: 0x123445, emissiveIntensity: 0.18 })
    )
    body.position.y = 2.1

    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.2, 1.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x0d1118, emissive: 0x00eaff, emissiveIntensity: 0.35 })
    )
    head.position.y = 4.35

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff })
    )
    front.position.set(0, 2.3, 5.1)

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(7, 32, 14),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.1, wireframe: true })
    )
    halo.position.y = 2.6

    const lab = this.label('GX-001')
    lab.position.set(0, 9.2, 0)

    robot.add(body, head, front, halo, lab)
    robot.position.copy(this.waypoints[0].vector)
    this.layers.device.add(robot)
    this.robot = robot

    this.motion = {
      index: 0, progress: 0, dwell: 0,
      speed: this.options.robotSpeed || 7,
      dwellScale: this.options.dwellScale || 1,
      paused: false
    }

    this.animations.set('halo', t => {
      halo.scale.setScalar(1 + Math.sin(t * 4.2) * 0.1)
    })

    this.addClickable(robot, {
      id: 'robot',
      title: 'GX-001 高仙拖地机器人',
      type: '清洁机器人',
      location: '3F 公共走廊',
      status: '执行中',
      desc: '机器人按规划路径执行清洁任务，重点区域自动停留深度清洁。',
      camera: { position: [28, 34, 34], target: [34, 2, -6] }
    }, 'device')
  }

  updateRobot (dt) {
    if (!this.robot || !this.motion || this.motion.paused) return

    const cur = this.waypoints[this.motion.index]
    const ni = (this.motion.index + 1) % this.waypoints.length
    const nxt = this.waypoints[ni]

    if (this.motion.dwell > 0) {
      this.motion.dwell -= dt
      this.emit('robot-state', {
        title: cur.name,
        dwellLeft: Math.max(0, this.motion.dwell),
        currentSpeed: 0
      })
      this.robot.rotation.y += Math.sin(performance.now() / 1000 * 1.4) * 0.002
      return
    }

    const dis = cur.vector.distanceTo(nxt.vector)
    this.motion.progress += (this.motion.speed * dt) / Math.max(dis, 1)

    if (this.motion.progress >= 1) {
      this.motion.index = ni
      this.motion.progress = 0
      this.motion.dwell = (nxt.dwell || 3) * this.motion.dwellScale
      this.emit('robot-dwell', { title: `机器人停留清洁：${nxt.name}` })
      return
    }

    const pos = cur.vector.clone().lerp(nxt.vector, this.motion.progress)
    const look = pos.clone().lerp(nxt.vector, 0.2)
    this.robot.position.copy(pos)
    this.robot.lookAt(look.x, look.y, look.z)

    const total = this.waypoints.length - 1
    const progress = Math.min(99, ((this.motion.index + this.motion.progress) / total) * 100)
    this.emit('robot-state', {
      title: cur.name,
      progress,
      currentSpeed: this.motion.speed,
      battery: Math.max(62, Math.round(76 - progress * 0.08))
    })
  }

  /* ========== Follow mode (robot) ========== */

  startFollow () {
    this.followMode = true
    this.fly = null
    if (this.robot) {
      const dir = this.getRobotBackDir()
      this.followCamPos = this.robot.position.clone().add(dir.clone().multiplyScalar(28))
      this.followCamPos.y += 20
      this.followCamTar = this.robot.position.clone()
      this.followCamTar.y += 2
    }
  }

  stopFollow () {
    this.followMode = false
  }

  getRobotBackDir () {
    const yaw = this.robot ? this.robot.rotation.y : 0
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
  }

  followUpdate () {
    if (!this.followMode || !this.robot) return

    const dir = this.getRobotBackDir()
    const desired = this.robot.position.clone().add(dir.clone().multiplyScalar(28))
    desired.y += 20
    const desiredTar = this.robot.position.clone()
    desiredTar.y += 2

    if (!this.followCamPos) {
      this.followCamPos = desired.clone()
      this.followCamTar = desiredTar.clone()
    }

    // Camera lags slightly behind ideal for cinematic feel
    this.followCamPos.lerp(desired, 0.12)
    this.followCamTar.lerp(desiredTar, 0.25)

    this.camera.position.copy(this.followCamPos)
    this.controls.target.copy(this.followCamTar)
  }

  /* ========== Interactions ========== */

  pick (event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const hits = this.raycaster.intersectObjects(this.clickables, true)
    if (!hits.length) {
      this.emit('empty-click')
      return
    }

    let o = hits[0].object
    while (o && !o.userData.meta) o = o.parent
    if (!o) return

    const m = o.userData.meta
    if (m.camera) this.flyTo(m.camera.position, m.camera.target, 1)
    this.emit('select', {
      title: m.title,
      payload: m,
      pointer: { x: event.clientX - rect.left, y: event.clientY - rect.top }
    })
    if (m.action === 'drill') this.drillTo(m.drillSceneId, m.id)
  }

  /* ========== Camera ========== */

  flyTo (position, target, duration = 1.2) {
    // Any manual camera command exits follow mode
    this.followMode = false
    this.fly = {
      fromPos: this.camera.position.clone(),
      fromTar: this.controls.target.clone(),
      toPos: new THREE.Vector3(...position),
      toTar: new THREE.Vector3(...target),
      duration,
      elapsed: 0
    }
  }

  updateFly (dt) {
    if (!this.fly) return
    this.fly.elapsed += dt
    const p = Math.min(1, this.fly.elapsed / Math.max(this.fly.duration, 0.01))
    const e = easeInOutCubic(p)
    this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, e)
    this.controls.target.lerpVectors(this.fly.fromTar, this.fly.toTar, e)
    if (p >= 1) this.fly = null
  }

  clampCamera () {
    this.camera.position.y = Math.max(this.camera.position.y, 8)
    if (this.followMode) return
    const max = this.controls.maxDistance || 180
    const dist = this.camera.position.distanceTo(this.controls.target)
    if (dist > max + 4) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize()
      this.camera.position.copy(this.controls.target.clone().add(dir.multiplyScalar(max)))
    }
  }

  /* ========== Focus presets ========== */

  focusPreset (name) {
    // In robot mode, 'follow' triggers follow mode instead of flying to a fixed position
    if (this.mode === 'robot' && name === 'follow') {
      this.startFollow()
      return
    }
    const p = this.currentConfig.cameraPresets?.[name]
    if (p) this.flyTo(p.position, p.target, 1.2)
  }

  focusNode (id) {
    const item = this.nodes.get(id) || this.devices.get(id)
    if (item?.meta.camera) this.flyTo(item.meta.camera.position, item.meta.camera.target, 1.1)
  }

  /* ========== Scene navigation ========== */

  drillTo (sceneId, fromNodeId) {
    if (!sceneId) return
    if (this.sceneStack[this.sceneStack.length - 1] !== sceneId) {
      this.sceneStack.push(sceneId)
    }
    this.emit('drill-down', { title: `下钻：${sceneId}`, sceneId, fromNodeId })
    this.loadScene(sceneId)
  }

  backScene () {
    if (this.sceneStack.length > 1) this.sceneStack.pop()
    const id = this.sceneStack[this.sceneStack.length - 1]
    this.emit('back-scene', { title: `返回：${id}`, sceneId: id })
    this.loadScene(id)
  }

  /* ========== Alarm ========== */

  showAlarm (id) {
    const item = this.devices.get(id) ||
      [...this.devices.values()].find(v => v.meta.alarm) ||
      this.devices.get('robot')
    if (!item) return

    const s = new THREE.Mesh(
      new THREE.SphereGeometry(11, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xff554f, transparent: true, opacity: 0.24, wireframe: true })
    )
    this.layers.alarm.add(s)

    const key = `alarm_${item.meta.id || Date.now()}`
    const start = performance.now()
    const isRobot = item.meta.id === 'robot'
    const world = new THREE.Vector3()

    this.animations.set(key, t => {
      // If targeting the robot, follow its position every frame
      if (isRobot && this.robot) {
        this.robot.getWorldPosition(world)
        s.position.copy(world)
        s.position.y += 5
      } else {
        // Static device: set position once
        if (!s.userData.positioned) {
          item.object.getWorldPosition(world)
          s.position.copy(world)
          s.position.y += 4
          s.userData.positioned = true
        }
      }
      s.scale.setScalar(1 + Math.sin(t * 6.5) * 0.2)
      if (performance.now() - start > 9000) {
        this.layers.alarm.remove(s)
        this.animations.delete(key)
      }
    })

    if (item.meta.camera) this.flyTo(item.meta.camera.position, item.meta.camera.target, 1)
    this.emit('alarm', { title: item.meta.title, id: item.meta.id })
  }

  /* ========== Tour system ========== */

  startTour () {
    this.tour = { active: true, index: -1, wait: 0, paused: false }
    this.nextTour()
  }

  stopTour () {
    this.tour.active = false
    this.tour.paused = false
  }

  nextTour () {
    const steps = this.config.tours?.[this.currentSceneId] || []
    if (!steps.length) return
    this.tour.index = (this.tour.index + 1) % steps.length
    const step = steps[this.tour.index]
    this.execute(step.command)
    this.tour.wait = step.hold || 4
    this.emit('tour-view', { title: step.title })
  }

  updateTour (dt) {
    if (!this.tour.active || this.tour.paused) return
    this.tour.wait -= dt
    if (this.tour.wait <= 0) this.nextTour()
  }
}
