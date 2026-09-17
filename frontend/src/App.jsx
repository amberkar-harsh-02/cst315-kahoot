import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StudentView from './pages/StudentView';
import HostDashboard from './pages/HostDashboard';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 font-sans">
        <Routes>
          {/* Default route is the student join screen */}
          <Route path="/" element={<StudentView />} />
          
          {/* Auth and Instructor routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/host" element={<HostDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;