
import React from 'react';
// Removed unused icons: Squares2x2Icon, MicrophoneIcon

interface HeaderProps {
  // activeView: 'subjects' | 'live'; // No longer needed
  // setActiveView: (view: 'subjects' | 'live') => void; // No longer needed
}

// Removed ViewTab type and tabs array

const Header: React.FC<HeaderProps> = () => { // Removed props as they are no longer needed
  return null; // Header component is no longer rendering anything, its functionality is moved
};

export default Header;
