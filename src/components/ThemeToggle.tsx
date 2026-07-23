import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export default function ThemeToggle({ darkMode, setDarkMode }: ThemeToggleProps) {
  return (
    <button
      id="theme-toggle-btn"
      onClick={() => setDarkMode(!darkMode)}
      className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
      title={darkMode ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {darkMode ? (
        <Sun id="sun-icon" className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon id="moon-icon" className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
