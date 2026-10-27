import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProductList from './components/ProductList'
import ProductDetail from './components/ProductDetail'
import BottomNavigation from './components/BottomNavigation'
import Layout from './components/Layout'
import LoginForm from './components/LoginForm'
import AuthScreens from './components/AuthScreens'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import UserScreens from './components/UserScreens'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', localStorage.getItem('qr_dark_mode') === 'true')
  }, [])
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<AuthScreens mode="signup" />} />
            <Route path="/forgot-password" element={<AuthScreens mode="forgot" />} />
            <Route path="/verify" element={<AuthScreens mode="verify" />} />
            <Route path="/reset-password" element={<AuthScreens mode="reset" />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProductList />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/product/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProductDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/user/*"
              element={<ProtectedRoute><Layout><UserScreens /></Layout></ProtectedRoute>}
            />
          </Routes>
          <BottomNavigation />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
