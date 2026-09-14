const path = require('path')
const { test, expect } = require('@playwright/test')

const branches = [
  { value: 'Same', id: 'a', children: [{ value: 'Leaf', id: 'a0' }] },
  {
    value: 'Same',
    id: 'b',
    children: [
      { value: 'Leaf', id: 'b0' },
      { value: 'Leaf', id: 'b1', metadata: { code: 42 } }
    ]
  }
]
const branchSelection = [{ index: 1, value: 'Same' }, { index: 1, value: 'Leaf' }]

async function mountPicker (page, props) {
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(props => {
    window.confirmed = []
    window.confirmArgumentCounts = []
    window.app = new window.Vue({
      data: { pickerProps: props },
      render (h) {
        return h('awesome-picker', {
          props: this.pickerProps,
          on: {
            confirm: (...args) => {
              window.confirmed.push(args[0])
              window.confirmArgumentCounts.push(args.length)
            }
          }
        })
      }
    }).$mount('#app')
    window.picker = window.app.$children[0]
    window.picker.show()
  }, props)
  await expect(page.locator('.picker')).toBeVisible()
}

async function expectSelection (page, expected) {
  await expect.poll(() => page.evaluate(() => window.picker._getCurrentValue())).toEqual(expected)
  await expect.poll(() => page.evaluate(() => window.picker.syncingWheels || window.picker.wheels.some(wheel => wheel.isInTransition))).toBeFalsy()
}

async function select (page, column, index) {
  await page.evaluate(({ column, index }) => {
    const wheel = window.picker.wheels[column]
    wheel.scrollTo(0, -index * wheel.itemHeight, 50)
  }, { column, index })
  await expect.poll(() => page.evaluate(column => {
    const wheel = window.picker.wheels[column]
    return { index: wheel.getSelectedIndex(), moving: !!wheel.isInTransition }
  }, column)).toEqual({ index, moving: false })
}

async function expectConfirmed (page, expected) {
  await page.locator('.pt-submit').click()
  await expect(page.locator('.picker')).toBeHidden()
  expect(await page.evaluate(() => window.confirmed)).toEqual([expected])
  expect(await page.evaluate(() => window.confirmArgumentCounts)).toEqual([1])
}

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

test('cascade confirmation keeps its original payload by default', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1] })
  await expectSelection(page, branchSelection)
  await expectConfirmed(page, branchSelection)
})

test('includeItem returns the selected cascade objects even with duplicate labels (#7)', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1], includeItem: true })
  await expectSelection(page, branchSelection)
  await expectConfirmed(page, [
    { ...branchSelection[0], item: branches[1] },
    { ...branchSelection[1], item: branches[1].children[1] }
  ])
  expect(await page.evaluate(() => {
    const root = window.app.pickerProps.data[1]
    return window.confirmed[0][0].item === root && window.confirmed[0][1].item === root.children[1]
  })).toBe(true)
  expect(await page.evaluate(() => window.app.pickerProps.data)).toEqual(branches)
})

test('normal columns display object values and preserve their ids and metadata (#7)', async ({ page }) => {
  const data = [
    [{ value: 'Same', id: 0 }, { value: 'Same', id: 1 }],
    ['X', { value: 'Y', id: 'y', metadata: { code: 42 } }]
  ]
  const expected = [{ index: 1, value: 'Same' }, { index: 1, value: 'Y' }]
  await mountPicker(page, { data, anchor: [{ index: 1 }, { value: 'Y' }], includeItem: true })
  await expect(page.locator('.picker-wheel').first().locator('.wheel-item')).toHaveText(['Same', 'Same'])
  await expect(page.locator('.picker-wheel').nth(1).locator('.wheel-item')).toHaveText(['X', 'Y'])
  await expectSelection(page, expected)
  await expectConfirmed(page, expected.map((item, i) => ({ ...item, item: data[i][1] })))
  expect(await page.evaluate(() => window.confirmed[0].every((selected, i) => selected.item === window.app.pickerProps.data[i][1]))).toBe(true)
  expect(await page.evaluate(() => window.app.pickerProps.data)).toEqual(data)
})

test('object options work without adding item to the default payload (#7)', async ({ page }) => {
  await mountPicker(page, { data: [[{ value: 'A', id: 'a' }, { value: 'B', id: 'b' }]], anchor: [{ value: 'B' }] })
  await expectSelection(page, [{ index: 1, value: 'B' }])
  await expectConfirmed(page, [{ index: 1, value: 'B' }])
})

test('primitive and falsy object values keep their types when including items (#7)', async ({ page }) => {
  const data = [['A', 'B'], [{ value: 0, id: 'zero' }], [{ value: '', id: 'empty' }], [false]]
  const expected = [
    { index: 1, value: 'B', item: 'B' },
    { index: 0, value: 0, item: data[1][0] },
    { index: 0, value: '', item: data[2][0] },
    { index: 0, value: false, item: false }
  ]
  await mountPicker(page, { data, anchor: [1, 0, 0, 0], includeItem: true })
  await expectSelection(page, expected.map(({ index, value }) => ({ index, value })))
  await expectConfirmed(page, expected)
})

test('switching parents returns metadata from the new path (#7)', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1], includeItem: true })
  await expectSelection(page, branchSelection)
  await select(page, 0, 0)
  const expected = [{ index: 0, value: 'Same' }, { index: 0, value: 'Leaf' }]
  await expectSelection(page, expected)
  await expectConfirmed(page, [
    { ...expected[0], item: branches[0] },
    { ...expected[1], item: branches[0].children[0] }
  ])
})

test('cancelling a changed path restores the original item ids (#7)', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1], includeItem: true })
  await expectSelection(page, branchSelection)
  await select(page, 0, 0)
  await page.locator('.pt-cancel').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([])
  await page.evaluate(() => window.picker.show())
  await expectSelection(page, branchSelection)
  await expectConfirmed(page, [
    { ...branchSelection[0], item: branches[1] },
    { ...branchSelection[1], item: branches[1].children[1] }
  ])
})

test('replacement data provides the new item rather than stale metadata (#7)', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1], includeItem: true })
  await expectSelection(page, branchSelection)
  await page.evaluate(() => {
    window.app.pickerProps.data = [{ value: 'Same', id: 'replacement', children: [] }]
    window.app.pickerProps.anchor = [0]
  })
  await expectSelection(page, [{ index: 0, value: 'Same' }])
  await expect(page.locator('.picker-wheel')).toHaveCount(1)
  await expectConfirmed(page, [{ index: 0, value: 'Same', item: { value: 'Same', id: 'replacement', children: [] } }])
})

test('empty data has no selected items to include (#7)', async ({ page }) => {
  await mountPicker(page, { data: [], includeItem: true })
  await expectSelection(page, [])
  await expectConfirmed(page, [])
})

for (const [type, anchor, values] of [
  ['date', [124, 1, 28], ['2024Y', '2M', '29D']],
  ['time', [1, 2, 3], ['01h', '02m', '03s']]
]) {
  test(`built-in ${type} items correspond to the confirmed values (#7)`, async ({ page }) => {
    await mountPicker(page, { type, anchor, includeItem: true })
    await expectSelection(page, values.map((value, i) => ({ index: anchor[i], value })))
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed[0].map(({ item }) => item && typeof item === 'object' ? item.value : item))).toEqual(values)
  })
}
