export default {
  startSceneId: 'park',
  scenes: {
    park: {
      id: 'park',
      title: '设备场景总览',
      subtitle: '园区视角：点击楼栋下钻到楼层内部',
      type: 'park',
      controls: { minDistance: 42, maxDistance: 190 },
      cameraPresets: {
        default: { position: [96, 72, 108], target: [0, 4, 0] },
        fire: { position: [-35, 44, 10], target: [-52, 8, -20] },
        security: { position: [-84, 42, 30], target: [-74, 8, 34] },
        room: { position: [-34, 38, 54], target: [-20, 6, 22] }
      },
      buildings: [
        { id: 'b1', title: '1号楼', position: [-50, 0, -22], size: [36, 25, 28], status: '正常', drillSceneId: 'building_001_floor_03' },
        { id: 'b2', title: '2号楼', position: [0, 0, -30], size: [38, 34, 26], status: '正常', drillSceneId: 'building_001_floor_03' },
        { id: 'b3', title: '设备房', position: [-74, 0, 34], size: [24, 15, 18], status: '正常', drillSceneId: 'building_001_floor_03' },
        { id: 'b4', title: '配电房', position: [44, 0, -12], size: [32, 24, 24], status: '温度偏高', alarm: true, drillSceneId: 'building_001_floor_03' },
        { id: 'b5', title: '充电区', position: [75, 0, 34], size: [34, 18, 20], status: '异常待处理', alarm: true, drillSceneId: 'building_001_floor_03' }
      ],
      devices: [
        { id: 'cam', title: 'AI摄像头', type: '摄像头', icon: '◉', position: [-58, 30, -18], location: '消防通道', status: '在线' },
        { id: 'water', title: '液位', type: '液位', icon: '◍', position: [-20, 15, 22], location: '水泵房', status: '液位偏高', alarm: true },
        { id: 'temp', title: '温度', type: '温度', icon: '♨', position: [42, 31, -10], location: '配电房', status: '温度偏高', alarm: true },
        { id: 'charger', title: '充电区监测', type: '充电监测', icon: '⚡', position: [75, 24, 34], location: '充电区', status: '异常待处理', alarm: true }
      ]
    },
    building_001_floor_03: {
      id: 'building_001_floor_03',
      title: '1号楼 · 3F 楼层内部',
      subtitle: '楼层内部视角：摄像头 / 消防 / 门禁 / 环境点位',
      type: 'floor',
      controls: { minDistance: 28, maxDistance: 125 },
      cameraPresets: {
        default: { position: [0, 88, 34], target: [0, 0, 0] },
        fire: { position: [58, 42, 10], target: [48, 0, -26] },
        security: { position: [-38, 38, 20], target: [-14, 0, -2] },
        room: { position: [-32, 42, 48], target: [-42, 0, 26] }
      },
      rooms: [
        { id: 'corridor', title: '公共走廊', position: [18, -2], size: [94, 18], color: 0x00f5ff },
        { id: 'pump', title: '水泵房', position: [48, -26], size: [28, 24], color: 0xff554f, alarm: true },
        { id: 'power', title: '配电房', position: [-42, 26], size: [36, 24], color: 0xffb642, alarm: true },
        { id: 'monitor', title: '监控室', position: [50, 24], size: [28, 24], color: 0x2d8cff }
      ],
      devices: [
        { id: 'f-cam1', title: '走廊摄像头', type: 'AI摄像头', icon: '◉', position: [-14, 8, -2], location: '公共走廊', status: '在线' },
        { id: 'f-water', title: '液位-水泵房', type: '液位', icon: '◍', position: [58, 8, -22], location: '水泵房', status: '液位偏高', alarm: true },
        { id: 'f-temp', title: '温度-配电房', type: '温度', icon: '♨', position: [-42, 8, 26], location: '配电房', status: '温度偏高', alarm: true }
      ]
    }
  },
  tours: {
    park: [
      { title: '园区全景总览', hold: 5, command: { type: 'FOCUS_PRESET', preset: 'default' } },
      { title: '聚焦1号楼', hold: 4, command: { type: 'FOCUS_NODE', nodeId: 'b1' } },
      { title: '下钻1号楼', hold: 5, command: { type: 'DRILL_TO', sceneId: 'building_001_floor_03', fromNodeId: 'b1' } },
      { title: '水泵房告警联动', hold: 5, command: { type: 'SHOW_ALARM', deviceId: 'f-water' } },
      { title: '返回园区总览', hold: 4, command: { type: 'BACK_SCENE' } }
    ],
    building_001_floor_03: [
      { title: '楼层全景', hold: 5, command: { type: 'FOCUS_PRESET', preset: 'default' } },
      { title: '水泵房区域', hold: 4, command: { type: 'FOCUS_PRESET', preset: 'fire' } },
      { title: '液位告警联动', hold: 5, command: { type: 'SHOW_ALARM', deviceId: 'f-water' } },
      { title: '返回园区总览', hold: 4, command: { type: 'BACK_SCENE' } }
    ]
  }
}
