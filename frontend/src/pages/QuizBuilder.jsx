import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QuizBuilder() {
  const [quizTitle, setQuizTitle] = useState('');
  const [quizId, setQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // Current Question Form State
  const [text, setText] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [options, setOptions] = useState({ red: '', blue: '', yellow: '', green: '' });
  const [correctOption, setCorrectOption] = useState('red');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const token = localStorage.getItem('kahoot_token');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [navigate, token]);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/quizzes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: quizTitle })
      });
      if (!response.ok) throw new Error('Failed to create quiz');
      const data = await response.json();
      setQuizId(data.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        text: text,
        option_red: options.red,
        option_blue: options.blue,
        option_yellow: options.yellow,
        option_green: options.green,
        correct_option: correctOption,
        time_limit_seconds: parseInt(timeLimit),
        quiz_id: quizId
      };

      const response = await fetch(`http://127.0.0.1:8000/quizzes/${quizId}/questions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Failed to add question');
      const newQuestion = await response.json();
      
      setQuestions([...questions, newQuestion]);
      
      // Reset form for the next question
      setText('');
      setOptions({ red: '', blue: '', yellow: '', green: '' });
      setCorrectOption('red');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-800">Quiz Builder</h1>
          <button onClick={() => navigate('/host')} className="text-blue-600 hover:underline">
            Back to Dashboard
          </button>
        </div>

        {error && <div className="mb-6 rounded bg-red-100 p-4 text-red-700">{error}</div>}

        {/* Step 1: Create the Quiz */}
        {!quizId ? (
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div>
              <label className="block text-lg font-medium text-gray-700">Quiz Title</label>
              <input
                type="text"
                required
                className="mt-2 w-full rounded-md border border-gray-300 p-3 text-xl focus:border-blue-500 focus:outline-none"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="e.g., CST 315 Midterm Review"
              />
            </div>
            <button type="submit" className="rounded-lg bg-blue-600 px-8 py-3 text-white hover:bg-blue-700">
              Create Quiz
            </button>
          </form>
        ) : (
          /* Step 2: Add Questions */
          <div>
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-800">
              <span className="font-bold">✓ Quiz Created!</span> (ID: {quizId}) - Now adding questions.
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-6 border-b border-gray-200 pb-8">
              <div>
                <label className="block font-medium text-gray-700">Question Text</label>
                <input type="text" required className="mt-1 w-full rounded border p-2 text-xl" value={text} onChange={(e) => setText(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'yellow', 'green'].map((color) => (
                  <div key={color}>
                    <label className="block font-medium capitalize text-gray-700">{color} Option</label>
                    <input type="text" required className={`mt-1 w-full rounded border p-2 border-${color}-400 bg-${color}-50`} value={options[color]} onChange={(e) => setOptions({ ...options, [color]: e.target.value })} />
                  </div>
                ))}
              </div>

              <div className="flex gap-6">
                <div className="w-1/2">
                  <label className="block font-medium text-gray-700">Correct Answer</label>
                  <select className="mt-1 w-full rounded border p-2 capitalize" value={correctOption} onChange={(e) => setCorrectOption(e.target.value)}>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="yellow">Yellow</option>
                    <option value="green">Green</option>
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="block font-medium text-gray-700">Time Limit (Seconds)</label>
                  <input type="number" min="5" max="120" required className="mt-1 w-full rounded border p-2" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
                </div>
              </div>

              <button type="submit" className="w-full rounded-lg bg-gray-900 py-3 font-bold text-white hover:bg-gray-800">
                Add Question
              </button>
            </form>

            {/* Question List Preview */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-800">Questions Added ({questions.length})</h2>
              <ul className="mt-4 space-y-3">
                {questions.map((q, idx) => (
                  <li key={idx} className="rounded border bg-gray-50 p-4 shadow-sm">
                    <span className="font-bold">{idx + 1}.</span> {q.text} <span className="ml-2 text-sm text-gray-500">({q.time_limit_seconds}s)</span>
                  </li>
                ))}
              </ul>
              {questions.length > 0 && (
                <button onClick={() => navigate('/host')} className="mt-6 rounded bg-green-600 px-8 py-3 text-white hover:bg-green-700">
                  Finish & Go to Dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}