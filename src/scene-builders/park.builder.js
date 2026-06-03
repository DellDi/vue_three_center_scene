/**
 * park.builder.js — 园区场景构建器
 *
 * 构建「智慧物业园区」鸟瞰场景：
 *   - 地面网格 + 立体地台
 *   - 道路网络（沥青路面 + 路缘发光线 + 分道线）
 *   - 多栋建筑（多层立面 + 窗户 + 角柱 + 屋顶 + 入口雨棚）
 *   - 环境元素（树木、路灯、喷泉、停车场、园区大门）
 *   - 设备点位（摄像头、烟感、门禁等传感器球体）
 *
 * 数据来源：scene-config/iotScene.config.js 的 park 场景
 *
 * 后续拓展：
 *   - 替换为真实 GLB 建筑模型
 *   - 接入 BIM 数据
 *   - 添加动态天气效果
 */
import * as THREE from 'three'

/**
 * 构建园区场景
 *
 * @param {Object} cfg      场景配置（buildings, devices 等）
 * @param {Object} managers { models, layers, anims, interactions }
 * @returns {Object}        运行时引用（robot: null 园区不需要）
 */
export default function buildParkScene (cfg, managers) {
  const { models, layers, anims, interactions } = managers

  // ── 1. 地面 ──
  layers.addTo('base', models.createGrid(210))
  addParkGround(models, layers)

  // ── 2. 道路 ──
  addRoads(models, layers, anims)

  // ── 3. 环境（树木、路灯、喷泉） ──
  addParkEnvironment(models, layers, anims)

  // ── 4. 建筑 ──
  cfg.buildings.forEach(b => createBuilding(b, models, layers, anims, interactions))

  // ── 5. 设备点位 ──
  cfg.devices.forEach(d => createDevice(d, models, layers, anims, interactions))

  return { robot: null }
}

/* ========== 地台 ========== */

function addParkGround (models, layers) {
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(212, 0.3, 212),
    new THREE.MeshStandardMaterial({
      color: 0x0a1820, roughness: 0.9, metalness: 0.05,
      transparent: true, opacity: 0.92
    })
  )
  platform.position.y = 0.15
  models.addEdges(platform, 0x0b3040, 0.18)
  layers.addTo('base', platform)
}

/* ========== 道路网络 ========== */

function addRoads (models, layers, anims) {
  const roads = [[0, 8, 172, 12], [36, -10, 12, 128], [-46, 25, 84, 9], [64, 40, 58, 9]]

  roads.forEach(([x, z, w, d]) => {
    // 沥青路面
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x1a2a30, roughness: 0.92, metalness: 0.05,
        transparent: true, opacity: 0.88, side: THREE.DoubleSide
      })
    )
    surface.rotation.x = -Math.PI / 2
    surface.position.set(x, 0.12, z)
    layers.addTo('base', surface)

    // 路缘发光线 + 分道线
    const edgeColor = 0x00f5ff
    if (w > d) {
      [-1, 1].forEach(s => {
        const edge = new THREE.Mesh(
          new THREE.PlaneGeometry(w, 0.3),
          new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
        )
        edge.rotation.x = -Math.PI / 2
        edge.position.set(x, 0.16, z + s * d / 2)
        layers.addTo('base', edge)
      })
      const center = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      )
      center.rotation.x = -Math.PI / 2
      center.position.set(x, 0.16, z)
      layers.addTo('base', center)
    } else {
      [-1, 1].forEach(s => {
        const edge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, d),
          new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
        )
        edge.rotation.x = -Math.PI / 2
        edge.position.set(x + s * w / 2, 0.16, z)
        layers.addTo('base', edge)
      })
      const center = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, d),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      )
      center.rotation.x = -Math.PI / 2
      center.position.set(x, 0.16, z)
      layers.addTo('base', center)
    }

    // 道路扫描脉冲（仅对主干道添加）
    const isWide = w > 80 || d > 80
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

      const roadIndex = (x + z) * 0.1 % 10
      anims.register(`pulse_road_${x}_${z}`, (t) => {
        const cycle = (t * 0.25 + roadIndex) % 1
        if (w > d) {
          pulse.position.x = x + (cycle - 0.5) * w * 0.8
          pulse.position.z = z
        } else {
          pulse.position.z = z + (cycle - 0.5) * d * 0.8
          pulse.position.x = x
        }
        pulseMat.opacity = Math.sin(cycle * Math.PI) * 0.35
      })
    }
  })
}

/* ========== 园区环境 ========== */

function addParkEnvironment (models, layers, anims) {
  // 树木
  const treePositions = [
    [-90, -50], [-70, -55], [50, -50], [80, -45],
    [-95, 0], [95, 0], [-95, 40], [95, 40],
    [-30, 55], [20, 55], [60, 55],
    [-90, -25], [90, -25], [-90, 25], [90, 25]
  ]
  treePositions.forEach(([x, z], i) => {
    const trunkH = 3 + (i % 3) * 1.5
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.45, trunkH, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
    )
    trunk.position.set(x, trunkH / 2, z)
    layers.addTo('base', trunk)

    const crownH = 4 + (i % 3) * 1.2
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2 + (i % 2), crownH, 8),
      new THREE.MeshStandardMaterial({
        color: 0x1a6a4a, roughness: 0.7,
        emissive: 0x0a4a2a, emissiveIntensity: 0.1
      })
    )
    crown.position.set(x, trunkH + crownH / 2 - 0.5, z)
    layers.addTo('base', crown)

    anims.register(`tree_${i}`, t => {
      crown.rotation.y = Math.sin(t * 0.5 + i) * 0.03
    })
  })

  // 路灯
  const lightPositions = [
    [-60, 8], [-20, 8], [20, 8], [60, 8],
    [36, -40], [36, 10], [36, 40], [-46, 10], [-46, 35]
  ]
  lightPositions.forEach(([x, z], i) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a5a6a, metalness: 0.6, roughness: 0.3 })
    )
    pole.position.set(x, 4, z)
    layers.addTo('base', pole)

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.7 })
    )
    lamp.position.set(x, 8.3, z)
    layers.addTo('base', lamp)

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.set(x, 0.2, z)
    layers.addTo('base', glow)

    anims.register(`light_${i}`, t => {
      lamp.material.opacity = 0.5 + Math.sin(t * 2 + i) * 0.2
    })
  })

  // 中央喷泉
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6, 1.2, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1a4a5a, roughness: 0.3, metalness: 0.4,
      emissive: 0x003848, emissiveIntensity: 0.15
    })
  )
  fountain.position.set(0, 0.6, 30)
  models.addEdges(fountain, 0x00eaff, 0.35)
  layers.addTo('base', fountain)

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x00aacc, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 1.25, 30)
  layers.addTo('base', water)
  anims.register('water', t => {
    water.material.opacity = 0.2 + Math.sin(t * 3) * 0.08
  })

  // 停车位
  for (let i = 0; i < 5; i++) {
    const slot = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 10),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
    )
    slot.rotation.x = -Math.PI / 2
    slot.position.set(-70 + i * 7, 0.14, -50)
    layers.addTo('base', slot)

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 10),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    )
    line.rotation.x = -Math.PI / 2
    line.position.set(-73.5 + i * 7, 0.16, -50)
    layers.addTo('base', line)
  }

  // 园区大门
  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(16, 5, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1a3a4a, transparent: true, opacity: 0.6,
      emissive: 0x00384c, emissiveIntensity: 0.15
    })
  )
  gate.position.set(0, 2.5, -56)
  models.addEdges(gate, 0x00eaff, 0.45)
  layers.addTo('base', gate)

  const gateLabel = models.createLabel('智慧物业园区')
  gateLabel.position.set(0, 7, -56)
  layers.addTo('label', gateLabel)
}

/* ========== 建筑 ========== */

function createBuilding (b, models, layers, anims, interactions) {
  const g = new THREE.Group()
  const [px, py, pz] = b.position
  g.position.set(px, py, pz)
  const [w, h, d] = b.size
  const alarm = b.alarm

  // 主体
  const bodyMat = new THREE.MeshStandardMaterial({
    color: alarm ? 0x351719 : 0x0c4d67,
    transparent: true, opacity: 0.8,
    roughness: 0.36, metalness: 0.28,
    emissive: alarm ? 0x401010 : 0x00384c,
    emissiveIntensity: alarm ? 0.55 : 0.35
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat)
  body.position.y = h / 2
  models.addEdges(body, alarm ? 0xff554f : 0x00eaff, 0.62)
  g.add(body)

  // 楼层分割线
  const floors = Math.max(2, Math.floor(h / 6))
  const lineColor = alarm ? 0xff8877 : 0x00eaff
  for (let i = 1; i < floors; i++) {
    const y = (h / floors) * i
    ;[d / 2 + 0.06, -d / 2 - 0.06].forEach(z => {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.12, 0.22),
        new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      )
      strip.position.set(0, y, z)
      g.add(strip)
    })
    ;[w / 2 + 0.06, -w / 2 - 0.06].forEach(x => {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(d + 0.12, 0.22),
        new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      )
      strip.rotation.y = Math.PI / 2
      strip.position.set(x, y, 0)
      g.add(strip)
    })
  }

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
      ? 0.3 + Math.sin(t * 3 + buildingOffset) * 0.2        // 告警：快闪红色
      : 0.1 + Math.sin(t * 0.5 + buildingOffset) * 0.06      // 正常：慢呼吸
    windowsList.forEach(w => { w.material.emissiveIntensity = ei })
  })

  // 角柱
  const pillarMat = new THREE.MeshStandardMaterial({
    color: alarm ? 0x4a2020 : 0x1a4a5a,
    roughness: 0.3, metalness: 0.5,
    emissive: alarm ? 0x401010 : 0x00384c,
    emissiveIntensity: 0.2
  })
  ;[[-w / 2, -d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [w / 2, d / 2]].forEach(([cx, cz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.3, h + 1.5, 1.3), pillarMat)
    p.position.set(cx, (h + 1.5) / 2, cz)
    models.addEdges(p, alarm ? 0xff554f : 0x00eaff, 0.22)
    g.add(p)
  })

  // 屋顶设备间
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.4, 2.5, d * 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x2a4a5a, roughness: 0.5, metalness: 0.3,
      emissive: 0x002838, emissiveIntensity: 0.1
    })
  )
  roof.position.set(0, h + 1.25, 0)
  models.addEdges(roof, alarm ? 0xff554f : 0x00eaff, 0.25)
  g.add(roof)

  // 告警信标
  if (alarm) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xff554f, transparent: true, opacity: 0.85 })
    )
    beacon.position.set(0, h + 3.5, 0)
    g.add(beacon)
    anims.register(`beacon_${b.id}`, t => {
      beacon.material.opacity = 0.4 + Math.sin(t * 6) * 0.4
      beacon.scale.setScalar(1 + Math.sin(t * 6) * 0.15)
    })
  }

  // 入口雨棚
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.5, 0.4, 4),
    new THREE.MeshStandardMaterial({
      color: 0x1a3a4a, transparent: true, opacity: 0.7,
      emissive: alarm ? 0x401010 : 0x00384c, emissiveIntensity: 0.2
    })
  )
  canopy.position.set(0, 4.5, d / 2 + 2)
  models.addEdges(canopy, alarm ? 0xff8877 : 0x00eaff, 0.4)
  g.add(canopy)

  ;[-w * 0.2, w * 0.2].forEach(sx => {
    const sup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a4a5a, metalness: 0.5 })
    )
    sup.position.set(sx, 2.25, d / 2 + 3.5)
    g.add(sup)
  })

  // 底部光带
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w + 2, 0.6, d + 2),
    new THREE.MeshBasicMaterial({
      color: alarm ? 0xff554f : 0x00f5ff,
      transparent: true, opacity: 0.2
    })
  )
  base.position.y = 0.3
  g.add(base)

  // 标签
  const lab = models.createLabel(`${b.title} ${alarm ? '⚠' : '●'} ${b.status}`, alarm)
  lab.position.set(0, h + 9, 0)
  g.add(lab)

  // 顶部光柱
  const beamGeo = new THREE.CylinderGeometry(0.6, 0.6, 35, 8)
  const beamMat = new THREE.MeshBasicMaterial({
    color: alarm ? 0xff554f : 0xeeffff,
    transparent: true,
    opacity: alarm ? 0.06 : 0.04,
    depthWrite: false
  })
  const beam = new THREE.Mesh(beamGeo, beamMat)
  beam.position.set(0, h + 19.5, 0)
  beam.name = `pillar_${b.id}`
  g.add(beam)

  // 光柱微弱波动
  anims.register(`pillar_${b.id}`, (t) => {
    beamMat.opacity = (alarm ? 0.05 : 0.03) + Math.sin(t * 0.3 + buildingOffset) * 0.02
  })

  // 地面光圈
  const ring = models.createRing(alarm ? 12 : 9, alarm ? 0xff554f : 0x00f5ff)
  ring.group.position.set(px, 0.15, pz)
  layers.addTo('effect', ring.group)
  anims.register(ring.animKey, t => ring.update(t))

  // 注册可点击
  const meta = {
    ...b,
    type: '楼栋 / 区域',
    location: '智慧物业园区',
    action: 'drill',
    desc: '点击后切换到楼层内部视角，展示设备点位。',
    camera: { position: [px + 38, 38, pz + 44], target: [px, 8, pz] }
  }
  layers.addTo('base', g)
  interactions.addClickable(g, meta)
}

/* ========== 设备点位 ========== */

function createDevice (d, models, layers, anims, interactions) {
  const g = new THREE.Group()
  const [dx, dy, dz] = d.position
  g.position.set(dx, dy, dz)
  const c = d.alarm ? 0xff554f : 0x00f5ff

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(2, 32, 16),
    new THREE.MeshStandardMaterial({
      color: c, emissive: c,
      emissiveIntensity: d.alarm ? 1.7 : 1.05,
      transparent: true, opacity: 0.92
    })
  )

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 24, 12),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: d.alarm ? 0.18 : 0.08, wireframe: true })
  )

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28 })
  )
  beam.position.y = -5

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  )
  baseRing.rotation.x = -Math.PI / 2
  baseRing.position.y = -dy + 0.25

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.8, 24),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  )
  innerRing.rotation.x = -Math.PI / 2
  innerRing.position.y = -dy + 0.3

  const lab = models.createLabel(`${d.icon || '●'} ${d.title}`, d.alarm)
  lab.position.set(0, 6.5, 0)

  g.add(ball, shell, beam, baseRing, innerRing, lab)
  layers.addTo('device', g)

  const meta = {
    ...d,
    desc: d.alarm ? '设备异常，支持联动视频、派单、复位与趋势查看。' : '设备在线，运行状态正常。',
    camera: { position: [dx + 20, dy + 20, dz + 22], target: [dx, dy, dz] }
  }
  interactions.addClickable(g, meta, 'device')

  anims.register(`dev_${d.id}`, t => {
    ball.scale.setScalar(1 + Math.sin(t * (d.alarm ? 7 : 3)) * (d.alarm ? 0.22 : 0.08))
    shell.scale.setScalar(1 + Math.sin(t * 2) * 0.12)
    baseRing.rotation.z = t * 0.4
    innerRing.rotation.z = -t * 0.6
  })
}
