export default {
  startSceneId: 'robot_clean_floor',
  scenes: {
    robot_clean_floor: {
      id: 'robot_clean_floor',
      title: '实时清洁轨迹',
      subtitle: '机器人在关键区域执行清洁任务，支持避障、覆盖与自动回充',
      controls: { minDistance: 34, maxDistance: 145 },
      cameraPresets: {
        default: { position: [0, 108, 42], target: [0, 0, 0] },
        top: { position: [0, 108, 42], target: [0, 0, 0] },
        follow: { position: [28, 34, 34], target: [34, 2, -6] },
        charge: { position: [72, 46, 64], target: [56, 0, 36] }
      },
      rooms: [
        { id: 'lobby', title: '大堂前厅', position: [-56, -28], size: [42, 28], color: 0x00f5ff, status: '已完成' },
        { id: 'elevator', title: '电梯厅', position: [-8, -28], size: [30, 26], color: 0x0f6f9a, status: '已完成' },
        { id: 'corridor', title: '公共走廊', position: [38, -6], size: [82, 20], color: 0x00f5ff, status: '执行中' },
        { id: 'garage', title: '地下车库B1', position: [-38, 28], size: [80, 28], color: 0x1e6e9a, status: '待执行' },
        { id: 'charge', title: '充电区周边', position: [58, 32], size: [48, 24], color: 0xffb642, status: '待执行' }
      ],
      waypoints: [
        { name: '大堂前厅', position: [-64, 1.35, -30], dwell: 2 },
        { name: '大堂前厅', position: [-42, 1.35, -30], dwell: 2 },
        { name: '电梯厅', position: [-10, 1.35, -28], dwell: 2.5 },
        { name: '公共走廊', position: [18, 1.35, -16], dwell: 2 },
        { name: '公共走廊', position: [48, 1.35, -6], dwell: 3 },
        { name: '公共走廊', position: [72, 1.35, -6], dwell: 2 },
        { name: '充电区周边', position: [46, 1.35, 36], dwell: 2.5 }
      ]
    }
  },
  tours: {
    robot_clean_floor: [
      { title: '楼层俯视全景', hold: 5, command: { type: 'FOCUS_PRESET', preset: 'top' } },
      { title: '大堂前厅区域', hold: 4, command: { type: 'FOCUS_PRESET', preset: 'follow' } },
      { title: '充电区全景', hold: 4, command: { type: 'FOCUS_PRESET', preset: 'charge' } },
      { title: '公共走廊区域', hold: 4, command: { type: 'FOCUS_NODE', nodeId: 'corridor' } },
      { title: '机器人跟随视角', hold: 6, command: { type: 'FOCUS_PRESET', preset: 'follow' } },
      { title: '清水余量告警', hold: 5, command: { type: 'SHOW_ALARM', deviceId: 'robot' } },
      { title: '楼层俯视全景', hold: 5, command: { type: 'FOCUS_PRESET', preset: 'top' } }
    ]
  }
}
