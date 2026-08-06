import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FURNITURE_RECIPES,
  SHAPE_KEYS,
  SHAPE_META,
  furnitureFuelEffect,
} from '../game/progression.js'

function initialShape(progression, furnitureId) {
  const loaded = progression.fuel?.[furnitureId]
  if (loaded && SHAPE_KEYS.includes(loaded)) return loaded
  return SHAPE_KEYS.find((shape) => (progression.inventory?.[shape] ?? 0) > 0) ?? SHAPE_KEYS[0]
}

function recaptureMouse() {
  document.getElementById('root')?.requestPointerLock?.()
}

export default function FurnitureFuelSelector({
  furnitureId,
  progression,
  onFuel,
  onClearFuel,
  onClose,
}) {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(0, SHAPE_KEYS.indexOf(initialShape(progression, furnitureId))),
  )

  const furniture = FURNITURE_RECIPES[furnitureId]
  const selectedShape = SHAPE_KEYS[selectedIndex]
  const selectedMeta = SHAPE_META[selectedShape]
  const loadedShape = progression.fuel?.[furnitureId] ?? null
  const storedCount = progression.inventory?.[selectedShape] ?? 0
  const isLoaded = loadedShape === selectedShape
  const canLoad = isLoaded || storedCount > 0
  const effect = furnitureFuelEffect(furnitureId, selectedShape)

  const cycle = useCallback((direction) => {
    setSelectedIndex((current) => (current + direction + SHAPE_KEYS.length) % SHAPE_KEYS.length)
  }, [])

  const confirm = useCallback(() => {
    if (!canLoad) return
    if (!isLoaded) onFuel(furnitureId, selectedShape)
    recaptureMouse()
    onClose()
  }, [canLoad, furnitureId, isLoaded, onClose, onFuel, selectedShape])

  const unload = useCallback(() => {
    if (!loadedShape) return
    onClearFuel(furnitureId)
    recaptureMouse()
    onClose()
  }, [furnitureId, loadedShape, onClearFuel, onClose])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        cycle(-1)
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        cycle(1)
      }
      if (event.code === 'Enter' || event.code === 'KeyE') {
        event.preventDefault()
        confirm()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirm, cycle])

  const status = useMemo(() => {
    if (isLoaded) return 'CURRENTLY LOADED'
    if (storedCount > 0) return `${storedCount} STORED`
    return 'NONE STORED'
  }, [isLoaded, storedCount])

  if (!furniture || !selectedMeta) return null

  return (
    <section
      className="furniture-fuel-selector"
      aria-label={`${furniture.label} fuel selection`}
      style={{ '--shape-color': selectedMeta.color }}
    >
      <div className="furniture-selector-heading">
        <span>{furniture.label}</span>
        <strong>SELECT FUEL</strong>
      </div>

      <div className="furniture-resource-picker">
        <button
          type="button"
          className="furniture-resource-arrow"
          onClick={() => cycle(-1)}
          aria-label="Previous resource"
        >
          ‹
        </button>

        <button
          type="button"
          className={`furniture-resource-choice ${canLoad ? '' : 'is-unavailable'}`}
          onClick={confirm}
          disabled={!canLoad}
        >
          <span className="furniture-resource-symbol" aria-hidden="true">
            {selectedMeta.symbol}
          </span>
          <strong>{selectedMeta.label}</strong>
          <span className="furniture-resource-effect">{effect}</span>
          <small>{status}</small>
        </button>

        <button
          type="button"
          className="furniture-resource-arrow"
          onClick={() => cycle(1)}
          aria-label="Next resource"
        >
          ›
        </button>
      </div>

      <div className="furniture-selector-footer">
        <span>← → CYCLE · E / ENTER LOAD · ESC CLOSE</span>
        {loadedShape && (
          <button type="button" onClick={unload}>
            UNLOAD {SHAPE_META[loadedShape].label}
          </button>
        )}
      </div>
    </section>
  )
}
