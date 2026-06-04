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
    themeName: { type: String, default: 'blueWhite' },
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
      themeName: this.themeName,
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
  color: var(--scene-text, #17324d);
  border: 1px solid var(--scene-panel-border, rgba(45, 140, 255, 0.28));
  background: var(--scene-panel-bg, #f6fbff);
  box-shadow: var(--scene-panel-shadow, inset 0 0 28px rgba(73, 145, 255, 0.08));
}

.scene-panel:before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 38px,
      var(--scene-panel-mask, rgba(45, 140, 255, 0.055)) 39px 40px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 38px,
      var(--scene-panel-mask, rgba(45, 140, 255, 0.055)) 39px 40px
    );
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
  padding: 10px 12px;
  border: 1px solid var(--scene-card-border, rgba(45, 140, 255, 0.22));
  border-radius: 6px;
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
  pointer-events: none;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.head b {
  font-size: 22px;
  letter-spacing: 3px;
  color: var(--scene-text, #17324d);
  text-shadow: 0 0 10px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
}

.head span {
  display: block;
  margin-top: 6px;
  color: var(--scene-muted, #60708a);
  font-size: 13px;
}

.badges {
  display: flex;
  gap: 8px;
}

.badges i {
  font-style: normal;
  padding: 7px 10px;
  color: var(--scene-button-text, #17456f);
  border: 1px solid var(--scene-card-border, rgba(45, 140, 255, 0.22));
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
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
  color: var(--scene-button-text, #17456f);
  border: 1px solid var(--scene-panel-border, rgba(45, 140, 255, 0.28));
  background: var(--scene-button-bg, rgba(255, 255, 255, 0.78));
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.25s;
}

.toolbar button.active {
  color: #fff;
  background: var(--scene-button-active-bg, linear-gradient(180deg, #2d8cff, #126bff));
}

.toolbar button:hover {
  box-shadow: 0 0 14px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  border-color: var(--scene-primary, #126bff);
}

.toolbar button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.toolbar .danger {
  color: var(--scene-danger, #ff4d43);
  border-color: var(--scene-danger, #ff4d43);
  background: var(--scene-danger-bg, rgba(255, 77, 67, 0.10));
}

.host {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--scene-panel-bg, #f6fbff);
}

.tip {
  position: absolute;
  z-index: 12;
  min-width: 230px;
  transform: translate(-50%, -112%);
  padding: 12px;
  color: var(--scene-text, #17324d);
  border: 1px solid var(--scene-primary, #126bff);
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
  box-shadow: 0 0 22px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  pointer-events: none;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tip h4 {
  margin: 0 0 8px;
  color: var(--scene-primary, #126bff);
}

.tip p {
  margin: 5px 0;
  color: var(--scene-text, #17324d);
  font-size: 13px;
}

.tip em {
  color: var(--scene-danger, #ff4d43);
  font-style: normal;
}

.tip small {
  color: var(--scene-muted, #60708a);
}

.task {
  position: absolute;
  right: 18px;
  bottom: 44px;
  z-index: 8;
  width: 248px;
  padding: 12px;
  border: 1px solid var(--scene-card-border, rgba(45, 140, 255, 0.22));
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.task h4 {
  margin: 0 0 8px;
  color: var(--scene-text, #17324d);
}

.task strong {
  display: block;
  color: var(--scene-primary, #126bff);
  font-size: 21px;
  margin-bottom: 8px;
}

.task p {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--scene-card-border, rgba(45, 140, 255, 0.22));
  padding: 5px 0;
  margin: 0;
  color: var(--scene-muted, #60708a);
  font-size: 13px;
}

.task b {
  color: var(--scene-success, #18a869);
}

.bar {
  margin-top: 12px;
  height: 7px;
  border-radius: 8px;
  background: var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--scene-progress, linear-gradient(90deg, #126bff, #67b7ff));
}

.hint {
  position: absolute;
  left: 18px;
  bottom: 14px;
  z-index: 8;
  color: var(--scene-weak, rgba(68, 93, 124, 0.58));
  font-size: 12px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
</style>
