/**
 * robot.builder.js — 清洁机器人场景构建器
 *
 * 构建机器人清洁轨迹场景：
 *   - 楼层地面 + 功能区（带墙体、家具）
 *   - 建筑结构（承重柱、天花灯带、地面箭头）
 *   - 规划路径（CatmullRom 曲线 + 流动粒子）
 *   - 清洁拖尾轨迹（实时生成）
 *   - 机器人模型（底盘、传感器、LiDAR、边刷、车轮）
 *   - 机器人运动系统（waypoint 插值 + 停留清洁）
 *
 * 数据来源：scene-config/robotScene.config.js
 *
 * 后续拓展：
 *   - 替换为真实 GLB 机器人模型
 *   - 接入 SLAM 实时建图
 *   - 对接机器人 ROS 接口获取真实位姿
 *   - 清洁覆盖率热力图
 */
import * as THREE from 'three'

/**
 * 构建机器人场景
 *
 * @param {Object} cfg      场景配置（rooms, waypoints 等）
 * @param {Object} managers { models, layers, anims, interactions }
 * @param {Object} options  运行选项（robotSpeed, dwellScale）
 * @returns {Object}        { robot, motion, waypoints, trailBuf, trailGeo }
 */
export default function buildRobotScene (cfg, managers, options = {}) {
  const { models, layers, anims, interactions } = managers

  // ── 1. 地面 ──
  layers.addTo('base', models.createGrid(178, 182, 116))

  // ── 2. 功能区 ──
  cfg.rooms.forEach(r => createRobotRoom(r, models, layers, anims, interactions))

  // ── 3. 建筑结构（柱子、灯带、箭头） ──
  addRobotEnvironment(models, layers, anims)

  // ── 4. 规划路径 ──
  const { waypoints, trailBuf, trailGeo } = createRobotPath(cfg.waypoints, models, layers, anims)

  // ── 5. 机器人模型 ──
  const { robot, motion } = createRobot(waypoints, options, models, layers, anims, interactions)

  return { robot, motion, waypoints, trailBuf, trailGeo }
}

/* ========== 功能区 ========== */

function createRobotRoom (r, models, layers, anims, interactions) {
  const g = new THREE.Group()
  const [rx, rz] = r.position
  const [w, d] = r.size
  const active = r.status === '执行中'
  const h = 0.5

  // 立体地台
  const floorMat = new THREE.MeshStandardMaterial({
    color: r.color, transparent: true,
    opacity: active ? 0.36 : 0.18,
    roughness: 0.32, metalness: 0.38,
    emissive: r.color, emissiveIntensity: active ? 0.14 : 0.04
  })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), floorMat)
  floor.position.set(rx, h / 2, rz)
  models.addEdges(floor, r.color, active ? 0.88 : 0.52)
  g.add(floor)

  // 状态发光层
  const glowColor = r.status === '已完成' ? 0x26f2a3 : active ? 0x00f5ff : 0xffb642
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, d * 0.92),
    new THREE.MeshBasicMaterial({
      color: glowColor, transparent: true,
      opacity: active ? 0.16 : 0.06, side: THREE.DoubleSide
    })
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.set(rx, h + 0.04, rz)
  g.add(glow)

  // 墙体
  if (r.walls) {
    r.walls.forEach(w => g.add(models.createWallSegment(w, r.color)))
  }

  // 家具
  if (r.furniture) {
    r.furniture.forEach(f => g.add(models.createFurnitureItem(f)))
  }

  // 标签
  const lab = models.createLabel(`${r.title} · ${r.status}`)
  lab.position.set(rx, 8.5, rz)
  layers.addTo('label', lab)

  // 执行中脉冲
  if (active) {
    anims.register(`glow_${r.id}`, t => {
      glow.material.opacity = 0.08 + Math.sin(t * 2) * 0.06
    })
  }

  const meta = {
    ...r,
    type: '清洁区域',
    location: '3F',
    desc: '机器人在该区域按清洁策略执行任务，确保覆盖质量。',
    camera: { position: [rx + 22, 38, rz + 30], target: [rx, 0, rz] }
  }
  layers.addTo('base', g)
  interactions.addClickable(g, meta)
}

/* ========== 建筑结构 ========== */

function addRobotEnvironment (models, layers, anims) {
  // 承重柱
  const cols = [
    [-24, -16], [-24, 4], [20, -16], [20, 4],
    [-58, 14], [-20, 14], [18, 14], [34, 20]
  ]
  cols.forEach(([x, z], i) => {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 9, 2.4),
      new THREE.MeshStandardMaterial({
        color: 0x3a5a6a, roughness: 0.3, metalness: 0.5,
        emissive: 0x00384c, emissiveIntensity: 0.12
      })
    )
    col.position.set(x, 4.5, z)
    models.addEdges(col, 0x00eaff, 0.28)
    layers.addTo('base', col)

    const baseLight = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    )
    baseLight.rotation.x = -Math.PI / 2
    baseLight.position.set(x, 0.55, z)
    layers.addTo('base', baseLight)
    anims.register(`col_${i}`, t => {
      baseLight.material.opacity = 0.1 + Math.sin(t * 1.5 + i) * 0.06
    })
  })

  // 天花灯带
  ;[[-56, -28, 30, 2], [-8, -28, 20, 2], [38, -6, 60, 2], [-38, 28, 50, 2], [58, 32, 30, 2]]
    .forEach(([x, z, len, wid]) => {
      const lp = new THREE.Mesh(
        new THREE.PlaneGeometry(len, wid),
        new THREE.MeshBasicMaterial({ color: 0xeeffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
      )
      lp.rotation.x = Math.PI / 2
      lp.position.set(x, 9.5, z)
      layers.addTo('base', lp)
    })

  // 地面箭头
  for (let i = 0; i < 4; i++) {
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 2.4, 3),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.2 })
    )
    arrow.rotation.x = Math.PI / 2
    arrow.rotation.z = Math.PI / 2
    arrow.position.set(8 + i * 18, 0.6, -6)
    layers.addTo('base', arrow)
  }
}

/* ========== 规划路径 ========== */

function createRobotPath (wps, models, layers, anims) {
  const waypoints = wps.map(p => ({
    ...p,
    vector: new THREE.Vector3(...p.position)
  }))

  /**
   * CatmullRomCurve3 — 样条曲线
   * 通过一组控制点生成平滑曲线
   * tension=0.16 控制曲线弯曲程度
   */
  const curve = new THREE.CatmullRomCurve3(
    waypoints.map(p => p.vector),
    false, 'catmullrom', 0.16
  )

  // 规划路径（虚线）
  const pathPts = curve.getPoints(240)
  const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPts)
  const pathLine = new THREE.Line(pathGeo,
    new THREE.LineDashedMaterial({
      color: 0x00f5ff, transparent: true, opacity: 0.25,
      dashSize: 2, gapSize: 1.5
    })
  )
  pathLine.computeLineDistances() // 虚线必须调用
  layers.addTo('route', pathLine)

  // 发光路径（实线）
  layers.addTo('route', new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pathPts),
    new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.55 })
  ))

  // 清洁拖尾轨迹
  const trailBuf = []
  const trailGeo = new THREE.BufferGeometry()
  layers.addTo('route', new THREE.Line(trailGeo,
    new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.9 })
  ))

  // 流动粒子
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
      dot.material.opacity = 0.45 + Math.sin(t * 4 + idx) * 0.3
    })(i))
  }

  return { waypoints, trailBuf, trailGeo }
}

/* ========== 机器人模型 ========== */

function createRobot (waypoints, options, models, layers, anims, interactions) {
  const robot = new THREE.Group()

  // 底盘
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 5, 2.4, 48),
    new THREE.MeshStandardMaterial({
      color: 0xe8f0f0, roughness: 0.32, metalness: 0.25,
      emissive: 0x1a3a4a, emissiveIntensity: 0.15
    })
  )
  body.position.y = 2.2

  // 保险杠
  const bumper = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.4, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a4a5a, roughness: 0.4, metalness: 0.5 })
  )
  bumper.rotation.x = Math.PI / 2
  bumper.position.y = 1.4

  // 传感器穹顶
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x0a1a2a, roughness: 0.2, metalness: 0.6,
      emissive: 0x00eaff, emissiveIntensity: 0.25
    })
  )
  dome.position.y = 3.5

  // LiDAR 扫描仪
  const lidar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.55, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: 0x00ccff, emissiveIntensity: 0.6 })
  )
  lidar.position.y = 5

  // 前方传感器条
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.45, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff })
  )
  front.position.set(0, 2.2, 5)

  // 状态 LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  )
  led.position.set(0, 5.5, 1.5)

  // 车轮
  const wheels = []
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 16)
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })
  ;[[-3.8, -2.6], [-3.8, 2.6], [3.8, -2.6], [3.8, 2.6]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.7, z)
    wheels.push(w)
    robot.add(w)
  })

  // 边刷
  const brush = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 2.8, 0.2, 5),
    new THREE.MeshBasicMaterial({ color: 0x556666, transparent: true, opacity: 0.45 })
  )
  brush.position.set(3.6, 0.3, 3.6)

  // 底部光环
  const groundGlow = new THREE.Mesh(
    new THREE.CircleGeometry(6, 32),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  )
  groundGlow.rotation.x = -Math.PI / 2
  groundGlow.position.y = 0.08

  // 检测光环
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(7, 32, 14),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.08, wireframe: true })
  )
  halo.position.y = 2.6

  // 标签
  const lab = models.createLabel('GX-001')
  lab.position.set(0, 8.5, 0)

  robot.add(body, bumper, dome, lidar, front, led, brush, groundGlow, halo, lab)
  robot.position.copy(waypoints[0].vector)
  layers.addTo('device', robot)

  // 运动状态机
  const motion = {
    index: 0,
    progress: 0,
    dwell: 0,
    speed: options.robotSpeed || 7,
    dwellScale: options.dwellScale || 1,
    paused: false
  }

  // 动画注册
  anims.register('lidar', t => { lidar.rotation.y = t * 3 })
  anims.register('brush', t => { brush.rotation.y = t * 5 })
  anims.register('led', t => { led.material.opacity = 0.6 + Math.sin(t * 5) * 0.4 })
  anims.register('halo', t => { halo.scale.setScalar(1 + Math.sin(t * 4.2) * 0.1) })
  anims.register('groundGlow', t => { groundGlow.material.opacity = 0.08 + Math.sin(t * 3) * 0.04 })
  anims.register('wheels', (t, dt) => {
    if (!motion.paused && motion.dwell <= 0) {
      wheels.forEach(w => { w.rotation.x += dt * 6 })
    }
  })

  // 注册可点击
  interactions.addClickable(robot, {
    id: 'robot',
    title: 'GX-001 高仙拖地机器人',
    type: '清洁机器人',
    location: '3F 公共走廊',
    status: '执行中',
    desc: '机器人按规划路径执行清洁任务，重点区域自动停留深度清洁。',
    camera: { position: [28, 34, 34], target: [34, 2, -6] }
  }, 'device')

  return { robot, motion }
}
