import { useState } from 'react'
import { Routes , Route} from 'react-router-dom'
import Home from './pages/Home'


function App() {
  

  return (
    <>
      <div>
        
        <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          
          
        </Routes>
      </main>
      </div>
    </>
  )
}

export default App
