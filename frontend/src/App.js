// /Users/nashe/casa/frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LandingPage from './components/LandingPage.jsx';
import Login       from './components/Login.jsx';
import Signup      from './components/Signup.jsx';
import Dashboard   from './components/Dashboard.jsx';
import Editor      from './components/Editor';

import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:projectId" element={<Editor />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;