/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import EngagementDashboard from './components/EngagementDashboard';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-500 font-bold">{error}</div>;
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <LoginScreen />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen">
      <ErrorBoundary>
        <EngagementDashboard />
      </ErrorBoundary>
    </div>
  );
}

