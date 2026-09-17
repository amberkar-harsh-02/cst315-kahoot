import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HostDashboard() {
  const [quizId, setQuizId] = useState('1');
  const [roomCode, setRoomCode] = useState('');
  const [students, setStudents] = useState([]);
  const [gameState, setGameState] = useState('setup'); // setup, lobby, active, finished
  
  const ws = useRef(null);
  const navigate = useNavigate();

  // Protect the route: if no token exists, kick them back to login
  useEffect(() => {
    const token = localStorage.getItem('kahoot_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const startLobby = () => {
    const token = localStorage.getItem('kahoot_token');
    
    // Connect to the secure WebSocket endpoint using the JWT
    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/host/${quizId}?token=${token}`);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === 'room_created') {
        setRoomCode(data.room_code);
        setGameState('lobby');
      } 
      else if (data.event === 'player_joined') {
        setStudents((prev) => [...prev, data.student_name]);
      }
      else if (data.event === 'game_over') {
        setGameState('finished');
      }
    };

    ws.current.onclose = (event) => {
      if (event.code === 1008) {
        alert("Authentication failed. Professors only.");
        navigate('/login');
      }
    };
  };

  const startGame = () => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ event: 'start_game' }));
      setGameState('active');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow-lg">
        
        {/* State 1: Setup */}
        {gameState === 'setup' && (
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-800">Host a Game</h1>
            <input 
              type="number" 
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              className="mb-4 w-32 rounded border px-4 py-2 text-center text-xl"
              placeholder="Quiz ID"
            />
            <br />
            <button 
              onClick={startLobby}
              className="rounded-lg bg-purple-600 px-8 py-3 text-xl font-bold text-white hover:bg-purple-700"
            >
              Generate Room PIN
            </button>
          </div>
        )}

        {/* State 2: The Lobby */}
        {gameState === 'lobby' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-600">Join at <span className="font-bold text-blue-600">localhost:5173</span></h2>
            <div className="my-8 text-8xl font-black tracking-widest text-gray-900">
              {roomCode}
            </div>
            
            <div className="my-6 flex flex-wrap justify-center gap-3">
              {students.map((name, i) => (
                <span key={i} className="rounded-full bg-blue-100 px-4 py-2 text-lg font-medium text-blue-800">
                  {name}
                </span>
              ))}
            </div>

            <button 
              onClick={startGame}
              disabled={students.length === 0}
              className="mt-8 rounded-lg bg-green-500 px-10 py-4 text-2xl font-bold text-white hover:bg-green-600 disabled:opacity-50"
            >
              Start Game ({students.length} Players)
            </button>
          </div>
        )}

        {/* State 3: Active Game Placeholder */}
        {gameState === 'active' && (
          <div className="text-center text-3xl font-bold text-blue-600">
            Game is Active! (Question UI coming next)
          </div>
        )}
      </div>
    </div>
  );
}