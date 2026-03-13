<template>
  <div id="app" class="main-wrapper">
    <textarea v-model="value"></textarea>
    <p class="btn" @click="showPicker0">Multi-Column</p>
    <p class="btn" @click="showPicker1">Cascade</p>
    <p class="btn" @click="showPicker4">Region</p>
    <p class="btn" @click="showPicker2">Built-in Time</p>
    <p class="btn" @click="showPicker3">Built-in Date</p>
    <awesome-picker
      ref="picker0"
      :textTitle="picker0.textTitle"
      :data="picker0.data"
      :anchor="picker0.anchor"
      @confirm="handlePicker0Confirm">
    </awesome-picker>

    <awesome-picker
      ref="picker1"
      :textTitle="picker1.textTitle"
      :data="picker1.data"
      :anchor="picker1.anchor"
      @confirm="handlePicker1Confirm">
    </awesome-picker>

    <awesome-picker
      ref="picker2"
      :textTitle="picker2.textTitle"
      :type="picker2.type"
      :anchor="picker2.anchor"
      @confirm="handlePicker2Confirm">
    </awesome-picker>

    <awesome-picker
      ref="picker3"
      :textTitle="picker3.textTitle"
      :type="picker3.type"
      :anchor="picker3.anchor"
      @confirm="handlePicker3Confirm">
    </awesome-picker>

    <awesome-picker
      ref="picker4"
      :textTitle="picker4.textTitle"
      :data="picker4.data"
      :anchor="picker4.anchor"
      @confirm="handlePicker4Confirm">
    </awesome-picker>
  </div>
</template>

<script>
import areaData from './area.js'

const data1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
const data2 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

export default {
  name: 'app',
  data () {
    return {
      value: null,
      picker0: {
        anchor: [],
        textTitle: 'Multi-Column Picker',
        data: [data1, data2]
      },
      picker1: {
        anchor: [],
        textTitle: 'Cascade Picker',
        data: [
          {
            value: 'A',
            children: [
              { value: 'A-a' },
              { value: 'A-b' },
              { value: 'A-c' }
            ]
          },
          {
            value: 'B',
            children: [
              { value: 'B-a' },
              { value: 'B-b' }
            ]
          },
          {
            value: 'C',
            children: [
              { value: 'C-a' },
              { value: 'C-b' },
              { value: 'C-c' },
              { value: 'C-d' }
            ]
          },
          {
            value: 'D',
            children: [
              { value: 'D-a' }
            ]
          }
        ]
      },
      picker2: {
        anchor: [],
        textTitle: 'Time Picker (Built-in)',
        type: 'time'
      },
      picker3: {
        anchor: [],
        textTitle: 'Date Picker (Built-in)',
        type: 'date'
      },
      picker4: {
        anchor: [],
        textTitle: 'Region Picker',
        data: areaData
      }
    }
  },
  methods: {
    showPicker0 () {
      this.$refs.picker0.show()
    },
    handlePicker0Confirm (v) {
      this.picker0.anchor = v
      this.value = v ? JSON.stringify(v) : null
    },

    showPicker1 () {
      this.$refs.picker1.show()
    },
    handlePicker1Confirm (v) {
      this.picker1.anchor = v
      this.value = v ? JSON.stringify(v) : null
    },

    showPicker2 () {
      this.$refs.picker2.show()
    },
    handlePicker2Confirm (v) {
      this.picker2.anchor = v
      this.value = v ? JSON.stringify(v) : null
    },

    showPicker3 () {
      this.$refs.picker3.show()
    },
    handlePicker3Confirm (v) {
      this.picker3.anchor = v
      this.value = v ? JSON.stringify(v) : null
    },

    showPicker4 () {
      this.$refs.picker4.show()
    },
    handlePicker4Confirm (v) {
      this.picker4.anchor = v
      this.value = v ? JSON.stringify(v) : null
    }
  }
}
</script>

<style>
  .main-wrapper {
    padding: 12px;
  }

  textarea {
    height: 88px;
    width: 100%;
    margin-bottom: 12px;
    padding: 12px;
    border: 2px solid #35495d;
    border-radius: 4px;
    box-sizing: border-box;
    outline: none;
    color: #35495d;
    font-size: 14px;
    resize: none;
  }

  .btn {
    width: 100%;
    height: 44px;
    margin-bottom: 12px;
    line-height: 44px;
    text-align: center;
    color: #fff;
    background: #42b983;
  }
</style>
