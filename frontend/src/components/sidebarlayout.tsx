import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Shield, 
  Zap, 
  BarChart3, 
  Bell,
  LogOut,
  Settings 
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'secondary';
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole'); // Clear role on logout
    navigate('/login');
  };

  const menuItems = [
    { icon: Activity,  label: 'DASHBOARD',   path: '/',        role: 'secondary' },
    { icon: Shield,    label: 'DETECTION',   path: '/detection', role: 'secondary' },
    { icon: Zap,       label: 'TRAINING',    path: '/training',  role: 'primary' },
    { icon: BarChart3, label: 'ANALYTICS',   path: '/analytics', role: 'primary' },
    { icon: Bell,      label: 'ALERTS',      path: '/alerts',    role: 'primary' },
    { icon: Settings,  label: 'SETTINGS',    path: '/settings' },
    { icon: Shield,    label: 'ROLE APPROVALS', path: '/admin/role-approvals', role: 'Admin' },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    // 1. Admin Logic: Only see Admin tools and Settings
    if (userRole === 'Admin' || userRole === 'admin') {
      return item.role === 'Admin' || item.label === 'SETTINGS';
    }
    
    // 2. Primary Logic: See primary tools, secondary tools, and Settings
    if (userRole === 'primary') {
      return item.role === 'primary' || item.role === 'secondary' || !item.role;
    }
    
    // 3. Secondary Logic: See ONLY secondary tools and Settings (no role assigned)
    return item.role === 'secondary' || !item.role;
  });

  return (
    <div className="flex h-screen bg-slate-950">
      <div className="w-[220px] h-screen bg-black flex flex-col">
        {/* Logo / Brand */}
        <div className="px-6 py-8 border-b border-slate-900">
          <div className="flex items-center gap-3">
            {/* Shield Icon */}
            <div className="relative">
              <Shield 
                className="w-9 h-9" 
                strokeWidth={2}
                fill="none"
                style={{ color: '#00ff88' }}
              />
            </div>
            
            {/* Brand Text */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#00ff88' }}>
                WARDEN
              </h1>
              <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium mt-0.5">
                NETWORK DEFENSE
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 pt-4 px-2">
          <ul className="space-y-0.5">
            {/* Map over the FILTERED menu items */}
            {filteredMenuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-2.5 rounded-md transition-all duration-200 ${
                      isActive
                        ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-900/30'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-900/30'
                    }`
                  }
                  style={({ isActive }) => 
                    isActive 
                      ? { backgroundColor: 'rgba(0, 255, 136, 0.08)', color: '#00ff88' } // Adjusted background color slightly to match theme
                      : {}
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon 
                        size={18} 
                        strokeWidth={2}
                        style={{ color: isActive ? '#00ff88' : '#64748b' }}
                      />
                      <span className="text-[13px] font-semibold tracking-[0.08em] uppercase">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Role Badge & Logout Button */}
        <div className="border-t border-slate-900 px-2 py-4">
          
          {/* Authorization Level Indicator */}
          <div className="px-4 mb-4">
             <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Auth Level</div>
             <div className={`text-xs font-mono px-2 py-1 rounded inline-block ${
                userRole === 'Admin' ? 'bg-red-900/20 text-red-400 border border-red-900/30' : 
                userRole === 'primary' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 
                'bg-slate-800 text-slate-400 border border-slate-700'
             }`}>
                {userRole === 'Admin' ? 'CENTRAL ADMIN' : 
                 userRole === 'primary' ? 'PRIMARY ANALYST' : 
                 'SECONDARY ANALYST'}
             </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-2.5 text-slate-500 hover:text-red-400 transition-all duration-200 rounded-md hover:bg-slate-900/30"
          >
            <LogOut size={18} strokeWidth={2} />
            <span className="text-[13px] font-semibold tracking-[0.08em] uppercase">
              Logout
            </span>
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default Sidebar;