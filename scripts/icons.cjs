// Erzeugt die App-Icons aus SVG. Aufruf: node scripts/icons.cjs (braucht Playwright, nur bei Änderungen am Icon nötig)
const { chromium } = require('playwright')
const path = require('path')
const out = (f) => path.resolve(__dirname, '..', 'assets', f)
// Notizblatt mit Eselsohr und drei Zeilen, die letzte rot wie im Editor.
const note = (fg, line, red) => `
  <path d="M150 112h160l62 62v206a24 24 0 0 1-24 24H150a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z" fill="${fg}"/>
  <path d="M310 112v50a12 12 0 0 0 12 12h50" fill="none" stroke="${line}" stroke-width="10" stroke-linejoin="round" opacity="0.35"/>
  <path d="M176 238h160M176 290h160" stroke="${line}" stroke-width="22" stroke-linecap="round"/>
  <path d="M176 342h96" stroke="${red}" stroke-width="22" stroke-linecap="round"/>`
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34c27a"/><stop offset="1" stop-color="#1e9a5a"/></linearGradient></defs>`
const svgs = {
  'icon.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" fill="url(#g)"/><g transform="translate(256 256) scale(0.8) translate(-250 -258)">${note('#fff', '#1e9a5a', '#d93838')}</g></svg>`],
  // Android: Vordergrund im sicheren Bereich (ca. 66 %), Hintergrund separat
  'android-icon-foreground.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.6) translate(-250 -258)">${note('#fff', '#1e9a5a', '#d93838')}</g></svg>`],
  'android-icon-background.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" fill="url(#g)"/></svg>`],
  'android-icon-monochrome.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.6) translate(-250 -258)"><mask id="m"><rect width="512" height="512" fill="#fff"/><path d="M176 238h160M176 290h160M176 342h96" stroke="#000" stroke-width="22" stroke-linecap="round"/></mask><path mask="url(#m)" d="M150 112h160l62 62v206a24 24 0 0 1-24 24H150a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z" fill="#fff"/></g></svg>`],
  'splash-icon.png': [512, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" rx="112" fill="url(#g)"/><g transform="translate(256 256) scale(0.8) translate(-250 -258)">${note('#fff', '#1e9a5a', '#d93838')}</g></svg>`],
  'favicon.png': [48, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" rx="112" fill="url(#g)"/>${note('#fff', '#1e9a5a', '#d93838')}</svg>`],
}
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const [file, [size, svg]] of Object.entries(svgs)) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img width="${size}" height="${size}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`)
    await page.screenshot({ path: out(file), omitBackground: true })
  }
  await browser.close()
})()
