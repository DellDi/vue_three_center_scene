const requiredPaths = [
  'css.pageBg',
  'css.panelBg',
  'css.panelBorder',
  'css.primary',
  'css.text',
  'css.dangerText',
  'three.clear',
  'three.fog',
  'three.lights.ambient',
  'three.grid.main',
  'three.grid.sub',
  'three.material.ground',
  'three.effect.primary',
  'semantic.success',
  'semantic.warning',
  'semantic.danger'
]

export const darkTechTheme = {
  name: 'darkTech',
  css: {
    pageBg: '#020811',
    pageGradient: 'radial-gradient(circle at 50% 0%, rgba(0,245,255,.14), transparent 34%), linear-gradient(180deg, #020811, #01050a)',
    panelBg: '#020811',
    panelMask: 'rgba(0,245,255,.035)',
    panelBorder: 'rgba(0,245,255,.46)',
    panelShadow: 'inset 0 0 30px rgba(0,245,255,.08)',
    cardBg: 'rgba(0,22,34,.76)',
    cardBorder: 'rgba(0,245,255,.36)',
    buttonBg: 'rgba(0,35,50,.78)',
    buttonActiveBg: 'rgba(0,110,130,.72)',
    buttonText: '#dff',
    primary: '#00f5ff',
    primarySoft: 'rgba(0,245,255,.18)',
    text: '#d8fbff',
    muted: 'rgba(210,250,255,.65)',
    weak: 'rgba(220,255,255,.48)',
    danger: '#ff6c66',
    dangerText: '#ff8f88',
    dangerBg: 'rgba(82,18,22,.72)',
    success: '#26f2a3',
    progress: 'linear-gradient(90deg, #00c8c6, #70ffff)'
  },
  three: {
    clear: 0x020811,
    fog: 0x020811,
    lights: { ambient: 0xb7f8ff, ambientIntensity: 0.82, directional: 0xffffff, directionalIntensity: 1.25, point: 0x00f5ff, pointIntensity: 4 },
    grid: { main: 0x00ffff, sub: 0x0b4050, opacity: 0.14 },
    material: {
      ground: 0x071520,
      platform: 0x0a1820,
      road: 0x1a2a30,
      wall: 0x1a3a4a,
      wallEmissive: 0x002b34,
      building: 0x0c4d67,
      buildingAlarm: 0x351719,
      buildingEmissive: 0x00384c,
      furniture: 0x2a4a5a,
      ceilingLight: 0xeeffff,
      robotBody: 0xe8f0f0,
      robotDark: 0x0a1a2a,
      wheel: 0x1a1a1a
    },
    effect: {
      primary: 0x00f5ff,
      edge: 0x00eaff,
      route: 0x00f5ff,
      routeDot: 0x8fffff,
      roadMark: 0xffcc00,
      water: 0x00aacc,
      portalBg: '#020811',
      portalBgRgb: '2, 8, 17',
      portalParticle: '#00f5ff'
    }
  },
  semantic: { primary: 0x00f5ff, success: 0x26f2a3, warning: 0xffb642, danger: 0xff554f }
}

export const blueWhiteTheme = {
  name: 'blueWhite',
  css: {
    pageBg: '#f4f9ff',
    pageGradient: 'linear-gradient(180deg, #f7fbff 0%, #edf6ff 100%)',
    panelBg: '#f6fbff',
    panelMask: 'rgba(45,140,255,.055)',
    panelBorder: 'rgba(45,140,255,.28)',
    panelShadow: 'inset 0 0 28px rgba(73,145,255,.08), 0 8px 22px rgba(36,93,170,.08)',
    cardBg: 'rgba(255,255,255,.86)',
    cardBorder: 'rgba(45,140,255,.22)',
    buttonBg: 'rgba(255,255,255,.78)',
    buttonActiveBg: 'linear-gradient(180deg, #2d8cff, #126bff)',
    buttonText: '#17456f',
    primary: '#126bff',
    primarySoft: 'rgba(18,107,255,.14)',
    text: '#17324d',
    muted: '#60708a',
    weak: 'rgba(68,93,124,.58)',
    danger: '#ff4d43',
    dangerText: '#b42318',
    dangerBg: 'rgba(255,77,67,.10)',
    success: '#18a869',
    progress: 'linear-gradient(90deg, #126bff, #67b7ff)'
  },
  three: {
    clear: 0xf3f9ff,
    fog: 0xe8f3ff,
    lights: { ambient: 0xffffff, ambientIntensity: 1.05, directional: 0xffffff, directionalIntensity: 1.65, point: 0x2d8cff, pointIntensity: 1.2 },
    grid: { main: 0x7db7ff, sub: 0xc9dff7, opacity: 0.28 },
    material: {
      ground: 0xeaf3fb,
      platform: 0xe8f2fc,
      road: 0xdcecff,
      wall: 0xd7eaff,
      wallEmissive: 0x9cc9ff,
      building: 0xd7ebff,
      buildingAlarm: 0xffdfdc,
      buildingEmissive: 0x7db7ff,
      furniture: 0xc9d9e8,
      ceilingLight: 0xffffff,
      robotBody: 0xffffff,
      robotDark: 0x245377,
      wheel: 0x35495f
    },
    effect: {
      primary: 0x126bff,
      edge: 0x2d8cff,
      route: 0x126bff,
      routeDot: 0x5fb0ff,
      roadMark: 0xffa726,
      water: 0x4bb7ff,
      portalBg: '#f4f9ff',
      portalBgRgb: '244, 249, 255',
      portalParticle: '#126bff'
    }
  },
  semantic: { primary: 0x126bff, success: 0x18a869, warning: 0xff9f1a, danger: 0xff4d43 }
}

export const sceneThemes = {
  darkTech: darkTechTheme,
  blueWhite: blueWhiteTheme
}

export function getSceneTheme (themeName = 'blueWhite') {
  return sceneThemes[themeName] || blueWhiteTheme
}

export function applyThemeVars (theme) {
  return {
    '--scene-page-bg': theme.css.pageBg,
    '--scene-page-gradient': theme.css.pageGradient,
    '--scene-panel-bg': theme.css.panelBg,
    '--scene-panel-mask': theme.css.panelMask,
    '--scene-panel-border': theme.css.panelBorder,
    '--scene-panel-shadow': theme.css.panelShadow,
    '--scene-card-bg': theme.css.cardBg,
    '--scene-card-border': theme.css.cardBorder,
    '--scene-button-bg': theme.css.buttonBg,
    '--scene-button-active-bg': theme.css.buttonActiveBg,
    '--scene-button-text': theme.css.buttonText,
    '--scene-primary': theme.css.primary,
    '--scene-primary-soft': theme.css.primarySoft,
    '--scene-text': theme.css.text,
    '--scene-muted': theme.css.muted,
    '--scene-weak': theme.css.weak,
    '--scene-danger': theme.css.danger,
    '--scene-danger-text': theme.css.dangerText,
    '--scene-danger-bg': theme.css.dangerBg,
    '--scene-success': theme.css.success,
    '--scene-progress': theme.css.progress
  }
}

export function resolveToneColor (theme, tone, fallback = 'primary') {
  return theme.semantic[tone] || theme.semantic[fallback] || theme.semantic.primary
}

export function assertThemeComplete (theme) {
  const missing = requiredPaths.filter(path => {
    return path.split('.').reduce((value, key) => value && value[key], theme) === undefined
  })
  if (missing.length) throw new Error(`Theme "${theme.name}" missing tokens: ${missing.join(', ')}`)
}
