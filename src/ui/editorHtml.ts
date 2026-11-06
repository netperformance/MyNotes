/**
 * Der Texteditor läuft in einer eingebetteten Webansicht (WebView), weil nur sie Fett, Rot und
 * Aufzählungen schon beim Schreiben zeigen kann. Die Seite wird aus diesem Text erzeugt und
 * lädt nichts aus dem Internet, die App hat dafür auch keine Berechtigung.
 *
 * Gespeichert wird ein kleines HTML mit festem Wortschatz (siehe NoteFields.body). Alles andere,
 * etwa eingefügter Text aus anderen Apps, wird beim Speichern auf diesen Wortschatz reduziert.
 */

export interface EditorTheme {
  text: string
  red: string
  placeholder: string
  background: string
  accent: string
  /** Schriftgröße des Textes in Bildschirmpunkten. */
  fontSize: number
}

/** Nachrichten vom Editor an die App. */
export type EditorMessage =
  | { type: 'change'; html: string; empty: boolean }
  | { type: 'state'; bold: boolean; red: boolean; list: boolean }
  | { type: 'focus' }
  | { type: 'blur' }

/** Befehle der App an den Editor. */
export type EditorCommand = 'bold' | 'red' | 'black' | 'list' | 'undo' | 'focus' | 'blur'

/** Schreibt einen Wert so in ein Skript, dass er es nicht beenden oder verändern kann. */
const js = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export function editorHtml(options: { html: string; lang: string; placeholder: string; theme: EditorTheme }): string {
  const { theme } = options
  return `<!doctype html>
<html lang="${options.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root{--text:${theme.text};--red:${theme.red};--ph:${theme.placeholder};--bg:${theme.background};--accent:${theme.accent};--size:${theme.fontSize}px}
html,body{margin:0;padding:0;background:var(--bg);height:100%}
body{-webkit-text-size-adjust:none;text-size-adjust:none}
#ed{box-sizing:border-box;min-height:100%;padding:4px 20px 40px;outline:none;color:var(--text);caret-color:var(--accent);
  font-family:system-ui,-apple-system,Roboto,sans-serif;font-size:var(--size);line-height:1.55;word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap}
#ed.empty::before{content:attr(data-ph);color:var(--ph);pointer-events:none;position:absolute}
#ed ul{margin:2px 0;padding-left:1.4em}
#ed li{margin:1px 0}
#ed .r{color:var(--red)}
#ed b{font-weight:700}
</style>
</head>
<body>
<div id="ed" contenteditable="true" spellcheck="true" lang="${options.lang}" data-ph="" autocapitalize="sentences"></div>
<script>
(function(){
var ed = document.getElementById('ed');
ed.setAttribute('data-ph', ${js(options.placeholder)});
var RED = ${js(theme.red)}, TEXT = ${js(theme.text)};
function post(m){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function parseColor(c){
  if (!c) return null;
  c = String(c).trim().toLowerCase();
  var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m){ var h = m[1]; if (h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  m = c.match(/^rgba?\\(\\s*(\\d+)[ ,]+(\\d+)[ ,]+(\\d+)/);
  if (m) return [+m[1],+m[2],+m[3]];
  if (c==='red') return [255,0,0];
  return null;
}
function isRed(c){ var p = parseColor(c); return !!p && p[0] > 150 && p[1] < 150 && p[2] < 150 && p[0] - p[1] > 60; }
function boldOf(el, inherited){
  var w = el.style && el.style.fontWeight;
  if (w === 'normal' || w === 'lighter' || (+w > 0 && +w < 600)) return false;
  return inherited || el.tagName==='B' || el.tagName==='STRONG' || w==='bold' || w==='bolder' || (+w >= 600);
}
function redOf(el, inherited){
  if (el.classList && el.classList.contains('r')) return true;
  var c = (el.tagName==='FONT' && el.getAttribute('color')) || (el.style && el.style.color);
  return c ? isRed(c) : inherited;
}
function run(text, bold, red){
  if (!text) return '';
  if (red) text = '<span class="r">' + text + '</span>';
  if (bold) text = '<b>' + text + '</b>';
  return text;
}
/* Baut aus beliebigem HTML das kleine, erlaubte HTML. Fett und Rot werden je Textstück bestimmt,
   damit eine innere Angabe ("wieder schwarz") die äußere aufhebt. */
function walk(node, bold, red){
  var out = '';
  for (var c = node.firstChild; c; c = c.nextSibling){
    if (c.nodeType === 3){ out += run(esc(c.nodeValue.replace(/\\u00a0/g,' ')), bold, red); continue; }
    if (c.nodeType !== 1) continue;
    var tag = c.tagName;
    if (tag==='SCRIPT' || tag==='STYLE' || tag==='TEMPLATE' || tag==='IFRAME' || tag==='OBJECT') continue;
    if (tag==='BR'){ out += '<br>'; continue; }
    var b = boldOf(c, bold), r = redOf(c, red), inner = walk(c, b, r);
    if (tag==='UL' || tag==='OL') out += '<ul>' + inner + '</ul>';
    else if (tag==='LI') out += '<li>' + inner + '</li>';
    else if (tag==='DIV' || tag==='P' || /^H[1-6]$/.test(tag) || tag==='BLOCKQUOTE' || tag==='PRE') out += '<div>' + inner + '</div>';
    else out += inner;
  }
  return out;
}
function clean(node){
  return walk(node, false, false)
    .replace(/<\\/span><\\/b><b><span class="r">/g, '')
    .replace(/<\\/b><b>/g, '')
    .replace(/<\\/span><span class="r">/g, '');
}
function sanitize(html){
  var t = document.createElement('template');
  t.innerHTML = html || '';
  return clean(t.content);
}
function isEmpty(){ return !ed.textContent.replace(/\\s/g,'') && !ed.querySelector('li'); }
function markEmpty(){ ed.classList.toggle('empty', isEmpty()); }
var last = null;
function emit(){
  markEmpty();
  var html = isEmpty() ? '' : clean(ed);
  if (html === last) return;
  last = html;
  post({ type:'change', html: html, empty: html==='' });
}
function colorAtCaret(){
  var s = document.getSelection();
  if (!s || !s.anchorNode) return false;
  var n = s.anchorNode.nodeType===3 ? s.anchorNode.parentNode : s.anchorNode;
  if (!n || !ed.contains(n)) return false;
  return isRed(getComputedStyle(n).color);
}
var lastState = '';
function state(){
  if (document.activeElement !== ed) return;
  var st = { type:'state', bold: document.queryCommandState('bold'), red: colorAtCaret(), list: document.queryCommandState('insertUnorderedList') };
  var key = JSON.stringify(st);
  if (key === lastState) return;
  lastState = key;
  post(st);
}
function caretToEnd(){
  var r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
  var s = document.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function keepCaretVisible(){
  var s = document.getSelection();
  if (!s || !s.rangeCount) return;
  var rect = s.getRangeAt(0).getBoundingClientRect();
  if (!rect || (!rect.top && !rect.bottom)) return;
  var h = window.innerHeight;
  if (rect.bottom > h - 24) window.scrollBy(0, rect.bottom - h + 48);
  else if (rect.top < 8) window.scrollBy(0, rect.top - 24);
}
try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) {}
try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
ed.innerHTML = sanitize(${js(options.html)});
last = isEmpty() ? '' : clean(ed);
markEmpty();
ed.addEventListener('input', function(){ emit(); state(); keepCaretVisible(); });
ed.addEventListener('focus', function(){ post({type:'focus'}); lastState=''; state(); });
ed.addEventListener('blur', function(){ post({type:'blur'}); });
document.addEventListener('selectionchange', state);
window.addEventListener('resize', function(){ setTimeout(keepCaretVisible, 50); });
/* Eingefügter Text kommt ohne fremde Formatierung herein. */
ed.addEventListener('paste', function(e){
  e.preventDefault();
  var text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});
ed.addEventListener('drop', function(e){ e.preventDefault(); });
/* Tippen auf die leere Fläche unter dem Text setzt den Cursor ans Ende. */
document.body.addEventListener('mousedown', function(e){ if (e.target === document.body || e.target === document.documentElement){ e.preventDefault(); ed.focus(); caretToEnd(); } });
window.editorCommand = function(cmd){
  if (cmd === 'blur'){ ed.blur(); return; }
  if (document.activeElement !== ed){
    var sel = document.getSelection(), inside = sel && sel.rangeCount && ed.contains(sel.anchorNode);
    ed.focus();
    if (!inside) caretToEnd();
  }
  if (cmd === 'focus'){ keepCaretVisible(); return; }
  if (cmd === 'bold') document.execCommand('bold');
  else if (cmd === 'red') document.execCommand('foreColor', false, RED);
  else if (cmd === 'black') document.execCommand('foreColor', false, TEXT);
  else if (cmd === 'list') document.execCommand('insertUnorderedList');
  else if (cmd === 'undo') document.execCommand('undo');
  emit(); lastState=''; state();
};
window.editorTheme = function(t){
  var s = document.documentElement.style;
  s.setProperty('--text', t.text); s.setProperty('--red', t.red); s.setProperty('--ph', t.placeholder);
  s.setProperty('--bg', t.background); s.setProperty('--accent', t.accent); s.setProperty('--size', t.fontSize + 'px');
  /* Bisher als Farbwert gesetztes Rot auf den neuen Ton umstellen, Schwarz ebenso. */
  RED = t.red; TEXT = t.text;
  var focused = document.activeElement === ed;
  ed.innerHTML = clean(ed);
  if (focused) caretToEnd();
};
window.editorSanitize = sanitize;
})();
true;
</script>
</body>
</html>`
}

/** Skript, das einen Befehl im Editor ausführt. */
export const commandScript = (cmd: EditorCommand) => `window.editorCommand && window.editorCommand(${js(cmd)}); true;`

/** Skript, das Farben und Schriftgröße im offenen Editor anpasst. */
export const themeScript = (theme: EditorTheme) => `window.editorTheme && window.editorTheme(${js(theme)}); true;`
