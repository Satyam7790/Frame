import './globals.css';
import './credits.css';

export const metadata = {
  title: 'FRAME — A year in frames',
  description: 'A personal cinematic yearbook. Every story you watched, all in one place.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
