const path = require('path')
const { test, expect } = require('@playwright/test')

test.use({ timezoneId: 'Asia/Shanghai' })

const dateAnchor = (year, month, day) => [`${year}Y`, `${month}M`, `${day}D`].map(value => ({ value }))
const dateSelection = (year, month, day) => [
  { index: year - 1900, value: `${year}Y` },
  { index: month - 1, value: `${month}M` },
  { index: day - 1, value: `${day}D` }
]
const leapDay = dateSelection(2024, 2, 29)
const newDate = dateSelection(2023, 12, 31)

async function mountPicker (page, props = { type: 'date', anchor: dateAnchor(2024, 2, 29) }, saveConfirmed = false) {
  await page.clock.setFixedTime('2026-09-13T04:00:00Z')
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.js') })
  await page.addScriptTag({ path: path.resolve(__dirname, '../../', require('../../package.json').main) })
  await page.evaluate(({ props, saveConfirmed }) => {
    window.confirmed = []
    window.app = new window.Vue({
      data: { pickerProps: props },
      render (h) {
        return h('awesome-picker', {
          props: this.pickerProps,
          on: {
            confirm: value => {
              window.confirmed.push(value)
              if (saveConfirmed) this.pickerProps.anchor = value
            }
          }
        })
      }
    }).$mount('#app')
    window.picker = window.app.$children[0]
    window.picker.show()
  }, { props, saveConfirmed })
  await expect(page.locator('.picker')).toBeVisible()
}

async function expectSelection (page, expected) {
  await expect.poll(() => page.evaluate(() => window.picker._getCurrentValue())).toEqual(expected)
  await expect.poll(() => page.evaluate(() => window.picker.wheels.map(wheel => {
    // Untouched wheels have no transform; BetterScroll cannot parse "none".
    const y = window.getComputedStyle(wheel.scroller).transform === 'none' ? 0 : wheel.getComputedPosition().y
    return {
      index: Math.round(y / -wheel.itemHeight) + 0,
      moving: !!wheel.isInTransition
    }
  }))).toEqual(expected.map(({ index }) => ({ index, moving: false })))
}

async function replaceAnchor (page, anchor, reopen = false) {
  await page.evaluate(async ({ anchor, reopen }) => {
    window.app.pickerProps.anchor = anchor
    await window.app.$nextTick()
    if (reopen) window.picker.show()
  }, { anchor, reopen })
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

test.beforeEach(async ({ page }) => {
  page.pickerErrors = []
  page.on('pageerror', error => page.pickerErrors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page.pickerErrors).toEqual([])
})

for (const [format, anchor] of [['values', dateAnchor(2024, 2, 29)], ['indices', [124, 1, 28]]]) {
  test(`built-in dates accept an initial ${format} anchor (#6)`, async ({ page }) => {
    await mountPicker(page, { type: 'date', anchor })
    await expectSelection(page, leapDay)
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed)).toEqual([leapDay])
  })
}

for (const action of ['submit', 'cancel']) {
  test(`a replacement date anchor overrides the previous ${action} selection on reopening (#6)`, async ({ page }) => {
    await mountPicker(page)
    await expectSelection(page, leapDay)
    await page.locator(`.pt-${action}`).click()
    await expect(page.locator('.picker')).toBeHidden()
    await replaceAnchor(page, dateAnchor(2023, 12, 31), true)
    await expectSelection(page, newDate)
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed)).toEqual(action === 'submit' ? [leapDay, newDate] : [newDate])
  })
}

test('replacing a visible date anchor updates the selection and cancellation baseline (#6)', async ({ page }) => {
  await mountPicker(page)
  await expectSelection(page, leapDay)
  await replaceAnchor(page, dateAnchor(2023, 12, 31))
  await expectSelection(page, newDate)
  expect(await page.evaluate(() => window.confirmed)).toEqual([])
  await select(page, 2, 0)
  await page.locator('.pt-cancel').click()
  await page.evaluate(() => window.picker.show())
  await expectSelection(page, newDate)
  expect(await page.evaluate(() => window.app.pickerProps.anchor)).toEqual(dateAnchor(2023, 12, 31))
  await page.locator('.pt-submit').click()
  expect(await page.evaluate(() => window.confirmed)).toEqual([newDate])
})

test('reactive edits to anchor objects update the full date path (#6)', async ({ page }) => {
  await mountPicker(page)
  await expectSelection(page, leapDay)
  await page.evaluate(() => {
    const anchor = window.app.pickerProps.anchor
    anchor[0].value = '2023Y'
    anchor[1].value = '12M'
    anchor[2].value = '31D'
  })
  await expectSelection(page, newDate)
})

test('clearing a custom date anchor uses the built-in default (#6)', async ({ page }) => {
  await mountPicker(page)
  await expectSelection(page, leapDay)
  await page.locator('.pt-cancel').click()
  await replaceAnchor(page, [], true)
  await expectSelection(page, dateSelection(2026, 9, 13))
})

test('an anchor update in the same tick as reopening wins over cancellation (#6)', async ({ page }) => {
  await mountPicker(page)
  await expectSelection(page, leapDay)
  await page.locator('.pt-cancel').click()
  await page.evaluate(() => {
    window.app.pickerProps.anchor = [123, 11, 30]
    window.picker.show()
  })
  await expectSelection(page, newDate)
})

for (const [type, props, expected] of [
  ['normal', { data: [['A', 'B'], ['X', 'Y']], anchor: [0, 0] }, [{ index: 1, value: 'B' }, { index: 1, value: 'Y' }]],
  ['time', { type: 'time', anchor: [0, 0, 0] }, [{ index: 1, value: '01h' }, { index: 1, value: '01m' }, { index: 0, value: '00s' }]]
]) {
  test(`${type} pickers also apply replacement anchors`, async ({ page }) => {
    await mountPicker(page, props)
    await replaceAnchor(page, [1, 1])
    await expectSelection(page, expected)
    await page.locator('.pt-submit').click()
    expect(await page.evaluate(() => window.confirmed)).toEqual([expected])
  })
}

test('saving the confirm payload as anchor preserves the confirmed date', async ({ page }) => {
  await mountPicker(page, { type: 'date', anchor: dateAnchor(2024, 2, 29) }, true)
  await expectSelection(page, leapDay)
  await select(page, 2, 0)
  await page.locator('.pt-submit').click()
  await page.evaluate(() => window.picker.show())
  await expectSelection(page, dateSelection(2024, 2, 1))
  expect(await page.evaluate(() => window.confirmed)).toEqual([dateSelection(2024, 2, 1)])
})
