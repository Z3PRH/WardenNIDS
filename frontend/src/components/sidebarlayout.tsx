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

  // 2. Add a 'requiresPrimary' flag to the restricted routes
  const menuItems = [
    { 
      icon: Activity, 
      label: 'DASHBOARD',   
      path: '/' 
    },
    { 
      icon: Shield, 
      label: 'DETECTION', 
      path: '/detection',
      allowedRole: 'secondary' 
    },
    { 
      icon: Zap, 
      label: 'TRAINING', 
      path: '/training',
      allowedRole: 'primary' 
    },
    { 
      icon: BarChart3, 
      label: 'ANALYTICS', 
      path: '/analytics',
      allowedRole: 'primary' 
    },
    { 
      icon: Bell, 
      label: 'ALERTS', 
      path: '/alerts' 
    },
    { 
      icon: Settings, 
      label: 'SETTINGS', 
      path: '/settings' 
    },
  ];

  const filteredMenu = menuItems.filter(item => {
    // If no role is specified, everyone sees it
    if (!item.allowedRole) return true;
    // Otherwise, check if userRole matches the requirement
    return item.allowedRole === userRole;
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
            {filteredMenu.map((item) => (
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
             <div className={`text-xs font-mono px-2 py-1 rounded inline-block ${userRole === 'primary' ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                {userRole === 'primary' ? 'PRIMARY ANALYST' : 'SECONDARY ANALYST'}
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