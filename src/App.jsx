import { useState } from 'react'
import ApparatusRun from './components/ApparatusRun.jsx'
import WhiteSpace from './components/WhiteSpace.jsx'

export default function App() {
  const [mode, setMode] = useState('room')
  const [currency, setCurrency] = useState(0)

  if (mode === 'apparatus') {
    return (
      <ApparatusRun
        onReturn={(payout) => {
          setCurrency((current) => current + payout)
          setMode('room')
        }}
      />
    )
  }

  return <WhiteSpace currency={currency} onUseApparatus={() => setMode('apparatus')} />
}
