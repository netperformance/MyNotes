import * as SplashScreen from 'expo-splash-screen'
import * as SQLite from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useState } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SqliteRepository, type SqlDatabase } from './src/data/sqlite'
import { NotesStore } from './src/store/store'
import { MainScreen } from './src/ui/MainScreen'
import { deviceLanguage } from './src/ui/deviceLanguage'
import { LangContext, LanguageContext, STRINGS } from './src/ui/i18n'
import { FONT_STEPS, loadPrefs, PREF_KEYS, savePref, type Prefs } from './src/ui/prefs'
import { SnackbarProvider } from './src/ui/Snackbar'
import { dark, FontScaleContext, light, ThemeContext, type ThemeMode } from './src/ui/theme'
import { StoreContext } from './src/ui/useStore'

SplashScreen.preventAutoHideAsync().catch(() => {})

type Boot = { store: NotesStore; repo: SqliteRepository; prefs: Prefs }

async function boot(): Promise<Boot> {
  const db = await SQLite.openDatabaseAsync('mynotes.db')
  const repo = new SqliteRepository(db as unknown as SqlDatabase)
  const prefs = await loadPrefs(repo, deviceLanguage())
  const store = await NotesStore.open(repo, { lang: prefs.language })
  applyColorScheme(prefs.theme)
  return { store, repo, prefs }
}

/**
 * Stellt Android auf die gewählte Darstellung ein. Dann passen auch die Dialoge des
 * Systems (z. B. "Alle Daten löschen?") und die Fensterfarbe hinter der App dazu.
 */
function applyColorScheme(theme: ThemeMode): void {
  try {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme)
  } catch {
    /* ältere Android-Version ohne diese Funktion: die App färbt sich trotzdem selbst */
  }
}

export default function App() {
  const [state, setState] = useState<Boot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const system = useColorScheme()

  useEffect(() => {
    boot()
      .then((b) => {
        setState(b)
        setPrefs(b.prefs)
      })
      .catch((e) => setError(String(e)))
      .finally(() => SplashScreen.hideAsync().catch(() => {}))
  }, [])

  const theme = prefs?.theme ?? 'light'
  const isDark = theme === 'dark' || (theme === 'system' && system === 'dark')
  const colors = isDark ? dark : light

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {})
  }, [colors.bg])

  if (error) throw new Error(`Start fehlgeschlagen: ${error}`)
  if (!state || !prefs) return null

  /** Ändert eine Einstellung und speichert sie sofort auf dem Handy. */
  const change = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p))
    if (key === 'theme') applyColorScheme(value as ThemeMode)
    if (key === 'language') state.store.setLanguage(value as Prefs['language'])
    savePref(state.repo, key, value)
  }

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={colors}>
        <FontScaleContext.Provider value={FONT_STEPS[prefs.fontStep] ?? 1}>
          <LangContext.Provider value={prefs.language}>
            <LanguageContext.Provider value={STRINGS[prefs.language]}>
              <StoreContext.Provider value={state.store}>
                <SnackbarProvider>
                  <StatusBar style={isDark ? 'light' : 'dark'} />
                  <MainScreen prefs={prefs} onPref={change} keepOnReset={PREF_KEYS} />
                </SnackbarProvider>
              </StoreContext.Provider>
            </LanguageContext.Provider>
          </LangContext.Provider>
        </FontScaleContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  )
}
