'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

const palette = {
  bg: '#FFFFFF',
  bgRaised: '#FBF1FA',
  ink: '#4A2E7A',
  ink2: '#8B6FB8',
  ink3: '#B49ED6',
  border: '#B59BD8',
  borderSoft: '#ECE0F8',
  accent: '#FF5FB0',
  warn: '#9B5CFF',
};

export default function Lists({ lists, listItems, onCreateList, onDeleteList, onAddItem, onToggleItem, onEditItem, onDeleteItem }) {
  const [creatingList, setCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const submitNew = () => {
    if (newListTitle.trim()) {
      onCreateList(newListTitle.trim());
      setNewListTitle('');
      setCreatingList(false);
    }
  };

  return (
    <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${palette.borderSoft}` }}>
      <div className="flex items-center gap-3 mb-6">
        <h2 style={{
          fontFamily: 'VT323, monospace',
          fontWeight: 400,
          fontSize: '1.4rem',
          letterSpacing: '-0.01em',
          color: palette.ink,
        }}>My lists</h2>
        <span style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: '0.7rem',
          color: palette.ink3,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {lists.length}
        </span>
      </div>

      <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-4 md:pb-0">
        {lists.map(list => (
          <ListColumn
            key={list.id}
            list={list}
            items={(listItems[list.id] || [])}
            onDeleteList={onDeleteList}
            onAddItem={onAddItem}
            onToggleItem={onToggleItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
        ))}

        {/* New list creator */}
        <div className="flex flex-col p-3 rounded min-w-[260px] md:min-w-0 snap-start flex-shrink-0 md:flex-shrink" style={{ background: palette.bgRaised, border: `1px dashed ${palette.border}` }}>
          {creatingList ? (
            <div>
              <input
                autoFocus
                type="text"
                placeholder="List name"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNew();
                  if (e.key === 'Escape') { setCreatingList(false); setNewListTitle(''); }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.85rem',
                  background: 'white',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 6,
                  outline: 'none',
                }}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={submitNew} style={{
                  padding: '4px 12px',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.75rem',
                  background: palette.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                }}>Create</button>
                <button onClick={() => { setCreatingList(false); setNewListTitle(''); }} style={{
                  padding: '4px 12px',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.75rem',
                  background: 'transparent',
                  color: palette.ink3,
                  border: 'none',
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreatingList(true)} className="flex items-center gap-2 py-3" style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.85rem',
              color: palette.accent,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}>
              <Plus size={14} /> New list
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListColumn({ list, items, onDeleteList, onAddItem, onToggleItem, onEditItem, onDeleteItem }) {
  const [input, setInput] = useState('');
  const [hovered, setHovered] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onAddItem(list.id, input.trim());
      setInput('');
    }
  };

  return (
    <div
      className="flex flex-col px-3 py-3 rounded min-w-[260px] md:min-w-0 snap-start flex-shrink-0 md:flex-shrink"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontWeight: 700,
          fontSize: '1rem',
          color: palette.ink,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>{list.title}</h3>
        {hovered && (
          <button
            onClick={() => {
              if (confirm(`Delete list "${list.title}"? All items in it will be deleted.`)) {
                onDeleteList(list.id);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: palette.ink3,
              cursor: 'pointer',
              padding: 2,
              opacity: 0.6,
            }}
            title="Delete list"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {items.map(item => (
          <ListItem
            key={item.id}
            item={item}
            onToggle={() => onToggleItem(list.id, item.id)}
            onEdit={(text) => onEditItem(list.id, item.id, text)}
            onDelete={() => onDeleteItem(list.id, item.id)}
          />
        ))}
      </div>

      <form onSubmit={submit} className="mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="+ add item"
          style={{
            width: '100%',
            padding: '0.4rem 0',
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.85rem',
            color: palette.ink,
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid transparent`,
            outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderBottomColor = palette.borderSoft}
          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
        />
      </form>
    </div>
  );
}

function ListItem({ item, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.text);
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setValue(item.text); }, [item.text]);

  const saveEdit = () => {
    if (value.trim() && value !== item.text) onEdit(value.trim());
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-2 group py-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { setValue(item.text); setEditing(false); }
          }}
          style={{
            flex: 1,
            padding: '2px 4px',
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.9rem',
            color: palette.ink,
            background: 'transparent',
            border: `1px solid ${palette.border}`,
            borderRadius: 3,
            outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={onToggle}
          onDoubleClick={() => setEditing(true)}
          style={{
            flex: 1,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.9rem',
            color: item.completed ? palette.ink3 : palette.ink,
            textDecoration: item.completed ? 'line-through' : 'none',
            cursor: 'pointer',
            wordBreak: 'break-word',
          }}
        >
          {item.text}
        </span>
      )}
      {hovered && !editing && (
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            color: palette.ink3,
            cursor: 'pointer',
            padding: 0,
            opacity: 0.5,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
