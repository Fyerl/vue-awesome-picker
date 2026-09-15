# Changelog

## 2.1.0 — 2026-09-15

### Added

- A `change` event exposes temporary selections after scrolling and cascade synchronization settle. Opening, external data/anchor updates, and cancellation restoration remain silent. ([#29](https://github.com/Fyerl/vue-awesome-picker/pull/29), #3, #11)
- Optional `includeItem` returns the original selected option, including ids and custom fields, alongside `index` and `value`. Normal columns can also display object options by their `value`. The default event payload remains unchanged. ([#28](https://github.com/Fyerl/vue-awesome-picker/pull/28), #7)

### Fixed

- Date data keeps each year's February length independent, including leap years. ([#22](https://github.com/Fyerl/vue-awesome-picker/pull/22), #4)
- Clicking the mask emits `cancel`, matching the Cancel button. ([#23](https://github.com/Fyerl/vue-awesome-picker/pull/23), #12)
- Reopening after cancellation restores the selection from the start of that opening. ([#24](https://github.com/Fyerl/vue-awesome-picker/pull/24), #8)
- Cascade paths, descendant indices, and wheel layout stay synchronized when parents or column counts change; empty children end the path. ([#25](https://github.com/Fyerl/vue-awesome-picker/pull/25), [#26](https://github.com/Fyerl/vue-awesome-picker/pull/26), #10, #13)
- Reactive `anchor` updates apply to existing pickers, including built-in dates and reopening after confirmation or cancellation. ([#27](https://github.com/Fyerl/vue-awesome-picker/pull/27), #6)

### Compatibility

- Vue 2 remains supported with the existing peer dependency range; Vue 3 is not supported.
- `confirm` still submits the final selection. Applications using `change` should discard or restore their preview effects when handling `cancel`.
- Runtime dependencies and the default `{ index, value }` confirmation payload are unchanged.
