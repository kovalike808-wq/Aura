import { Award, Lock, CheckCircle2, Flame, Target, Star, ShieldCheck } from 'lucide-react';
import { Achievement } from '../types';

interface AchievementsSectionProps {
  achievements: Achievement[];
}

export default function AchievementsSection({ achievements }: AchievementsSectionProps) {
  
  const getCategoryIcon = (category: string, unlocked: boolean) => {
    const iconClass = `w-6 h-6 ${unlocked ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-600'}`;
    if (category === 'tasks') return <CheckCircle2 className={iconClass} />;
    if (category === 'streak') return <Flame className={iconClass} />;
    if (category === 'goals') return <Target className={iconClass} />;
    return <Award className={iconClass} />;
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div id="achievements-section" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Достижения</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
            Система автоматического разблокирования наград за ваше усердие и регулярность действий.
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-semibold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          {unlockedCount} / {achievements.length}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map(ach => (
          <div
            key={ach.id}
            className={`p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 relative overflow-hidden card-hover ${
              ach.unlocked
                ? 'bg-white border-zinc-200/80 dark:bg-zinc-900 dark:border-zinc-800/80 shadow-premium'
                : 'bg-zinc-50/50 border-zinc-200/30 dark:bg-zinc-950/20 dark:border-zinc-900/40 opacity-70'
            }`}
          >
            {/* Soft decorative background glow for unlocked achievements */}
            {ach.unlocked && (
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 rounded-full blur-xl pointer-events-none" />
            )}

            {/* Icon Block */}
            <div className={`p-3 rounded-xl flex items-center justify-center ${
              ach.unlocked
                ? 'bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-800/50 border border-zinc-200/40 dark:border-zinc-700/40'
                : 'bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800'
            }`}>
              {ach.unlocked ? getCategoryIcon(ach.category, true) : <Lock className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />}
            </div>

            {/* Texts */}
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-bold tracking-tight ${
                  ach.unlocked ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {ach.title}
                </h3>
                {ach.unlocked && (
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full shrink-0">
                    Достигнуто
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed font-sans">
                {ach.description}
              </p>
              {ach.unlocked && ach.unlockedAt && (
                <p className="text-[9px] text-zinc-400 font-medium pt-1">
                  {new Date(ach.unlockedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
