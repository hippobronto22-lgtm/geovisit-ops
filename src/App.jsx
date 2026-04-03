import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Calendar as CalendarIcon, MapPin, Users, Briefcase, 
  LogOut, CheckCircle, XCircle, AlertCircle, Play, Square, Map, Plus, 
  ChevronLeft, ChevronRight, Menu, X, UserPlus, Lock, User, Trash2, Search, Edit, FileText, Filter, RotateCcw,
  Newspaper, BookOpen, Database, Download, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered
} from 'lucide-react';

// Import konfigurasi Firebase
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- DATA MASTER AWAL (Hanya untuk inisialisasi jika database kosong) ---
const INITIAL_USERS = [
  { id: 'u1', name: 'Budi (Superadmin)', role: 'superadmin', username: 'superadmin', password: 'password123', division: 'Sistem' },
  { id: 'u2', name: 'Siti (Admin)', role: 'admin', username: 'admin', password: 'password123', division: 'Cleaning Service' },
  { id: 'u3', name: 'Andi (Manager)', role: 'manager', username: 'manager', password: 'password123', division: 'Cleaning Service' },
  { id: 'u4', name: 'Dewi (Staff 1)', role: 'staff', username: 'dewi', password: 'password123', managerId: 'u3', division: 'Cleaning Service', locationIds: ['loc1'] },
  { id: 'u5', name: 'Reza (Staff 2)', role: 'staff', username: 'reza', password: 'password123', managerId: 'u3', division: 'Cleaning Service', locationIds: ['loc1', 'loc3'] },
  { id: 'u6', name: 'PT. Maju Jaya (Client)', role: 'client', username: 'client1', password: 'password123', locationIds: ['loc1', 'loc2'] },
];

const INITIAL_DIVISIONS = [
  { id: 'div1', name: 'Security' },
  { id: 'div2', name: 'Cleaning Service' },
  { id: 'div3', name: 'Labor Supply' },
  { id: 'div4', name: 'Sistem' },
];

const INITIAL_ACTIONS = [
  { id: 'act1', name: 'Visit Reguler' },
  { id: 'act2', name: 'Meeting Offline' },
  { id: 'act3', name: 'Meeting Online' },
  { id: 'act4', name: 'Tanda Tangan PKWT' },
  { id: 'act5', name: 'Sosialisasi' },
  { id: 'act6', name: 'Issue Project' },
];

// Helper: Get Local Date Strings (Prevent UTC timezone offset bugs)
const getLocalYYYYMMDD = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getTodayStr = () => getLocalYYYYMMDD(new Date());

// Helper: File to Base64 String
const getBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Strip HTML for PDF Export
const stripHtml = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

// --- UTILS: GPS & Distance ---
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

// --- COMPONENTS ---

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  
  // App State (Semua ditarik dari Firebase)
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]); 
  const [visits, setVisits] = useState([]);
  
  const [newsList, setNewsList] = useState([]); 
  const [materialsList, setMaterialsList] = useState([]);
  const [sopsList, setSopsList] = useState([]);
  
  const [divisions, setDivisions] = useState([]);
  const [actions, setActions] = useState([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Efek untuk menarik SEMUA data dari Firebase secara realtime
  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, 'projects'), snap => setProjects(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubVisits = onSnapshot(collection(db, 'visits'), snap => setVisits(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubNews = onSnapshot(collection(db, 'news'), snap => setNewsList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubMaterials = onSnapshot(collection(db, 'materials'), snap => setMaterialsList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubSops = onSnapshot(collection(db, 'sops'), snap => setSopsList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubDivisions = onSnapshot(collection(db, 'divisions'), snap => setDivisions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubActions = onSnapshot(collection(db, 'actions'), snap => setActions(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => {
      unsubProjects(); unsubUsers(); unsubVisits(); unsubNews(); 
      unsubMaterials(); unsubSops(); unsubDivisions(); unsubActions();
    };
  }, []);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    // AUTO-SEED
    if (users.length === 0 && loginUsername === 'superadmin' && loginPassword === 'password123') {
      try {
        alert("Mendeteksi database baru. Sistem sedang mengunggah data Master (User, Divisi, Action)... Mohon tunggu sebentar.");
        for (const u of INITIAL_USERS) await setDoc(doc(db, 'users', u.id), u);
        for (const d of INITIAL_DIVISIONS) await setDoc(doc(db, 'divisions', d.id), d);
        for (const a of INITIAL_ACTIONS) await setDoc(doc(db, 'actions', a.id), a);
        
        alert("Selesai! Silakan klik tombol 'Masuk Sistem' sekali lagi.");
        return;
      } catch (err) {
        alert("Gagal inisialisasi: " + err.message);
        return;
      }
    }

    const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
    if (user) {
      setCurrentUser(user);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Username atau password salah.');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.3)] p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-2xl shadow-lg text-white transform -translate-y-12 mb-[-3rem]">
              <MapPin size={36} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-2 tracking-tight">GeoVisit <span className="text-blue-600">Ops</span></h1>
          <p className="text-center text-slate-500 mb-8 text-sm">Operation & Attendance Management</p>
          
          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0" />
              <p>{loginError}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 pb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder="Masukkan username Anda"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50">
                Masuk Sistem
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'manager', 'staff', 'client'] },
    { id: 'my-visits', label: 'Tugas Saya', icon: MapPin, roles: ['staff'] },
    { id: 'calendar', label: 'Kalender', icon: CalendarIcon, roles: ['superadmin', 'admin', 'manager', 'client', 'staff'] },
    { id: 'visits', label: 'Jadwal Visit', icon: CalendarIcon, roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { id: 'users', label: 'Data User', icon: Users, roles: ['superadmin', 'admin'] },
    { id: 'projects', label: 'Data Project', icon: Briefcase, roles: ['superadmin', 'admin'] },
    { id: 'reports', label: 'Laporan', icon: FileText, roles: ['superadmin', 'admin', 'manager', 'client'] },
    { id: 'news', label: 'Berita', icon: Newspaper, roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { id: 'materials', label: 'Materi & SOP', icon: BookOpen, roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { id: 'master-data', label: 'Master Data', icon: Database, roles: ['superadmin'] },
  ];

  const allowedNavItems = navItems.filter(item => item.roles.includes(currentUser.role));

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView visits={visits} projects={projects} currentUser={currentUser} />;
      case 'calendar': return <CalendarView visits={visits} projects={projects} />;
      case 'projects': return <ProjectsView projects={projects} visits={visits} />;
      case 'visits': return <VisitsView visits={visits} projects={projects} staffs={users.filter(u=>u.role==='staff')} currentUser={currentUser} actions={actions} />;
      case 'users': return <UsersManagementView users={users} currentUser={currentUser} projects={projects} divisions={divisions} />;
      case 'reports': return <ReportsView visits={visits} projects={projects} staffs={users.filter(u=>u.role==='staff')} currentUser={currentUser} actions={actions} />;
      case 'my-visits': return <StaffVisitsView visits={visits} projects={projects} currentUser={currentUser} />;
      case 'news': return <NewsView newsList={newsList} currentUser={currentUser} />;
      case 'materials': return <MaterialsView materialsList={materialsList} sopsList={sopsList} currentUser={currentUser} />;
      case 'master-data': return <MasterDataView divisions={divisions} actions={actions} />;
      default: return <DashboardView visits={visits} projects={projects} currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-blue-200">
      <style>{`
        /* Global Reset for Rich Text Editor Styles */
        .rich-text-content ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .rich-text-content ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .rich-text-content p { margin-bottom: 0.5rem !important; }
        .rich-text-content b { font-weight: 800 !important; }
        .rich-text-content i { font-style: italic !important; }
        .rich-text-content u { text-decoration: underline !important; }
      `}</style>
      
      {/* Mobile Navbar */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-20 sticky top-0 shadow-md">
        <div className="flex items-center gap-2 font-bold text-xl"><MapPin className="text-blue-400" /> GeoVisit</div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg active:scale-95 transition-transform">{isSidebarOpen ? <X /> : <Menu />}</button>
      </div>

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-72 bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out z-30 flex flex-col border-r border-slate-800`}>
        <div className="p-6 hidden md:flex items-center gap-3 font-extrabold text-2xl text-white border-b border-slate-800">
          <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><MapPin size={24} /></div>
          GeoVisit
        </div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Logged in as</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-white leading-tight">{currentUser.name.split(' ')[0]}</div>
              <div className="text-xs text-blue-400 capitalize font-medium">{currentUser.role}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {allowedNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 active:scale-[0.98] ${
                  isActive 
                    ? 'bg-blue-600/15 text-blue-400 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-blue-500' : ''} />
                <span>{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 font-medium transition-all active:scale-95">
            <LogOut size={20} /><span>Logout Account</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden bg-slate-50/50">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 py-5 sticky top-0 z-10 hidden md:flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-800 capitalize tracking-tight">
            {allowedNavItems.find(i => i.id === currentView)?.label}
          </h2>
          <div className="text-sm font-medium text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">{renderView()}</main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
    </div>
  );
}

// ==========================================
// VIEWS COMPONENTS
// ==========================================

function DashboardView({ visits, projects, currentUser }) {
  const today = getTodayStr();
  let relevantVisits = visits;
  
  if (currentUser.role === 'staff') {
    relevantVisits = visits.filter(v => v.staffIds && v.staffIds.includes(currentUser.id));
  } else if (currentUser.role === 'client') {
    relevantVisits = visits.filter(v => currentUser.locationIds?.includes(v.locationId));
  } else if (currentUser.role === 'manager') {
    relevantVisits = visits;
  }

  const todayVisits = relevantVisits.filter(v => v.date === today);
  const scheduledCount = todayVisits.filter(v => v.status === 'scheduled').length;
  const ongoingCount = todayVisits.filter(v => v.status === 'ongoing').length;
  const completedCount = todayVisits.filter(v => v.status === 'completed').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Visit Hari Ini" value={todayVisits.length} icon={CalendarIcon} color="blue" />
        <StatCard title="Sedang Berjalan" value={ongoingCount} icon={Play} color="yellow" />
        <StatCard title="Selesai (Completed)" value={completedCount} icon={CheckCircle} color="green" />
        <StatCard title="Pending / Terjadwal" value={scheduledCount} icon={AlertCircle} color="slate" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/60 p-7">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Aktivitas Terbaru Hari Ini</h3>
          <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-full">{todayVisits.length} Jadwal</span>
        </div>
        
        {todayVisits.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CalendarIcon size={48} className="mb-4 opacity-50" />
            <p className="font-medium text-slate-500">Tidak ada jadwal visit untuk hari ini.</p>
            <p className="text-sm mt-1">Anda bisa bersantai atau mengecek jadwal besok.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayVisits.map(visit => {
              const project = projects.find(p => p.id === visit.projectId);
              const location = project?.locations?.find(l => l.id === visit.locationId);
              return (
                <div key={visit.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-100 hover:border-blue-100 rounded-xl bg-slate-50/50 hover:bg-blue-50/30 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3.5 rounded-xl shadow-sm ${
                      visit.status === 'completed' ? 'bg-green-100 text-green-600' :
                      visit.status === 'ongoing' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">{project?.name || 'Project Dihapus'}</h4>
                      <p className="text-sm font-medium text-slate-600">{location?.name || '-'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><CalendarIcon size={12}/> {visit.startTime} - {visit.endTime}</p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 items-end justify-end">
                    <StatusBadge status={visit.status} />
                    <ActionBadge action={visit.action} className="rounded-md shadow-sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({ visits, projects }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/60 p-7 flex flex-col min-h-[750px] animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {currentDate.toLocaleString('id-ID', { month: 'long' })} <span className="text-blue-600">{currentDate.getFullYear()}</span>
          </h3>
          <p className="text-slate-500 text-sm font-medium mt-1">Jadwal Operasional Keseluruhan</p>
        </div>
        <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 rounded-lg bg-white shadow-sm hover:shadow font-bold text-sm text-slate-700 transition-all active:scale-95">Hari Ini</button>
          <div className="w-px h-6 bg-slate-300 mx-1"></div>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-95"><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-95"><ChevronRight size={20} /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 border border-slate-200 rounded-xl overflow-hidden flex-1 bg-slate-50/50 shadow-inner">
        {['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((day, idx) => (
          <div key={day} className={`text-center py-4 font-bold text-[10px] sm:text-xs tracking-widest border-b border-slate-200 ${idx === 0 || idx === 6 ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500 bg-slate-100/50'}`}>
            {day}
          </div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[120px] p-2 border-r border-b border-slate-200 bg-slate-100/30"></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayVisits = visits.filter(v => v.date === dateStr);
          const isToday = dateStr === getTodayStr();

          return (
            <div key={day} className={`min-h-[130px] p-1.5 border-r border-b border-slate-200 relative transition-colors hover:bg-white group ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}>
              <div className="flex justify-end mb-2 mt-1 mr-1">
                <span className={`text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 group-hover:bg-slate-100'}`}>
                  {day}
                </span>
              </div>
              <div className="space-y-1.5 px-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                {dayVisits.map(visit => {
                  const proj = projects.find(p => p.id === visit.projectId);
                  let bgClass = 'bg-slate-50 text-slate-700 border-slate-200 border-l-slate-500 hover:bg-slate-100';
                  if (visit.status === 'scheduled') bgClass = 'bg-blue-50 text-blue-700 border-blue-200 border-l-blue-500 hover:bg-blue-100';
                  if (visit.status === 'ongoing') bgClass = 'bg-yellow-50 text-yellow-700 border-yellow-200 border-l-yellow-500 hover:bg-yellow-100';
                  if (visit.status === 'completed') bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 border-l-emerald-500 hover:bg-emerald-100';
                  
                  return (
                    <div key={visit.id} className={`text-[10px] px-2 py-1.5 rounded-md border border-l-[3px] truncate cursor-pointer transition-colors shadow-sm ${bgClass}`} title={`${proj?.name || 'Project Dihapus'} (${visit.startTime}) - ${visit.action}`}>
                      <span className="font-bold block mb-0.5">{visit.startTime}</span> 
                      <span className="opacity-90">{proj?.name || 'Unknown'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsView({ projects, visits }) {
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [locations, setLocations] = useState([{ name: '', address: '', lat: '', lng: '', radius: 100 }]);
  const [mapModal, setMapModal] = useState({ isOpen: false, index: null });
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchTimeout = useRef(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLocations([{ name: '', address: '', lat: '', lng: '', radius: 100 }]);
  };

  const handleEdit = (project) => {
    setEditingId(project.id);
    setName(project.name);
    setLocations(project.locations ? project.locations.map(loc => ({ ...loc })) : []);
    setActiveTab('form');
  };

  const handleDelete = async (projectId) => {
    const hasVisits = visits?.some(v => v.projectId === projectId);
    const msg = hasVisits 
      ? "Peringatan: Project ini memiliki jadwal visit aktif. Yakin ingin menghapus seluruh data project beserta lokasinya?" 
      : "Yakin ingin menghapus project ini?";
      
    if (window.confirm(msg)) {
      try {
        await deleteDoc(doc(db, "projects", projectId));
      } catch (error) {
        alert("Gagal menghapus project dari database: " + error.message);
      }
    }
  };

  const addLocationRow = () => setLocations([...locations, { name: '', address: '', lat: '', lng: '', radius: 100 }]);
  const removeLocationRow = (index) => setLocations(locations.filter((_, i) => i !== index));
  const updateLocation = (index, field, value) => {
    const newLocs = [...locations];
    newLocs[index][field] = value;
    setLocations(newLocs);
  };

  const fetchAddressFromCoordinates = async (lat, lng, index) => {
    setIsFetchingAddress(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) updateLocation(index, 'address', data.display_name);
    } catch (error) {
      alert("Gagal menarik data alamat otomatis. Anda bisa mengisinya manual.");
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setMapSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingMap(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5`);
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearchingMap(false);
      }
    }, 600);
  };

  const selectSuggestion = (s) => {
    const lat = parseFloat(s.lat).toFixed(5);
    const lng = parseFloat(s.lon).toFixed(5);
    updateLocation(mapModal.index, 'lat', lat);
    updateLocation(mapModal.index, 'lng', lng);
    updateLocation(mapModal.index, 'address', s.display_name);
    setSuggestions([]);
    setMapSearchQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mappedLocations = locations.map((loc, i) => ({
      id: loc.id || `loc${Date.now()}_${i}`,
      name: loc.name || "",
      address: loc.address || "",
      lat: parseFloat(loc.lat) || 0,
      lng: parseFloat(loc.lng) || 0,
      radius: parseInt(loc.radius) || 100,
    }));

    try {
      const projectData = { name: name || "", locations: mappedLocations };
      if (editingId) {
        await setDoc(doc(db, "projects", editingId), projectData);
        alert("Data Project berhasil diperbarui di database!");
      } else {
        const newId = `p${Date.now()}`;
        await setDoc(doc(db, "projects", newId), projectData);
        alert("Project dan Lokasi berhasil ditambahkan ke database!");
      }
      resetForm(); setActiveTab('list');
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan ke database: " + error.message);
    }
  };

  const filteredProjects = projects.filter(p => {
    const nameMatch = p.name ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const locMatch = p.locations ? p.locations.some(l => 
      (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (l.address && l.address.toLowerCase().includes(searchQuery.toLowerCase()))
    ) : false;
    return nameMatch || locMatch;
  });
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Manajemen Data Project</h3>
          <p className="text-slate-500 text-sm mt-1">Kelola proyek dan titik lokasi absensi (GPS Radius).</p>
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daftar Project</button>
        <button onClick={() => { setActiveTab('form'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'form' && !editingId ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tambah Project Baru</button>
        {editingId && (
          <button className="py-2.5 px-6 font-bold text-sm rounded-lg bg-orange-100 text-orange-600 shadow-sm">Edit Project</button>
        )}
      </div>

      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <h4 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
              <Briefcase className="text-blue-500" />
              {editingId ? 'Edit Data Project' : 'Buat Project Baru'}
            </h4>
            {editingId && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Mode Edit</span>}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-bold text-slate-700 mb-2">Nama Project Utama</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="Contoh: Maintenance Mall Group" />
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
              <div>
                <h5 className="font-bold text-lg text-slate-800">Daftar Lokasi / Cabang</h5>
                <p className="text-slate-500 text-xs mt-1">Tentukan titik kordinat agar staff bisa Check-in GPS.</p>
              </div>
              <button type="button" onClick={addLocationRow} className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 active:scale-95"><Plus size={16}/> Tambah Lokasi</button>
            </div>
            
            <div className="space-y-4">
              {locations.map((loc, idx) => (
                <div key={idx} className="flex flex-col xl:flex-row gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors group relative">
                  <div className="absolute -left-3 -top-3 w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white">{idx + 1}</div>
                  
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Nama Cabang / Lokasi</label>
                      <input type="text" placeholder="Contoh: Cabang Sudirman" value={loc.name} onChange={e => updateLocation(idx, 'name', e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Alamat Lengkap</label>
                      <input type="text" placeholder="Jalan, Kota, Kode Pos" value={loc.address} onChange={e => updateLocation(idx, 'address', e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                    </div>
                  </div>
                  
                  <div className="w-full xl:w-80 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Latitude</label>
                        <input type="number" step="any" placeholder="Lat" value={loc.lat} onChange={e => updateLocation(idx, 'lat', e.target.value)} required className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Longitude</label>
                        <input type="number" step="any" placeholder="Lng" value={loc.lng} onChange={e => updateLocation(idx, 'lng', e.target.value)} required className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <button type="button" onClick={() => { setMapSearchQuery(''); setMapModal({ isOpen: true, index: idx }); }} className="bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 flex-1 justify-center transition-colors active:scale-95"><Map size={14} /> Buka Peta</button>
                      <div className="w-20">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Radius (m)</label>
                        <input type="number" placeholder="100" value={loc.radius} onChange={e => updateLocation(idx, 'radius', e.target.value)} required className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none text-center" />
                      </div>
                    </div>
                  </div>
                  
                  {locations.length > 1 && (
                    <button type="button" onClick={() => removeLocationRow(idx)} className="text-red-500 bg-red-50 hover:bg-red-500 hover:text-white p-2 rounded-lg shrink-0 h-fit self-start xl:self-center transition-colors active:scale-95" title="Hapus Lokasi Ini"><Trash2 size={18} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex gap-3 pt-6 border-t border-slate-100">
            <button type="submit" className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${editingId ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}>
              {editingId ? 'Simpan Perubahan' : 'Simpan Seluruh Data Project'}
            </button>
            {editingId && <button type="button" onClick={() => { resetForm(); setActiveTab('list'); }} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95">Batal Edit</button>}
          </div>
        </form>
      )}

      {activeTab === 'list' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
            <input type="text" placeholder="Cari nama project, cabang, atau alamat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 shadow-sm flex flex-col items-center justify-center">
              <Briefcase size={48} className="text-slate-300 mb-4" />
              <h4 className="text-lg font-bold text-slate-700 mb-1">{projects.length === 0 ? "Belum ada project di database." : "Pencarian tidak ditemukan."}</h4>
              <p className="text-sm">Klik tombol 'Tambah Project Baru' untuk mulai mengelola lokasi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProjects.map(project => (
                <div key={project.id} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200/80 overflow-hidden flex flex-col relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(project)} className="p-2 bg-white shadow-sm border border-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg active:scale-95 transition-all" title="Edit Project"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(project.id)} className="p-2 bg-white shadow-sm border border-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg active:scale-95 transition-all" title="Hapus Project"><Trash2 size={16} /></button>
                  </div>

                  <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white border-b border-slate-100">
                    <div className="flex items-center gap-4 pr-20">
                      <div className="p-3.5 bg-blue-600 text-white shadow-md shadow-blue-500/30 rounded-xl"><Briefcase size={24} /></div>
                      <div>
                        <h4 className="text-xl font-extrabold text-slate-800">{project.name}</h4>
                        <p className="text-sm font-medium text-slate-500">{project.id}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 flex-1 bg-white">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daftar Lokasi Cabang</h5>
                      <span className="text-[10px] font-bold bg-slate-100 px-2.5 py-1 rounded-md text-slate-600 border border-slate-200">{project.locations?.length || 0} Titik</span>
                    </div>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {project.locations && project.locations.map(loc => (
                        <div key={loc.id} className="bg-slate-50 hover:bg-blue-50/30 transition-colors p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mt-0.5"><MapPin size={16} className="text-blue-500" /></div>
                          <div>
                            <p className="font-bold text-slate-700">{loc.name}</p>
                            <p className="text-slate-500 text-xs mb-2 leading-relaxed">{loc.address}</p>
                            <div className="flex gap-2">
                              <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">📍 {loc.lat}, {loc.lng}</span>
                              <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-slate-200 text-emerald-600">Radius: {loc.radius || 100}m</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL MAP PICKER (OSM Iframe & Suggestion) */}
      {mapModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg"><Map className="text-blue-600"/> Peta Interaktif</h3>
              <button onClick={() => setMapModal({ isOpen: false, index: null })} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="text-slate-500" /></button>
            </div>
            <div className="p-4 bg-blue-50/50 text-sm text-blue-800 border-b border-blue-100 flex gap-3">
              <AlertCircle className="shrink-0 text-blue-600 mt-0.5" size={18} /> 
              <p className="leading-relaxed">Simulasi peta untuk menentukan titik koordinat GPS. Gunakan kolom pencarian untuk mencari lokasi spesifik. <b>Alamat akan otomatis ditarik dari satelit.</b></p>
            </div>
            
            <div className="p-4 bg-white border-b flex gap-3 items-center shadow-sm relative z-10">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div>
                <input
                  type="text" placeholder="Ketik nama gedung, jalan, atau kota untuk sugesti..." value={mapSearchQuery} onChange={handleSearchInput}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <div key={i} onClick={() => selectSuggestion(s)} className="px-4 py-3 hover:bg-blue-50 border-b border-slate-100 cursor-pointer text-sm text-slate-700 flex flex-col">
                        <span className="font-bold">{s.name || s.display_name.split(',')[0]}</span>
                        <span className="text-xs text-slate-500 truncate">{s.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { if(suggestions.length > 0) selectSuggestion(suggestions[0]) }} disabled={isSearchingMap || suggestions.length === 0} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap active:scale-95 transition-all shadow-sm">
                {isSearchingMap ? 'Mencari...' : 'Pilih Teratas'}
              </button>
            </div>

            <div className="h-80 bg-slate-200 relative overflow-hidden flex items-center justify-center">
              {(locations[mapModal.index]?.lat && locations[mapModal.index]?.lng) ? (
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(locations[mapModal.index].lng) - 0.005},${parseFloat(locations[mapModal.index].lat) - 0.005},${parseFloat(locations[mapModal.index].lng) + 0.005},${parseFloat(locations[mapModal.index].lat) + 0.005}&layer=mapnik&marker=${locations[mapModal.index].lat},${locations[mapModal.index].lng}`}
                ></iframe>
              ) : (
                <div className="text-center text-slate-500 flex flex-col items-center">
                  <Map size={48} className="mb-3 opacity-30" />
                  <span className="font-extrabold tracking-widest uppercase opacity-40 text-sm">Gunakan Pencarian Sugesti Di Atas</span>
                </div>
              )}
              {locations[mapModal.index]?.lat && locations[mapModal.index]?.lng && (
                <div className="absolute top-4 right-4 flex flex-col items-center pointer-events-none drop-shadow-xl z-10 animate-in zoom-in duration-300">
                  <div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    Radius {locations[mapModal.index].radius || 100}m
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border-t border-slate-100">
              <div className="text-sm text-slate-700 bg-slate-50 px-4 py-3 border border-slate-200 rounded-xl w-full sm:w-auto text-center sm:text-left flex-1">
                <div className="font-mono text-xs flex gap-4 justify-center sm:justify-start mb-1">
                  <span>Lat: <b className="text-slate-900">{locations[mapModal.index]?.lat || '-'}</b></span>
                  <span>Lng: <b className="text-slate-900">{locations[mapModal.index]?.lng || '-'}</b></span>
                </div>
                {locations[mapModal.index]?.address && <div className="text-xs text-slate-500 font-medium line-clamp-2">{locations[mapModal.index].address}</div>}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const lat = pos.coords.latitude.toFixed(5);
                        const lng = pos.coords.longitude.toFixed(5);
                        updateLocation(mapModal.index, 'lat', lat);
                        updateLocation(mapModal.index, 'lng', lng);
                        fetchAddressFromCoordinates(lat, lng, mapModal.index);
                      },
                      (err) => alert("Gagal mengambil GPS: " + err.message)
                    );
                  }}
                  disabled={isFetchingAddress}
                  className="bg-blue-50 text-blue-700 px-5 py-3 rounded-xl text-sm font-bold hover:bg-blue-100 flex-1 sm:flex-none disabled:opacity-50 transition-colors active:scale-95"
                >
                  {isFetchingAddress ? 'Mencari...' : 'Gunakan GPS Saya'}
                </button>
                <button onClick={() => setMapModal({ isOpen: false, index: null })} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-extrabold hover:bg-blue-700 flex-1 sm:flex-none shadow-md shadow-blue-500/30 transition-all active:scale-95">
                  Simpan Titik
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersManagementView({ users, currentUser, projects, divisions }) {
  const [activeTab, setActiveTab] = useState('internal');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

  const managers = users.filter(u => u.role === 'manager');

  const resetForm = () => {
    setEditingId(null); setNewFullName(''); setNewUsername(''); setNewPassword('');
    setNewRole('staff'); setSelectedManager(''); setSelectedDivision(''); setSelectedLocations([]);
    setLocationSearchQuery(''); setIsFormOpen(false);
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setNewFullName(user.name);
    setNewUsername(user.username);
    setNewPassword(user.password);
    setNewRole(user.role);
    setSelectedManager(user.managerId || '');
    setSelectedDivision(user.division || '');
    setSelectedLocations(user.locationIds || []);
    setIsFormOpen(true);
  };

  const handleDelete = async (userId) => {
    if(window.confirm("Yakin ingin menghapus data user ini?")) {
      try {
        await deleteDoc(doc(db, "users", userId));
      } catch (error) {
        alert("Gagal menghapus user: " + error.message);
      }
    }
  };

  const handleLocationToggle = (locationId) => {
    setSelectedLocations(prev => 
      prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]
    );
  };

  const handleSelectAllProjectLocations = (project, isSelected) => {
    const locIds = project.locations.map(l => l.id);
    if (isSelected) {
      setSelectedLocations(prev => prev.filter(id => !locIds.includes(id)));
    } else {
      setSelectedLocations(prev => [...new Set([...prev, ...locIds])]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isInternal = activeTab === 'internal';
    const isClient = activeTab === 'client';
    const isStaff = isInternal && newRole === 'staff';
    const isAdmin = isInternal && newRole === 'admin';
    const isManager = isInternal && newRole === 'manager';

    if (isStaff && !selectedManager) return alert('Silakan pilih Manager untuk staff ini.');
    if ((isAdmin || isManager || isStaff) && !selectedDivision) return alert(`Silakan pilih Divisi untuk karyawan ini.`);
    if ((isStaff || isClient) && selectedLocations.length === 0) return alert('Silakan pilih minimal 1 lokasi project untuk diakses.');

    // Menentukan Divisi: ditarik dari form dropdown untuk Admin, Manager, dan Staff
    let finalDivision = "";
    if (isAdmin || isManager || isStaff) {
      finalDivision = selectedDivision;
    }

    const userObj = {
      id: editingId ? editingId : `u${Date.now()}`,
      name: newFullName || "", 
      username: newUsername || "", 
      password: newPassword || "", 
      role: isClient ? 'client' : (newRole || "staff"),
      managerId: isStaff ? (selectedManager || "") : "",
      division: finalDivision,
      locationIds: (isStaff || isClient) ? (selectedLocations || []) : []
    };

    try {
      await setDoc(doc(db, "users", userObj.id), userObj);
      alert(editingId ? "Data User berhasil diperbarui!" : "Data User berhasil ditambahkan ke Database!");
      resetForm();
    } catch (error) {
      console.error("Error Detail Firebase:", error);
      alert("Gagal menyimpan data user: " + error.message);
    }
  };

  const internalUsers = users.filter(u => u.role !== 'client');
  const clientUsers = users.filter(u => u.role === 'client');

  const filteredProjectsForAccess = projects.map(proj => {
    const matchProjName = proj.name ? proj.name.toLowerCase().includes(locationSearchQuery.toLowerCase()) : false;
    const matchingLocs = proj.locations ? proj.locations.filter(l => 
      (l.name && l.name.toLowerCase().includes(locationSearchQuery.toLowerCase())) || 
      (l.address && l.address.toLowerCase().includes(locationSearchQuery.toLowerCase()))
    ) : [];
    if (matchProjName) return proj;
    if (matchingLocs.length > 0) return { ...proj, locations: matchingLocs };
    return null;
  }).filter(Boolean);

  const filteredInternal = internalUsers.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.division && u.division.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredClients = clientUsers.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Grouping internal users by division
  const groupedInternalUsers = filteredInternal.reduce((acc, user) => {
    const div = user.division || (user.role === 'superadmin' ? 'Super Sistem' : 'Tanpa Divisi Khusus');
    if (!acc[div]) acc[div] = [];
    acc[div].push(user);
    return acc;
  }, {});
  const sortedDivisionsList = Object.keys(groupedInternalUsers).sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Manajemen Data User</h3>
          <p className="text-slate-500 text-sm mt-1">Kelola akun karyawan internal dan akses klien.</p>
        </div>
        {!isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-500/30 transition-all active:scale-95">
            <Plus size={18} /> Tambah User Baru
          </button>
        )}
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
        <button onClick={() => { setActiveTab('internal'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'internal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Karyawan Internal</button>
        <button onClick={() => { setActiveTab('client'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'client' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>User / Client</button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h4 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
              <UserPlus className="text-blue-500" />
              {editingId ? 'Edit Data User' : 'Tambah User'} {activeTab === 'internal' ? 'Karyawan' : 'Client'}
            </h4>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"><X /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label>
              <input type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="Masukkan nama asli" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Username Login</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-60" placeholder="Tanpa spasi" disabled={editingId} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password {editingId && <span className="text-xs text-orange-500 font-normal ml-1">(Biarkan jika tidak diubah)</span>}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required={!editingId} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="Minimal 6 karakter" />
            </div>
            
            {activeTab === 'internal' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Role / Jabatan Utama</label>
                <select value={newRole} onChange={e => { setNewRole(e.target.value); setSelectedDivision(''); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-60" disabled={editingId && newRole === 'superadmin'}>
                  {newRole === 'superadmin' && <option value="superadmin">Superadmin</option>}
                  <option value="staff">Staff (Lapangan)</option>
                  <option value="manager">Manager</option>
                  {currentUser.role === 'superadmin' && <option value="admin">Admin</option>}
                </select>
              </div>
            )}

            {/* Menampilkan Pilihan Divisi untuk Admin, Manager, dan Staff */}
            {activeTab === 'internal' && (newRole === 'admin' || newRole === 'manager' || newRole === 'staff') && (
              <div className="lg:col-span-2 border-t border-slate-100 pt-6 mt-2 animate-in fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tentukan Divisi Karyawan:</label>
                <select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)} required className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                  <option value="">-- Pilih Divisi --</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            )}

            {activeTab === 'internal' && newRole === 'staff' && (
              <div className="lg:col-span-2 border-t border-slate-100 pt-6 mt-2 animate-in fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tentukan Manager / Atasan Langsung:</label>
                <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} required className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                  <option value="">-- Pilih Manager --</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}

            {(activeTab === 'client' || (activeTab === 'internal' && newRole === 'staff')) && (
              <div className="lg:col-span-2 border-t border-slate-100 pt-6 mt-2 animate-in fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-3">Tentukan Hak Akses Lokasi Project:</label>
                {projects.length === 0 ? (
                  <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-sm font-medium border border-yellow-100 flex items-center gap-2"><AlertCircle size={16}/> Belum ada data project di database.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
                      <input 
                        type="text" placeholder="Cari nama project atau cabang lokasi..." value={locationSearchQuery} onChange={(e) => setLocationSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      />
                    </div>

                    <div className="max-h-[350px] overflow-y-auto p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-4 custom-scrollbar shadow-inner">
                      {filteredProjectsForAccess.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 font-medium">Pencarian lokasi tidak ditemukan.</div>
                      ) : (
                        filteredProjectsForAccess.map(proj => {
                          const allSelected = proj.locations && proj.locations.length > 0 && proj.locations.every(l => selectedLocations.includes(l.id));
                          return (
                            <div key={proj.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
                                <p className="font-extrabold text-slate-800 flex items-center gap-2.5"><Briefcase size={18} className="text-blue-500"/> {proj.name}</p>
                                {proj.locations && proj.locations.length > 0 && (
                                  <button type="button" onClick={() => handleSelectAllProjectLocations(proj, allSelected)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 ${allSelected ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                                    {allSelected ? 'Hapus Semua' : 'Pilih Semua Lokasi'}
                                  </button>
                                )}
                              </div>
                              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(!proj.locations || proj.locations.length === 0) && <p className="text-sm text-slate-400 italic p-2">Tidak ada lokasi cabang.</p>}
                                {proj.locations && proj.locations.map(loc => {
                                  const isChecked = selectedLocations.includes(loc.id);
                                  return (
                                    <label key={loc.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}>
                                      <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                        <input type="checkbox" className="hidden" checked={isChecked} onChange={() => handleLocationToggle(loc.id)} />
                                        {isChecked && <CheckCircle size={14} strokeWidth={3} />}
                                      </div>
                                      <div>
                                        <p className={`font-bold text-sm transition-colors ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>{loc.name}</p>
                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{loc.address}</p>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="lg:col-span-2 pt-6 mt-4 border-t border-slate-100 flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                {editingId ? 'Simpan Perubahan' : 'Simpan Data User Baru'}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {!isFormOpen && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
            <input type="text" placeholder="Cari berdasarkan nama, username, atau hak akses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-5">Nama Lengkap</th>
                    <th className="p-5">Username Login</th>
                    <th className="p-5">Detail Hak Akses</th>
                    <th className="p-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'internal' ? (
                    filteredInternal.length === 0 ? (
                      <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium">Data karyawan internal tidak ditemukan.</td></tr>
                    ) : (
                      sortedDivisionsList.map(div => (
                        <React.Fragment key={div}>
                          <tr className="bg-slate-100/60">
                            <td colSpan="4" className="px-5 py-3 text-xs font-black text-slate-600 uppercase tracking-widest border-y border-slate-200 shadow-inner">
                              🏢 Divisi: {div}
                            </td>
                          </tr>
                          {groupedInternalUsers[div].sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                            <tr key={user.id} className="hover:bg-blue-50/30 group transition-colors">
                              <td className="p-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-white text-slate-600 flex items-center justify-center font-extrabold border border-slate-200 shadow-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-extrabold text-slate-800">{user.name}</span>
                                </div>
                              </td>
                              <td className="p-5 text-sm font-mono text-slate-600 font-bold">{user.username}</td>
                              <td className="p-5">
                                <div className="flex flex-col gap-2 items-start">
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-wider ${
                                    user.role === 'superadmin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                    user.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    user.role === 'manager' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                    'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  }`}>{user.role}</span>
                                  
                                  {user.role === 'staff' && (
                                    <span className="text-xs font-medium text-slate-500 flex flex-col gap-1 mt-0.5">
                                      <span>Lapor ke Manajer: <b className="text-slate-700">{users.find(u => u.id === user.managerId)?.name || '-'}</b></span>
                                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">Akses {user.locationIds?.length || 0} Titik GPS</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-5 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {user.role !== 'superadmin' ? (
                                    <>
                                      <button onClick={() => handleEdit(user)} className="bg-white border border-slate-200 hover:border-blue-300 text-blue-600 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Edit size={16} /></button>
                                      <button onClick={() => handleDelete(user.id)} className="bg-white border border-slate-200 hover:border-red-300 text-red-500 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Trash2 size={16} /></button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Sistem Admin</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )
                  ) : (
                    filteredClients.length === 0 ? (
                      <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium">Data user klien tidak ditemukan.</td></tr>
                    ) : (
                      filteredClients.sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                        <tr key={user.id} className="hover:bg-blue-50/30 group transition-colors">
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white text-slate-600 flex items-center justify-center font-extrabold border border-slate-200 shadow-sm">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-extrabold text-slate-800">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-5 text-sm font-mono text-slate-600 font-bold">{user.username}</td>
                          <td className="p-5">
                            <div className="flex flex-col gap-2 items-start">
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-wider">Client / Partner</span>
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded border border-blue-200 w-fit">Melihat {user.locationIds?.length || 0} Lokasi Project</span>
                            </div>
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(user)} className="bg-white border border-slate-200 hover:border-blue-300 text-blue-600 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Edit size={16} /></button>
                              <button onClick={() => handleDelete(user.id)} className="bg-white border border-slate-200 hover:border-red-300 text-red-500 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitsView({ visits, projects, staffs, currentUser, actions }) {
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [actionType, setActionType] = useState(actions[0]?.name || '');

  const resetForm = () => {
    setEditingId(null); setProjectId(''); setLocationId(''); setDate(''); setStartTime(''); setEndTime(''); setActionType(actions[0]?.name || '');
  };

  const handleEdit = (visit) => {
    setEditingId(visit.id);
    setProjectId(visit.projectId);
    setLocationId(visit.locationId);
    setDate(visit.date);
    setStartTime(visit.startTime);
    setEndTime(visit.endTime);
    setActionType(visit.action || (actions[0]?.name || ''));
    setActiveTab('form');
  };

  const handleDelete = async (visitId) => {
    if(window.confirm("Yakin ingin menghapus jadwal visit ini?")) {
      try {
        await deleteDoc(doc(db, "visits", visitId));
      } catch (error) {
        alert("Gagal menghapus jadwal: " + error.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId || !locationId) return alert("Harap lengkapi Project dan Lokasi.");
    
    // AUTO ASSIGN STAFF based on who has access to this specific location
    const assignedStaffIds = staffs.filter(s => s.locationIds?.includes(locationId)).map(s => s.id);
    
    if (assignedStaffIds.length === 0) {
      const proceed = window.confirm("Peringatan: Saat ini tidak ada Staff Lapangan yang terhubung ke cabang/lokasi ini. Tetap simpan jadwal?");
      if (!proceed) return;
    }
    
    const visitObj = {
      id: editingId || `v${Date.now()}`,
      projectId: projectId || "", 
      locationId: locationId || "", 
      staffIds: assignedStaffIds || [], 
      date: date || "", 
      startTime: startTime || "", 
      endTime: endTime || "", 
      action: actionType || "", 
      status: editingId ? visits.find(v => v.id === editingId)?.status || 'scheduled' : 'scheduled'
    };

    try {
      await setDoc(doc(db, "visits", visitObj.id), visitObj);
      alert(editingId ? "Jadwal visit berhasil diperbarui!" : "Jadwal visit berhasil dibuat!");
      resetForm();
      setActiveTab('list');
    } catch (error) {
      alert("Gagal menyimpan jadwal: " + error.message);
    }
  };

  // Filter projects available to the user if they are a staff
  const availableProjects = currentUser.role === 'staff' 
    ? projects.filter(p => p.locations && p.locations.some(l => currentUser.locationIds?.includes(l.id)))
    : projects;

  const selectedProjectData = availableProjects.find(p => p.id === projectId);

  const filteredVisits = visits.filter(v => {
    // If staff, only show their visits
    if (currentUser.role === 'staff' && (!v.staffIds || !v.staffIds.includes(currentUser.id))) return false;

    const proj = projects.find(p => p.id === v.projectId);
    const loc = proj?.locations?.find(l => l.id === v.locationId);
    const search = searchQuery.toLowerCase();
    return (
      (proj?.name && proj.name.toLowerCase().includes(search)) || 
      (loc?.name && loc.name.toLowerCase().includes(search)) || 
      (v.action && v.action.toLowerCase().includes(search)) ||
      (v.date && v.date.includes(search))
    );
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Manajemen Jadwal Visit</h3>
          <p className="text-slate-500 text-sm mt-1">Buat tugas kunjungan, pantau status, dan otomatiskan assign staff.</p>
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daftar Jadwal</button>
        <button onClick={() => { setActiveTab('form'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'form' && !editingId ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Buat Jadwal Baru</button>
        {editingId && (
          <button className="py-2.5 px-6 font-bold text-sm rounded-lg bg-orange-100 text-orange-600 shadow-sm">Edit Jadwal</button>
        )}
      </div>

      {activeTab === 'form' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h4 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
              <CalendarIcon className="text-blue-500" />
              {editingId ? 'Edit Jadwal Visit' : 'Buat Jadwal Operasional Baru'}
            </h4>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-xl flex gap-4 shadow-sm">
              <div className="bg-white p-2 rounded-full h-fit shadow-sm"><AlertCircle className="text-blue-600" size={20} /></div>
              <div>
                <p className="font-extrabold text-blue-900 mb-1 text-sm">Sistem Auto-Assign Aktif ⚡</p>
                <p className="text-blue-700 text-xs font-medium leading-relaxed">Anda tidak perlu memilih Staff satu per satu. Sistem akan secara otomatis menugaskan seluruh Staff Lapangan yang memiliki hak akses (*location permissions*) ke lokasi cabang yang Anda pilih di bawah ini.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">1. Pilih Project Utama</label>
                  <select value={projectId} onChange={e => { setProjectId(e.target.value); setLocationId(''); }} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer">
                    <option value="">-- Pilih Project --</option>
                    {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">2. Pilih Lokasi / Cabang Tujuan</label>
                  <select value={locationId} onChange={e => setLocationId(e.target.value)} required disabled={!projectId} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 cursor-pointer">
                    <option value="">-- Pilih Lokasi --</option>
                    {selectedProjectData?.locations && selectedProjectData.locations
                      .filter(loc => currentUser.role !== 'staff' || currentUser.locationIds.includes(loc.id))
                      .map(loc => <option key={loc.id} value={loc.id}>{loc.name} - {loc.address}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">3. Jenis Action (Aktivitas)</label>
                  <select value={actionType} onChange={e => setActionType(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer">
                    <option value="">-- Pilih Action --</option>
                    {actions.map(act => (
                      <option key={act.id} value={act.name}>{act.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal Pelaksanaan</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Jam Mulai</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Jam Selesai</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-100 flex gap-3">
              <button type="submit" className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${editingId ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}>
                {editingId ? 'Simpan Perubahan Jadwal' : 'Simpan & Auto-Assign Staff Sekarang'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { resetForm(); setActiveTab('list'); }} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95">Batal Edit</button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
            <input type="text" placeholder="Cari project, lokasi, jenis aktivitas, tanggal..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-5">Tanggal & Waktu</th>
                    <th className="p-5">Lokasi Penugasan</th>
                    <th className="p-5">Staff Yang Ditugaskan</th>
                    <th className="p-5">Aktivitas</th>
                    <th className="p-5">Status</th>
                    <th className="p-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisits.length === 0 ? (
                    <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-medium">Jadwal operasional tidak ditemukan.</td></tr>
                  ) : (
                    filteredVisits.map(visit => {
                      const proj = projects.find(p => p.id === visit.projectId);
                      const loc = proj?.locations?.find(l => l.id === visit.locationId);
                      const assignedStaffs = visit.staffIds && visit.staffIds.length > 0 
                        ? visit.staffIds.map(id => staffs.find(s => s.id === id)?.name).join(', ') 
                        : <span className="inline-flex items-center gap-1.5 text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100"><AlertCircle size={12}/> Tidak ada staff</span>;
                      
                      return (
                        <tr key={visit.id} className="hover:bg-blue-50/30 group transition-colors">
                          <td className="p-5">
                            <div className="font-extrabold text-slate-800 text-sm mb-0.5">{visit.date}</div>
                            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">{visit.startTime} - {visit.endTime}</div>
                          </td>
                          <td className="p-5">
                            <div className="font-bold text-slate-800">{proj?.name || 'Project Dihapus'}</div>
                            <div className="text-sm font-medium text-slate-600 mb-1">{loc?.name || '-'}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px] leading-snug">{loc?.address}</div>
                          </td>
                          <td className="p-5 text-sm font-medium text-slate-700 leading-relaxed">{assignedStaffs}</td>
                          <td className="p-5">
                            <ActionBadge action={visit.action} className="shadow-sm" />
                          </td>
                          <td className="p-5"><StatusBadge status={visit.status} /></td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(visit)} className="bg-white border border-slate-200 hover:border-blue-300 text-blue-600 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Edit size={16} /></button>
                              <button onClick={() => handleDelete(visit.id)} className="bg-white border border-slate-200 hover:border-red-300 text-red-500 p-2 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Rich Text Editor Component
function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCmd = (command, arg = null) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1 items-center">
        <button type="button" onClick={() => execCmd('bold')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><Bold size={16} /></button>
        <button type="button" onClick={() => execCmd('italic')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><Italic size={16} /></button>
        <button type="button" onClick={() => execCmd('underline')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><Underline size={16} /></button>
        <div className="w-px h-5 bg-slate-300 mx-2"></div>
        <button type="button" onClick={() => execCmd('justifyLeft')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><AlignLeft size={16} /></button>
        <button type="button" onClick={() => execCmd('justifyCenter')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><AlignCenter size={16} /></button>
        <button type="button" onClick={() => execCmd('justifyRight')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><AlignRight size={16} /></button>
        <div className="w-px h-5 bg-slate-300 mx-2"></div>
        <button type="button" onClick={() => execCmd('insertOrderedList')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><ListOrdered size={16} /></button>
        <button type="button" onClick={() => execCmd('insertUnorderedList')} className="p-2 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"><List size={16} /></button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
        className="p-4 min-h-[250px] max-h-[400px] overflow-y-auto outline-none rich-text-content text-sm focus:ring-inset focus:ring-2 focus:ring-blue-500/20"
      ></div>
    </div>
  );
}

function StaffVisitsView({ visits, projects, currentUser }) {
  const myVisits = visits.filter(v => v.staffIds && v.staffIds.includes(currentUser.id));
  const [gpsError, setGpsError] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState(null);

  const [reportModal, setReportModal] = useState({ isOpen: false, visitId: null });
  const [reportInput, setReportInput] = useState('');
  const [modalError, setModalError] = useState('');

  const updateVisitStatus = async (visitId, updates) => {
    try {
      const visit = visits.find(v => v.id === visitId);
      await setDoc(doc(db, "visits", visitId), { ...visit, ...updates });
    } catch (error) {
      alert("Gagal memperbarui status visit: " + error.message);
    }
  };

  const validateVisitDate = (visitId) => {
    const visit = visits.find(v => v.id === visitId);
    const todayStr = getTodayStr(); // Format YYYY-MM-DD
    
    if (visit.date !== todayStr) {
      setGpsError(`Gagal! Jadwal ini dikhususkan untuk tanggal ${visit.date}. Anda hanya dapat Check-in/Check-out pada hari pelaksanaannya.`);
      return false;
    }
    return true;
  };

  const handleCheckIn = async (visitId, locationTarget) => {
    setGpsError(''); 
    setActiveVisitId(visitId);

    if (!validateVisitDate(visitId)) return;

    setIsCheckingIn(true);
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
      setIsCheckingIn(false); return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const distance = getDistanceInMeters(position.coords.latitude, position.coords.longitude, locationTarget.lat, locationTarget.lng);
        setIsCheckingIn(false);
        
        const maxRadius = locationTarget.radius || 100;

        if (distance <= maxRadius) {
          await updateVisitStatus(visitId, { status: 'ongoing' });
        } else {
          setGpsError(`Gagal Check-in. Anda berada ${distance} m dari lokasi cabang. Maksimal radius yang diizinkan adalah ${maxRadius} meter.`);
        }
      },
      (error) => {
        setIsCheckingIn(false); setGpsError(`Gagal mendapatkan GPS: ${error.message}. Cek pengaturan izin lokasi browser Anda.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCheckOut = async (visitId, locationTarget) => {
    setGpsError(''); 
    setActiveVisitId(visitId);

    if (!validateVisitDate(visitId)) return;

    setIsCheckingOut(true);
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
      setIsCheckingOut(false); return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = getDistanceInMeters(position.coords.latitude, position.coords.longitude, locationTarget.lat, locationTarget.lng);
        setIsCheckingOut(false);
        
        const maxRadius = locationTarget.radius || 100;

        if (distance <= maxRadius) {
          setReportModal({ isOpen: true, visitId });
        } else {
          setGpsError(`Gagal Check-out. Anda saat ini berada ${distance} m dari lokasi project. Anda harus berada di area project (Maks radius ${maxRadius}m) untuk dapat menyelesaikan visit.`);
        }
      },
      (error) => {
        setIsCheckingOut(false); setGpsError(`Gagal mendapatkan GPS: ${error.message}. Cek pengaturan izin lokasi browser Anda.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const submitReportAndCheckout = async () => {
    // Validasi strip HTML untuk memastikan tidak kosong hanya dengan tag
    const strippedContent = stripHtml(reportInput).trim();
    if (!strippedContent) {
      setModalError('Laporan Action wajib diisi untuk mengakhiri visit!');
      return;
    }
    await updateVisitStatus(reportModal.visitId, { status: 'completed', reportText: reportInput });
    setReportModal({ isOpen: false, visitId: null });
    setReportInput('');
    setModalError('');
    setGpsError('');
  };

  if (myVisits.length === 0) return (
    <div className="py-20 text-center flex flex-col items-center">
      <div className="bg-slate-100 p-6 rounded-full mb-6 text-slate-300"><MapPin size={64} /></div>
      <h3 className="text-2xl font-bold text-slate-700 mb-2">Tidak Ada Tugas</h3>
      <p className="text-slate-500">Anda tidak memiliki jadwal operasional yang harus dikerjakan saat ini.</p>
    </div>
  );

  return (
    <div className="space-y-6 relative animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Daftar Tugas Saya</h3>
          <p className="text-slate-500 text-sm mt-1">Lakukan Check-in saat tiba di lokasi, dan Check-out saat selesai.</p>
        </div>
      </div>

      {gpsError && (
        <div className="bg-red-50 text-red-700 px-5 py-4 rounded-xl border border-red-100 flex gap-3 items-start shadow-sm animate-in slide-in-from-top-2">
          <XCircle className="shrink-0 mt-0.5" /> 
          <div>
            <p className="font-bold mb-1">Peringatan Sistem</p>
            <p className="text-sm font-medium">{gpsError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {myVisits.map(visit => {
          const project = projects.find(p => p.id === visit.projectId);
          const location = project?.locations?.find(l => l.id === visit.locationId);
          const isOngoing = visit.status === 'ongoing', isCompleted = visit.status === 'completed';

          return (
            <div key={visit.id} className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border overflow-hidden flex flex-col ${isOngoing ? 'border-yellow-400 ring-2 ring-yellow-400/20' : isCompleted ? 'border-emerald-200 opacity-80' : 'border-slate-200'}`}>
              <div className={`p-6 border-b ${isOngoing ? 'bg-gradient-to-b from-yellow-50 to-white' : isCompleted ? 'bg-emerald-50/30' : 'bg-slate-50/50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col items-start gap-3 w-full">
                    <div className="flex justify-between w-full items-center">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={visit.status} />
                        <ActionBadge action={visit.action} className="rounded-md shadow-sm" />
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-black ${isOngoing ? 'text-yellow-600' : isCompleted ? 'text-emerald-600' : 'text-blue-600'}`}>{visit.startTime}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{visit.date}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-2xl font-extrabold text-slate-800 mt-2">{project?.name || 'Project Dihapus'}</h4>
                      <p className="font-bold text-slate-600 mt-1">{location?.name || '-'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 flex items-start gap-2.5 mt-2">
                  <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5"/> 
                  <div>
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">{location?.address || 'Alamat tidak ditemukan'}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Radius Toleransi: {location?.radius || 100} Meter</p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-3 bg-white">
                {!isOngoing && !isCompleted && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={() => handleCheckIn(visit.id, location)} disabled={isCheckingIn && activeVisitId === visit.id} className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/30 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all">
                      {(isCheckingIn && activeVisitId === visit.id) ? 'Validasi Koordinat...' : <><Play size={18} /> Mulai (Check-in GPS)</>}
                    </button>
                  </div>
                )}
                {isOngoing && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={() => handleCheckOut(visit.id, location)} disabled={isCheckingOut && activeVisitId === visit.id} className="flex-1 bg-yellow-500 hover:bg-yellow-600 active:scale-95 shadow-md shadow-yellow-500/30 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all">
                      {(isCheckingOut && activeVisitId === visit.id) ? 'Validasi Koordinat...' : <><Square fill="currentColor" size={18}/> Selesai (Check-out)</>}
                    </button>
                  </div>
                )}
                {isCompleted && (
                  <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 py-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-sm">
                    <CheckCircle strokeWidth={2.5} /> Selesai dan Dilaporkan
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL LAPORAN CHECK-OUT WITH RICH TEXT EDITOR */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-extrabold text-xl text-slate-800">Laporan Penyelesaian Kunjungan</h3>
              <button onClick={() => { setReportModal({ isOpen: false, visitId: null }); setModalError(''); }} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors active:scale-95"><X className="text-slate-600" size={18} /></button>
            </div>
            <div className="p-6 space-y-5 bg-slate-50/50 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-sm">
                <CheckCircle className="text-blue-500 shrink-0 mt-0.5" size={18}/>
                <p className="text-blue-800 font-medium"><b>Validasi Lokasi Berhasil!</b> Silakan tulis ringkasan hasil kunjungan/tindakan Anda di bawah ini menggunakan format editor yang tersedia.</p>
              </div>
              {modalError && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle size={16}/> {modalError}</p>}
              
              {/* Rich Text Editor Component is embedded here */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Detail Catatan / Laporan Action (Wajib):</label>
                <RichTextEditor value={reportInput} onChange={setReportInput} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0 z-10">
              <button onClick={() => { setReportModal({ isOpen: false, visitId: null }); setModalError(''); }} className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95">Batal</button>
              <button onClick={submitReportAndCheckout} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl text-sm font-extrabold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95">Kirim Laporan & Check-out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorMap = { 
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30', 
    yellow: 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-orange-500/30', 
    green: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30', 
    red: 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30',
    slate: 'bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-500/30'
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200/60 p-6 flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-4xl font-black text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3.5 rounded-2xl shadow-lg text-white group-hover:scale-110 transition-transform duration-300 ${colorMap[color]}`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-xl ${colorMap[color]}`}></div>
    </div>
  );
}

function ActionBadge({ action, className = 'rounded text-xs' }) {
  const styles = {
    'Visit Reguler': 'bg-blue-50 text-blue-700 border border-blue-200',
    'Meeting Offline': 'bg-orange-50 text-orange-700 border border-orange-200',
    'Meeting Online': 'bg-teal-50 text-teal-700 border border-teal-200',
    'Tanda Tangan PKWT': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    'Sosialisasi': 'bg-pink-50 text-pink-700 border border-pink-200',
    'Issue Project': 'bg-red-50 text-red-700 border border-red-200',
  };
  const badgeClass = styles[action] || 'bg-slate-50 text-slate-700 border border-slate-200';
  return <span className={`px-2.5 py-1 font-bold whitespace-nowrap ${badgeClass} ${className}`}>{action || '-'}</span>;
}

function StatusBadge({ status }) {
  const styles = { 
    scheduled: 'bg-blue-100 text-blue-700', 
    ongoing: 'bg-yellow-400 text-yellow-900 shadow-sm shadow-yellow-500/20', 
    completed: 'bg-emerald-100 text-emerald-700', 
    missed: 'bg-red-100 text-red-700' 
  };
  const labels = { scheduled: 'TERJADWAL', ongoing: 'BERJALAN', completed: 'SELESAI', missed: 'TERLEWAT' };
  return <span className={`px-3 py-1 rounded-md text-[10px] tracking-widest font-black ${styles[status]}`}>{labels[status]}</span>;
}

// Helper to load external scripts dynamically for PDF generation
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
    document.head.append(script);
  });
};

function ReportsView({ visits, projects, staffs, currentUser, actions }) {
  const [filterDate, setFilterDate] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // State for PDF Download
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setFilterLocation('');
  }, [filterProject]);

  const resetFilters = () => {
    setFilterDate(''); setFilterProject(''); setFilterLocation('');
    setFilterStaff(''); setFilterAction(''); setFilterStatus('');
  };

  const filteredVisits = visits.filter(v => {
    if (currentUser.role === 'client' && !currentUser.locationIds?.includes(v.locationId)) return false;
    
    if (filterDate && v.date !== filterDate) return false;
    if (filterProject && v.projectId !== filterProject) return false;
    if (filterLocation && v.locationId !== filterLocation) return false;
    if (filterStaff && (!v.staffIds || !v.staffIds.includes(filterStaff))) return false;
    if (filterAction && v.action !== filterAction) return false;
    if (filterStatus && v.status !== filterStatus) return false;
    
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const availableLocations = filterProject 
    ? projects.find(p => p.id === filterProject)?.locations || []
    : projects.flatMap(p => p.locations || []);

  // Function to generate and download PDF
  const handleDownloadPDF = async () => {
    if (filteredVisits.length === 0) {
      alert("Tidak ada data untuk diunduh.");
      return;
    }

    setIsDownloading(true);
    try {
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape'); 

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59); 
      doc.text('Laporan Operasional & Visit', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); 
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);
      doc.text(`Total Data: ${filteredVisits.length} laporan`, 14, 36);

      const tableColumn = ["Waktu", "Project & Lokasi", "Staff Ditugaskan", "Action", "Status", "Laporan Action"];
      const tableRows = [];

      filteredVisits.forEach(visit => {
        const proj = projects.find(p => p.id === visit.projectId);
        const loc = proj?.locations?.find(l => l.id === visit.locationId);
        const assignedStaffs = visit.staffIds ? visit.staffIds.map(id => staffs.find(s => s.id === id)?.name).join(', ') : '-';
        
        // Strip HTML Tags before generating PDF table text
        const plainTextReport = visit.reportText ? stripHtml(visit.reportText) : 'Belum ada laporan';

        const visitData = [
          `${visit.date}\n${visit.startTime} - ${visit.endTime}`,
          `${proj?.name || '-'}\nCabang: ${loc?.name || '-'}`,
          assignedStaffs,
          visit.action || '-',
          visit.status.toUpperCase(),
          plainTextReport
        ];
        tableRows.push(visitData);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 42,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85] },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' }, 
        alternateRowStyles: { fillColor: [248, 250, 252] }, 
        columnStyles: {
          5: { cellWidth: 80 } 
        }
      });

      doc.save(`Laporan_Visit_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Gagal menghasilkan PDF. Pastikan Anda terhubung ke internet agar sistem dapat memuat library PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Laporan Aktivitas</h3>
          <p className="text-slate-500 text-sm mt-1">Cetak laporan operasional dan hasil akhir kunjungan (PDF).</p>
        </div>
        <button 
          onClick={handleDownloadPDF} 
          disabled={isDownloading || filteredVisits.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/30"
        >
          {isDownloading ? (
            <><RotateCcw size={18} className="animate-spin" /> Memproses PDF...</>
          ) : (
            <><Download size={18} /> Export Laporan PDF</>
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-5">
            <div className="bg-slate-200 p-1.5 rounded-lg text-slate-600"><Filter size={16} /></div>
            <h4 className="font-extrabold text-slate-700">Filter Pencarian Data</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Waktu (Tanggal)</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Project</label>
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm">
                <option value="">Semua Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Lokasi / Cabang</label>
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm disabled:opacity-50" disabled={availableLocations.length === 0}>
                <option value="">Semua Lokasi</option>
                {availableLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Staff Ditugaskan</label>
              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm">
                <option value="">Semua Staff</option>
                {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Action</label>
              <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm">
                <option value="">Semua Action</option>
                {actions?.map(act => (
                  <option key={act.id} value={act.name}>{act.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Status</label>
              <div className="flex gap-2">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm">
                  <option value="">Semua Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>
                <button onClick={resetFilters} title="Reset Filter" className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center shrink-0"><RotateCcw size={16} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="p-5">Waktu Kunjungan</th>
                <th className="p-5">Data Penugasan</th>
                <th className="p-5">Status & Action</th>
                <th className="p-5 w-1/3 min-w-[250px]">Laporan Action (Detail)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-16 text-center text-slate-400">
                    <FileText size={48} className="mx-auto mb-3 text-slate-200" />
                    <p className="font-bold text-slate-600">Tidak ada data ditemukan</p>
                    <p className="text-sm">Silakan ubah filter pencarian Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredVisits.map(visit => {
                  const proj = projects.find(p => p.id === visit.projectId);
                  const loc = proj?.locations?.find(l => l.id === visit.locationId);
                  const assignedStaffs = visit.staffIds ? visit.staffIds.map(id => staffs.find(s => s.id === id)?.name).join(', ') : '-';
                  
                  return (
                    <tr key={visit.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-5 align-top">
                        <div className="font-extrabold text-slate-800 whitespace-nowrap mb-0.5">{visit.date}</div>
                        <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit whitespace-nowrap">{visit.startTime} - {visit.endTime}</div>
                      </td>
                      <td className="p-5 align-top">
                        <div className="font-bold text-blue-700">{proj?.name || 'Project Dihapus'}</div>
                        <div className="text-sm font-medium text-slate-600 mt-0.5 mb-2">{loc?.name || '-'}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <User size={12} className="shrink-0"/>
                          <span className="truncate max-w-[200px]">{assignedStaffs}</span>
                        </div>
                      </td>
                      <td className="p-5 align-top space-y-2.5">
                        <StatusBadge status={visit.status} />
                        <div className="block"><ActionBadge action={visit.action} /></div>
                      </td>
                      <td className="p-5 align-top">
                        {visit.reportText ? (
                          <div 
                            className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner font-medium rich-text-content"
                            dangerouslySetInnerHTML={{ __html: visit.reportText }} 
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 border-dashed">
                            Belum Ada Laporan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NewsView({ newsList, currentUser }) {
  const [activeTab, setActiveTab] = useState('list'); 
  
  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);

  const canManageNews = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return alert("Harap lengkapi judul dan deskripsi berita.");

    let base64FileUrl = null;

    if (file) {
      if (file.size > 512000) { // Limit to 500KB to safely fit in Firestore 1MB document limit
        return alert("Ukuran file terlalu besar! Maksimal ukuran file adalah 500 KB.");
      }
      try {
        base64FileUrl = await getBase64(file);
      } catch (error) {
        return alert("Gagal memproses file PDF: " + error);
      }
    }

    const newNews = {
      id: `n${Date.now()}`,
      title: title || "",
      description: description || "",
      fileName: file ? file.name : null,
      fileUrl: base64FileUrl, 
      date: new Date().toISOString().split('T')[0],
      author: currentUser.name || "Admin"
    };

    try {
      await setDoc(doc(db, "news", newNews.id), newNews);
      setActiveTab('list');
      resetForm();
      alert("Berita berhasil dipublikasikan!");
    } catch (error) {
      alert("Gagal mempublikasikan berita: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus berita ini?")) {
      try {
        await deleteDoc(doc(db, "news", id));
      } catch (error) {
        alert("Gagal menghapus berita: " + error.message);
      }
    }
  };

  // Mengurutkan berita agar yang terbaru tampil paling atas
  const sortedNewsList = [...newsList].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Berita Internal</h3>
          <p className="text-slate-500 text-sm mt-1">Pusat informasi dan pengumuman untuk seluruh karyawan.</p>
        </div>
      </div>

      {canManageNews && (
        <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
          <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daftar Berita</button>
          <button onClick={() => { setActiveTab('form'); resetForm(); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'form' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tambah Berita</button>
        </div>
      )}

      {/* FORM TAB */}
      {activeTab === 'form' && canManageNews && (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-300 max-w-3xl">
          <h4 className="font-extrabold text-xl text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
            <Newspaper className="text-blue-500" /> Form Publikasi Berita
          </h4>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Judul Pengumuman</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold" 
                placeholder="Masukkan judul yang menarik..."
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Isi Detail Berita</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows="6"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all leading-relaxed resize-y" 
                placeholder="Tuliskan semua informasi dengan detail di sini..."
                required 
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
              <label className="block text-sm font-bold text-slate-700 mb-2">Lampiran Dokumen PDF (Opsional)</label>
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])} 
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 file:transition-colors file:cursor-pointer cursor-pointer text-sm text-slate-500" 
              />
              <p className="text-xs font-medium text-slate-400 mt-2">Hanya mendukung format .pdf (Maksimal 500 KB)</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3 pt-6 border-t border-slate-100">
            <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-extrabold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95">Publikasikan Sekarang</button>
            <button type="button" onClick={() => { resetForm(); setActiveTab('list'); }} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95">Batal</button>
          </div>
        </form>
      )}

      {/* LIST TAB */}
      {activeTab === 'list' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          {sortedNewsList.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-16 text-center text-slate-500 flex flex-col items-center">
              <div className="bg-slate-50 p-6 rounded-full mb-4 border border-slate-100"><Newspaper size={48} className="text-slate-300" /></div>
              <h4 className="text-xl font-extrabold text-slate-700 mb-2">Belum ada pengumuman</h4>
              <p className="text-slate-500">Informasi penting dan update perusahaan akan muncul di sini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {sortedNewsList.map(news => (
                <div key={news.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 flex flex-col relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                  
                  <div className="p-6 sm:p-8">
                    {canManageNews && (
                      <button 
                        onClick={() => handleDelete(news.id)} 
                        className="absolute top-6 right-6 p-2 bg-white shadow-sm border border-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95" 
                        title="Hapus Berita"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Pengumuman</span>
                      <span className="text-xs text-slate-400 font-bold">{news.date} • Oleh <span className="text-slate-600">{news.author}</span></span>
                    </div>
                    
                    <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4 pr-10 leading-tight">{news.title}</h4>
                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">{news.description}</p>
                    
                    {news.fileName && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex items-center justify-between bg-slate-50 hover:bg-blue-50/50 transition-colors p-4 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-4">
                            <div className="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200"><FileText size={24} className="text-red-500" /></div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{news.fileName}</p>
                              <p className="text-xs text-slate-400 font-medium">Dokumen PDF Terlampir</p>
                            </div>
                          </div>
                          {news.fileUrl ? (
                            <a 
                              href={news.fileUrl} 
                              download={news.fileName}
                              className="flex items-center gap-2 text-sm bg-white border border-slate-200 shadow-sm hover:border-blue-300 text-blue-600 px-4 py-2 rounded-lg font-bold transition-all active:scale-95"
                            >
                              <Download size={16} /> Unduh File
                            </a>
                          ) : (
                            <button disabled className="text-xs font-bold bg-slate-200 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed border border-slate-300">
                              File Hilang/Mockup
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialsView({ materialsList, sopsList, currentUser }) {
  const [activeTab, setActiveTab] = useState('materi'); // 'materi' | 'sop'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  
  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);

  const canManage = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setViewMode('list');
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return alert("Harap lengkapi judul dan deskripsi.");

    let base64FileUrl = null;

    if (file) {
      if (file.size > 512000) { 
        return alert("Ukuran file terlalu besar! Maksimal ukuran file adalah 500 KB.");
      }
      try {
        base64FileUrl = await getBase64(file);
      } catch (error) {
        return alert("Gagal memproses file PDF: " + error);
      }
    }

    const newItem = {
      id: `doc${Date.now()}`,
      title: title || "",
      description: description || "",
      fileName: file ? file.name : null,
      fileUrl: base64FileUrl, 
      date: new Date().toISOString().split('T')[0],
      author: currentUser.name || "Admin"
    };

    const collectionName = activeTab === 'materi' ? 'materials' : 'sops';
    
    try {
      await setDoc(doc(db, collectionName, newItem.id), newItem);
      resetForm();
      alert("Data berhasil dipublikasikan!");
    } catch (error) {
      alert("Gagal publikasi dokumen: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus dokumen ini?")) {
      const collectionName = activeTab === 'materi' ? 'materials' : 'sops';
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        alert("Gagal menghapus dokumen: " + error.message);
      }
    }
  };

  const currentList = activeTab === 'materi' ? materialsList : sopsList;
  
  // Mengurutkan dokumen agar yang terbaru tampil di atas (berdasarkan Timestamp di dalam ID)
  const sortedList = [...currentList].sort((a, b) => {
    const timeA = Number(a.id.replace(/\D/g, '')) || 0;
    const timeB = Number(b.id.replace(/\D/g, '')) || 0;
    return timeB - timeA;
  });
  
  const tabName = activeTab === 'materi' ? 'Materi' : 'SOP';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Perpustakaan Dokumen</h3>
          <p className="text-slate-500 text-sm mt-1">Pusat materi training dan standar operasional (SOP) karyawan.</p>
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
        <button 
          onClick={() => handleTabSwitch('materi')} 
          className={`py-2.5 px-8 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'materi' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Materi Edukasi
        </button>
        <button 
          onClick={() => handleTabSwitch('sop')} 
          className={`py-2.5 px-8 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'sop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Dokumen SOP
        </button>
      </div>

      {canManage && (
        <div className="flex border-b border-slate-200 mt-4">
          <button onClick={() => setViewMode('list')} className={`py-3 px-6 font-extrabold text-sm border-b-2 transition-colors ${viewMode === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            Daftar {tabName} Tersedia
          </button>
          <button onClick={() => setViewMode('form')} className={`py-3 px-6 font-extrabold text-sm border-b-2 transition-colors ${viewMode === 'form' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <span className="flex items-center gap-1.5"><Plus size={16}/> Upload {tabName} Baru</span>
          </button>
        </div>
      )}

      {/* FORM TAB */}
      {viewMode === 'form' && canManage && (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-300 max-w-3xl mt-6">
          <h4 className="font-extrabold text-xl text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
            {activeTab === 'materi' ? <BookOpen className="text-blue-500" /> : <FileText className="text-blue-500" />}
            Form Upload {tabName}
          </h4>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Judul {tabName}</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold" 
                placeholder={`Masukkan judul ${tabName.toLowerCase()}...`}
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Deskripsi atau Ringkasan Dokumen</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows="5"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all leading-relaxed resize-y" 
                placeholder="Sebutkan tujuan dokumen ini agar mudah dipahami staff..."
                required 
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
              <label className="block text-sm font-bold text-slate-700 mb-2">Upload Dokumen PDF (Wajib)</label>
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])} 
                required
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 file:transition-colors file:cursor-pointer cursor-pointer text-sm text-slate-500" 
              />
              <p className="text-xs font-medium text-slate-400 mt-2">Hanya mendukung format .pdf (Maksimal 500 KB)</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3 pt-6 border-t border-slate-100">
            <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-extrabold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95">Simpan {tabName} Ke Server</button>
            <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95">Batal</button>
          </div>
        </form>
      )}

      {/* LIST TAB */}
      {viewMode === 'list' && (
        <div className="space-y-6 mt-6 animate-in slide-in-from-bottom-4 duration-300">
          {sortedList.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-16 text-center text-slate-500 flex flex-col items-center">
              <div className="bg-slate-50 p-6 rounded-full mb-4 border border-slate-100">
                {activeTab === 'materi' ? <BookOpen size={48} className="text-slate-300" /> : <FileText size={48} className="text-slate-300" />}
              </div>
              <h4 className="text-xl font-extrabold text-slate-700 mb-2">Belum ada {tabName.toLowerCase()}</h4>
              <p className="text-slate-500">Dokumen yang diunggah oleh pihak manajemen akan muncul di halaman ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {sortedList.map(item => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 flex flex-col relative group overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${activeTab === 'materi' ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                  
                  <div className="p-6 sm:p-8">
                    {canManage && (
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="absolute top-6 right-6 p-2 bg-white shadow-sm border border-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95 z-10" 
                        title="Hapus Dokumen"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${activeTab === 'materi' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>{tabName}</span>
                      <span className="text-xs text-slate-400 font-bold">{item.date} • Oleh <span className="text-slate-600">{item.author}</span></span>
                    </div>
                    
                    <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4 pr-10 leading-tight">{item.title}</h4>
                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">{item.description}</p>
                    
                    {item.fileName && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex items-center justify-between bg-slate-50 hover:bg-blue-50/50 transition-colors p-4 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-4">
                            <div className="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                              {activeTab === 'materi' ? <BookOpen size={24} className="text-indigo-500" /> : <FileText size={24} className="text-blue-500" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{item.fileName}</p>
                              <p className="text-xs text-slate-400 font-medium">Dokumen PDF Terlampir</p>
                            </div>
                          </div>
                          {item.fileUrl ? (
                            <a 
                              href={item.fileUrl} 
                              download={item.fileName}
                              className="flex items-center gap-2 text-sm bg-white border border-slate-200 shadow-sm hover:border-blue-300 text-blue-600 px-4 py-2 rounded-lg font-bold transition-all active:scale-95"
                            >
                              <Download size={16} /> Unduh File
                            </a>
                          ) : (
                            <button disabled className="text-xs font-bold bg-slate-200 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed border border-slate-300">
                              File Hilang / Mockup
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MasterDataView({ divisions, actions }) {
  const [activeTab, setActiveTab] = useState('divisi');
  const [newItemName, setNewItemName] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const collectionName = activeTab === 'divisi' ? 'divisions' : 'actions';
    const newObj = { id: `${activeTab}${Date.now()}`, name: newItemName || "" };

    try {
      await setDoc(doc(db, collectionName, newObj.id), newObj);
      setNewItemName('');
    } catch (error) {
      alert("Gagal menambahkan master data: " + error.message);
    }
  };

  const handleDelete = async (id, tab) => {
    if (!window.confirm("Yakin ingin menghapus data master ini?")) return;
    
    const collectionName = tab === 'divisi' ? 'divisions' : 'actions';
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      alert("Gagal menghapus master data: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-800">Data Master & Konfigurasi</h3>
          <p className="text-slate-500 text-sm mt-1">Atur label dropdown untuk keperluan internal aplikasi.</p>
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-fit">
        <button onClick={() => { setActiveTab('divisi'); setNewItemName(''); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'divisi' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Kategori Divisi</button>
        <button onClick={() => { setActiveTab('action'); setNewItemName(''); }} className={`py-2.5 px-6 font-bold text-sm rounded-lg transition-all active:scale-95 ${activeTab === 'action' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tindakan / Aktivitas</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden max-w-3xl">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/30">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`Ketik nama ${activeTab === 'divisi' ? 'Divisi' : 'Action'} baru...`} 
              className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium" required 
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-blue-500/30"><Plus size={18} /> Tambah Data</button>
          </form>
        </div>
        <div className="p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="px-8 py-4 w-16">No</th>
                <th className="px-8 py-4">Nama {activeTab === 'divisi' ? 'Divisi' : 'Action'}</th>
                <th className="px-8 py-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(activeTab === 'divisi' ? divisions : actions).length === 0 ? (
                <tr><td colSpan="3" className="p-12 text-center text-slate-400 font-medium">Belum ada data yang dikonfigurasi.</td></tr>
              ) : (
                (activeTab === 'divisi' ? divisions : actions).map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-8 py-5 text-sm font-mono text-slate-400">{(index + 1).toString().padStart(2, '0')}</td>
                    <td className="px-8 py-5 font-bold text-slate-700">{item.name}</td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={() => handleDelete(item.id, activeTab)} className="text-red-400 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 shadow-sm p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95" title="Hapus"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}