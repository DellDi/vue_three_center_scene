function wall (ax, az, bx, by, h = 7, thick = 0.6) {
  return { ax, az, bx, by, h, thick }
}

function box (w, h, d, color, x, y, z) {
  return { shape: 'box', w, h, d, color, x, y, z }
}

function cyl (r, h, color, x, y, z) {
  return { shape: 'cyl', r, h, color, x, y, z }
}

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
        {
          id: 'lobby', title: '大堂前厅', position: [-56, -28], size: [42, 28],
          color: 0x00f5ff, tone: 'success', status: '已完成',
          walls: [
            wall(-77, -42, -35, -42),
            wall(-77, -14, -67, -14),
            wall(-55, -14, -35, -14),
            wall(-77, -42, -77, -14)
          ],
          furniture: [
            box(10, 2.5, 3.5, 0x1a5a7a, -56, 1.25, -34),
            box(12, 0.3, 4.5, 0x004a6a, -56, 2.65, -34),
            box(3, 2, 1.2, 0x0a3a5a, -46, 1, -39),
            cyl(1.3, 3, 0x1a6a4a, -70, 1.5, -19),
            cyl(1, 2.5, 0x2a8a4a, -70, 2.75, -19)
          ]
        },
        {
          id: 'elevator', title: '电梯厅', position: [-8, -28], size: [30, 26],
          color: 0x0f6f9a, tone: 'success', status: '已完成',
          walls: [
            wall(-23, -41, 7, -41),
            wall(-23, -15, -5, -15),
            wall(3, -15, 7, -15),
            wall(7, -41, 7, -15)
          ],
          furniture: [
            box(4.5, 6, 0.5, 0x2a4a5a, -3, 3, -40.5),
            box(4.5, 6, 0.5, 0x2a4a5a, 5, 3, -40.5),
            box(1.5, 1.8, 0.3, 0x00aacc, 1, 4.2, -40.2)
          ]
        },
        {
          id: 'corridor', title: '公共走廊', position: [38, -6], size: [82, 20],
          color: 0x00f5ff, tone: 'primary', status: '执行中',
          walls: [
            wall(-3, -16, 20, -16),
            wall(28, -16, 79, -16),
            wall(-3, 4, 79, 4),
            wall(-3, -16, -3, 4),
            wall(79, -16, 79, 4)
          ],
          furniture: [
            box(10, 1.2, 2, 0x3a5a5a, 10, 0.6, -14.5),
            box(10, 1.2, 2, 0x3a5a5a, 44, 0.6, -14.5),
            box(6, 1, 1.5, 0x3a5a5a, 68, 0.5, -14.5),
            cyl(1.2, 2.6, 0x1a6a4a, 26, 1.3, 2.5),
            cyl(0.9, 2.2, 0x2a8a4a, 26, 2.4, 2.5),
            cyl(1.2, 2.6, 0x1a6a4a, 56, 1.3, 2.5),
            cyl(0.9, 2.2, 0x2a8a4a, 56, 2.4, 2.5)
          ]
        },
        {
          id: 'garage', title: '地下车库B1', position: [-38, 28], size: [80, 28],
          color: 0x1e6e9a, tone: 'warning', status: '待执行',
          walls: [
            wall(-78, 14, 2, 14),
            wall(-78, 42, -54, 42),
            wall(-40, 42, 2, 42),
            wall(-78, 14, -78, 42),
            wall(2, 14, 2, 24)
          ],
          furniture: [
            cyl(2, 6, 0x4a5a6a, -60, 3, 28),
            cyl(2, 6, 0x4a5a6a, -30, 3, 28),
            cyl(2, 6, 0x4a5a6a, -5, 3, 28),
            box(0.6, 3, 16, 0xff554f, 0, 1.5, 26),
            box(14, 1, 0.5, 0xffaa00, -52, 0.5, 38),
            box(14, 1, 0.5, 0xffaa00, -26, 0.5, 38)
          ]
        },
        {
          id: 'charge', title: '充电区周边', position: [58, 32], size: [48, 24],
          color: 0xffb642, tone: 'warning', status: '待执行',
          walls: [
            wall(34, 20, 82, 20),
            wall(34, 44, 56, 44),
            wall(68, 44, 82, 44),
            wall(34, 20, 34, 44),
            wall(82, 20, 82, 44)
          ],
          furniture: [
            box(3.5, 5, 2.5, 0x00aa66, 62, 2.5, 42),
            box(1.2, 0.8, 1, 0x00ff88, 62, 5.4, 42),
            box(7, 5.5, 3, 0x2a3a4a, 76, 2.75, 42),
            box(2.5, 0.4, 2.5, 0x1a2a3a, 50, 0.2, 36)
          ]
        }
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
