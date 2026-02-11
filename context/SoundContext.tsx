import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { getSoundEnabled, setSoundEnabled as setSoundEnabledDb } from "../services/database/soundService";

type SoundContextType = {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
};

const SoundContext = createContext<SoundContextType | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    getSoundEnabled().then(setSoundEnabledState);
  }, []);

  const setSoundEnabled = async (enabled: boolean) => {
    setSoundEnabledState(enabled);
    await setSoundEnabledDb(enabled);
  };

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within a SoundProvider");
  }
  return context;
}
