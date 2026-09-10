const path = require('path')
const { test, expect } = require('@playwright/test')

async function mountPicker (page, props = {}) {
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(props => {
    window.pickerEvents = { cancel: 0, confirm: [] }
    window.app = new window.Vue({
      data: { pickerProps: { data: [['A', 'B', 'C']], ...props } },
      render (h) {
        return h('awesome-picker', {
          props: this.pickerProps,
          on: {
            cancel: () => window.pickerEvents.cancel++,
            confirm: value => window.pickerEvents.confirm.push(value)
          }
        })
      }
    }).$mount('#app')
    window.picker = window.app.$children[0]
  }, props)
  await openPicker(page)
}

async function openPicker (page) {
  await page.evaluate(() => window.picker.show())
  await expect(page.locator('.picker')).toBeVisible()
}

async function select (page, column, index) {
  await page.evaluate(({ column, index }) => {
    const wheel = window.picker.wheels[column]
    wheel.scrollTo(0, -index * wheel.itemHeight, 50)
  }, { column, index })
  await expect.poll(() => page.evaluate(column => {
    const wheel = window.picker.wheels[column]
    return { index: wheel.getSelectedIndex(), moving: wheel.isInTransition }
  }, column)).toEqual({ index, moving: false })
}

async function expectSelection (page, expected) {
  await expect.poll(() => page.evaluate(() => window.picker._getCurrentValue())).toEqual(expected)
  await expect.poll(() => page.evaluate(() => window.picker.wheels.map(wheel => Math.round(wheel.getComputedPosition().y / -wheel.itemHeight) || 0)))
    .toEqual(expected.map(item => item.index))
}

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

for (const target of ['button', 'mask']) {
  test(`${target} cancellation discards a scrolled selection on reopening (#8)`, async ({ page }) => {
    await mountPicker(page)
    await select(page, 0, 1)
    await expectSelection(page, [{ index: 1, value: 'B' }])
    if (target === 'mask') {
      await page.locator('.mask').click({ position: { x: 20, y: 20 } })
    } else {
      await page.locator('.pt-cancel').click()
    }
    await expect(page.locator('.picker')).toBeHidden()
    await openPicker(page)
    await expectSelection(page, [{ index: 0, value: 'A' }])
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.pickerEvents)).toEqual({
      cancel: 1, confirm: [[{ index: 0, value: 'A' }]]
    })
  })
}

test('cancellation restores an explicit initial anchor without mutating it', async ({ page }) => {
  const anchor = [{ index: 1, value: 'B' }]
  await mountPicker(page, { anchor })
  await expectSelection(page, anchor)
  await select(page, 0, 2)
  await page.locator('.pt-cancel').click()
  await openPicker(page)
  await expectSelection(page, anchor)
  expect(await page.evaluate(() => window.app.pickerProps.anchor)).toEqual(anchor)
})

test('repeated cancellation preserves the last confirmed selection', async ({ page }) => {
  await mountPicker(page, { anchor: [0] })
  await select(page, 0, 1)
  await page.locator('.pt-submit').click()
  for (const index of [2, 0]) {
    await openPicker(page)
    await expectSelection(page, [{ index: 1, value: 'B' }])
    await select(page, 0, index)
    await page.locator('.pt-cancel').click()
  }
  await openPicker(page)
  await expectSelection(page, [{ index: 1, value: 'B' }])
  expect(await page.evaluate(() => window.pickerEvents)).toEqual({
    cancel: 2, confirm: [[{ index: 1, value: 'B' }]]
  })
})

test('cancellation restores all independent columns', async ({ page }) => {
  await mountPicker(page, { data: [['A', 'B'], ['X', 'Y', 'Z']], anchor: [1, 2] })
  await select(page, 0, 0)
  await select(page, 1, 0)
  await page.locator('.pt-cancel').click()
  await openPicker(page)
  await expectSelection(page, [{ index: 1, value: 'B' }, { index: 2, value: 'Z' }])
})

test('cancellation restores the cascade path and its child selection', async ({ page }) => {
  await mountPicker(page, {
    data: [
      { value: 'A', children: [{ value: 'A0' }, { value: 'A1' }] },
      { value: 'B', children: [{ value: 'B0' }, { value: 'B1' }, { value: 'B2' }] }
    ]
  })
  await select(page, 0, 1)
  await select(page, 1, 2)
  await page.locator('.pt-submit').click()
  await openPicker(page)
  await expectSelection(page, [{ index: 1, value: 'B' }, { index: 2, value: 'B2' }])
  await select(page, 0, 0)
  await page.locator('.pt-cancel').click()
  await openPicker(page)
  await expectSelection(page, [{ index: 1, value: 'B' }, { index: 2, value: 'B2' }])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.pickerEvents.confirm)).toEqual([
    [{ index: 1, value: 'B' }, { index: 2, value: 'B2' }],
    [{ index: 1, value: 'B' }, { index: 2, value: 'B2' }]
  ])
})

test('calling show while already open does not commit a temporary selection', async ({ page }) => {
  await mountPicker(page)
  await select(page, 0, 1)
  await openPicker(page)
  await page.locator('.pt-cancel').click()
  await openPicker(page)
  await expectSelection(page, [{ index: 0, value: 'A' }])
})

test('cancellation restores the opening date after changing the month', async ({ page }) => {
  await mountPicker(page, { type: 'date' })
  const opening = await page.evaluate(() => window.picker._getCurrentValue())
  await select(page, 1, (opening[1].index + 1) % 12)
  await page.locator('.pt-cancel').click()
  await openPicker(page)
  await expectSelection(page, opening)
})

test('cancellation during wheel animation restores the opening selection', async ({ page }) => {
  await mountPicker(page)
  await page.evaluate(() => {
    window.picker.wheels[0].scrollTo(0, -68, 800)
    if (!window.picker.wheels[0].isInTransition) throw new Error('Expected an active wheel animation')
    window.picker.cancel()
  })
  await openPicker(page)
  await expectSelection(page, [{ index: 0, value: 'A' }])
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.pickerEvents.confirm)).toEqual([[{ index: 0, value: 'A' }]])
})

test('replacement data after cancellation uses its own default selection', async ({ page }) => {
  await mountPicker(page, { anchor: [2] })
  await select(page, 0, 1)
  await page.locator('.pt-cancel').click()
  await page.evaluate(async () => {
    window.app.pickerProps = { data: [['X', 'Y']], anchor: [1] }
    await window.app.$nextTick()
  })
  await openPicker(page)
  await expectSelection(page, [{ index: 1, value: 'Y' }])
})
