const path = require('path')
const { test, expect } = require('@playwright/test')

const branches = [
  { value: 'A', children: [{ value: 'A0' }] },
  { value: 'B', children: [{ value: 'B0' }, { value: 'B1' }] }
]
const a = [{ index: 0, value: 'A' }]
const b = [{ index: 1, value: 'B' }]
const c = [{ index: 2, value: 'C' }]
const branchA = [...a, { index: 0, value: 'A0' }]

async function mountPicker (page, props = { data: [['A', 'B', 'C']] }, echoAnchor = false) {
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(({ props, echoAnchor }) => {
    window.changes = []
    window.confirmed = []
    window.events = []
    window.app = new window.Vue({
      data: { pickerProps: props, mounted: true },
      render (h) {
        return this.mounted
          ? h('awesome-picker', {
            props: this.pickerProps,
            on: {
              change: value => {
                window.changes.push(value)
                window.events.push('change')
                if (echoAnchor) this.pickerProps.anchor = value
              },
              confirm: value => { window.confirmed.push(value); window.events.push('confirm') },
              cancel: () => window.events.push('cancel')
            }
          })
          : h('div')
      }
    }).$mount('#app')
    window.picker = window.app.$children[0]
    window.picker.show()
  }, { props, echoAnchor })
  await expect(page.locator('.picker')).toBeVisible()
  await settled(page)
}

async function settled (page) {
  await expect.poll(() => page.evaluate(() => window.picker.syncingWheels || window.picker.wheels.some(wheel => wheel.isInTransition || wheel.isAnimating || wheel.initiated))).toBeFalsy()
}

async function select (page, column, index) {
  await page.evaluate(({ column, index }) => {
    const wheel = window.picker.wheels[column]
    wheel.scrollTo(0, -index * wheel.itemHeight, 50)
  }, { column, index })
  await settled(page)
}

async function expectChanges (page, expected) {
  await expect.poll(() => page.evaluate(() => window.changes)).toEqual(expected)
}

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

test('opening and confirming without scrolling do not emit change', async ({ page }) => {
  await mountPicker(page)
  await page.evaluate(() => window.picker.show())
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.events)).toEqual(['confirm'])
  expect(await page.evaluate(() => window.confirmed)).toEqual([a])
})

test('a settled selection emits a preview before confirmation (#3, #11)', async ({ page }) => {
  await mountPicker(page)
  await select(page, 0, 1)
  await expectChanges(page, [b])
  expect(await page.evaluate(() => window.confirmed)).toEqual([])
  await expect(page.locator('.picker')).toBeVisible()
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.events)).toEqual(['change', 'confirm'])
  expect(await page.evaluate(() => window.confirmed)).toEqual([b])
  await page.evaluate(() => window.picker.show())
  await settled(page)
  await expectChanges(page, [b])
  await select(page, 0, 2)
  await expectChanges(page, [b, c])
})

test('unchanged selections are deduplicated but returning to the original value emits', async ({ page }) => {
  await mountPicker(page)
  await select(page, 0, 1)
  await expectChanges(page, [b])
  await select(page, 0, 1)
  await expectChanges(page, [b])
  await select(page, 0, 0)
  await expectChanges(page, [b, a])
})

test('real mouse-wheel input emits the settled value (#3, #11)', async ({ page }) => {
  await mountPicker(page, { data: [['A', 'B', 'C']], anchor: [2] })
  await page.locator('.picker-wheel').hover()
  await page.mouse.wheel(0, -68)
  await expectChanges(page, [a])
})

test('cascade change includes the synchronized descendant path exactly once', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1] })
  await select(page, 0, 0)
  await expectChanges(page, [branchA])
  await expect(page.locator('.picker-wheel').nth(1).locator('.wheel-item')).toHaveText(['A0'])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([branchA])
})

for (const cascade of [false, true]) {
  test(`${cascade ? 'cascade' : 'independent'} columns wait for concurrent scrolling to settle`, async ({ page }) => {
    const props = cascade ? { data: branches, anchor: [1, 0] } : { data: [['A', 'B'], ['X', 'Y']], anchor: [1, 0] }
    await mountPicker(page, props)
    await page.evaluate(() => {
      window.picker.wheels[0].scrollTo(0, 0, 600)
      const child = window.picker.wheels[1]
      child.scrollTo(0, -child.itemHeight, 50)
    })
    await page.waitForFunction(() => !window.picker.wheels[1].isInTransition)
    expect(await page.evaluate(() => !!window.picker.wheels[0].isInTransition)).toBe(true)
    expect(await page.evaluate(() => window.changes)).toEqual([])
    await settled(page)
    await expectChanges(page, [cascade ? branchA : [...a, { index: 1, value: 'Y' }]])
  })
}

test('cancellation and reopening are silent and reset the preview baseline', async ({ page }) => {
  await mountPicker(page)
  await select(page, 0, 1)
  await expectChanges(page, [b])
  await page.locator('.pt-cancel').click()
  await page.evaluate(() => window.picker.show())
  await settled(page)
  expect(await page.evaluate(() => window.picker._getCurrentValue())).toEqual(a)
  expect(await page.evaluate(() => window.events)).toEqual(['change', 'cancel'])
  await select(page, 0, 1)
  await expectChanges(page, [b, b])
  expect(await page.evaluate(() => window.confirmed)).toEqual([])
})

test('releasing a held, unmoved column flushes a change from another column', async ({ page }) => {
  await mountPicker(page, { data: [['A', 'B'], ['X', 'Y']] })
  const item = page.locator('.picker-wheel').first().locator('.wheel-item').first()
  const usesTouch = await page.evaluate(() => window.picker.wheels[0].options.disableMouse)
  const touch = { identifier: 0, clientX: 100, clientY: 700, pageX: 100, pageY: 700 }
  if (usesTouch) {
    await item.dispatchEvent('touchstart', { touches: [touch], changedTouches: [touch] })
  } else {
    await item.hover()
    await page.mouse.down()
  }
  expect(await page.evaluate(() => !!window.picker.wheels[0].initiated)).toBe(true)
  await page.evaluate(() => {
    const wheel = window.picker.wheels[1]
    wheel.scrollTo(0, -wheel.itemHeight, 50)
  })
  await page.waitForFunction(() => !window.picker.wheels[1].isInTransition)
  expect(await page.evaluate(() => window.changes)).toEqual([])
  if (usesTouch) {
    await item.dispatchEvent('touchend', { touches: [], changedTouches: [touch] })
  } else {
    await page.mouse.up()
  }
  await expectChanges(page, [[...a, { index: 1, value: 'Y' }]])
})

test('cancelling during motion stays silent while closing and reopening', async ({ page }) => {
  await mountPicker(page)
  await page.evaluate(() => {
    const wheel = window.picker.wheels[0]
    wheel.scrollTo(0, -wheel.itemHeight, 350)
  })
  await page.locator('.pt-cancel').dispatchEvent('click')
  await expect(page.locator('.picker')).toBeHidden()
  expect(await page.evaluate(() => window.events)).toEqual(['cancel'])
  await page.evaluate(() => window.picker.show())
  await settled(page)
  expect(await page.evaluate(() => window.changes)).toEqual([])
})

test('external anchor and data updates stay silent, including while interrupting motion', async ({ page }) => {
  await mountPicker(page, { data: [['A', 'B', 'C']], anchor: [0] })
  await page.evaluate(async () => {
    const wheel = window.picker.wheels[0]
    wheel.scrollTo(0, -wheel.itemHeight, 350)
    window.app.pickerProps.anchor = [2]
    await window.app.$nextTick()
  })
  await settled(page)
  expect(await page.evaluate(() => window.picker._getCurrentValue())).toEqual(c)
  await page.evaluate(() => { window.app.pickerProps.data = [['X', 'Y', 'Z']] })
  await settled(page)
  expect(await page.evaluate(() => window.changes)).toEqual([])
  await page.locator('.pt-cancel').click()
  await page.evaluate(async () => {
    window.app.pickerProps.anchor = [0]
    await window.app.$nextTick()
    window.picker.show()
  })
  await settled(page)
  expect(await page.evaluate(() => window.changes)).toEqual([])
  await select(page, 0, 1)
  await expectChanges(page, [[{ index: 1, value: 'Y' }]])
})

test('a change listener can update anchor without an event feedback loop', async ({ page }) => {
  await mountPicker(page, { data: [['A', 'B', 'C']], anchor: [0] }, true)
  await select(page, 0, 1)
  await expectChanges(page, [b])
  await settled(page)
  await select(page, 0, 2)
  await expectChanges(page, [b, c])
})

test('mutating a preview payload does not change the picker or deduplication state', async ({ page }) => {
  await mountPicker(page)
  await select(page, 0, 1)
  await expectChanges(page, [b])
  await page.evaluate(() => { window.changes[0][0].index = 99 })
  await select(page, 0, 1)
  expect(await page.evaluate(() => window.changes.length)).toBe(1)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([b])
})

test('change honors includeItem and distinguishes duplicate display values', async ({ page }) => {
  const data = [[{ value: 'Same', id: 'a' }, { value: 'Same', id: 'b' }]]
  await mountPicker(page, { data, includeItem: true })
  await select(page, 0, 1)
  const expected = [{ index: 1, value: 'Same', item: data[0][1] }]
  await expectChanges(page, [expected])
  expect(await page.evaluate(() => window.changes[0][0].item === window.app.pickerProps.data[0][1])).toBe(true)
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([expected])
})

for (const [type, anchor, column, index, expected] of [
  ['date', [124, 1, 28], 1, 2, [{ index: 124, value: '2024Y' }, { index: 2, value: '3M' }, { index: 0, value: '1D' }]],
  ['time', [1, 2, 3], 2, 4, [{ index: 1, value: '01h' }, { index: 2, value: '02m' }, { index: 4, value: '04s' }]]
]) {
  test(`built-in ${type} selections emit settled previews`, async ({ page }) => {
    await mountPicker(page, { type, anchor })
    await select(page, column, index)
    await expectChanges(page, [expected])
  })
}

test('empty data has no preview change', async ({ page }) => {
  await mountPicker(page, { data: [] })
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([[]])
  expect(await page.evaluate(() => window.changes)).toEqual([])
})

test('destroying the picker during a pending cascade synchronization emits no change', async ({ page }) => {
  await mountPicker(page, { data: branches, anchor: [1, 1] })
  await page.evaluate(() => {
    window.app.mounted = false
    window.picker.wheels[0].scrollTo(0, 0, 0)
  })
  await expect(page.locator('.picker')).toHaveCount(0)
  expect(await page.evaluate(() => window.changes)).toEqual([])
})
