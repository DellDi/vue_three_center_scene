/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  SceneRuntime.js — Three.js 运行时总入口                    ║
 * ╠═══════════════════════════════════════════════════════════╣
 * ║                                                           ║
 * ║  这是 3D 场景的「总指挥」。它的职责：                         ║
 * ║                                                           ║
 * ║    1. 初始化 Three.js 核心三件套：                           ║
 * ║       Scene（场景）→ Camera（相机）→ Renderer（渲染器）       ║
 * ║                                                           ║
 * ║    2. 创建并连接所有管理模块：                                ║
 * ║       ModelManager     → 模型/材质工厂                       ║
 * ║       LayerManager     → 图层管理                           ║
 * ║       AnimationManager → 动画驱动                           ║
 * ║       CameraController → 镜头控制                           ║
 * ║       InteractionManager → 点击交互                         ║
 * ║       SceneManager     → 场景切换                           ║
 * ║       EffectManager    → 特效管理                           ║
 * ║       CommandBus       → 命令派发                           ║
 * ║       ResourceTracker  → 资源追踪                           ║
 * ║                                                           ║
 * ║    3. 运行主循环（每秒 60 帧）：                              ║
 * ║       loop() → updateAll() → render()                     ║
 * ║                                                           ║
 * ║    4. 对外暴露简洁 API：                                     ║
 * ║       start(sceneId)   → 启动                              ║
 * ║       execute(command) → 执行命令                           ║
 * ║       dispose()        → 销毁                              ║
 * ║                                                           ║
 * ║  ┌─ 模块协作关系 ─────────────────────────────────┐         ║
 * ║  │                                                 │         ║
 * ║  │  Vue Component                                  │         ║
 * ║  │       │                                         │         ║
 * ║  │       ▼                                         │         ║
 * ║  │  SceneRuntime ──→ CommandBus                    │         ║
 * ║  │       │              │                          │         ║
 * ║  │       ▼              ▼                          │         ║
 * ║  │  SceneManager    CameraController               │         ║
 * ║  │       │              │                          │         ║
 * ║  │       ▼              │                          │         ║
 * ║  │  builders/ ──→ ModelManager                     │         ║
 * ║  │       │              │                          │         ║
 * ║  │       ▼              ▼                          │         ║
 * ║  │  LayerManager    AnimationManager               │         ║
 * ║  │       │              │                          │         ║
 * ║  │       ▼              ▼                          │         ║
 * ║  │  InteractionManager  EffectManager              │         ║
 * ║  │                                                 │         ║
 * ║  └─────────────────────────────────────────────────┘         ║
 * ╚═══════════════════════════════════════════════════════════╝
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// ── 管理模块 ──
import ModelManager from './ModelManager'
import LayerManager from './LayerManager'
import AnimationManager from './AnimationManager'
import CameraController from './CameraController'
import InteractionManager from './InteractionManager'
import SceneManager from './SceneManager'
import EffectManager from './EffectManager'
import CommandBus from './CommandBus'
import ResourceTracker from './ResourceTracker'
import ParticleSystem from './ParticleSystem'
import PortalTransition from './PortalTransition'
import DemoDirector from './DemoDirector'

export default class SceneRuntime {
  /**
   * 创建运行时实例
   *
   * @param {Object}  params
   * @param {HTMLElement} params.container  挂载容器
   * @param {Object}      params.config    场景配置（来自 scene-config/）
   * @param {string}      params.mode      'iot' | 'robot'
   * @param {Function}    params.onEvent   事件回调（发射给 Vue 组件）
   * @param {Object}      params.options   运行选项（robotSpeed 等）
   */
  constructor ({ container, config, mode, onEvent, options }) {
    this.container = container
    this.config = config
    this.mode = mode
    this.options = options || {}
    this.onEvent = onEvent || (() => {})

    // ═══════════════════════════════════════════
    // Step 1: 创建 Three.js 核心三件套
    // ═══════════════════════════════════════════

    /**
     * Scene — 场景容器
     * 所有 3D 物体都添加到 scene 里
     * fog 添加雾效（远处物体逐渐消失，增加纵深感）
     */
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x020811, 96, 310)

    /**
     * PerspectiveCamera — 透视相机
     * fov=45   视野角度（45° 最常用，接近人眼）
     * aspect   宽高比（resize 时更新）
     * near=0.1 近裁面（比这更近的不渲染）
     * far=1500 远裁面（比这更远的不渲染）
     */
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500)

    /**
     * WebGLRenderer — 渲染器
     * 把 Scene + Camera 渲染到 canvas 上
     * antialias: 抗锯齿（边缘更平滑）
     * setPixelRatio: 适配高分屏（Retina 等）
     * outputColorSpace: sRGB 色彩空间（颜色更准确）
     */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x020811, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    /**
     * CSS2DRenderer — 2D 标签渲染器
     * 将 CSS2DObject（HTML 元素）投影到 3D 空间
     * 覆盖在 WebGLRenderer 上方，pointer-events: none 不拦截鼠标
     */
    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.domElement.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'
    container.appendChild(this.labelRenderer.domElement)

    /**
     * OrbitControls — 轨道控制器
     * 鼠标左键拖拽旋转、右键平移、滚轮缩放
     * enableDamping: 惯性阻尼（旋转有惯性手感）
     * dampingFactor: 阻尼系数（越小惯性越大）
     * screenSpacePanning: false → 平移沿世界 XZ 平面
     *
     * 注意：每帧必须调用 controls.update() 才能使阻尼生效
     */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = false

    // ═══════════════════════════════════════════
    // Step 2: 创建管理模块
    // ═══════════════════════════════════════════

    const models = new ModelManager()
    const resources = new ResourceTracker()
    const anims = new AnimationManager()
    const layers = new LayerManager(this.scene)
    const camera = new CameraController(this.camera, this.controls, this.renderer)
    const interactions = new InteractionManager(this.camera, this.renderer.domElement)
    const effects = new EffectManager(layers, anims)

    // ── 粒子系统（仅园区场景显示）──
    const particles = new ParticleSystem(this.scene, {
      count: 250,
      bounds: { x: 110, y: [12, 55], z: 60 }
    })

    // ── 传送门转场 ──
    const portal = new PortalTransition(this.container)

    const sceneManager = new SceneManager({ models, layers, anims, interactions, resources, effects })
    const commandBus = new CommandBus()

    // 保存引用
    this.models = models
    this.resources = resources
    this.anims = anims
    this.layers = layers
    this.cameraCtrl = camera
    this.interactions = interactions
    this.sceneManager = sceneManager
    this.effects = effects
    this.commandBus = commandBus
    this.particles = particles
    this.portal = portal
    this.director = null // DemoDirector 在 start() 之后延迟初始化
    this._pendingSceneSwitch = null

    // 设置事件回调
    this.interactions.setEventCallback((type, payload) => {
      this.emit(type, payload)
    })

    // 同步模式到相机控制器
    camera.mode = mode

    // ═══════════════════════════════════════════
    // Step 3: 设置灯光
    // ═══════════════════════════════════════════

    /**
     * 灯光系统：
     * AmbientLight — 环境光（均匀照亮所有物体，无方向）
     * DirectionalLight — 平行光（模拟太阳光，有方向）
     * PointLight — 点光源（从一点向四周发散）
     */
    this.scene.add(new THREE.AmbientLight(0xb7f8ff, 0.82))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25)
    dirLight.position.set(80, 130, 70)
    this.scene.add(dirLight)
    const pointLight = new THREE.PointLight(0x00f5ff, 4, 180)
    pointLight.position.set(0, 48, 0)
    this.scene.add(pointLight)

    // ═══════════════════════════════════════════
    // Step 4: 注册命令
    // ═══════════════════════════════════════════

    this.commandBus.registerAll({
      FOCUS_PRESET: (cmd) => {
        const result = this.cameraCtrl.focusPreset(cmd.preset)
        if (result === '__follow__') {
          this.cameraCtrl.startFollow(this.sceneManager.robot)
        }
      },
      FOCUS_NODE: (cmd) => {
        const item = this.interactions.getNode(cmd.nodeId) ||
                     this.interactions.getDevice(cmd.nodeId)
        this.cameraCtrl.focusNode(item)
      },
      DRILL_TO: (cmd) => {
        this.drillTo(cmd.sceneId, cmd.fromNodeId)
      },
      BACK_SCENE: () => {
        this.backScene()
      },
      SHOW_ALARM: (cmd) => {
        this.showAlarm(cmd.deviceId || cmd.nodeId)
      },
      START_TOUR: () => {
        this.cameraCtrl.startTour()
      },
      STOP_TOUR: () => {
        this.cameraCtrl.stopTour()
      },
      FOLLOW_ROBOT: () => {
        this.cameraCtrl.startFollow(this.sceneManager.robot)
      },
      START_DEMO: () => {
        // 延迟初始化 DemoDirector（确保所有引用已就绪）
        if (!this.director) {
          this.director = new DemoDirector({
            execute: (cmd) => this.execute(cmd),
            emit: (type, payload) => this.emit(type, payload),
            onTransition: async (targetScene) => {
              await this.portal.execute(async () => {
                this.emit('switch-scene', { scene: targetScene })
                await new Promise(resolve => {
                  this._pendingSceneSwitch = resolve
                })
              })
            }
          })
        }
        this.director.start()
      },
      STOP_DEMO: () => {
        if (this.director) this.director.stop()
      },
      SCENE_SWITCH_READY: () => {
        if (this._pendingSceneSwitch) {
          this._pendingSceneSwitch()
          this._pendingSceneSwitch = null
        }
      },
    })

    // ═══════════════════════════════════════════
    // Step 5: 绑定事件
    // ═══════════════════════════════════════════

    this._onPick = this._onPick.bind(this)
    this._onResize = this._onResize.bind(this)
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onWheel = this._onWheel.bind(this)

    this.renderer.domElement.addEventListener('pointerdown', this._onPick)
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('wheel', this._onWheel)
    window.addEventListener('resize', this._onResize)
    this._onResize()
  }

  /* ══════════════════════════════════════════
   *  生命周期
   * ══════════════════════════════════════════ */

  /**
   * 启动运行时
   * @param {string} sceneId 初始场景 ID
   */
  start (sceneId) {
    this.sceneManager.initStack(sceneId)
    this._loadScene(sceneId, true)
    this.running = true
    this._loop()
  }

  /**
   * 销毁运行时
   * 释放所有 GPU 资源、移除事件监听、清空 DOM
   *
   * 清理顺序：
   *   1. 停止渲染循环
   *   2. 移除 DOM 事件监听
   *   3. 清空场景（dispose 所有 3D 物体 + GPU 资源）
   *   4. 清空动画、交互索引
   *   5. dispose 控制器、渲染器、资源追踪器
   *   6. 清理 CSS2D 标签 DOM 元素
   *   7. 清空容器
   */
  dispose () {
    this.running = false
    cancelAnimationFrame(this.raf)
    clearTimeout(this.cameraCtrl?.resumeTimer)

    // 1. 移除 DOM 事件监听
    window.removeEventListener('resize', this._onResize)
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this._onPick)
      this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
      this.renderer.domElement.removeEventListener('wheel', this._onWheel)
    }

    // 2. 清空场景（递归 dispose 所有 Geometry/Material + CSS2D DOM 元素）
    this.sceneManager.clearScene()

    // 清理新增模块
    if (this.particles) { this.particles.dispose(); this.particles = null }
    if (this.portal) { this.portal.dispose(); this.portal = null }
    if (this.director) { this.director.stop(); this.director = null }

    // 3. 额外清空动画和交互（防止 clearScene 后仍有残留）
    this.anims.clear()
    this.interactions.clear()

    // 4. 递归 dispose 场景中直接添加的物体（灯光等，不在图层中）
    if (this.scene) {
      while (this.scene.children.length > 0) {
        const child = this.scene.children[0]
        this.layers._disposeRecursive(child)
        this.scene.remove(child)
      }
    }

    // 5. dispose 控制器和渲染器
    if (this.controls) this.controls.dispose()
    if (this.renderer) this.renderer.dispose()

    // 6. 释放 ResourceTracker 追踪的所有资源
    if (this.resources) this.resources.disposeAll()

    // 7. 移除 CSS2DRenderer 的 DOM 容器（清理残留的 CSS2D 标签元素）
    if (this.labelRenderer?.domElement) {
      // 清理 CSS2DRenderer 内部缓存的所有 DOM 子元素
      while (this.labelRenderer.domElement.firstChild) {
        this.labelRenderer.domElement.removeChild(this.labelRenderer.domElement.firstChild)
      }
      if (this.labelRenderer.domElement.parentNode) {
        this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement)
      }
    }

    // 8. 清空容器（兜底清理，移除 renderer canvas 等）
    this.container.innerHTML = ''

    // 9. 释放引用，帮助 GC
    this.renderer = null
    this.labelRenderer = null
    this.scene = null
    this.camera = null
    this.controls = null
  }

  /* ══════════════════════════════════════════
   *  事件处理
   * ══════════════════════════════════════════ */

  /** 发射事件到 Vue 组件 */
  emit (type, payload) {
    this.onEvent({ type, ...payload })
  }

  /** 用户拖拽/点击 → 暂停导览 + 退出跟随 */
  _onPointerDown () {
    this.cameraCtrl.pauseTourOnInteraction()
  }

  /** 用户滚轮 → 暂停导览 */
  _onWheel () {
    if (this.cameraCtrl.tour.active) {
      this.cameraCtrl.tour.paused = true
      clearTimeout(this.cameraCtrl.resumeTimer)
      this.cameraCtrl.resumeTimer = setTimeout(() => {
        this.cameraCtrl.tour.paused = false
      }, 10000)
    }
  }

  /** 点击拾取 */
  _onPick (event) {
    const meta = this.interactions.pick(event)
    if (meta?.action === 'drill') {
      this.drillTo(meta.drillSceneId, meta.id)
    }
  }

  /** 窗口 resize */
  _onResize () {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.cameraCtrl.resize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  /* ══════════════════════════════════════════
   *  命令执行（对外 API）
   * ══════════════════════════════════════════ */

  /** 执行命令（Vue 组件调用） */
  execute (cmd) {
    this.commandBus.execute(cmd)
  }

  /* ══════════════════════════════════════════
   *  主循环
   * ══════════════════════════════════════════ */

  /**
   * 渲染主循环 — 每秒约执行 60 次
   *
   * 每一帧的执行顺序：
   *   1. updateRobot  → 更新机器人位置和拖尾
   *   2. updateTour   → 更新导览计时器
   *   3. updateFly    → 更新飞行动画
   *   4. controls.update() → 更新轨道控制器（阻尼）
   *   5. followUpdate → 更新跟随相机
   *   6. clampCamera  → 约束相机位置
   *   7. anims.tick() → 驱动所有注册动画
   *   8. render       → WebGL 渲染
   *   9. labelRender  → CSS2D 标签渲染
   */
  _loop () {
    if (!this.running) return
    this.raf = requestAnimationFrame(() => this._loop())

    const dt = Math.min(this.anims.clock.getDelta(), 0.05)
    const t = performance.now() / 1000

    // 1. 更新机器人运动
    this._updateRobot(dt)

    // 2. 更新导览
    this.cameraCtrl.updateTour(
      dt,
      (cmd) => this.execute(cmd),
      (type, payload) => this.emit(type, payload)
    )

    // 3. 更新飞行动画
    this.cameraCtrl.updateFly(dt)

    // 4. 更新轨道控制器（必须每帧调用，否则阻尼无效）
    this.controls.update()

    // 5. 更新跟随相机
    this.cameraCtrl.followUpdate(this.sceneManager.robot)

    // 6. 约束相机位置
    this.cameraCtrl.clampCamera()

    // 7. 驱动所有注册动画（脉冲、旋转、缩放等）
    this.anims.tick(t, dt)

    // 8. 更新浮动数据粒子（仅园区场景）
    if (this.particles && this.sceneManager.currentConfig?.type === 'park') {
      this.particles.update(t)
    }

    // 9. 演示导演推进
    if (this.director) {
      this.director.tick(dt)
    }

    // 10. WebGL 渲染
    this.renderer.render(this.scene, this.camera)

    // 11. CSS2D 标签渲染
    this.labelRenderer.render(this.scene, this.camera)
  }

  /* ══════════════════════════════════════════
   *  场景管理
   * ══════════════════════════════════════════ */

  _loadScene (sceneId, instant) {
    const result = this.sceneManager.loadScene(
      sceneId, this.config, this.mode, this.options, instant
    )
    if (!result) return

    // 同步相机配置
    this.cameraCtrl.currentConfig = this.sceneManager.currentConfig
    this.cameraCtrl.currentConfig._tourSteps = this.config.tours?.[sceneId] || []

    // 应用控制约束
    const ctrl = this.sceneManager.currentConfig.controls || {}
    this.controls.minDistance = ctrl.minDistance || 36
    this.controls.maxDistance = ctrl.maxDistance || 180
    this.controls.maxPolarAngle = Math.PI / 2.08

    // 飞到默认视角
    if (result.cameraPreset) {
      this.cameraCtrl.flyTo(
        result.cameraPreset.position,
        result.cameraPreset.target,
        instant ? 0.01 : 1.2
      )
    }

    this.emit('scene-change', {
      title: this.sceneManager.currentConfig.title,
      sceneId
    })

    // 粒子显隐：仅在园区场景显示
    if (this.particles) {
      if (this.sceneManager.currentConfig.type === 'park') {
        this.particles.start()
      } else {
        this.particles.setVisible(false)
      }
    }

    // 楼层扫描环：进入楼层时触发
    if (this.sceneManager.currentConfig.type === 'floor' && !instant) {
      this._playFloorScanRing()
    }
  }

  /** 下钻到子场景 */
  drillTo (sceneId, fromNodeId) {
    if (!this.sceneManager.drillTo(sceneId)) return
    this.emit('drill-down', { title: `下钻：${sceneId}`, sceneId, fromNodeId })
    this._loadScene(sceneId)
  }

  /** 返回上一级 */
  backScene () {
    const prevId = this.sceneManager.backScene()
    this.emit('back-scene', { title: `返回：${prevId}`, sceneId: prevId })
    this._loadScene(prevId)
  }

  /* ══════════════════════════════════════════
   *  机器人运动更新
   * ══════════════════════════════════════════ */

  _updateRobot (dt) {
    const { robot, motion, waypoints, trailBuf, trailGeo } = this.sceneManager
    if (!robot || !motion || motion.paused) return

    const cur = waypoints[motion.index]
    const ni = (motion.index + 1) % waypoints.length
    const nxt = waypoints[ni]

    // 停留清洁
    if (motion.dwell > 0) {
      motion.dwell -= dt
      this.emit('robot-state', {
        title: cur.name,
        dwellLeft: Math.max(0, motion.dwell),
        currentSpeed: 0
      })
      robot.rotation.y += Math.sin(performance.now() / 1000 * 1.4) * 0.002
      return
    }

    // 移动插值
    const dis = cur.vector.distanceTo(nxt.vector)
    motion.progress += (motion.speed * dt) / Math.max(dis, 1)

    if (motion.progress >= 1) {
      motion.index = ni
      motion.progress = 0
      motion.dwell = (nxt.dwell || 3) * motion.dwellScale
      if (ni === 0 && trailBuf) {
        trailBuf.length = 0
        if (trailGeo) trailGeo.setFromPoints([])
      }
      this.emit('robot-dwell', { title: `机器人停留清洁：${nxt.name}` })
      return
    }

    const pos = cur.vector.clone().lerp(nxt.vector, motion.progress)
    const look = pos.clone().lerp(nxt.vector, 0.2)
    robot.position.copy(pos)
    robot.lookAt(look.x, look.y, look.z)

    // 更新清洁拖尾
    if (trailBuf && trailGeo) {
      trailBuf.push(pos.clone())
      if (trailBuf.length > 80) trailBuf.shift()
      trailGeo.setFromPoints(trailBuf)
    }

    const total = waypoints.length - 1
    const progress = Math.min(99, ((motion.index + motion.progress) / total) * 100)
    this.emit('robot-state', {
      title: cur.name,
      progress,
      currentSpeed: motion.speed,
      battery: Math.max(62, Math.round(76 - progress * 0.08))
    })

    // 同步电池数据和 progress 到 robot.userData（供光环动画和粒子预亮使用）
    if (robot && robot.userData) {
      robot.userData.battery = Math.max(62, Math.round(76 - progress * 0.08))
    }
    window.__robotMotionProgress = progress

    // 更新清洁覆盖热力图
    const { heatGrid } = this.sceneManager
    if (heatGrid && !this._heatMeshes) {
      this._heatMeshes = []
    }
    if (heatGrid && this._heatMeshes) {
      this._updateHeatMap(heatGrid, this._heatMeshes, pos)
    }
  }

  /* ══════════════════════════════════════════
   *  告警
   * ══════════════════════════════════════════ */

  showAlarm (id) {
    const item = this.interactions.getDevice(id) ||
      this.interactions.getAllDevices().find(v => v.meta.alarm) ||
      this.interactions.getDevice('robot')
    if (!item) return

    this.effects.showAlarm(
      item,
      this.sceneManager.robot,
      (pos, tar) => this.cameraCtrl.flyTo(pos, tar, 1)
    )
    this.emit('alarm', { title: item.meta.title, id: item.meta.id })
  }

  /* ══════════════════════════════════════════
   *  楼层扫描环
   * ══════════════════════════════════════════ */

  /** 播放楼层扫描环动画 */
  _playFloorScanRing () {
    const ringGeo = new THREE.TorusGeometry(60, 0.3, 16, 100)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.5
    this.layers.addTo('effect', ring)

    const startTime = performance.now()
    this.anims.register('floor_scan_ring', (t) => {
      const elapsed = (performance.now() - startTime) / 1000
      const progress = Math.min(1, elapsed / 2.5)
      ring.position.y = 0.5 + progress * 11.5
      ring.material.opacity = 0.5 * (1 - progress)
      ring.scale.setScalar(1 + progress * 0.15)
      if (progress >= 1) {
        this.layers.get('effect').remove(ring)
        ringGeo.dispose()
        ringMat.dispose()
        this.anims.remove('floor_scan_ring')
      }
    })
  }

  /** 更新清洁覆盖热力图 */
  _updateHeatMap (grid, meshes, robotPos) {
    grid.forEach((cell, i) => {
      if (cell.covered) return
      const dx = robotPos.x - cell.x
      const dz = robotPos.z - cell.z
      if (Math.abs(dx) < cell.size / 2 + 3 && Math.abs(dz) < cell.size / 2 + 3) {
        cell.covered = true
        const cellMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cell.size * 0.9, cell.size * 0.9),
          new THREE.MeshBasicMaterial({
            color: 0x00f5ff,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        )
        cellMesh.rotation.x = -Math.PI / 2
        cellMesh.position.set(cell.x, 0.55, cell.z)
        this.layers.addTo('effect', cellMesh)
        meshes.push(cellMesh)
      }
    })
  }
}
