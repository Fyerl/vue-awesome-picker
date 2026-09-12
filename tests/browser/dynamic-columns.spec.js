const path = require('path')
const { test, expect } = require('@playwright/test')

function pickerProps (format, columns) {
  const data = format === 'normal'
    ? [['A', 'B'], ['X', 'Y', 'Z']].slice(0, columns)
    : ['A', 'B'].map(value => columns === 1
      ? { value }
      : { value, children: ['X', 'Y', 'Z'].map(child => ({ value: value + child })) })
  return { data, anchor: columns === 1 ? [1] : [1, 2] }
}

function expectedSelection (format, columns, childIndex = 2) {
  const result = [{ index: 1, value: 'B' }]
  if (columns === 2) {
    result.push({ index: childIndex, value: (format === 'cascade' ? 'B' : '') + ['X', 'Y', 'Z'][childIndex] })
  }
  return result
}

async function mountPicker (page, props) {
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

async function expectSelection (page, expected) {
  await expect(page.locator('.picker-wheel')).toHaveCount(expected.length)
  await expect.poll(() => page.evaluate(() => window.picker._getCurrentValue())).toEqual(expected)
  await expect.poll(() => page.evaluate(() => window.picker.wheels.map(wheel => ({
    index: wheel.getSelectedIndex(),
    measured: Number.isFinite(wheel.itemHeight) && wheel.itemHeight > 0,
    visibleIndex: Math.round(wheel.getComputedPosition().y / -wheel.itemHeight),
    enabled: wheel.enabled,
    moving: !!wheel.isInTransition
  })))).toEqual(expected.map(({ index }) => ({ index, measured: true, visibleIndex: index, enabled: true, moving: false })))
}

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

for (const format of ['normal', 'cascade']) {
  for (const timing of ['visible', 'hidden', 'same tick as reopening']) {
    test(`${format}: one column becomes two while ${timing} (#13)`, async ({ page }) => {
      await mountPicker(page, pickerProps(format, 1))
      await expectSelection(page, expectedSelection(format, 1))
      if (timing !== 'visible') {
        await page.locator('.pt-cancel').click()
        await expect(page.locator('.picker')).toBeHidden()
      }
      await page.evaluate(async ({ props, timing }) => {
        window.app.pickerProps = props
        if (timing === 'same tick as reopening') {
          window.picker.show()
        } else {
          await window.app.$nextTick()
          if (timing === 'hidden') window.picker.show()
        }
      }, { props: pickerProps(format, 2), timing })
      await expectSelection(page, expectedSelection(format, 2))

      await page.evaluate(() => {
        const wheel = window.picker.wheels[1]
        wheel.scrollTo(0, -wheel.itemHeight, 50)
      })
      await expectSelection(page, expectedSelection(format, 2, 1))
      await page.locator('.pt-submit').click()
      await expect(page.locator('.picker')).toBeHidden()
      expect(await page.evaluate(() => window.confirmed)).toEqual([expectedSelection(format, 2, 1)])
    })
  }

  test(`${format}: repeated two-to-one-to-two changes discard obsolete wheels (#13)`, async ({ page }) => {
    await mountPicker(page, pickerProps(format, 2))
    await expectSelection(page, expectedSelection(format, 2))
    for (const columns of [1, 2, 1, 2]) {
      await page.evaluate(props => { window.app.pickerProps = props }, pickerProps(format, columns))
      await expectSelection(page, expectedSelection(format, columns))
    }
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed)).toEqual([expectedSelection(format, 2)])
  })
}
