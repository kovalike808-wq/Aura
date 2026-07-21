import React, { useState } from 'react';
import { Plus, Search, Star, Trash2, Edit3, BookOpen, CheckSquare, Square, FileText, ChevronRight } from 'lucide-react';
import { Note, NoteItem } from '../types';

interface NotesSectionProps {
  notes: Note[];
  onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
}

export default function NotesSection({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}: NotesSectionProps) {
  const [search, setSearch] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  
  // Note Form states (when creating/editing)
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<'text' | 'checklist'>('text');
  
  // Checklist item creation input
  const [newCheckItemText, setNewCheckItemText] = useState('');

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0] || null;

  const handleOpenAddModal = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormType('text');
    setShowModal(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormType(note.type);
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const payload = {
      title: formTitle,
      content: formContent,
      type: formType,
      checklistItems: editingNote ? editingNote.checklistItems : [],
      isFavorite: editingNote ? editingNote.isFavorite : false
    };

    if (editingNote) {
      onUpdateNote(editingNote.id, payload);
    } else {
      onAddNote(payload);
    }
    setShowModal(false);
  };

  // Checklist triggers
  const handleAddChecklistItem = (noteId: string) => {
    if (!newCheckItemText.trim()) return;
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const newItem: NoteItem = {
        id: 'item_' + Math.random().toString(36).substr(2, 9),
        text: newCheckItemText,
        checked: false
      };
      onUpdateNote(noteId, {
        checklistItems: [...note.checklistItems, newItem],
        updatedAt: new Date().toISOString()
      });
      setNewCheckItemText('');
    }
  };

  const handleToggleChecklistItem = (noteId: string, itemId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedItems = note.checklistItems.map(item => 
        item.id === itemId ? { ...item, checked: !item.checked } : item
      );
      onUpdateNote(noteId, {
        checklistItems: updatedItems,
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleDeleteChecklistItem = (noteId: string, itemId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      onUpdateNote(noteId, {
        checklistItems: note.checklistItems.filter(item => item.id !== itemId),
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Search filter
  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="notes-section" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Блокнот и заметки</h2>
          <p className="text-sm text-zinc-500">Записывайте важные мысли, структурируйте конспекты и составляйте списки дел.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-premium"
        >
          <Plus className="w-4 h-4" /> Создать заметку
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Search + Notes list */}
        <div className="md:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Поиск по заметкам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">Заметок не найдено.</p>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    (activeNote && activeNote.id === note.id)
                      ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-premium'
                      : 'bg-white border-zinc-200/60 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800/60 dark:hover:border-zinc-700/60 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate pr-2">{note.title}</span>
                    <div className="flex items-center gap-1.5">
                      {note.isFavorite && (
                        <Star className={`w-3 h-3 fill-current ${
                          (activeNote && activeNote.id === note.id) ? 'text-amber-300' : 'text-amber-400'
                        }`} />
                      )}
                      {note.type === 'checklist' ? (
                        <CheckSquare className="w-3.5 h-3.5 opacity-60" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 opacity-60" />
                      )}
                    </div>
                  </div>
                  <p className={`text-[10px] line-clamp-2 leading-relaxed ${
                    (activeNote && activeNote.id === note.id) ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {note.type === 'checklist'
                      ? `Чек-лист: ${note.checklistItems.filter(i => i.checked).length} из ${note.checklistItems.length} выполнено`
                      : note.content || 'Пустое описание'
                    }
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Note detail preview & interactions */}
        <div className="md:col-span-2">
          {activeNote ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-premium space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-850 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {activeNote.title}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Изменено: {new Date(activeNote.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateNote(activeNote.id, { isFavorite: !activeNote.isFavorite })}
                    className={`p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                      activeNote.isFavorite ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-500'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${activeNote.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(activeNote)}
                    className="p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      onDeleteNote(activeNote.id);
                      setActiveNoteId(null);
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body Content */}
              {activeNote.type === 'text' ? (
                <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {activeNote.content || <span className="text-zinc-400 italic">Текст отсутствует. Нажмите «Редактировать», чтобы наполнить заметку.</span>}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Checklist display */}
                  <div className="space-y-2">
                    {activeNote.checklistItems.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">Списков пока нет.</p>
                    ) : (
                      activeNote.checklistItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
                          <button
                            onClick={() => handleToggleChecklistItem(activeNote.id, item.id)}
                            className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 text-left cursor-pointer"
                          >
                            {item.checked ? (
                              <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-300 hover:text-zinc-400" />
                            )}
                            <span className={item.checked ? 'line-through text-zinc-400' : ''}>{item.text}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteChecklistItem(activeNote.id, item.id)}
                            className="text-zinc-300 hover:text-rose-500 text-xs px-1.5 py-0.5 cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add checklist item */}
                  <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <input
                      type="text"
                      placeholder="Добавить новый пункт..."
                      value={newCheckItemText}
                      onChange={(e) => setNewCheckItemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddChecklistItem(activeNote.id);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={() => handleAddChecklistItem(activeNote.id)}
                      className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-12 text-center text-zinc-400 shadow-premium">
              <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              Выберите заметку из списка или создайте новую.
            </div>
          )}
        </div>
      </div>

      {/* Note Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-premium-dark space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight font-display text-zinc-900 dark:text-zinc-100">
                {editingNote ? 'Редактировать заметку' : 'Создать заметку'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Заголовок</label>
                <input
                  type="text"
                  required
                  placeholder="Идеи для бизнеса, Краткий план..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Type Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Тип контента</label>
                <select
                  value={formType}
                  onChange={(e: any) => setFormType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none text-zinc-800 dark:text-zinc-200"
                >
                  <option value="text">Текстовая заметка</option>
                  <option value="checklist">Чек-лист (список с галочками)</option>
                </select>
              </div>

              {/* Content text (only if type is text) */}
              {formType === 'text' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Содержимое</label>
                  <textarea
                    rows={6}
                    placeholder="Запишите сюда ваши мысли..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200 font-sans"
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
