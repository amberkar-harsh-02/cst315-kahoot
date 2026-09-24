import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

export default function StudentView() {
  // Game States
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState('join'); // join, waiting, question_active, time_up, game_over
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lockedAnswer, setLockedAnswer] = useState(null);
  const [error, setError] = useState('');
  
  // Real-Time HUD States
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  
  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProfessor, setIsProfessor] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isProfessorRole, setIsProfessorRole] = useState(false);

  const ws = useRef(null);
  const playerIdRef = useRef(null);
  const navigate = useNavigate();

  // Check auth on load
  useEffect(() => {
    const token = localStorage.getItem('kahoot_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setLoggedInUser(payload.sub);
        setIsProfessorRole(payload.is_professor);
        setName(payload.sub.split('@')[0]); 
      } catch (e) {
        localStorage.removeItem('kahoot_token');
      }
    }
  }, []);

  // Sync Student Timer (Feature 5)
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
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'Registration failed');
        }
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Google Login failed');
      }
      const data = await res.json();
      processLoginToken(data.access_token);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const processLoginToken = (token) => {
    localStorage.setItem('kahoot_token', token);
    const payload = JSON.parse(atob(token.split('.')[1]));
    setLoggedInUser(payload.sub);
    setIsProfessorRole(payload.is_professor);
    setName(payload.sub.split('@')[0]);
    if (payload.is_professor) navigate('/host');
  };

  const handleLogout = () => {
    localStorage.removeItem('kahoot_token');
    setLoggedInUser(null);
    setIsProfessorRole(false);
    setName('');
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
        ws.current.playerId = data.player_id; 
        setGameState('waiting');
        setScore(0);
      }
      else if (data.error) { 
        setError(data.error); 
        ws.current.close(); 
      }
      else if (data.event === 'show_question') { 
        setCurrentQuestion(data.question); 
        setLockedAnswer(null); 
        setTimeLeft(data.question.time_limit); 
        setGameState('question_active'); 
      }
      // Triggered when Host timer hits 0 OR Host clicks "Skip"
      else if (data.event === 'leaderboard') {
        setGameState('time_up'); 
        if (data.scores && data.scores[ws.current.playerId] !== undefined) {
          setScore(data.scores[ws.current.playerId]); // Grab specific score from map
        }
      }
      // Triggered when game is forced to end
      else if (data.event === 'game_over') {
        setGameState('game_over');
        if (data.scores && data.scores[ws.current.playerId] !== undefined) {
          setScore(data.scores[ws.current.playerId]); // Grab specific score from map
        }
      }
    };

    ws.current.onclose = () => {
      if (gameState !== 'game_over') { setError('Disconnected from the host.'); setGameState('join'); }
    };
  };

  const submitAnswer = (color) => {
    if (lockedAnswer) return; 
    setLockedAnswer(color);
    ws.current.send(JSON.stringify({ 
      event: 'submit_answer', 
      selected_option: color, 
      time_remaining_ms: timeLeft * 1000 
    }));
  };

  // --------------------------------------------------------
  // VIEW 1: LANDING PAGE (Unchanged logic, just UI wrap)
  // --------------------------------------------------------
  if (gameState === 'join') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex h-full w-full flex-col bg-white p-8 shadow-xl md:p-16">
          <div className="mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center">
            <h1 className="mb-16 text-center text-6xl font-black text-gray-800">Quiz App</h1>
            
            <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
              <div className="flex flex-col rounded-2xl bg-blue-50 p-10 shadow-sm">
                <h2 className="mb-8 text-4xl font-bold text-gray-800">Join a Game</h2>
                {error && <div className="mb-6 rounded bg-red-100 p-4 text-red-700">{error}</div>}
                <p className="mb-10 text-xl text-gray-600">
                  {loggedInUser ? "Your score will be saved to your account." : "Play as a guest or log in to save your score history."}
                </p>
                <form onSubmit={joinGame} className="flex flex-col space-y-6">
                  <input type="text" required placeholder="Room PIN" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} className="rounded-xl border-2 border-gray-300 p-5 text-center text-3xl font-bold tracking-widest focus:border-blue-500 focus:outline-none" />
                  <input type="text" required placeholder="Nickname" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-2 border-gray-300 p-5 text-center text-2xl font-semibold focus:border-blue-500 focus:outline-none" />
                  <button type="submit" className="rounded-xl bg-gray-900 py-5 text-2xl font-bold text-white transition-colors hover:bg-gray-800">Enter Game</button>
                </form>
              </div>

              <div className="flex flex-col rounded-2xl border-2 border-gray-100 bg-white p-10 shadow-sm">
                {loggedInUser ? (
                  <div className="flex h-full flex-col justify-center">
                    <h2 className="mb-4 text-4xl font-bold text-gray-800">Welcome Back!</h2>
                    <p className="mb-10 text-2xl text-gray-600">{loggedInUser}</p>
                    {isProfessorRole && (
                      <button onClick={() => navigate('/host')} className="mb-6 w-full rounded-xl bg-purple-600 py-5 text-xl font-bold text-white transition-colors hover:bg-purple-700">Enter Professor Dashboard</button>
                    )}
                    <button onClick={handleLogout} className="w-full rounded-xl border-2 border-gray-300 py-5 text-xl font-bold text-gray-700 transition-colors hover:bg-gray-50">Log Out</button>
                  </div>
                ) : (
                  <div>
                    <h2 className="mb-4 text-4xl font-bold text-gray-800">{isRegistering ? 'Create Account' : 'Login'}</h2>
                    <p className="mb-8 text-lg text-gray-500">Must use @csumb.edu email</p>
                    {authError && <div className="mb-6 rounded bg-red-100 p-4 text-red-700">{authError}</div>}
                    <form onSubmit={handleManualAuth} className="flex flex-col space-y-5">
                      <input type="email" required placeholder="Email (@csumb.edu)" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-gray-300 p-4 text-xl focus:border-blue-500 focus:outline-none" />
                      <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-gray-300 p-4 text-xl focus:border-blue-500 focus:outline-none" />
                      {isRegistering && (
                        <label className="flex items-center space-x-3 pt-2 text-gray-700">
                          <input type="checkbox" checked={isProfessor} onChange={(e) => setIsProfessor(e.target.checked)} className="h-6 w-6 rounded" />
                          <span className="text-xl">I am a Professor / TA</span>
                        </label>
                      )}
                      <button type="submit" className="mt-6 rounded-xl bg-blue-600 py-5 text-xl font-bold text-white hover:bg-blue-700">{isRegistering ? 'Sign Up' : 'Log In'}</button>
                      <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="mt-4 text-lg text-blue-600 hover:underline">{isRegistering ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button>
                    </form>
                    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-8">
                      <p className="mb-4 text-gray-500">Or log in with Google</p>
                      <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setAuthError('Google login pop-up closed or failed.')} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 2: GAME CONTROLLER HUD (Feature 3)
  // --------------------------------------------------------
  return (
    <div className="flex h-screen w-full flex-col bg-gray-100">
      
      {/* HUD HEADER: Name, Timer, Live Score */}
      <div className="flex h-20 w-full items-center justify-between bg-white px-8 shadow-md">
        <div className="text-2xl font-bold text-gray-800">{name}</div>
        
        {/* Only show the timer if a question is active */}
        {gameState === 'question_active' && (
          <div className={`text-3xl font-black ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
            {timeLeft}
          </div>
        )}
        
        <div className="text-2xl font-bold text-blue-600">
          <span className="mr-2 text-gray-400">Score</span>{score}
        </div>
      </div>

      {/* DYNAMIC CONTENT AREA */}
      <div className="flex flex-grow flex-col justify-center p-4">
        
        {gameState === 'waiting' && (
          <div className="text-center">
            <h2 className="mb-4 text-5xl font-bold text-gray-800">You're in!</h2>
            <div className="mt-8 animate-pulse text-2xl text-gray-500">Look at the big screen...</div>
          </div>
        )}

        {gameState === 'question_active' && (
          <div className="mx-auto grid h-full w-full max-w-5xl grid-cols-2 gap-4 pb-4">
            {['red', 'blue', 'yellow', 'green'].map((color, index) => (
              <button 
                key={color} 
                onClick={() => submitAnswer(color)} 
                disabled={lockedAnswer !== null} 
                className={`relative flex items-center justify-center w-full h-full rounded-2xl shadow-lg transition-transform active:scale-95 ${lockedAnswer === color ? 'ring-8 ring-black ring-inset opacity-100' : 'hover:brightness-110'} ${lockedAnswer && lockedAnswer !== color ? 'opacity-30' : ''}`} 
                style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color }} 
              >
                {/* Massive centered number for colorblind support */}
                <span className={`text-8xl font-black opacity-50 ${color === 'yellow' ? 'text-gray-900' : 'text-white'}`}>
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        )}

        {gameState === 'time_up' && (
          <div className="text-center">
            <h2 className="mb-4 text-5xl font-bold text-gray-800">Time's Up!</h2>
            <div className="mt-4 text-2xl text-gray-500">Wait for the next question...</div>
          </div>
        )}

        {gameState === 'game_over' && (
          <div className="text-center">
            <h2 className="mb-6 text-6xl font-black text-gray-800">Game Over!</h2>
            <div className="mt-4 text-3xl text-blue-600 font-bold">Final Score: {score}</div>
          </div>
        )}

      </div>
    </div>
  );
}