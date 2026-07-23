import React, { Component, ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = {
    hasError: false,
    error: null as Error | null
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Aura:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('aura-app-state-backup');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl space-y-5 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-lg">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-display">
                Произошла ошибка
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {this.state.error?.message || 'Приложение столкнулось с непредвиденной проблемой. Попробуйте перезагрузить страницу.'}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-all cursor-pointer shadow-lg"
              >
                Перезагрузить страницу
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
              >
                Сбросить кэш и обновить
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
