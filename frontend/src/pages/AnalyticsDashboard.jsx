import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsDashboard() {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const token = localStorage.getItem('kahoot_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchAnalytics = async () => {
      try {
        // Adjust this endpoint if your FastAPI route is named differently
        const response = await fetch('http://127.0.0.1:8000/analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load analytics data');
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [navigate, token]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-800">Classroom Analytics</h1>
          <button onClick={() => navigate('/host')} className="text-blue-600 hover:underline">
            Back to Dashboard
          </button>
        </div>

        {error && <div className="mb-6 rounded bg-red-100 p-4 text-red-700">{error}</div>}
        
        {loading ? (
          <div className="text-center text-xl text-gray-500 animate-pulse">Loading past sessions...</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Quiz ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total Players</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No game sessions recorded yet.</td>
                  </tr>
                ) : (
                  sessions.map((session, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{new Date(session.created_at).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{session.quiz_id}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{session.player_count}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-green-600">{session.average_score}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}