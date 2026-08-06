import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FURNITURE_FUEL_EFFECTS,
  SHAPE_KEYS,
  SHAPE_META,
} from '../game/progression.js'
import { FIRE_MODES, fireModeFor } from '../game/weapon.js'

function nextIndex(current, direction, length) {
  return (current + direction + length) % length
}

export default function GunCustomizer({
  progression,
  onFuel,
  onClearFuel,
  onFireMode,
  onClose,
}) {
  const loadedShape = progression.fuel?.workbench ?? null
  const workbenchBuilt = Boolean(progression.built?.workbench)
  const initialIndex = Math.max(0, SHAPE_KEYS.indexOf(loadedShape))
  const [shapeIndex, setShapeIndex] = useState(initialIndex)
  const rootRef = useRef(null)
  const selectedShape = SHAPE_KEYS[shapeIndex]
  const shapeMeta = SHAPE_META[selectedShape]
  const currentMode = fireModeFor(progression.weapon?.fireMode)
  const modeIndex = FIRE_MODES.indexOf(currentMode.id)

  const cycleShape = useCallback((direction) => {
    setShapeIndex((current) => nextIndex(current, direction, SHAPE_KEYS.length))
  }, [])

  const cycleMode = useCallback((direction) => {
    const nextMode = FIRE_MODES[nextIndex(modeIndex, direction, FIRE_MODES.length)]
    onFireMode(nextMode)
  }, [modeIndex, onFireMode])

  const loadSelected = useCallback(() => {
    if (!workbenchBuilt) return
    if (loadedShape === selectedShape) onClearFuel('workbench')
    else onFuel('workbench', selectedShape)
  }, [loadedShape, onClearFuel, onFuel, selectedShape, workbenchBuilt])

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const selectedCount = progression.inventory?.[selectedShape] ?? 0
  const canLoad = workbenchBuilt && (loadedShape === selectedShape || selectedCount > 0)
  const effect = FURNITURE_FUEL_EFFECTS.workbench[selectedShape]
  const loadedMeta = loadedShape ? SHAPE_META[loadedShape] : null
  const loadedEffect = loadedShape ? FURNITURE_FUEL_EFFECTS.workbench[loadedShape] : 'NO TOOLING LOADED'

  const modeDescription = useMemo(() => {
    if (currentMode.id === 'hitscan') {
      return 'ONE IMMEDIATE RAY · PROJECTILE SIZE, SPEED, AND GUIDANCE TOOLING DO NOT APPLY'
    }
    return 'THREE PHYSICAL ROUNDS · TOOLING MODIFIES EVERY ROUND IN THE BURST'
  }, [currentMode.id])

  return (
    <section
      ref={rootRef}
      className="gun-customizer"
      tabIndex={-1}
      aria-label="Gun customization"
      onKeyDownCapture={(event) => {
        event.stopPropagation()
        if (event.code === 'KeyA') {
          event.preventDefault()
          cycleShape(-1)
        }
        if (event.code === 'KeyD') {
          event.preventDefault()
          cycleShape(1)
        }
        if (event.code === 'KeyM') {
          event.preventDefault()
          cycleMode(1)
        }
        if (event.code === 'Enter' || event.code === 'KeyE') {
          event.preventDefault()
          loadSelected()
        }
        if (event.code === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <svg className="gun-callout-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="330,210 420,210 487,270" />
        <circle cx="487" cy="270" r="5" />
        <polyline points="670,205 600,205 540,245" />
        <circle cx="540" cy="245" r="5" />
      </svg>

      <header className="gun-customizer-heading">
        <span>APPARATUS SIDEARM</span>
        <strong>CONFIGURE WEAPON</strong>
        <button type="button" onClick={onClose}>CLOSE</button>
      </header>

      <article className="gun-callout tooling-callout" style={{ '--shape-color': shapeMeta.color }}>
        <span>TOOLING CORE</span>
        <strong style={{ color: loadedMeta?.color ?? '#7b8580' }}>
          {loadedMeta ? `${loadedMeta.symbol} ${loadedMeta.label}` : 'EMPTY'}
        </strong>
        <small>{loadedEffect}</small>

        <div className="gun-option-cycle">
          <button type="button" onClick={() => cycleShape(-1)} aria-label="Previous shape">‹</button>
          <div>
            <b style={{ color: shapeMeta.color }}>{shapeMeta.symbol} {shapeMeta.label}</b>
            <em>{effect}</em>
            <small>{selectedCount} STORED</small>
          </div>
          <button type="button" onClick={() => cycleShape(1)} aria-label="Next shape">›</button>
        </div>

        <button
          className="gun-load-button"
          type="button"
          disabled={!canLoad}
          onClick={loadSelected}
        >
          {!workbenchBuilt
            ? 'BUILD WORKBENCH TO UNLOCK'
            : loadedShape === selectedShape
              ? 'UNLOAD TOOLING'
              : selectedCount > 0
                ? 'LOAD SELECTED SHAPE'
                : 'NO SHAPE AVAILABLE'}
        </button>
      </article>

      <article className="gun-callout muzzle-callout" style={{ '--mode-color': currentMode.color }}>
        <span>MUZZLE TIP</span>
        <strong style={{ color: currentMode.color }}>{currentMode.label}</strong>
        <small>{currentMode.description}</small>

        <div className="gun-option-cycle mode-cycle">
          <button type="button" onClick={() => cycleMode(-1)} aria-label="Previous fire mode">‹</button>
          <div>
            <b style={{ color: currentMode.color }}>{currentMode.label}</b>
            <em>{modeDescription}</em>
          </div>
          <button type="button" onClick={() => cycleMode(1)} aria-label="Next fire mode">›</button>
        </div>
      </article>

      <footer className="gun-customizer-help">
        <span>A / D SELECT TOOLING · E LOAD · M SWITCH MODE · ESC CLOSE</span>
      </footer>
    </section>
  )
}
