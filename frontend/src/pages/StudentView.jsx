import { useState, useRef } from 'react';

export default function StudentView() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState('join'); // join, waiting, question_active, time_up, game_over
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lockedAnswer, setLockedAnswer] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);
  
  const ws = useRef(null);

  const joinGame = (e) => {
    e.preventDefault();
    setError('');

    // Connect to the student WebSocket endpoint
    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/student/${roomCode}?student_name=${encodeURIComponent(name)}`);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === 'join_success') {
        setGameState('waiting');
      } else if (data.error) {
        setError(data.error);
        ws.current.close();
      } else if (data.event === 'show_question') {
        setCurrentQuestion(data.question);
        setLockedAnswer(null); // Reset their lock for the new question
        setGameState('question_active');
      } else if (data.event === 'time_up') {
        setGameState('time_up');
      } else if (data.event === 'game_over') {
        setGameState('game_over');
      }
    };

    ws.current.onclose = () => {
      if (gameState !== 'game_over') {
        setError('Disconnected from the host.');
        setGameState('join');
      }
    };
  };

  const submitAnswer = (color) => {
    if (lockedAnswer) return; // The Instant Lock mechanic
    
    setLockedAnswer(color);
    
    // Simulate time remaining for now (we'll add a real timer later)
    const timeRemainingMs = currentQuestion.time_limit * 1000; 
    
    ws.current.send(JSON.stringify({
      event: 'submit_answer',
      selected_option: color,
      time_remaining_ms: timeRemainingMs 
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        
        {/* State 1: Join Screen */}
        {gameState === 'join' && (
          <form onSubmit={joinGame} className="flex flex-col space-y-6">
            <h1 className="text-center text-4xl font-black text-gray-800">Kahoot Clone</h1>
            
            {error && <div className="rounded bg-red-100 p-3 text-red-700">{error}</div>}
            
            <input 
              type="text" 
              required
              placeholder="Room PIN"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="rounded-lg border-2 border-gray-300 p-4 text-center text-2xl font-bold tracking-widest focus:border-blue-500 focus:outline-none"
            />
            <input 
              type="text" 
              required
              placeholder="Nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border-2 border-gray-300 p-4 text-center text-xl font-semibold focus:border-blue-500 focus:outline-none"
            />
            <button 
              type="submit"
              className="rounded-lg bg-gray-900 py-4 text-2xl font-bold text-white hover:bg-gray-800"
            >
              Enter
            </button>
          </form>
        )}

        {/* State 2: Waiting for Host */}
        {gameState === 'waiting' && (
          <div className="text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-800">You're in!</h2>
            <p className="text-xl text-gray-600">See your nickname on screen</p>
            <div className="mt-8 animate-pulse text-gray-400">Waiting for host to start...</div>
          </div>
        )}

        {/* State 3: Active Question Buttons */}
        {gameState === 'question_active' && (
          <div className="grid grid-cols-2 gap-4 h-80">
            {['red', 'blue', 'yellow', 'green'].map((color) => (
              <button
                key={color}
                onClick={() => submitAnswer(color)}
                disabled={lockedAnswer !== null}
                className={`rounded-lg transition-transform ${
                  lockedAnswer === color ? 'ring-8 ring-black ring-inset scale-95' : 'hover:scale-105'
                } ${lockedAnswer && lockedAnswer !== color ? 'opacity-50' : ''}`}
                style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color }}
              />
            ))}
          </div>
        )}

        {/* States 4 & 5: Post-Question */}
        {(gameState === 'time_up' || gameState === 'game_over') && (
          <div className="text-center text-2xl font-bold text-gray-800">
            {gameState === 'game_over' ? "Game Over! Look at the big screen." : "Time's up! Look at the big screen."}
          </div>
        )}
      </div>
    </div>
  );
}