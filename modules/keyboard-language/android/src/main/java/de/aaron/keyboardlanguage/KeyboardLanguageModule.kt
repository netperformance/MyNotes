package de.aaron.keyboardlanguage

import android.os.Build
import android.os.LocaleList
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

/**
 * Sagt der Tastatur, in welcher Sprache in einem Eingabefeld geschrieben wird.
 *
 * Android kennt dafuer den Hinweis "hintLocales". Gboard, Samsung Keyboard und andere
 * Tastaturen wechseln daraufhin Layout und Wortvorschlaege, sofern die Sprache in der
 * Tastatur eingerichtet ist. Es ist nur ein Hinweis: Die App kann die Tastatur nicht zwingen.
 * Braucht keine Berechtigung.
 */
class KeyboardLanguageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KeyboardLanguage")

    AsyncFunction("apply") { viewTag: Int, languageTag: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return@AsyncFunction false
      val context = appContext.reactContext as? ReactContext ?: return@AsyncFunction false
      val view = resolve(context, viewTag) ?: return@AsyncFunction false
      val wanted = LocaleList(Locale.forLanguageTag(languageTag))
      if (view.imeHintLocales != wanted) {
        view.imeHintLocales = wanted
        // Die Tastatur liest den Hinweis nur beim Verbinden. Neu verbinden, damit er sofort gilt.
        view.context.getSystemService(InputMethodManager::class.java)?.restartInput(view)
      }
      true
    }.runOnQueue(Queues.MAIN)
  }

  private fun resolve(context: ReactContext, tag: Int): TextView? =
    try {
      UIManagerHelper.getUIManagerForReactTag(context, tag)?.resolveView(tag) as? TextView
    } catch (_: Exception) {
      null
    }
}
