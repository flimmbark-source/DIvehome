import { useRef, useState } from 'react'
import ApparatusDifficultySelector from './components/ApparatusDifficultySelector.jsx'
import ApparatusRun from './components/ApparatusRun.jsx'
import WhiteSpace from './components/WhiteSpace.jsx'
import { difficultyEffectLabel, difficultyFor } from './game/difficulty.js'
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
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [difficultyLevel, setDifficultyLevel] = useState(0)
  const roomPoseRef = useRef({ x: 0, z: 3.4, yaw: 0, pitch: -0.04 })

  const startApparatus = (requestedLevel) => {
    const difficulty = difficultyFor(requestedLevel)
    const prepared = prepareRunFromFurniture(progression)
    setProgression(prepared.progression)
    setDifficultyLevel(difficulty.level)
    setDifficultyOpen(false)
    setRunLoadout({
      ...prepared.loadout,
      difficultyLevel: difficulty.level,
      effects: [...(prepared.loadout.effects ?? []), difficultyEffectLabel(difficulty.level)],
    })
    setMode('apparatus')
  }

  const closeDifficulty = () => {
    setDifficultyOpen(false)
    window.requestAnimationFrame(() => {
      document.getElementById('root')?.requestPointerLock?.()
    })
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
    <>
      <WhiteSpace
        progression={progression}
        roomPoseRef={roomPoseRef}
        onUseApparatus={() => setDifficultyOpen(true)}
        onCraft={(recipeId) => setProgression((current) => craftFurniture(current, recipeId))}
        onFuel={(furnitureId, shapeKey) =>
          setProgression((current) => loadFurnitureFuel(current, furnitureId, shapeKey))
        }
        onClearFuel={(furnitureId) =>
          setProgression((current) => unloadFurnitureFuel(current, furnitureId))
        }
      />

      {difficultyOpen && (
        <ApparatusDifficultySelector
          initialLevel={difficultyLevel}
          onStart={startApparatus}
          onClose={closeDifficulty}
        />
      )}
    </>
  )
}
