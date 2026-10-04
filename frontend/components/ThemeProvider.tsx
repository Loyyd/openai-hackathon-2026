'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Preference = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{ preference: Preference; setPreference: (value: Preference) => void }>({ preference: 'system', setPreference: () => {} });
export const themeScript = `(function(){var p='system';try{var s=localStorage.getItem('sentinelx.theme');if(s==='light'||s==='dark')p=s}catch(e){}var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>('system');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => { try { const saved = localStorage.getItem('sentinelx.theme'); setPreference(saved === 'light' || saved === 'dark' ? saved : 'system'); } catch { /* Use system. */ } };
    read();
    setReady(true);
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = preference === 'system' ? media.matches ? 'dark' : 'light' : preference;
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference, ready]);
  const update = (value: Preference) => { setPreference(value); try { localStorage.setItem('sentinelx.theme', value); } catch { /* In-memory selection works without storage. */ } };
  return <ThemeContext.Provider value={{ preference, setPreference: update }}>{children}</ThemeContext.Provider>;
}

export function ThemeControl() {
  const { preference, setPreference } = useContext(ThemeContext);
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;
  return <label className="theme-control"><Icon size={16} aria-hidden="true" /><span className="sr-only">Theme</span><select aria-label="Theme" value={preference} onChange={(event) => setPreference(event.target.value as Preference)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
