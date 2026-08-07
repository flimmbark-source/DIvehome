import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FURNITURE_FUEL_EFFECTS,
  SHAPE_KEYS,
  SHAPE_META,
} from '../game/progression.js'
import { FIRE_MODES, fireModeFor } from '../game/weapon.js'

const PARTS = Object.freeze(['body', 'clip', 'muzzle'])

function nextIndex(current, direction, length) {
  return (current + direction + length) % length
}

function initialShapeIndex(shape) {
  return Math.max(0, SHAPE_KEYS.indexOf(shape))
}

function ResourceCallout({
  active,
  className,
  partLabel,
  sourceLabel,
  furnitureId,
  built,
  loadedShape,
  selectedShape,
  inventory,
  onActivate,
  onCycle,
  onConfirm,
}) {
  const selectedMeta = SHAPE_META[selectedShape]
  const loadedMeta = loadedShape ? SHAPE_META[loadedShape] : null
  const selectedCount = inventory?.[selectedShape] ?? 0
  const selectedEffect = FURNITURE_FUEL_EFFECTS[furnitureId][selectedShape]
  const loadedEffect = loadedShape
    ? FURNITURE_FUEL_EFFECTS[furnitureId][loadedShape]
    : `NO ${partLabel} RESOURCE LOADED`
  const canLoad = built && (loadedShape === selectedShape || selectedCount > 0)

  return (
    <article
      className={`gun-callout ${className} ${active ? 'is-active' : ''}`}
      style={{ '--shape-color': selectedMeta.color }}
      onPointerDown={onActivate}
    >
      <span>{partLabel} · {sourceLabel}</span>
      <strong style={{ color: loadedMeta?.color ?? '#7b8580' }}>
        {loadedMeta ? `${loadedMeta.symbol} ${loadedMeta.label}` : 'EMPTY'}
      </strong>
      <small>{loadedEffect}</small>

      <div className="gun-option-cycle">
        <button type="button" onClick={() => onCycle(-1)} aria-label={`Previous ${partLabel.toLowerCase()} resource`}>‹</button>
        <div>
          <b style={{ color: selectedMeta.color }}>{selectedMeta.symbol} {selectedMeta.label}</b>
          <em>{selectedEffect}</em>
          <small>{selectedCount} STORED</small>
        </div>
        <button type="button" onClick={() => onCycle(1)} aria-label={`Next ${partLabel.toLowerCase()} resource`}>›</button>
      </div>

      <button
        className="gun-load-button"
        type="button"
        disabled={!canLoad}
        onClick={onConfirm}
      >
        {!built
          ? `BUILD ${sourceLabel} TO UNLOCK`
          : loadedShape === selectedShape
            ? `UNLOAD ${partLabel}`
            : selectedCount > 0
              ? `LOAD ${partLabel}`
              : 'NO SHAPE AVAILABLE'}
      </button>
    </article>
  )
}

export default function GunCustomizer({
  progression,
  onFuel,
  onClearFuel,
  onFireMode,
  onClose,
}) {
  const loadedBodyShape = progression.fuel?.toaster ?? null
  const loadedClipShape = progression.fuel?.workbench ?? null
  const [activePart, setActivePart] = useState('body')
  const [bodyIndex, setBodyIndex] = useState(() => initialShapeIndex(loadedBodyShape))
  const [clipIndex, setClipIndex] = useState(() => initialShapeIndex(loadedClipShape))
  const rootRef = useRef(null)

  const selectedBodyShape = SHAPE_KEYS[bodyIndex]
  const selectedClipShape = SHAPE_KEYS[clipIndex]
  const currentMode = fireModeFor(progression.weapon?.fireMode)
  const modeIndex = FIRE_MODES.indexOf(currentMode.id)

  const openApparatusMenu = useCallback(() => {
    onClose()
    window.dispatchEvent(new CustomEvent('divehome-open-apparatus'))
  }, [onClose])

  const cyclePart = useCallback((direction) => {
    setActivePart((current) => PARTS[nextIndex(PARTS.indexOf(current), direction, PARTS.length)])
  }, [])

  const cycleMode = useCallback((direction) => {
    const nextMode = FIRE_MODES[nextIndex(modeIndex, direction, FIRE_MODES.length)]
    onFireMode(nextMode)
  }, [modeIndex, onFireMode])

  const cycleActiveOption = useCallback((direction) => {
    if (activePart === 'body') {
      setBodyIndex((current) => nextIndex(current, direction, SHAPE_KEYS.length))
      return
    }
    if (activePart === 'clip') {
      setClipIndex((current) => nextIndex(current, direction, SHAPE_KEYS.length))
      return
    }
    cycleMode(direction)
  }, [activePart, cycleMode])

  const toggleResource = useCallback((furnitureId, selectedShape) => {
    const built = Boolean(progression.built?.[furnitureId])
    const loadedShape = progression.fuel?.[furnitureId] ?? null
    const selectedCount = progression.inventory?.[selectedShape] ?? 0
    if (!built) return
    if (loadedShape === selectedShape) {
      onClearFuel(furnitureId)
      return
    }
    if (selectedCount > 0) onFuel(furnitureId, selectedShape)
  }, [onClearFuel, onFuel, progression])

  const confirmActive = useCallback(() => {
    if (activePart === 'body') {
      toggleResource('toaster', selectedBodyShape)
      return
    }
    if (activePart === 'clip') {
      toggleResource('workbench', selectedClipShape)
      return
    }
    cycleMode(1)
  }, [activePart, cycleMode, selectedBodyShape, selectedClipShape, toggleResource])

  useEffect(() => {
    rootRef.current?.focus()
    window.dispatchEvent(new CustomEvent('divehome-weapon-preview', { detail: 'holster' }))
  }, [])

  const modeDescription = useMemo(() => {
    if (currentMode.id === 'hitscan') {
      return 'ONE IMMEDIATE RAY · CLIP SIZE, SPEED, AND GUIDANCE MODIFIERS DO NOT APPLY'
    }
    return 'THREE PHYSICAL ROUNDS · THE LOADED CLIP MODIFIES EVERY ROUND IN THE BURST'
  }, [currentMode.id])

  return (
    <section
      ref={rootRef}
      className="gun-customizer preview-holster"
      tabIndex={-1}
      aria-label="Gun customization"
      onKeyDownCapture={(event) => {
        event.stopPropagation()
        if (event.code === 'KeyW' || event.code === 'ArrowUp') {
          event.preventDefault()
          cyclePart(-1)
        }
        if (event.code === 'KeyS' || event.code === 'ArrowDown') {
          event.preventDefault()
          cyclePart(1)
        }
        if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
          event.preventDefault()
          cycleActiveOption(-1)
        }
        if (event.code === 'KeyD' || event.code === 'ArrowRight') {
          event.preventDefault()
          cycleActiveOption(1)
        }
        if (event.code === 'KeyM') {
          event.preventDefault()
          cycleMode(1)
        }
        if (event.code === 'KeyV' || event.code === 'Tab') {
          event.preventDefault()
          openApparatusMenu()
        }
        if (event.code === 'Enter' || event.code === 'KeyE') {
          event.preventDefault()
          confirmActive()
        }
        if (event.code === 'Backspace') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <svg className="gun-callout-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="315,165 410,165 497,255" />
        <circle cx="497" cy="255" r="5" />
        <polyline points="315,475 420,475 506,345" />
        <circle cx="506" cy="345" r="5" />
        <polyline points="685,250 610,250 548,274" />
        <circle cx="548" cy="274" r="5" />
      </svg>

      <header className="gun-customizer-heading">
        <span>APPARATUS ARMATURE</span>
        <strong>CONFIGURE FORMS</strong>
        <button type="button" onClick={onClose}>BACKSPACE</button>
      </header>

      <nav className="weapon-preview-switch" aria-label="Weapon and apparatus navigation">
        <button type="button" className="is-active">
          HOLSTER VIEW
        </button>
        <button type="button" onClick={openApparatusMenu}>
          APPARATUS VIEW
        </button>
      </nav>

      <ResourceCallout
        active={activePart === 'body'}
        className="body-callout"
        partLabel="BODY"
        sourceLabel="TOASTER"
        furnitureId="toaster"
        built={Boolean(progression.built?.toaster)}
        loadedShape={loadedBodyShape}
        selectedShape={selectedBodyShape}
        inventory={progression.inventory}
        onActivate={() => setActivePart('body')}
        onCycle={(direction) => {
          setActivePart('body')
          setBodyIndex((current) => nextIndex(current, direction, SHAPE_KEYS.length))
        }}
        onConfirm={() => toggleResource('toaster', selectedBodyShape)}
      />

      <ResourceCallout
        active={activePart === 'clip'}
        className="clip-callout"
        partLabel="CLIP"
        sourceLabel="WORKBENCH"
        furnitureId="workbench"
        built={Boolean(progression.built?.workbench)}
        loadedShape={loadedClipShape}
        selectedShape={selectedClipShape}
        inventory={progression.inventory}
        onActivate={() => setActivePart('clip')}
        onCycle={(direction) => {
          setActivePart('clip')
          setClipIndex((current) => nextIndex(current, direction, SHAPE_KEYS.length))
        }}
        onConfirm={() => toggleResource('workbench', selectedClipShape)}
      />

      <article
        className={`gun-callout muzzle-callout ${activePart === 'muzzle' ? 'is-active' : ''}`}
        style={{ '--mode-color': currentMode.color }}
        onPointerDown={() => setActivePart('muzzle')}
      >
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
        <span>V / TAB APPARATUS MENU · W / S SELECT PART · A / D CHANGE · E LOAD · M SWITCH MODE · BACKSPACE CLOSE</span>
      </footer>
    </section>
  )
}
