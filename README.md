# Vue Three Center Scene

Vue2 + Three.js 中间 3D 场景组件。

这次重构目标：不要把场景、下钻、动画、点击、告警、点位都写成一个大组件，后续接真实 glb/gltf 模型时也不需要推翻重写。

## 目录结构

```text
src/
├── components/
│   ├── IotCenterScene.vue          # IOT 园区场景容器
│   └── RobotCenterScene.vue        # 机器人清洁场景容器
│
├── three-core/
│   └── SceneRuntime.js             # Three 运行时：渲染、图层、点击、相机、导览、命令
│
└── scene-config/
    ├── iotScene.config.js          # 园区 / 楼层 / 点位 / 视角 / 导览配置
    └── robotScene.config.js        # 机器人区域 / 路线 / 停留 / 视角 / 导览配置
```

## 核心维护原则

### 1. Vue 只做容器

Vue 组件只负责：

- 挂载 canvas
- 显示工具栏
- 显示弹窗
- 接收 runtime 事件
- 对外 `emit scene-event`

不要在 Vue 组件里继续堆 `new THREE.Mesh`、`Raycaster`、`requestAnimationFrame`。

### 2. 场景配置化

园区、楼栋、楼层、房间、设备点位、机器人路线、相机视角、自动导览都在 `scene-config` 里维护。

后续新增一个点位，只改：

```js
scene.devices.push({ id, title, type, position, status })
```

后续新增一个视角，只改：

```js
scene.cameraPresets.xxx = { position, target }
```

### 3. 交互命令统一

Runtime 支持统一命令：

```text
FOCUS_PRESET  切换预设视角
FOCUS_NODE    聚焦对象
DRILL_TO      下钻场景
BACK_SCENE    返回上级场景
SHOW_ALARM    告警联动
START_TOUR    开始自动导览
STOP_TOUR     停止自动导览
```

按钮、点击楼栋、表格联动、告警列表联动，后续都应该走这套命令，不要各写一套逻辑。

### 4. 下钻用场景栈

内部维护：

```text
park → building_001_floor_03 → pump_room
```

返回时出栈，避免用一堆 `isPark / isFloor / isRoom` 的布尔变量控制状态。

### 5. 图层隔离

Runtime 内部默认分层：

```text
base     基础模型 / 几何体
device   设备点位
label    标签
route    机器人路线
alarm    告警光圈
effect   光圈 / 扫描 / 覆盖层
```

消防视角、安防视角、设备视角，本质上应该是：相机预设 + 图层显隐。

## 接真实模型时怎么改

当前 builder 是低模几何体：

```text
BoxGeometry / PlaneGeometry / SphereGeometry
```

后续接三方模型时，不要改 Vue 组件，不要改交互命令，优先只替换 `SceneRuntime` 里对应的建模方法：

```text
当前：createBuilding / createRoom / createDevice
后续：GLTFLoader.load('/models/park.glb')
```

模型负责视觉，业务仍然走：

```text
scene-config + 透明 hitbox + 设备点位 + 相机预设 + 告警命令
```

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:8080
```
