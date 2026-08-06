import {
  FURNITURE_RECIPES,
  SHAPE_KEYS,
  SHAPE_META,
  canAffordRecipe,
  furnitureFuelEffect,
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

function FuelControls({ furnitureId, inventory, loadedShape, onFuel, onClearFuel }) {
  const loadedMeta = loadedShape ? SHAPE_META[loadedShape] : null
  const loadedEffect = loadedShape ? furnitureFuelEffect(furnitureId, loadedShape) : ''

  return (
    <div className="fuel-controls">
      <div className="fuel-current">
        <span>LOADED FUEL</span>
        <strong
          className={loadedShape ? 'is-loaded' : ''}
          style={loadedMeta
            ? { color: loadedMeta.color, textShadow: '1px 1px 0 #202425' }
            : undefined}
        >
          {loadedMeta
            ? `${loadedMeta.symbol} ${loadedMeta.label} — ${loadedEffect}`
            : 'EMPTY'}
        </strong>
        {loadedShape && (
          <button type="button" onClick={() => onClearFuel(furnitureId)}>
            UNLOAD
          </button>
        )}
      </div>
      <div className="fuel-options">
        {SHAPE_KEYS.map((shape) => {
          const meta = SHAPE_META[shape]
          const disabled = (inventory?.[shape] ?? 0) <= 0 || loadedShape === shape
          return (
            <button
              key={shape}
              type="button"
              disabled={disabled}
              onClick={() => onFuel(furnitureId, shape)}
              style={{ '--shape-color': meta.color }}
            >
              <span>{meta.symbol}</span>
              <strong>{meta.label}</strong>
              <small>{inventory?.[shape] ?? 0} STORED</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AssemblerPanel({ progression, onCraft, onFuel, onClearFuel, onClose }) {
  return (
    <section className="assembler-panel" aria-label="Shape assembler">
      <header>
        <div>
          <span>DOMESTIC CONVERSION UNIT</span>
          <h1>THE ASSEMBLER</h1>
        </div>
        <button type="button" className="assembler-close" onClick={onClose}>
          CLOSE
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
        Build room objects from recovered shapes. A built object can hold one additional shape as fuel.
        Loaded fuel is consumed when the next Apparatus run begins.
      </p>

      <div className="recipe-grid">
        {Object.values(FURNITURE_RECIPES).map((recipe) => {
          const built = Boolean(progression.built?.[recipe.id])
          const affordable = canAffordRecipe(progression.inventory, recipe.id)
          return (
            <article key={recipe.id} className={`recipe-card ${built ? 'is-built' : ''}`}>
              <div className="recipe-heading">
                <span>{recipe.category}</span>
                <h2>{recipe.label}</h2>
              </div>
              <p>{recipe.description}</p>

              {!built ? (
                <>
                  <Cost cost={recipe.cost} inventory={progression.inventory} />
                  <button type="button" disabled={!affordable} onClick={() => onCraft(recipe.id)}>
                    {affordable ? 'ASSEMBLE' : 'INSUFFICIENT SHAPES'}
                  </button>
                </>
              ) : (
                <FuelControls
                  furnitureId={recipe.id}
                  inventory={progression.inventory}
                  loadedShape={progression.fuel?.[recipe.id] ?? null}
                  onFuel={onFuel}
                  onClearFuel={onClearFuel}
                />
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
