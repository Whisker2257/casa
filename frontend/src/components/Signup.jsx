// /Users/nashe/casa/frontend/src/components/Signup.jsx
import React, { useContext, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Signup = () => {
  const { login } = useContext(AuthContext);
  const navigate  = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/signup`, form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-6">
        <h2 className="text-2xl font-semibold text-center">Create Casa Account</h2>
        {error && <div className="text-error text-sm">{error}</div>}
        <input
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
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
          placeholder="Password (min 6 chars)"
          value={form.password}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <button className="btn btn-primary w-full">Sign Up</button>
        <p className="text-center text-sm text-text-secondary">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
};

export default Signup;
