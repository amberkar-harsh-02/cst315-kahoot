import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QuizBuilder() {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { text: '', option_red: '', option_blue: '', option_yellow: '', option_green: '', correct_option: 'red', time_limit_seconds: 15 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem('kahoot_token');

  useEffect(() => {
    if (!token) navigate('/');
  }, [token, navigate]);

  const addQuestion = () => {
    setQuestions([
      ...questions, 
      { text: '', option_red: '', option_blue: '', option_yellow: '', option_green: '', correct_option: 'red', time_limit_seconds: 15 }
    ]);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return alert("You must have at least one question.");
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const saveQuiz = async () => {
    if (!title.trim()) return alert("Please enter a quiz title.");
    
    // Quick validation to ensure no empty fields
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.option_red || !q.option_blue || !q.option_yellow || !q.option_green) {
        return alert(`Please fill out all fields in Question ${i + 1}`);
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/quizzes/builder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title, questions })
      });

      if (!res.ok) throw new Error('Failed to save quiz');
      
      alert("Quiz saved successfully!");
      navigate('/host');
    } catch (err) {
      alert(`Error: ${err.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-32">
      <div className="mx-auto max-w-4xl">
        
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
          <h1 className="text-4xl font-black text-gray-800">Quiz Builder</h1>
          <button onClick={() => navigate('/host')} className="rounded-lg border-2 border-gray-300 px-6 py-2 font-bold text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
        </div>

        {/* Title Input */}
        <div className="mb-10 rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
          <label className="mb-2 block text-sm font-bold text-gray-400 uppercase tracking-wider">Quiz Title</label>
          <input 
            type="text" 
            placeholder="e.g. CST 315 Midterm Review" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="w-full rounded-xl border-2 border-gray-200 p-4 text-3xl font-bold focus:border-blue-500 focus:outline-none" 
          />
        </div>

        {/* Questions List */}
        <div className="space-y-12">
          {questions.map((q, idx) => (
            <div key={idx} className="relative rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
              
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Question {idx + 1}</h2>
                <button onClick={() => removeQuestion(idx)} className="text-red-500 hover:underline font-bold">
                  Remove Question
                </button>
              </div>

              {/* Question Text */}
              <input 
                type="text" 
                placeholder="Type your question here..." 
                value={q.text} 
                onChange={(e) => updateQuestion(idx, 'text', e.target.value)} 
                className="mb-8 w-full rounded-xl border-2 border-gray-200 p-4 text-xl font-semibold focus:border-blue-500 focus:outline-none" 
              />

              {/* Grid for Options */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {['red', 'blue', 'yellow', 'green'].map((color) => (
                  <div key={color} className={`flex items-center rounded-xl p-2 border-4 ${q.correct_option === color ? 'border-gray-900 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: color === 'yellow' ? '#fde047' : color === 'red' ? '#fca5a5' : color === 'blue' ? '#93c5fd' : '#bbf7d0' }}>
                    
                    {/* Radio Button to select Correct Answer */}
                    <input 
                      type="radio" 
                      name={`correct_${idx}`} 
                      checked={q.correct_option === color} 
                      onChange={() => updateQuestion(idx, 'correct_option', color)} 
                      className="mx-4 h-6 w-6 cursor-pointer"
                    />
                    
                    <input 
                      type="text" 
                      placeholder={`${color.charAt(0).toUpperCase() + color.slice(1)} Option`} 
                      value={q[`option_${color}`]} 
                      onChange={(e) => updateQuestion(idx, `option_${color}`, e.target.value)} 
                      className="w-full bg-transparent p-3 text-lg font-bold text-gray-900 placeholder-gray-600 focus:outline-none" 
                    />
                  </div>
                ))}
              </div>
              <div className="text-center text-sm font-bold text-gray-500 mb-6">
                (Click the radio button next to the correct answer)
              </div>

              {/* Timer Setting */}
              <div className="flex items-center space-x-4 border-t border-gray-100 pt-6">
                <label className="font-bold text-gray-600">Time Limit (Seconds):</label>
                <select 
                  value={q.time_limit_seconds} 
                  onChange={(e) => updateQuestion(idx, 'time_limit_seconds', parseInt(e.target.value))}
                  className="rounded-lg border-2 border-gray-200 p-2 font-bold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>

            </div>
          ))}
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center space-x-6 bg-white border-t border-gray-200 p-6 shadow-2xl">
          <button onClick={addQuestion} className="rounded-xl bg-gray-200 px-8 py-4 text-xl font-bold text-gray-800 hover:bg-gray-300">
            + Add Another Question
          </button>
          <button onClick={saveQuiz} disabled={isSaving} className="rounded-xl bg-blue-600 px-12 py-4 text-xl font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save & Publish Quiz'}
          </button>
        </div>

      </div>
    </div>
  );
}