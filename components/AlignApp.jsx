'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Check, X, Plus, ChevronLeft, ChevronRight, Sparkles, Brain,
  Play, Pause, Flame, Sunrise, Minimize2, CircleDot, MoreHorizontal,
  RotateCcw, Target, Command, LogOut, LayoutList, LayoutGrid, AlertCircle, Settings,
  CalendarDays, ListTodo,
} from 'lucide-react';
import { useStorage } from '@/lib/useStorage';
import SettingsDrawer from './SettingsDrawer';
import QuickCaptureDrawer from './QuickCaptureDrawer';
import Lists from './Lists';

// ============================================================
//  HELPERS
// ============================================================
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today0 = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const isToday = (d) => dateKey(d) === dateKey(today0());
const isPast = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x < today0(); };
const startOfWeek = (date) => {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};
const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long' });
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtFullDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// ============================================================
//  PALETTE
// ============================================================
const palette = {
  bg: '#FFFFFF',
  bgRaised: '#FAFAFA',
  ink: '#1B1813',
  ink2: '#5C5448',
  ink3: '#9A917F',
  border: '#EAEAEA',
  borderSoft: '#F2F2F2',
  accent: '#7CA481',
  accentSoft: 'rgba(124,164,129,0.10)',
  accentSofter: 'rgba(124,164,129,0.05)',
  warm: '#C9824A',
  errBg: '#FBE9E5',
  errInk: '#8C3A2A',
  // Event source colors — calendar events render as pills tinted by their source label.
  eventPersonalBg: '#FBE7EC',
  eventPersonalDot: '#C8717F',
  eventWorkBg: '#E5EDF4',
  eventWorkDot: '#6B7F8D',
};

// ============================================================
//  TASK MENU
// ============================================================
function TaskMenu({ task, lists, onDelete, onFocus, onClose, onMoveToTomorrow, onMoveToSomeday, onPickDate, onMoveToList }) {
  const ref = useRef(null);
  const [listsSubmenuOpen, setListsSubmenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState('');

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const submitPickedDate = () => {
    if (pickedDate) onPickDate(pickedDate);
  };

  return (
    <div ref={ref} className="absolute right-0 top-6 z-30 rounded-lg overflow-hidden"
      style={{ background: palette.bgRaised, border: `1px solid ${palette.border}`, boxShadow: '0 8px 24px rgba(27,24,19,0.08)', minWidth: 200 }}>
      {!listsSubmenuOpen && !datePickerOpen && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onFocus(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:bg-black/[0.03]"
            style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <Target size={12} /> Enter focus lane
          </button>
          <div className="h-px" style={{ background: palette.borderSoft }} />
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveToTomorrow(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-black/[0.03]"
            style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <ChevronRight size={12} /> Move to tomorrow
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveToSomeday(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-black/[0.03]"
            style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <Sunrise size={12} /> Move to someday
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDatePickerOpen(true); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-black/[0.03]"
            style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <CalendarDays size={12} /> Pick a date…
          </button>
          {lists && lists.length > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setListsSubmenuOpen(true); }} className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-black/[0.03]"
              style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
              <span className="flex items-center gap-2"><ListTodo size={12} /> Move to list…</span>
              <ChevronRight size={11} style={{ color: palette.ink3 }} />
            </button>
          )}
          <div className="h-px" style={{ background: palette.borderSoft }} />
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-black/[0.03]"
            style={{ color: '#a8493a', fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <X size={12} /> Delete
          </button>
        </>
      )}

      {listsSubmenuOpen && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); setListsSubmenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-black/[0.03]"
            style={{ color: palette.ink3, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
            <ChevronLeft size={11} /> Back
          </button>
          <div className="h-px" style={{ background: palette.borderSoft }} />
          {lists.map(l => (
            <button type="button" key={l.id} onClick={(e) => { e.stopPropagation(); onMoveToList(l.id); }} className="w-full text-left px-3 py-2 text-xs hover:bg-black/[0.03]"
              style={{ color: palette.ink, fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer' }}>
              {l.title}
            </button>
          ))}
        </>
      )}

      {datePickerOpen && (
        <div className="p-3">
          <button type="button" onClick={(e) => { e.stopPropagation(); setDatePickerOpen(false); }} className="text-xs flex items-center gap-1 mb-2 hover:opacity-70"
            style={{ color: palette.ink3, fontFamily: 'Inter Tight, sans-serif', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ChevronLeft size={11} /> Back
          </button>
          <input type="date" value={pickedDate} onChange={(e) => setPickedDate(e.target.value)} autoFocus
            className="w-full px-2 py-1.5 rounded text-xs outline-none"
            style={{ background: 'white', border: `1px solid ${palette.border}`, fontFamily: 'Inter Tight, sans-serif', color: palette.ink }} />
          <button type="button" onClick={(e) => { e.stopPropagation(); submitPickedDate(); }} disabled={!pickedDate} className="w-full mt-2 py-1.5 rounded text-xs disabled:opacity-40"
            style={{ background: palette.accent, color: 'white', fontFamily: 'Inter Tight, sans-serif', border: 'none', cursor: pickedDate ? 'pointer' : 'not-allowed' }}>
            Move
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  TASK ACTION MENU (mobile bottom sheet)
// ============================================================
function TaskActionMenu({ task, currentDate, lists, onClose, onMoveToTomorrow, onMoveToSomeday, onMoveToDate, onMoveToList, onComplete, onDelete }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(27,24,19,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-4 sm:p-6"
        style={{ background: 'white', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 pb-3" style={{ borderBottom: `1px solid ${palette.borderSoft}` }}>
          <p style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: palette.ink3,
            marginBottom: 6,
          }}>Task</p>
          <p style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.95rem',
            color: palette.ink,
            lineHeight: 1.3,
          }}>{task.text}</p>
        </div>

        {!pickerOpen && !listsOpen && (
          <div className="space-y-1">
            {!task.completed && (
              <button onClick={onComplete}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
                style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
                <Check size={16} style={{ color: palette.accent }} />
                Mark complete
              </button>
            )}
            <button onClick={onMoveToTomorrow}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
              <ChevronRight size={16} style={{ color: palette.ink2 }} />
              Move to tomorrow
            </button>
            <button onClick={onMoveToSomeday}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
              <Sunrise size={16} style={{ color: palette.ink2 }} />
              Move to someday
            </button>
            <button onClick={() => setPickerOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
              <CalendarDays size={16} style={{ color: palette.ink2 }} />
              Pick a date…
            </button>
            {lists && lists.length > 0 && (
              <button onClick={() => setListsOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
                style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
                <ListTodo size={16} style={{ color: palette.ink2 }} />
                Move to list…
              </button>
            )}
            <div className="h-px my-2" style={{ background: palette.borderSoft }} />
            <button onClick={onDelete}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: '#a8493a', textAlign: 'left' }}>
              <X size={16} />
              Delete task
            </button>
          </div>
        )}

        {pickerOpen && (
          <div>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} autoFocus
              className="w-full px-3 py-3 rounded-lg outline-none"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.95rem', background: palette.bgRaised, border: `1px solid ${palette.border}`, color: palette.ink }} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPickerOpen(false)} className="flex-1 py-3 rounded-lg"
                style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', background: 'transparent', color: palette.ink2, border: `1px solid ${palette.border}` }}>
                Back
              </button>
              <button disabled={!selectedDate || selectedDate === currentDate}
                onClick={() => onMoveToDate(selectedDate)}
                className="flex-1 py-3 rounded-lg disabled:opacity-40"
                style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', background: palette.accent, color: 'white', border: 'none' }}>
                Move
              </button>
            </div>
          </div>
        )}

        {listsOpen && (
          <div className="space-y-1">
            <button onClick={() => setListsOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/[0.03]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: palette.ink3, textAlign: 'left' }}>
              <ChevronLeft size={14} /> Back
            </button>
            <div className="h-px my-1" style={{ background: palette.borderSoft }} />
            {lists.map(l => (
              <button key={l.id} onClick={() => onMoveToList(l.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/[0.03]"
                style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, textAlign: 'left' }}>
                {l.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  TASK ROW
// ============================================================
function TaskRow({ task, dKey, lists, onToggle, onEdit, onDelete, onStart, onPause, onFocus, onOpenActionMenu, onMoveToTomorrow, onMoveToSomeday, onPickDate, onMoveToList, highlighted, dragHandlers }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.text);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const swipeStart = useRef(null);
  const inMotion = task.started && !task.completed;

  const saveEdit = () => {
    if (value.trim() && value !== task.text) onEdit(task.id, value.trim());
    if (!value.trim()) setValue(task.text);
    setEditing(false);
  };

  const handleBodyClick = () => {
    if (task.completed) return;
    if (swipeX !== 0 || showDeleteConfirm) {
      // Reset swipe state first; don't trigger edit
      setSwipeX(0);
      setShowDeleteConfirm(false);
      return;
    }
    setEditing(true);
  };

  // Touch swipe handlers (mobile only)
  const onTouchStart = (e) => {
    if (editing || task.completed) return;
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e) => {
    if (!swipeStart.current || editing) return;
    const dx = e.touches[0].clientX - swipeStart.current.x;
    const dy = e.touches[0].clientY - swipeStart.current.y;
    // Only horizontal swipes (ignore vertical scrolling)
    if (Math.abs(dx) < Math.abs(dy)) return;
    e.preventDefault();
    setSwipeX(Math.max(-120, Math.min(120, dx)));
  };
  const onTouchEnd = () => {
    if (swipeX > 80) {
      // Swipe right — reveal action menu
      setSwipeX(0);
      onOpenActionMenu && onOpenActionMenu(task, dKey);
    } else if (swipeX < -60) {
      // Swipe left — reveal delete confirm
      setSwipeX(-80);
      setShowDeleteConfirm(true);
    } else {
      setSwipeX(0);
      setShowDeleteConfirm(false);
    }
    swipeStart.current = null;
  };

  return (
    <div
      className="group relative flex items-start gap-2 py-1"
      draggable={!editing}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
      {...dragHandlers}
    >
      {/* Swipe-left red delete background */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-y-0 right-0 flex items-center pr-3"
          style={{ width: 80 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); setShowDeleteConfirm(false); setSwipeX(0); }}
            className="px-3 py-1.5 rounded-md text-xs flex items-center gap-1"
            style={{ background: '#C9824A', color: 'white', fontFamily: 'Inter Tight, sans-serif', fontWeight: 500, border: 'none' }}
          >
            <X size={12} /> Delete
          </button>
        </div>
      )}

      <div
        className="flex items-start gap-2 flex-1"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeStart.current ? 'none' : 'transform 0.25s ease',
          background: showDeleteConfirm ? 'white' : 'transparent',
        }}
      >
        <button onClick={() => onToggle(task.id)}
          className="mt-[3px] flex-shrink-0 flex items-center justify-center transition-all relative"
          style={{
            width: 16, height: 16,
            border: `1.5px solid ${task.completed ? palette.accent : palette.ink3}`,
            background: task.completed ? palette.accent : 'transparent',
            borderRadius: 4,
          }} aria-label="toggle">
          {task.completed && <Check size={10} color="white" strokeWidth={3.5} />}
          {inMotion && <span className="absolute -inset-1 rounded animate-pulse-soft" style={{ border: `1px solid ${palette.accent}`, opacity: 0.4 }} />}
        </button>
        {editing ? (
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setValue(task.text); setEditing(false); } }}
            className="flex-1 bg-transparent outline-none text-[14px] leading-snug"
            style={{ fontFamily: 'Inter Tight, sans-serif', color: palette.ink }} />
        ) : (
          <div onClick={handleBodyClick}
            className="flex-1 text-[14px] leading-snug cursor-text break-words select-none"
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              color: task.completed ? palette.ink3 : palette.ink,
              textDecoration: task.completed ? 'line-through' : 'none',
              textDecorationThickness: '1.5px',
              textDecorationColor: palette.accent,
              letterSpacing: '-0.005em',
              background: highlighted ? palette.accentSoft : 'transparent',
              margin: highlighted ? '-2px -4px' : 0,
              padding: highlighted ? '2px 4px' : 0,
              borderRadius: 3,
            }}>{task.text}</div>
        )}
        <div className="flex items-center gap-1 flex-shrink-0 mt-[3px]">
          {!task.completed && (inMotion ? (
            <button onClick={(e) => { e.stopPropagation(); onPause(task.id); }}
              className="opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: palette.accent }} title="Pause"><Pause size={12} /></button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onStart(task.id); }}
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              style={{ color: palette.ink2 }} title="Start"><Play size={11} /></button>
          ))}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
              style={{ color: palette.ink2 }}><MoreHorizontal size={13} /></button>
            {menuOpen && (
              <TaskMenu
                task={task}
                lists={lists}
                onDelete={() => { onDelete(task.id); setMenuOpen(false); }}
                onFocus={() => { onFocus(task); setMenuOpen(false); }}
                onMoveToTomorrow={() => { onMoveToTomorrow && onMoveToTomorrow(task, dKey); setMenuOpen(false); }}
                onMoveToSomeday={() => { onMoveToSomeday && onMoveToSomeday(task, dKey); setMenuOpen(false); }}
                onPickDate={(d) => { onPickDate && onPickDate(task, dKey, d); setMenuOpen(false); }}
                onMoveToList={(listId) => { onMoveToList && onMoveToList(task, dKey, listId); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  DAY COLUMN
// ============================================================
function DayColumn({ date, tasks, events, onAdd, onToggle, onEdit, onDelete, onStart, onPause, onFocus,
  dragState, onDragOver, onDrop, onDragTaskStart, onDragTaskEnd, topThreeIds, inList, onOpenActionMenu,
  lists, onMoveToTomorrow, onMoveToSomeday, onPickDate, onMoveToList, hideDateHeader }) {
  const [input, setInput] = useState('');
  const today = isToday(date);
  const past = isPast(date);
  const submit = (e) => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(''); } };
  const dropping = dragState?.overDate === dateKey(date);

  const containerClass = inList
    ? 'flex flex-col px-2 py-1 rounded-md transition-colors w-full'
    : 'flex flex-col min-h-[280px] px-2 py-1 rounded-md transition-colors snap-start';

  return (
    <div data-date={dateKey(date)} className={containerClass}
      style={{ background: dropping ? palette.accentSoft : 'transparent', opacity: past && !today ? 0.65 : 1 }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(dateKey(date)); }}
      onDrop={(e) => { e.preventDefault(); onDrop(dateKey(date)); }}>
      {!hideDateHeader && (
        <div className="mb-3 pb-2" style={{ borderBottom: `1px solid ${today ? palette.accent : palette.border}` }}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 style={{
              fontFamily: 'Fraunces, serif', fontSize: '1.55rem',
              fontWeight: today ? 500 : 400,
              fontVariationSettings: today ? "'SOFT' 100, 'opsz' 144" : "'SOFT' 50, 'opsz' 144",
              color: today ? palette.accent : palette.ink,
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>{fmtDay(date)}</h2>
            <span style={{
              fontFamily: 'Inter Tight, sans-serif', fontSize: '0.65rem', fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: today ? palette.accent : palette.ink3,
            }}>{fmtDate(date)}</span>
          </div>
        </div>
      )}
      <div className="flex-1 space-y-0.5 pl-2">
        {events && events.length > 0 && (
          <div className="mb-2 space-y-1">
            {events.map((ev) => {
              const isWork = ev.source === 'Work';
              const isPersonal = ev.source === 'Personal';
              const pillBg = isWork ? palette.eventWorkBg : isPersonal ? palette.eventPersonalBg : palette.accentSofter;
              const dotBg = isWork ? palette.eventWorkDot : isPersonal ? palette.eventPersonalDot : palette.accent;
              return (
                <a
                  key={`${ev.sourceEmail}-${ev.id}`}
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 px-2 py-1 rounded transition-opacity hover:opacity-100"
                  style={{ opacity: 0.92, background: pillBg }}
                  title={ev.location ? `${ev.title} — ${ev.location}` : ev.title}
                >
                  <span
                    className="mt-[5px] flex-shrink-0 rounded-sm"
                    style={{
                      width: 6,
                      height: 6,
                      background: dotBg,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div style={{
                      fontFamily: 'Inter Tight, sans-serif',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: palette.ink,
                      letterSpacing: '-0.005em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {ev.title}
                    </div>
                    <div style={{
                      fontFamily: 'Inter Tight, sans-serif',
                      fontSize: '10px',
                      color: palette.ink3,
                      letterSpacing: '0.02em',
                    }}>
                      {ev.allDay ? 'all day' : new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                    </div>
                  </div>
                </a>
              );
            })}
            {tasks.length > 0 && <div className="h-px my-2" style={{ background: palette.borderSoft }} />}
          </div>
        )}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} dKey={dateKey(date)} lists={lists}
            onToggle={() => onToggle(dateKey(date), task.id)}
            onEdit={(id, text) => onEdit(dateKey(date), id, text)}
            onDelete={() => onDelete(dateKey(date), task.id)}
            onStart={() => onStart(dateKey(date), task.id)}
            onPause={() => onPause(dateKey(date), task.id)}
            onFocus={(t) => onFocus(dateKey(date), t)}
            onOpenActionMenu={onOpenActionMenu}
            onMoveToTomorrow={onMoveToTomorrow}
            onMoveToSomeday={onMoveToSomeday}
            onPickDate={onPickDate}
            onMoveToList={onMoveToList}
            highlighted={today && topThreeIds.includes(task.id)}
            dragHandlers={{
              onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; onDragTaskStart(dateKey(date), task.id); },
              onDragEnd: onDragTaskEnd,
            }} />
        ))}
        <form onSubmit={submit} className="pt-1">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="+ add"
            className="w-full bg-transparent outline-none text-[13px] py-1"
            style={{ fontFamily: 'Inter Tight, sans-serif', color: palette.ink, letterSpacing: '-0.005em' }} />
        </form>
      </div>
    </div>
  );
}

// ============================================================
//  FOCUS STRIP
// ============================================================
function FocusStrip({ todayTasks, stats, suggestions, onSelectFocus, currentFocus }) {
  const top3 = useMemo(() => {
    const incomplete = todayTasks.filter(t => !t.completed);
    const inMotion = incomplete.filter(t => t.started);
    const rest = incomplete.filter(t => !t.started);
    return [...inMotion, ...rest].slice(0, 3);
  }, [todayTasks]);
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const pct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <div className="sticky top-0 z-20 backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.85)', borderBottom: `1px solid ${palette.borderSoft}` }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-2 md:py-3">
        {/* MOBILE: single compact row with progress · streak */}
        <div className="flex md:hidden items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Target size={11} style={{ color: palette.accent }} className="flex-shrink-0" />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink2, fontWeight: 500 }}>
              {completedToday}<span style={{ color: palette.ink3 }}>/{totalToday || '—'}</span>
            </span>
            <div className="w-12 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: palette.borderSoft }}>
              <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: palette.accent }} />
            </div>
            <span className="ml-1 flex items-center gap-1 flex-shrink-0" style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink2, fontWeight: 500 }}>
              <Flame size={11} style={{ color: stats.streak > 0 ? palette.warm : palette.ink3 }} />
              {stats.streak}
            </span>
          </div>
        </div>

        {/* DESKTOP: full original layout */}
        <div className="hidden md:flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Target size={11} style={{ color: palette.accent }} />
              <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2 }}>Today's Three</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {top3.length === 0 ? (
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', color: palette.ink3, fontStyle: 'italic' }}>Nothing pinned for today.</span>
              ) : (top3.map((t, i) => (
                <button key={t.id} onClick={() => onSelectFocus(t)}
                  className="flex items-center gap-1.5 text-left transition-opacity hover:opacity-100"
                  style={{ opacity: currentFocus?.id === t.id ? 1 : 0.85 }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '0.85rem', color: palette.ink3, fontWeight: 400 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.text}</span>
                  {t.started && <CircleDot size={10} style={{ color: palette.accent }} />}
                </button>
              )))}
            </div>
          </div>
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="flex flex-col items-end">
              <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2 }}>Progress</span>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: palette.ink, fontVariationSettings: "'opsz' 144" }}>
                  {completedToday}<span style={{ color: palette.ink3, fontSize: '0.85rem' }}> / {totalToday || '—'}</span>
                </span>
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: palette.borderSoft }}>
                  <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: palette.accent }} />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2 }}>Streak</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Flame size={13} style={{ color: stats.streak > 0 ? palette.warm : palette.ink3 }} />
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: palette.ink }}>{stats.streak}</span>
              </div>
            </div>
          </div>
        </div>
        {suggestions && suggestions.length > 0 && (
          <div className="hidden md:flex mt-2 pt-2 items-center gap-2" style={{ borderTop: `1px dashed ${palette.borderSoft}` }}>
            <Sparkles size={10} style={{ color: palette.accent }} />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.72rem', color: palette.ink2, fontStyle: 'italic' }}>{suggestions[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  BRAIN DUMP
// ============================================================
function BrainDump({ open, onClose, items, onAdd, onDelete, onPromote }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  const submit = (e) => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(''); } };
  return (
    <>
      <div className="fixed inset-0 z-30 transition-opacity"
        style={{ background: 'rgba(27,24,19,0.15)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-40 flex flex-col transition-transform"
        style={{ width: 380, maxWidth: '90vw', background: palette.bgRaised, borderLeft: `1px solid ${palette.border}`,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transitionDuration: '420ms', transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${palette.borderSoft}` }}>
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: palette.ink, fontVariationSettings: "'opsz' 144", letterSpacing: '-0.02em' }}>Brain dump</h2>
            <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: palette.ink3, marginTop: 2 }}>Empty your head. Sort later.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/[0.04] rounded" style={{ color: palette.ink2 }}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: palette.bg, border: `1px solid ${palette.borderSoft}` }}>
            <Plus size={13} style={{ color: palette.ink3 }} />
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="capture anything..."
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ fontFamily: 'Inter Tight, sans-serif', color: palette.ink }} />
          </div>
          <div className="mt-2 flex items-center gap-2" style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink3 }}>
            <kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${palette.border}`, background: palette.bg }}>↵</kbd>
            <span>to save</span><span className="mx-1">·</span>
            <kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${palette.border}`, background: palette.bg }}>B</kbd>
            <span>toggle</span>
          </div>
        </form>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {items.length === 0 ? (
            <div className="pt-12 text-center">
              <Brain size={28} style={{ color: palette.ink3, opacity: 0.4 }} className="mx-auto mb-3" />
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', color: palette.ink3, fontStyle: 'italic' }}>Nothing here yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(item => (
                <li key={item.id} className="group flex items-start gap-2 py-1">
                  <span className="mt-2 w-1 h-1 rounded-full flex-shrink-0" style={{ background: palette.ink3 }} />
                  <div className="flex-1 text-[14px] leading-snug" style={{ fontFamily: 'Inter Tight, sans-serif', color: palette.ink }}>{item.text}</div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onPromote(item.id)} className="text-[10px] px-2 py-0.5 rounded transition-colors"
                      style={{ color: palette.accent, fontFamily: 'Inter Tight, sans-serif', border: `1px solid ${palette.accent}`, fontWeight: 500 }} title="Move to today">→ today</button>
                    <button onClick={() => onDelete(item.id)} style={{ color: palette.ink3 }}><X size={12} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
//  FOCUS LANE
// ============================================================
function FocusLane({ open, task, onClose, onComplete, onUpdateNotes }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState(task?.notes || '');
  const [showRecover, setShowRecover] = useState(false);
  const lastActivity = useRef(Date.now());
  const saveDebounced = useRef(null);
  useEffect(() => {
    if (open && task) { setSeconds(0); setRunning(true); setNotes(task.notes || ''); lastActivity.current = Date.now(); }
    if (!open) setRunning(false);
  }, [open, task?.id]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!open || !running) { setShowRecover(false); return; }
    const id = setInterval(() => { if (Date.now() - lastActivity.current > 90_000) setShowRecover(true); }, 5000);
    const reset = () => { lastActivity.current = Date.now(); setShowRecover(false); };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => { clearInterval(id); window.removeEventListener('mousemove', reset); window.removeEventListener('keydown', reset); };
  }, [open, running]);
  const handleNotesChange = (val) => {
    setNotes(val);
    clearTimeout(saveDebounced.current);
    saveDebounced.current = setTimeout(() => onUpdateNotes(val), 500);
  };
  if (!open || !task) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: palette.bg }}>
      <div className="flex items-center justify-between px-4 md:px-8 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Target size={14} style={{ color: palette.accent }} />
          <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: palette.ink2 }}>Focus lane</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 rounded transition-colors hover:bg-black/[0.04]"
          style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: palette.ink2 }}>
          <Minimize2 size={13} /> Exit
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 max-w-[680px] mx-auto w-full">
        <h1 style={{
          fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.75rem, 4vw, 3.25rem)',
          fontWeight: 400, lineHeight: 1.15, color: palette.ink,
          letterSpacing: '-0.025em', textAlign: 'center',
          fontVariationSettings: "'SOFT' 100, 'opsz' 144",
        }}>{task.text}</h1>
        <div className="mt-12 flex items-center gap-4">
          <button onClick={() => setRunning(r => !r)} className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ background: running ? palette.accent : 'transparent', border: `1.5px solid ${palette.accent}`, color: running ? 'white' : palette.accent }}>
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: '2.5rem', color: palette.ink, fontVariationSettings: "'opsz' 144", letterSpacing: '-0.02em', minWidth: 120 }}>{fmtTime(seconds)}</div>
          <button onClick={() => { setSeconds(0); setRunning(false); }} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: palette.ink2 }} title="Reset"><RotateCcw size={16} /></button>
        </div>
        <div className="mt-12 w-full">
          <label style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2 }}>Working notes</label>
          <textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)} placeholder="Thinking out loud..." rows={6}
            className="mt-2 w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none"
            style={{ fontFamily: 'Inter Tight, sans-serif', color: palette.ink, borderBottom: `1px solid ${palette.borderSoft}`, paddingBottom: 12 }} />
        </div>
        <div className="mt-10 flex items-center gap-3 flex-wrap justify-center">
          <button onClick={() => { onComplete(task.id); onClose(); }} className="px-5 py-2.5 rounded-full transition-all"
            style={{ background: palette.accent, color: 'white', fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em' }}>
            <span className="flex items-center gap-2"><Check size={14} /> Mark done</span>
          </button>
          <button onClick={onClose} className="px-5 py-2.5 transition-opacity"
            style={{ color: palette.ink2, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem' }}>Save & return</button>
        </div>
      </div>
      {showRecover && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl flex items-center gap-3"
          style={{ background: palette.bgRaised, border: `1px solid ${palette.border}`, boxShadow: '0 8px 28px rgba(27,24,19,0.10)', animation: 'fadein 0.5s ease' }}>
          <Sunrise size={15} style={{ color: palette.accent }} />
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', color: palette.ink, fontStyle: 'italic' }}>You were making progress here.</span>
          <button onClick={() => { lastActivity.current = Date.now(); setShowRecover(false); }} className="px-3 py-1 rounded-full transition-colors"
            style={{ background: palette.accentSoft, color: palette.accent, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', fontWeight: 500 }}>Still here →</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  DAILY CLOSURE
// ============================================================
function DailyClosure({ open, onClose, todayTasks, stats }) {
  if (!open) return null;
  const completed = todayTasks.filter(t => t.completed);
  const inMotion = todayTasks.filter(t => !t.completed && t.started);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" style={{ background: 'rgba(255,255,255,0.96)' }}>
      <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded hover:bg-black/[0.04]" style={{ color: palette.ink2 }}><X size={18} /></button>
      <div className="max-w-[560px] w-full">
        <div className="text-center">
          <Sunrise size={28} style={{ color: palette.accent }} className="mx-auto mb-4" />
          <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: palette.ink2 }}>End of day</p>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 400, color: palette.ink, marginTop: 12, lineHeight: 1.15,
            letterSpacing: '-0.025em', fontVariationSettings: "'SOFT' 100, 'opsz' 144",
          }}>
            {completed.length > 0 ? `You moved ${completed.length} thing${completed.length === 1 ? '' : 's'} forward today.` : 'A quieter day. That counts too.'}
          </h1>
        </div>
        <div className="mt-12 space-y-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '2.25rem', color: palette.ink, fontVariationSettings: "'opsz' 144" }}>{completed.length}</div>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2, marginTop: 4 }}>Completed</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '2.25rem', color: palette.warm, fontVariationSettings: "'opsz' 144" }}>{stats.streak}</div>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2, marginTop: 4 }}>Day streak</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '2.25rem', color: palette.ink, fontVariationSettings: "'opsz' 144" }}>{inMotion.length}</div>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2, marginTop: 4 }}>In motion</div>
            </div>
          </div>
          {completed.length > 0 && (
            <div>
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: palette.ink2, marginBottom: 10 }}>Today's wins</p>
              <ul className="space-y-2">
                {completed.slice(0, 8).map(t => (
                  <li key={t.id} className="flex items-start gap-3">
                    <Check size={14} style={{ color: palette.accent, marginTop: 3 }} />
                    <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.95rem', color: palette.ink }}>{t.text}</span>
                  </li>
                ))}
                {completed.length > 8 && <li style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink3, fontStyle: 'italic', paddingLeft: 26 }}>+ {completed.length - 8} more</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-14 text-center">
          <button onClick={onClose} className="px-6 py-3 rounded-full transition-all"
            style={{ background: palette.accent, color: 'white', fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em' }}>Close the day</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  ERROR BANNER
// ============================================================
function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-lg"
      style={{ background: palette.errBg, border: `1px solid ${palette.errInk}30`, maxWidth: '90vw', animation: 'fadein 0.3s ease' }}>
      <AlertCircle size={14} style={{ color: palette.errInk, flexShrink: 0 }} />
      <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: palette.errInk }}>
        <strong>{error.label}:</strong> {error.message}
      </span>
    </div>
  );
}

// ============================================================
//  MAIN APP
// ============================================================
export default function AlignApp() {
  const s = useStorage();
  const [weekStart, setWeekStart] = useState(startOfWeek(today0()));
  const [brainOpen, setBrainOpen] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [events, setEvents] = useState([]);
  const [actionMenuTask, setActionMenuTask] = useState(null); // { task, dKey }
  const [mobileTab, setMobileTab] = useState('week'); // 'week' | 'lists'
  const weekGridRef = useRef(null);

  // Helper: move a task N days from today
  const moveTaskToOffset = (fromDate, taskId, daysFromToday) => {
    const t = new Date(today0());
    t.setDate(t.getDate() + daysFromToday);
    const toKey = dateKey(t);
    s.moveTaskBetweenDays(fromDate, toKey, taskId);
  };

  // Helper: move task to Someday (date = null)
  const moveTaskToSomeday = (fromDate, taskId) => {
    s.moveTaskBetweenDays(fromDate, 'someday', taskId);
  };

  // Set default viewMode based on screen size on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('list');
    }
  }, []);

  const onDragTaskStart = (fromDate, taskId) => setDragState({ fromDate, taskId, overDate: null });
  const onDragTaskEnd = () => setDragState(null);
  const onDragOverDay = (overDate) => setDragState(st => st ? { ...st, overDate } : null);
  const onDropDay = (toDate) => {
    if (!dragState) return;
    s.moveTaskBetweenDays(dragState.fromDate, toDate, dragState.taskId);
    setDragState(null);
  };

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  }), [weekStart]);

  // Leftover: incomplete tasks dated before today. Grouped by original date,
  // most recent first. Derived from s.tasks — no separate storage.
  const leftoverGroups = useMemo(() => {
    const tKey = dateKey(today0());
    return Object.keys(s.tasks)
      .filter(k => k !== 'someday' && k < tKey)
      .sort()
      .reverse()
      .map(k => ({ dKey: k, tasks: (s.tasks[k] || []).filter(t => !t.completed) }))
      .filter(g => g.tasks.length > 0);
  }, [s.tasks]);
  const leftoverCount = leftoverGroups.reduce((n, g) => n + g.tasks.length, 0);

  // Fetch calendar events for current week, refetch every 60 seconds while open
  useEffect(() => {
    if (!s.user) return;
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        const start = dateKey(days[0]);
        const end = dateKey(days[6]);
        const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.events) setEvents(data.events);
      } catch (e) {
        console.error('[Align] Events fetch error:', e);
      }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [s.user, weekStart, days]);

  // Group events by date for fast lookup
  const eventsByDate = useMemo(() => {
    const out = {};
    for (const ev of events) {
      let k;
      // All-day events come as 'YYYY-MM-DD' strings — use directly to avoid timezone shift
      if (ev.allDay && typeof ev.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ev.start)) {
        k = ev.start;
      } else {
        const d = new Date(ev.start);
        k = dateKey(d);
      }
      if (!out[k]) out[k] = [];
      out[k].push(ev);
    }
    // Sort each day's events: all-day first, then by start time
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.start) - new Date(b.start);
      });
    }
    return out;
  }, [events]);

  const todayKey = dateKey(today0());
  const todayTasks = s.tasks[todayKey] || [];

  const suggestions = useMemo(() => {
    const out = [];
    const staleCount = Object.entries(s.tasks).reduce((acc, [k, list]) => {
      const d = new Date(k);
      if (isPast(d) && list.some(t => !t.completed)) return acc + list.filter(t => !t.completed).length;
      return acc;
    }, 0);
    if (staleCount > 0) out.push(`${staleCount} task${staleCount === 1 ? '' : 's'} from earlier in the week haven't moved. Worth a glance?`);
    const motionCount = todayTasks.filter(t => t.started && !t.completed).length;
    if (motionCount > 0 && out.length === 0) out.push(`${motionCount} task${motionCount === 1 ? '' : 's'} already in motion. Keep the momentum.`);
    const todayCount = todayTasks.filter(t => !t.completed).length;
    if (todayCount === 0 && out.length === 0 && Object.keys(s.tasks).length > 0) {
      out.push(`Nothing pending today. A good day to rest, or to pull something forward.`);
    }
    return out;
  }, [s.tasks, todayTasks]);

  const topThreeIds = useMemo(() => {
    const incomplete = todayTasks.filter(t => !t.completed);
    const inMotion = incomplete.filter(t => t.started);
    const rest = incomplete.filter(t => !t.started);
    return [...inMotion, ...rest].slice(0, 3).map(t => t.id);
  }, [todayTasks]);

  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';
      if (e.key === 'b' && !isTyping) { e.preventDefault(); setBrainOpen(v => !v); }
      // Cmd/Ctrl + K opens quick capture from anywhere
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickOpen(v => !v);
      }
      if (e.key === 'Escape') { setBrainOpen(false); setFocusTask(null); setClosureOpen(false); setSettingsOpen(false); setQuickOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-open settings drawer if Google OAuth just redirected us back
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('google_connected') || params.has('google_error')) {
      setSettingsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!s.loaded || !weekGridRef.current) return;
    const todayCol = weekGridRef.current.querySelector(`[data-date="${todayKey}"]`);
    if (!todayCol) return;
    setTimeout(() => {
      if (viewMode === 'grid' && window.innerWidth < 768) {
        todayCol.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
      } else if (viewMode === 'list') {
        todayCol.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 100);
  }, [s.loaded, todayKey, viewMode]);

  if (!s.loaded) {
    return (
      <div style={{ minHeight: '100vh', background: palette.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', color: palette.ink3, fontStyle: 'italic' }}>Aligning…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..600,30..100&family=Inter+Tight:wght@400;500;600;700&display=swap');
        @keyframes pulse-soft { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        .animate-pulse-soft { animation: pulse-soft 2.4s ease-in-out infinite; }
        @keyframes fadein { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        input::placeholder, textarea::placeholder { color: ${palette.ink3}; opacity: 0.6; font-style: italic; }
        ::selection { background: ${palette.accentSoft}; }
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .align-week-scroll::-webkit-scrollbar { display: none; }
        .align-week-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <ErrorBanner error={s.error} />

      <FocusStrip todayTasks={todayTasks} stats={s.stats} suggestions={suggestions}
        onSelectFocus={(t) => setFocusTask({ dKey: todayKey, task: t })}
        currentFocus={focusTask?.task} />

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-20">
        <header className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-3 md:gap-4">
          <div className="flex items-baseline gap-4">
            <h1 style={{
              fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.85rem, 5vw, 2.5rem)',
              fontWeight: 400, color: palette.ink, letterSpacing: '-0.035em', lineHeight: 1,
              fontVariationSettings: "'SOFT' 100, 'opsz' 144",
            }}>align</h1>
            <span className="hidden sm:inline" style={{
              fontFamily: 'Inter Tight, sans-serif', fontSize: '0.72rem', fontWeight: 500,
              letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.ink3,
            }}>{fmtFullDate(today0())}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-full transition-colors hover:bg-black/[0.04]"
              style={{ color: palette.ink2, border: `1px solid ${palette.border}` }}
              title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}>
              {viewMode === 'grid' ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
            </button>
            <button onClick={() => setBrainOpen(true)} className="p-2 rounded-full transition-colors hover:bg-black/[0.04]"
              style={{ color: palette.ink2, border: `1px solid ${palette.border}` }} title="Brain dump (B)"><Brain size={14} /></button>
            <button onClick={() => setClosureOpen(true)} className="p-2 rounded-full transition-colors hover:bg-black/[0.04]"
              style={{ color: palette.ink2, border: `1px solid ${palette.border}` }} title="End of day"><Sunrise size={14} /></button>
            <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-full transition-colors hover:bg-black/[0.04]"
              style={{ color: palette.ink2, border: `1px solid ${palette.border}` }} title="Settings"><Settings size={14} /></button>
            <button onClick={s.signOut} className="p-2 rounded-full transition-colors hover:bg-black/[0.04]"
              style={{ color: palette.ink2, border: `1px solid ${palette.border}` }} title="Sign out"><LogOut size={14} /></button>
          </div>
        </header>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
              className="p-1.5 rounded transition-colors hover:bg-black/[0.04]" style={{ color: palette.ink2 }}><ChevronLeft size={16} /></button>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: palette.ink2, fontVariationSettings: "'opsz' 144" }}>
              {weekStart.toLocaleDateString('en-US', { month: 'long' })} {weekStart.getDate()} – {days[6].toLocaleDateString('en-US', { month: 'short' })} {days[6].getDate()}
            </span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
              className="p-1.5 rounded transition-colors hover:bg-black/[0.04]" style={{ color: palette.ink2 }}><ChevronRight size={16} /></button>
            <button onClick={() => setWeekStart(startOfWeek(today0()))} className="px-3 py-1 rounded transition-colors hover:bg-black/[0.04]"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: palette.ink2, fontWeight: 500 }}>This week</button>
          </div>
          <div className="hidden md:flex items-center gap-2" style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink3 }}>
            <Command size={11} /> ⌘K capture · B brain · Esc close
          </div>
        </div>

        {/* Mobile tab toggle: Week / Lists */}
        <div className="md:hidden mb-4 flex items-center gap-1 p-1 rounded-lg" style={{ background: palette.bgRaised, border: `1px solid ${palette.border}`, width: 'fit-content' }}>
          <button onClick={() => setMobileTab('week')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mobileTab === 'week' ? 'white' : 'transparent',
              boxShadow: mobileTab === 'week' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: mobileTab === 'week' ? palette.ink : palette.ink2,
            }}>
            <CalendarDays size={12} /> Week
          </button>
          <button onClick={() => setMobileTab('lists')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mobileTab === 'lists' ? 'white' : 'transparent',
              boxShadow: mobileTab === 'lists' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: mobileTab === 'lists' ? palette.ink : palette.ink2,
            }}>
            <ListTodo size={12} /> Lists
          </button>
        </div>

        {/* Week container: hide on mobile when Lists tab is active */}
        <div className={mobileTab === 'lists' ? 'hidden md:block' : ''}>
        {viewMode === 'list' ? (
          <div ref={weekGridRef} className="flex flex-col gap-8">
            {days.map(d => (
              <DayColumn key={dateKey(d)} date={d} tasks={s.tasks[dateKey(d)] || []}
                events={eventsByDate[dateKey(d)] || []}
                onAdd={(text) => s.addTask(dateKey(d), text)}
                onToggle={s.toggleTask} onEdit={s.editTask} onDelete={s.deleteTask}
                onStart={s.startTask} onPause={s.pauseTask}
                onFocus={(dKey, task) => setFocusTask({ dKey, task })}
                onOpenActionMenu={(task, dKey) => setActionMenuTask({ task, dKey })}
                lists={s.lists}
                onMoveToTomorrow={(task, dKey) => moveTaskToOffset(dKey, task.id, 1)}
                onMoveToSomeday={(task, dKey) => moveTaskToSomeday(dKey, task.id)}
                onPickDate={(task, dKey, toDate) => s.moveTaskBetweenDays(dKey, toDate, task.id)}
                onMoveToList={(task, dKey, listId) => s.moveTaskToList(dKey, task.id, listId)}
                dragState={dragState} onDragOver={onDragOverDay} onDrop={onDropDay}
                onDragTaskStart={onDragTaskStart} onDragTaskEnd={onDragTaskEnd}
                topThreeIds={dateKey(d) === todayKey ? topThreeIds : []}
                inList={true} />
            ))}
          </div>
        ) : (
          <div ref={weekGridRef}
            className="grid grid-flow-col gap-x-4 gap-y-8 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-4 align-week-scroll"
            style={{ gridAutoColumns: 'minmax(200px, 1fr)' }}>
            {days.map(d => (
              <DayColumn key={dateKey(d)} date={d} tasks={s.tasks[dateKey(d)] || []}
                events={eventsByDate[dateKey(d)] || []}
                onAdd={(text) => s.addTask(dateKey(d), text)}
                onToggle={s.toggleTask} onEdit={s.editTask} onDelete={s.deleteTask}
                onStart={s.startTask} onPause={s.pauseTask}
                onFocus={(dKey, task) => setFocusTask({ dKey, task })}
                onOpenActionMenu={(task, dKey) => setActionMenuTask({ task, dKey })}
                lists={s.lists}
                onMoveToTomorrow={(task, dKey) => moveTaskToOffset(dKey, task.id, 1)}
                onMoveToSomeday={(task, dKey) => moveTaskToSomeday(dKey, task.id)}
                onPickDate={(task, dKey, toDate) => s.moveTaskBetweenDays(dKey, toDate, task.id)}
                onMoveToList={(task, dKey, listId) => s.moveTaskToList(dKey, task.id, listId)}
                dragState={dragState} onDragOver={onDragOverDay} onDrop={onDropDay}
                onDragTaskStart={onDragTaskStart} onDragTaskEnd={onDragTaskEnd}
                topThreeIds={dateKey(d) === todayKey ? topThreeIds : []}
                inList={false} />
            ))}
          </div>
        )}
        </div>

        {/* Left over: incomplete tasks from previous days */}
        {leftoverCount > 0 && (
          <div className={mobileTab === 'lists' ? 'hidden md:block' : ''}>
            <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${palette.borderSoft}` }}>
              <div className="flex items-center gap-3 mb-4">
                <RotateCcw size={14} style={{ color: palette.warm }} />
                <h2 style={{
                  fontFamily: 'Fraunces, serif',
                  fontWeight: 400,
                  fontSize: '1.4rem',
                  letterSpacing: '-0.01em',
                  color: palette.ink,
                }}>Left over</h2>
                <span style={{
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.7rem',
                  color: palette.ink3,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>{leftoverCount}</span>
              </div>
              <div className="max-w-[640px] space-y-5">
                {leftoverGroups.map(group => {
                  const d = new Date(group.dKey + 'T00:00:00');
                  const daysAgo = Math.round((today0() - d) / 86400000);
                  const subheading = daysAgo === 1
                    ? 'Yesterday'
                    : `${fmtDay(d)} · ${fmtDate(d)}`;
                  return (
                    <div key={group.dKey}>
                      <div style={{
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: palette.ink3,
                        marginBottom: 4,
                        paddingLeft: 8,
                      }}>{subheading}</div>
                      {group.tasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          dKey={group.dKey}
                          lists={s.lists}
                          onToggle={() => s.toggleTask(group.dKey, task.id)}
                          onEdit={(id, text) => s.editTask(group.dKey, id, text)}
                          onDelete={(id) => s.deleteTask(group.dKey, id)}
                          onStart={(id) => s.startTask(group.dKey, id)}
                          onPause={(id) => s.pauseTask(group.dKey, id)}
                          onFocus={(t) => setFocusTask({ dKey: group.dKey, task: t })}
                          onOpenActionMenu={(t, dk) => setActionMenuTask({ task: t, dKey: group.dKey })}
                          onMoveToTomorrow={(t, dk) => moveTaskToOffset(group.dKey, task.id, 1)}
                          onMoveToSomeday={(t, dk) => moveTaskToSomeday(group.dKey, task.id)}
                          onPickDate={(t, dk, toDate) => s.moveTaskBetweenDays(group.dKey, toDate, task.id)}
                          onMoveToList={(t, dk, listId) => s.moveTaskToList(group.dKey, task.id, listId)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Someday: tasks with no date — appears between the week grid and Lists */}
        <div className={mobileTab === 'lists' ? 'hidden md:block' : ''}>
          {(s.tasks['someday'] || []).length > 0 || true ? (
            <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${palette.borderSoft}` }}>
              <div className="flex items-center gap-3 mb-4">
                <Sunrise size={14} style={{ color: palette.accent }} />
                <h2 style={{
                  fontFamily: 'Fraunces, serif',
                  fontWeight: 400,
                  fontSize: '1.4rem',
                  letterSpacing: '-0.01em',
                  color: palette.ink,
                }}>Someday</h2>
                <span style={{
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.7rem',
                  color: palette.ink3,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  {(s.tasks['someday'] || []).filter(t => !t.completed).length}
                </span>
              </div>
              <div className="max-w-[640px]">
                <DayColumn
                  date={new Date(0)} // placeholder date (not used since we override inList)
                  tasks={s.tasks['someday'] || []}
                  events={[]}
                  onAdd={(text) => {
                    // Add a new task directly to Someday by bypassing dateKey
                    // We use s.moveTaskBetweenDays after creation, but simpler: just call addTask with 'someday'
                    s.addTask('someday', text);
                  }}
                  onToggle={s.toggleTask} onEdit={s.editTask} onDelete={s.deleteTask}
                  onStart={s.startTask} onPause={s.pauseTask}
                  onFocus={(dKey, task) => setFocusTask({ dKey, task })}
                  onOpenActionMenu={(task, dKey) => setActionMenuTask({ task, dKey })}
                  lists={s.lists}
                  onMoveToTomorrow={(task, dKey) => moveTaskToOffset(dKey, task.id, 1)}
                  onMoveToSomeday={(task, dKey) => moveTaskToSomeday(dKey, task.id)}
                  onPickDate={(task, dKey, toDate) => s.moveTaskBetweenDays(dKey, toDate, task.id)}
                  onMoveToList={(task, dKey, listId) => s.moveTaskToList(dKey, task.id, listId)}
                  dragState={dragState} onDragOver={onDragOverDay} onDrop={onDropDay}
                  onDragTaskStart={onDragTaskStart} onDragTaskEnd={onDragTaskEnd}
                  topThreeIds={[]}
                  inList={true}
                  hideDateHeader={true}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Lists section: always visible on desktop, only when Lists tab on mobile */}
        <div className={mobileTab === 'week' ? 'hidden md:block' : ''}>
          <Lists
            lists={s.lists}
            listItems={s.listItems}
            onCreateList={s.createList}
            onDeleteList={s.deleteList}
            onAddItem={s.addListItem}
            onToggleItem={s.toggleListItem}
            onEditItem={s.editListItem}
            onDeleteItem={s.deleteListItem}
          />
        </div>

        <footer className="mt-20 pt-6 text-center" style={{ borderTop: `1px solid ${palette.borderSoft}` }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.9rem', color: palette.ink3 }}>Momentum, not pressure.</p>
        </footer>
      </div>

      <BrainDump open={brainOpen} onClose={() => setBrainOpen(false)} items={s.brainDump}
        onAdd={s.addBrain} onDelete={s.deleteBrain} onPromote={s.promoteBrain} />
      <FocusLane open={!!focusTask} task={focusTask?.task}
        onClose={() => setFocusTask(null)}
        onComplete={(id) => focusTask && s.toggleTask(focusTask.dKey, id)}
        onUpdateNotes={(notes) => focusTask && s.updateTaskNotes(focusTask.dKey, focusTask.task.id, notes)} />
      <DailyClosure open={closureOpen} onClose={() => setClosureOpen(false)} todayTasks={todayTasks} stats={s.stats} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} user={s.user} />
      <QuickCaptureDrawer open={quickOpen} onClose={() => setQuickOpen(false)} onCapture={s.addBrain} />

      {actionMenuTask && (
        <TaskActionMenu
          task={actionMenuTask.task}
          currentDate={actionMenuTask.dKey}
          lists={s.lists}
          onClose={() => setActionMenuTask(null)}
          onComplete={() => { s.toggleTask(actionMenuTask.dKey, actionMenuTask.task.id); setActionMenuTask(null); }}
          onMoveToTomorrow={() => { moveTaskToOffset(actionMenuTask.dKey, actionMenuTask.task.id, 1); setActionMenuTask(null); }}
          onMoveToSomeday={() => { moveTaskToSomeday(actionMenuTask.dKey, actionMenuTask.task.id); setActionMenuTask(null); }}
          onMoveToDate={(d) => { s.moveTaskBetweenDays(actionMenuTask.dKey, d, actionMenuTask.task.id); setActionMenuTask(null); }}
          onMoveToList={(listId) => { s.moveTaskToList(actionMenuTask.dKey, actionMenuTask.task.id, listId); setActionMenuTask(null); }}
          onDelete={() => { s.deleteTask(actionMenuTask.dKey, actionMenuTask.task.id); setActionMenuTask(null); }}
        />
      )}

      <button onClick={() => setBrainOpen(true)}
        className="fixed bottom-[88px] right-[20px] md:bottom-[80px] md:right-[26px] w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
        style={{ background: '#FAFAFA', border: `1px solid ${palette.border}`, color: palette.ink2, boxShadow: '0 2px 8px rgba(27, 24, 19, 0.08)', zIndex: 30 }}
        title="Brain dump list (B)"><ListTodo size={14} /></button>

      <button onClick={() => setQuickOpen(true)}
        className="fixed bottom-5 right-5 md:bottom-6 md:right-6 w-14 h-14 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
        style={{ background: palette.accent, color: 'white', boxShadow: '0 4px 20px rgba(124,164,129,0.40)', zIndex: 30 }}
        title="Quick capture (⌘K)"><Brain size={18} /></button>
    </div>
  );
}
