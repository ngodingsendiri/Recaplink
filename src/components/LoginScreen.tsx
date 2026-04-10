import React from 'react';
import { signIn } from '../lib/firebase';
import { Button } from './ui/button';

export default function LoginScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to RecapLink</h1>
        <p className="text-slate-500 mb-8">Please sign in to continue.</p>
        <Button onClick={signIn}>Sign in with Google</Button>
      </div>
    </div>
  );
}
