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

Each column follows the selected item in its parent column. Changing a parent
resets all descendant columns to their first item. An empty or omitted `children`
array ends the path, so `confirm` only contains the populated columns. Empty root
data produces an empty selection (`[]`).

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

#### Changing the number of columns

Replace `data` to add or remove columns, including while the picker is open.
For normal data, change the number of inner arrays. For cascade data, change the
`children` hierarchy. Supply an `anchor` for the new data to select its initial path.

For example, switch from a single cascade column to two columns and reopen:

```javascript
// Previously: this.picker.data = [{ value: 'A' }, { value: 'B' }]
this.picker.data = ['A', 'B'].map(value => ({
  value,
  children: ['X', 'Y', 'Z'].map(child => ({ value: value + child }))
}))
this.picker.anchor = [1, 2] // Selects B and BZ
this.$nextTick(() => this.$refs.picker.show())
```

Wait for Vue to pass updated props to the component before calling `show()`.

### `anchor`

`anchor` controls the default selected item for each wheel when the picker opens. It supports two formats. If no match is found, index `0` is selected.

Recommended object array format (same shape as the `confirm` event payload).  
When both `index` and `value` exist, `index` has higher priority.

Cascade anchors are resolved from parent to child. Each index must exist in the
selected parent's children; an out-of-range index falls back to `0` at that level.
When an anchor object only supplies `value`, that value is matched within the
selected parent's children.

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

Scrolling changes the temporary selection. Clicking Cancel or the outside mask
discards those changes: reopening restores the selection from when that opening
began, including the initial anchor or a selection confirmed on a previous opening.
Cancellation does not emit `confirm` or modify the `anchor` prop. Replacing `data`
or reactively updating `anchor` starts a new selection using the supplied anchor.
An anchor update also applies while the picker is open and becomes the new
cancellation baseline. It does not emit `confirm`.

#### Choosing the built-in date

Use `anchor` with `type="date"`; custom date data is not required. Date values
include the `Y`, `M`, and `D` suffixes, with years from 1900 through 2100:

```vue
<awesome-picker ref="datePicker" type="date" :anchor="dateAnchor" />
```

```javascript
data () {
  return { dateAnchor: [] }
},
methods: {
  showDate (year, month, day) {
    this.dateAnchor = [
      { value: `${year}Y` },
      { value: `${month}M` },
      { value: `${day}D` }
    ]
    this.$nextTick(() => this.$refs.datePicker.show())
  }
}
```

For example, `showDate(2024, 2, 29)` opens at February 29, 2024, even after a
previous confirmation or cancellation. The equivalent zero-based index anchor
is `[124, 1, 28]`. Setting `anchor` to `[]` restores the built-in default date.
Replace the anchor array as above, or use Vue 2 reactive mutations to edit it.

## Methods

| Method | Description |
| --- | --- |
| `show` | Open the picker |

## Events

| Event | Description | Payload |
| --- | --- | --- |
| `confirm` | Triggered after clicking the confirm button | `[{ index, value }, ...]` |
| `cancel` | Triggered after clicking the cancel button or the mask outside the picker | - |

## Development

```bash
git clone git@github.com:Fyerl/vue-awesome-picker.git
cd vue-awesome-picker
npm install
npm run dev
npm run build
```

Run the regression tests with Node.js 20 or later:

```bash
npm run test:date
npx playwright install chromium webkit
npm run test:browser
```

Browser tests rebuild the library and demo, then exercise the library bundle in Chromium and WebKit.

[npm-image]: https://img.shields.io/npm/v/vue-awesome-picker.svg?style=flat
[npm-url]: https://npmjs.org/package/vue-awesome-picker
[downloads-image]: https://img.shields.io/npm/dt/vue-awesome-picker.svg?style=flat
[downloads-url]: https://npmjs.org/package/vue-awesome-picker
