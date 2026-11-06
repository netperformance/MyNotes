// Datenschutz-Einstellungen für die eingebettete Webansicht des Editors (Android System WebView).
//
// - MetricsOptOut: Die WebView von Google meldet sonst Nutzungsstatistiken, wenn der Nutzer das
//   auf dem Handy allgemein erlaubt hat. Für My Notes immer aus.
// - EnableSafeBrowsing: Safe Browsing prüft aufgerufene Adressen bei Google. Der Editor ruft keine
//   Adressen auf und die App hat ohnehin keinen Internetzugang, also aus.
//
// Läuft bei jedem "expo prebuild" (build-apk.sh) und schreibt die Einträge in AndroidManifest.xml.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

const META = {
  'android.webkit.WebView.MetricsOptOut': 'true',
  'android.webkit.WebView.EnableSafeBrowsing': 'false',
}

module.exports = function withPrivacy(config) {
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults)
    for (const [name, value] of Object.entries(META)) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value)
    }
    return mod
  })
}
