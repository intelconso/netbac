import { useEffect, useState } from 'react';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { onAuthChange } from './firebase';

export type SessionState = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
};

// Combined into one state object so user + initializing always update together
// in a single render. Two separate setStates in an external callback can render
// (initializing=false, user=null) for one frame, briefly flashing /login.
type SessionInternal = { user: FirebaseAuthTypes.User | null; initializing: boolean };

export function useSession(): SessionState {
  const [s, setS] = useState<SessionInternal>({ user: null, initializing: true });

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setS({ user: u, initializing: false });
    });
    return unsub;
  }, []);

  return s;
}
