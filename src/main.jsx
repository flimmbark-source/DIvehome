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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
