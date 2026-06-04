import { useState } from 'react';
import Home from '@/pages/Home';
import { ConferencePage } from '@/pages/ConferencePage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'conference'>('home');

  if (currentPage === 'conference') {
    return <ConferencePage onBack={() => setCurrentPage('home')} />;
  }

  return <Home onGoToConference={() => setCurrentPage('conference')} />;
}
