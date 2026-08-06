import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FURNITURE_RECIPES,
  SHAPE_KEYS,
  SHAPE_META,
  canAffordRecipe,
} from '../game/progression.js'

function Cost({ cost, inventory }) {
  return (
    <div className="recipe-cost">
      {Object.entries(cost).map(([shape, amount]) => {
        const meta = SHAPE_META[shape]
        const enough = (inventory?.[shape] ?? 0) >= amount
        return (
          <span key={shape} className={enough ? 'is-affordable' : 'is-missing'}>
            {meta.symbol} {amount} {meta.label}
          </span>
        )
      })}
    </div>
  )
}

export default function AssemblerPanel({ progression, onCraft, onClose }) {
  const rootRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const unbuiltRecipes = useMemo(
    () => Object.values(FURNITURE_RECIPES).filter((recipe) => !progression.built?.[recipe.id]),
    [progression.built],
  )

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex((current) => Math.max(0, Math.min(current, unbuiltRecipes.length - 1)))
  }, [unbuiltRecipes.length])

  const cycle = (direction) => {
    if (unbuiltRecipes.length < 2) return
    setSelectedIndex((current) => (current + direction + unbuiltRecipes.length) % unbuiltRecipes.length)
  }

  const assembleSelected = () => {
    const recipe = unbuiltRecipes[selectedIndex]
    if (!recipe || !canAffordRecipe(progression.inventory, recipe.id)) return
    onCraft(recipe.id)
  }

  return (
    <section
      ref={rootRef}
      className="assembler-panel"
      aria-label="Shape assembler"
      tabIndex={-1}
      onKeyDownCapture={(event) => {
        event.stopPropagation()
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
          event.preventDefault()
          cycle(-1)
        }
        if (event.code === 'ArrowRight' || event.code === 'KeyD') {
          event.preventDefault()
          cycle(1)
        }
        if (event.code === 'Enter' || event.code === 'KeyE') {
          event.preventDefault()
          assembleSelected()
        }
        if (event.code === 'Backspace') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header>
        <div>
          <span>DOMESTIC CONVERSION UNIT</span>
          <h1>THE ASSEMBLER</h1>
        </div>
        <button type="button" className="assembler-close" onClick={onClose}>
          BACKSPACE
        </button>
      </header>

      <div className="shape-ledger">
        {SHAPE_KEYS.map((shape) => {
          const meta = SHAPE_META[shape]
          return (
            <div key={shape} style={{ '--shape-color': meta.color }}>
              <span>{meta.symbol}</span>
              <strong>{progression.inventory?.[shape] ?? 0}</strong>
              <small>{meta.label}</small>
            </div>
          )
        })}
      </div>

      <p className="assembler-explanation">
        Combine recovered shapes into room systems. Once assembled, an object leaves this inventory
        and must be used directly in the White Space.
      </p>

      {unbuiltRecipes.length > 0 ? (
        <div className="recipe-grid assembler-inventory-grid">
          {unbuiltRecipes.map((recipe, index) => {
            const affordable = canAffordRecipe(progression.inventory, recipe.id)
            return (
              <article
                key={recipe.id}
                className={`recipe-card assembler-inventory-item ${index === selectedIndex ? 'is-selected' : ''}`}
                onPointerDown={() => setSelectedIndex(index)}
              >
                <div className="recipe-heading">
                  <span>{recipe.category}</span>
                  <h2>{recipe.label}</h2>
                </div>
                <p>{recipe.description}</p>
                <Cost cost={recipe.cost} inventory={progression.inventory} />
                <button type="button" disabled={!affordable} onClick={() => onCraft(recipe.id)}>
                  {affordable ? 'ASSEMBLE' : 'INSUFFICIENT SHAPES'}
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="assembler-empty">
          <strong>NO UNBUILT SYSTEMS REMAIN</strong>
          <span>Use the completed objects directly in the room.</span>
        </div>
      )}

      <div className="assembler-key-help">A / D SELECT · E ASSEMBLE · BACKSPACE CLOSE</div>
    </section>
  )
}
