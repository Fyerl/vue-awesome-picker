const path = require('path')
const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(() => {
    window.pickerEvents = { cancel: [], confirm: [] }
    const app = new window.Vue({
      render (h) {
        return h('awesome-picker', {
          props: { data: [['A', 'B', 'C']], textTitle: 'Choose an item' },
          on: {
            cancel: (...args) => window.pickerEvents.cancel.push(args),
            confirm: (...args) => window.pickerEvents.confirm.push(args)
          }
        })
      }
    }).$mount('#app')
    window.picker = app.$children[0]
    window.picker.show()
  })
  await expect(page.locator('.picker')).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

for (const target of ['mask', 'button']) {
  test(`${target} dismissal emits one cancel per opening (#12)`, async ({ page }) => {
    for (let opening = 1; opening <= 2; opening++) {
      if (opening > 1) await page.evaluate(() => window.picker.show())
      if (target === 'mask') {
        await page.locator('.mask').click({ position: { x: 20, y: 20 } })
      } else {
        await page.locator('.pt-cancel').click()
      }
      await expect(page.locator('.picker')).toBeHidden()
      await expect(page.locator('.mask')).toBeHidden()
      expect(await page.evaluate(() => window.pickerEvents.cancel)).toEqual(Array.from({ length: opening }, () => []))
      expect(await page.evaluate(() => window.pickerEvents.confirm)).toEqual([])
      expect(await page.evaluate(() => window.picker.wheels.every(wheel => !wheel.enabled))).toBe(true)
    }
  })
}

test('clicking inside the picker keeps it open', async ({ page }) => {
  await page.locator('.picker-title h4').click()
  await expect(page.locator('.picker')).toBeVisible()
  expect(await page.evaluate(() => window.pickerEvents)).toEqual({ cancel: [], confirm: [] })
})

test('confirm emits only the selected value', async ({ page }) => {
  await page.locator('.pt-submit').click()
  await expect(page.locator('.picker')).toBeHidden()
  expect(await page.evaluate(() => window.pickerEvents)).toEqual({
    cancel: [], confirm: [[[{ index: 0, value: 'A' }]]]
  })
})
