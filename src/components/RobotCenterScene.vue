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

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SceneRuntime from '../three-core/SceneRuntime'
import config from '../scene-config/robotScene.config'

const props = defineProps({
  height: { type: String, default: '620px' },
  robotSpeed: { type: Number, default: 7 },
  dwellScale: { type: Number, default: 1 },
  autoPlay: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  themeName: { type: String, default: 'blueWhite' },
})

const emit = defineEmits(['scene-event'])

const host = ref(null)
let runtime = null

const paused = ref(false)
const tourActive = ref(false)
const taskStatus = ref('执行中')
const currentNodeName = ref('大堂前厅')
const battery = ref(76)
const progress = ref(0)
const dwellLeft = ref(0)
const currentSpeed = ref(0)
const tip = ref({ show: false })

const progressText = computed(() => Math.max(0, Math.min(100, Math.round(progress.value))) + '%')
const dwellText = computed(() => dwellLeft.value > 0 ? dwellLeft.value.toFixed(1) + 's' : '行进中')
const speedText = computed(() => currentSpeed.value <= 0.05 ? '0.0 m/s' : (currentSpeed.value * 0.085).toFixed(1) + ' m/s')

function cmd (command) {
  if (runtime) runtime.execute(command)
}

function toggleTour () {
  tourActive.value = !tourActive.value
  cmd({ type: tourActive.value ? 'START_TOUR' : 'STOP_TOUR' })
}

function togglePause () {
  paused.value = !paused.value
  if (runtime && runtime.motion) runtime.motion.paused = paused.value
  taskStatus.value = paused.value ? '已暂停' : '执行中'
}

function handleRuntimeEvent (event) {
  emit('scene-event', event)
  if (event.type === 'select' && event.payload) {
    tip.value = Object.assign(
      { show: true, x: event.pointer.x, y: event.pointer.y },
      event.payload,
    )
  }
  if (event.type === 'empty-click') tip.value.show = false
  if (event.type === 'robot-state') {
    currentNodeName.value = event.title || currentNodeName.value
    dwellLeft.value = event.dwellLeft || 0
    currentSpeed.value = event.currentSpeed || 0
    if (event.progress !== undefined) progress.value = event.progress
    if (event.battery !== undefined) battery.value = event.battery
  }
}

onMounted(() => {
  runtime = new SceneRuntime({
    container: host.value,
    config,
    mode: 'robot',
    themeName: props.themeName,
    options: { robotSpeed: props.robotSpeed, dwellScale: props.dwellScale },
    onEvent: handleRuntimeEvent,
  })
  runtime.start(config.startSceneId)
  if (props.autoPlay) setTimeout(() => toggleTour(), 1500)
})

onBeforeUnmount(() => {
  if (runtime) runtime.dispose()
})

defineExpose({ runtime })
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
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
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
