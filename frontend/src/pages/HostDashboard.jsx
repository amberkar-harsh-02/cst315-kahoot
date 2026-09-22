import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HostDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [view, setView] = useState('dashboard'); // dashboard, lobby, question, leaderboard, game_over
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  
  // Game States
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  const ws = useRef(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('kahoot_token');

  // Load Professor's Quizzes
  useEffect(() => {
    if (!token) { navigate('/'); return; }
    
    fetch('http://127.0.0.1:8000/quizzes/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setQuizzes(data))
    .catch(err => console.error(err));
  }, [token, navigate]);

  // Timer Logic (Feature 5)
  useEffect(() => {
    if (view === 'question' && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (view === 'question' && timeLeft === 0) {
      ws.current.send(JSON.stringify({ event: 'time_up' }));
    }
  }, [timeLeft, view]);

  const hostGame = (quizId) => {
    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/host/${quizId}?token=${token}`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.event === 'room_created') {
        setRoomCode(data.room_code);
        setView('lobby');
      } else if (data.event === 'player_joined') {
        setPlayers(prev => [...prev, data.student_name]);
        setTotalPlayers(data.total_players);
      } else if (data.event === 'show_question') {
        setCurrentQuestion(data.question);
        setTimeLeft(data.question.time_limit);
        setAnswersCount(0);
        setView('question');
      } else if (data.event === 'answer_received') {
        setAnswersCount(data.answers_submitted);
        setTotalPlayers(data.total_players);
      } else if (data.event === 'leaderboard') {
        // Feature 4: Top 3 People Displayed
        setLeaderboard(data.top_players.slice(0, 3)); 
        setView('leaderboard');
      } else if (data.event === 'game_over') {
        setView('game_over');
      }
    };
  };

  const startGame = () => ws.current.send(JSON.stringify({ event: 'start_game' }));
  const nextQuestion = () => ws.current.send(JSON.stringify({ event: 'next_question' }));
  const showLeaderboard = () => ws.current.send(JSON.stringify({ event: 'show_leaderboard' }));
  const endGame = () => ws.current.send(JSON.stringify({ event: 'end_game' }));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-8">
      
      {/* 1. Professor Quiz Dashboard (Feature 2) */}
      {view === 'dashboard' && (
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-10 flex items-center justify-between border-b pb-6">
            <h1 className="text-4xl font-black text-gray-800">My Quizzes</h1>
            <div className="space-x-4">
              <button onClick={() => navigate('/create')} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
                + Create New Quiz
              </button>
              <button onClick={() => { localStorage.removeItem('kahoot_token'); navigate('/'); }} className="text-gray-500 hover:underline">
                Log Out
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.length === 0 ? (
              <div className="col-span-full rounded-xl bg-white p-12 text-center text-xl text-gray-500 shadow-sm">
                You haven't created any quizzes yet. Click the blue button above to get started!
              </div>
            ) : (
              quizzes.map((quiz) => (
                <div key={quiz.id} className="flex flex-col rounded-2xl bg-white p-8 shadow-md transition-transform hover:-translate-y-1">
                  <h2 className="mb-4 text-2xl font-bold text-gray-800">{quiz.title}</h2>
                  <p className="mb-8 text-gray-500">{quiz.questions.length} Questions</p>
                  <div className="mt-auto flex flex-col space-y-3">
                    <button onClick={() => hostGame(quiz.id)} className="rounded-lg bg-green-500 py-3 font-bold text-white hover:bg-green-600">
                      Host Game
                    </button>
                    {/* Add questions button route placeholder */}
                    <button className="rounded-lg border-2 border-gray-200 py-3 font-bold text-gray-600 hover:bg-gray-50">
                      Edit Quiz
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Game Lobby */}
      {view === 'lobby' && (
        <div className="flex flex-grow flex-col items-center justify-center text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-600">Join at <span className="text-blue-600">localhost:5173</span></h2>
          <div className="mb-10 text-9xl font-black tracking-widest text-gray-900">{roomCode}</div>
          <button onClick={startGame} className="mb-10 rounded-xl bg-green-500 px-12 py-5 text-3xl font-bold text-white shadow-lg hover:bg-green-600">
            Start Game ({totalPlayers} Players)
          </button>
          <div className="flex max-w-4xl flex-wrap justify-center gap-4">
            {players.map((p, idx) => (
              <span key={idx} className="rounded-full bg-blue-100 px-6 py-2 text-xl font-semibold text-blue-800">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Question View (Features 4 & 5) */}
      {view === 'question' && currentQuestion && (
        <div className="flex flex-grow flex-col">
          <div className="mb-8 flex items-center justify-between rounded-2xl bg-white p-8 shadow-md">
            <h2 className="text-4xl font-bold text-gray-800">{currentQuestion.text}</h2>
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Answers</div>
                <div className="text-4xl font-black text-blue-600">{answersCount} / {totalPlayers}</div>
              </div>
              <div className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl font-black text-white ${timeLeft <= 5 ? 'bg-red-500 animate-pulse' : 'bg-gray-800'}`}>
                {timeLeft}
              </div>
            </div>
          </div>
          
          <div className="grid flex-grow grid-cols-2 gap-6">
            {['red', 'blue', 'yellow', 'green'].map((color) => (
              <div key={color} className="flex items-center justify-center rounded-2xl p-8 text-4xl font-bold text-white shadow-md" style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color }}>
                {currentQuestion.options[color]}
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-end">
            <button onClick={showLeaderboard} className="rounded-xl bg-gray-900 px-10 py-4 text-xl font-bold text-white hover:bg-gray-800">
              Skip Timer & Show Leaderboard
            </button>
          </div>
        </div>
      )}

      {/* 4. Top 3 Leaderboard (Feature 4) */}
      {view === 'leaderboard' && (
        <div className="mx-auto flex w-full max-w-4xl flex-grow flex-col justify-center">
          <h2 className="mb-12 text-center text-6xl font-black text-gray-800">Top 3 Leaderboard</h2>
          <div className="space-y-6">
            {leaderboard.length === 0 ? (
              <p className="text-center text-2xl text-gray-500">No scores yet!</p>
            ) : (
              leaderboard.map((player, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-2xl bg-white p-8 shadow-md">
                  <div className="flex items-center space-x-6">
                    <span className="text-4xl font-black text-gray-400">#{idx + 1}</span>
                    <span className="text-3xl font-bold text-gray-800">{player.name}</span>
                  </div>
                  <span className="text-3xl font-black text-blue-600">{player.score} pts</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-12 flex justify-center space-x-6">
            <button onClick={nextQuestion} className="rounded-xl bg-blue-600 px-12 py-5 text-2xl font-bold text-white hover:bg-blue-700">Next Question</button>
            <button onClick={endGame} className="rounded-xl bg-red-500 px-12 py-5 text-2xl font-bold text-white hover:bg-red-600">End Game</button>
          </div>
        </div>
      )}

      {/* 5. Game Over */}
      {view === 'game_over' && (
        <div className="flex flex-grow flex-col items-center justify-center text-center">
          <h2 className="mb-6 text-7xl font-black text-gray-800">Game Over!</h2>
          <p className="mb-12 text-2xl text-gray-600">Scores have been saved to the database.</p>
          <button onClick={() => setView('dashboard')} className="rounded-xl bg-blue-600 px-12 py-5 text-2xl font-bold text-white hover:bg-blue-700">
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}