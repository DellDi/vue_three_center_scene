# Vue2 + Three.js 中间 3D 场景组件 V2

这版只保留“中间那块”的 Three.js 场景组件，周边二维指标、表格、图表不再内置，方便直接嵌入现有大屏布局。

## 组件

```text
src/components/IotCenterScene.vue
src/components/RobotCenterScene.vue
```

## 已覆盖的演示能力

### RobotCenterScene.vue

- 机器人运动速度降低，不再快速穿场。
- 机器人在关键清洁区域会停留一段时间。
- 停留时有轻微扫动，不会像卡死。
- 增加 `robotSpeed` 和 `dwellScale` 参数，方便演示时调节。
- 限制 OrbitControls 缩放范围，避免缩得过小、拉得过远、黑边和穿模。
- 去掉厚重正方体底座，仅保留薄平面和线框墙体。
- 支持楼层俯视、机器人跟随、充电区视角、模拟余量告警、点击机器人 / 区域 / 充电桩弹窗。

### IotCenterScene.vue

- 已移除 IOT 场景里的机器人路线。
- 改为园区设备点位：摄像头、烟感、温度、液位、门禁、消防、充电监测、道闸。
- 支持点击楼栋下钻到楼层内部。
- 下钻不是简单拉近，而是切换到“楼层内部场景”：公共走廊、大堂、电梯厅、水泵房、配电房、设备间、监控室、楼层设备点位。
- 支持返回园区。
- 下钻 / 返回有过渡遮罩和镜头飞行。
- 限制缩放范围，避免黑边和穿模。
- 去掉厚重正方体底座，仅用平面、线框和半透明区域。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:8080
```

## 组件使用示例

```vue
<template>
  <div>
    <iot-center-scene
      height="620px"
      @scene-event="handleSceneEvent"
    />

    <robot-center-scene
      height="620px"
      :robot-speed="5.2"
      :dwell-scale="1"
      @scene-event="handleSceneEvent"
    />
  </div>
</template>

<script>
import IotCenterScene from './components/IotCenterScene.vue'
import RobotCenterScene from './components/RobotCenterScene.vue'

export default {
  components: {
    IotCenterScene,
    RobotCenterScene
  },
  methods: {
    handleSceneEvent (event) {
      console.log(event)
    }
  }
}
</script>
```

## 对接真实业务数据建议

当前设备、楼栋、房间、路径都写在组件内部，方便一周 Demo 快速落地。

后续建议拆成 props：

```js
buildings
parkDevices
floorRooms
floorDevices
robotWaypoints
alarmEvents
```

然后用 WebSocket / MQTT / HTTP 轮询替换模拟事件。

## 注意

这版是 Vue2 + Three.js 的演示组件，不依赖真实 3D 模型。后续可以把低模几何体替换为 glb/gltf 模型，但建议保留当前的“透明点击盒 / 点位配置 / 镜头预设 / 下钻状态机”这套结构。
