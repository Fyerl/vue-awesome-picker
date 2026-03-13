const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const packagePath = path.join(projectRoot, 'package.json')
const swPath = path.join(projectRoot, 'sw.js')

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const version = pkg.version

if (!version) {
  throw new Error('package.json is missing version')
}

const swContent = fs.readFileSync(swPath, 'utf8')
const versionLinePattern = /const CACHE_VERSION = '([^']+)'/
if (!versionLinePattern.test(swContent)) {
  throw new Error('CACHE_VERSION line not found in sw.js')
}
const nextContent = swContent.replace(versionLinePattern, `const CACHE_VERSION = '${version}'`)

if (nextContent !== swContent) {
  fs.writeFileSync(swPath, nextContent, 'utf8')
}

console.log(`Synced sw.js cache version to ${version}`)
