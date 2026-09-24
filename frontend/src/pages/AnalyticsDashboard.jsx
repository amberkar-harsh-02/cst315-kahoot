import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsDashboard() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const token = localStorage.getItem('kahoot_token');

  // Fetch all past sessions on load
  useEffect(() => {
    if (!token) { navigate('/'); return; }
    
    fetch('http://127.0.0.1:8000/sessions/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => { setSessions(data); setLoading(false); })
    .catch(err => { console.error(err); setLoading(false); });
  }, [token, navigate]);

  // Fetch detailed analytics for a specific session
  const viewSession = (sessionId) => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/analytics/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => { setSelectedSession(data); setLoading(false); })
    .catch(err => { console.error(err); setLoading(false); });
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-2xl font-bold text-gray-500">Loading Analytics...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        
        {/* Navigation Header */}
        <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
          <div className="flex items-center space-x-6">
            <h1 className="text-4xl font-black text-gray-800">Analytics</h1>
            {selectedSession && (
              <button onClick={() => setSelectedSession(null)} className="rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-300">
                &larr; Back to Archive
              </button>
            )}
          </div>
          <button onClick={() => navigate('/host')} className="rounded-lg border-2 border-gray-300 px-6 py-2 font-bold text-gray-700 hover:bg-gray-100">
            Exit to Dashboard
          </button>
        </div>

        {/* VIEW 1: Session Archive (Master List) */}
        {!selectedSession && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-700">Past Game Sessions</h2>
            {sessions.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center text-xl text-gray-500 shadow-sm">
                No past game sessions found. Host a game to generate data!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => (
                  <div key={session.id} onClick={() => viewSession(session.id)} className="cursor-pointer rounded-2xl bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md border border-gray-100">
                    <div className="mb-2 text-sm font-bold tracking-wider text-blue-500 uppercase">Room: {session.room_code}</div>
                    <h3 className="mb-4 text-2xl font-bold text-gray-800 truncate">{session.quiz_title}</h3>
                    <div className="text-gray-500">{session.player_count} Students Participated</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Detailed Session Report */}
        {selectedSession && (
          <div className="space-y-8">
            
            {/* Health Check (Overview Cards) */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Students</div>
                <div className="mt-2 text-4xl font-black text-gray-800">{selectedSession.overview.total_students}</div>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Class Average Score</div>
                <div className="mt-2 text-4xl font-black text-blue-600">{selectedSession.overview.average_score}</div>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Class Accuracy</div>
                <div className={`mt-2 text-4xl font-black ${selectedSession.overview.average_accuracy > 70 ? 'text-green-500' : 'text-red-500'}`}>
                  {selectedSession.overview.average_accuracy}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Question Breakdown (Identify struggle areas) */}
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Question Performance</h2>
                {selectedSession.questions.map((q, idx) => (
                  <div key={q.question_id} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                    <div className="mb-4 flex items-start justify-between">
                      <h3 className="text-xl font-bold text-gray-800"><span className="text-gray-400 mr-2">{idx + 1}.</span> {q.text}</h3>
                      <span className={`rounded-full px-4 py-1 text-sm font-bold ${q.accuracy > 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {q.accuracy}% Correct
                      </span>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div className="mb-4 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${q.accuracy}%` }}></div>
                    </div>

                    {/* Answer Spread */}
                    <div className="flex space-x-2">
                      <div className="flex-1 rounded bg-red-100 p-2 text-center text-sm font-bold text-red-700">1: {q.spread.red}</div>
                      <div className="flex-1 rounded bg-blue-100 p-2 text-center text-sm font-bold text-blue-700">2: {q.spread.blue}</div>
                      <div className="flex-1 rounded bg-yellow-100 p-2 text-center text-sm font-bold text-yellow-700">3: {q.spread.yellow}</div>
                      <div className="flex-1 rounded bg-green-100 p-2 text-center text-sm font-bold text-green-700">4: {q.spread.green}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Student Roster */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Student Roster</h2>
                <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="p-4 font-bold text-gray-600">Name</th>
                          <th className="p-4 font-bold text-gray-600">Score</th>
                          <th className="p-4 font-bold text-gray-600">Acc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedSession.students.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-800">{s.name}</td>
                            <td className="p-4 font-semibold text-blue-600">{s.final_score}</td>
                            <td className="p-4 font-semibold text-gray-600">{s.accuracy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}