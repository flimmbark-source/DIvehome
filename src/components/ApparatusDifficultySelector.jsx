import { useCallback, useEffect, useRef, useState } from 'react'
import { DIFFICULTY_LEVELS, difficultyFor } from '../game/difficulty.js'

export default function ApparatusDifficultySelector({ initialLevel = 0, onStart, onClose }) {
  const [level, setLevel] = useState(() => difficultyFor(initialLevel).level)
  const rootRef = useRef(null)
  const difficulty = difficultyFor(level)

  const cycle = useCallback((direction) => {
    setLevel((current) => {
      const count = DIFFICULTY_LEVELS.length
      return (current + direction + count) % count
    })
  }, [])

  const start = useCallback(() => {
    onStart(difficulty.level)
  }, [difficulty.level, onStart])

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  return (
    <section
      ref={rootRef}
      className="apparatus-difficulty-selector"
      tabIndex={-1}
      aria-label="Apparatus difficulty selection"
      style={{ '--difficulty-color': difficulty.color }}
      onKeyDownCapture={(event) => {
        event.stopPropagation()
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
          start()
        }
        if (event.code === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div className="difficulty-heading">
        <span>THE APPARATUS</span>
        <strong>SET DESCENT PRESSURE</strong>
      </div>

      <div className="difficulty-picker">
        <button type="button" onClick={() => cycle(-1)} aria-label="Lower difficulty">
          ‹
        </button>

        <div className="difficulty-card" aria-live="polite">
          <span className="difficulty-number">
            {difficulty.level === 0 ? '0' : `+${difficulty.level}`}
          </span>
          <strong>{difficulty.label}</strong>
          <p>{difficulty.description}</p>

          <div className="difficulty-stats">
            <span>
              <small>WAVE SIZE</small>
              <b>{difficulty.waveSizeBonus === 0 ? 'CURRENT' : `+${difficulty.waveSizeBonus}`}</b>
            </span>
            <span>
              <small>WAVE TEMPO</small>
              <b>{difficulty.level === 0 ? 'CURRENT' : `${Math.round((1 - difficulty.waveIntervalMultiplier) * 100)}% FASTER`}</b>
            </span>
            <span>
              <small>BOSS TEMPO</small>
              <b>{difficulty.level === 0 ? 'CURRENT' : `${Math.round((difficulty.bossTempoMultiplier - 1) * 100)}% FASTER`}</b>
            </span>
            <span>
              <small>SHAPE YIELD</small>
              <b>{difficulty.resourceMultiplier}×</b>
            </span>
          </div>
        </div>

        <button type="button" onClick={() => cycle(1)} aria-label="Raise difficulty">
          ›
        </button>
      </div>

      <div className="difficulty-actions">
        <span>← → ADJUST · E / ENTER DESCEND · ESC CANCEL</span>
        <button type="button" onClick={start}>BEGIN DESCENT</button>
      </div>
    </section>
  )
}
