import React, { useState } from 'react';
import { Plus, Lightbulb, Star, Trash2, ArrowRight, CheckSquare, Target, BookOpen } from 'lucide-react';
import { Idea } from '../types';

interface IdeasSectionProps {
  ideas: Idea[];
  onAddIdea: (title: string, content: string) => void;
  onUpdateIdea: (id: string, updates: Partial<Idea>) => void;
  onDeleteIdea: (id: string) => void;
  onConvertIdea: (id: string, targetType: 'task' | 'goal' | 'note') => void;
}

export default function IdeasSection({
  ideas,
  onAddIdea,
  onUpdateIdea,
  onDeleteIdea,
  onConvertIdea
}: IdeasSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleCreateIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddIdea(newTitle, newContent);
    setNewTitle('');
    setNewContent('');
    setShowModal(false);
  };

  return (
    <div id="ideas-section" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Lightbulb className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Банк идей</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
            Записывайте мимолетные инсайты, творческие мысли и превращайте их в реальные задачи или цели одним кликом.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="sm:self-center px-4 py-2.5 bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Зафиксировать идею
        </button>
      </div>

      {/* Ideas list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ideas.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
            <Lightbulb className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Банк идей пуст</p>
            <p className="text-xs text-zinc-400 mt-1">Не упускайте ценные мысли. Фиксируйте их здесь для дальнейшей проработки.</p>
          </div>
        ) : (
          ideas.map(idea => (
            <div
              key={idea.id}
              className={`bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-all ${
                idea.convertedTo ? 'opacity-60 bg-zinc-50/50 dark:bg-zinc-950/20' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className={`w-4.5 h-4.5 ${idea.convertedTo ? 'text-zinc-400' : 'text-amber-400'}`} />
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
                      {idea.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!idea.convertedTo && (
                      <button
                        onClick={() => onUpdateIdea(idea.id, { isFavorite: !idea.isFavorite })}
                        className={`p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                          idea.isFavorite ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-500'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${idea.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteIdea(idea.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-300 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Удалить идею"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                  {idea.content || <span className="italic text-zinc-300">Содержимое отсутствует</span>}
                </p>
              </div>

              {/* Convert or display status block */}
              <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                {idea.convertedTo ? (
                  <div className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                    <span>Превращено в {idea.convertedTo.type === 'task' ? 'задачу' : idea.convertedTo.type === 'goal' ? 'цель' : 'заметку'}</span>
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Действия:</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onConvertIdea(idea.id, 'task')}
                        className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="Превратить в задачу"
                      >
                        <CheckSquare className="w-3 h-3 text-zinc-500" /> Задача
                      </button>
                      <button
                        onClick={() => onConvertIdea(idea.id, 'goal')}
                        className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="Превратить в цель"
                      >
                        <Target className="w-3 h-3 text-zinc-500" /> Цель
                      </button>
                      <button
                        onClick={() => onConvertIdea(idea.id, 'note')}
                        className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="Превратить в заметку"
                      >
                        <BookOpen className="w-3 h-3 text-zinc-500" /> Заметка
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Idea creation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full p-6 shadow-premium-dark space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight font-display text-zinc-900 dark:text-zinc-100">
                Зафиксировать мысль или идею
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateIdea} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Суть идеи или мысли</label>
                <input
                  type="text"
                  required
                  placeholder="Придумать стартап, сделать проект..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Content text */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Дополнительные мысли</label>
                <textarea
                  rows={4}
                  placeholder="Напишите сюда детали вашей задумки..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200 font-sans"
                />
              </div>

              {/* Actions */}
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
                  Сохранить в банк
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
