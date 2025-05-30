// /Users/nashe/casa/frontend/src/components/LandingPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '📚',
    title: 'Literature Copilot',
    desc: 'Ask high-level questions and let Casa decompose, search 20+ sources, and surface key papers & gaps—ready to cite.',
  },
  {
    icon: '🔍',
    title: 'Deep Research Reports',
    desc: 'Generate fully-structured reports (Intro → Next Steps) with embedded citations, figures, and editable outlines.',
  },
  {
    icon: '💻',
    title: 'Contextual Code Gen',
    desc: 'Create, diff, and run task-scoped code (mesh.py, solver.py …) right inside the editor. Human-in-loop by design.',
  },
  {
    icon: '🧪',
    title: 'Inline Notebook Execution',
    desc: 'One-click “Run” spins up an embedded Jupyter cell; errors are under-lined with AI-powered fixes at hand.',
  },
  {
    icon: '✍️',
    title: 'LaTeX & Writing Assistant',
    desc: 'Context-aware autocomplete, equation insertion, and auto-managed .bib files—draft faster, polish smarter.',
  },
  {
    icon: '📈',
    title: 'Diagram & Figure Studio',
    desc: 'Describe a schematic; Casa returns an editable SVG and drops the \\includegraphics for you—zero fiddling.',
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/20">
      {/* ─────────── Navigation ─────────── */}
      <nav className="bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <span className="text-2xl font-bold">Casa</span>
          <div className="space-x-4">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/signup" className="btn btn-primary">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ─────────── Hero ─────────── */}
      <header className="container mx-auto py-24 text-center max-w-4xl">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-6xl font-extrabold text-gradient"
        >
          One IDE for <span className="whitespace-nowrap">Every&nbsp;Research&nbsp;Step</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 text-lg text-text-secondary"
        >
          Casa unifies literature discovery, prototype coding, and manuscript drafting into a single,
          AI-first workspace—so you can spend less time searching and formatting, and more time thinking.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/signup" className="btn btn-primary px-8 py-3 text-lg">Start Free Trial</Link>
          <Link to="/editor" className="btn btn-outline px-8 py-3 text-lg">Live&nbsp;Demo</Link>
        </motion.div>
      </header>

      {/* ─────────── Features ─────────── */}
      <section className="py-24 bg-surface">
        <div className="container mx-auto">
          <h2 className="text-center text-3xl font-semibold mb-16">Feature Modules</h2>
          <div className="grid-auto-fit">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card hover-lift"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-text-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Call-to-Action ─────────── */}
      <section className="bg-primary py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4 text-white">Ready to Accelerate Your Research?</h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Join researchers worldwide who cut weeks off their projects with Casa’s unified, AI-driven workflow.
          </p>
          <Link to="/signup" className="btn btn-secondary text-lg px-10 py-3">Create Account</Link>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="bg-surface border-t border-border py-12">
        <div className="container mx-auto text-center text-sm text-text-secondary">
          © {new Date().getFullYear()} Casa — Your AI-Powered Research Companion.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
