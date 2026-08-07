import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './furniture.css'
import './boss.css'
import './difficulty.css'
import './gun.css'
import './craft.css'

// Pointer Lock retargets mouse events to the locked element. White Space locks
// #root so, during the Apparatus descent, the child fire-capture overlay no
// longer receives the physical click directly. Forward locked left-clicks to
// the existing combat trigger so the firing path remains unchanged.
window.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || !document.pointerLockElement) return
  const fireCapture = document.querySelector('.apparatus-shell .fire-capture')
  if (!fireCapture) return
  fireCapture.dispatchEvent(new PointerEvent('pointerdown', {
    button: 0,
    bubbles: true,
  }))
})

// White Space uses pointer lock for first-person look, but its interfaces are
// real clickable menus. Release pointer lock only when one of those menus is
// actually mounted so the system cursor appears. Every menu already recaptures
// pointer lock when it closes, keeping the transition deliberate rather than
// allowing the mouse to drift out of sync at arbitrary times.
const WHITE_SPACE_MENU_SELECTOR = [
  '.white-space-shell .assembler-panel',
  '.white-space-shell .furniture-fuel-selector',
  '.white-space-shell .gun-customizer',
  '.difficulty-overlay',
].join(', ')

const menuCursorObserver = new MutationObserver(() => {
  if (!document.pointerLockElement) return
  if (!document.querySelector(WHITE_SPACE_MENU_SELECTOR)) return
  document.exitPointerLock?.()
})
menuCursorObserver.observe(document.body, { childList: true, subtree: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
