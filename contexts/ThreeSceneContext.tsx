"use client";

import React, { createContext, useContext, useState } from 'react';

type ThreeSceneContextValue = {
  isInteractive: boolean;
  setInteractive: (v: boolean) => void;
};

const ThreeSceneContext = createContext<ThreeSceneContextValue | undefined>(undefined);

export const ThreeSceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInteractive, setInteractive] = useState(false);

  return (
    <ThreeSceneContext.Provider value={{ isInteractive, setInteractive }}>
      {children}
    </ThreeSceneContext.Provider>
  );
};

export const useThreeScene = () => {
  const ctx = useContext(ThreeSceneContext);
  if (!ctx) throw new Error('useThreeScene must be used within ThreeSceneProvider');
  return ctx;
};
