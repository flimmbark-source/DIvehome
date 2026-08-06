import { useState } from 'react'
import ApparatusRun from './components/ApparatusRun.jsx'
import WhiteSpace from './components/WhiteSpace.jsx'
import {
  addShapeDrops,
  craftFurniture,
  emptyFuelState,
  emptyFurnitureState,
  emptyShapeInventory,
  loadFurnitureFuel,
  prepareRunFromFurniture,
  totalShapes,
  unloadFurnitureFuel,
} from './game/progression.js'

const INITIAL_PROGRESSION = Object.freeze({
  inventory: emptyShapeInventory(),
  built: emptyFurnitureState(),
  fuel: emptyFuelState(),
  mechanismUnlocked: false,
})

export default function App() {
  const [mode, setMode] = useState('room')
  const [progression, setProgression] = useState(INITIAL_PROGRESSION)
  const [runLoadout, setRunLoadout] = useState(null)

  const startApparatus = () => {
    const prepared = prepareRunFromFurniture(progression)
    setProgression(prepared.progression)
    setRunLoadout(prepared.loadout)
    setMode('apparatus')
  }

  if (mode === 'apparatus') {
    return (
      <ApparatusRun
        loadout={runLoadout}
        onReturn={(shapeDrops) => {
          setProgression((current) => {
            const inventory = addShapeDrops(current.inventory, shapeDrops)
            return {
              ...current,
              inventory,
              mechanismUnlocked: current.mechanismUnlocked || totalShapes(shapeDrops) > 0,
            }
          })
          setMode('room')
        }}
      />
    )
  }

  return (
    <WhiteSpace
      progression={progression}
      onUseApparatus={startApparatus}
      onCraft={(recipeId) => setProgression((current) => craftFurniture(current, recipeId))}
      onFuel={(furnitureId, shapeKey) =>
        setProgression((current) => loadFurnitureFuel(current, furnitureId, shapeKey))
      }
      onClearFuel={(furnitureId) =>
        setProgression((current) => unloadFurnitureFuel(current, furnitureId))
      }
    />
  )
}
