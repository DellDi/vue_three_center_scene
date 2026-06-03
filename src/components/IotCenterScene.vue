<template>
  <div class="scene-panel" :style="{ height }">
    <div class="head"><div><b>{{ title }}</b><span>{{ subtitle }}</span></div><div class="badges"><i>在线 26</i><i>告警 3</i><i>点位 42</i></div></div>
    <div class="toolbar">
      <button v-if="floorMode" @click="cmd({ type: 'BACK_SCENE' })">返回上级</button>
      <button @click="cmd({ type: 'FOCUS_PRESET', preset: 'default' })">总览</button>
      <button @click="cmd({ type: 'FOCUS_PRESET', preset: 'fire' })">消防视角</button>
      <button @click="cmd({ type: 'FOCUS_PRESET', preset: 'security' })">安防视角</button>
      <button @click="cmd({ type: 'FOCUS_PRESET', preset: 'room' })">设备房视角</button>
      <button :class="{ active: tourActive }" :disabled="demoRunning" @click="toggleTour">{{ tourActive ? '暂停导览' : '自动导览' }}</button>
      <button class="danger" @click="cmd({ type: 'SHOW_ALARM' })">告警联动</button>
    </div>
    <div ref="host" class="host"></div>
    <div v-show="tip.show" class="tip" :class="{ alarm: tip.alarm }" :style="{ left: tip.x + 'px', top: tip.y + 'px' }"><h4>{{ tip.title }}</h4><p>类型：{{ tip.type }}</p><p>位置：{{ tip.location }}</p><p>状态：<em>{{ tip.status }}</em></p><small>{{ tip.desc }}</small></div>
    <div class="side"><h4>场景结构</h4><p v-for="i in sideList" :key="i.name"><span>{{ i.name }}</span><b>{{ i.status }}</b></p></div>
    <div class="hint">支持楼栋下钻、楼层内部视角、设备点位交互与告警联动。</div>
  </div>
</template>

<script>
import SceneRuntime from '../three-core/SceneRuntime'
import config from '../scene-config/iotScene.config'

export default {
  name: 'IotCenterScene',
  props: { height: { type: String, default: '620px' }, autoPlay: { type: Boolean, default: false }, demoRunning: { type: Boolean, default: false } },
  data () {
    return {
      title: '设备场景总览',
      subtitle: '园区视角：点击楼栋下钻到楼层内部',
      floorMode: false,
      tourActive: false,
      tip: { show: false },
      sideList: [
        { name: '1号设备房', status: '正常' },
        { name: '水泵房', status: '液位偏高' },
        { name: '配电房', status: '温度偏高' },
        { name: '消防通道', status: '在线' }
      ]
    }
  },
  mounted () {
    this.runtime = new SceneRuntime({ container: this.$refs.host, config, mode: 'iot', onEvent: this.handleRuntimeEvent })
    this.runtime.start(config.startSceneId)
    if (this.autoPlay) setTimeout(() => this.toggleTour(), 1500)
  },
  beforeDestroy () { if (this.runtime) this.runtime.dispose() },
  methods: {
    cmd (command) { if (this.runtime) this.runtime.execute(command) },
    toggleTour () { this.tourActive = !this.tourActive; this.cmd({ type: this.tourActive ? 'START_TOUR' : 'STOP_TOUR' }) },
    handleRuntimeEvent (event) {
      this.$emit('scene-event', event)
      // 演示开始时停止手动导览，避免冲突
      if (event.type === 'demo-started') {
        if (this.tourActive) { this.tourActive = false; this.cmd({ type: 'STOP_TOUR' }) }
        return
      }
      if (event.type === 'select' && event.payload) {
        this.tip = Object.assign({ show: true, x: event.pointer.x, y: event.pointer.y }, event.payload)
      }
      if (event.type === 'empty-click') this.tip.show = false
      if (event.type === 'scene-change') {
        const scene = config.scenes[event.sceneId]
        this.title = scene.title
        this.subtitle = scene.subtitle
        this.floorMode = scene.type === 'floor'
        if (scene.type === 'floor') {
          this.sideList = [
            { name: '公共走廊摄像头', status: '在线' },
            { name: '水泵房液位', status: '液位偏高' },
            { name: '配电房温度', status: '温度偏高' },
            { name: '消防烟感', status: '正常' }
          ]
        } else {
          this.sideList = [
            { name: '1号设备房', status: '正常' },
            { name: '水泵房', status: '液位偏高' },
            { name: '配电房', status: '温度偏高' },
            { name: '消防通道', status: '在线' }
          ]
        }
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
    }
  }
}
</script>

<style scoped>
.scene-panel{position:relative;width:100%;min-height:520px;overflow:hidden;border:1px solid rgba(0,245,255,.46);background:#020811;box-shadow:inset 0 0 30px rgba(0,245,255,.08)}.scene-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 38px,rgba(0,245,255,.035) 39px 40px),repeating-linear-gradient(0deg,transparent 0 38px,rgba(0,245,255,.03) 39px 40px);z-index:2}.head{position:absolute;left:18px;right:18px;top:14px;z-index:8;display:flex;justify-content:space-between;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.head b{font-size:22px;letter-spacing:3px;text-shadow:0 0 10px #00f5ff}.head span{display:block;margin-top:6px;color:rgba(210,250,255,.58);font-size:13px}.badges{display:flex;gap:8px}.badges i{font-style:normal;padding:7px 10px;border:1px solid rgba(0,245,255,.34);background:rgba(0,32,44,.68)}.toolbar{position:absolute;left:24px;top:76px;z-index:8;display:flex;gap:8px;flex-wrap:wrap}.toolbar button{height:30px;padding:0 12px;color:#dff;border:1px solid rgba(0,245,255,.48);background:rgba(0,35,50,.78);cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:all .25s}.toolbar button.active{background:rgba(0,110,130,.72)}
.toolbar button:hover{box-shadow:0 0 14px rgba(0,245,255,.18);border-color:rgba(0,245,255,.7)}
.toolbar button:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}.toolbar .danger{border-color:rgba(255,85,79,.72);background:rgba(82,18,22,.72)}.host{position:absolute;inset:0;z-index:1;background:#020811}.tip{position:absolute;z-index:12;min-width:230px;transform:translate(-50%,-112%);padding:12px;border:1px solid rgba(0,245,255,.66);background:rgba(1,22,32,.92);box-shadow:0 0 22px rgba(0,245,255,.22);pointer-events:none;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.tip.alarm{border-color:rgba(255,85,79,.78)}.tip h4{margin:0 0 8px;color:#00f5ff}.tip p{margin:5px 0;color:#cfe9ee;font-size:13px}.tip em{color:#ff6c66;font-style:normal}.tip small{color:rgba(220,255,255,.65)}.side{position:absolute;right:18px;bottom:44px;z-index:8;width:248px;padding:12px;border:1px solid rgba(0,245,255,.36);background:rgba(0,22,34,.76);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.side h4{margin:0 0 8px}.side p{display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,245,255,.1);padding:6px 0;margin:0;font-size:13px}.side b{color:#26f2a3}.hint{position:absolute;left:18px;bottom:14px;z-index:8;color:rgba(220,255,255,.48);font-size:12px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
</style>
