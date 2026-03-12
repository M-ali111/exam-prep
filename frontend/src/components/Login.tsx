import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KAZAKHSTAN_CITIES, getSchoolsByCity } from '../utils/kazakhstanSchools';

export const Login: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [city, setCity] = useState('');
  const [centerName, setCenterName] = useState('');
  const schoolInputRef = useRef<HTMLInputElement>(null);
  const { login, signup } = useAuth();
  const availableSchools = getSchoolsByCity(city);
  const filteredSchools = availableSchools.filter((s) =>
    s.toLowerCase().includes(schoolSearch.toLowerCase())
  );

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
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setSchoolName('');
                  setSchoolSearch('');
                }}
                className="px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base bg-white"
                required
              >
                <option value="">Select city</option>
                {KAZAKHSTAN_CITIES.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </select>
              {/* Searchable school combobox */}
              <div className="relative">
                <input
                  ref={schoolInputRef}
                  type="text"
                  placeholder={city ? 'Search school...' : 'Select a city first'}
                  value={schoolSearch}
                  disabled={!city}
                  onChange={(e) => {
                    setSchoolSearch(e.target.value);
                    setSchoolName('');
                    setShowSchoolDropdown(true);
                  }}
                  onFocus={() => setShowSchoolDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSchoolDropdown(false), 150)}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  required={!schoolName}
                  autoComplete="off"
                />
                {schoolName && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-lg">✓</span>
                )}
                {showSchoolDropdown && filteredSchools.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredSchools.map((school) => (
                      <li
                        key={school}
                        onMouseDown={() => {
                          setSchoolName(school);
                          setSchoolSearch(school);
                          setShowSchoolDropdown(false);
                        }}
                        className={`px-4 py-3 text-sm cursor-pointer hover:bg-cyan-50 ${
                          school === schoolName ? 'bg-cyan-50 font-semibold text-cyan-700' : 'text-gray-800'
                        }`}
                      >
                        {school}
                      </li>
                    ))}
                  </ul>
                )}
                {showSchoolDropdown && city && filteredSchools.length === 0 && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 px-4 py-3 text-sm text-gray-400">
                    No schools found
                  </div>
                )}
              </div>
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
