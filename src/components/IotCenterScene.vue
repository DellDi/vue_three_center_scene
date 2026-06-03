<template>
  <div class="scene-panel" :style="{height}">
    <div class="head"><b>{{ floorMode ? floorTitle : '设备场景总览' }}</b><span>{{ floorMode ? '楼层内部视角：摄像头 / 消防 / 门禁 / 环境点位' : '园区视角：点击楼栋下钻到楼层内部' }}</span></div>
    <div class="toolbar">
      <button @click="backPark">园区总览</button><button @click="view('fire')">消防视角</button><button @click="view('security')">安防视角</button><button @click="view('room')">设备房视角</button><button :class="{tour:1,active:tourActive}" @click="toggleTour">{{tourActive?'暂停导览':'自动导览'}}</button><button class="danger" @click="alarm">告警联动</button>
    </div>
    <div ref="host" class="host"></div>
    <transition name="fade"><div v-if="loading" class="mask">{{ loadingText }}</div></transition>
    <div v-show="tip.show" class="tip" :class="{alarm:tip.alarm}" :style="{left:tip.x+'px',top:tip.y+'px'}"><h4>{{tip.title}}</h4><p>类型：{{tip.type}}</p><p>位置：{{tip.location}}</p><p>状态：<em>{{tip.status}}</em></p><small>{{tip.desc}}</small></div>
    <div class="side"><h4>{{ floorMode ? '楼层设备清单' : '园区重点对象' }}</h4><p v-for="i in sideList" :key="i.name"><span>{{i.name}}</span><b :class="{bad:i.bad}">{{i.status}}</b></p></div>
    <div class="hint">支持楼栋下钻、楼层内部视角、设备点位弹窗、视角飞行与告警联动。</div>
  </div>
</template>

<script>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

var PARK_TOUR = [
  {cam:[96,72,108],target:[0,4,0],hold:5,tr:2.5,title:'园区全景总览'},
  {cam:[-20,44,28],target:[-50,8,-22],hold:4,tr:3,title:'聚焦1号楼'},
  {cam:[-24,28,10],target:[-50,8,-22],hold:0,tr:3,title:'下钻1号楼',action:'drill',bid:0},
  {cam:[0,88,34],target:[0,0,0],hold:5,tr:3.5,title:'楼层全景'},
  {cam:[58,42,10],target:[48,0,-26],hold:4,tr:3,title:'水泵房区域'},
  {cam:[-32,42,48],target:[-42,0,26],hold:4,tr:3,title:'配电房区域'},
  {cam:[-38,38,20],target:[-14,0,-2],hold:4,tr:3,title:'走廊安防视角'},
  {cam:[62,38,42],target:[50,0,24],hold:4,tr:3,title:'监控室区域'},
  {cam:[88,52,42],target:[28,8,16],hold:0,tr:2.8,title:'返回园区总览',action:'back'},
  {cam:[50,58,88],target:[44,8,-12],hold:4,tr:3,title:'配电房楼栋'},
  {cam:[110,58,68],target:[75,8,34],hold:4,tr:3,title:'充电区楼栋'},
  {cam:[96,72,108],target:[0,4,0],hold:5,tr:3.5,title:'园区全景总览'}
]

var FLOOR_TOUR = [
  {cam:[0,88,34],target:[0,0,0],hold:5,tr:2.5,title:'楼层全景'},
  {cam:[58,42,10],target:[48,0,-26],hold:4,tr:3,title:'水泵房区域'},
  {cam:[-32,42,48],target:[-42,0,26],hold:4,tr:3,title:'配电房区域'},
  {cam:[-38,38,20],target:[-14,0,-2],hold:4,tr:3,title:'走廊安防视角'},
  {cam:[62,38,42],target:[50,0,24],hold:4,tr:3,title:'监控室区域'},
  {cam:[0,88,34],target:[0,0,0],hold:0,tr:3,title:'返回园区总览',action:'back'}
]

function easeInOutCubic (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

export default {
  name: 'IotCenterScene',
  props: {
    height: { type: String, default: '620px' },
    autoPlay: { type: Boolean, default: true },
    tourResumeDelay: { type: Number, default: 10000 }
  },
  data () {
    return {
      floorMode: false,
      floorTitle: '1号楼 · 3F 楼层内部',
      loading: false,
      loadingText: '正在下钻到楼层内部...',
      tip: { show: false, x: 0, y: 0, title: '', type: '', location: '', status: '', desc: '', alarm: false },
      sideList: [
        { name: '1号设备房', status: '正常' },
        { name: '水泵房', status: '液位偏高', bad: true },
        { name: '配电房', status: '温度偏高', bad: true },
        { name: '消防通道', status: '在线' }
      ],
      tourActive: false,
      tourPaused: false
    }
  },
  mounted () {
    this.init()
    this.buildPark()
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
      this.renderer.domElement.removeEventListener('pointerdown', this.pick)
      this.renderer.domElement.removeEventListener('wheel', this.onUserInteract)
    }
    this.renderer && this.renderer.dispose()
    if (this.$refs.host) this.$refs.host.innerHTML = ''
  },
  methods: {
    init () {
      this.scene = new THREE.Scene()
      this.scene.fog = new THREE.Fog(0x020811, 100, 310)
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500)
      this.camera.position.set(96, 72, 108)
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
      this.controls.minDistance = 36
      this.controls.maxDistance = 180
      this.controls.maxPolarAngle = Math.PI / 2.08
      this.controls.screenSpacePanning = false
      this.raycaster = new THREE.Raycaster()
      this.pointer = new THREE.Vector2()
      this.clicks = []
      this.anims = []
      this.devices = {}
      this.park = new THREE.Group()
      this.floor = new THREE.Group()
      this.scene.add(this.park, this.floor)
      this.scene.add(new THREE.AmbientLight(0x9eefff, 0.8))
      var dl = new THREE.DirectionalLight(0xffffff, 1.35)
      dl.position.set(80, 140, 80)
      this.scene.add(dl)
      var pl = new THREE.PointLight(0x00f5ff, 4.5, 180)
      pl.position.set(0, 58, 0)
      this.scene.add(pl)
      this.clock = new THREE.Clock()
      // tour state (not reactive, plain instance vars)
      this.tourIdx = 0
      this.tourT = 0
      this.tourWait = 0
      this.tourPhase = 'park'
      this.tourFromCam = null
      this.tourFromTar = null
      this.tourToCam = null
      this.tourToTar = null
      this.resize()
      this.renderer.domElement.addEventListener('pointerdown', this.pick)
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
      this.tourPhase = this.floorMode ? 'floor' : 'park'
      this.controls.enabled = false
      this.targetCam = null
      var tour = this.tourPhase === 'floor' ? FLOOR_TOUR : PARK_TOUR
      var w = tour[0]
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
    tourAdvance (tour) {
      this.tourIdx = (this.tourIdx + 1) % tour.length
      var nw = tour[this.tourIdx]
      this.beginTourStep(nw)
    },
    tourUpdate (dt) {
      if (!this.tourActive || this.tourPaused) return
      // Phase transitions (between drill/back and new scene)
      if (this.tourPhase === 'to-floor' || this.tourPhase === 'to-park') {
        this.tourWait -= dt
        if (this.tourWait <= 0) {
          if (this.tourPhase === 'to-floor') {
            this.tourPhase = 'floor'
            this.tourIdx = 0
            this.beginTourStep(FLOOR_TOUR[0])
          } else {
            this.tourPhase = 'park'
            this.tourIdx = 1
            this.beginTourStep(PARK_TOUR[1])
          }
        }
        return
      }
      var tour = this.tourPhase === 'floor' ? FLOOR_TOUR : PARK_TOUR
      var N = tour.length
      if (N === 0) return
      // Hold wait
      if (this.tourWait > 0) {
        this.tourWait -= dt
        if (this.tourWait <= 0) {
          this.tourWait = 0
          var cw = tour[this.tourIdx % N]
          if (cw && cw.action === 'drill') {
            this.tourPhase = 'to-floor'
            this.tourWait = 3.5
            var bs = [
              ['b1','1号楼',-50,-22,36,25,28,'正常'],
              ['b2','2号楼',0,-30,38,34,26,'正常'],
              ['b3','设备房',-74,34,24,15,18,'正常'],
              ['b4','配电房',44,-12,32,24,24,'温度偏高'],
              ['b5','充电区',75,34,34,18,20,'异常待处理']
            ]
            this.drill(bs[cw.bid || 0])
            return
          }
          if (cw && cw.action === 'back') {
            this.tourPhase = 'to-park'
            this.tourWait = 2
            this.buildPark()
            this.sideList = [
              { name: '1号设备房', status: '正常' },
              { name: '水泵房', status: '液位偏高', bad: true },
              { name: '配电房', status: '温度偏高', bad: true },
              { name: '消防通道', status: '在线' }
            ]
            return
          }
          this.tourAdvance(tour)
        }
        return
      }
      // Animate camera
      var w = tour[this.tourIdx % N]
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
    clear (g) {
      function disposeNode (node) {
        // CSS2DObject: remove its DOM element from the page
        if (node.element && node.element.parentNode) {
          node.element.parentNode.removeChild(node.element)
        }
        // Dispose geometry
        if (node.geometry) node.geometry.dispose()
        // Dispose material(s)
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(function (m) { m.dispose() })
          } else {
            node.material.dispose()
          }
        }
        // Recurse into nested children
        if (node.children) {
          for (var i = node.children.length - 1; i >= 0; i--) {
            disposeNode(node.children[i])
          }
        }
      }
      while (g.children.length) {
        disposeNode(g.children[0])
        g.remove(g.children[0])
      }
    },
    mat (c, o, e) {
      if (o === undefined) o = 0.78
      if (e === undefined) e = 0x00384c
      return new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: o, roughness: 0.46, metalness: 0.24, emissive: e, emissiveIntensity: 0.55 })
    },
    edges (m, c, o) {
      if (c === undefined) c = 0x00eaff
      if (o === undefined) o = 0.7
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o })))
    },
    label (t, bad) {
      var el = document.createElement('div')
      el.textContent = t
      el.style.cssText = 'color:#eaffff;font-size:13px;white-space:nowrap;background:' + (bad ? 'rgba(70,18,20,.88)' : 'rgba(1,26,36,.82)') + ';border:1px solid ' + (bad ? 'rgba(255,85,79,.75)' : 'rgba(0,245,255,.62)') + ';padding:5px 10px;box-shadow:0 0 14px rgba(0,245,255,.3);pointer-events:none'
      return new CSS2DObject(el)
    },
    ring (x, z, r, c) {
      if (c === undefined) c = 0x00f5ff
      var g = new THREE.Group()
      g.position.set(x, 0.12, z)
      var a = new THREE.Mesh(new THREE.RingGeometry(r * 0.64, r, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.24, side: THREE.DoubleSide }))
      a.rotation.x = -Math.PI / 2
      var b = new THREE.Mesh(new THREE.RingGeometry(r * 0.24, r * 0.38, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.34, side: THREE.DoubleSide }))
      b.rotation.x = -Math.PI / 2
      g.add(a, b)
      this.anims.push(function (t) { a.rotation.z = t * 0.55; b.rotation.z = -t * 0.8 })
      return g
    },
    addClick (o, p) { o.userData.payload = p; this.clicks.push(o) },
    buildPark () {
      this.floorMode = false
      this.tip.show = false
      this.clicks = []
      this.anims = []
      this.devices = {}
      this.clear(this.park)
      this.clear(this.floor)
      this.park.visible = true
      this.floor.visible = false
      this.controls.minDistance = 42
      this.controls.maxDistance = 190
      var grid = new THREE.GridHelper(210, 54, 0x00ffff, 0x0b4050)
      grid.material.transparent = true
      grid.material.opacity = 0.23
      this.park.add(grid)
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.mat(0x071520, 0.96, 0x000000))
      ground.rotation.x = -Math.PI / 2
      this.park.add(ground)
      var roads = [[0,8,172,12],[36,-10,12,128],[-46,25,84,9],[64,40,58,9]]
      var self = this
      roads.forEach(function (r) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(r[2], r[3]), new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }))
        m.rotation.x = -Math.PI / 2
        m.position.set(r[0], 0.1, r[1])
        self.park.add(m)
      })
      var bs = [
        ['b1','1号楼',-50,-22,36,25,28,'正常'],
        ['b2','2号楼',0,-30,38,34,26,'正常'],
        ['b3','设备房',-74,34,24,15,18,'正常'],
        ['b4','配电房',44,-12,32,24,24,'温度偏高',true],
        ['b5','充电区',75,34,34,18,20,'异常待处理',true]
      ]
      bs.forEach(function (b) {
        var g = new THREE.Group()
        g.position.set(b[2], 0, b[3])
        var body = new THREE.Mesh(new THREE.BoxGeometry(b[4], b[5], b[6]), self.mat(b[8] ? 0x351719 : 0x0c4d67, 0.78, b[8] ? 0x401010 : 0x00384c))
        body.position.y = b[5] / 2
        self.edges(body, b[8] ? 0xff554f : 0x00eaff, 0.76)
        g.add(body)
        for (var i = 1; i <= 4; i++) {
          var f = new THREE.Mesh(new THREE.BoxGeometry(b[4] + 0.4, 0.22, b[6] + 0.4), new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.1 }))
          f.position.y = b[5] / 5 * i
          g.add(f)
        }
        var lab = self.label(b[1], b[8])
        lab.position.set(0, b[5] + 9, 0)
        g.add(lab)
        self.park.add(self.ring(b[2], b[3], b[8] ? 11 : 9, b[8] ? 0xff554f : 0x00f5ff))
        self.addClick(g, {
          id: b[0], title: b[1], type: '楼栋 / 区域', location: '智慧物业园区', status: b[7], alarm: !!b[8],
          desc: '点击后切换到楼层内部视角，展示摄像头、门禁、消防、环境点位。',
          camera: [[b[2] + 38, 38, b[3] + 44], [b[2], 8, b[3]]],
          action: function () { self.drill(b) }
        })
        self.park.add(g)
      })
      var devs = [
        ['cam','AI摄像头',-58,30,-18,'消防通道','在线','◉'],
        ['smoke','烟感',-46,31,-28,'1号楼','正常','♨'],
        ['door','门禁',-76,20,34,'设备房','在线','▣'],
        ['water','液位',-20,15,22,'水泵房','液位偏高','◍',true],
        ['temp','温度',42,31,-10,'配电房','温度偏高','♨',true],
        ['elevator','电梯厅摄像头',2,40,-30,'2号楼电梯厅','在线','◉'],
        ['charger','充电区监测',75,24,34,'充电区','异常待处理','⚡',true],
        ['fire','消防栓压力',18,12,42,'主干道','正常','◆']
      ]
      devs.forEach(function (d) { self.marker(self.park, { id: d[0], title: d[1], pos: [d[2], d[3], d[4]], location: d[5], status: d[6], icon: d[7], alarm: d[8], type: d[1] }) })
      this.fly([96, 72, 108], [0, 4, 0])
    },
    drill (b) {
      var self = this
      this.$emit('scene-event', { type: 'drill-down', title: b[1] })
      this.loadingText = '正在下钻到' + b[1] + '楼层内部...'
      this.loading = true
      this.floorTitle = b[1] + ' · 楼层内部'
      this.fly([b[2] + 26, 28, b[3] + 32], [b[2], 8, b[3]], 0.055)
      setTimeout(function () { self.buildFloor(); self.loading = false }, 760)
    },
    buildFloor () {
      this.floorMode = true
      this.tip.show = false
      this.clicks = []
      this.anims = []
      this.devices = {}
      this.clear(this.park)
      this.clear(this.floor)
      this.park.visible = false
      this.floor.visible = true
      this.controls.minDistance = 28
      this.controls.maxDistance = 125
      var grid = new THREE.GridHelper(145, 36, 0x00ffff, 0x123d4b)
      grid.material.transparent = true
      grid.material.opacity = 0.18
      this.floor.add(grid)
      var base = new THREE.Mesh(new THREE.PlaneGeometry(150, 96), this.mat(0x071520, 0.98, 0))
      base.rotation.x = -Math.PI / 2
      this.floor.add(base)
      var self = this
      var rooms = [
        ['公共走廊',18,-2,94,18,0x00f5ff,false],
        ['大堂',-48,-22,36,28,0x0ba7b8,false],
        ['电梯厅',-4,-24,28,26,0x0f5f8d,false],
        ['水泵房',48,-26,28,24,0xff554f,true],
        ['配电房',-42,26,36,24,0xffb642,true],
        ['设备间',8,26,32,24,0x00f5ff,false],
        ['监控室',50,24,28,24,0x2d8cff,false]
      ]
      rooms.forEach(function (r) {
        var g = new THREE.Group()
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(r[3], r[4]), new THREE.MeshBasicMaterial({ color: r[5], transparent: true, opacity: r[6] ? 0.2 : 0.18, side: THREE.DoubleSide }))
        pl.rotation.x = -Math.PI / 2
        pl.position.set(r[1], 0.2, r[2])
        var bd = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r[3], 0.18, r[4])), new THREE.LineBasicMaterial({ color: r[5], transparent: true, opacity: 0.72 }))
        bd.position.set(r[1], 0.34, r[2])
        g.add(pl, bd)
        var lab = self.label(r[0], r[6])
        lab.position.set(r[1], 5.4, r[2])
        self.floor.add(lab)
        self.addClick(g, {
          title: r[0], type: '楼层房间 / 区域', location: self.floorTitle,
          status: r[6] ? '存在异常' : '正常', alarm: r[6],
          desc: '楼层内部区域，可查看房间设备点位、告警、视频与工单。',
          camera: [[r[1] + 18, 34, r[2] + 22], [r[1], 0, r[2]]]
        })
        self.floor.add(g)
      })
      var walls = [[-74,0,1,92],[74,0,1,92],[0,-47,148,1],[0,47,148,1],[18,-14,94,1],[18,14,94,1],[-24,0,1,46],[32,0,1,48]]
      walls.forEach(function (w) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 5.6, w[3]), self.mat(0x244b5a, 0.34, 0x002b34))
        m.position.set(w[0], 2.8, w[1])
        self.floor.add(m)
      })
      var fdevs = [
        ['f-cam1','走廊摄像头','AI摄像头','◉',-14,8,-2,'公共走廊','在线'],
        ['f-cam2','大堂摄像头','AI摄像头','◉',-48,8,-22,'大堂','在线'],
        ['f-smoke','烟感-水泵房','烟感','♨',48,8,-26,'水泵房','正常'],
        ['f-water','液位-水泵房','液位','◍',58,8,-22,'水泵房','液位偏高',true],
        ['f-temp','温度-配电房','温度','♨',-42,8,26,'配电房','温度偏高',true],
        ['f-door','门禁-设备间','门禁','▣',8,7,14,'设备间','在线'],
        ['f-elevator','电梯状态点位','电梯','▤',-4,7,-24,'电梯厅','正常'],
        ['f-fire','消防栓压力','消防','◆',18,7,8,'公共走廊','正常']
      ]
      fdevs.forEach(function (d) { self.marker(self.floor, { id: d[0], title: d[1], type: d[2], icon: d[3], pos: [d[4], d[5], d[6]], location: d[7], status: d[8], alarm: d[9] }) })
      this.sideList = [
        { name: '公共走廊摄像头', status: '在线' },
        { name: '水泵房液位', status: '液位偏高', bad: true },
        { name: '配电房温度', status: '温度偏高', bad: true },
        { name: '消防烟感', status: '正常' }
      ]
      this.fly([0, 88, 34], [0, 0, 0], 0.055)
    },
    marker (group, d) {
      var m = new THREE.Group()
      m.position.set(d.pos[0], d.pos[1], d.pos[2])
      var c = d.alarm ? 0xff554f : 0x00f5ff
      var poleH = Math.max(d.pos[1] - 0.5, 2)
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, poleH, 12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 }))
      pole.position.y = -d.pos[1] / 2
      var ball = new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: d.alarm ? 1.7 : 1.05, transparent: true, opacity: 0.92 }))
      var ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 5.4, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = -d.pos[1] + 0.25
      var lab = this.label((d.icon || '●') + ' ' + d.title, d.alarm)
      lab.position.set(0, 6.2, 0)
      m.add(pole, ball, ring, lab)
      this.addClick(m, {
        id: d.id, title: d.title, type: d.type, icon: d.icon, pos: d.pos, location: d.location, status: d.status, alarm: d.alarm,
        desc: d.alarm ? '设备异常，支持联动视频、派单、复位与趋势查看。' : '设备在线，运行状态正常。',
        camera: [[d.pos[0] + 20, d.pos[1] + 20, d.pos[2] + 22], d.pos]
      })
      group.add(m)
      this.devices[d.id] = m
      this.anims.push(function (t) {
        ball.scale.setScalar(1 + Math.sin(t * (d.alarm ? 7 : 3)) * (d.alarm ? 0.22 : 0.08))
        ring.rotation.z += d.alarm ? 0.035 : 0.018
      })
    },

    /* ---------- Interactions ---------- */
    backPark () {
      if (!this.floorMode) { this.fly([96, 72, 108], [0, 4, 0]); return }
      var self = this
      this.loadingText = '正在返回园区总览...'
      this.loading = true
      setTimeout(function () {
        self.buildPark()
        self.loading = false
        self.sideList = [
          { name: '1号设备房', status: '正常' },
          { name: '水泵房', status: '液位偏高', bad: true },
          { name: '配电房', status: '温度偏高', bad: true },
          { name: '消防通道', status: '在线' }
        ]
      }, 520)
    },
    view (v) {
      var p = this.floorMode
        ? { fire: [[58,42,10],[48,0,-26]], security: [[-22,38,20],[-14,0,-2]], room: [[-24,40,48],[-42,0,26]] }
        : { fire: [[-35,44,10],[-52,8,-20]], security: [[-84,42,30],[-74,8,34]], room: [[-34,38,54],[-20,6,22]] }
      if (p[v]) this.fly(p[v][0], p[v][1])
    },
    alarm () {
      var self = this
      var key = this.floorMode ? 'f-water' : 'charger'
      var o = this.devices[key] || Object.values(this.devices)[0]
      if (!o) return
      var w = new THREE.Vector3()
      o.getWorldPosition(w)
      this.fly([w.x + 22, w.y + 30, w.z + 25], [w.x, w.y, w.z], 0.06)
      this.$emit('scene-event', { type: 'alarm', title: '设备告警联动' })
      var s = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff554f, transparent: true, opacity: 0.22, wireframe: true }))
      s.position.copy(w)
      this.scene.add(s)
      var st = performance.now()
      var fn = function (t) {
        s.scale.setScalar(1 + Math.sin(t * 7) * 0.22)
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
      if (p.action) setTimeout(p.action, 360)
    },

    /* ---------- Camera & render loop ---------- */
    fly (p, t, s) {
      if (s === undefined) s = 0.045
      this.targetCam = new THREE.Vector3(p[0], p[1], p[2])
      this.targetTar = new THREE.Vector3(t[0], t[1], t[2])
      this.speed = s
    },
    updateFly () {
      if (!this.targetCam) return
      this.camera.position.lerp(this.targetCam, this.speed)
      this.controls.target.lerp(this.targetTar, this.speed * 1.25)
      if (this.camera.position.distanceTo(this.targetCam) < 0.35) this.targetCam = null
    },
    clamp () {
      this.camera.position.y = Math.max(this.camera.position.y, 8)
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
      this.controls.update()
      this.tourUpdate(dt)
      this.updateFly()
      this.clamp()
      this.anims.forEach(function (fn) { fn(t) })
      this.renderer.render(this.scene, this.camera)
      this.labels.render(this.scene, this.camera)
    }
  }
}
</script>

<style scoped>
.scene-panel{position:relative;width:100%;min-height:520px;overflow:hidden;border:1px solid rgba(0,245,255,.46);background:#020811;box-shadow:inset 0 0 30px rgba(0,245,255,.08)}.scene-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 38px,rgba(0,245,255,.035) 39px 40px),repeating-linear-gradient(0deg,transparent 0 38px,rgba(0,245,255,.03) 39px 40px);z-index:2}.head{position:absolute;left:18px;right:18px;top:14px;z-index:8;display:flex;justify-content:space-between;pointer-events:none}.head b{font-size:22px;letter-spacing:3px;text-shadow:0 0 10px #00f5ff}.head span{color:rgba(210,250,255,.58);font-size:13px}.toolbar{position:absolute;left:24px;top:62px;z-index:8;display:flex;gap:8px}.toolbar button{height:30px;padding:0 12px;color:#dff;border:1px solid rgba(0,245,255,.48);background:rgba(0,35,50,.78);cursor:pointer}.toolbar .danger{border-color:rgba(255,85,79,.72);background:rgba(82,18,22,.72)}.toolbar .tour.active{color:#fff;background:linear-gradient(180deg,rgba(0,245,255,.38),rgba(0,110,130,.5));box-shadow:0 0 12px rgba(0,245,255,.3) inset}.host{position:absolute;inset:0;z-index:1;background:#020811}.tip{position:absolute;z-index:12;min-width:230px;transform:translate(-50%,-112%);padding:12px;border:1px solid rgba(0,245,255,.66);background:rgba(1,22,32,.92);box-shadow:0 0 22px rgba(0,245,255,.22);pointer-events:none}.tip.alarm{border-color:rgba(255,85,79,.78)}.tip h4{margin:0 0 8px;color:#00f5ff}.tip p{margin:5px 0;color:#cfe9ee;font-size:13px}.tip em{color:#ff6c66;font-style:normal}.tip small{color:rgba(220,255,255,.65)}.side{position:absolute;right:18px;bottom:44px;z-index:8;width:248px;padding:12px;border:1px solid rgba(0,245,255,.36);background:rgba(0,22,34,.76)}.side h4{margin:0 0 8px}.side p{display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,245,255,.1);padding:6px 0;margin:0;font-size:13px}.side b{color:#26f2a3}.side b.bad{color:#ff6c66}.hint{position:absolute;left:18px;bottom:14px;z-index:8;color:rgba(220,255,255,.48);font-size:12px}.mask{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(5,5,10,.35);backdrop-filter:blur(1px);font-size:18px;letter-spacing:3px;text-shadow:0 0 12px #00f5ff}.fade-enter-active,.fade-leave-active{transition:opacity .28s}.fade-enter,.fade-leave-to{opacity:0}
</style>
