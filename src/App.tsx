import { Routes, Route, Navigate } from 'react-router-dom'
import AgendaPage from './ui/AgendaPage'
import ReservaFlow from './ui/ReservaFlow'
import AdminPage from './ui/AdminPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<AgendaPage />} />
        <Route path="/reserva/*" element={<ReservaFlow />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
