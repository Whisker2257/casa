// /Users/nashe/casa/frontend/src/components/Login.jsx
import React, { useContext, useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import { AuthContext } from '../contexts/AuthContext';

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate  = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-6">
        <h2 className="text-2xl font-semibold text-center">Sign in to Casa</h2>
        {error && <div className="text-error text-sm">{error}</div>}
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <button className="btn btn-primary w-full">Login</button>
        <p className="text-center text-sm text-text-secondary">
          No account? <Link to="/signup" className="text-primary hover:underline">Create one</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
