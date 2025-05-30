import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// build a nested tree from flat S3 keys
function buildTree(items) {
  const root = { children: {} };

  items.forEach(item => {
    // strip off "<projectId>/" prefix
    const rel = item.path.replace(/^[^\/]+\/?/, '');
    const parts = rel.split('/').filter(p => p);
    let node = root;

    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      if (!node.children[part]) {
        node.children[part] = {
          name: part,
          path: parts.slice(0, idx + 1).join('/'),
          isDir: isLast ? item.isDir : true,
          children: {}
        };
      }
      node = node.children[part];
    });
  });

  return root.children;
}

// Recursive tree node
const TreeNode = ({ node, onSelect, onCreateFolder, onRename }) => {
  const [open, setOpen] = useState(false);
  const hasKids = node.isDir && Object.keys(node.children).length > 0;

  return (
    <div className="ml-2">
      <div className="flex items-center gap-1">
        {node.isDir && (
          <button onClick={() => setOpen(!open)} className="w-4">
            {open ? '▾' : '▸'}
          </button>
        )}
        <span
          className="cursor-pointer hover:bg-white/10 px-1"
          onClick={() => onSelect(node.path, node.isDir)}
        >
          {node.isDir ? '📁' : '📄'} {node.name}
        </span>

        {node.isDir && (
          <button
            onClick={() => onCreateFolder(node.path)}
            className="ml-auto text-xs text-primary"
          >
            +Folder
          </button>
        )}
        <button
          onClick={() => onRename(node.path, node.name)}
          className="ml-1 text-xs text-secondary"
        >
          Rename
        </button>
      </div>

      {open && hasKids && (
        <div>
          {Object.values(node.children).map(child => (
            <TreeNode
              key={child.path}
              node={child}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ExplorerTree = ({ projectId, token, onSelectFolder }) => {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // fetch full tree once
  const fetchTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_URL}/api/projects/${projectId}/tree`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setItems(res.data.items || []);
    } catch {
      setError('Could not load explorer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && token) fetchTree();
  }, [projectId, token]);

  const handleCreate = async parentPath => {
    const name = prompt('New folder name:');
    if (!name) return;
    await axios.post(
      `${API_URL}/api/projects/${projectId}/folder`,
      { path: parentPath },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchTree();
  };

  const handleRename = async (oldPath, oldName) => {
    const name = prompt(`Rename ${oldName} →`, oldName);
    if (!name || name === oldName) return;
    await axios.patch(
      `${API_URL}/api/projects/${projectId}/rename`,
      { oldPath, newName: name },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchTree();
  };

  if (loading) return <div className="p-4 text-text-secondary">Loading…</div>;
  if (error)   return <div className="p-4 text-error">{error}</div>;

  const tree = buildTree(items);
  return (
    <div className="p-2">
      {Object.values(tree).map(node => (
        <TreeNode
          key={node.path}
          node={node}
          onSelect={(path, isDir) => onSelectFolder(path)}
          onCreateFolder={handleCreate}
          onRename={handleRename}
        />
      ))}
    </div>
  );
};

export default ExplorerTree;
