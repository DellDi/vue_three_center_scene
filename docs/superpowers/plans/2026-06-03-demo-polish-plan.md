# 周五演示视觉全面升级 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有数字孪生平台基础上增加 7 个视觉/交互模块，打造面向售前获客的 135 秒自动演示体验。

**Architecture:** 4 个新增独立模块（ParticleSystem、PortalTransition、RobotEffects、DemoDirector）+ 1 个现有模块增强（CameraController.flyPath）+ 3 个 Vue 组件 UI 升级。所有模块通过 SceneRuntime 统一集成，不修改现有架构（CommandBus / 配置数据 / 图层系统 / 交互逻辑）。

**Tech Stack:** Three.js (WebGL) + Vue 2 + CSS backdrop-filter + Canvas 2D

---

## 文件结构总览

| # | 操作 | 文件 | 职责 |
|---|------|------|------|
| 1 | 新增 | `src/three-core/ParticleSystem.js` | 200-300 浮动数据粒子 |
| 2 | 新增 | `src/three-core/PortalTransition.js` | Canvas 2D 粒子漩涡转场 |
| 3 | 新增 | `src/three-core/RobotEffects.js` | 热力图 + 状态光环 + 路径预亮 |
| 4 | 新增 | `src/three-core/DemoDirector.js` | 135 秒时间线导演 |
| 5 | 修改 | `src/three-core/CameraController.js` | 多段路径飞行 `flyPath()` |
| 6 | 修改 | `src/scene-builders/park.builder.js` | 建筑呼吸窗 + 光柱 + 道路扫描 |
| 7 | 修改 | `src/scene-builders/robot.builder.js` | 状态光环 + 路径预亮 + 热力图 |
| 8 | 修改 | `src/three-core/SceneRuntime.js` | 集成粒子/转场/导演/扫描环 |
| 9 | 修改 | `src/App.vue` | 毛玻璃样式 + Demo 按钮 + 章节标题 + 转场 overlay |
| 10 | 修改 | `src/components/IotCenterScene.vue` | 毛玻璃面板 + 数字跳动 |
| 11 | 修改 | `src/components/RobotCenterScene.vue` | 毛玻璃面板 + 数字跳动 |

---

### Task 1: 新增 ParticleSystem 模块

**Files:**
- Create: `src/three-core/ParticleSystem.js`

- [ ] **Step 1: 创建 ParticleSystem.js**

```javascript
/**
 * ParticleSystem.js — 园区场景浮动数据粒子
 *
 * 在场景上空生成数百个缓慢浮动的光点，暗示"万物互联、数据流动"。
 * 使用 THREE.Points 单次渲染，对性能无影响。
 */
import * as THREE from 'three'

export default class ParticleSystem {
  /**
   * @param {THREE.Scene} scene  主场景
   * @param {Object}      opts   { count: 250, bounds: { x: 110, y: [12, 55], z: 60 } }
   */
  constructor (scene, opts = {}) {
    this.scene = scene
    this.count = opts.count || 250
    this.bounds = opts.bounds || { x: 110, y: [12, 55], z: 60 }
    this.points = null
    this._phaseData = null
  }

  /** 创建粒子并添加到场景 */
  start () {
    if (this.points) return

    const positions = new Float32Array(this.count * 3)
    this._phaseData = new Float32Array(this.count * 2) // [speed, phase]

    const { x: bx, y: [yMin, yMax], z: bz } = this.bounds

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * bx * 2       // x
      positions[i * 3 + 1] = yMin + Math.random() * (yMax - yMin) // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * bz * 2       // z
      this._phaseData[i * 2] = 0.15 + Math.random() * 0.4     // speed
      this._phaseData[i * 2 + 1] = Math.random() * Math.PI * 2  // phase
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Canvas 生成径向渐变圆点贴图
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(0, 245, 255, 1)')
    gradient.addColorStop(0.25, 'rgba(0, 245, 255, 0.6)')
    gradient.addColorStop(0.6, 'rgba(0, 245, 255, 0.08)')
    gradient.addColorStop(1, 'rgba(0, 245, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 2.2,
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.6,
      color: 0x00f5ff
    })

    this.points = new THREE.Points(geometry, material)
    this.scene.add(this.points)
  }

  /**
   * 每帧更新粒子位置（由 SceneRuntime._loop 调用）
   * @param {number} t  绝对时间（秒）
   */
  update (t) {
    if (!this.points || !this._phaseData) return
    const pos = this.points.geometry.attributes.position.array
    const { y: [yMin, yMax] } = this.bounds
    for (let i = 0; i < this.count; i++) {
      const speed = this._phaseData[i * 2]
      const phase = this._phaseData[i * 2 + 1]
      const y = pos[i * 3 + 1]
      // 在 yMin ~ yMax 之间缓慢升降
      const mid = (yMin + yMax) / 2
      const amp = (yMax - yMin) / 2
      pos[i * 3 + 1] = mid + Math.sin(t * speed + phase) * amp
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }

  /** 显隐粒子（传送门转场时隐藏） */
  setVisible (v) {
    if (this.points) this.points.visible = v
  }

  /** 释放 GPU 资源 */
  dispose () {
    if (this.points) {
      this.scene.remove(this.points)
      if (this.points.geometry) this.points.geometry.dispose()
      if (this.points.material) {
        if (this.points.material.map) this.points.material.map.dispose()
        this.points.material.dispose()
      }
      this.points = null
    }
    this._phaseData = null
  }
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`（仅新增文件，无任何引用处，构建应通过）

---

### Task 2: 增强 CameraController — 多段路径飞行

**Files:**
- Modify: `src/three-core/CameraController.js`

- [ ] **Step 1: 重构 fly 状态为多段路径**

在 `CameraController` 类中，`fly` 属性从单段改为段数组结构。新增 `flyPath()` 方法，修改 `updateFly()`：

```javascript
// ── 飞行状态（重构为多段路径）──
this.fly = null // { segments: [...], index: 0, holdRemaining: 0, elapsed: 0 }
```

替换现有 `flyTo()` 和 `updateFly()`：

```javascript
  /**
   * 单段飞行（保持向后兼容）
   * @param {number[]} position  目标坐标 [x, y, z]
   * @param {number[]} target    注视目标 [x, y, z]
   * @param {number}   duration  飞行时长（秒）
   */
  flyTo (position, target, duration = 1.2) {
    this.flyPath([{ position, target, duration }])
  }

  /**
   * 多段路径飞行（新增）
   *
   * @param {Array} segments  段数组，每段 { position, target, duration, hold }
   *   hold: 到达后停留秒数（可选，默认 0）
   *
   * @example
   *   cameraCtrl.flyPath([
   *     { position: [0, 160, 0], target: [0, 0, 0], duration: 0.01 },        // 瞬间拉升
   *     { position: [0, 160, 0], target: [0, 0, 0], duration: 0.01, hold: 0.5 }, // 悬停
   *     { position: [0, 40, 30], target: [0, 0, 0], duration: 1.5 },            // 俯冲
   *   ])
   */
  flyPath (segments) {
    if (!segments || !segments.length) return
    this.followMode = false
    this.fly = {
      segments: segments.map(s => ({
        toPos: new THREE.Vector3(...s.position),
        toTar: new THREE.Vector3(...s.target),
        duration: Math.max(s.duration, 0.01),
        hold: s.hold || 0
      })),
      index: 0,
      elapsed: 0,
      holdRemaining: 0
    }
  }

  /** 每帧更新飞行动画（多段路径版） */
  updateFly (dt) {
    if (!this.fly) return
    const segs = this.fly.segments
    if (this.fly.index >= segs.length) { this.fly = null; return }

    const cur = segs[this.fly.index]

    // 停留阶段
    if (this.fly.holdRemaining > 0) {
      this.fly.holdRemaining -= dt
      if (this.fly.holdRemaining <= 0) {
        this.fly.index++
        this.fly.elapsed = 0
      }
      return
    }

    // 飞行阶段
    this.fly.elapsed += dt
    const p = Math.min(1, this.fly.elapsed / cur.duration)
    const e = easeInOutCubic(p)

    // 从当前位置（不是段起点）lerp 到段终点
    if (p < 1) {
      // 段起点：上一段的终点，或当前相机位置
      const fromPos = this.fly.index === 0 && this.fly.elapsed <= dt + 0.001
        ? this.camera.position.clone()
        : this._lastSegmentEndPos || this.camera.position.clone()
      const fromTar = this.fly.index === 0 && this.fly.elapsed <= dt + 0.001
        ? this.controls.target.clone()
        : this._lastSegmentEndTar || this.controls.target.clone()

      this.camera.position.lerpVectors(fromPos, cur.toPos, e)
      this.controls.target.lerpVectors(fromTar, cur.toTar, e)
    }

    if (p >= 1) {
      // 精确到达
      this.camera.position.copy(cur.toPos)
      this.controls.target.copy(cur.toTar)
      this._lastSegmentEndPos = cur.toPos.clone()
      this._lastSegmentEndTar = cur.toTar.clone()
      // 进入停留或下一段
      if (cur.hold > 0) {
        this.fly.holdRemaining = cur.hold
        this.fly.elapsed = 0
      } else {
        this.fly.index++
        this.fly.elapsed = 0
      }
    }
  }
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 3: park.builder 建筑特效（呼吸窗 + 光柱 + 道路扫描）

**Files:**
- Modify: `src/scene-builders/park.builder.js`

- [ ] **Step 1: 窗户改为呼吸光效**

在 `createBuilding()` 函数中，找到窗户创建循环（约行 296-309），修改材质和动画注册：

```javascript
// 窗户 — 呼吸光效
const winColor = alarm ? 0xff554f : 0x1a5a7a
const winRows = floors
const winCols = Math.max(2, Math.floor(w / 8))
const windowsList = [] // 收集窗户引用用于动画
for (let row = 0; row < winRows; row++) {
  for (let col = 0; col < winCols; col++) {
    const wy = (h / floors) * (row + 0.5)
    const wx = -w / 2 + (w / winCols) * (col + 0.5)
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(w / winCols * 0.6, h / floors * 0.45),
      new THREE.MeshStandardMaterial({
        color: winColor,
        emissive: alarm ? 0xff554f : 0x00eaff,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide
      })
    )
    win.position.set(wx, wy, d / 2 + 0.07)
    windowsList.push(win)
    g.add(win)
  }
}

// 建筑呼吸动画（offset 根据 building id 计算，实现错落效果）
const buildingOffset = (b.id || '0').charCodeAt(0) * 0.7
anims.register(`win_${b.id}`, (t) => {
  const ei = alarm
    ? 0.3 + Math.sin(t * 3 + buildingOffset) * 0.2       // 告警：快闪红色
    : 0.08 + Math.sin(t * 0.5 + buildingOffset) * 0.06     // 正常：慢呼吸
  windowsList.forEach(w => { w.material.emissiveIntensity = ei })
})
```

- [ ] **Step 2: 建筑光柱**

在 `createBuilding()` 函数末尾（`g.add(lab)` 附近），添加顶部光柱：

```javascript
// 顶部光柱
const pillarGeo = new THREE.CylinderGeometry(0.6, 0.6, 35, 8)
const pillarMat = new THREE.MeshBasicMaterial({
  color: alarm ? 0xff554f : 0xeeffff,
  transparent: true,
  opacity: alarm ? 0.06 : 0.04,
  depthWrite: false
})
const pillar = new THREE.Mesh(pillarGeo, pillarMat)
pillar.position.set(0, h + 19.5, 0)
pillar.name = `pillar_${b.id}`
g.add(pillar)

// 光柱微弱波动
anims.register(`pillar_${b.id}`, (t) => {
  pillarMat.opacity = (alarm ? 0.04 : 0.03) + Math.sin(t * 0.3 + buildingOffset) * 0.02
})
```

**注意**：光柱作为建筑 Group 的子物体会被添加到 `base` 图层，`clearAll()` 的 `_disposeRecursive` 会自动清理。

- [ ] **Step 3: 道路扫描脉冲**

在 `addRoads()` 函数中，对每条干道添加扫描脉冲。在 roads 循环（`forEach(([x, z, w, d]) => ...)`）内部末尾添加：

```javascript
// 道路扫描脉冲（仅对主干道 w>d 或 d>w 的大路）
const isWide = w > 100 || d > 100
if (isWide) {
  const pulseLen = Math.max(w, d) * 0.4
  const pulseWid = 1.8
  const pulseGeo = new THREE.PlaneGeometry(
    w > d ? pulseLen : pulseWid,
    w > d ? pulseWid : pulseLen
  )
  const pulseMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  })
  const pulse = new THREE.Mesh(pulseGeo, pulseMat)
  pulse.rotation.x = -Math.PI / 2
  pulse.position.set(x, 0.35, z)
  layers.addTo('effect', pulse)

  const roadIndex = Math.random() * 10 // 随机相位避免同步
  anims.register(`pulse_road_${x}_${z}`, (t) => {
    // 4 秒周期
    const cycle = (t * 0.25 + roadIndex) % 1
    // 沿道路方向移动
    if (w > d) {
      pulse.position.x = x + (cycle - 0.5) * w * 0.8
      pulse.position.z = z
    } else {
      pulse.position.z = z + (cycle - 0.5) * d * 0.8
      pulse.position.x = x
    }
    // opacity 先升后降
    pulseMat.opacity = Math.sin(cycle * Math.PI) * 0.35
  })
}
```

- [ ] **Step 4: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 4: robot.builder 机器人特效（状态光环 + 路径预亮）

**Files:**
- Modify: `src/scene-builders/robot.builder.js`

- [ ] **Step 1: 机器人状态光环**

在 `createRobot()` 函数中，`groundGlow` 定义之后添加状态光环：

```javascript
// 状态光环 — 颜色随电量变化
const statusRingGeo = new THREE.RingGeometry(5.5, 6.5, 64)
const statusRingMat = new THREE.MeshBasicMaterial({
  color: 0x26f2a3,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false
})
const statusRing = new THREE.Mesh(statusRingGeo, statusRingMat)
statusRing.rotation.x = -Math.PI / 2
statusRing.position.y = 0.12
```

然后将 `statusRing` 加入 robot Group 的 `add()` 调用中：

```javascript
robot.add(body, bumper, dome, lidar, front, led, brush, groundGlow, statusRing, halo, lab)
```

在动画注册区添加光环变色+脉冲动画：

```javascript
anims.register('statusRing', (t) => {
  // 模拟电池变化（从 SceneRuntime._updateRobot emit 的 battery 值获取）
  // 这里从 robot.userData 读取，SceneRuntime 会写入
  const battery = robot.userData.battery || 76
  let color
  if (battery > 50) color = new THREE.Color(0x26f2a3)      // 绿
  else if (battery > 30) color = new THREE.Color(0xffb642) // 黄
  else color = new THREE.Color(0xff554f)                    // 红
  statusRingMat.color.copy(color)
  statusRingMat.opacity = 0.25 + Math.sin(t * 4) * 0.1
  statusRing.scale.setScalar(1 + Math.sin(t * 3) * 0.03)
})
```

- [ ] **Step 2: 路径预亮**

修改 `createRobotPath()` 中粒子动画回调（`dot_0~15`），添加前后区分：

```javascript
// 流动粒子 — 前方预亮、后方暗淡
for (let i = 0; i < 16; i++) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x8fffff, transparent: true, opacity: 0.75 })
  )
  layers.addTo('route', dot)
  anims.register(`dot_${i}`, ((idx) => t => {
    const u = (idx / 16 + t * 0.025) % 1
    dot.position.copy(curve.getPoint(u))
    dot.position.y = 1.65
    // 前方粒子亮、后方暗（从 SceneRuntime 的 motion.progress 获取）
    const progress = (window.__robotMotionProgress || 0) / 100
    const particleProgress = idx / 16
    const isAhead = particleProgress > progress || (particleProgress < 0.05 && progress > 0.95)
    const baseOpacity = isAhead ? 0.6 : 0.2
    dot.material.opacity = baseOpacity + Math.sin(t * 4 + idx) * 0.2
  })(i))
}
```

- [ ] **Step 3: 清洁热力图集成**

在 `createRobotPath()` 中返回网格数据，供后续热力图使用：

```javascript
// 在 createRobotPath 返回前，计算功能区覆盖网格
const heatGrid = []
cfg.rooms.forEach(r => {
  const [rx, rz] = r.position
  const [rw, rd] = r.size
  const cellSize = 6
  const cols = Math.ceil(rw / cellSize)
  const rows = Math.ceil(rd / cellSize)
  for (let ci = 0; ci < cols; ci++) {
    for (let ri = 0; ri < rows; ri++) {
      heatGrid.push({
        x: rx - rw / 2 + cellSize * (ci + 0.5),
        z: rz - rd / 2 + cellSize * (ri + 0.5),
        size: cellSize,
        covered: false
      })
    }
  }
})

return { waypoints, trailBuf, trailGeo, heatGrid }
```

然后在 `buildRobotScene()` 中传递 `heatGrid` 到返回结果中，供 `SceneRuntime` 使用。

- [ ] **Step 4: 暴露 robot.userData.battery 和 motionProgress**

在 `createRobot()` 中添加：

```javascript
robot.userData.battery = 76
```

在动画注册区末尾返回的 `motion` 对象的同时，暴露 progress 全局引用：

```javascript
// motion 对象扩展
motion._heatGrid = heatGrid
motion._heatMeshes = []
```

- [ ] **Step 5: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 5: 新增 PortalTransition 模块

**Files:**
- Create: `src/three-core/PortalTransition.js`

- [ ] **Step 1: 创建 PortalTransition.js**

```javascript
/**
 * PortalTransition.js — 场景间传送门转场（Canvas 2D 粒子漩涡）
 *
 * 在 Vue 场景切换（IOT ↔ Robot）时播放粒子漩涡动画：
 *   定格 → 粒子螺旋汇聚 → 画面变黑 → 切换场景 → 粒子炸开 → 新场景显现
 *
 * 使用 Canvas 2D overlay，不操作 Three.js 场景，避免 GPU 状态污染。
 */
export default class PortalTransition {
  /**
   * @param {HTMLElement} container  场景容器元素（用于插入 overlay canvas）
   */
  constructor (container) {
    this.container = container
    this.canvas = null
    this.ctx = null
    this.particles = []
    this.running = false
  }

  /**
   * 执行传送门转场
   *
   * @param {Function} switchFn  场景切换回调（同步或异步）
   *   在此期间，overlay 覆盖画面、播放漩涡动画
   * @returns {Promise<void>}
   */
  async execute (switchFn) {
    if (this.running) return
    this.running = true

    this._createOverlay()
    const W = this.canvas.width
    const H = this.canvas.height
    const cx = W / 2
    const cy = H / 2

    // ── Phase 1: 粒子从随机位置向中心螺旋汇聚（1.2s）──
    this._spawnRandomParticles(100, W, H)
    await this._animate(1.2, (progress) => {
      this._clear()
      this.particles.forEach(p => {
        // 螺旋参数
        const angle = p.startAngle + progress * Math.PI * 3
        const radius = p.startRadius * (1 - progress * 0.97)
        p.x = cx + Math.cos(angle) * radius
        p.y = cy + Math.sin(angle) * radius * 0.7
        p.size = p.startSize * (1 - progress * 0.5)
        p.opacity = 0.2 + progress * 0.6
        this._drawParticle(p)
      })
    })

    // ── Phase 2: 坍缩 — 所有粒子缩到中心（0.5s）──
    await this._animate(0.5, (progress) => {
      this._clear()
      // 黑色背景渐显
      this.ctx.fillStyle = `rgba(2, 8, 17, ${progress})`
      this.ctx.fillRect(0, 0, W, H)
      this.particles.forEach(p => {
        p.x = cx + (p.x - cx) * (1 - progress)
        p.y = cy + (p.y - cy) * (1 - progress)
        p.size *= 0.96
        p.opacity *= 0.92
        this._drawParticle(p)
      })
    })

    // ── 切换场景 ──
    this._clear()
    this.ctx.fillStyle = '#020811'
    this.ctx.fillRect(0, 0, W, H)
    await switchFn()

    // ── Phase 3: 粒子从中心向外螺旋炸开（1.2s）──
    this._spawnCenterParticles(100, cx, cy)
    await this._animate(1.2, (progress) => {
      this._clear()
      // 黑色背景渐隐
      this.ctx.fillStyle = `rgba(2, 8, 17, ${1 - progress})`
      this.ctx.fillRect(0, 0, W, H)
      this.particles.forEach(p => {
        const angle = p.startAngle + progress * Math.PI * 3
        const radius = progress * p.targetRadius
        p.x = cx + Math.cos(angle) * radius
        p.y = cy + Math.sin(angle) * radius * 0.7
        p.size = p.startSize * (1 - progress * 0.4)
        p.opacity = 0.8 * (1 - progress)
        this._drawParticle(p)
      })
    })

    // ── 清理 ──
    this._removeOverlay()
    this.running = false
  }

  /* ========== 内部方法 ========== */

  _createOverlay () {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;z-index:100;pointer-events:none'
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height
    this.container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
  }

  _removeOverlay () {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    this.canvas = null
    this.ctx = null
  }

  _spawnRandomParticles (count, W, H) {
    this.particles = []
    const cx = W / 2
    const cy = H / 2
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 80 + Math.random() * Math.max(W, H) * 0.8
      this.particles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.7,
        startAngle: angle,
        startRadius: radius,
        startSize: 1.5 + Math.random() * 3,
        size: 1.5 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.3
      })
    }
  }

  _spawnCenterParticles (count, cx, cy) {
    this.particles = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      this.particles.push({
        x: cx,
        y: cy,
        startAngle: angle,
        targetRadius: 100 + Math.random() * Math.max(this.canvas.width, this.canvas.height) * 0.7,
        startSize: 2 + Math.random() * 4,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.5
      })
    }
  }

  _drawParticle (p) {
    if (p.opacity <= 0.01 || p.size <= 0.1) return
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = '#00f5ff'
    ctx.shadowColor = '#00f5ff'
    ctx.shadowBlur = p.size * 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _clear () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  _animate (duration, drawFn) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = () => {
        const elapsed = (performance.now() - start) / 1000
        const progress = Math.min(1, elapsed / duration)
        drawFn(progress)
        if (progress < 1) {
          requestAnimationFrame(tick)
        } else {
          resolve()
        }
      }
      tick()
    })
  }

  dispose () {
    this._removeOverlay()
    this.particles = []
  }
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 6: 新增 DemoDirector 模块

**Files:**
- Create: `src/three-core/DemoDirector.js`

- [ ] **Step 1: 创建 DemoDirector.js**

```javascript
/**
 * DemoDirector.js — 演示时间线导演
 *
 * 按预设时间线自动推进演示流程，替代手动操作。
 * 通过 SceneRuntime 的 execute / emit 接口控制整个演示。
 */

/** 演示时间线定义 */
const DEMO_TIMELINE = [
  { at: 0,   action: 'ACT0_OPENING' },
  { at: 5,   action: 'CHAPTER_TITLE', text: '全域感知·数字孪生' },
  { at: 7,   action: 'START_TOUR' },
  { at: 32,  action: 'CHAPTER_TITLE', text: '智慧感知' },
  { at: 34,  action: 'STOP_TOUR' },
  { at: 35,  action: 'DRILL_TO', sceneId: 'floor_b4', fromNodeId: 'b4' },
  { at: 50,  action: 'SHOW_ALARM', deviceId: 'f-water' },
  { at: 62,  action: 'BACK_SCENE' },
  { at: 72,  action: 'CHAPTER_TITLE', text: '自动执行' },
  { at: 73,  action: 'PORTAL_TRANSITION', targetScene: 'robot' },
  { at: 85,  action: 'START_TOUR' },
  { at: 108, action: 'STOP_TOUR' },
  { at: 110, action: 'SHOW_ALARM', deviceId: 'robot' },
  { at: 125, action: 'ACT3_CLOSING' },
]

export default class DemoDirector {
  /**
   * @param {Object}   deps
   * @param {Function} deps.execute      命令执行 (cmd) => void
   * @param {Function} deps.emit         事件发射 (type, payload) => void
   * @param {Function} deps.onTransition 传送门转场 (targetScene) => Promise<void>
   * @param {Function} deps.getCurrentSceneType () => 'park'|'floor'|'robot'
   */
  constructor ({ execute, emit, onTransition, getCurrentSceneType }) {
    this.execute = execute
    this.emit = emit
    this.onTransition = onTransition
    this.getCurrentSceneType = getCurrentSceneType

    this.active = false
    this.elapsed = 0
    this.nextStepIndex = 0
    this.totalDuration = DEMO_TIMELINE[DEMO_TIMELINE.length - 1].at + 10
  }

  /** 开始演示 */
  start () {
    this.active = true
    this.elapsed = 0
    this.nextStepIndex = 0
    this.emit('demo-started', { totalDuration: this.totalDuration })
  }

  /** 停止演示 */
  stop () {
    this.active = false
    this.emit('demo-stopped')
  }

  /**
   * 每帧推进时间线（由 SceneRuntime._loop 调用）
   * @param {number} dt 帧间隔（秒）
   */
  tick (dt) {
    if (!this.active) return

    this.elapsed += dt

    // 检查是否到达下一步
    while (
      this.nextStepIndex < DEMO_TIMELINE.length &&
      this.elapsed >= DEMO_TIMELINE[this.nextStepIndex].at
    ) {
      const step = DEMO_TIMELINE[this.nextStepIndex]
      this._executeStep(step)
      this.nextStepIndex++
    }

    // 检查是否结束
    if (this.elapsed >= this.totalDuration) {
      this.stop()
    }

    // 发射进度事件
    this.emit('demo-progress', {
      elapsed: this.elapsed,
      total: this.totalDuration,
      stepIndex: this.nextStepIndex
    })
  }

  /** 执行单步动作 */
  async _executeStep (step) {
    switch (step.action) {
      case 'ACT0_OPENING':
        // 通知 Vue 播放入场动画（黑屏 → 粒子汇聚 → 标题浮现）
        this.emit('act0-opening')
        break

      case 'CHAPTER_TITLE':
        this.emit('chapter-title', { text: step.text })
        break

      case 'START_TOUR':
        this.execute({ type: 'START_TOUR' })
        break

      case 'STOP_TOUR':
        this.execute({ type: 'STOP_TOUR' })
        break

      case 'DRILL_TO':
        this.execute({ type: 'DRILL_TO', sceneId: step.sceneId, fromNodeId: step.fromNodeId })
        break

      case 'SHOW_ALARM':
        this.execute({ type: 'SHOW_ALARM', deviceId: step.deviceId })
        break

      case 'BACK_SCENE':
        this.execute({ type: 'BACK_SCENE' })
        break

      case 'PORTAL_TRANSITION':
        if (this.onTransition) {
          await this.onTransition(step.targetScene)
        }
        break

      case 'ACT3_CLOSING':
        this.emit('act3-closing')
        break

      default:
        break
    }
  }
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 7: SceneRuntime 集成（粒子 + 扫描环 + 导演 + 热力图）

**Files:**
- Modify: `src/three-core/SceneRuntime.js`

- [ ] **Step 1: 导入新模块并创建实例**

在 SceneRuntime 顶部添加导入：

```javascript
import ParticleSystem from './ParticleSystem'
import PortalTransition from './PortalTransition'
import DemoDirector from './DemoDirector'
```

在构造函数 Step 2 区域（管理模块创建之后），创建新模块实例：

```javascript
// 在 effects 之后、sceneManager 之前添加：

// ── 粒子系统（仅园区场景显示）──
this.particles = new ParticleSystem(this.scene, {
  count: 250,
  bounds: { x: 110, y: [12, 55], z: 60 }
})

// ── 传送门转场 ──
this.portal = new PortalTransition(this.container)

// ── 演示导演 ──
this.director = new DemoDirector({
  execute: (cmd) => this.execute(cmd),
  emit: (type, payload) => this.emit(type, payload),
  onTransition: async (targetScene) => {
    await this.portal.execute(async () => {
      // 通知 Vue 切换场景
      this.emit('switch-scene', { scene: targetScene })
      // 等待 Vue 完成切换（通过回调）
      await new Promise(resolve => {
        this._pendingSceneSwitch = resolve
      })
    })
  },
  getCurrentSceneType: () => this.sceneManager.currentConfig?.type || 'park'
})
```

- [ ] **Step 2: 注册 DEMO 命令**

在 CommandBus.registerAll 中添加：

```javascript
START_DEMO: () => {
  this.director.start()
},
STOP_DEMO: () => {
  this.director.stop()
},
SCENE_SWITCH_READY: () => {
  if (this._pendingSceneSwitch) {
    this._pendingSceneSwitch()
  }
}
```

- [ ] **Step 3: 在 _loop 中集成粒子更新和导演 tick**

在 `_loop()` 方法中，添加粒子更新和导演推进：

```javascript
// 在 this.anims.tick(t, dt) 之后添加：

// 10. 更新浮动数据粒子（仅园区场景）
if (this.particles && this.sceneManager.currentConfig?.type === 'park') {
  this.particles.update(t)
}

// 11. 演示导演推进
if (this.director) {
  this.director.tick(dt)
}
```

- [ ] **Step 4: 在 _loadScene 中触发扫描环和粒子显隐**

在 `_loadScene()` 方法末尾（`this.emit('scene-change', ...)` 之后）添加：

```javascript
// 粒子显隐：仅在园区场景显示
if (this.particles) {
  this.particles.setVisible(cfg.type === 'park')
}

// 楼层扫描环：进入楼层时触发
if (cfg.type === 'floor' && !instant) {
  this._playFloorScanRing()
}
```

添加 `_playFloorScanRing()` 方法：

```javascript
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
    ring.position.y = 0.5 + progress * 11.5          // 0.5 → 12
    ring.material.opacity = 0.5 * (1 - progress)       // 0.5 → 0
    ring.scale.setScalar(1 + progress * 0.15)          // 1.0 → 1.15
    if (progress >= 1) {
      this.layers.get('effect').remove(ring)
      ringGeo.dispose()
      ringMat.dispose()
      this.anims.remove('floor_scan_ring')
    }
  })
}
```

- [ ] **Step 5: 更新 _updateRobot 中写入 battery 到 robot.userData**

在 `_updateRobot()` 方法的 `robot-state` emit 之后添加：

```javascript
// 同步电池数据到 robot.userData（供状态光环动画读取）
if (robot && robot.userData) {
  robot.userData.battery = Math.max(62, Math.round(76 - progress * 0.08))
}
```

同时暴露 motion progress 供路径预亮粒子使用：

```javascript
// 同步 progress 供路径粒子使用
if (window.__robotMotionProgress === undefined) {
  window.__robotMotionProgress = 0
}
window.__robotMotionProgress = progress
```

- [ ] **Step 6: 处理热力图更新**

在 `_updateRobot()` 末尾添加热力图格子标记：

```javascript
// 更新清洁热力图
const { heatGrid, _heatMeshes } = this.sceneManager
if (heatGrid && _heatMeshes) {
  this._updateHeatMap(heatGrid, _heatMeshes, pos)
}
```

添加 `_updateHeatMap()` 方法：

```javascript
/** 更新清洁覆盖热力图 */
_updateHeatMap (grid, meshes, robotPos) {
  grid.forEach((cell, i) => {
    if (cell.covered) return
    const dx = robotPos.x - cell.x
    const dz = robotPos.z - cell.z
    if (Math.abs(dx) < cell.size / 2 + 3 && Math.abs(dz) < cell.size / 2 + 3) {
      cell.covered = true
      // 创建覆盖标记
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
  // 统计覆盖率
  const covered = grid.filter(c => c.covered).length
  const coverage = grid.length > 0 ? covered / grid.length : 0
  if (robot.userData) {
    robot.userData.coverage = coverage
  }
}
```

- [ ] **Step 7: 在 dispose 中清理新模块**

在 `dispose()` 方法中（场景清理之后、释放引用之前）添加：

```javascript
// 清理新增模块
if (this.particles) { this.particles.dispose(); this.particles = null }
if (this.portal) { this.portal.dispose(); this.portal = null }
if (this.director) { this.director.stop(); this.director = null }
```

- [ ] **Step 8: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 8: Vue UI 玻璃化 + Demo 按钮 + 章节标题 + 数字动画

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/IotCenterScene.vue`
- Modify: `src/components/RobotCenterScene.vue`

- [ ] **Step 1: App.vue — 模板增强**

添加 Demo 按钮、章节标题叠加层、转场 overlay 容器。替换现有 `template`：

```html
<template>
  <div class="app-page">
    <div class="app-head">
      <div>
        <h1>智慧物业数字孪生平台</h1>
        <p>三维可视化场景交互区域，周边指标大屏由现有平台承载。</p>
      </div>
      <div class="switches">
        <button :class="{ active: active === 'iot' }" @click="active = 'iot'" :disabled="demoRunning">IOT 园区场景</button>
        <button :class="{ active: active === 'robot' }" @click="active = 'robot'" :disabled="demoRunning">机器人清洁场景</button>
        <button
          v-if="!demoRunning"
          class="demo-btn"
          @click="startDemo"
        >🎬 开始演示</button>
        <div v-else class="demo-progress-bar">
          <div class="demo-progress-fill" :style="{ width: demoProgress + '%' }"></div>
          <span class="demo-progress-label">{{ demoChapter }}</span>
        </div>
      </div>
    </div>
    <div class="app-shell" ref="shell">
      <iot-center-scene
        v-show="active === 'iot'"
        ref="iotScene"
        height="720px"
        :auto-play="false"
        @scene-event="handleSceneEvent"
      />
      <robot-center-scene
        v-show="active === 'robot'"
        ref="robotScene"
        height="720px"
        :robot-speed="7"
        :dwell-scale="1"
        :auto-play="false"
        @scene-event="handleSceneEvent"
      />

      <!-- 章节标题叠加层 -->
      <transition name="chapter">
        <div v-if="chapterTitle" class="chapter-overlay" :key="chapterTitle">
          {{ chapterTitle }}
        </div>
      </transition>
    </div>
    <div class="event-log"><b>最近事件：</b>{{ latestEvent || '点击对象、切换视角、自动导览、告警联动后，会在这里显示事件。' }}</div>
  </div>
</template>
```

- [ ] **Step 2: App.vue — Script 增强**

在 `<script>` 中添加 Demo 逻辑和场景切换处理：

```javascript
data () {
  return {
    active: 'iot',
    latestEvent: '',
    demoRunning: false,
    demoProgress: 0,
    demoChapter: '',
    chapterTitle: '',
    chapterTimer: null
  }
},
methods: {
  handleSceneEvent (event) {
    this.latestEvent = `[${event.type}] ${event.title || event.id || ''}`

    // Demo 事件处理
    if (event.type === 'demo-started') {
      this.demoRunning = true
      this.demoProgress = 0
    }
    if (event.type === 'demo-stopped') {
      this.demoRunning = false
      this.demoProgress = 100
    }
    if (event.type === 'demo-progress') {
      this.demoProgress = (event.elapsed / event.total) * 100
    }
    if (event.type === 'chapter-title') {
      this.showChapterTitle(event.text)
    }
    if (event.type === 'switch-scene') {
      this.active = event.scene
      this.$nextTick(() => {
        const runtime = this.active === 'iot'
          ? this.$refs.iotScene?.runtime
          : this.$refs.robotScene?.runtime
        if (runtime) {
          runtime.execute({ type: 'SCENE_SWITCH_READY' })
        }
      })
    }
    if (event.type === 'act0-opening') {
      this.showChapterTitle('全域感知·数字孪生')
    }
    if (event.type === 'act3-closing') {
      this.showChapterTitle('全域管控')
    }
  },
  async startDemo () {
    this.demoRunning = true
    // 确保在 IOT 场景
    if (this.active !== 'iot') {
      this.active = 'iot'
      await this.$nextTick()
    }
    // 等待 IOT runtime 就绪后启动
    await this.$nextTick()
    const runtime = this.active === 'iot'
      ? this.$refs.iotScene?.runtime
      : this.$refs.robotScene?.runtime
    if (runtime) {
      runtime.execute({ type: 'START_DEMO' })
    }
  },
  showChapterTitle (text) {
    this.chapterTitle = text
    clearTimeout(this.chapterTimer)
    this.chapterTimer = setTimeout(() => {
      this.chapterTitle = ''
    }, 2500) // 淡入0.5+保持1.5+淡出0.5
  }
}
```

- [ ] **Step 3: App.vue — 样式增强（毛玻璃 + 章节标题 + Demo 按钮）**

替换现有 `<style>` 块的 CSS：

```css
html,body{margin:0;width:100%;min-height:100%;background:#020811;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif;color:#d8fbff}*{box-sizing:border-box}
.app-page{min-height:100vh;padding:22px;background:radial-gradient(circle at 50% 0%,rgba(0,245,255,.14),transparent 34%),linear-gradient(180deg,#020811,#01050a)}
.app-head{max-width:1500px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between}
.app-head h1{margin:0;font-size:25px;letter-spacing:2px;text-shadow:0 0 20px rgba(0,245,255,.3)}
.app-head p{margin:8px 0 0;color:rgba(210,250,255,.65)}
.switches{display:flex;gap:10px;align-items:center}
.switches button{height:38px;padding:0 18px;color:#dff;border:1px solid rgba(0,245,255,.45);background:rgba(0,35,50,.65);cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:all .25s}
.switches button:hover:not(:disabled){box-shadow:0 0 16px rgba(0,245,255,.2);border-color:rgba(0,245,255,.7)}
.switches button.active{color:#fff;background:linear-gradient(180deg,rgba(0,245,255,.42),rgba(0,110,130,.55));box-shadow:0 0 16px rgba(0,245,255,.35) inset}
.switches button:disabled{opacity:.5;cursor:not-allowed}

/* Demo 按钮 */
.demo-btn{background:linear-gradient(135deg,rgba(0,245,255,.35),rgba(0,130,150,.45))!important;border-color:rgba(0,245,255,.7)!important;font-size:15px;letter-spacing:1px;animation:demo-glow 2s ease-in-out infinite}
@keyframes demo-glow{0%,100%{box-shadow:0 0 12px rgba(0,245,255,.2)}50%{box-shadow:0 0 24px rgba(0,245,255,.45)}}
.demo-progress-bar{position:relative;width:220px;height:38px;border:1px solid rgba(0,245,255,.5);background:rgba(0,22,32,.75);overflow:hidden;border-radius:2px}
.demo-progress-fill{height:100%;background:linear-gradient(90deg,rgba(0,245,255,.5),rgba(0,200,220,.35));transition:width .3s linear}
.demo-progress-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#dff;text-shadow:0 0 6px rgba(0,245,255,.3)}
.app-shell{max-width:1500px;margin:0 auto;position:relative}
.event-log{max-width:1500px;margin:12px auto 0;padding:12px 14px;border:1px solid rgba(0,245,255,.24);background:rgba(0,22,32,.65);color:rgba(220,255,255,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}

/* 章节标题叠加层 */
.chapter-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;font-size:64px;color:rgba(0,245,255,.75);text-shadow:0 0 40px rgba(0,245,255,.4);pointer-events:none;letter-spacing:8px;font-weight:bold}
.chapter-enter-active{transition:all .5s ease-out}
.chapter-leave-active{transition:all .5s ease-in}
.chapter-enter,.chapter-leave-to{opacity:0;transform:scale(1.1)}
```

- [ ] **Step 4: IotCenterScene.vue — 毛玻璃面板 + 数字动画**

在 `<style scoped>` 中，增强面板样式并添加 backdrop-filter。找到 `.toolbar`、`.tip`、`.side`、`.hint` 等关键面板：

对 `.toolbar button` 添加：
```css
backdrop-filter: blur(8px);-webkit-backdrop-filter: blur(8px);transition: all .25s
```

对 `.toolbar button:hover` 添加：
```css
box-shadow: 0 0 14px rgba(0,245,255,.18);border-color: rgba(0,245,255,.7)
```

对 `.tip` 添加：
```css
backdrop-filter: blur(12px);-webkit-backdrop-filter: blur(12px)
```

对 `.side` 添加：
```css
backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px)
```

对 `.hint` 添加：
```css
backdrop-filter: blur(6px);-webkit-backdrop-filter: blur(6px)
```

在 `<script>` 中添加数字跳动方法：

```javascript
// 数字跳动动画
animateNumber (key, targetValue, duration = 1000) {
  const start = performance.now()
  const from = this[key] || 0
  const to = targetValue
  const tick = () => {
    const elapsed = performance.now() - start
    const progress = Math.min(1, elapsed / duration)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - progress, 3)
    this[key] = Math.round(from + (to - from) * eased)
    if (progress < 1) {
      requestAnimationFrame(tick)
    }
  }
  tick()
}
```

- [ ] **Step 5: RobotCenterScene.vue — 毛玻璃面板 + 数字动画**

同 Step 4，对 `.toolbar button`、`.tip`、`.task`、`.hint` 添加 `backdrop-filter` 和 hover glow 效果。

添加 `animateNumber` 方法（同 IotCenterScene）。

- [ ] **Step 6: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

---

### Task 9: 全量构建 + 功能验证

- [ ] **Step 1: 最终构建**

```bash
npx vite build 2>&1
```

Expected: `✓ built in XXXms`，无 Error 和 Warning（chunk size warning 忽略）。

- [ ] **Step 2: 启动 Dev Server 验证**

```bash
npx vite --port 8080 &
sleep 3
echo "Server ready at http://localhost:8080"
```

- [ ] **Step 3: 浏览器验证**

用 agent-browser 打开页面，检查：
1. 页面无 JS 报错
2. 粒子系统在园区场景可见
3. 点击「开始演示」按钮可见
4. 顶部面板有毛玻璃效果

```bash
agent-browser open http://localhost:8080/
agent-browser wait 3000
agent-browser eval --stdin <<'EOF'
const errors = [];
window.onerror = (msg) => errors.push(msg);
setTimeout(() => { JSON.stringify({ errors, hasCanvas: !!document.querySelector('canvas') }); }, 2000);
EOF
```

- [ ] **Step 4: 切换场景验证**

```bash
agent-browser click @e3   # 点击「机器人清洁场景」
agent-browser wait 3000
agent-browser eval --stdin <<'EOF'
JSON.stringify({ scene: document.querySelector('.app-shell').innerHTML.includes('robot') ? 'robot' : 'iot' })
EOF
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 演示视觉全面升级 — 粒子/传送门/导演系统/建筑特效/机器人特效/UI玻璃化"
```
