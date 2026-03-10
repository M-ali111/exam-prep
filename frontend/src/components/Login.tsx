import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('');
  const [centerName, setCenterName] = useState('');
  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignup) {
        await signup(email, username, password, schoolName, city, centerName);
        localStorage.setItem('examPrepJustSignedUp', 'true');
      } else {
        await login(email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-amber-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl sm:text-6xl mb-3">🧠</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Exam - Prep</h1>
          <p className="text-gray-500 text-base sm:text-sm mt-2">Master Mathematics & Logic</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignup && (
            <>
              <input
                type="text"
                placeholder="Name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                required
              />
              <input
                type="text"
                placeholder="School name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                required
              />
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                required
              />
              <input
                type="text"
                placeholder="Center name"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                required
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
            required
          />
          {error && <p className="text-red-500 text-center text-sm font-medium">{error}</p>}
          <button 
            type="submit" 
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-4 rounded-2xl transition-colors text-lg mt-2"
          >
            {isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-cyan-500 hover:text-cyan-600 font-bold cursor-pointer"
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};
