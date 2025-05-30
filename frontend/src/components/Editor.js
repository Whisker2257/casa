// /Users/nashe/casa/frontend/src/components/Editor.js
/* eslint-disable no-unused-vars */
import React, { useContext, useEffect, useState, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { API_URL }     from '../config';

import ExplorerSidebar from './ExplorerSidebar';
import MainPanel       from './MainPanel';
import ChatSidebar     from './ChatSidebar';
import SearchPanel     from './SearchPanel';

/* ─────────── Constants ─────────── */
const ROOT_FOLDERS = [
  'Papers',
  'Datasets',
  'Code',
  'Figures',
  'Notes',
  'Output Documents',
];
const ROOT_PATHS = ROOT_FOLDERS.map((n) => n.toLowerCase().replace(/ /g, ''));

export default function Editor() {
  const { token }     = useContext(AuthContext);
  const { projectId } = useParams();

  /* ───── Meta ───── */
  const [status,   setStatus]   = useState('…');
  const [projName, setProjName] = useState('');

  /* ───── Explorer tree ───── */
  const [treeItems,    setTreeItems]    = useState([]);
  const [expanded,     setExpanded]     = useState(new Set());
  const [selectedNode, setSelectedNode] = useState('');

  /* ───── Files & preview ───── */
  const [files,          setFiles]          = useState([]);
  const [previewFile,    setPreviewFile]    = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);   // ← for race-free opening

  /* ───── Modals ───── */
  const [showSearch, setShowSearch] = useState(false);
  const [modal, setModal] = useState({
    type: null, path: '', name: '', file: null, isDir: false,
  });

  /* ───── Context menu ───── */
  const [ctxMenu, setCtxMenu] = useState({
    visible: false, x: 0, y: 0, type: null, node: null,
  });
  const menuRef = useRef();

  /* ──────────────────────────────────────────────────────────
     Bootstrapping: ping backend, project meta, file tree
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    axios.get(`${API_URL}/api/test`, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => setStatus('OK'))
      .catch(() => setStatus('Offline'));

    axios.get(`${API_URL}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setProjName(r.data.project.name))
      .catch(() => setProjName('Unknown'));

    axios.get(`${API_URL}/api/projects/${projectId}/tree`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setTreeItems((r.data.items || []).map(i => ({
          name: i.path.replace(`${projectId}/`, '').replace(/\/$/, '').split('/').pop(),
          path: i.path.replace(`${projectId}/`, '').replace(/\/$/, ''),
          isDir: i.isDir
        })));
      })
      .catch(() => setTreeItems([]));
  }, [projectId, token]);

  /* ──────────────────────────────────────────────────────────
     Helpers to refresh tree & files
     ────────────────────────────────────────────────────────── */
  const refreshTree = () =>
    axios.get(`${API_URL}/api/projects/${projectId}/tree`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setTreeItems((r.data.items || []).map(i => ({
          name: i.path.replace(`${projectId}/`, '').replace(/\/$/, '').split('/').pop(),
          path: i.path.replace(`${projectId}/`, '').replace(/\/$/, ''),
          isDir: i.isDir
        })));
      })
      .catch(() => {});

  const refreshFiles = () => {
    if (!selectedNode) { setFiles([]); return; }
    axios.get(`${API_URL}/api/projects/${projectId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
      params:  { path: selectedNode }
    })
      .then(r => setFiles(r.data.files || []))
      .catch(() => setFiles([]));
  };

  /* ──────────────────────────────────────────────────────────
     Load files whenever folder changes
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!selectedNode) { setFiles([]); return; }
    refreshFiles();
    // do not clear previewFile here; pendingPreview handles it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, projectId, token]);

  /* ──────────────────────────────────────────────────────────
     After files list loads, open any queued preview
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (pendingPreview) {
      setPreviewFile(pendingPreview);
      setPendingPreview(null);
    }
  }, [files, pendingPreview]);

  /* ──────────────────────────────────────────────────────────
     External “file-changed” listener (patch applies)
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = e => {
      const changed = e.detail;
      if (selectedNode && changed.startsWith(selectedNode + '/')) refreshFiles();
      if (previewFile === changed) {
        setPreviewFile(null);
        setTimeout(() => setPreviewFile(changed), 0);
      }
    };
    window.addEventListener('file-changed', handler);
    return () => window.removeEventListener('file-changed', handler);
  }, [selectedNode, previewFile]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ──────────────────────────────────────────────────────────
     Dismiss context menu on outside click
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onClick = e => {
      if (ctxMenu.visible && menuRef.current && !menuRef.current.contains(e.target)) {
        setCtxMenu(c => ({ ...c, visible: false }));
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [ctxMenu.visible]);

  /* ──────────────────────────────────────────────────────────
     CRUD actions (create folder/file, rename, delete)
     ────────────────────────────────────────────────────────── */
  const doCreateFolder = async () => {
    await axios.post(`${API_URL}/api/projects/${projectId}/folder`,
      { path: `${modal.path}/${modal.name}` },
      { headers: { Authorization: `Bearer ${token}` } });
    await refreshTree();
    setExpanded(exp => new Set(exp).add(modal.path));
    setModal({ type: null, path: '', name: '', file: null, isDir: false });
  };

  const doCreateFile = async () => {
    const form = new FormData();
    form.append('file', modal.file);
    form.append('path', modal.path);
    await axios.post(`${API_URL}/api/projects/${projectId}/upload`, form, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
    });
    await refreshFiles();
    setModal({ type: null, path: '', name: '', file: null, isDir: false });
  };

  const doRename = async () => {
    await axios.patch(`${API_URL}/api/projects/${projectId}/rename`, {
      oldPath: modal.path + (modal.isDir ? '/' : ''),
      newName: modal.name
    }, { headers: { Authorization: `Bearer ${token}` } });
    await refreshTree();
    if (selectedNode.startsWith(modal.path)) {
      setSelectedNode(modal.path.replace(/[^/]+$/, modal.name));
    }
    setModal({ type: null, path: '', name: '', file: null, isDir: false });
  };

  const doDelete = async () => {
    await axios.delete(`${API_URL}/api/projects/${projectId}/delete`, {
      headers: { Authorization: `Bearer ${token}` },
      data:   { path: modal.path + (modal.isDir ? '/' : '') }
    });
    await refreshTree();
    await refreshFiles();
    setModal({ type: null, path: '', name: '', file: null, isDir: false });
    if (modal.isDir && selectedNode.startsWith(modal.path)) setSelectedNode('');
  };

  /* ──────────────────────────────────────────────────────────
     Open a file (from search panel) after ensuring folder load
     ────────────────────────────────────────────────────────── */
  const openFileFromSearch = (filePath /* , chunkIdx */) => {
    const folder = filePath.includes('/')
      ? filePath.split('/').slice(0, -1).join('/')
      : '';
    setPendingPreview(filePath);
    setExpanded(exp => new Set(exp).add(folder));
    setSelectedNode(folder);
    setShowSearch(false);              // close modal
  };

  /* ──────────────────────────────────────────────────────────
     Auth guard
     ────────────────────────────────────────────────────────── */
  if (!token) return <Navigate to="/login" replace />;

  /* ──────────────────────────────────────────────────────────
     JSX
     ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-svh bg-background text-text-primary">
      {/* Explorer */}
      <ExplorerSidebar
        treeItems={treeItems}
        expanded={expanded}
        setExpanded={setExpanded}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        onContextMenu={(e, type, node) => {
          e.preventDefault();
          setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, type, node });
        }}
      />

      {/* Main panel */}
      <MainPanel
        projName={projName}
        status={status}
        selectedNode={selectedNode}
        files={files}
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        onContextMenu={(e, type, node) => {
          e.preventDefault();
          setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, type, node });
        }}
        onOpenSearch={() => setShowSearch(true)}
        projectId={projectId}
        token={token}
      />

      {/* Chat sidebar */}
      <ChatSidebar
        projectId={projectId}
        filePaths={treeItems.map(i => i.path)}
        activeFolder={selectedNode}
        activeFile={previewFile}
        token={token}
      />

      {/* Search modal */}
      {showSearch && (
        <SearchPanel
          projectId={projectId}
          token={token}
          onClose={() => setShowSearch(false)}
          onOpenFile={openFileFromSearch}
        />
      )}

      {/* Context Menu */}
      {ctxMenu.visible && (
        <ul
          ref={menuRef}
          className="absolute bg-surface border border-border shadow-lg z-50 text-sm"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {/* Folder options */}
          {ctxMenu.type === 'folder' && (
            <>
              <li className="px-4 py-2 hover:bg-white/10 cursor-pointer"
                  onClick={() => {
                    setModal({ type: 'createFolder', path: ctxMenu.node.path, name: '', file: null, isDir: true });
                    setCtxMenu(c => ({ ...c, visible: false }));
                  }}>
                Create New Folder
              </li>
              <li className="px-4 py-2 hover:bg-white/10 cursor-pointer"
                  onClick={() => {
                    setModal({ type: 'createFile', path: ctxMenu.node.path, name: '', file: null, isDir: false });
                    setCtxMenu(c => ({ ...c, visible: false }));
                  }}>
                Create New File
              </li>
              <li className="px-4 py-2 hover:bg-white/10 cursor-pointer"
                  onClick={() => {
                    setModal({ type: 'rename', path: ctxMenu.node.path, name: ctxMenu.node.name, file: null, isDir: true });
                    setCtxMenu(c => ({ ...c, visible: false }));
                  }}>
                Rename Folder
              </li>
              {!ROOT_PATHS.includes(ctxMenu.node.path) && (
                <li className="px-4 py-2 hover:bg-white/10 cursor-pointer text-error"
                    onClick={() => {
                      setModal({ type: 'delete', path: ctxMenu.node.path, name: ctxMenu.node.name, isDir: true });
                      setCtxMenu(c => ({ ...c, visible: false }));
                    }}>
                  Delete Folder
                </li>
              )}
            </>
          )}

          {/* File options */}
          {ctxMenu.type === 'file' && (
            <>
              <li className="px-4 py-2 hover:bg-white/10 cursor-pointer"
                  onClick={() => {
                    setModal({ type: 'rename', path: ctxMenu.node.path, name: ctxMenu.node.name, file: null, isDir: false });
                    setCtxMenu(c => ({ ...c, visible: false }));
                  }}>
                Rename File
              </li>
              <li className="px-4 py-2 hover:bg-white/10 cursor-pointer text-error"
                  onClick={() => {
                    setModal({ type: 'delete', path: ctxMenu.node.path, name: ctxMenu.node.name, isDir: false });
                    setCtxMenu(c => ({ ...c, visible: false }));
                  }}>
                Delete File
              </li>
            </>
          )}
        </ul>
      )}

      {/* Create/Rename/Delete modal */}
      {modal.type && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-surface p-6 rounded-lg w-80">
            <h2 className="text-lg font-semibold mb-4">
              {modal.type === 'createFolder' && 'New Folder'}
              {modal.type === 'createFile' && 'Upload File'}
              {modal.type === 'rename' && `Rename ${modal.isDir ? 'Folder' : 'File'}`}
              {modal.type === 'delete' && `Delete ${modal.isDir ? 'Folder' : 'File'}?`}
            </h2>

            {(modal.type === 'createFolder' || modal.type === 'rename') && (
              <form onSubmit={e => { e.preventDefault(); modal.type === 'createFolder' ? doCreateFolder() : doRename(); }}>
                <input type="text" value={modal.name}
                       onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                       className="input input-bordered w-full mb-4"
                       placeholder="Name" required />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setModal({ type: null })} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {modal.type === 'rename' ? 'Rename' : 'Create'}
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'createFile' && (
              <form onSubmit={e => { e.preventDefault(); doCreateFile(); }}>
                <input type="file"
                       onChange={e => setModal(m => ({ ...m, file: e.target.files[0] }))}
                       className="input input-bordered w-full mb-4" required />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setModal({ type: null })} className="btn btn-outline">Cancel</button>
                  <button type="submit" className="btn btn-primary">Upload</button>
                </div>
              </form>
            )}

            {modal.type === 'delete' && (
              <div>
                <p>Are you sure you want to delete this {modal.isDir ? 'folder and its contents' : 'file'}?</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setModal({ type: null })} className="btn btn-outline">Cancel</button>
                  <button onClick={doDelete} className="btn btn-error">Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
