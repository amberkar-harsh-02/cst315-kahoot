import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function StudentView() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState('join');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lockedAnswer, setLockedAnswer] = useState(null);
  const [error, setError] = useState('');
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProfessor, setIsProfessor] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isProfessorRole, setIsProfessorRole] = useState(false);
  
  // NEW: History States
  const [history, setHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const ws = useRef(null);
  const playerIdRef = useRef(null); 
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('kahoot_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setLoggedInUser(payload.sub);
        setIsProfessorRole(payload.is_professor);
        setName(payload.sub.split('@')[0]); 
        
        // Fetch history if they are a logged-in student
        if (!payload.is_professor) {
          fetch('http://127.0.0.1:8000/student/history', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => res.json())
          .then(data => setHistory(data))
          .catch(err => console.error(err));
        }
      } catch (e) {
        localStorage.removeItem('kahoot_token');
      }
    }
  }, []);

  useEffect(() => {
    if (gameState === 'question_active' && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft, gameState]);

  const handleManualAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const res = await fetch('http://127.0.0.1:8000/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, is_professor: isProfessor })
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
        alert("Registration successful! Please log in.");
        setIsRegistering(false);
        return;
      }
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      const res = await fetch('http://127.0.0.1:8000/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      processLoginToken(data.access_token);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setAuthError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Google Login failed');
      const data = await res.json();
      processLoginToken(data.access_token);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const processLoginToken = (token) => {
    localStorage.setItem('kahoot_token', token);
    window.location.reload(); // Quick refresh to load history state seamlessly
  };

  const handleLogout = () => {
    localStorage.removeItem('kahoot_token');
    window.location.reload();
  };

  const joinGame = (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('kahoot_token');
    const wsUrl = `ws://127.0.0.1:8000/ws/student/${roomCode}?student_name=${encodeURIComponent(name)}${token ? `&token=${token}` : ''}`;
    
    ws.current = new WebSocket(wsUrl);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'join_success') {
        playerIdRef.current = data.player_id; 
        setGameState('waiting');
        setScore(0);
      }
      else if (data.error) { setError(data.error); ws.current.close(); }
      else if (data.event === 'show_question') { 
        setCurrentQuestion(data.question); 
        setLockedAnswer(null); 
        setTimeLeft(data.question.time_limit); 
        setGameState('question_active'); 
      }
      else if (data.event === 'leaderboard' || data.event === 'time_up') {
        setGameState('time_up'); 
        if (data.scores && data.scores[playerIdRef.current] !== undefined) setScore(data.scores[playerIdRef.current]); 
      }
      else if (data.event === 'game_over') {
        setGameState('game_over');
        if (data.scores && data.scores[playerIdRef.current] !== undefined) setScore(data.scores[playerIdRef.current]); 
      }
    };
    ws.current.onclose = () => {
      if (gameState !== 'game_over') { setError('Disconnected from host.'); setGameState('join'); }
    };
  };

  const submitAnswer = (color) => {
    if (lockedAnswer) return; 
    setLockedAnswer(color);
    ws.current.send(JSON.stringify({ 
      event: 'submit_answer', selected_option: color, time_remaining_ms: timeLeft * 1000 
    }));
  };

  // --------------------------------------------------------
  // VIEW 1: AUTHENTICATED STUDENT DASHBOARD
  // --------------------------------------------------------
  if (gameState === 'join' && loggedInUser && !isProfessorRole) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">
          
          <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6 pt-4">
            <div>
              <h1 className="text-3xl font-black text-gray-800">Welcome, {name}</h1>
              <p className="font-bold text-gray-500">Student Dashboard</p>
            </div>
            <button onClick={handleLogout} className="rounded-xl border-2 border-gray-300 px-6 py-2 font-bold text-gray-700 hover:bg-gray-100">Log Out</button>
          </div>

          {/* Quick Join Card */}
          <div className="mb-10 rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
            <h2 className="mb-6 text-2xl font-bold text-gray-800">Join a Live Class Quiz</h2>
            {error && <div className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-700">{error}</div>}
            <form onSubmit={joinGame} className="flex space-x-4">
              <input 
                type="text" 
                required 
                placeholder="Enter Room PIN" 
                value={roomCode} 
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                className="flex-grow rounded-2xl bg-gray-100 p-5 text-2xl font-black tracking-widest text-gray-800 uppercase focus:ring-4 focus:ring-blue-500 focus:outline-none" 
              />
              <button type="submit" className="rounded-2xl bg-blue-600 px-10 text-xl font-bold text-white shadow-md active:scale-95 transition-transform hover:bg-blue-700">Join</button>
            </form>
          </div>

          {/* Past History Accordion */}
          <h2 className="mb-6 text-2xl font-bold text-gray-800">Past Quizzes & Review</h2>
          {history.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center text-lg font-bold text-gray-400 border border-gray-100">You haven't participated in any quizzes yet.</div>
          ) : (
            <div className="space-y-4">
              {history.map((session) => (
                <div key={session.id} className="overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-100">
                  
                  {/* Accordion Header */}
                  <div 
                    onClick={() => setExpandedHistoryId(expandedHistoryId === session.id ? null : session.id)} 
                    className="flex cursor-pointer items-center justify-between p-6 hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{session.quiz_title}</h3>
                      <p className="text-sm font-bold text-gray-400 mt-1">Score: {session.total_score} pts • Accuracy: {session.accuracy}%</p>
                    </div>
                    <div className="text-gray-400 font-bold text-2xl">
                      {expandedHistoryId === session.id ? '−' : '+'}
                    </div>
                  </div>

                  {/* Accordion Body (The Review Explanations) */}
                  {expandedHistoryId === session.id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-6">
                      {session.details.map((q, idx) => (
                        <div key={idx} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200">
                          <h4 className="mb-4 text-lg font-bold text-gray-800"><span className="text-gray-400 mr-2">{idx + 1}.</span> {q.question_text}</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className={`rounded-xl p-4 border-2 ${q.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Your Answer</p>
                              <p className={`font-bold ${q.is_correct ? 'text-green-700' : 'text-red-700'}`}>{q.selected_text}</p>
                            </div>
                            
                            {!q.is_correct && (
                              <div className="rounded-xl p-4 border-2 border-blue-200 bg-blue-50">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Correct Answer</p>
                                <p className="font-bold text-blue-700">{q.correct_text}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="rounded-xl bg-gray-100 p-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Explanation</p>
                            <p className="text-sm font-semibold text-gray-700">{q.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 2: GUEST / LOGIN LANDING PAGE (Unauthenticated)
  // --------------------------------------------------------
  if (gameState === 'join') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center bg-gray-100 p-4 sm:p-8">
        <div className="w-full max-w-md flex-grow flex flex-col pt-8 sm:pt-16">
          <h1 className="mb-8 text-center text-5xl font-black text-gray-800 tracking-tight">Quiz App</h1>
          
          <div className="flex flex-col rounded-3xl bg-white p-6 shadow-xl mb-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">Play as Guest</h2>
            {error && <div className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-700">{error}</div>}
            
            <form onSubmit={joinGame} className="flex flex-col space-y-4">
              <input type="text" required placeholder="Room PIN" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} className="w-full rounded-2xl bg-gray-100 p-5 text-center text-3xl font-black tracking-widest text-gray-800 uppercase focus:ring-4 focus:ring-blue-500 focus:outline-none" />
              <input type="text" required placeholder="Nickname" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl bg-gray-100 p-4 text-center text-xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-500 focus:outline-none" />
              <button type="submit" className="w-full rounded-2xl bg-gray-900 py-5 text-xl font-bold text-white active:scale-95 transition-transform">Enter Game</button>
            </form>
          </div>

          <div className="flex flex-col rounded-3xl bg-white p-6 shadow-xl mb-8">
            {loggedInUser && isProfessorRole ? (
              <div className="text-center">
                <p className="mb-6 text-lg font-bold text-gray-800">Logged in as {loggedInUser}</p>
                <button onClick={() => navigate('/host')} className="mb-4 w-full rounded-2xl bg-purple-600 py-4 text-lg font-bold text-white active:scale-95 transition-transform">Professor Dashboard</button>
                <button onClick={handleLogout} className="w-full rounded-2xl border-2 border-gray-200 py-3 text-lg font-bold text-gray-600 active:bg-gray-50">Log Out</button>
              </div>
            ) : (
              <div>
                <h2 className="mb-4 text-xl font-bold text-gray-800">{isRegistering ? 'Create Account' : 'Student & Staff Login'}</h2>
                {authError && <div className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-700">{authError}</div>}
                <form onSubmit={handleManualAuth} className="flex flex-col space-y-3">
                  <input type="email" required placeholder="Email (@csumb.edu)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl bg-gray-100 p-4 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl bg-gray-100 p-4 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  {isRegistering && (
                    <label className="flex items-center space-x-3 pt-2 pl-2">
                      <input type="checkbox" checked={isProfessor} onChange={(e) => setIsProfessor(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="font-bold text-gray-700">I am a Professor / TA</span>
                    </label>
                  )}
                  <button type="submit" className="mt-2 rounded-xl bg-blue-600 py-4 text-lg font-bold text-white active:scale-95 transition-transform">{isRegistering ? 'Sign Up' : 'Log In'}</button>
                </form>
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-sm font-bold text-blue-600 hover:underline">{isRegistering ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button>
                </div>
                <div className="mt-6 flex flex-col items-center border-t border-gray-100 pt-6">
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setAuthError('Google login failed.')} width="100%" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 3: EDGE-TO-EDGE MOBILE GAME CONTROLLER
  // --------------------------------------------------------
  return (
    <div className="flex h-[100dvh] w-full flex-col bg-gray-100 overflow-hidden select-none">
      <div className="flex h-16 w-full shrink-0 items-center justify-between bg-white px-4 shadow-sm z-10">
        <div className="text-lg font-black text-gray-800 truncate max-w-[40%]">{name}</div>
        {gameState === 'question_active' && (
          <div className={`text-2xl font-black ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
            {timeLeft}
          </div>
        )}
        <div className="text-lg font-bold text-blue-600 whitespace-nowrap">
          <span className="mr-1 text-gray-400 text-sm uppercase">Score</span>{score}
        </div>
      </div>

      <div className="flex flex-grow flex-col justify-center bg-gray-50">
        {gameState === 'waiting' && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <h2 className="mb-2 text-4xl font-black text-gray-800">You're in!</h2>
            <div className="mt-6 h-1 w-16 rounded bg-gray-300 animate-pulse"></div>
            <div className="mt-6 text-xl font-bold text-gray-400">See nickname on screen</div>
          </div>
        )}

        {gameState === 'question_active' && (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-3 p-3">
            {['red', 'blue', 'yellow', 'green'].map((color, index) => (
              <button 
                key={color} 
                onClick={() => submitAnswer(color)} 
                disabled={lockedAnswer !== null} 
                className={`relative flex items-center justify-center w-full h-full rounded-2xl shadow-sm transition-all active:scale-[0.97] touch-manipulation
                  ${lockedAnswer === color ? 'ring-4 ring-black ring-inset opacity-100 scale-[0.98]' : ''} 
                  ${lockedAnswer && lockedAnswer !== color ? 'opacity-25 grayscale' : ''}`} 
                style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color }} 
              >
                {lockedAnswer === color && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-2xl">
                    <span className="text-white text-3xl">✔</span>
                  </div>
                )}
                <span className={`text-6xl font-black opacity-30 ${color === 'yellow' ? 'text-gray-900' : 'text-white'}`}>
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        )}

        {gameState === 'time_up' && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <h2 className="mb-2 text-4xl font-black text-gray-800">Time's Up!</h2>
            <div className="mt-6 text-xl font-bold text-gray-400">Look at the big screen</div>
          </div>
        )}

        {gameState === 'game_over' && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <h2 className="mb-4 text-5xl font-black text-gray-800">Game Over!</h2>
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 w-full max-w-xs">
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Final Score</div>
              <div className="text-5xl font-black text-blue-600">{score}</div>
            </div>
            <button 
              onClick={() => {
                if (ws.current) ws.current.close();
                setGameState('join');
                setRoomCode('');
                window.location.reload(); // Refresh to pull updated history immediately
              }} 
              className="mt-10 w-full max-w-xs rounded-2xl bg-gray-900 py-4 text-xl font-bold text-white shadow-md active:scale-95 transition-transform"
            >
              Exit to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}