# 周五演示视觉全面升级 — 设计规格书

> **目标**：面向混合观众（公司领导 + 潜在客户）的售前获客演示，打造高级、贴切、智能的数字孪生体验。
> **叙事线**：IOT 监控能力 → 机器人自动执行 → 统一平台收束。
> **约束**：不改动现有架构（CommandBus / 图层系统 / 配置数据 / 交互逻辑），只做视觉增强和 Demo 导演系统。

---

## 一、叙事时间线（完整 Demo 流程）

| 时间 | 阶段 | 画面 | 音频/文案 |
|------|------|------|-----------|
| 0-5s | **Act 0 开场** | 黑屏 → 光粒子汇聚 → 标题「智慧物业数字孪生平台」浮现 → 镜头俯冲入园 | 章节：「全域感知·数字孪生」 |
| 5-15s | **园区总览** | 浮动粒子 + 建筑呼吸窗 + 光柱 + 道路扫描脉冲 | 自动导览开始 |
| 15-35s | **自动导览** | 建筑间巡游，默认 tour 路线 | 章节：「智慧感知」 |
| 35-50s | **楼栋下钻** | 拉升→悬停→俯冲隧道→楼层展开→扫描环升起 | 告警楼栋（b4/b5）优先 |
| 50-75s | **楼层内部** | 设备点位呼吸 + 告警联动光栅球弹出 | 点击告警设备触发 |
| 75-80s | **传送门转场** | 画面定格→粒子漩涡汇聚→炸开→机器人场景 | 章节：「自动执行」 |
| 80-110s | **机器人清洁** | 轨迹追踪 + 热力图铺开 + 状态光环 + 路径预亮 | 机器人沿路径移动 |
| 110-125s | **低电量告警** | 光环绿→黄→红变色，进度<30% 触发，机器人回充 | 章节：「智能运维」 |
| 125-135s | **Act 3 收束** | 「全域管控」浮现 + 设备数/覆盖率/告警数数字滚动 | 结束黑屏 |

---

## 二、模块设计

### 模块 1：粒子系统（`ParticleSystem`）

**文件**：`src/three-core/ParticleSystem.js`（新增）

**职责**：在园区场景上空生成 200-300 个浮动光点，暗示"万物互联、数据流动"。

**技术方案**：
- 使用 `THREE.Points` + `THREE.BufferGeometry` + `THREE.PointsMaterial`
- 每个粒子：初始位置在园区范围内随机（x: -110~110, y: 12~55, z: -60~60）
- 每帧：y 方向缓慢升降 `sin(t * speed + phase)`，speed 和 phase 各不相同
- 颜色：`#00f5ff` 青色，opacity 在 0.15~0.55 之间波动
- 材质使用圆形贴图（Canvas 生成径向渐变圆点）

**API**：
```javascript
const particles = new ParticleSystem(scene, { count: 250, bounds: { x: 110, y: [12, 55], z: 60 } })
particles.start()          // 开始浮动
particles.setVisible(v)    // 显隐（传送门转场时隐藏）
particles.dispose()        // 释放 GPU 资源
```

**性能考虑**：250 个粒子用单个 Points 渲染（1 次 draw call），对性能无影响。

---

### 模块 2：建筑特效（`BuildingEffects`）

**文件**：`src/three-core/BuildingEffects.js`（新增）

**职责**：给建筑添加呼吸窗、顶部光柱、道路扫描脉冲。

#### 2.1 窗户呼吸光效

**原理**：在 `park.builder.js` 的 `createBuilding()` 中，窗户从静态 `PlaneGeometry` 改为带自发光动画的 mesh。

**实现**：
- 窗户材质从 `MeshBasicMaterial` 改为 `MeshStandardMaterial` + `emissive` 动画
- 每帧通过 AnimationManager 注册回调：`emissiveIntensity = 0.1 + Math.sin(t * 0.5 + buildingOffset) * 0.06`
- 每栋楼 offset 不同（根据 id 计算），实现错落呼吸效果
- 告警楼栋：窗户 emissive 颜色改为红色 `#ff554f`，闪烁频率加倍

**改动范围**：`park.builder.js` 的 `createBuilding()` 窗户创建部分 + 新增动画注册。

#### 2.2 建筑光柱

**原理**：每栋楼顶部中心向天空发射一道极淡的透明白色光柱。

**实现**：
- `CylinderGeometry(0.6, 0.6, 35, 8)` + `MeshBasicMaterial({ transparent: true, opacity: 0.04, color: 0xeeffff })`
- 位置：楼顶中心，y 从楼高 + 2 到楼高 + 37
- 添加微弱的垂直位移动画（`sin(t * 0.3) * 0.02` opacity 波动）
- 添加到 `effect` 图层

**改动范围**：`park.builder.js` 的 `createBuilding()`。

#### 2.3 道路扫描脉冲

**原理**：沿主干道周期性发射光波，模拟雷达扫描。

**实现**：
- 使用 `PlaneGeometry(172, 1.5)` 水平放置，位于道路上方 0.3
- 材质：`MeshBasicMaterial({ color: 0x00f5ff, transparent: true })`
- 动画：opacity 从 0→0.4→0 循环，周期 4s，沿道路方向移动
- 4 条主干道各有独立的扫描脉冲，相位错开
- 添加到 `effect` 图层

**改动范围**：`park.builder.js` 的 `addRoads()`。

---

### 模块 3：电影镜头（`CameraController` 增强）

**文件**：`src/three-core/CameraController.js`（修改）

**职责**：支持多段路径飞行、开场震撼镜头、楼层扫描环。

#### 3.1 多段路径飞行

**当前**：`flyTo(position, target, duration)` — 单段 A→B。

**增强**：新增 `flyPath(segments)`，每段 `{ position, target, duration, hold }`：
```javascript
cameraCtrl.flyPath([
  { position: [0, 160, 0], target: [0, 0, 0], duration: 0.01 },  // 瞬间到高空
  { position: [0, 160, 0], target: [0, 0, 0], duration: 0.01, hold: 0.5 },  // 悬停
  { position: [0, 40, 30], target: [0, 0, 0], duration: 1.5 },  // 俯冲
])
```

**实现**：`fly` 状态从单段改为段数组 `segments[]` + `currentSegmentIndex`。`updateFly()` 在当前段完成后自动进入下一段。

#### 3.2 楼层扫描环

**原理**：下钻到楼层后，一道光圈从地面升到天花板。

**实现**：
- `TorusGeometry(60, 0.3, 16, 100)` 或 `RingGeometry`
- 水平放置，初始 y=0.5，动画：y 从 0.5→12，opacity 0.5→0.1，scale 从 1.0→1.15
- 持续时间 2.5 秒，完成后自动移除并 dispose
- 添加到 `effect` 图层

**改动范围**：`SceneRuntime.js` 的 `_loadScene()` 中，当 `cfg.type === 'floor'` 时触发扫描环。

---

### 模块 4：传送门转场（`PortalTransition`）

**文件**：`src/three-core/PortalTransition.js`（新增）

**职责**：两个场景之间做粒子漩涡转场。

**原理**：
1. **定格**：停止渲染循环，保留最后一帧画面
2. **漩涡**：在画布中央生成 100 个粒子，从随机位置向内螺旋汇聚（1.2s）
3. **坍缩**：所有粒子聚到中心一点，画面变黑（0.5s）
4. **切换**：底层场景切换到目标场景（`active = 'robot'`）
5. **炸开**：粒子从中心向外螺旋扩散，新场景画面逐渐显现（1.2s）
6. **恢复**：粒子消失，渲染循环恢复

**实现要点**：
- 不对 Three.js 场景操作，而是用 Canvas 2D overlay 绘制粒子
- 覆盖在 WebGL canvas 上方（z-index 最高）
- 转场期间暂停 Three.js 渲染（节省性能）
- 通过回调通知 Vue 组件切换 `active`

**API**：
```javascript
const portal = new PortalTransition(container)
await portal.execute(async () => {
  // 切换场景
  this.active = 'robot'
  await this.$nextTick()
})
```

**改动范围**：`App.vue` 的场景切换逻辑 + 新增 overlay canvas。

---

### 模块 5：机器人特效（`RobotEffects`）

**文件**：`src/three-core/RobotEffects.js`（新增）

**职责**：清洁热力图、状态光环、路径预亮。

#### 5.1 清洁覆盖热力图

**原理**：机器人经过的地面留下青色半透明方块标记。

**实现**：
- 将功能区划分为 N×M 网格（每格约 6×6 单位）
- 机器人每帧检测所在格子，标记为"已覆盖"
- 已覆盖格子上放置 `PlaneGeometry(6, 6)` 半透明平面（opacity 0.08, color 0x00f5ff）
- 全部格子覆盖后 opacity 统一缓慢降为 0（表示清洁完成）
- 覆盖比例实时计算，供 Act 3 收束阶段使用

**性能**：约 50-80 个平面，性能无影响。

#### 5.2 机器人状态光环

**原理**：底盘下方一个发光圆环，颜色随电量/状态变化。

**实现**：
- `RingGeometry(5.5, 6.5, 64)` 水平放置，y=0.1
- 材质：`MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: DoubleSide })`
- 颜色映射：电量 >50% → `#26f2a3`(绿)，30-50% → `#ffb642`(黄)，<30% → `#ff554f`(红)
- 每帧更新颜色（根据 `motion.battery`）
- 脉冲：`opacity = 0.25 + Math.sin(t * 4) * 0.1`
- 添加到机器人 Group 的 children

**改动范围**：`robot.builder.js` 的 `createRobot()`。

#### 5.3 路径预亮

**原理**：规划路径上，前方粒子比后方粒子更亮。

**实现**：
- 现有 16 个流动粒子 `dot_0~15`
- 修改动画回调：根据机器人当前位置，判断粒子是在前方还是后方
- 前方粒子 opacity：0.65~0.85，后方粒子 opacity：0.2~0.35
- 通过 `curve.getPoint(u)` 计算粒子位置对应的路径参数，与 `motion.progress` 比较

**改动范围**：`robot.builder.js` 的 `createRobotPath()` 中的粒子动画回调。

---

### 模块 6：UI 玻璃化（Vue 组件增强）

**文件**：`src/App.vue`、`src/components/IotCenterScene.vue`、`src/components/RobotCenterScene.vue`（修改）

**职责**：四个 UI 增强——毛玻璃面板、Demo 播放按钮、章节标题、数字动画。

#### 6.1 毛玻璃面板

**样式变更**：
- 所有面板：`background: rgba(1, 22, 32, 0.65)` + `backdrop-filter: blur(12px)` + `border: 1px solid rgba(0, 245, 255, 0.25)`
- 按钮：`background: rgba(0, 35, 50, 0.65)` + hover 时 `box-shadow: 0 0 16px rgba(0, 245, 255, 0.2)` + glow 扩散动画
- 工具栏：`backdrop-filter: blur(8px)`

#### 6.2 Demo 自动播放按钮

**位置**：App.vue 顶部右侧，场景切换按钮旁边。

**UI**：
- 大号按钮「🎬 开始演示」，点击后变为进度条
- 进度条分三段（对应 Act 1/2/3），实时反映当前进度
- 旁边显示当前章节名（如「智慧感知」）

**逻辑**：
- 点击后通过 `execute()` 派发 `START_DEMO` 命令
- SceneRuntime 新增 `DemoDirector` 模块负责时间线调度（见模块 7）
- 演示结束后按钮恢复

#### 6.3 章节标题叠加层

**位置**：场景容器正中央，与 3D canvas 同级，z-index 高于 canvas。

**UI**：
- 巨大半透明汉字：`font-size: 64px; color: rgba(0, 245, 255, 0.75); text-shadow: 0 0 40px rgba(0, 245, 255, 0.4)`
- 淡入 0.5s → 保持 1.5s → 淡出 0.5s
- 使用 CSS transition（opacity + transform scale）
- 章节文案：「全域感知·数字孪生」→「智慧感知」→「自动执行」→「全域管控」

**触发**：SceneRuntime emit `chapter-title` 事件 → Vue 组件显示。

#### 6.4 数字跳动动画

**位置**：IotCenterScene 顶部 badges、RobotCenterScene 任务面板。

**实现**：
- 新增 `AnimatedNumber` 方法（Vue methods）
- 使用 `requestAnimationFrame` + easeOutCubic，数字从 0 滚到目标值，耗时 1s
- 触发时机：场景加载完成、设备在线数更新

**改动范围**：仅 Vue 组件的 data 和方法。

---

### 模块 7：Demo 导演系统（`DemoDirector`）

**文件**：`src/three-core/DemoDirector.js`（新增）

**职责**：统一调度整个演示的时间线，替代手动操作。

**设计**：

```javascript
// 时间线配置
const DEMO_TIMELINE = [
  // { at: seconds, command: { type, ... }, description }
  { at: 0,   action: 'ACT0_OPENING' },
  { at: 5,   action: 'CHAPTER_TITLE', text: '全域感知·数字孪生' },
  { at: 7,   action: 'START_TOUR' },
  { at: 35,  action: 'DRILL_TO', sceneId: 'floor_b4', fromNodeId: 'b4' },
  { at: 42,  action: 'CHAPTER_TITLE', text: '智慧感知' },
  { at: 55,  action: 'SHOW_ALARM', deviceId: 'f-water' },
  { at: 65,  action: 'BACK_SCENE' },
  { at: 75,  action: 'PORTAL_TRANSITION', targetScene: 'robot' },
  { at: 80,  action: 'CHAPTER_TITLE', text: '自动执行' },
  { at: 115, action: 'SHOW_ALARM', deviceId: 'robot' },
  { at: 125, action: 'ACT3_CLOSING' },
]
```

**API**：
```javascript
const director = new DemoDirector({
  execute: (cmd) => runtime.execute(cmd),   // 派发命令
  emit: (type, payload) => runtime.emit(type, payload),  // 发射事件
  onTransition: (targetScene) => { /* 传送门转场 */ },
})

director.start()   // 开始演示
director.stop()    // 中断演示
director.tick(dt)  // 每帧由 loop 调用，推进时间线
```

**集成点**：
- `SceneRuntime` 构造函数中创建 `DemoDirector`
- `SceneRuntime._loop()` 中调用 `director.tick(dt)`
- 新命令 `START_DEMO` / `STOP_DEMO` 注册到 CommandBus

---

## 三、文件变更清单

| 操作 | 文件 | 变更内容 |
|------|------|----------|
| **新增** | `src/three-core/ParticleSystem.js` | 浮动数据粒子 |
| **新增** | `src/three-core/PortalTransition.js` | 传送门转场 |
| **新增** | `src/three-core/RobotEffects.js` | 热力图 + 状态光环 |
| **新增** | `src/three-core/DemoDirector.js` | 时间线导演 |
| **修改** | `src/three-core/CameraController.js` | 多段路径飞行 `flyPath()` |
| **修改** | `src/three-core/SceneRuntime.js` | 集成粒子、转场、导演、扫描环触发 |
| **修改** | `src/three-core/SceneManager.js` | 暴露 `currentSceneType` 供导演使用 |
| **修改** | `src/scene-builders/park.builder.js` | 光柱、道路扫描、窗户呼吸 |
| **修改** | `src/scene-builders/robot.builder.js` | 状态光环、路径预亮、热力图 |
| **修改** | `src/App.vue` | 毛玻璃 + Demo 按钮 + 章节标题 + 转场 overlay |
| **修改** | `src/components/IotCenterScene.vue` | 毛玻璃面板 + 数字动画 |
| **修改** | `src/components/RobotCenterScene.vue` | 毛玻璃面板 + 数字动画 |

---

## 四、自检清单

- [x] 没有修改 CommandBus 接口
- [x] 没有修改场景配置数据结构
- [x] 没有修改图层系统
- [x] 没有修改动画系统
- [x] 所有新增 GPU 资源都在 `_disposeRecursive` 覆盖范围内（添加到图层中）
- [x] 毛玻璃 `backdrop-filter` 兼容 Chrome/Edge（演示用浏览器）
- [x] 粒子系统使用单个 Points（1 次 draw call）
- [x] 传送门转场用 Canvas 2D overlay，不碰 Three.js 场景
- [x] DemoDirector 为可选模块，不启动时不占性能
- [x] 所有新增模块遵循现有代码风格（JSDoc + 中文注释）
