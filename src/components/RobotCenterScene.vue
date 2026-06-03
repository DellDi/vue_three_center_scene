<template>
  <div class="scene-panel" :style="{height}">
    <div class="head"><b>实时清洁轨迹</b><span>机器人在关键区域执行清洁任务，支持避障、覆盖与自动回充</span><div><i>任务 {{taskStatus}}</i><i>进度 {{progressText}}</i><i>电量 {{battery}}%</i></div></div>
    <div class="toolbar"><button @click="view('top')">楼层俯视</button><button @click="view('follow')">机器人跟随</button><button @click="view('charge')">充电区</button><button @click="togglePause">{{paused?'继续任务':'暂停任务'}}</button><button :class="{tour:1,active:tourActive}" @click="toggleTour">{{tourActive?'暂停导览':'自动导览'}}</button><button class="danger" @click="alarm">余量告警</button></div>
    <div ref="host" class="host"></div>
    <div v-show="tip.show" class="tip" :class="{alarm:tip.alarm}" :style="{left:tip.x+'px',top:tip.y+'px'}"><h4>{{tip.title}}</h4><p>类型：{{tip.type}}</p><p>位置：{{tip.location}}</p><p>状态：<em>{{tip.status}}</em></p><small>{{tip.desc}}</small></div>
    <div class="task"><h4>当前清洁节点</h4><strong>{{currentNodeName}}</strong><p><span>行驶速度</span><b>{{speedText}}</b></p><p><span>停留倒计时</span><b>{{dwellText}}</b></p><p><span>当前模式</span><b>{{paused?'暂停':taskStatus}}</b></p><div class="bar"><i :style="{width:progressText}"></i></div></div>
    <div class="hint">支持实时轨迹跟踪、关键区域停留清洁、自动回充与告警联动。</div>
  </div>
</template>

<script>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

var TOUR_WP = [
  {cam:[0,108,42],target:[0,0,0],hold:5,tr:2.5,title:'楼层俯视全景'},
  {cam:[-40,48,18],target:[-56,0,-28],hold:4,tr:3,title:'大堂前厅区域'},
  {cam:[28,34,34],target:[34,2,-6],hold:6,tr:3.5,title:'机器人跟随视角'},
  {cam:[72,46,64],target:[56,0,36],hold:4,tr:3,title:'充电区全景'},
  {cam:[54,42,8],target:[38,0,-6],hold:4,tr:3,title:'公共走廊区域'},
  {cam:[-18,52,48],target:[-38,0,28],hold:4,tr:3,title:'地下车库B1区域'},
  {cam:[-30,38,34],target:[12,0,28],hold:4,tr:3,title:'车库作业视角'},
  {cam:[0,108,42],target:[0,0,0],hold:5,tr:3.5,title:'楼层俯视全景'}
]

function easeInOutCubic (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

export default {
  name: 'RobotCenterScene',
  props: {
    height: { type: String, default: '620px' },
    robotSpeed: { type: Number, default: 6 },
    dwellScale: { type: Number, default: 1 },
    autoPlay: { type: Boolean, default: true },
    tourResumeDelay: { type: Number, default: 10000 }
  },
  data () {
    return {
      paused: false,
      taskStatus: '执行中',
      currentNodeName: '大堂前厅',
      battery: 76,
      progress: 0,
      currentSpeed: 0,
      dwellLeft: 0,
      tip: { show: false, x: 0, y: 0, title: '', type: '', location: '', status: '', desc: '', alarm: false },
      tourActive: false,
      tourPaused: false
    }
  },
  computed: {
    progressText () { return Math.max(0, Math.min(100, Math.round(this.progress))) + '%' },
    dwellText () { return this.dwellLeft > 0 ? this.dwellLeft.toFixed(1) + 's' : '行进中' },
    speedText () { return this.currentSpeed <= 0.05 ? '0.0 m/s' : (this.currentSpeed * 0.085).toFixed(1) + ' m/s' }
  },
  mounted () {
    this.init()
    this.build()
    this.loop()
    this.renderer.domElement.addEventListener('pointerdown', this.onUserInteract)
    this.renderer.domElement.addEventListener('wheel', this.onUserInteract)
    window.addEventListener('resize', this.resize)
    if (this.autoPlay) this.tourTimeout = setTimeout(() => this.startTour(), 3000)
  },
  beforeDestroy () {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.tourTimeout)
    window.removeEventListener('resize', this.resize)
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onUserInteract)
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
      this.renderer.domElement.removeEventListener('wheel', this.onUserInteract)
    }
    this.renderer && this.renderer.dispose()
    if (this.$refs.host) this.$refs.host.innerHTML = ''
  },
  methods: {
    init () {
      this.scene = new THREE.Scene()
      this.scene.fog = new THREE.Fog(0x020811, 96, 260)
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500)
      this.camera.position.set(0, 108, 42)
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
      this.renderer.setClearColor(0x020811, 1)
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
      this.$refs.host.appendChild(this.renderer.domElement)
      this.labels = new CSS2DRenderer()
      this.labels.domElement.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'
      this.$refs.host.appendChild(this.labels.domElement)
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.08
      this.controls.target.set(0, 0, 0)
      this.controls.minDistance = 34
      this.controls.maxDistance = 145
      this.controls.maxPolarAngle = Math.PI / 2.12
      this.controls.screenSpacePanning = false
      this.raycaster = new THREE.Raycaster()
      this.pointer = new THREE.Vector2()
      this.clicks = []
      this.anims = []
      this.motion = { index: 0, progress: 0, dwell: 0 }
      this.clock = new THREE.Clock()
      this.scene.add(new THREE.AmbientLight(0xb7f8ff, 0.82))
      var dl = new THREE.DirectionalLight(0xffffff, 1.2)
      dl.position.set(80, 130, 70)
      this.scene.add(dl)
      var pl = new THREE.PointLight(0x00f5ff, 4, 160)
      pl.position.set(0, 44, 0)
      this.scene.add(pl)
      // tour state (non-reactive instance vars)
      this.tourIdx = 0
      this.tourT = 0
      this.tourWait = 0
      this.tourFromCam = null
      this.tourFromTar = null
      this.tourToCam = null
      this.tourToTar = null
      this.followMode = false
      this.followDesiredCam = null
      this.followDesiredTar = null
      this.resize()
      this.renderer.domElement.addEventListener('pointerdown', this.pick)
      this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    },
    onPointerDown () {
      // User drags the scene → exit follow, hand control back to OrbitControls
      this.followMode = false
    },

    /* ---------- Tour system ---------- */
    onUserInteract () {
      if (!this.tourActive) return
      this.tourPaused = true
      this.controls.enabled = true
      this.targetCam = null
      clearTimeout(this.tourTimeout)
      this.tourTimeout = setTimeout(() => { this.tourPaused = false }, this.tourResumeDelay)
    },
    toggleTour () { this.tourActive ? this.stopTour() : this.startTour() },
    stopTour () {
      this.tourActive = false
      this.tourPaused = true
      this.controls.enabled = true
      this.targetCam = null
      clearTimeout(this.tourTimeout)
    },
    startTour () {
      this.tourActive = true
      this.tourPaused = false
      this.tourT = 0
      this.tourWait = 0
      this.tourIdx = 0
      this.followMode = false
      this.controls.enabled = false
      this.targetCam = null
      var w = TOUR_WP[0]
      this.tourFromCam = this.camera.position.clone()
      this.tourFromTar = this.controls.target.clone()
      this.tourToCam = new THREE.Vector3(w.cam[0], w.cam[1], w.cam[2])
      this.tourToTar = new THREE.Vector3(w.target[0], w.target[1], w.target[2])
      this.$emit('scene-event', { type: 'tour-view', title: w.title })
    },
    beginTourStep (w) {
      this.tourFromCam = this.camera.position.clone()
      this.tourFromTar = this.controls.target.clone()
      this.tourToCam = new THREE.Vector3(w.cam[0], w.cam[1], w.cam[2])
      this.tourToTar = new THREE.Vector3(w.target[0], w.target[1], w.target[2])
      this.tourT = 0
      this.$emit('scene-event', { type: 'tour-view', title: w.title })
    },
    tourUpdate (dt) {
      if (!this.tourActive || this.tourPaused) return
      var N = TOUR_WP.length
      if (N === 0) return
      // Hold wait
      if (this.tourWait > 0) {
        this.tourWait -= dt
        if (this.tourWait <= 0) {
          this.tourWait = 0
          this.tourIdx = (this.tourIdx + 1) % N
          this.beginTourStep(TOUR_WP[this.tourIdx])
        }
        return
      }
      // Animate camera
      var w = TOUR_WP[this.tourIdx % N]
      if (!w) return
      this.tourT += dt / w.tr
      if (this.tourT >= 1) {
        this.tourT = 1
        this.camera.position.copy(this.tourToCam)
        this.controls.target.copy(this.tourToTar)
        this.tourWait = w.hold
        return
      }
      var e = easeInOutCubic(this.tourT)
      this.camera.position.lerpVectors(this.tourFromCam, this.tourToCam, e)
      this.controls.target.lerpVectors(this.tourFromTar, this.tourToTar, e)
    },

    /* ---------- Scene building ---------- */
    resize () {
      if (!this.renderer) return
      var w = this.$refs.host.clientWidth || 1
      var h = this.$refs.host.clientHeight || 1
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
      this.labels.setSize(w, h)
    },
    mat (c, o, e) {
      if (o === undefined) o = 0.32
      if (e === undefined) e = 0x002a34
      return new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: o, roughness: 0.5, metalness: 0.1, emissive: e, emissiveIntensity: 0.32 })
    },
    label (t) {
      var el = document.createElement('div')
      el.textContent = t
      el.style.cssText = 'color:#eaffff;font-size:13px;white-space:nowrap;background:rgba(1,26,36,.84);border:1px solid rgba(0,245,255,.62);padding:5px 10px;box-shadow:0 0 14px rgba(0,245,255,.3);pointer-events:none'
      return new CSS2DObject(el)
    },
    edges (m, c, o) {
      if (c === undefined) c = 0x00f5ff
      if (o === undefined) o = 0.8
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o })))
    },
    ring (x, z, r, c) {
      if (c === undefined) c = 0x00f5ff
      var group = new THREE.Group()
      group.position.set(x, 0.14, z)
      var ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.58, r, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      group.add(ring)
      this.anims.push(function (t) { ring.rotation.z = t * 0.8; ring.material.opacity = 0.17 + Math.abs(Math.sin(t * 2.5)) * 0.12 })
      return group
    },
    build () { this.base(); this.rooms(); this.charge(); this.path(); this.robotObj(); this.coverage(); this.view('top') },
    base () {
      var grid = new THREE.GridHelper(178, 44, 0x00ffff, 0x123d4b)
      grid.material.transparent = true
      grid.material.opacity = 0.18
      this.scene.add(grid)
      var g = new THREE.Mesh(new THREE.PlaneGeometry(182, 116), this.mat(0x071520, 0.98, 0))
      g.rotation.x = -Math.PI / 2
      this.scene.add(g)
    },
    rooms () {
      var self = this
      var rooms = [
        ['大堂前厅',-56,-28,42,28,0x00f5ff,'已完成'],
        ['电梯厅',-8,-28,30,26,0x0f6f9a,'已完成'],
        ['公共走廊',38,-6,82,20,0x00f5ff,'执行中'],
        ['地下车库B1',-38,28,80,28,0x1e6e9a,'待执行'],
        ['充电区周边',58,32,48,24,0xffb642,'待执行']
      ]
      rooms.forEach(function (r) {
        var group = new THREE.Group()
        var p = new THREE.Mesh(new THREE.PlaneGeometry(r[3], r[4]), new THREE.MeshBasicMaterial({ color: r[5], transparent: true, opacity: r[6] === '执行中' ? 0.32 : 0.17, side: THREE.DoubleSide }))
        p.rotation.x = -Math.PI / 2
        p.position.set(r[1], 0.18, r[2])
        var b = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r[3], 0.18, r[4])), new THREE.LineBasicMaterial({ color: r[5], transparent: true, opacity: r[6] === '执行中' ? 0.86 : 0.58 }))
        b.position.set(r[1], 0.3, r[2])
        group.add(p, b)
        var lab = self.label(r[0])
        lab.position.set(r[1], 5.4, r[2])
        self.scene.add(lab)
        self.addClick(group, {
          title: r[0], type: '清洁区域', location: '3F', status: r[6],
          desc: '机器人在该区域按清洁策略执行任务，确保覆盖质量。',
          camera: [[r[1] + 22, 38, r[2] + 30], [r[1], 0, r[2]]]
        })
        self.scene.add(group)
      })
      var walls = [[-84,0,1,108],[84,0,1,108],[0,-54,168,1],[0,54,168,1],[18,-16,98,1],[18,14,98,1],[-28,0,1,52],[34,0,1,54]]
      walls.forEach(function (w) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 4.8, w[3]), self.mat(0x244b5a, 0.32, 0x002a34))
        m.position.set(w[0], 2.4, w[1])
        self.scene.add(m)
      })
    },
    charge () {
      for (var i = 0; i < 4; i++) {
        var x = 42 + i * 11, z = 41
        var dock = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.1, 5.2), new THREE.MeshStandardMaterial({ color: 0x0bd8e6, emissive: 0x00f5ff, emissiveIntensity: 0.72, roughness: 0.45, metalness: 0.22 }))
        dock.position.set(x, 1.55, z)
        this.edges(dock)
        this.scene.add(dock)
        this.scene.add(this.ring(x, z, 5.6))
        this.addClick(dock, {
          title: '充电桩-' + (i + 1), type: '充电点位', location: '充电区',
          status: i === 0 ? '可用' : '空闲',
          desc: '支持自动回充、低电量策略与充电状态展示。',
          camera: [[64, 42, 68], [54, 0, 38]]
        })
      }
    },
    path () {
      var self = this
      this.waypoints = [
        ['大堂前厅',-64,-30,2],['大堂前厅',-42,-30,1.8],['电梯厅',-10,-28,2.5],
        ['公共走廊',18,-16,1.5],['公共走廊',48,-6,3],['公共走廊',72,-6,1.8],
        ['充电区周边',68,24,2],['充电区周边',46,36,2.5],
        ['地下车库B1',12,28,1.8],['地下车库B1',-28,28,2.5],['地下车库B1',-66,26,2]
      ].map(function (p) { return { name: p[0], vector: new THREE.Vector3(p[1], 1.35, p[2]), dwell: p[3] } })
      var curve = new THREE.CatmullRomCurve3(this.waypoints.map(function (p) { return p.vector }), false, 'catmullrom', 0.16)
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(320)), new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.8 })))
      for (var i = 0; i < 16; i++) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fffff, transparent: true, opacity: 0.75 }))
        this.scene.add(dot)
        this.anims.push((function (idx) {
          return function (t) { var u = (idx / 16 + t * 0.025) % 1; dot.position.copy(curve.getPoint(u)); dot.position.y = 1.65 }
        })(i))
      }
    },
    robotObj () {
      this.robot = new THREE.Group()
      var body = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.1, 2.8, 40), new THREE.MeshStandardMaterial({ color: 0xeaf3f3, roughness: 0.48, metalness: 0.18, emissive: 0x123445, emissiveIntensity: 0.18 }))
      body.position.y = 2.1
      var head = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 1.4, 32), new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 0.38, metalness: 0.35, emissive: 0x00eaff, emissiveIntensity: 0.35 }))
      head.position.y = 4.35
      var front = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 4.6), new THREE.MeshBasicMaterial({ color: 0x00f5ff }))
      front.position.set(0, 2.3, 5.1)
      var halo = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 14), new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.1, wireframe: true }))
      halo.position.y = 2.6
      var lab = this.label('GX-001')
      lab.position.set(0, 9.2, 0)
      this.robot.add(body, head, front, halo, lab)
      this.robot.position.copy(this.waypoints[0].vector)
      this.scene.add(this.robot)
      this.addClick(this.robot, {
        title: 'GX-001 高仙拖地机器人', type: '清洁机器人', location: '3F 公共走廊', status: '执行中',
        desc: '机器人按规划路径执行清洁任务，重点区域自动停留深度清洁。',
        camera: [[28, 34, 34], [34, 2, -6]]
      })
      this.anims.push(function (t) { halo.scale.setScalar(1 + Math.sin(t * 4.2) * 0.1) })
    },
    coverage () {
      var areas = [[-55, 0.24, -30, 28, 18], [-8, 0.25, -28, 22, 18], [38, 0.26, -6, 48, 12]]
      var self = this
      areas.forEach(function (a) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(a[3], a[4]), new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }))
        m.rotation.x = -Math.PI / 2
        m.position.set(a[0], a[1], a[2])
        self.scene.add(m)
      })
    },
    addClick (o, p) { o.userData.payload = p; this.clicks.push(o) },

    /* ---------- Interactions ---------- */
    motionUpdate (dt) {
      if (!this.robot || !this.waypoints || this.paused) { this.currentSpeed = 0; return }
      var cur = this.waypoints[this.motion.index]
      var ni = (this.motion.index + 1) % this.waypoints.length
      var nxt = this.waypoints[ni]
      if (this.motion.dwell > 0) {
        this.motion.dwell -= dt
        this.dwellLeft = Math.max(0, this.motion.dwell)
        this.currentSpeed = 0
        this.currentNodeName = cur.name
        this.robot.rotation.y += Math.sin(performance.now() / 1000 * 1.4) * 0.0018
        return
      }
      var dis = cur.vector.distanceTo(nxt.vector)
      this.motion.progress += (this.robotSpeed * dt) / Math.max(dis, 1)
      this.currentSpeed = this.robotSpeed
      if (this.motion.progress >= 1) {
        this.motion.index = ni
        this.motion.progress = 0
        this.motion.dwell = (nxt.dwell || 3) * this.dwellScale
        this.dwellLeft = this.motion.dwell
        this.currentNodeName = nxt.name
        this.$emit('scene-event', { type: 'robot-dwell', title: '机器人停留清洁：' + nxt.name })
        return
      }
      var pos = cur.vector.clone().lerp(nxt.vector, this.motion.progress)
      var look = pos.clone().lerp(nxt.vector, 0.2)
      this.robot.position.copy(pos)
      this.robot.lookAt(look.x, look.y, look.z)
      var total = this.waypoints.length - 1
      this.progress = Math.min(99, ((this.motion.index + this.motion.progress) / total) * 100)
      this.battery = Math.max(62, Math.round(76 - this.progress * 0.08))
      this.currentNodeName = cur.name
    },
    view (v) {
      this.followMode = false
      if (v === 'follow') {
        this.followMode = true
        this.targetCam = null
        // Seed camera/target near the robot so the first lerp is gentle
        var dir = this.getRobotBackDir()
        this.followDesiredCam = this.robot.position.clone().add(dir.multiplyScalar(30)).add(new THREE.Vector3(0, 22, 0))
        this.followDesiredTar = this.robot.position.clone()
        this.followDesiredTar.y += 2
        return
      }
      var p = { top: [[0,108,42],[0,0,0]], charge: [[72,46,64],[56,0,36]] }
      if (p[v]) this.fly(p[v][0], p[v][1], 0.055)
    },
    togglePause () {
      this.paused = !this.paused
      this.taskStatus = this.paused ? '已暂停' : '执行中'
      this.$emit('scene-event', {
        type: this.paused ? 'robot-pause' : 'robot-resume',
        title: this.paused ? '机器人任务已暂停' : '机器人任务继续执行'
      })
    },
    alarm () {
      var self = this
      if (!this.robot) return
      this.$emit('scene-event', { type: 'robot-alarm', title: '清水余量不足' })
      this.fly([this.robot.position.x + 20, 34, this.robot.position.z + 28], [this.robot.position.x, 2, this.robot.position.z], 0.06)
      var s = new THREE.Mesh(new THREE.SphereGeometry(11, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff554f, transparent: true, opacity: 0.24, wireframe: true }))
      s.position.copy(this.robot.position)
      s.position.y += 5
      this.scene.add(s)
      var st = performance.now()
      var fn = function (t) {
        s.position.copy(self.robot.position)
        s.position.y += 5
        s.scale.setScalar(1 + Math.sin(t * 6.5) * 0.2)
        if (performance.now() - st > 9000) { self.scene.remove(s); self.anims = self.anims.filter(function (a) { return a !== fn }) }
      }
      this.anims.push(fn)
    },
    pick (e) {
      var r = this.renderer.domElement.getBoundingClientRect()
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.camera)
      var hits = this.raycaster.intersectObjects(this.clicks, true)
      if (!hits.length) { this.tip.show = false; return }
      var o = hits[0].object
      while (o && !o.userData.payload) o = o.parent
      if (!o) return
      var p = o.userData.payload
      if (p.camera) this.fly(p.camera[0], p.camera[1], 0.06)
      this.tip = { show: true, x: e.clientX - r.left, y: e.clientY - r.top, title: p.title, type: p.type, location: p.location, status: p.status, desc: p.desc, alarm: !!p.alarm }
      this.$emit('scene-event', { type: 'select', title: p.title, payload: p })
    },

    /* ---------- Camera & render loop ---------- */
    getRobotBackDir () {
      // Robot's forward is +Z in its local space; we want camera behind + above.
      var yaw = this.robot ? this.robot.rotation.y : 0
      return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    },
    followUpdate () {
      if (!this.followMode || !this.robot) return
      var back = this.getRobotBackDir()
      var desired = this.robot.position.clone().add(back.multiplyScalar(30)).add(new THREE.Vector3(0, 22, 0))
      var desiredTar = this.robot.position.clone()
      desiredTar.y += 2
      if (!this.followDesiredCam) {
        this.followDesiredCam = desired.clone()
        this.followDesiredTar = desiredTar.clone()
      }
      // Smoothly chase the desired position (camera lags slightly behind the ideal)
      this.followDesiredCam.lerp(desired, 0.12)
      this.followDesiredTar.lerp(desiredTar, 0.25)
      // Apply (after controls.update, so orbit rotation still works around target)
      this.camera.position.copy(this.followDesiredCam)
      this.controls.target.copy(this.followDesiredTar)
    },
    fly (p, t, s) {
      if (s === undefined) s = 0.045
      this.followMode = false
      this.targetCam = new THREE.Vector3(p[0], p[1], p[2])
      this.targetTar = new THREE.Vector3(t[0], t[1], t[2])
      this.speed = s
    },
    flyUpdate () {
      if (!this.targetCam) return
      this.camera.position.lerp(this.targetCam, this.speed)
      this.controls.target.lerp(this.targetTar, this.speed * 1.25)
      if (this.camera.position.distanceTo(this.targetCam) < 0.35) this.targetCam = null
    },
    clamp () {
      this.camera.position.y = Math.max(this.camera.position.y, 8)
      if (this.followMode) return
      var d = this.camera.position.distanceTo(this.controls.target)
      if (d > this.controls.maxDistance + 4) {
        var dir = this.camera.position.clone().sub(this.controls.target).normalize()
        this.camera.position.copy(this.controls.target.clone().add(dir.multiplyScalar(this.controls.maxDistance)))
      }
    },
    loop () {
      this.raf = requestAnimationFrame(this.loop)
      var dt = Math.min(this.clock.getDelta(), 0.05)
      var t = performance.now() / 1000
      this.motionUpdate(dt)
      this.controls.update()
      this.tourUpdate(dt)
      this.followUpdate()
      this.flyUpdate()
      this.clamp()
      this.anims.forEach(function (fn) { fn(t, dt) })
      this.renderer.render(this.scene, this.camera)
      this.labels.render(this.scene, this.camera)
    }
  }
}
</script>

<style scoped>
.scene-panel{position:relative;width:100%;min-height:520px;overflow:hidden;border:1px solid rgba(0,245,255,.46);background:#020811;box-shadow:inset 0 0 30px rgba(0,245,255,.08)}.scene-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 38px,rgba(0,245,255,.035) 39px 40px),repeating-linear-gradient(0deg,transparent 0 38px,rgba(0,245,255,.03) 39px 40px);z-index:2}.head{position:absolute;left:18px;right:18px;top:14px;z-index:8;display:flex;justify-content:space-between;pointer-events:none}.head b{font-size:22px;letter-spacing:3px;text-shadow:0 0 10px #00f5ff}.head span{color:rgba(210,250,255,.58);font-size:13px}.head div{display:flex;gap:8px}.head i{font-style:normal;padding:7px 10px;border:1px solid rgba(0,245,255,.34);background:rgba(0,32,44,.68)}.toolbar{position:absolute;left:24px;top:62px;z-index:8;display:flex;gap:8px}.toolbar button{height:30px;padding:0 12px;color:#dff;border:1px solid rgba(0,245,255,.48);background:rgba(0,35,50,.78);cursor:pointer}.toolbar .danger{border-color:rgba(255,85,79,.72);background:rgba(82,18,22,.72)}.toolbar .tour.active{color:#fff;background:linear-gradient(180deg,rgba(0,245,255,.38),rgba(0,110,130,.5));box-shadow:0 0 12px rgba(0,245,255,.3) inset}.host{position:absolute;inset:0;z-index:1;background:#020811}.tip{position:absolute;z-index:12;min-width:230px;transform:translate(-50%,-112%);padding:12px;border:1px solid rgba(0,245,255,.66);background:rgba(1,22,32,.92);box-shadow:0 0 22px rgba(0,245,255,.22);pointer-events:none}.tip.alarm{border-color:rgba(255,85,79,.78)}.tip h4{margin:0 0 8px;color:#00f5ff}.tip p{margin:5px 0;color:#cfe9ee;font-size:13px}.tip em{color:#ff6c66;font-style:normal}.tip small{color:rgba(220,255,255,.65)}.task{position:absolute;right:18px;bottom:44px;z-index:8;width:248px;padding:12px;border:1px solid rgba(0,245,255,.36);background:rgba(0,22,34,.76)}.task h4{margin:0 0 8px}.task strong{display:block;color:#00f5ff;font-size:21px;margin-bottom:8px}.task p{display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,245,255,.1);padding:5px 0;margin:0;font-size:13px}.task b{color:#26f2a3}.bar{margin-top:12px;height:7px;border-radius:8px;background:rgba(150,180,190,.14);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#00c8c6,#70ffff)}.hint{position:absolute;left:18px;bottom:14px;z-index:8;color:rgba(220,255,255,.48);font-size:12px}
</style>
