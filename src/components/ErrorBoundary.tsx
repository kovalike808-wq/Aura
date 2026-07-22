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
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Произошла ошибка при отображении
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {this.state.error?.message || 'Приложение столкнулось с непредвиденной проблемой.'}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
              >
                Перезагрузить страницу
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-medium hover:bg-zinc-200 transition-all cursor-pointer"
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
