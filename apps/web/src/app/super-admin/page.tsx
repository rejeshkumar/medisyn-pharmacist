'use client';
import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://successful-playfulness-production-873f.up.railway.app';

const ALL_MODULES = [
  { key: 'patients',      label: 'Patients',        icon: '👤', desc: 'Patient registration & history' },
  { key: 'prescriptions', label: 'Prescriptions',   icon: '📋', desc: 'AI prescription scanner' },
  { key: 'dispensing',    label: 'Dispensing',      icon: '💊', desc: 'Billing & payment' },
  { key: 'procurement',   label: 'Procurement',     icon: '📦', desc: 'Purchase orders & suppliers' },
  { key: 'reports',       label: 'Reports',         icon: '📊', desc: 'GST, Schedule H, analytics' },
  { key: 'hr',            label: 'HR',              icon: '🧑‍💼', desc: 'Attendance & payroll' },
  { key: 'analytics',     label: 'Analytics',       icon: '📈', desc: 'Behaviour dashboard' },
  { key: 'ai_care',       label: 'AI Care Engine',  icon: '🤖', desc: 'Refill & WhatsApp follow-up' },
];

const PLAN_PRESETS = {
  doctor_lite:  { label: 'Doctor Lite',   color: '#6366f1', modules: ['patients','prescriptions','ai_care'] },
  clinic_basic: { label: 'Clinic Basic',  color: '#0ea5e9', modules: ['patients','prescriptions','dispensing','reports'] },
  pharmacy_pro: { label: 'Pharmacy Pro',  color: '#00475a', modules: ['patients','prescriptions','dispensing','procurement','reports','hr','analytics','ai_care'] },
  trial:        { label: 'Trial',         color: '#f59e0b', modules: ['patients','prescriptions','dispensing','reports'] },
};

const ROLES = ['owner','pharmacist','assistant','doctor','receptionist','nurse','office_manager'];

function useApi(token) {
  const call = useCallback(async (method, path, body?) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [token]);
  return call;
}

export default function SuperAdminPage() {
  const [token, setToken] = useState('');
  const [loginForm, setLoginForm] = useState({ mobile: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<'dashboard'|'tenants'|'new-tenant'|'tenant-detail'|'audit'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const api = useApi(token);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    try {
      setLoginError('');
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (data.user?.role !== 'super_admin') throw new Error('Not a super admin account');
      setToken(data.access_token);
      localStorage.setItem('sa_token', data.access_token);
    } catch (e: any) {
      setLoginError(e.message);
    }
  };

  // Auto-restore token
  useEffect(() => {
    const t = localStorage.getItem('sa_token');
    if (t) setToken(t);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    if (view === 'dashboard') {
      api('GET', '/super-admin/stats').then(setStats).catch(() => {});
    }
    if (view === 'tenants') {
      setLoading(true);
      api('GET', `/super-admin/tenants${search ? `?search=${search}` : ''}`)
        .then(setTenants).catch(() => {}).finally(() => setLoading(false));
    }
    if (view === 'audit') {
      api('GET', '/super-admin/audit?limit=100').then(setAuditLog).catch(() => {});
    }
  }, [token, view, search]);

  const loadTenant = async (id: string) => {
    setLoading(true);
    try {
      const t = await api('GET', `/super-admin/tenants/${id}`);
      setSelectedTenant(t);
      setView('tenant-detail');
    } finally { setLoading(false); }
  };

  // ── New Tenant Form ────────────────────────────────────────────────────────
  const [newTenant, setNewTenant] = useState({
    name: '', slug: '', phone: '', email: '', address: '',
    city: '', state: 'Kerala', gstin: '', license_no: '',
    logo_url: '', tagline: '', primary_color: '#00475a', website: '',
    plan: 'pharmacy_pro', mode: 'full',
    modules: [...PLAN_PRESETS.pharmacy_pro.modules],
    trial_ends_at: '',
    owner_name: '', owner_mobile: '', owner_password: '',
  });

  const applyPreset = (preset: string) => {
    setNewTenant(p => ({ ...p, plan: preset, modules: [...PLAN_PRESETS[preset].modules] }));
  };

  const toggleModule = (key: string) => {
    setNewTenant(p => ({
      ...p,
      modules: p.modules.includes(key) ? p.modules.filter(m => m !== key) : [...p.modules, key],
    }));
  };

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleCreateTenant = async () => {
    try {
      setLoading(true);
      await api('POST', '/super-admin/tenants', newTenant);
      showToast(`✅ "${newTenant.name}" created successfully!`);
      setView('tenants');
      setNewTenant({ name:'',slug:'',phone:'',email:'',address:'',city:'',state:'Kerala',gstin:'',license_no:'',logo_url:'',tagline:'',primary_color:'#00475a',website:'',plan:'pharmacy_pro',mode:'full',modules:[...PLAN_PRESETS.pharmacy_pro.modules],trial_ends_at:'',owner_name:'',owner_mobile:'',owner_password:'' });
    } catch(e: any) {
      showToast(e.message, 'error');
    } finally { setLoading(false); }
  };

  // ── Add User to Tenant ─────────────────────────────────────────────────────
  const [newUser, setNewUser] = useState({ full_name:'', mobile:'', role:'pharmacist', password:'' });
  const [showAddUser, setShowAddUser] = useState(false);

  const handleAddUser = async () => {
    try {
      await api('POST', `/super-admin/tenants/${selectedTenant.id}/users`, newUser);
      showToast('User added successfully');
      setShowAddUser(false);
      setNewUser({ full_name:'', mobile:'', role:'pharmacist', password:'' });
      loadTenant(selectedTenant.id);
    } catch(e: any) { showToast(e.message, 'error'); }
  };

  const handleToggleTenant = async (id: string) => {
    await api('PATCH', `/super-admin/tenants/${id}/toggle`);
    setTenants(ts => ts.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
  };

  const handleUpdateModules = async () => {
    try {
      await api('PATCH', `/super-admin/tenants/${selectedTenant.id}`, {
        modules: selectedTenant.modules,
        plan: selectedTenant.plan,
        is_active: selectedTenant.is_active,
        primary_color: selectedTenant.primary_color,
        logo_url: selectedTenant.logo_url,
        tagline: selectedTenant.tagline,
      });
      showToast('Tenant updated successfully');
    } catch(e: any) { showToast(e.message, 'error'); }
  };

  // ── Login Screen ───────────────────────────────────────────────────────────
  if (!token) return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:16, padding:48, width:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🏥</div>
          <h1 style={{ color:'#fff', fontSize:24, fontWeight:700, margin:0 }}>MediSyn</h1>
          <p style={{ color:'#6b7280', fontSize:14, margin:'4px 0 0' }}>Super Admin Console</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input
            placeholder="Mobile number" value={loginForm.mobile}
            onChange={e => setLoginForm(p => ({...p, mobile: e.target.value}))}
            style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, padding:'12px 16px', color:'#fff', fontSize:15, outline:'none' }}
          />
          <input
            type="password" placeholder="Password" value={loginForm.password}
            onChange={e => setLoginForm(p => ({...p, password: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, padding:'12px 16px', color:'#fff', fontSize:15, outline:'none' }}
          />
          {loginError && <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>{loginError}</p>}
          <button onClick={handleLogin}
            style={{ background:'#00475a', color:'#fff', border:'none', borderRadius:8, padding:'13px', fontSize:15, fontWeight:600, cursor:'pointer' }}>
            Sign In
          </button>
        </div>
        <p style={{ color:'#374151', fontSize:12, textAlign:'center', marginTop:24 }}>MediSyn Platform v1.0</p>
      </div>
    </div>
  );

  const S = {
    page: { minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui', display:'flex' } as any,
    sidebar: { width:220, background:'#0a1628', display:'flex', flexDirection:'column', padding:'24px 0' } as any,
    logo: { padding:'0 20px 24px', borderBottom:'1px solid #1f2937' },
    nav: { padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 } as any,
    navItem: (active: boolean) => ({
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8,
      color: active ? '#fff' : '#6b7280', background: active ? '#00475a' : 'transparent',
      cursor:'pointer', fontSize:14, fontWeight: active ? 600 : 400, border:'none', width:'100%', textAlign:'left',
    }) as any,
    main: { flex:1, display:'flex', flexDirection:'column', overflow:'auto' } as any,
    header: { background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' } as any,
    content: { padding:32, flex:1 } as any,
    card: { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:24 } as any,
    statCard: { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:24, flex:1 } as any,
    btn: (color='#00475a') => ({ background:color, color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontSize:14, fontWeight:600, cursor:'pointer' }) as any,
    btnOutline: { background:'transparent', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 18px', fontSize:14, cursor:'pointer' } as any,
    input: { background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none', color:'#111', width:'100%', boxSizing:'border-box' } as any,
    label: { fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 } as any,
    badge: (color: string) => ({ background:`${color}18`, color, borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:600 }) as any,
    table: { width:'100%', borderCollapse:'collapse' as any },
    th: { textAlign:'left' as any, padding:'12px 16px', fontSize:12, fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb', textTransform:'uppercase' as any, letterSpacing:'0.05em' },
    td: { padding:'14px 16px', fontSize:14, color:'#374151', borderBottom:'1px solid #f3f4f6' },
  };

  const navItems = [
    { key:'dashboard', label:'Dashboard', icon:'⚡' },
    { key:'tenants',   label:'Tenants',   icon:'🏥' },
    { key:'new-tenant',label:'New Tenant', icon:'➕' },
    { key:'audit',     label:'Audit Log', icon:'📋' },
  ];

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background: toast.type==='success'?'#059669':'#dc2626', color:'#fff', borderRadius:8, padding:'12px 20px', fontSize:14, fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.logo}>
          <div style={{ color:'#fff', fontWeight:800, fontSize:18 }}>🏥 MediSyn</div>
          <div style={{ color:'#4b5563', fontSize:11, marginTop:2 }}>Super Admin Console</div>
        </div>
        <nav style={S.nav}>
          {navItems.map(n => (
            <button key={n.key} style={S.navItem(view===n.key)} onClick={() => setView(n.key as any)}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <button style={{ ...S.navItem(false), marginTop:'auto', color:'#ef4444' }}
            onClick={() => { localStorage.removeItem('sa_token'); setToken(''); }}>
            <span>🚪</span>Sign Out
          </button>
        </nav>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.header}>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:'#111' }}>
            { view==='dashboard' ? 'Dashboard'
            : view==='tenants' ? 'All Tenants'
            : view==='new-tenant' ? 'Onboard New Tenant'
            : view==='tenant-detail' ? selectedTenant?.name
            : 'Audit Log' }
          </h2>
          <div style={{ fontSize:12, color:'#6b7280' }}>Powered by MediSyn Platform</div>
        </div>

        <div style={S.content}>

          {/* ── DASHBOARD ── */}
          {view==='dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
                {[
                  { label:'Total Tenants', value: stats?.tenants?.total ?? '—', sub: `${stats?.tenants?.active ?? 0} active`, color:'#00475a' },
                  { label:'Total Users', value: stats?.users?.total ?? '—', sub:'across all tenants', color:'#6366f1' },
                  { label:'Bills (30d)', value: stats?.last30days?.bills ?? '—', sub:`₹${Number(stats?.last30days?.revenue||0).toLocaleString('en-IN')} revenue`, color:'#0ea5e9' },
                  { label:'Active Today', value: stats?.activeToday?.tenants ?? '—', sub:'clinics used today', color:'#059669' },
                ].map(s => (
                  <div key={s.label} style={S.statCard}>
                    <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#111', marginTop:4 }}>{s.label}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.card, textAlign:'center', padding:48 }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🚀</div>
                <h3 style={{ color:'#111', margin:'0 0 8px' }}>Welcome to MediSyn Admin</h3>
                <p style={{ color:'#6b7280', margin:'0 0 24px' }}>Manage all your clinic and pharmacy tenants from one place</p>
                <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                  <button style={S.btn()} onClick={() => setView('new-tenant')}>➕ Onboard New Tenant</button>
                  <button style={S.btnOutline} onClick={() => setView('tenants')}>🏥 View All Tenants</button>
                </div>
              </div>
            </div>
          )}

          {/* ── TENANTS LIST ── */}
          {view==='tenants' && (
            <div style={S.card}>
              <div style={{ display:'flex', gap:12, marginBottom:20 }}>
                <input placeholder="Search tenants..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...S.input, width:280 }} />
                <button style={S.btn()} onClick={() => setView('new-tenant')}>➕ New Tenant</button>
              </div>
              {loading ? <p style={{ color:'#6b7280' }}>Loading...</p> : (
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Clinic / Pharmacy','Plan','Mode','Users','Bills (30d)','Status','Actions'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id} style={{ cursor:'pointer' }}>
                        <td style={S.td}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            {t.logo_url
                              ? <img src={t.logo_url} alt="" style={{ width:32, height:32, borderRadius:6, objectFit:'cover' }} />
                              : <div style={{ width:32, height:32, borderRadius:6, background: t.primary_color||'#00475a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14 }}>{t.name[0]}</div>
                            }
                            <div>
                              <div style={{ fontWeight:600, color:'#111' }}>{t.name}</div>
                              <div style={{ fontSize:12, color:'#6b7280' }}>{t.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td style={S.td}><span style={S.badge(PLAN_PRESETS[t.plan]?.color||'#6b7280')}>{PLAN_PRESETS[t.plan]?.label||t.plan}</span></td>
                        <td style={S.td}><span style={{ fontSize:13, color:'#374151', textTransform:'capitalize' }}>{t.mode}</span></td>
                        <td style={S.td}>{t.user_count}</td>
                        <td style={S.td}>{t.bills_last_30d}</td>
                        <td style={S.td}>
                          <span style={S.badge(t.is_active?'#059669':'#ef4444')}>
                            {t.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display:'flex', gap:8 }}>
                            <button style={{ ...S.btn('#6366f1'), padding:'6px 12px', fontSize:12 }}
                              onClick={() => loadTenant(t.id)}>Manage</button>
                            <button style={{ ...S.btn(t.is_active?'#ef4444':'#059669'), padding:'6px 12px', fontSize:12 }}
                              onClick={() => handleToggleTenant(t.id)}>
                              {t.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── NEW TENANT ── */}
          {view==='new-tenant' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Plan Presets */}
              <div style={S.card}>
                <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>1. Choose Plan</h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {Object.entries(PLAN_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      style={{ border:`2px solid ${newTenant.plan===key ? p.color : '#e5e7eb'}`, borderRadius:10, padding:16, background: newTenant.plan===key ? `${p.color}10` : '#fff', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ fontWeight:700, color: p.color, marginBottom:4 }}>{p.label}</div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>{p.modules.length} modules</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinic Info */}
              <div style={S.card}>
                <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>2. Clinic / Pharmacy Details</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[
                    { label:'Clinic Name *', key:'name', placeholder:'MediSyn Speciality Clinic' },
                    { label:'URL Slug *', key:'slug', placeholder:'medisyn-taliparamba' },
                    { label:'Phone', key:'phone', placeholder:'+91 9876543210' },
                    { label:'Email', key:'email', placeholder:'clinic@example.com' },
                    { label:'GSTIN', key:'gstin', placeholder:'29ABCDE1234F1Z5' },
                    { label:'Drug License No.', key:'license_no', placeholder:'KL/XXX/2024' },
                    { label:'City', key:'city', placeholder:'Taliparamba' },
                    { label:'State', key:'state', placeholder:'Kerala' },
                    { label:'Website', key:'website', placeholder:'https://clinic.com' },
                    { label:'Tagline', key:'tagline', placeholder:'Your health, our priority' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <input style={S.input} placeholder={f.placeholder} value={newTenant[f.key]}
                        onChange={e => {
                          const val = e.target.value;
                          setNewTenant(p => ({
                            ...p,
                            [f.key]: val,
                            ...(f.key==='name' && !p.slug ? { slug: autoSlug(val) } : {}),
                          }));
                        }} />
                    </div>
                  ))}
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={S.label}>Address</label>
                    <input style={S.input} placeholder="Full address" value={newTenant.address}
                      onChange={e => setNewTenant(p => ({...p, address: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div style={S.card}>
                <h3 style={{ margin:'0 0 4px', fontSize:16, color:'#111' }}>3. Branding</h3>
                <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
                  Clinic gets their own logo and colours. App footer will show "Powered by MediSyn".
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  <div>
                    <label style={S.label}>Logo URL</label>
                    <input style={S.input} placeholder="https://..." value={newTenant.logo_url}
                      onChange={e => setNewTenant(p => ({...p, logo_url: e.target.value}))} />
                  </div>
                  <div>
                    <label style={S.label}>Brand Colour</label>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="color" value={newTenant.primary_color}
                        onChange={e => setNewTenant(p => ({...p, primary_color: e.target.value}))}
                        style={{ width:44, height:38, borderRadius:6, border:'1px solid #e5e7eb', cursor:'pointer', padding:2 }} />
                      <input style={{ ...S.input, flex:1 }} value={newTenant.primary_color}
                        onChange={e => setNewTenant(p => ({...p, primary_color: e.target.value}))} />
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Trial Ends At</label>
                    <input type="date" style={S.input} value={newTenant.trial_ends_at}
                      onChange={e => setNewTenant(p => ({...p, trial_ends_at: e.target.value}))} />
                  </div>
                </div>
                {/* Preview */}
                <div style={{ marginTop:16, background:'#f8fafc', borderRadius:10, padding:16, border:'1px solid #e5e7eb' }}>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>App Header Preview:</div>
                  <div style={{ background: newTenant.primary_color, borderRadius:8, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {newTenant.logo_url
                        ? <img src={newTenant.logo_url} alt="" style={{ width:32, height:32, borderRadius:6, objectFit:'cover' }} />
                        : <div style={{ width:32, height:32, borderRadius:6, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700 }}>
                            {newTenant.name?.[0]||'M'}
                          </div>
                      }
                      <div>
                        <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{newTenant.name||'Clinic Name'}</div>
                        {newTenant.tagline && <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11 }}>{newTenant.tagline}</div>}
                      </div>
                    </div>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Powered by MediSyn</div>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div style={S.card}>
                <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>4. Enable Modules</h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {ALL_MODULES.map(m => {
                    const active = newTenant.modules.includes(m.key);
                    return (
                      <div key={m.key} onClick={() => toggleModule(m.key)}
                        style={{ border:`2px solid ${active?'#00475a':'#e5e7eb'}`, borderRadius:10, padding:14, cursor:'pointer', background: active?'#f0f9fa':'#fff', transition:'all 0.15s' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <span style={{ fontSize:20 }}>{m.icon}</span>
                          <div style={{ width:18, height:18, borderRadius:4, background: active?'#00475a':'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {active && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
                          </div>
                        </div>
                        <div style={{ fontWeight:600, fontSize:13, color:'#111', marginTop:8 }}>{m.label}</div>
                        <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{m.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owner Account */}
              <div style={S.card}>
                <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>5. Owner Account</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  <div>
                    <label style={S.label}>Owner Full Name *</label>
                    <input style={S.input} placeholder="Dr. Rejesh Kumar" value={newTenant.owner_name}
                      onChange={e => setNewTenant(p => ({...p, owner_name: e.target.value}))} />
                  </div>
                  <div>
                    <label style={S.label}>Mobile Number *</label>
                    <input style={S.input} placeholder="9876543210" value={newTenant.owner_mobile}
                      onChange={e => setNewTenant(p => ({...p, owner_mobile: e.target.value}))} />
                  </div>
                  <div>
                    <label style={S.label}>Password *</label>
                    <input type="password" style={S.input} placeholder="Min 8 characters" value={newTenant.owner_password}
                      onChange={e => setNewTenant(p => ({...p, owner_password: e.target.value}))} />
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <button style={S.btn()} onClick={handleCreateTenant} disabled={loading}>
                  {loading ? 'Creating...' : '🚀 Create Tenant'}
                </button>
                <button style={S.btnOutline} onClick={() => setView('tenants')}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── TENANT DETAIL ── */}
          {view==='tenant-detail' && selectedTenant && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <button style={{ ...S.btnOutline, alignSelf:'flex-start' }} onClick={() => setView('tenants')}>← Back</button>

              {/* Branding + Modules */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <div style={S.card}>
                  <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>Branding</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div>
                      <label style={S.label}>Logo URL</label>
                      <input style={S.input} value={selectedTenant.logo_url||''}
                        onChange={e => setSelectedTenant(p => ({...p, logo_url: e.target.value}))} />
                    </div>
                    <div>
                      <label style={S.label}>Brand Colour</label>
                      <div style={{ display:'flex', gap:8 }}>
                        <input type="color" value={selectedTenant.primary_color||'#00475a'}
                          onChange={e => setSelectedTenant(p => ({...p, primary_color: e.target.value}))}
                          style={{ width:44, height:38, borderRadius:6, border:'1px solid #e5e7eb', padding:2, cursor:'pointer' }} />
                        <input style={{ ...S.input, flex:1 }} value={selectedTenant.primary_color||'#00475a'}
                          onChange={e => setSelectedTenant(p => ({...p, primary_color: e.target.value}))} />
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Tagline</label>
                      <input style={S.input} value={selectedTenant.tagline||''}
                        onChange={e => setSelectedTenant(p => ({...p, tagline: e.target.value}))} />
                    </div>
                    {/* Live Preview */}
                    <div style={{ background: selectedTenant.primary_color||'#00475a', borderRadius:8, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ color:'#fff', fontWeight:700 }}>{selectedTenant.name}</div>
                      <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Powered by MediSyn</div>
                    </div>
                  </div>
                </div>

                <div style={S.card}>
                  <h3 style={{ margin:'0 0 8px', fontSize:16, color:'#111' }}>Plan & Modules</h3>
                  <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                    {Object.entries(PLAN_PRESETS).map(([key, p]) => (
                      <button key={key}
                        style={{ ...S.badge(PLAN_PRESETS[key].color), cursor:'pointer', border: selectedTenant.plan===key?`2px solid ${p.color}`:'2px solid transparent' }}
                        onClick={() => setSelectedTenant(prev => ({...prev, plan: key, modules: [...p.modules]}))}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {ALL_MODULES.map(m => {
                      const mods = selectedTenant.modules || [];
                      const active = mods.includes(m.key);
                      return (
                        <div key={m.key} onClick={() => setSelectedTenant(p => ({ ...p, modules: active ? mods.filter(x=>x!==m.key) : [...mods,m.key] }))}
                          style={{ border:`1.5px solid ${active?'#00475a':'#e5e7eb'}`, borderRadius:8, padding:'10px 12px', cursor:'pointer', background:active?'#f0f9fa':'#fff', display:'flex', alignItems:'center', gap:8 }}>
                          <span>{m.icon}</span>
                          <span style={{ fontSize:13, fontWeight: active?600:400, color: active?'#00475a':'#6b7280' }}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button style={S.btn()} onClick={handleUpdateModules}>💾 Save Changes</button>

              {/* Users */}
              <div style={S.card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <h3 style={{ margin:0, fontSize:16, color:'#111' }}>Users ({selectedTenant.users?.length||0})</h3>
                  <button style={S.btn()} onClick={() => setShowAddUser(true)}>➕ Add User</button>
                </div>

                {showAddUser && (
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:16, marginBottom:16, border:'1px solid #e5e7eb' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                      <div>
                        <label style={S.label}>Full Name</label>
                        <input style={S.input} value={newUser.full_name} onChange={e=>setNewUser(p=>({...p,full_name:e.target.value}))} />
                      </div>
                      <div>
                        <label style={S.label}>Mobile</label>
                        <input style={S.input} value={newUser.mobile} onChange={e=>setNewUser(p=>({...p,mobile:e.target.value}))} />
                      </div>
                      <div>
                        <label style={S.label}>Role</label>
                        <select style={S.input} value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Password</label>
                        <input type="password" style={S.input} value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} />
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button style={S.btn()} onClick={handleAddUser}>Add User</button>
                      <button style={S.btnOutline} onClick={()=>setShowAddUser(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                <table style={S.table}>
                  <thead>
                    <tr>{['Name','Mobile','Role','Status','Joined'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(selectedTenant.users||[]).map(u => (
                      <tr key={u.id}>
                        <td style={S.td}><span style={{ fontWeight:600 }}>{u.full_name}</span></td>
                        <td style={S.td}>{u.mobile}</td>
                        <td style={S.td}><span style={S.badge('#6366f1')}>{u.role}</span></td>
                        <td style={S.td}><span style={S.badge(u.status==='active'?'#059669':'#ef4444')}>{u.status}</span></td>
                        <td style={S.td}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {view==='audit' && (
            <div style={S.card}>
              <h3 style={{ margin:'0 0 16px', fontSize:16, color:'#111' }}>Audit Log</h3>
              <table style={S.table}>
                <thead>
                  <tr>{['Time','Tenant','User','Action','Entity','Details'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {auditLog.map((a,i) => (
                    <tr key={i}>
                      <td style={S.td}>{new Date(a.created_at).toLocaleString('en-IN')}</td>
                      <td style={S.td}>{a.tenant_name||'—'}</td>
                      <td style={S.td}>{a.user_name||'—'}</td>
                      <td style={S.td}><span style={S.badge(a.action==='CREATE'?'#059669':a.action==='DELETE'?'#ef4444':'#6366f1')}>{a.action}</span></td>
                      <td style={S.td}>{a.entity}</td>
                      <td style={S.td} style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.entity_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
