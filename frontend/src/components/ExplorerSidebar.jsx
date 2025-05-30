// /Users/nashe/casa/frontend/src/components/ExplorerSidebar.jsx
import React from 'react';

const ROOT_FOLDERS = [
  'Papers',
  'Datasets',
  'Code',
  'Figures',
  'Notes',
  'Output Documents',
];
const ROOT_PATHS = ROOT_FOLDERS.map(n => n.toLowerCase().replace(/ /g, ''));

function buildTree(items) {
  const root = {};
  items.forEach(item => {
    if (!item.isDir) return;
    const parts = item.path.split('/');
    let cur = root;
    parts.forEach(p => {
      if (!cur[p]) cur[p] = { name: p, path: p, children: {} };
      cur = cur[p].children;
    });
  });
  return root;
}

const ExplorerSidebar = ({
  treeItems,
  expanded,
  setExpanded,
  selectedNode,
  setSelectedNode,
  onContextMenu,
}) => {
  const tree = buildTree(treeItems);

  const TreeNode = ({ node, level = 0 }) => {
    const hasKids = Boolean(Object.keys(node.children).length);
    const isOpen = expanded.has(node.path);

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1 hover:bg-white/10 px-1 cursor-pointer select-none"
          style={{ paddingLeft: level * 12 }}
          onClick={() => {
            if (hasKids) {
              setExpanded(exp => {
                const nxt = new Set(exp);
                nxt.has(node.path) ? nxt.delete(node.path) : nxt.add(node.path);
                return nxt;
              });
            }
          }}
          onContextMenu={e => onContextMenu(e, 'folder', node)}
        >
          {hasKids ? (
            <span className="w-4">{isOpen ? '▾' : '▸'}</span>
          ) : (
            <span className="inline-block w-4" />
          )}
          <span
            className={selectedNode === node.path ? 'font-semibold' : 'flex-1'}
            onClick={() => setSelectedNode(node.path)}
          >
            {node.name}
          </span>
        </div>
        {isOpen &&
          Object.values(node.children).map(child => (
            <TreeNode key={child.path} node={child} level={level + 1} />
          ))}
      </div>
    );
  };

  return (
    <aside className="w-64 bg-surface border-r border-border overflow-auto relative">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Research Explorer</h2>
        {ROOT_FOLDERS.map(name => {
          const key = name.toLowerCase().replace(/ /g, '');
          const node = tree[key] || { name: key, path: key, children: {} };
          return <TreeNode key={node.path} node={node} />;
        })}
      </div>
    </aside>
  );
};

export default ExplorerSidebar;
