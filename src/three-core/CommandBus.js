/**
 * CommandBus.js — 统一命令派发总线
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  设计模式：命令模式 (Command Pattern)                        │
 * │                                                          │
 * │  所有场景操作（视角切换、下钻、告警等）都封装为「命令对象」，     │
 * │  由 CommandBus 统一分发到对应的处理函数。                      │
 * │                                                          │
 * │  命令对象格式：{ type: 'FOCUS_PRESET', preset: 'default' }  │
 * │                                                          │
 * │  好处：                                                   │
 * │  - 解耦：Vue 组件不需要知道具体怎么飞镜头                      │
 * │  - 扩展：新增功能只需 register 新命令                         │
 * │  - 可序列化：命令可以存 JSON、发接口、做撤销                    │
 * └──────────────────────────────────────────────────────────┘
 *
 * 后续拓展：
 *   - 接入 WebSocket 接收远程命令（智能设备下发指令）
 *   - 命令队列 / 批量执行
 *   - 命令历史记录（撤销/重做）
 *   - 命令中间件（日志、权限校验）
 */

export default class CommandBus {
  constructor () {
    /**
     * 命令注册表：type → handler function
     * @type {Map<string, Function>}
     */
    this.handlers = new Map()
  }

  /**
   * 注册命令处理器
   *
   * @param {string} type    命令类型标识，如 'FOCUS_PRESET'
   * @param {Function} handler 处理函数，接收完整命令对象作为参数
   *
   * @example
   *   bus.register('FOCUS_PRESET', (cmd) => {
   *     camera.flyTo(presets[cmd.preset])
   *   })
   */
  register (type, handler) {
    this.handlers.set(type, handler)
  }

  /**
   * 批量注册命令处理器
   *
   * @param {Object<string, Function>} handlerMap  type → handler 映射
   *
   * @example
   *   bus.registerAll({
   *     FOCUS_PRESET: (cmd) => { ... },
   *     FOCUS_NODE:   (cmd) => { ... }
   *   })
   */
  registerAll (handlerMap) {
    Object.entries(handlerMap).forEach(([type, handler]) => {
      this.register(type, handler)
    })
  }

  /**
   * 执行命令
   * 未知命令类型会被静默忽略（不会报错）
   *
   * @param {Object} cmd 命令对象，必须包含 type 字段
   */
  execute (cmd) {
    if (!cmd || !cmd.type) return
    const handler = this.handlers.get(cmd.type)
    if (handler) {
      handler(cmd)
    }
    // 未注册的命令静默忽略，方便向前兼容
  }

  /**
   * 检查某命令类型是否已注册
   */
  has (type) {
    return this.handlers.has(type)
  }
}
