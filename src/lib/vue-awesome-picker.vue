<template>
  <div>
    <transition name="fade">
      <div class="mask" v-show="display" @click="cancel"></div>
    </transition>
    <transition name="slide">
      <div class="picker" v-show="display">
      <div class="picker-title">
        <span class="pt-cancel" @click="cancel" :style="{ color: colorCancel }">{{textCancel}}</span>
        <span class="pt-submit" @click="confirm" :style="{ color: colorConfirm }">{{textConfirm}}</span>
        <h4 :style="{ color: colorTitle }">{{textTitle}}</h4>
      </div>
      <div class="picker-panel">
        <div class="picker-mask-top"></div>
        <div class="picker-mask-bottom"></div>
        <div class="picker-wheel-wrapper" ref="wheelWrapper">
          <div class="picker-wheel" v-for="(wheel, index) in pickerData" :key="index">
            <ul class="wheel-scroll">
              <li class="wheel-item" v-for="(item, index) in wheel" :key="index">{{item}}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </transition>
  </div>
</template>

<script>
import BScroll from 'better-scroll'
import timeData from './data/time.js'
import { dateData, dateAnchor } from './data/date.js'

const DATA_NORMAL = 'normal'
const DATA_CASCADE = 'cascade'

const TYPE_NORMAL = 'normal'
const TYPE_TIME = 'time'
const TYPE_DATE = 'date'

const TEXT_TITLE = ''
const TEXT_CONFIRM = 'Confirm'
const TEXT_CANCEL = 'Cancel'

const COLOR_TITLE = '#000000'
const COLOR_CONFIRM = '#42b983'
const COLOR_CANCEL = '#999999'

const EVENT_CONFIRM = 'confirm'
const EVENT_CANCEL = 'cancel'

export default {
  name: 'awesome-picker',
  props: {
    data: {
      type: Array,
      default () {
        return []
      }
    },
    anchor: {
      type: Array,
      default () {
        return []
      }
    },
    type: {
      type: String,
      default: TYPE_NORMAL
    },
    textTitle: {
      type: String,
      default: TEXT_TITLE
    },
    textConfirm: {
      type: String,
      default: TEXT_CONFIRM
    },
    textCancel: {
      type: String,
      default: TEXT_CANCEL
    },
    colorTitle: {
      type: String,
      default: COLOR_TITLE
    },
    colorConfirm: {
      type: String,
      default: COLOR_CONFIRM
    },
    colorCancel: {
      type: String,
      default: COLOR_CANCEL
    },
    swipeTime: {
      type: Number,
      default: 1800
    }
  },
  data () {
    return {
      display: false,
      dataChange: false,
      pickerData: this._dataGetter(),
      pickerAnchor: this._anchorGetter(),
      openingAnchor: [],
      cancelledAnchor: null,
      syncingWheels: false,
      wheelSyncId: 0,
      wheels: []
    }
  },
  watch: {
    data () {
      this._setPickerData()
    }
  },
  computed: {
    proxyData () {
      return this._dataGetter()
    },
    proxyAnchor () {
      return this._anchorGetter()
    },
    dataType () {
      return !Array.isArray(this.proxyData[0]) ? DATA_CASCADE : DATA_NORMAL
    }
  },
  beforeDestroy () {
    this.wheelSyncId++
    this.wheels.forEach((wheel) => {
      wheel.destroy()
    })
    this.wheels = []
  },
  methods: {
    _dataGetter () {
      let data = null
      switch (this.type) {
        case TYPE_TIME:
          data = timeData; break
        case TYPE_DATE:
          data = dateData; break
        case TYPE_NORMAL:
        default:
          data = this.data; break
      }
      return [...data]
    },

    _anchorGetter () {
      let anchor = []
      if (this.anchor.length) {
        anchor = this.anchor
      } else {
        switch (this.type) {
          case TYPE_DATE:
            anchor = dateAnchor; break
          default:
            anchor = this.anchor; break
        }
      }

      const data = this._dataGetter()
      const isCascade = !Array.isArray(data[0])
      let nodes = data
      anchor = anchor.map((item, i) => {
        const values = isCascade ? nodes.map(node => node.value) : (data[i] || [])
        let index = 0
        const isObjectAnchor = item && typeof item === 'object'
        if (isObjectAnchor && Object.prototype.hasOwnProperty.call(item, 'index')) {
          index = Number(item.index)
        } else {
          const rawValue = isObjectAnchor && Object.prototype.hasOwnProperty.call(item, 'value')
            ? item.value
            : item
          index = values.indexOf(rawValue) > -1
            ? values.indexOf(rawValue)
            : Number(rawValue)
        }
        if (!isFinite(index) || index < 0) {
          index = 0
        } else {
          index = Math.floor(index)
        }
        if (isCascade) {
          if (index >= nodes.length) index = 0
          const selected = nodes[index]
          nodes = selected && Array.isArray(selected.children) ? selected.children : []
        }
        return index
      })
      return [...anchor]
    },

    show () {
      if (this.display) {
        return
      }
      const cancelledAnchor = this.cancelledAnchor
      this.cancelledAnchor = null
      this.display = true
      if (!this.wheels.length || this.dataChange || cancelledAnchor) {
        this.pickerAnchor = cancelledAnchor ? [...cancelledAnchor] : this._anchorGetter()
        this.dataType === DATA_CASCADE && this._updatePickerData()
        this._syncWheels(0, true)
        this.dataChange = false
      } else {
        this.wheels.forEach((wheel) => {
          wheel.enable()
        })
        this.openingAnchor = this._getCurrentValue().map(item => item.index)
      }
    },

    hide () {
      this.wheels.forEach((wheel) => {
        wheel.disable()
      })
      this.display = false
    },

    _createWheel (wheelWrapper, i) {
      if (!this.wheels[i]) {
        const wheel = this.wheels[i] = new BScroll(wheelWrapper.children[i], {
          wheel: {
            selectedIndex: 0,
            rotate: 25
          },
          mouseWheel: true,
          swipeTime: this.swipeTime
        })
        wheel.on('scrollEnd', () => {
          this._cascadePickerChange(i)
        })
      } else {
        this.wheels[i].refresh()
      }
      return this.wheels[i]
    },

    _cascadePickerChange (i) {
      if (this.syncingWheels || !this.display || this.dataType !== DATA_CASCADE) {
        return
      }
      const newIndex = this.wheels[i].getSelectedIndex()
      if (newIndex !== this.pickerAnchor[i]) {
        this.pickerAnchor.splice(i, 1, newIndex)
        this._updatePickerData(i + 1)
        this._syncWheels(i + 1)
      }
    },

    _syncWheels (startIndex = 0, rememberOpening = false) {
      this.syncingWheels = true
      const syncId = ++this.wheelSyncId
      // Refresh after every column has rendered, and ignore obsolete data updates.
      this.$nextTick(() => {
        if (syncId !== this.wheelSyncId) return
        const wheelWrapper = this.$refs.wheelWrapper
        this._destroyExtraWheels()
        this.pickerData.forEach((item, index) => {
          // Leave ancestor wheels free to finish any ongoing user scroll.
          if (index < startIndex) return
          const wheel = this._createWheel(wheelWrapper, index)
          this.display ? wheel.enable() : wheel.disable()
        })
        // Programmatic scrollEnd events must not reset the path being applied.
        this._wheelToAnchor(this.pickerAnchor, startIndex)
        this.syncingWheels = false
        if (rememberOpening) {
          this.openingAnchor = this._getCurrentValue().map(item => item.index)
        }
      })
    },

    _wheelToAnchor (data, startIndex = 0) {
      this.wheels.forEach((wheel, i) => {
        if (i >= startIndex) wheel.wheelTo(data[i] || 0)
      })
    },

    _getCurrentValue () {
      const value = []
      this.wheels.forEach((wheel, i) => {
        const j = wheel.getSelectedIndex()
        value.push({
          index: j,
          value: this.pickerData[i][j]
        })
      })
      return value
    },

    _setPickerData () {
      this.wheelSyncId++
      this.syncingWheels = false
      this.cancelledAnchor = null
      this.pickerData = this._dataGetter()
      this.pickerAnchor = this._anchorGetter()
      this.dataType === DATA_CASCADE && this._updatePickerData()
      if (this.display) {
        this._syncWheels(0, true)
      } else {
        this.dataChange = true
      }
    },

    _destroyExtraWheels () {
      const dataLength = this.pickerData.length
      if (dataLength < this.wheels.length) {
        const extraWheels = this.wheels.splice(dataLength)
        extraWheels.forEach((wheel) => {
          wheel.destroy()
        })
      }
    },

    _updatePickerData (wheelIndex = 0) {
      let data = this.proxyData
      const pickerData = []
      const pickerAnchor = []
      let i = 0
      while (Array.isArray(data) && data.length) {
        let index = wheelIndex > 0 && i >= wheelIndex ? 0 : this.pickerAnchor[i]
        if (!isFinite(index) || Math.floor(index) !== index || index < 0 || index >= data.length) {
          index = 0
        }
        pickerData.push(data.map(item => item.value))
        pickerAnchor.push(index)
        data = data[index].children
        i++
      }
      this.pickerData = pickerData
      this.pickerAnchor = pickerAnchor
    },

    confirm () {
      const isInTransition = this.wheels.some((wheel) => {
        return wheel.isInTransition
      })
      if (this.syncingWheels || isInTransition) {
        return
      }
      const selectedValues = this._getCurrentValue()
      this.$emit(EVENT_CONFIRM, selectedValues)
      this.hide()
    },

    cancel () {
      this.cancelledAnchor = [...this.openingAnchor]
      this.$emit(EVENT_CANCEL)
      this.hide()
    }
  }
}
</script>

<style scoped>
  /* fade */
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }

  .fade-enter-active, .fade-leave-active {
    transition: all .3s ease;
  }

  /* slide */
  .slide-enter, .slide-leave-to {
    opacity: 0.5;
    transform: translate3d(0, 270px, 0)
  }

  .slide-enter-active, .slide-leave-active {
    transition: all .3s ease;
  }

  .mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9999;
    background: rgba(0,0,0,.2);
  }

  .picker {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 270px;
    z-index: 10000;
    background: #fff;
  }

  .picker-title {
    position: relative;
    height: 44px;
    color: #333;
  }

  .picker-title:after {
    content: '';
    display: block;
    border-bottom: 1px solid #ebebeb;
    left: 0;
    right: 0;
    transform: scaleY(.5);
  }

  .picker-title span {
    position: absolute;
    height: 44px;
    line-height: 44px;
    padding: 0 12px;
    font-size: 14px;
  }

  .picker-title .pt-cancel {
    left: 0;
    color: #999;
  }

  .picker-title .pt-submit {
    right: 0;
    color: #42b983;
  }

  .picker-title h4 {
    margin: 0;
    font-size: 16px;
    font-weight: normal;
    height: 44px;
    line-height: 44px;
    text-align: center;
  }

  .picker-panel {
    position: relative;
    height: 226px;
    padding: 24px 12px;
    box-sizing: border-box;
  }

  .picker-panel .picker-mask-top,
  .picker-panel .picker-mask-bottom {
    position: absolute;
    left: 0;
    right: 0;
    height: 72px;
    background: #fff;
    transform: translateZ(0);
    z-index: 1;
    pointer-events: none;
  }

  .picker-panel .picker-mask-top {
    top: 24px;
    background: linear-gradient(to bottom, rgba(255,255,255,.9), rgba(255,255,255,.5));
  }

  .picker-panel .picker-mask-top:after {
    content: '';
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid #ebebeb;
    transform: scaleY(.5);
  }

  .picker-panel .picker-mask-bottom {
    bottom: 24px;
    background: linear-gradient(to top, rgba(255,255,255,.9), rgba(255,255,255,.5));
  }

  .picker-panel .picker-mask-bottom:before {
    content: '';
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    border-bottom: 1px solid #ebebeb;
    transform: scaleY(.5);
  }

  .picker-wheel-wrapper {
    display: flex;
    align-items: stretch;
    height: 100%;
  }

  .picker-wheel-wrapper .picker-wheel {
    flex: 1;
    overflow: hidden;
  }

  .picker-wheel-wrapper .wheel-scroll {
    margin-top: 72px;
  }

  .picker-wheel-wrapper .wheel-scroll .wheel-item {
    height: 34px;
    line-height: 34px;
    font-size: 17px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #333;
  }
</style>
