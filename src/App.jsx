import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Verify from './pages/Verify'
import Domains from './pages/Domains'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import AcceptInvite from './pages/AcceptInvite'
import PasswordRequired from './pages/PasswordRequired'
import Account from './pages/Account'
import RequireAccount from './components/RequireAccount'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<RequireAccount><Dashboard /></RequireAccount>} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/domains" element={<RequireAccount><Domains /></RequireAccount>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<RequireAccount><Admin /></RequireAccount>} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/account" element={<RequireAccount><Account /></RequireAccount>} />
        <Route path="/account/password-required" element={<RequireAccount allowPasswordChange><PasswordRequired /></RequireAccount>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
