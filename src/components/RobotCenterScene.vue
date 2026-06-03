<template>
  <div class="scene-panel" :style="{ height }">
    <div class="head">
      <div>
        <b>实时清洁轨迹</b><span>机器人在关键区域执行清洁任务，支持避障、覆盖与自动回充</span>
      </div>
      <div class="badges">
        <i>任务 {{ taskStatus }}</i><i>进度 {{ progressText }}</i><i>电量 {{ battery }}%</i>
      </div>
    </div>
    <div class="toolbar">
      <button @click="cmd({ type: 'FOCUS_PRESET', preset: 'top' })">
        楼层俯视</button><button @click="cmd({ type: 'FOLLOW_ROBOT' })">机器人跟随</button><button
        @click="cmd({ type: 'FOCUS_PRESET', preset: 'charge' })">
        充电区</button><button @click="togglePause">
        {{ paused ? '继续任务' : '暂停任务' }}</button><button :class="{ active: tourActive }" :disabled="disabled" @click="toggleTour">
        {{ tourActive ? '暂停导览' : '自动导览' }}</button><button class="danger"
        @click="cmd({ type: 'SHOW_ALARM', deviceId: 'robot' })">
        余量告警
      </button>
    </div>
    <div ref="host" class="host"></div>
    <div v-show="tip.show" class="tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <h4>{{ tip.title }}</h4>
      <p>类型：{{ tip.type }}</p>
      <p>位置：{{ tip.location }}</p>
      <p>
        状态：<em>{{ tip.status }}</em>
      </p>
      <small>{{ tip.desc }}</small>
    </div>
    <div class="task">
      <h4>当前清洁节点</h4>
      <strong>{{ currentNodeName }}</strong>
      <p>
        <span>行驶速度</span><b>{{ speedText }}</b>
      </p>
      <p>
        <span>停留倒计时</span><b>{{ dwellText }}</b>
      </p>
      <p>
        <span>当前模式</span><b>{{ paused ? '暂停' : taskStatus }}</b>
      </p>
      <div class="bar"><i :style="{ width: progressText }"></i></div>
    </div>
    <div class="hint">
      支持实时轨迹跟踪、关键区域停留清洁、自动回充与告警联动。
    </div>
  </div>
</template>

<script>
import SceneRuntime from '../three-core/SceneRuntime'
import config from '../scene-config/robotScene.config'

export default {
  name: 'RobotCenterScene',
  props: {
    height: { type: String, default: '620px' },
    robotSpeed: { type: Number, default: 7 },
    dwellScale: { type: Number, default: 1 },
    autoPlay: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  data () {
    return {
      paused: false,
      tourActive: false,
      taskStatus: '执行中',
      currentNodeName: '大堂前厅',
      battery: 76,
      progress: 0,
      dwellLeft: 0,
      currentSpeed: 0,
      tip: { show: false },
    }
  },
  computed: {
    progressText () {
      return Math.max(0, Math.min(100, Math.round(this.progress))) + '%'
    },
    dwellText () {
      return this.dwellLeft > 0 ? this.dwellLeft.toFixed(1) + 's' : '行进中'
    },
    speedText () {
      return this.currentSpeed <= 0.05
        ? '0.0 m/s'
        : (this.currentSpeed * 0.085).toFixed(1) + ' m/s'
    },
  },
  mounted () {
    this.runtime = new SceneRuntime({
      container: this.$refs.host,
      config,
      mode: 'robot',
      options: { robotSpeed: this.robotSpeed, dwellScale: this.dwellScale },
      onEvent: this.handleRuntimeEvent,
    })
    this.runtime.start(config.startSceneId)
    if (this.autoPlay) setTimeout(() => this.toggleTour(), 1500)
  },
  beforeDestroy () {
    if (this.runtime) this.runtime.dispose()
  },
  methods: {
    cmd (command) {
      if (this.runtime) this.runtime.execute(command)
    },
    toggleTour () {
      this.tourActive = !this.tourActive
      this.cmd({ type: this.tourActive ? 'START_TOUR' : 'STOP_TOUR' })
    },
    togglePause () {
      this.paused = !this.paused
      if (this.runtime && this.runtime.motion)
        this.runtime.motion.paused = this.paused
      this.taskStatus = this.paused ? '已暂停' : '执行中'
    },
    handleRuntimeEvent (event) {
      this.$emit('scene-event', event)
      if (event.type === 'select' && event.payload)
        this.tip = Object.assign(
          { show: true, x: event.pointer.x, y: event.pointer.y },
          event.payload,
        )
      if (event.type === 'empty-click') this.tip.show = false
      if (event.type === 'robot-state') {
        this.currentNodeName = event.title || this.currentNodeName
        this.dwellLeft = event.dwellLeft || 0
        this.currentSpeed = event.currentSpeed || 0
        if (event.progress !== undefined) this.progress = event.progress
        if (event.battery !== undefined) this.battery = event.battery
      }
    },
    animateNumber (key, targetValue, duration = 1000) {
      const start = performance.now()
      const from = this[key] || 0
      const to = targetValue
      const tick = () => {
        const elapsed = performance.now() - start
        const progress = Math.min(1, elapsed / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        this[key] = Math.round(from + (to - from) * eased)
        if (progress < 1) requestAnimationFrame(tick)
      }
      tick()
    },
  },
}
</script>

<style scoped>
.scene-panel {
  position: relative;
  width: 100%;
  min-height: 520px;
  overflow: hidden;
  border: 1px solid rgba(0, 245, 255, 0.46);
  background: #020811;
  box-shadow: inset 0 0 30px rgba(0, 245, 255, 0.08);
}

.scene-panel:before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(90deg,
      transparent 0 38px,
      rgba(0, 245, 255, 0.035) 39px 40px),
    repeating-linear-gradient(0deg,
      transparent 0 38px,
      rgba(0, 245, 255, 0.03) 39px 40px);
  z-index: 2;
}

.head {
  position: absolute;
  left: 18px;
  right: 18px;
  top: 14px;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.head b {
  font-size: 22px;
  letter-spacing: 3px;
  text-shadow: 0 0 10px #00f5ff;
}

.head span {
  display: block;
  margin-top: 6px;
  color: rgba(210, 250, 255, 0.58);
  font-size: 13px;
}

.badges {
  display: flex;
  gap: 8px;
}

.badges i {
  font-style: normal;
  padding: 7px 10px;
  border: 1px solid rgba(0, 245, 255, 0.34);
  background: rgba(0, 32, 44, 0.68);
}

.toolbar {
  position: absolute;
  left: 24px;
  top: 76px;
  z-index: 8;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar button {
  height: 30px;
  padding: 0 12px;
  color: #dff;
  border: 1px solid rgba(0, 245, 255, 0.48);
  background: rgba(0, 35, 50, 0.78);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.25s;
}

.toolbar button.active {
  background: rgba(0, 110, 130, 0.72);
}

.toolbar button:hover {
  box-shadow: 0 0 14px rgba(0, 245, 255, 0.18);
  border-color: rgba(0, 245, 255, 0.7);
}
.toolbar button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.toolbar .danger {
  border-color: rgba(255, 85, 79, 0.72);
  background: rgba(82, 18, 22, 0.72);
}

.host {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #020811;
}

.tip {
  position: absolute;
  z-index: 12;
  min-width: 230px;
  transform: translate(-50%, -112%);
  padding: 12px;
  border: 1px solid rgba(0, 245, 255, 0.66);
  background: rgba(1, 22, 32, 0.92);
  box-shadow: 0 0 22px rgba(0, 245, 255, 0.22);
  pointer-events: none;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tip h4 {
  margin: 0 0 8px;
  color: #00f5ff;
}

.tip p {
  margin: 5px 0;
  color: #cfe9ee;
  font-size: 13px;
}

.tip em {
  color: #ff6c66;
  font-style: normal;
}

.tip small {
  color: rgba(220, 255, 255, 0.65);
}

.task {
  position: absolute;
  right: 18px;
  bottom: 44px;
  z-index: 8;
  width: 248px;
  padding: 12px;
  border: 1px solid rgba(0, 245, 255, 0.36);
  background: rgba(0, 22, 34, 0.76);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.task h4 {
  margin: 0 0 8px;
}

.task strong {
  display: block;
  color: #00f5ff;
  font-size: 21px;
  margin-bottom: 8px;
}

.task p {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 245, 255, 0.1);
  padding: 5px 0;
  margin: 0;
  font-size: 13px;
}

.task b {
  color: #26f2a3;
}

.bar {
  margin-top: 12px;
  height: 7px;
  border-radius: 8px;
  background: rgba(150, 180, 190, 0.14);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #00c8c6, #70ffff);
}

.hint {
  position: absolute;
  left: 18px;
  bottom: 14px;
  z-index: 8;
  color: rgba(220, 255, 255, 0.48);
  font-size: 12px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
</style>
