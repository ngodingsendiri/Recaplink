import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const ALLOWED_EMAILS = [
  'ngerjaindiri@gmail.com',
  'sipencil@gmail.com',
  'abiemputra.asn@gmail.com'
];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, error: null });

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email && !ALLOWED_EMAILS.includes(user.email)) {
          await signOut(auth);
          setError("can't access");
          setUser(null);
          setLoading(false);
          return;
        }

        // Sync user to Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'user', // Default role
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          });
        } else {
          await setDoc(userRef, {
            lastLogin: serverTimestamp(),
            displayName: user.displayName,
            photoURL: user.photoURL
          }, { merge: true });
        }
        setUser(user);
        setError(null);
      } else {
        setUser(null);
        setError(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
