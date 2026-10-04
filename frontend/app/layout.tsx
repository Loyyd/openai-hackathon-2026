import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { ApplicationProvider } from '../components/ApplicationProvider';
import { ApplicationShell } from '../components/ApplicationShell';
import { ThemeProvider, themeScript } from '../components/ThemeProvider';

export const metadata: Metadata = {
  title: 'SentinelX | Dublin situational awareness',
  description: 'Dublin situational awareness, camera evidence and incident management.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><ThemeProvider><ApplicationProvider><ApplicationShell>{children}</ApplicationShell></ApplicationProvider></ThemeProvider></body></html>;
}
