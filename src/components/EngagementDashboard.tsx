import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Download,
  Trash2,
  BarChart3,
  Users2,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  History,
  Settings,
  Instagram,
  Facebook,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  Activity,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { DailyEngagement, Employee } from '../types';
import EmployeeManager from './EmployeeManager';
import { useAuth } from './FirebaseProvider';
import { db, signIn, logout } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import jsPDF from 'jspdf';
import { domToPng } from 'modern-screenshot';

const getLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function EngagementDashboard() {
  const { user, loading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyEngagements, setDailyEngagements] = useState<DailyEngagement[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate(new Date()));
  const [igRawInput, setIgRawInput] = useState('');
  const [fbRawInput, setFbRawInput] = useState('');
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [currentDailyDate, setCurrentDailyDate] = useState(new Date());
  const [weeklySortMode, setWeeklySortMode] = useState<'name' | 'bidang'>('bidang');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const printDailyRef = useRef<HTMLDivElement>(null);

  const getBidangColor = (bidang?: string) => {
    if (!bidang) return "bg-slate-100 text-slate-400";
    
    // Specific overrides
    if (bidang.toLowerCase() === 'infrastruktur') return "bg-slate-200 text-slate-700";
    if (bidang.toLowerCase() === 'sekretariat') return "bg-white text-slate-900 border border-slate-200";

    const colors = [
      "bg-pink-100 text-pink-600",
      "bg-sky-100 text-sky-600",
      "bg-orange-100 text-orange-600",
      "bg-emerald-100 text-emerald-600",
      "bg-slate-100 text-slate-600",
    ];
    let hash = 0;
    for (let i = 0; i < bidang.length; i++) {
      hash = bidang.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Load employees from Firestore
  useEffect(() => {
    if (loading || !user) {
      setEmployees([]);
      return;
    }

    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
    });
    return unsubscribe;
  }, [user, loading]);

  // Load all daily engagements
  useEffect(() => {
    if (loading || !user) {
      setDailyEngagements([]);
      return;
    }

    const q = query(collection(db, 'dailyEngagement'), orderBy('date', 'desc'), limit(30));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyEngagement));
      setDailyEngagements(data);
    });
    return unsubscribe;
  }, [user, loading]);

  // Load raw text for selected date if exists
  useEffect(() => {
    const existing = dailyEngagements.find(d => d.id === selectedDate);
    if (existing) {
      setIgRawInput(existing.igRawText || '');
      setFbRawInput(existing.fbRawText || '');
    } else {
      setIgRawInput('');
      setFbRawInput('');
    }
  }, [selectedDate, dailyEngagements]);

  const handleExportPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    setIsLoading(true);
    setIsExporting(true);
    // Wait for state to apply and DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const imgData = await domToPng(ref.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      
      // Calculate dimensions
      const img = new Image();
      img.src = imgData;
      await new Promise(resolve => { img.onload = resolve; });
      
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`${filename}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch (error) {
      console.error(error);
      toast.error("Gagal membuat PDF");
    } finally {
      setIsExporting(false);
      setIsLoading(false);
    }
  };

  const handleExportImage = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    setIsLoading(true);
    setIsExporting(true);
    // Wait for state to apply and DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const imgData = await domToPng(ref.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = imgData;
      link.click();
      toast.success("Gambar berhasil disimpan");
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan gambar");
    } finally {
      setIsExporting(false);
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const engagement = dailyEngagements.find(d => d.id === date);
      const igCount = engagement?.igEngagedEmployeeIds?.length || 0;
      const fbCount = engagement?.fbEngagedEmployeeIds?.length || 0;
      return {
        name: new Date(date).toLocaleDateString('id-ID', { weekday: 'short' }),
        ig: igCount,
        fb: fbCount,
        total: igCount + fbCount
      };
    });
  }, [dailyEngagements]);

  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const today = new Date().toISOString().split('T')[0];
    const todayEng = dailyEngagements.find(d => d.id === today);
    const todayCount = (todayEng?.igEngagedEmployeeIds?.length || 0) + (todayEng?.fbEngagedEmployeeIds?.length || 0);
    const totalEngagements = dailyEngagements.reduce((acc, curr) => 
      acc + (curr.igEngagedEmployeeIds?.length || 0) + (curr.fbEngagedEmployeeIds?.length || 0), 0
    );
    
    return {
      totalEmployees,
      todayCount,
      totalEngagements,
      engagementRate: totalEmployees > 0 ? Math.round(((todayEng?.igEngagedEmployeeIds?.length || 0) / totalEmployees) * 100) : 0
    };
  }, [employees, dailyEngagements]);

  const handleSaveEngagement = async () => {
    if (!user) {
      toast.error('Anda harus login untuk menyimpan data');
      return;
    }
    
    setIsLoading(true);
    try {
      const processInput = (input: string) => {
        const lowerInput = input.toLowerCase();
        const matchedIds: string[] = [];
        
        employees.forEach(emp => {
          const nameMatch = emp.name.toLowerCase().trim();
          const igMatch = emp.igUsername?.replace('@', '').toLowerCase().trim();
          const fbMatch = emp.fbName?.toLowerCase().trim();
          
          if ((nameMatch && lowerInput.includes(nameMatch)) || 
              (igMatch && lowerInput.includes(igMatch)) || 
              (fbMatch && lowerInput.includes(fbMatch))) {
            matchedIds.push(emp.id);
          }
        });
        return matchedIds;
      };

      const igEngagedIds = processInput(igRawInput);
      const fbEngagedIds = processInput(fbRawInput);

      await setDoc(doc(db, 'dailyEngagement', selectedDate), {
        date: selectedDate,
        igRawText: igRawInput,
        fbRawText: fbRawInput,
        igEngagedEmployeeIds: igEngagedIds,
        fbEngagedEmployeeIds: fbEngagedIds,
        updatedAt: serverTimestamp()
      });

      toast.success(`Data rekap tanggal ${selectedDate} berhasil disimpan`);
      setIsInputModalOpen(false);
    } catch (error: any) {
      console.error('Error saving engagement:', error);
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        toast.error('Akses ditolak: Anda tidak memiliki izin untuk menyimpan data ini.');
      } else {
        toast.error(`Gagal menyimpan data: ${error.message || 'Kesalahan tidak diketahui'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    // Padding for start of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ day: null, date: '', isCurrentMonth: false, isToday: false, isFilled: false, isFuture: false });
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = getLocalISODate(date);
      const engagement = dailyEngagements.find(e => e.id === dateStr);
      days.push({
        day: d,
        date: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === getLocalISODate(new Date()),
        isFilled: !!engagement && ((engagement.igEngagedEmployeeIds?.length || 0) > 0 || (engagement.fbEngagedEmployeeIds?.length || 0) > 0),
        isFuture: date > new Date()
      });
    }
    return days;
  }, [currentMonth, dailyEngagements]);

  const weeklyReports = useMemo(() => {
    if (employees.length === 0) return [];

    // Get Monday of the current week date
    const date = new Date(currentWeekDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(getLocalISODate(d));
    }

    // Calculate ISO week number
    const target = new Date(monday.valueOf());
    const dayNr = (monday.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const todayStr = getLocalISODate(new Date());

    return [{
      weekNumber: weekNum,
      monthName: monday.toLocaleDateString('id-ID', { month: 'long' }),
      year: monday.getFullYear(),
      weekRange: `${new Date(weekDates[0]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(weekDates[6]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      dates: weekDates,
      isCurrentWeek: weekDates.includes(todayStr)
    }];
  }, [employees, currentWeekDate]);

  const changeWeek = (offset: number) => {
    const newDate = new Date(currentWeekDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setCurrentWeekDate(newDate);
  };

  const changeDailyDate = (offset: number) => {
    const newDate = new Date(currentDailyDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDailyDate(newDate);
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + offset);
    setCurrentMonth(newMonth);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-[#fafafa] font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50 transition-transform duration-300 ease-in-out",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <BarChart3 className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">RecapLink</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Smart Engine</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden rounded-full" onClick={() => setIsSidebarOpen(false)}>
              <XCircle className="text-slate-400" size={24} />
            </Button>
          </div>

          <nav className="space-y-1.5">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
            />
            <NavItem 
              active={activeTab === 'overview'} 
              onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} 
              icon={<CalendarIcon size={20} />} 
              label="Input Rekap Harian" 
            />
            <NavItem 
              active={activeTab === 'daily-report'} 
              onClick={() => { setActiveTab('daily-report'); setIsSidebarOpen(false); }} 
              icon={<FileText size={20} />} 
              label="Laporan Harian" 
            />
            <NavItem 
              active={activeTab === 'reports'} 
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} 
              icon={<History size={20} />} 
              label="Laporan Mingguan" 
            />
            <NavItem 
              active={activeTab === 'employees'} 
              onClick={() => { setActiveTab('employees'); setIsSidebarOpen(false); }} 
              icon={<Users2 size={20} />} 
              label="Data Pegawai" 
            />
          </nav>
        </div>

        {/* Login/Logout Button at bottom of sidebar */}
        <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
          {!user ? (
            <Button 
              onClick={signIn} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md font-bold text-sm h-12 transition-all active:scale-95"
            >
              Login dengan Google
            </Button>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm border-2 border-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.displayName || user.email}</p>
                  <p className="text-[10px] text-slate-500 truncate font-medium">{user.email}</p>
                </div>
              </div>
              <Button 
                onClick={logout} 
                variant="outline" 
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-rose-600 rounded-xl font-bold text-xs h-10 transition-colors"
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Floating Mobile Menu Button */}
        <Button 
          variant="outline" 
          size="icon" 
          className="fixed top-4 left-4 z-40 lg:hidden bg-white/80 backdrop-blur-md shadow-sm border-slate-200 rounded-xl" 
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu className="text-slate-600" size={20} />
        </Button>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pt-16 lg:pt-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Dashboard Utama</h2>
                      <p className="text-slate-500 text-xs">Ringkasan statistik dan tren engagement pegawai</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <StatCard 
                      title="Total Pegawai" 
                      value={stats.totalEmployees.toString()} 
                      icon={<Users2 size={20} />} 
                      color="violet" 
                    />
                    <StatCard 
                      title="Rekap Hari Ini" 
                      value={stats.todayCount.toString()} 
                      icon={<Activity size={20} />} 
                      color="emerald" 
                    />
                    <StatCard 
                      title="Total Engagement" 
                      value={stats.totalEngagements.toString()} 
                      icon={<TrendingUp size={20} />} 
                      color="sky" 
                    />
                    <StatCard 
                      title="Engagement Rate" 
                      value={`${stats.engagementRate}%`} 
                      icon={<CheckCircle2 size={20} />} 
                      color="rose" 
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    <Card className="lg:col-span-2 border-slate-100/50 shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="p-6 border-b border-slate-50">
                        <CardTitle className="text-base font-bold">Tren Engagement (7 Hari Terakhir)</CardTitle>
                        <CardDescription className="text-xs">Perbandingan interaksi harian Instagram & Facebook</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 h-[300px] min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="ig" name="Instagram" stackId="a" fill="#ec4899" radius={[0, 0, 0, 0]} barSize={32} />
                            <Bar dataKey="fb" name="Facebook" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-1 border-slate-100/50 shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="p-6 border-b border-slate-50">
                        <CardTitle className="text-base font-bold">Aktivitas Terakhir</CardTitle>
                        <CardDescription className="text-xs">Riwayat pembaruan data rekap</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-[300px]">
                          <div className="divide-y divide-slate-50">
                            {dailyEngagements.slice(0, 5).map((eng, i) => (
                              <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                    <CalendarIcon size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">{new Date(eng.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</p>
                                    <p className="text-[10px] text-slate-400">{(eng.igEngagedEmployeeIds?.length || 0) + (eng.fbEngagedEmployeeIds?.length || 0)} Interaksi</p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-[9px] font-bold border-slate-100 text-slate-400">Selesai</Badge>
                              </div>
                            ))}
                            {dailyEngagements.length === 0 && (
                              <div className="p-8 text-center text-slate-400 text-xs italic">Belum ada aktivitas.</div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
               {activeTab === 'overview' && (
                <motion.div 
                  key="overview"
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Rekap Harian</h2>
                      <p className="text-slate-500 text-xs">Pilih tanggal pada kalender untuk mengisi atau melihat data rekapitulasi</p>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full md:w-auto justify-between">
                      <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                        <ChevronLeft size={16} />
                      </Button>
                      <div className="text-center px-4 min-w-[140px]">
                        <h2 className="text-sm font-bold text-slate-900">
                          {currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                        </h2>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-slate-100">
                    <div className="flex justify-end mb-6">
                      <div className="flex gap-4 md:gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/50 px-4 md:px-6 py-3 rounded-2xl border border-slate-100 w-full md:w-auto justify-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-sm" /> Terisi
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-200" /> Kosong
                        </div>
                      </div>
                    </div>

                    <div className="overflow-auto max-h-[500px] pb-4">
                      <div className="min-w-[500px]">
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-3">
                          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                            <div key={day} className="text-center py-1 md:py-2 text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {day}
                            </div>
                          ))}
                          {calendarDays.map((day, idx) => (
                            <div key={idx} className="aspect-square">
                              {day.day ? (
                                <button
                                  onClick={() => {
                                    setSelectedDate(day.date);
                                    setIsInputModalOpen(true);
                                  }}
                                  disabled={day.isFuture}
                                  className={cn(
                                    "w-full h-full rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-0.5 md:gap-1 transition-all relative group border",
                                    day.isFuture ? "bg-slate-50/50 cursor-not-allowed opacity-30 border-transparent" : 
                                    day.isFilled ? "bg-slate-900 text-white shadow-sm border-slate-900 hover:bg-slate-800" : 
                                    "bg-white text-slate-600 hover:bg-slate-50 border-slate-100"
                                  )}
                                >
                                  <span className="text-sm sm:text-base font-bold">{day.day}</span>
                                  <div className="flex gap-0.5">
                                    {day.isFilled && (
                                      <>
                                        <div className="w-1 h-1 rounded-full bg-pink-400" />
                                        <div className="w-1 h-1 rounded-full bg-blue-400" />
                                      </>
                                    )}
                                  </div>
                                </button>
                              ) : (
                                <div className="w-full h-full" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input Modal */}
                  <AnimatePresence>
                    {isInputModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
                        >
                          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">Input Rekapitulasi</h3>
                              <p className="text-xs text-slate-500">{new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsInputModalOpen(false)} className="rounded-full">
                              <XCircle className="text-slate-400" size={20} />
                            </Button>
                          </div>
                          
                          <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Instagram size={12} className="text-pink-500" />
                                  List Nama/Username IG
                                </label>
                                <textarea
                                  value={igRawInput}
                                  onChange={(e) => setIgRawInput(e.target.value)}
                                  placeholder="Paste list nama atau username di sini..."
                                  className="w-full h-40 p-4 rounded-xl border border-slate-200 bg-slate-50/30 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-sm resize-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Facebook size={12} className="text-blue-500" />
                                  List Nama/Username FB
                                </label>
                                <textarea
                                  value={fbRawInput}
                                  onChange={(e) => setFbRawInput(e.target.value)}
                                  placeholder="Paste list nama atau username di sini..."
                                  className="w-full h-40 p-4 rounded-xl border border-slate-200 bg-slate-50/30 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-sm resize-none"
                                />
                              </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[10px] text-slate-500 leading-relaxed">
                                <span className="font-bold text-slate-900">Tips:</span> Sistem akan otomatis mendeteksi nama atau username yang sesuai dengan database pegawai. Anda bisa langsung menempelkan (paste) data dari sumber manapun.
                              </p>
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsInputModalOpen(false)} className="font-bold text-xs rounded-xl h-11 px-6">
                              Batal
                            </Button>
                            <Button 
                              onClick={handleSaveEngagement} 
                              disabled={isLoading}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl h-11 px-8 shadow-lg shadow-indigo-100 border-none"
                            >
                              {isLoading ? 'Menyimpan...' : 'Simpan Data Rekap'}
                            </Button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
              {activeTab === 'daily-report' && (
                <motion.div 
                  key="daily-report"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Laporan Harian</h2>
                      <p className="text-slate-500 text-xs">Unduh dan lihat rekapitulasi engagement harian</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                      <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full sm:w-auto justify-between">
                        <Button variant="ghost" size="icon" onClick={() => changeDailyDate(-1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                          <ChevronLeft size={16} />
                        </Button>
                        <div className="text-center px-4 min-w-[200px]">
                          <div className="flex items-center justify-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900">
                              {currentDailyDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h2>
                            {getLocalISODate(currentDailyDate) === getLocalISODate(new Date()) && (
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[9px] px-1.5 py-0">Hari Ini</Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => changeDailyDate(1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                          <button 
                            onClick={() => setWeeklySortMode('bidang')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", weeklySortMode === 'bidang' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                          >
                            Bidang
                          </button>
                          <button 
                            onClick={() => setWeeklySortMode('name')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", weeklySortMode === 'name' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                          >
                            Nama
                          </button>
                        </div>
                        <Button onClick={() => handleExportPDF(printDailyRef, `recaplink-harian-${getLocalISODate(currentDailyDate)}`)} disabled={isLoading} className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 h-11 shadow-md font-bold text-xs border-none">
                          <FileText size={14} />
                          Export PDF
                        </Button>
                        <Button onClick={() => handleExportImage(printDailyRef, `recaplink-harian-${getLocalISODate(currentDailyDate)}`)} disabled={isLoading} variant="outline" className="flex-1 sm:flex-none gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl px-4 h-11 font-bold text-xs">
                          <ImageIcon size={14} />
                          Save Image
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div ref={printDailyRef} className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[600px] flex flex-col", isExporting ? "p-4 md:p-6 w-max min-w-full" : "p-6 md:p-10")}>
                    <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 gap-2", isExporting ? "mb-3 pb-3" : "mb-8 pb-6")}>
                      <div className="space-y-0.5">
                        <h3 className={cn("font-black text-slate-900 tracking-tight uppercase", isExporting ? "text-lg" : "text-2xl")}>Laporan Harian</h3>
                        <p className={cn("font-bold text-slate-500 uppercase tracking-widest", isExporting ? "text-[10px]" : "text-sm")}>Rekapitulasi Engagement • {currentDailyDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                      <div className={cn("text-left md:text-right bg-slate-50 rounded-xl border border-slate-100", isExporting ? "p-2" : "p-3")}>
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">RecapLink</p>
                        <p className="text-[8px] text-slate-500">Generated: {new Date().toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>

                    <div className={cn("flex-1 rounded-xl border border-slate-100", !isExporting && "overflow-auto max-h-[600px]")}>
                      <div className="min-w-[600px]">
                        <Table className="border-collapse min-w-full">
                          <TableHeader>
                            <TableRow className="bg-slate-50/50 border-b border-slate-100">
                              <TableHead className="sticky left-0 z-20 bg-slate-50 border-r border-slate-100 px-3 py-2 font-bold text-slate-900 w-[1%] whitespace-nowrap text-[10px] uppercase tracking-wider">
                                Nama Pegawai
                              </TableHead>
                              <TableHead className="border-r border-slate-100 px-3 py-2 font-bold text-slate-900 w-[1%] whitespace-nowrap text-[10px] uppercase tracking-wider">
                                NIP
                              </TableHead>
                              <TableHead className="border-r border-slate-100 px-3 py-2 font-bold text-slate-900 w-[1%] whitespace-nowrap text-[10px] uppercase tracking-wider">
                                Bidang
                              </TableHead>
                              <TableHead className="border-r border-slate-100 text-center px-3 py-2 text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                                Instagram
                              </TableHead>
                              <TableHead className="text-center px-3 py-2 text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                                Facebook
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employees.slice().sort((a, b) => {
                              if (weeklySortMode === 'name') {
                                return a.name.localeCompare(b.name);
                              }
                              return (a.bidang || '').localeCompare(b.bidang || '') || a.name.localeCompare(b.name);
                            }).map((emp) => {
                              const dateStr = getLocalISODate(currentDailyDate);
                              const engagement = dailyEngagements.find(d => d.id === dateStr);
                              const hasIg = engagement?.igEngagedEmployeeIds?.includes(emp.id);
                              const hasFb = engagement?.fbEngagedEmployeeIds?.includes(emp.id);
                              
                              return (
                                <TableRow key={emp.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50">
                                  <TableCell className="sticky left-0 z-10 bg-white border-r border-slate-100 px-3 py-2 w-[1%] whitespace-nowrap">
                                    <p className="font-bold text-slate-800 text-xs whitespace-nowrap">{emp.name}</p>
                                  </TableCell>
                                  <TableCell className="border-r border-slate-100 px-3 py-2 w-[1%] whitespace-nowrap">
                                    <p className="text-slate-500 text-xs font-mono">{emp.nip || '-'}</p>
                                  </TableCell>
                                  <TableCell className="border-r border-slate-100 px-3 py-2 w-[1%] whitespace-nowrap">
                                    <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider", getBidangColor(emp.bidang))}>
                                      {emp.bidang || '---'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="border-r border-slate-50 text-center p-0">
                                    <div className="flex items-center justify-center py-2">
                                      {hasIg ? (
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                      ) : (
                                        <XCircle size={16} className="text-slate-200" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center p-0">
                                    <div className="flex items-center justify-center py-2">
                                      {hasFb ? (
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                      ) : (
                                        <XCircle size={16} className="text-slate-200" />
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

               {activeTab === 'reports' && (
                <motion.div 
                  key="reports"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Laporan Mingguan</h2>
                      <p className="text-slate-500 text-xs">Unduh dan lihat rekapitulasi engagement mingguan</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                      <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full sm:w-auto justify-between">
                        <Button variant="ghost" size="icon" onClick={() => changeWeek(-1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                          <ChevronLeft size={16} />
                        </Button>
                        <div className="text-center px-4 min-w-[200px]">
                          <div className="flex items-center justify-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900">Minggu ke-{weeklyReports[0]?.weekNumber}</h2>
                            {weeklyReports[0]?.isCurrentWeek && (
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[9px] px-1.5 py-0">Sekarang</Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{weeklyReports[0]?.monthName} {weeklyReports[0]?.year}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => changeWeek(1)} className="rounded-lg h-8 w-8 text-slate-600 hover:bg-white shrink-0 shadow-sm">
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                          <button 
                            onClick={() => setWeeklySortMode('bidang')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", weeklySortMode === 'bidang' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                          >
                            Bidang
                          </button>
                          <button 
                            onClick={() => setWeeklySortMode('name')}
                            className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", weeklySortMode === 'name' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                          >
                            Nama
                          </button>
                        </div>
                        <Button onClick={() => handleExportPDF(printRef, `recaplink-mingguan-${new Date().toISOString().split('T')[0]}`)} disabled={isLoading} className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 h-11 shadow-md font-bold text-xs border-none">
                          <FileText size={14} />
                          Export PDF
                        </Button>
                        <Button onClick={() => handleExportImage(printRef, `recaplink-mingguan-${new Date().toISOString().split('T')[0]}`)} disabled={isLoading} variant="outline" className="flex-1 sm:flex-none gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl px-4 h-11 font-bold text-xs">
                          <ImageIcon size={14} />
                          Save Image
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div ref={printRef} className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[600px] flex flex-col", isExporting ? "p-4 md:p-6 w-max min-w-full" : "p-6 md:p-10")}>
                    <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 gap-2", isExporting ? "mb-3 pb-3" : "mb-8 pb-6")}>
                      <div className="space-y-0.5">
                        <h3 className={cn("font-black text-slate-900 tracking-tight uppercase", isExporting ? "text-lg" : "text-2xl")}>Laporan Mingguan</h3>
                        <p className={cn("font-bold text-slate-500 uppercase tracking-widest", isExporting ? "text-[10px]" : "text-sm")}>Rekapitulasi Engagement • Minggu ke-{weeklyReports[0]?.weekNumber} • {weeklyReports[0]?.year}</p>
                      </div>
                      <div className={cn("text-left md:text-right bg-slate-50 rounded-xl border border-slate-100", isExporting ? "p-2" : "p-3")}>
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">RecapLink</p>
                        <p className="text-[8px] text-slate-500">Generated: {new Date().toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>

                    <div className={cn("flex-1 rounded-xl border border-slate-100", !isExporting && "overflow-auto max-h-[600px]")}>
                      <div className="min-w-[800px]">
                        <Table className="border-collapse min-w-full">
                          <TableHeader>
                            <TableRow className="bg-slate-50/50 border-b border-slate-100">
                              <TableHead className="sticky left-0 z-20 bg-slate-50 border-r border-slate-100 px-3 py-2 font-bold text-slate-900 w-[1%] whitespace-nowrap text-[10px] uppercase tracking-wider">
                                Nama Pegawai
                              </TableHead>
                              {weeklyReports.flatMap(w => w.dates).map((date, dIdx) => (
                                <TableHead key={dIdx} className={cn(
                                  "border-r border-slate-100 text-center px-1 py-2 text-[10px] font-bold",
                                  date === getLocalISODate(new Date()) ? "text-slate-900 bg-slate-100/50" : "text-slate-400"
                                )}>
                                  <div className="flex flex-col items-center">
                                    <span className="opacity-50 text-[8px]">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                                    <span className="text-sm leading-tight">{new Date(date).getDate()}</span>
                                    <span className="opacity-50 text-[8px]">{new Date(date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employees.slice().sort((a, b) => {
                              if (weeklySortMode === 'name') {
                                return a.name.localeCompare(b.name);
                              }
                              return (a.bidang || '').localeCompare(b.bidang || '') || a.name.localeCompare(b.name);
                            }).map((emp) => (
                              <TableRow key={emp.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50">
                                <TableCell className="sticky left-0 z-10 bg-white border-r border-slate-100 px-2 py-1 w-[1%] whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0", getBidangColor(emp.bidang))}>
                                      {emp.bidang ? emp.bidang.substring(0, 3) : '---'}
                                    </span>
                                    <p className="font-bold text-slate-800 text-xs whitespace-nowrap shrink-0">{emp.name}</p>
                                    <div className="flex items-center gap-2 ml-2">
                                      {emp.igUsername && (
                                        <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium whitespace-nowrap">
                                          <Instagram size={10} className="text-pink-500" /> {emp.igUsername}
                                        </div>
                                      )}
                                      {emp.fbName && (
                                        <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium whitespace-nowrap">
                                          <Facebook size={10} className="text-blue-500" /> {emp.fbName}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                {weeklyReports.flatMap(w => w.dates).map((date, dIdx) => {
                                  const engagement = dailyEngagements.find(d => d.id === date);
                                  const hasIg = engagement?.igEngagedEmployeeIds?.includes(emp.id);
                                  const hasFb = engagement?.fbEngagedEmployeeIds?.includes(emp.id);
                                  return (
                                    <TableCell key={dIdx} className="border-r border-slate-50 text-center p-0">
                                      <div className="flex items-center justify-center gap-0.5 py-0.5">
                                        <div className={cn(
                                          "w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-all",
                                          hasIg ? "bg-pink-500 text-white shadow-sm" : "bg-slate-100 text-slate-300 opacity-20"
                                        )}>
                                          <Instagram size={8} />
                                        </div>
                                        <div className={cn(
                                          "w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-all",
                                          hasFb ? "bg-blue-500 text-white shadow-sm" : "bg-slate-100 text-slate-300 opacity-20"
                                        )}>
                                          <Facebook size={8} />
                                        </div>
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            {activeTab === 'employees' && (
              <motion.div 
                key="employees"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <EmployeeManager />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <Settings className="text-indigo-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">Pengaturan Sistem</h2>
                      <p className="text-slate-500 text-sm">Konfigurasi tambahan untuk sistem rekapitulasi.</p>
                    </div>
                  </div>
                  <p className="text-slate-400 italic">Fitur pengaturan tambahan akan segera hadir.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </main>
      <Toaster position="top-right" />
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-50 text-rose-500 border-rose-100/50',
    sky: 'bg-sky-50 text-sky-500 border-sky-100/50',
    violet: 'bg-violet-50 text-violet-500 border-violet-100/50',
    emerald: 'bg-emerald-50 text-emerald-500 border-emerald-100/50'
  };

  return (
    <Card className="border-slate-100/50 shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colorMap[color]} transition-transform group-hover:scale-110 border`}>
            {icon}
          </div>
          <Badge variant="ghost" className="text-[9px] uppercase tracking-widest font-bold text-slate-300">Live</Badge>
        </div>
        <div className="space-y-0.5">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <Button 
      variant="ghost" 
      className={`w-full justify-start gap-3 h-11 rounded-xl px-4 transition-all duration-200 ${
        active 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
      onClick={onClick}
    >
      <div className={`${active ? 'text-white' : 'text-slate-400'}`}>
        {icon}
      </div>
      <span className="font-semibold text-sm tracking-tight">{label}</span>
      {active && <motion.div layoutId="nav-pill" className="ml-auto w-1 h-1 bg-white rounded-full" />}
    </Button>
  );
}
