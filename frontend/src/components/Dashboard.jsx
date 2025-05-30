// /Users/nashe/casa/frontend/src/components/Dashboard.jsx
import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Dashboard = () => {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [error,   setError]   = useState('');

  /* redirect if not logged in */
  useEffect(() => { if (!token) navigate('/login'); }, [token, navigate]);

  /* fetch projects */
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProjects(res.data.projects))
      .catch(() => setError('Failed to fetch projects'));
  }, [token]);

  const createProject = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { data } = await axios.post(
        `${API_URL}/api/projects`,
        { name: newName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects([data.project, ...projects]);
      setNewName('');
    } catch {
      setError('Could not create project');
    }
  };

  const openProject = id => navigate(`/editor/${id}`);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="bg-surface border-b border-border h-16 flex items-center justify-between px-6">
        <span>Welcome, {user?.name}</span>
        <button onClick={logout} className="btn btn-outline">Log out</button>
      </header>

      <main className="container mx-auto py-12 space-y-10">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Create New Project</h2>
          <form onSubmit={createProject} className="flex gap-4">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Project name"
              className="input input-bordered flex-1"
              required
            />
            <button className="btn btn-primary">Add</button>
          </form>
          {error && <p className="text-error mt-2">{error}</p>}
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Projects</h2>
          {projects.length === 0 && <p className="text-text-secondary">No projects yet.</p>}
          <div className="grid-auto-fit">
            {projects.map(p => (
              <div
                key={p._id}
                className="card hover-lift cursor-pointer"
                onClick={() => openProject(p._id)}
              >
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <p className="text-text-secondary text-sm mt-2">
                  Created {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
