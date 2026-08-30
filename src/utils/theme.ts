const STORAGE_KEY = 'halaqi_theme';

export function getTheme(): 'dark' | 'light' {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  document.body.classList.toggle('light-mode', theme === 'light');
}

export function initTheme() {
  const t = getTheme();
  document.body.classList.toggle('light-mode', t === 'light');
}
