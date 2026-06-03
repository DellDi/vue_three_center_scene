# 3D 场景引擎架构说明

## 目录结构

```
src/
├── components/                 # Vue 组件层
│   ├── IotCenterScene.vue      #   IOT 场景容器（工具栏 + HUD）
│   ├── RobotCenterScene.vue    #   机器人场景容器（工具栏 + HUD）
│   └── App.vue                 #   顶层页面（场景切换）
│
├── three-core/                 # Three.js 引擎核心
│   ├── SceneRuntime.js         #   运行时总入口 ★
│   ├── SceneManager.js         #   场景加载/切换/销毁
│   ├── ModelManager.js         #   模型/几何体/材质工厂
│   ├── CameraController.js     #   镜头飞行/跟随/预设/导览
│   ├── InteractionManager.js   #   点击拾取/节点索引
│   ├── LayerManager.js         #   图层分组管理
│   ├── AnimationManager.js     #   帧动画注册/驱动
│   ├── EffectManager.js        #   视觉特效（告警光栅等）
│   ├── ResourceTracker.js      #   GPU/DOM 资源追踪与释放
│   └── CommandBus.js           #   命令模式派发总线
│
├── scene-builders/             # 场景构建器（Three.js 场景搭建）
│   ├── park.builder.js         #   园区鸟瞰场景
│   ├── floor.builder.js        #   楼层内部场景
│   └── robot.builder.js        #   机器人清洁场景
│
└── scene-config/               # 场景数据配置（纯数据，无 3D 逻辑）
    ├── iotScene.config.js       #   IOT 园区 + 楼层配置
    └── robotScene.config.js     #   机器人场景配置
```

## 模块职责速查

| 模块 | 一句话职责 | 关键 API |
|------|-----------|----------|
| **SceneRuntime** | 总指挥：初始化、主循环、命令分发 | `start()` `execute()` `dispose()` |
| **SceneManager** | 场景加载和切换 | `loadScene()` `clearScene()` `drillTo()` |
| **ModelManager** | 创建 3D 物体和材质 | `createLabel()` `addEdges()` `createGrid()` |
| **CameraController** | 所有镜头操作 | `flyTo()` `startFollow()` `focusPreset()` |
| **InteractionManager** | 鼠标点击→射线检测→事件 | `pick()` `addClickable()` |
| **LayerManager** | 图层分组 | `addTo()` `clearAll()` |
| **AnimationManager** | 每帧动画驱动 | `register()` `tick()` `clear()` |
| **EffectManager** | 告警等视觉特效 | `showAlarm()` |
| **CommandBus** | 命令注册和派发 | `register()` `execute()` |
| **ResourceTracker** | GPU 资源追踪 | `trackGeometry()` `disposeAll()` |

## 数据流

```
用户操作
  │
  ▼
Vue Component ──(command)──→ CommandBus ──→ CameraController
  │                              │              │
  │                              ▼              ▼
  │                        SceneManager    flyTo / follow
  │                              │
  │                              ▼
  │                      builders/ (构建3D物体)
  │                              │
  │                   ┌──────────┼──────────┐
  │                   ▼          ▼          ▼
  │             ModelManager  LayerMgr  AnimMgr
  │                   │
  │                   ▼
  │            InteractionManager ──(event)──→ Vue Component
  │                                           (更新UI)
  ▼
SceneRuntime._loop() → 每帧渲染
```

## 如何扩展

### 1. 添加新场景

```javascript
// scene-config/newScene.config.js — 写配置数据
export default {
  startSceneId: 'my_scene',
  scenes: {
    my_scene: {
      id: 'my_scene',
      title: '新场景',
      rooms: [...],
      cameraPresets: { ... }
    }
  }
}

// scene-builders/my.builder.js — 写构建逻辑
export default function buildMyScene (cfg, managers) {
  const { models, layers, anims, interactions } = managers
  layers.addTo('base', models.createGrid(200))
  cfg.rooms.forEach(r => { /* 创建房间 */ })
}

// SceneManager.js — 添加分支
if (mode === 'myMode') {
  buildMyScene(cfg, managers)
}
```

### 2. 接入 GLB 模型

```javascript
// ModelManager.js 中已有 loadGLTF() 预留接口
// 安装依赖：npm i three  (GLTFLoader 已包含在 three/examples)

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

async loadGLTF (path) {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(path)
  this.modelCache.set(path, gltf.scene)
  return gltf.scene.clone()
}

// 在 builder 中使用：
const model = await models.loadGLTF('/models/robot.glb')
model.position.set(x, y, z)
layers.addTo('device', model)
```

### 3. 对接智能设备 API

```javascript
// Vue 组件中调用 API，通过 command 更新场景
async mounted () {
  const devices = await fetch('/api/devices').then(r => r.json())
  // 更新配置数据
  // 或通过 runtime.execute() 发送命令
  this.runtime.execute({ type: 'UPDATE_DEVICE', id: 'cam1', status: 'offline' })
}

// CommandBus 中注册新命令
commandBus.register('UPDATE_DEVICE', (cmd) => {
  const item = interactions.getDevice(cmd.id)
  // 更新物体外观...
})
```

### 4. 添加新的命令类型

```javascript
// CommandBus.js — 只需 register 即可
commandBus.register('MY_COMMAND', (cmd) => {
  // cmd = { type: 'MY_COMMAND', param1: '...' }
  // 执行操作...
})
```

## Three.js 新手指南

### 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| Scene | 3D 世界容器 | 舞台 |
| Camera | 观察者（眼睛） | 摄像机 |
| Renderer | 把3D画到canvas上 | 投影仪 |
| Mesh | 可见物体 = 形状+材质 | 道具 |
| Geometry | 形状（顶点、面） | 骨架 |
| Material | 外观（颜色、光泽） | 皮肤 |
| Group | 物体编组（父子关系） | 道具组 |
| Light | 光源 | 灯光 |
| OrbitControls | 鼠标交互控制 | 摇臂 |

### 坐标系

```
      Y (上)
      │
      │
      └─── X (右)
     ╱
    Z (朝向你)
```

### 常用操作

```javascript
// 移动物体
mesh.position.set(x, y, z)

// 旋转（弧度）
mesh.rotation.y = Math.PI / 4  // 绕 Y 轴转 45°

// 缩放
mesh.scale.setScalar(2)  // 均匀放大 2 倍

// 添加到场景
scene.add(mesh)
// 或添加到图层
layers.addTo('device', mesh)

// 创建方块
const box = new THREE.Mesh(
  new THREE.BoxGeometry(10, 5, 8),        // 宽10 高5 深8
  new THREE.MeshStandardMaterial({         // PBR 材质
    color: 0x00ff00,                       // 绿色
    roughness: 0.5,                        // 半粗糙
    metalness: 0.3,                        // 微金属感
    transparent: true,                     // 开启透明
    opacity: 0.8                           // 80% 不透明
  })
)
```
