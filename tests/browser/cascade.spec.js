const path = require('path')
const { test, expect } = require('@playwright/test')

const regions = [
  { value: '北京', children: [{ value: '北京市', children: [{ value: '东城区' }] }] },
  { value: '天津', children: [{ value: '天津市', children: [{ value: '和平区' }] }] },
  { value: '河北', children: [
    { value: '石家庄', children: [{ value: '长安区' }] },
    { value: '唐山', children: [{ value: '路北区' }, { value: '路南区' }] }
  ] }
]
const beijing = [{ index: 0, value: '北京' }, { index: 0, value: '北京市' }, { index: 0, value: '东城区' }]
const tangshan = [{ index: 2, value: '河北' }, { index: 1, value: '唐山' }, { index: 1, value: '路南区' }]

async function mountPicker (page, props = {}) {
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(props => {
    window.confirmed = []
    window.app = new window.Vue({
      data: { pickerProps: props },
      render (h) {
        return h('awesome-picker', {
          props: this.pickerProps,
          on: { confirm: value => window.confirmed.push(value) }
        })
      }
    }).$mount('#app')
    window.picker = window.app.$children[0]
    window.picker.show()
  }, props)
  await expect(page.locator('.picker')).toBeVisible()
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

async function expectSelection (page, expected) {
  await expect(page.locator('.picker-wheel')).toHaveCount(expected.length)
  await expect.poll(() => page.evaluate(() => window.picker._getCurrentValue())).toEqual(expected)
  await expect.poll(() => page.evaluate(() => window.picker.wheels.map(wheel =>
    Math.round(wheel.getComputedPosition().y / -wheel.itemHeight) || 0
  ))).toEqual(expected.map(item => item.index))
}

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

for (const [format, anchor] of [
  ['indices', [2, 1, 1]],
  ['objects', tangshan],
  ['values', tangshan.map(({ value }) => ({ value }))]
]) {
  test(`nonzero cascade ${format} anchor selects the full initial path (#10)`, async ({ page }) => {
    await mountPicker(page, { data: regions, anchor })
    await expectSelection(page, tangshan)
    await expect(page.locator('.picker-wheel').nth(1).locator('.wheel-item')).toHaveText(['石家庄', '唐山'])
    await expect(page.locator('.picker-wheel').nth(2).locator('.wheel-item')).toHaveText(['路北区', '路南区'])
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed)).toEqual([tangshan])
  })
}

test('switching Hebei/Tangshan/Lunan to Beijing resets every descendant (#10)', async ({ page }) => {
  await mountPicker(page, { data: regions })
  for (let round = 0; round < 2; round++) {
    await select(page, 0, 2)
    await select(page, 1, 1)
    await select(page, 2, 1)
    await expectSelection(page, tangshan)
    await select(page, 0, 0)
    await expectSelection(page, beijing)
    await expect(page.locator('.picker-wheel').nth(1).locator('.wheel-item')).toHaveText(['北京市'])
    await expect(page.locator('.picker-wheel').nth(2).locator('.wheel-item')).toHaveText(['东城区'])
  }
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([beijing])
})

test('empty and absent children end the selected path without empty wheels (#10)', async ({ page }) => {
  await mountPicker(page, { data: [
    { value: 'Empty children', children: [] },
    { value: 'Branch', children: [{ value: 'Leaf', children: [] }] },
    { value: 'No children' }
  ] })
  await expectSelection(page, [{ index: 0, value: 'Empty children' }])
  await select(page, 0, 1)
  await expectSelection(page, [{ index: 1, value: 'Branch' }, { index: 0, value: 'Leaf' }])
  await select(page, 0, 2)
  await expectSelection(page, [{ index: 2, value: 'No children' }])
  await select(page, 0, 1)
  await expectSelection(page, [{ index: 1, value: 'Branch' }, { index: 0, value: 'Leaf' }])
  await select(page, 0, 0)
  await expectSelection(page, [{ index: 0, value: 'Empty children' }])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([[{ index: 0, value: 'Empty children' }]])
})

test('mouse-wheel input switches to the new parent and resets its descendants', async ({ page }) => {
  await mountPicker(page, { data: regions, anchor: [2, 1, 1] })
  await expectSelection(page, tangshan)
  await page.locator('.picker-wheel').first().hover()
  await page.mouse.wheel(0, -68)
  await expectSelection(page, beijing)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([beijing])
})

test('a child settling does not interrupt its parent scrolling to a new branch', async ({ page }) => {
  await mountPicker(page, { data: regions, anchor: [2, 1, 0] })
  await page.evaluate(() => {
    window.picker.wheels[0].scrollTo(0, 0, 350)
    const child = window.picker.wheels[2]
    child.scrollTo(0, -child.itemHeight, 50)
  })
  await expectSelection(page, beijing)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([beijing])
})

test('an empty root confirms an empty selection without constructing a wheel', async ({ page }) => {
  await mountPicker(page, { data: [] })
  await expectSelection(page, [])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([[]])
})

test('out-of-range defaults fall back to the first valid item on each level', async ({ page }) => {
  await mountPicker(page, { data: regions, anchor: [99, 1, 1] })
  await expectSelection(page, beijing)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([beijing])
})

test('cancelling a shallower branch restores the complete opening path (#8)', async ({ page }) => {
  await mountPicker(page, { data: [...regions, { value: 'Leaf', children: [] }], anchor: [2, 1, 1] })
  await expectSelection(page, tangshan)
  await select(page, 0, 3)
  await expectSelection(page, [{ index: 3, value: 'Leaf' }])
  await page.locator('.pt-cancel').click()
  await page.evaluate(() => window.picker.show())
  await expectSelection(page, tangshan)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([tangshan])
})

test('replacing visible cascade data resolves only the latest path', async ({ page }) => {
  await mountPicker(page, { data: regions })
  await page.evaluate(async () => {
    window.app.pickerProps = { data: [{ value: 'Intermediate', children: [] }] }
    await window.app.$nextTick()
    window.app.pickerProps = {
      data: [{ value: 'Root', children: [{ value: 'First' }, { value: 'Second' }] }],
      anchor: [0, 1]
    }
  })
  await expectSelection(page, [{ index: 0, value: 'Root' }, { index: 1, value: 'Second' }])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([
    [{ index: 0, value: 'Root' }, { index: 1, value: 'Second' }]
  ])
})

test('date cascades apply the requested leap-day path and reset shorter months', async ({ page }) => {
  await mountPicker(page, { type: 'date', anchor: [124, 1, 28] })
  await expectSelection(page, [{ index: 124, value: '2024Y' }, { index: 1, value: '2M' }, { index: 28, value: '29D' }])
  await expect(page.locator('.picker-wheel').nth(2).locator('.wheel-item')).toHaveCount(29)
  await select(page, 1, 2)
  await select(page, 2, 30)
  await select(page, 1, 1)
  await expectSelection(page, [{ index: 124, value: '2024Y' }, { index: 1, value: '2M' }, { index: 0, value: '1D' }])
  await expect(page.locator('.picker-wheel').nth(2).locator('.wheel-item')).toHaveCount(29)
})
