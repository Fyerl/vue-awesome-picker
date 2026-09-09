const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const { transformSync } = require('@babel/core')

function loadSource (filename) {
  const source = new Module(filename, module)
  source.require = request => loadSource(path.resolve(path.dirname(filename), request + '.js'))
  source._compile(transformSync(fs.readFileSync(filename, 'utf8'), {
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
  }).code, filename)
  return source.exports
}

const { dateData } = loadSource(path.resolve(__dirname, '../src/lib/data/date.js'))
const months = year => dateData.find(item => item.value === `${year}Y`).children

for (const [year, days] of [[2012, 29], [2023, 28], [1900, 28], [2000, 29], [2100, 28]]) {
  test(`${year} February has ${days} days (#4)`, () => {
    assert.equal(months(year)[1].children.length, days)
    assert.equal(months(year)[1].children.at(-1).value, `${days}D`)
  })
}

test('years have independent month and day data', () => {
  assert.notEqual(months(2012)[1], months(2013)[1])
  assert.notEqual(months(2012)[1].children, months(2013)[1].children)
})

test('all month lengths match the calendar across the supported year range', () => {
  for (const year of dateData) {
    const numericYear = parseInt(year.value, 10)
    year.children.forEach((month, index) => {
      assert.equal(month.children.length, new Date(numericYear, index + 1, 0).getDate(), `${year.value} ${month.value}`)
    })
  }
})
