# vue-awesome-picker [![NPM Version][npm-image]][npm-url] [![NPM Downloads][downloads-image]][downloads-url]

A mobile picker component built with [Vue.js](https://github.com/vuejs/vue) and [BetterScroll](https://github.com/ustbhuangyi/better-scroll).

> This is a **Vue 2** component.  
> Recommended Vue version: `vue@2.7.16` (or `2.7.x`). Vue 3 is not supported.

## Features

- Supports single-column, multi-column, and cascade data
- Built-in time and date picker modes
- 3D wheel scrolling effect
- Customizable title/text/colors

## Demo

> The demo enables Service Worker.

![](./static/img/qr-code.png)

## Installation

```bash
npm install vue-awesome-picker --save
```

## Usage

```javascript
// main.js
import AwesomePicker from 'vue-awesome-picker'

Vue.use(AwesomePicker)
```

```vue
<!-- See src/App.vue for a full example -->
<awesome-picker
  ref="picker"
  :data="picker.data"
  :anchor="picker.anchor"
  :textTitle="picker.textTitle"
  :textConfirm="picker.textConfirm"
  :textCancel="picker.textCancel"
  :colorTitle="picker.colorTitle"
  :colorConfirm="picker.colorConfirm"
  :colorCancel="picker.colorCancel"
  :swipeTime="picker.swipeTime"
  @cancel="handlePickerCancel"
  @confirm="handlePickerConfirm"
/>
```

```javascript
methods: {
  show () {
    this.$refs.picker.show()
  }
}
```

## Props

| Prop | Description | Options | Type | Default |
| --- | --- | --- | --- | --- |
| `data` | See the `data` section below | - | `Array` | `[]` |
| `anchor` | See the `anchor` section below | - | `Array` | `[]` |
| `type` | Built-in picker type (no `data` required) | `date`, `time` | `String` | - |
| `textTitle` | Title text | - | `String` | `''` |
| `textConfirm` | Confirm button text | - | `String` | `Confirm` |
| `textCancel` | Cancel button text | - | `String` | `Cancel` |
| `colorTitle` | Title color | - | `String` | `#000000` |
| `colorConfirm` | Confirm button color | - | `String` | `#42b983` |
| `colorCancel` | Cancel button color | - | `String` | `#999999` |
| `swipeTime` | Wheel swipe duration ([better-scroll swipeTime](https://ustbhuangyi.github.io/better-scroll/doc/zh-hans/options.html#swipetime)) | - | `Number` | `1800` |

### `data`

`vue-awesome-picker` determines whether the picker is normal or cascade by `data` shape, so please follow one of the formats below.

Normal picker (single or multi-column): pass a two-dimensional array.

```javascript
[
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
]
```

Cascade picker: build hierarchy using `children`.

```javascript
[
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
  }
]
```

### `anchor`

`anchor` controls the default selected item for each wheel when the picker opens. It supports two formats. If no match is found, index `0` is selected.

Recommended object array format (same shape as the `confirm` event payload).  
When both `index` and `value` exist, `index` has higher priority.

```javascript
[
  { index: 0, value: 'A' },
  { index: 0, value: 'A-a' }
]
```

Index array format:

```javascript
[0, 0]
```

## Methods

| Method | Description |
| --- | --- |
| `show` | Open the picker |

## Events

| Event | Description | Payload |
| --- | --- | --- |
| `confirm` | Triggered after clicking the confirm button | `[{ index, value }, ...]` |
| `cancel` | Triggered after clicking the cancel button | - |

## Development

```bash
git clone git@github.com:Fyerl/vue-awesome-picker.git
cd vue-awesome-picker
npm install
npm run dev
```

[npm-image]: https://img.shields.io/npm/v/vue-awesome-picker.svg?style=flat
[npm-url]: https://npmjs.org/package/vue-awesome-picker
[downloads-image]: https://img.shields.io/npm/dt/vue-awesome-picker.svg?style=flat
[downloads-url]: https://npmjs.org/package/vue-awesome-picker
