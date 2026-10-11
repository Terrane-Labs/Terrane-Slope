import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Terrane Slope',
  description: 'Rock-slope kinematic analysis workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
