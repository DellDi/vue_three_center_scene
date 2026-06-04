import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const sourcePath = path.join(root, 'src/theme/sceneThemes.js')
const tempDir = path.join(root, 'node_modules/.cache/theme-verify')
const tempPath = path.join(tempDir, 'sceneThemes.mjs')

fs.mkdirSync(tempDir, { recursive: true })
fs.copyFileSync(sourcePath, tempPath)

const mod = await import(pathToFileURL(tempPath))
;[mod.darkTechTheme, mod.blueWhiteTheme].forEach(theme => mod.assertThemeComplete(theme))

const vars = mod.applyThemeVars(mod.blueWhiteTheme)
const requiredCssVars = ['--scene-panel-bg', '--scene-primary', '--scene-text', '--scene-progress']
const missingVars = requiredCssVars.filter(key => !vars[key])
if (missingVars.length) throw new Error(`Missing CSS vars: ${missingVars.join(', ')}`)

console.log('Theme tokens verified')
