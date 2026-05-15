/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users as UsersList, 
  UserRound, 
  TrendingUp, 
  Activity, 
  Heart, 
  Briefcase, 
  FileUp, 
  ChevronRight, 
  Search,
  Download,
  AlertTriangle,
  Lightbulb,
  Building2,
  CalendarDays,
  LayoutDashboard,
  FileBarChart,
  X,
  LogOut,
  Trash2,
  Save,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import moment from 'jalali-moment';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiService } from './services/apiService';
import { Login } from './components/Login';
import { parseExcelData, calculateStats, isEmployee } from './utils/dataProcessor';
import { PersonnelData, PersonnelStats } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizePersian = (str: any) => {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .trim()
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
    .replace(/ی/g, 'ی') // Standard Farsi Ye
    .replace(/ي/g, 'ی') // Arabic Ye to Farsi
    .replace(/ک/g, 'ک') // Standard Farsi Ke
    .replace(/ك/g, 'ک') // Arabic Ke to Farsi
    .replace(/\u200c/g, ' ') // ZWNJ to space
    .replace(/\s+/g, ' '); // Multiple spaces to single
};

const COLORS = ['#FFB000', '#E0E0E0', '#8E8E93', '#1C1C1E', '#3A3A3C'];

const formatDecimalYears = (decimalYears: number | string) => {
  const yrs = parseFloat(String(decimalYears));
  if (isNaN(yrs) || yrs <= 0) return '-';
  
  const years = Math.floor(yrs);
  const remainderDays = Math.round((yrs - years) * 365.25);
  
  let result = '';
  if (years > 0) result += `${years} سال`;
  if (remainderDays > 0) {
    if (result) result += ' و ';
    result += `${remainderDays} روز`;
  }
  
  return result || '۰ روز';
};

const calculateExperience = (hireDate: string) => {
  if (!hireDate) return '-';
  try {
    const start = moment(hireDate, 'jYYYY/jMM/jDD');
    if (!start.isValid()) return '-';
    
    const now = moment();
    const diffDays = now.diff(start, 'days');
    
    if (diffDays < 0) return 'هنوز شروع نشده';
    
    const y = Math.floor(diffDays / 365.25);
    const m = Math.floor((diffDays % 365.25) / 30.4375);
    const d = Math.floor((diffDays % 365.25) % 30.4375);
    
    let result = '';
    if (y > 0) result += `${y} سال `;
    if (m > 0) {
      if (result) result += 'و ';
      result += `${m} ماه `;
    }
    if (d > 0) {
      if (result) result += 'و ';
      result += `${d} روز`;
    }
    
    if (!result) result = 'کمتر از یک روز';
    
    return result;
  } catch (e) {
    return '-';
  }
};

export default function App() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<PersonnelData[]>([]);
  const [stats, setStats] = useState<PersonnelStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'personnel' | 'reports'>('overview');
  const [filterType, setFilterType] = useState<'all' | 'employees' | 'dependents'>('all');
  const [selectedPerson, setSelectedPerson] = useState<PersonnelData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<PersonnelData | null>(null);
  const [dashboardFilter, setDashboardFilter] = useState<any>(null);
  const [reportConfig, setReportConfig] = useState<{ type: 'unit' | 'position' | 'workGroup', value: string }>({ type: 'unit', value: '' });

  useEffect(() => {
    const checkAuth = async () => {
      const email = localStorage.getItem('user_email');
      const token = localStorage.getItem('auth_token');
      
      if (email && token) {
        setUser({ email });
        await refreshData();
      } else {
        setUser(null);
        setData([]);
        setStats(null);
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = async () => {
    const email = localStorage.getItem('user_email');
    if (email) {
      setUser({ email });
      await refreshData();
    }
  };

  const refreshData = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setIsLoading(true);
    try {
      const personnel = await apiService.getAllPersonnel();
      setData(personnel);
      setStats(calculateStats(personnel));
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err.message === 'Unauthorized' || err.message === 'Forbidden') {
        handleLogout();
      } else {
        alert('خطا در دریافت اطلاعات: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const parsed = await parseExcelData(file);
      await apiService.addPersonnel(parsed);
      await refreshData();
      setSearchTerm('');
      setDashboardFilter(null);
      setFilterType('all');
    } catch (error: any) {
      console.error('Error processing file:', error);
      const msg = error.message || 'خطا در پردازش فایل یا ذخیره در دیتابیس.';
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    
    setIsLoading(true);
    try {
      if (editForm.firestoreId) {
        await apiService.updatePerson(editForm.firestoreId, editForm);
      } else {
        await apiService.addPersonnel(editForm);
      }
      await refreshData();
      setSelectedPerson(editForm);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving:', err);
      alert('خطا در ذخیره سازی.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePerson = async (firestoreId?: string) => {
    if (!firestoreId) return;
    if (!confirm('آیا از حذف این مورد اطمینان دارید؟')) return;

    setIsLoading(true);
    try {
      await apiService.deletePerson(firestoreId);
      await refreshData();
      setSelectedPerson(null);
    } catch (err) {
      console.error('Error deleting:', err);
      alert('خطا در حذف.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    apiService.logout();
    setUser(null);
  };

  const startEditing = () => {
    setEditForm(selectedPerson);
    setIsEditing(true);
  };

  const addNewPerson = () => {
    const newPerson: PersonnelData = {
      id: '',
      firstName: '',
      lastName: '',
      dependentsCount: 0,
      gender: 'مرد',
      nationalId: '',
      birthDate: '',
      age: 0,
      fatherName: '',
      idNumber: '',
      status: 'شاغل',
      relationCode: '1',
      phoneNumber: '',
      relation: 'اصلی',
      diseaseType: 'سالم',
      experienceYears: 0,
      workGroup: '',
      unit: '',
      position: '',
      miningExpDays: 0,
      hireDate: ''
    };
    setEditForm(newPerson);
    setSelectedPerson(newPerson);
    setIsEditing(true);
  };

  const filteredPersonnel = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    // Process search terms for multi-criteria search
    const sTermNormalized = normalizePersian(searchTerm || '');
    const searchTerms = sTermNormalized.split(' ').filter(t => t.length > 0);

    return data.filter(p => {
      if (!p) return false;

      // multi-criteria space-separated search
      const matchesSearch = searchTerms.every(term => {
        const getInferredPosition = (person: PersonnelData) => {
          let pos = person.position || 'نامشخص';
          if ((pos === 'نامشخص' || !pos) && person.jobTitleKerman && person.workshopPosition && person.jobTitleKerman === person.workshopPosition) {
            return person.jobTitleKerman;
          }
          return pos;
        };

        const searchableFields = [
          p.firstName,
          p.lastName,
          p.id,
          p.unit,
          getInferredPosition(p),
          p.workGroup,
          p.relation,
          p.experienceYears?.toString(),
          p.age?.toString()
        ].map(f => normalizePersian(f || ''));

        // Add contextual labels for searching
        const exp = p.experienceYears || 0;
        if (exp < 5) searchableFields.push('کم', 'زیر ۵');
        else if (exp < 15) searchableFields.push('متوسط', '۵ تا ۱۵');
        else searchableFields.push('زیاد', 'بالای ۱۵');

        const age = p.age || 0;
        if (age < 30) searchableFields.push('زیر ۳۰');
        else if (age < 40) searchableFields.push('۳۰ تا ۴۰');
        else if (age < 50) searchableFields.push('۴۰ تا ۵۰');
        else searchableFields.push('۵۰ به بالا');

        return searchableFields.some(field => field.includes(term));
      });
      
      if (!matchesSearch) return false;

      const isPersonnel = isEmployee(p);
      
      let matchesCategory = true;
      if (filterType === 'employees') matchesCategory = isPersonnel;
      else if (filterType === 'dependents') matchesCategory = !isPersonnel;

      if (!matchesCategory) return false;

      if (dashboardFilter) {
        if (typeof dashboardFilter === 'object') {
          if (dashboardFilter.key === 'childrenOver18') {
            if (filterType !== 'dependents') return false;
            const rel = normalizePersian(p.relation || '');
            if (!(rel.includes('فرزند') || rel.includes('پسر') || rel.includes('دختر'))) return false;
            if ((p.age || 0) < 18) return false;
            return true;
          }
          if (dashboardFilter.key === 'mismatch') {
            const titleK = (p.jobTitleKerman || '').trim();
            const titleW = (p.workshopPosition || '').trim();
            return !!titleK && !!titleW && titleK !== titleW;
          }
          if (dashboardFilter.key === 'unit' && p.unit !== dashboardFilter.value) return false;
          if (dashboardFilter.key === 'gender' && p.gender !== dashboardFilter.value) return false;
          if (dashboardFilter.key === 'ageRange') {
            const age = p.age || 0;
            if (dashboardFilter.value === 'زیر ۳۰' && !(age < 30 && age > 0)) return false;
            if (dashboardFilter.value === '۳۰ تا ۴۰' && !(age >= 30 && age < 40)) return false;
            if (dashboardFilter.value === '۴۰ تا ۵۰' && !(age >= 40 && age < 50)) return false;
            if (dashboardFilter.value === '۵۰ به بالا' && !(age >= 50)) return false;
          }
          if (dashboardFilter.key === 'experienceRange') {
            const exp = p.experienceYears || 0;
            if (dashboardFilter.value === 'کم (زیر ۵)' && !(exp < 5)) return false;
            if (dashboardFilter.value === 'متوسط (۵ تا ۱۵)' && !(exp >= 5 && exp < 15)) return false;
            if (dashboardFilter.value === 'زیاد (بالای ۱۵)' && !(exp >= 15)) return false;
          }
          if (dashboardFilter.key === 'position') {
            let currentPos = p.position || 'نامشخص';
            if ((currentPos === 'نامشخص' || !currentPos) && p.jobTitleKerman && p.workshopPosition && p.jobTitleKerman === p.workshopPosition) {
              currentPos = p.jobTitleKerman;
            }
            if (currentPos !== dashboardFilter.value) return false;
            if (dashboardFilter.unit) {
              const currentUnit = p.unit || 'نامشخص';
              if (currentUnit !== dashboardFilter.unit) return false;
            }
          }
          if (dashboardFilter.key === 'workGroup' && p.workGroup !== dashboardFilter.value) return false;
        } else if (dashboardFilter === 'mismatch') {
          const titleK = (p.jobTitleKerman || '').trim();
          const titleW = (p.workshopPosition || '').trim();
          return !!titleK && !!titleW && titleK !== titleW;
        }
      }

      return true;
    });
  }, [data, searchTerm, filterType, dashboardFilter]);

  const selectedPersonDependents = useMemo(() => {
    if (!selectedPerson || !data || !Array.isArray(data)) return [];
    return data.filter(p => p.id === selectedPerson.id && p.nationalId !== selectedPerson.nationalId);
  }, [selectedPerson, data]);

  const statsSection = stats && (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="تعداد کل پرسنل" 
          value={stats.totalEmployees} 
          icon={UsersList} 
          subtitle={`از ${stats.totalRecords} رکورد`}
          color="brand"
        />
        <StatCard 
          title="تعداد افراد تحت تکفل" 
          value={stats.totalDependents} 
          icon={Heart} 
          subtitle="نفر"
          color="muted"
        />
        <StatCard 
          title="میانگین سابقه کل" 
          value={stats.experienceStats.avgTotal.toFixed(1)} 
          icon={TrendingUp} 
          subtitle="سال"
          color="muted"
        />
        <StatCard 
          title="میانگین سن کارکنان" 
          value={stats.avgAge.toFixed(1)} 
          icon={CalendarDays} 
          subtitle="سال"
          color="brand"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="توزیع نفرات در واحدها">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical" 
                data={[...stats.unitDistribution].sort((a, b) => b.value - a.value)}
                margin={{ left: 20, right: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2C2C2E" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#8E8E93', fontSize: 10 }}
                  orientation="right"
                />
                <Tooltip 
                  cursor={{ fill: '#1C1C1E' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E', textAlign: 'right' }} 
                  itemStyle={{ color: '#FFB000' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#FFB000" 
                  radius={[4, 0, 0, 4]}
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'unit', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                  }}
                  label={{ position: 'left', fill: '#E0E0E0', fontSize: 10, offset: 10 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="میانگین سابقه به تفکیک واحد">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.avgExperienceByUnit}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2C2C2E" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E8E93' }} />
                <Tooltip cursor={{ fill: '#1C1C1E' }} contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} />
                <Bar dataKey="value" fill="#E0E0E0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="توزیع بازه سنی">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ageDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2C2C2E" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E8E93' }} />
                <Tooltip cursor={{ fill: '#1C1C1E' }} contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} />
                <Bar 
                  dataKey="count" 
                  fill="#FFB000" 
                  radius={[4, 4, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'ageRange', value: entry.range });
                    setActiveTab('personnel');
                    setFilterType('employees');
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="سطح سابقه کاری">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={stats.experienceStats.categories}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2C2C2E" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#8E8E93' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} />
                <Bar 
                  dataKey="count" 
                  fill="#E0E0E0" 
                  radius={[0, 4, 4, 0]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'experienceRange', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="توزیع سمت‌های سازمانی">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={[...stats.positionDistribution].sort((a, b) => b.value - a.value).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2C2C2E" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} />
                <Bar 
                  dataKey="value" 
                  fill="#FFB000" 
                  radius={[0, 4, 4, 0]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setSearchTerm(entry.name);
                    setActiveTab('personnel');
                    setFilterType('employees');
                    setDashboardFilter(null);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-[#8E8E93] mt-2 text-center uppercase tracking-widest">نمایش ۸ سمت برتر سازمانی</p>
          </div>
        </Card>

        <Card title="تحلیل سلامت (بیماری‌ها)">
          {stats.healthStats.length > 0 ? (
            <div className="space-y-4">
              {stats.healthStats.map((item, idx) => (
                <button 
                  key={idx} 
                  onClick={() => {
                    setSearchTerm(item.name);
                    setActiveTab('personnel');
                    setFilterType('all');
                    setDashboardFilter(null);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-neutral-900 border border-[#2C2C2E] rounded-lg hover:border-[#FFB000]/30 transition-colors group text-right"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-[#FFB000]" />
                    <span className="text-sm font-medium text-[#E0E0E0] group-hover:text-[#FFB000]">{item.name}</span>
                  </div>
                  <span className="text-sm text-[#8E8E93] font-mono group-hover:text-[#E0E0E0]">{item.count} مورد</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
              <Activity size={48} className="mb-2 opacity-20 text-[#FFB000]" />
              <p>مورد بیماری ثبت نشده است</p>
            </div>
          )}
        </Card>

        <Card title="توزیع جنسیتی کارکنان">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.genderStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  stroke="none"
                  className="cursor-pointer outline-none"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'gender', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                  }}
                >
                  {stats.genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E', color: '#E0E0E0' }} 
                  itemStyle={{ color: '#FFB000' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );

  const managementReports = stats && (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 max-w-5xl mx-auto">
      {/* Interactive Reports Section */}
      <Card title="گزارش تفصیلی و فیلتر واحد/سمت" icon={FileBarChart} iconColor="text-[#FFB000]">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-wider">مبنای گزارش</label>
              <div className="flex bg-[#1C1C1E] p-1 rounded-lg border border-[#2C2C2E]">
                <button 
                  onClick={() => setReportConfig({ ...reportConfig, type: 'unit', value: '' })}
                  className={cn(
                    "flex-1 py-2 rounded text-xs font-bold transition-all",
                    reportConfig.type === 'unit' ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]"
                  )}
                >
                  بر اساس واحد
                </button>
                <button 
                  onClick={() => setReportConfig({ ...reportConfig, type: 'position', value: '' })}
                  className={cn(
                    "flex-1 py-2 rounded text-xs font-bold transition-all",
                    reportConfig.type === 'position' ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]"
                  )}
                >
                  بر اساس سمت
                </button>
              </div>
            </div>
            
            <div className="flex-1 space-y-2">
              <label className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-wider">انتخاب {reportConfig.type === 'unit' ? 'واحد' : 'سمت'}</label>
              <select 
                value={reportConfig.value}
                onChange={(e) => setReportConfig({ ...reportConfig, value: e.target.value })}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] text-[#E0E0E0] p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#FFB000]"
              >
                <option value="">همه موارد</option>
                {[...(reportConfig.type === 'unit' ? stats.unitDistribution : stats.positionDistribution)]
                  .sort((a, b) => b.value - a.value)
                  .map(item => (
                    <option key={item.name} value={item.name}>{item.name} ({item.value} نفر)</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Filtered Stats */}
            {(() => {
              const filteredData = data.filter(p => {
                if (!isEmployee(p)) return false;
                if (reportConfig.value) {
                  return reportConfig.type === 'unit' ? p.unit === reportConfig.value : p.position === reportConfig.value;
                }
                return true;
              });

              const count = filteredData.length;
              const avgExp = count > 0 ? filteredData.reduce((acc, p) => acc + p.experienceYears, 0) / count : 0;
              const avgAge = count > 0 ? filteredData.reduce((acc, p) => acc + (p.age || 0), 0) / count : 0;

              return (
                <>
                  <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1">تعداد نفرات</span>
                    <span className="text-3xl font-serif-header font-bold text-[#FFB000]">{count}</span>
                  </div>
                  <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1">میانگین سابقه</span>
                    <span className="text-3xl font-serif-header font-bold text-[#FFFFFF]">{avgExp.toFixed(1)} <span className="text-xs text-[#8E8E93]">سال</span></span>
                  </div>
                  <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1">میانگین سن</span>
                    <span className="text-3xl font-serif-header font-bold text-[#FFFFFF]">{avgAge.toFixed(1)} <span className="text-xs text-[#8E8E93]">سال</span></span>
                  </div>
                </>
              );
            })()}
          </div>

          {reportConfig.value ? (
            <div className="mt-4 flex justify-center">
              <button 
                onClick={() => {
                  setSearchTerm(reportConfig.value);
                  setActiveTab('personnel');
                  setDashboardFilter(null);
                  setFilterType('employees');
                }}
                className="text-xs text-[#FFB000] font-bold hover:underline"
              >
                مشاهده لیست پرسنل این بخش
              </button>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-lg border border-[#2C2C2E]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#1C1C1E] text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest">
                    <th className="px-6 py-3 border-b border-[#2C2C2E]">نام {reportConfig.type === 'unit' ? 'واحد' : 'سمت'}</th>
                    <th className="px-6 py-3 border-b border-[#2C2C2E]">تعداد نفرات</th>
                    <th className="px-6 py-3 border-b border-[#2C2C2E]">درصد از کل</th>
                    <th className="px-6 py-3 border-b border-[#2C2C2E]">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2E]">
                  {[...(reportConfig.type === 'unit' ? stats.unitDistribution : stats.positionDistribution)]
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10)
                    .map((item) => (
                      <tr key={item.name} className="hover:bg-[#1C1C1E] transition-colors">
                        <td className="px-6 py-3 text-sm font-bold text-[#FFFFFF]">{item.name}</td>
                        <td className="px-6 py-3 text-sm text-[#E0E0E0] tabular-nums">{item.value} نفر</td>
                        <td className="px-6 py-3 text-sm text-[#8E8E93] tabular-nums">
                          {((item.value / stats.totalEmployees) * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-3 text-left">
                          <button 
                            onClick={() => {
                              setReportConfig({...reportConfig, value: item.name});
                            }}
                            className="text-[10px] text-[#FFB000] font-bold hover:underline"
                          >
                            جزئیات بیشتر
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="گزارش مدیریتی و پیشنهادات" icon={Lightbulb} iconColor="text-[#FFB000]">
        <div className="space-y-6">
          <section>
            <h4 className="flex items-center gap-2 text-lg font-serif-header font-bold text-[#FFFFFF] mb-3">
              <AlertTriangle className="text-[#FFB000]" size={20} />
              واحدهای با تراکم بالا
            </h4>
            <div className="bg-[#1C1C1E] border-r-4 border-[#FFB000] p-4 rounded-l-lg shadow-inner">
              <p className="text-sm text-[#E0E0E0]">
                بر اساس تحلیل داده‌ها، واحد 
                <span className="font-bold mx-1 text-[#FFB000]">
                  {[...stats.unitDistribution].sort((a, b) => b.value - a.value)[0]?.name}
                </span>
                دارای بیشترین تعداد نیروی انسانی است. پیشنهاد می‌شود فرآیندهای بهینه‌سازی در این واحد بررسی گردند.
              </p>
            </div>
          </section>

          <section>
            <h4 className="flex items-center gap-2 text-lg font-serif-header font-bold text-[#FFFFFF] mb-3">
              <TrendingUp className="text-[#22C55E]" size={20} />
              تحلیل نیروهای کلیدی
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-[#8E8E93]">
                <ChevronRight size={16} className="mt-0.5 text-[#22C55E]" />
                تعداد {stats.experienceStats.categories.find(c => c.name === 'زیاد (بالای ۱۵)')?.count} نفر دارای سابقه بالای ۱۵ سال هستند که به عنوان سرمایه‌های دانشی سازمان شناخته می‌شوند.
              </li>
              <li className="flex items-start gap-2 text-sm text-[#8E8E93]">
                <ChevronRight size={16} className="mt-0.5 text-[#22C55E]" />
                میانگین سابقه کار معدنی ({stats.experienceStats.avgMining.toFixed(0)} روز) نشان‌دهنده نیاز به برنامه‌های تخصصی بازآموزی برای نیروهای جدید است.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="flex items-center gap-2 text-lg font-serif-header font-bold text-[#FFFFFF] mb-3">
              <Building2 className="text-[#3b82f6]" size={20} />
              پیشنهادات بهبود بهره‌وری
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-[#2C2C2E] rounded-xl bg-[#1C1C1E] shadow-sm hover:border-[#FFB000]/30 transition-colors">
                <p className="text-xs font-bold text-[#FFB000] uppercase mb-1">واحد سلامت</p>
                <p className="text-sm text-[#8E8E93]">برگزاری چکاپ‌های دوره‌ای متمرکز بر شایع‌ترین بیماری‌های شناسایی شده.</p>
              </div>
              <div className="p-4 border border-[#2C2C2E] rounded-xl bg-[#1C1C1E] shadow-sm hover:border-[#FFB000]/30 transition-colors">
                <p className="text-xs font-bold text-[#FFB000] uppercase mb-1">واحد آموزش</p>
                <p className="text-sm text-[#8E8E93]">تعریف سیستم مربی‌گری (Mentoring) توسط نیروهای با سابقه بالا برای جانشین‌پروری.</p>
              </div>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFB000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] font-sans text-[#E0E0E0] pb-20 selection:bg-[#FFB000] selection:text-[#0A0A0B]" dir="rtl">
      {/* Header */}
      <header className="bg-[#0A0A0B] border-b border-[#2C2C2E] sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#FFB000] rounded flex items-center justify-center text-[#0A0A0B] font-bold text-xl shadow-lg shadow-[#FFB000]/10">
            M
          </div>
          <div>
            <h1 className="text-2xl font-serif-header font-bold text-[#FFFFFF] tracking-tight">سامانه تحلیل هوشمند منابع انسانی</h1>
            <p className="text-[10px] text-[#8E8E93] font-medium tracking-widest uppercase">مدیریت استراتژیک سرمایههای انسانی - ادمین: {user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-[#2C2C2E] rounded-full text-[#8E8E93] hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
          <label className="relative cursor-pointer group">
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              onChange={handleFileUpload}
              className="hidden" 
            />
            <div className="flex items-center gap-2 bg-[#FFB000] text-[#0A0A0B] px-5 py-2.5 rounded-md hover:opacity-90 transition-all text-sm font-bold shadow-lg shadow-[#FFB000]/10">
              <FileUp size={18} />
              <span>بارگذاری اکسل</span>
            </div>
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!data || !data.length ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-24 h-24 bg-[#1C1C1E] rounded-full flex items-center justify-center mb-6 border border-[#2C2C2E]"
            >
              <FileUp size={48} className="text-[#FFB000]" />
            </motion.div>
            <h2 className="text-3xl font-serif-header font-bold mb-2 text-[#FFFFFF]">خوش آمدید</h2>
            <p className="text-[#8E8E93] max-w-sm mb-8 font-vazir leading-relaxed">
              هنوز هیچ داده‌ای ثبت نشده است. لطفاً فایل اکسل پرسنل را بارگذاری کنید.
            </p>
            <label className="cursor-pointer bg-[#FFB000] hover:bg-[#FFC040] text-[#0A0A0B] px-8 py-4 rounded-xl font-bold text-sm transition-all shadow-xl shadow-[#FFB000]/20 flex items-center gap-3">
              <Plus size={20} />
              بارگذاری اولین فایل اکسل
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Tabs */}
            <div className="bg-[#151517] p-1 rounded-lg flex w-fit shadow-sm border border-[#2C2C2E]">
              <TabButton 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')}
                label="داشبورد کلان" 
              />
              <TabButton 
                active={activeTab === 'personnel'} 
                onClick={() => setActiveTab('personnel')}
                label="لیست پرسنل" 
              />
              <TabButton 
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')}
                label="گزارشات مدیریتی" 
              />
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && stats && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <StatsDashboard 
                    stats={stats} 
                    data={data}
                    setDashboardFilter={setDashboardFilter}
                    setActiveTab={setActiveTab}
                    setFilterType={setFilterType}
                    setSearchTerm={setSearchTerm}
                  />
                </motion.div>
              )}

              {activeTab === 'personnel' && (
                <motion.div
                  key="personnel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full"
                >
                  <PersonnelList 
                    filteredPersonnel={filteredPersonnel}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filterType={filterType}
                    setFilterType={setFilterType}
                    dashboardFilter={dashboardFilter}
                    setDashboardFilter={setDashboardFilter}
                    setSelectedPerson={setSelectedPerson}
                    addNewPerson={addNewPerson}
                  />
                </motion.div>
              )}

              {activeTab === 'reports' && stats && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <ManagementReports 
                    stats={stats}
                    data={data}
                    reportConfig={reportConfig}
                    setReportConfig={setReportConfig}
                    setSearchTerm={setSearchTerm}
                    setActiveTab={setActiveTab}
                    setDashboardFilter={setDashboardFilter}
                    setFilterType={setFilterType}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {isLoading && (
        <div className="fixed inset-0 bg-[#0A0A0B]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#FFB000] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-serif-header font-bold text-xl text-[#FFB000]">در حال تحلیل هوشمند داده‌ها...</p>
        </div>
      )}

      <AnimatePresence>
        {selectedPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPerson(null)}
              className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#2C2C2E] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#FFB000]/10 border border-[#FFB000]/30 flex items-center justify-center text-[#FFB000]">
                    <UserRound size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#FFFFFF]">
                      {isEditing && editForm ? `${editForm.firstName} ${editForm.lastName}` : `${selectedPerson.firstName} ${selectedPerson.lastName}`}
                    </h3>
                    <p className="text-sm text-[#8E8E93] font-mono">کد پرسنلی: {selectedPerson.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDeletePerson(selectedPerson.firestoreId)}
                        className="p-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                        title="حذف رکورد"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={startEditing}
                        className="px-4 py-2 bg-[#FFB000]/10 text-[#FFB000] border border-[#FFB000]/30 rounded-lg text-xs font-bold hover:bg-[#FFB000]/20 transition-colors flex items-center gap-2"
                      >
                        <Save size={14} />
                        ویرایش اطلاعات
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedPerson(null);
                      setIsEditing(false);
                    }}
                    className="p-2 hover:bg-[#2C2C2E] rounded-full text-[#8E8E93] transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {isEditing && editForm ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <EditField 
                        label="کد پرسنلی" 
                        value={editForm.id} 
                        onChange={(v) => setEditForm({...editForm, id: v})} 
                      />
                      <EditField 
                        label="نام" 
                        value={editForm.firstName} 
                        onChange={(v) => setEditForm({...editForm, firstName: v})} 
                      />
                      <EditField 
                        label="نام خانوادگی" 
                        value={editForm.lastName} 
                        onChange={(v) => setEditForm({...editForm, lastName: v})} 
                      />
                      <EditField 
                        label="کد ملی" 
                        value={editForm.nationalId} 
                        onChange={(v) => setEditForm({...editForm, nationalId: v})} 
                      />
                      <EditField 
                        label="شماره موبایل" 
                        value={editForm.phoneNumber} 
                        onChange={(v) => setEditForm({...editForm, phoneNumber: v})} 
                      />
                      <EditField 
                        label="واحد" 
                        value={editForm.unit} 
                        onChange={(v) => setEditForm({...editForm, unit: v})} 
                      />
                      <EditField 
                        label="سمت" 
                        value={editForm.position} 
                        onChange={(v) => setEditForm({...editForm, position: v})} 
                      />
                      <EditField 
                        label="وضعیت" 
                        value={editForm.status} 
                        onChange={(v) => setEditForm({...editForm, status: v})} 
                      />
                      <EditField 
                        label="گروه کاری" 
                        value={editForm.workGroup} 
                        onChange={(v) => setEditForm({...editForm, workGroup: v})} 
                      />
                      <EditField 
                        label="تاریخ استخدام کارآوران" 
                        value={editForm.hireDate} 
                        onChange={(v) => setEditForm({...editForm, hireDate: v})} 
                        placeholder="۱۴۰۰/۰۱/۰۱"
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#8E8E93] font-medium uppercase tracking-wider">وضعیت سلامت</label>
                        <select 
                          value={editForm.diseaseType}
                          onChange={(e) => setEditForm({...editForm, diseaseType: e.target.value})}
                          className="bg-[#0A0A0B] border border-[#2C2C2E] text-[#E0E0E0] p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#FFB000]"
                        >
                          <option value="سالم">سالم</option>
                          <option value="بیمار">بیمار</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-[#2C2C2E]">
                      <button 
                        onClick={handleSaveEdit}
                        className="flex-1 bg-[#FFB000] text-[#0A0A0B] py-3 rounded-lg font-bold text-sm hover:bg-[#FFB000]/90 transition-all"
                      >
                        ذخیره تغییرات
                      </button>
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-[#2C2C2E] text-[#E0E0E0] py-3 rounded-lg font-bold text-sm hover:bg-[#3A3A3C] transition-all"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Personal Information */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-[#FFB000] uppercase tracking-widest mb-4">اطلاعات فردی</h4>
                      <DetailItem label="نام پدر" value={selectedPerson.fatherName} />
                      <DetailItem label="کد ملی" value={selectedPerson.nationalId} />
                      <DetailItem label="شماره شناسنامه" value={selectedPerson.idNumber} />
                      <DetailItem label="شماره تماس" value={selectedPerson.phoneNumber} />
                      <DetailItem label="تاریخ تولد" value={selectedPerson.birthDate} />
                      <DetailItem label="سن" value={`${selectedPerson.age} سال`} />
                      <DetailItem label="تاریخ استخدام" value={selectedPerson.hireDate || '-'} />
                      <DetailItem label="سابقه در کارآوران" value={calculateExperience(selectedPerson.hireDate || '')} />
                      <DetailItem label="جنسیت" value={selectedPerson.gender} />
                      <DetailItem label="نسبت" value={selectedPerson.relation || 'پرسنل'} />
                    </div>

                    {/* Employment Information */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-[#FFB000] uppercase tracking-widest mb-4">اطلاعات شغلی</h4>
                      <DetailItem label="واحد" value={selectedPerson.unit} />
                      <DetailItem label="سمت (فایل)" value={selectedPerson.position} />
                      {((selectedPerson.position === 'نامشخص' || !selectedPerson.position) && selectedPerson.jobTitleKerman && selectedPerson.workshopPosition && selectedPerson.jobTitleKerman === selectedPerson.workshopPosition) && (
                        <div className="bg-[#FFB000]/5 border border-[#FFB000]/20 p-2 rounded flex items-start gap-2">
                          <Lightbulb size={14} className="text-[#FFB000] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-[#FFB000] font-bold">سمت تشخیص داده شده:</p>
                            <p className="text-xs text-[#E0E0E0]">{selectedPerson.jobTitleKerman}</p>
                          </div>
                        </div>
                      )}
                      <DetailItem 
                        label="عنوان شغل کرمان" 
                        value={selectedPerson.jobTitleKerman || '-'} 
                        isWarning={!!(selectedPerson.jobTitleKerman || '').trim() && !!(selectedPerson.workshopPosition || '').trim() && (selectedPerson.jobTitleKerman || '').trim() !== (selectedPerson.workshopPosition || '').trim()}
                      />
                      <DetailItem 
                        label="سمت کارگاه" 
                        value={selectedPerson.workshopPosition || '-'} 
                        isWarning={!!(selectedPerson.jobTitleKerman || '').trim() && !!(selectedPerson.workshopPosition || '').trim() && (selectedPerson.jobTitleKerman || '').trim() !== (selectedPerson.workshopPosition || '').trim()}
                      />
                      <DetailItem label="سابقه (سال)" value={formatDecimalYears(selectedPerson.experienceYears)} />
                      <DetailItem label="سابقه معدنی (روز)" value={`${selectedPerson.miningExpDays} روز`} />
                      <DetailItem label="گروه کاری" value={selectedPerson.workGroup} />
                      <DetailItem label="وضعیت" value={selectedPerson.status} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#8E8E93] font-medium">وضعیت سلامت</span>
                        <span className={cn(
                          "text-xs font-bold",
                          selectedPerson.diseaseType === 'سالم' ? "text-[#34C759]" : "text-[#FF453A]"
                        )}>
                          {selectedPerson.diseaseType}
                        </span>
                      </div>
                    </div>

                    {/* Dependents Table */}
                    {selectedPersonDependents.length > 0 && (
                      <div className="md:col-span-2 mt-8 space-y-4">
                        <h4 className="text-[10px] font-bold text-[#FFB000] uppercase tracking-widest flex items-center gap-2">
                          <UsersList size={14} />
                          افراد تحت تکفل ({selectedPersonDependents.length} نفر)
                        </h4>
                        <div className="overflow-hidden rounded-xl border border-[#2C2C2E] bg-[#0A0A0B]">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-[#1C1C1E] text-[#8E8E93] text-[9px] font-bold uppercase">
                                <th className="px-4 py-3 border-b border-[#2C2C2E]">نام و نام خانوادگی</th>
                                <th className="px-4 py-3 border-b border-[#2C2C2E]">نسبت</th>
                                <th className="px-4 py-3 border-b border-[#2C2C2E]">کد ملی</th>
                                <th className="px-4 py-3 border-b border-[#2C2C2E]">سن</th>
                                <th className="px-4 py-3 border-b border-[#2C2C2E]">وضعیت سلامت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2C2C2E]">
                              {selectedPersonDependents.map((dep, dIdx) => (
                                <tr key={dep.nationalId || dIdx} className="hover:bg-[#1C1C1E] transition-colors">
                                  <td className="px-4 py-3 text-sm font-bold text-[#FFFFFF]">{dep.firstName} {dep.lastName}</td>
                                  <td className="px-4 py-3 text-[11px] text-[#FFB000] font-medium">{dep.relation}</td>
                                  <td className="px-4 py-3 text-sm text-[#8E8E93] font-mono">{dep.nationalId}</td>
                                  <td className="px-4 py-3 text-sm text-[#E0E0E0] tabular-nums">{dep.age} سال</td>
                                  <td className="px-4 py-3">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold",
                                      dep.diseaseType === 'سالم' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                    )}>
                                      {dep.diseaseType}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-8 pt-8 border-t border-[#2C2C2E] flex justify-between items-center text-[10px] text-[#8E8E93] font-mono">
                  <span>آخرین بروزرسانی سیستم: امروز</span>
                  <span>کد ارتباطی: {selectedPerson.relationCode}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components for better structural health and performance
function StatsDashboard({ stats, data, setDashboardFilter, setActiveTab, setFilterType, setSearchTerm }: { 
  stats: any, 
  data: any[],
  setDashboardFilter: any, 
  setActiveTab: any, 
  setFilterType: any,
  setSearchTerm: any
}) {
  const [posUnitFilter, setPosUnitFilter] = useState<string>('همه واحدها');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="text-right h-full" onClick={() => { setDashboardFilter(null); setFilterType('all'); setActiveTab('personnel'); }}>
          <StatCard title="کل جمعیت آماری" value={stats.totalRecords} icon={UsersList} subtitle="نفر" color="brand" />
        </button>
        <button className="text-right h-full" onClick={() => { setDashboardFilter(null); setFilterType('employees'); setActiveTab('personnel'); }}>
          <StatCard title="کارکنان شاغل" value={stats.totalEmployees} icon={Briefcase} subtitle="نفر" color="brand" />
        </button>
        <button className="text-right h-full" onClick={() => { setDashboardFilter(null); setFilterType('dependents'); setActiveTab('personnel'); }}>
          <StatCard title="افراد تحت تکفل" value={stats.totalDependents} icon={Heart} subtitle="نفر" color="muted" />
        </button>
        <button className="text-right h-full" onClick={() => { setDashboardFilter({ key: 'mismatch' }); setActiveTab('personnel'); setFilterType('employees'); setSearchTerm(''); }}>
          <StatCard title="مغایرت سمت" value={stats.mismatch} icon={AlertTriangle} subtitle="نفر" color={stats.mismatch > 0 ? "warning" : "muted"} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <SmallStatCard 
          title="فرزند (کل)" 
          value={stats.familyStats.breakdown.children} 
          icon={UsersList} 
          onClick={() => { setSearchTerm('فرزند'); setActiveTab('personnel'); setFilterType('dependents'); setDashboardFilter(null); }}
        />
        <SmallStatCard 
          title="فرزند بالای ۱۸" 
          value={stats.familyStats.breakdown.childrenOver18} 
          icon={UsersList} 
          onClick={() => { 
            setDashboardFilter({ key: 'childrenOver18' }); 
            setActiveTab('personnel'); 
            setFilterType('dependents'); 
            setSearchTerm(''); 
          }}
        />
        <SmallStatCard 
          title="همسر" 
          value={stats.familyStats.breakdown.spouse} 
          icon={UserRound} 
          onClick={() => { setSearchTerm('همسر'); setActiveTab('personnel'); setFilterType('dependents'); setDashboardFilter(null); }}
        />
        <SmallStatCard 
          title="مادر" 
          value={stats.familyStats.breakdown.mother} 
          icon={Heart} 
          onClick={() => { setSearchTerm('مادر'); setActiveTab('personnel'); setFilterType('dependents'); setDashboardFilter(null); }}
        />
        <SmallStatCard 
          title="پدر" 
          value={stats.familyStats.breakdown.father} 
          icon={Briefcase} 
          onClick={() => { setSearchTerm('پدر'); setActiveTab('personnel'); setFilterType('dependents'); setDashboardFilter(null); }}
        />
        <SmallStatCard 
          title="سایر" 
          value={stats.familyStats.breakdown.other} 
          icon={Activity} 
          onClick={() => { setActiveTab('personnel'); setFilterType('dependents'); setDashboardFilter(null); }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="توزیع نفرات در واحدها">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={[...stats.unitDistribution].sort((a, b) => b.value - a.value)} margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2C2C2E" />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 10 }} orientation="right" />
                <XAxis type="number" hide />
                <Tooltip 
                  cursor={{ fill: '#1C1C1E' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E', textAlign: 'right' }} 
                  itemStyle={{ color: '#FFB000' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#FFB000" 
                  radius={[4, 0, 0, 4]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'unit', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                    setSearchTerm('');
                  }}
                  label={{ position: 'left', fill: '#E0E0E0', fontSize: 10, offset: 10 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="توزیع زمانی و جوانی (بازه سنی)">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ageDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2C2C2E" />
                <XAxis dataKey="range" tick={{ fill: '#8E8E93', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#1C1C1E' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} 
                />
                <Bar 
                  dataKey="count" 
                  fill="#E0E0E0" 
                  radius={[4, 4, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'ageRange', value: entry.range });
                    setActiveTab('personnel');
                    setFilterType('employees');
                    setSearchTerm('');
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="تجربه و سابقه تخصصی">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.experienceStats.categories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2C2C2E" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 10 }} orientation="right" />
                <Tooltip 
                  cursor={{ fill: '#1C1C1E' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} 
                />
                <Bar 
                  dataKey="count" 
                  fill="#E0E0E0" 
                  radius={[4, 0, 0, 4]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'experienceRange', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                    setSearchTerm('');
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="تفکیک سمت‌های سازمانی">
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <select 
                value={posUnitFilter}
                onChange={(e) => setPosUnitFilter(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded p-2 text-[11px] text-[#E0E0E0] outline-none focus:border-[#FFB000]"
              >
                <option value="همه واحدها">همه واحدها</option>
                {stats.unitDistribution.map(u => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[350px] scrollbar-hide">
              <table className="w-full text-right">
                <thead className="sticky top-0 bg-[#151517] border-b border-[#2C2C2E]">
                  <tr>
                    <th className="py-2 text-[10px] text-[#8E8E93] font-medium">عنوان سمت</th>
                    <th className="py-2 text-[10px] text-[#8E8E93] font-medium text-left">تعداد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2E]/30">
                  {([...data]
                    .filter(p => isEmployee(p))
                    .filter(p => posUnitFilter === 'همه واحدها' || p.unit === posUnitFilter)
                    .reduce((acc: any[], curr) => {
                      let pos = curr.position || 'نامشخص';
                      if ((pos === 'نامشخص' || !pos) && curr.jobTitleKerman && curr.workshopPosition && curr.jobTitleKerman === curr.workshopPosition) {
                        pos = curr.jobTitleKerman;
                      }
                      const existing = acc.find(a => a.name === pos);
                      if (existing) existing.value++;
                      else acc.push({ name: pos, value: 1 });
                      return acc;
                    }, [])
                    .sort((a, b) => b.value - a.value)
                    .map((item, idx) => (
                      <tr 
                        key={idx} 
                        className="group hover:bg-[#FFB000]/5 transition-colors cursor-pointer"
                        onClick={() => {
                          setDashboardFilter({ key: 'position', value: item.name, unit: posUnitFilter !== 'همه واحدها' ? posUnitFilter : null });
                          setActiveTab('personnel');
                          setFilterType('employees');
                          setSearchTerm('');
                        }}
                      >
                        <td className="py-3 text-[11px] text-[#E0E0E0] group-hover:text-[#FFB000]">{item.name}</td>
                        <td className="py-3 text-[11px] text-[#8E8E93] font-mono text-left">{item.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-[#8E8E93] mt-3 text-center opacity-50 italic">برای فیلتر روی هر سمت کلیک کنید</p>
          </div>
        </Card>

        <Card title="توزیع گروه‌های کاری">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...stats.workGroupStats].sort((a: any, b: any) => b.value - a.value)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2C2C2E" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 10 }} />
                <Tooltip cursor={{ fill: '#1C1C1E' }} contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' }} />
                <Bar 
                  dataKey="value" 
                  fill="#FFB000" 
                  radius={[4, 4, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(entry) => {
                    setDashboardFilter({ key: 'workGroup', value: entry.name });
                    setActiveTab('personnel');
                    setFilterType('employees');
                    setSearchTerm('');
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-[#8E8E93] font-medium uppercase tracking-wider">{label}</label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#0A0A0B] border border-[#2C2C2E] text-[#E0E0E0] p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#FFB000] transition-all"
      />
    </div>
  );
}

function PersonnelList({ 
  filteredPersonnel, searchTerm, setSearchTerm, filterType, setFilterType, dashboardFilter, setDashboardFilter, setSelectedPerson, addNewPerson 
}: any) {
  const handleExportExcel = async () => {
    if (!filteredPersonnel || filteredPersonnel.length === 0) return;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('پرسنل', {
      views: [{ rightToLeft: true }]
    });

    // Define columns
    worksheet.columns = [
      { header: 'نام', key: 'firstName', width: 15 },
      { header: 'نام خانوادگی', key: 'lastName', width: 22 },
      { header: 'کد ملی', key: 'nationalId', width: 20 },
      { header: 'کد پرسنلی', key: 'id', width: 15 },
      { header: 'نوع', key: 'type', width: 12 },
      { header: 'نسبت', key: 'relation', width: 15 },
      { header: 'وضعیت', key: 'status', width: 12 },
      { header: 'جنسیت', key: 'gender', width: 10 },
      { header: 'تاریخ تولد', key: 'birthDate', width: 15 },
      { header: 'سن', key: 'age', width: 8 },
      { header: 'نام پدر', key: 'fatherName', width: 15 },
      { header: 'شماره شناسنامه', key: 'idNumber', width: 15 },
      { header: 'تعداد تحت تکفل', key: 'dependentsCount', width: 15 },
      { header: 'شماره تماس', key: 'phoneNumber', width: 15 },
      { header: 'نوع بیماری', key: 'diseaseType', width: 15 },
      { header: 'سابقه (سال)', key: 'experienceYears', width: 12 },
      { header: 'سابقه معدنی (روز)', key: 'miningExpDays', width: 15 },
      { header: 'گروه کاری', key: 'workGroup', width: 20 },
      { header: 'واحد', key: 'unit', width: 25 },
      { header: 'سمت', key: 'position', width: 25 },
      { header: 'عنوان شغلی کرمان', key: 'jobTitleKerman', width: 25 },
      { header: 'سمت کارگاهی', key: 'workshopPosition', width: 25 },
      { header: 'تاریخ استخدام', key: 'hireDate', width: 15 },
    ];

    // Add rows
    filteredPersonnel.forEach((p: any) => {
      worksheet.addRow({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        nationalId: p.nationalId || '',
        id: p.id || '',
        type: isEmployee(p) ? 'کارمند' : 'تحت تکفل',
        relation: p.relation || 'خودش',
        status: p.status || '',
        gender: p.gender || '',
        birthDate: p.birthDate || '',
        age: p.age || '',
        fatherName: p.fatherName || '',
        idNumber: p.idNumber || '',
        dependentsCount: p.dependentsCount || 0,
        phoneNumber: p.phoneNumber || '',
        diseaseType: p.diseaseType || '',
        experienceYears: p.experienceYears || 0,
        miningExpDays: p.miningExpDays || 0,
        workGroup: p.workGroup || '',
        unit: p.unit || '',
        position: p.position || '',
        jobTitleKerman: p.jobTitleKerman || '',
        workshopPosition: p.workshopPosition || '',
        hireDate: p.hireDate || ''
      });
    });

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB000' }, // Gold color from theme
      };
      cell.font = {
        bold: true,
        color: { argb: '000000' },
        size: 11,
        name: 'Tahoma'
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    // Style Content Rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 25;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { size: 10, name: 'Tahoma' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'E0E0E0' } },
            left: { style: 'thin', color: { argb: 'E0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'E0E0E0' } },
            right: { style: 'thin', color: { argb: 'E0E0E0' } },
          };
          
          // Alternate Row Styling
          if (rowNumber % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F9F9F9' },
            };
          }
        });
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: 'W1',
    };

    // Generate and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `گزارش_پرسنل_${moment().format('jYYYY-jMM-jDD')}.xlsx`);
  };

  return (
    <Card title="فهرست پرسنل">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={20} />
            <input 
              type="text" 
              placeholder="جستجو (نام، واحد، سمت، سابقه، بازه سنی و...)"
              className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg py-3 pr-12 pl-4 focus:ring-1 focus:ring-[#FFB000] outline-none transition-all placeholder:text-[#8E8E93] text-[#E0E0E0]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-[#1C1C1E] p-1 rounded-lg border border-[#2C2C2E]">
            <button onClick={() => { setFilterType('employees'); setDashboardFilter(null); }} className={cn("px-4 py-2 rounded text-[10px] font-bold uppercase transition-all", (filterType === 'employees' && !dashboardFilter) ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>کارکنان</button>
            <button onClick={() => { setFilterType('dependents'); setDashboardFilter(null); }} className={cn("px-4 py-2 rounded text-[10px] font-bold uppercase transition-all", (filterType === 'dependents' && !dashboardFilter) ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>تحت تکفل</button>
            <button onClick={() => { setFilterType('all'); setDashboardFilter(null); }} className={cn("px-4 py-2 rounded text-[10px] font-bold uppercase transition-all", (filterType === 'all' && !dashboardFilter) ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>همه موارد</button>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportExcel}
              disabled={!filteredPersonnel || filteredPersonnel.length === 0}
              className="flex items-center gap-2 bg-[#2C2C2E] text-[#E0E0E0] px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#3A3A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="خروجی اکسل"
            >
              <Download size={16} />
              خروجی اکسل
            </button>
            <button 
                  onClick={addNewPerson}
                  className="flex items-center gap-2 bg-[#FFB000] text-[#0A0A0B] px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#FFC040] transition-colors"
            >
              <Plus size={16} />
              افزودن فرد جدید
            </button>
          </div>
        </div>

        {dashboardFilter && (
          <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-right duration-300">
            <span className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-wider">فیلتر هوشمند فعال:</span>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#FFB000]/10 border border-[#FFB000]/30 rounded-full group">
              <span className="text-[10px] font-bold text-[#FFB000]">
                {dashboardFilter.key === 'mismatch' ? 'مغایرت سمت' : (
                  (dashboardFilter.key === 'unit' ? 'واحد' : 
                   dashboardFilter.key === 'gender' ? 'جنسیت' : 
                   dashboardFilter.key === 'ageRange' ? 'بازه سنی' : 
                   dashboardFilter.key === 'experienceRange' ? 'سطح سابقه' : 
                   dashboardFilter.key === 'position' ? 'سمت سازمانی' :
                   dashboardFilter.key === 'workGroup' ? 'گروه کاری' :
                   dashboardFilter.key === 'childrenOver18' ? 'فرزندان بالای ۱۸ سال' : '') + 
                  (dashboardFilter.value ? `: ${dashboardFilter.value}` : '')
                )}
              </span>
              <button onClick={() => setDashboardFilter(null)} className="p-0.5 hover:bg-[#FFB000]/20 rounded-full transition-colors"><X size={12} className="text-[#FFB000]" /></button>
            </div>
            <button onClick={() => setDashboardFilter(null)} className="text-[10px] text-[#8E8E93] hover:text-[#FFB000] underline underline-offset-4 transition-colors">پاکسازی فیلتر</button>
          </div>
        )}
        
        <div className="overflow-x-auto rounded-lg border border-[#2C2C2E]">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[#1C1C1E] text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-[#2C2C2E]">کد پرسنلی</th>
                <th className="px-6 py-4 border-b border-[#2C2C2E]">نام و نام خانوادگی</th>
                <th className="px-6 py-4 border-b border-[#2C2C2E]">نسبت</th>
                <th className="px-6 py-4 border-b border-[#2C2C2E]">واحد / سمت</th>
                <th className="px-6 py-4 border-b border-[#2C2C2E]">سن / سابقه</th>
                <th className="px-6 py-4 border-b border-[#2C2C2E]">وضعیت سلامت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2E]">
              {filteredPersonnel.length > 0 ? (
                filteredPersonnel.slice(0, 100).map((person: any, idx: number) => (
                  <tr key={`${person.id}-${idx}`} className="hover:bg-[#1C1C1E] transition-colors cursor-pointer group !border-b !border-[#2C2C2E]/30 last:border-0" onClick={() => setSelectedPerson(person)}>
                    <td className="px-6 py-4 text-sm font-mono text-[#8E8E93]">{person.id || idx}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-bold text-[#FFFFFF] group-hover:text-[#FFB000] transition-colors flex items-center gap-2">
                          {person.firstName || ''} {person.lastName || ''}
                          {(!!person.jobTitleKerman && !!person.workshopPosition && person.jobTitleKerman !== person.workshopPosition) && (
                            <AlertTriangle size={12} className="text-[#EF4444]" title="مغایرت سمت" />
                          )}
                        </div>
                        <div className="text-[10px] text-[#8E8E93] font-mono">{person.nationalId || ''}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase", (person.relationCode === '1' || !person.relation || person.relation === 'خودش') ? "bg-[#FFB000]/10 text-[#FFB000] border border-[#FFB000]/30" : "bg-[#8E8E93]/10 text-[#8E8E93] border border-[#8E8E93]/30")}>
                        {person.relation || 'پرسنل'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#E0E0E0]">{person.unit || '-'}</div>
                      <div className="text-[10px] text-[#8E8E93]">
                        {(() => {
                          const pos = person.position || 'نامشخص';
                          if ((pos === 'نامشخص' || !pos) && person.jobTitleKerman && person.workshopPosition && person.jobTitleKerman === person.workshopPosition) {
                            return (
                              <span className="text-[#FFB000] flex items-center gap-1">
                                <Lightbulb size={10} />
                                {person.jobTitleKerman} (تشخیص خودکار)
                              </span>
                            );
                          }
                          return pos;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#E0E0E0] tabular-nums">{(person.age || 0) > 0 ? `${person.age} سال` : ((person.experienceYears || 0) > 0 ? `${person.experienceYears} سال سابقه` : '-')}</div>
                      <div className="text-[10px] text-[#8E8E93]">{(person.gender || 'نامشخص')}</div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <span className={cn("px-3 py-1 rounded text-[10px] font-bold uppercase", person.diseaseType === 'سالم' ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30" : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30")}>
                        {person.diseaseType || 'نامشخص'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[#8E8E93] text-sm italic">موردی یافت نشد.</td></tr>
              )}
            </tbody>
          </table>
          {filteredPersonnel.length > 100 && <div className="p-4 bg-[#1C1C1E] text-center text-[10px] text-[#8E8E93] uppercase tracking-widest">نمایش ۱۰۰ مورد از {filteredPersonnel.length}</div>}
        </div>
      </div>
    </Card>
  );
}

function ManagementReports({ stats, data, reportConfig, setReportConfig, setSearchTerm, setActiveTab, setDashboardFilter, setFilterType }: any) {
  const filteredData = Array.isArray(data) ? data.filter((p: any) => {
    if (!isEmployee(p)) return false;
    if (reportConfig.value) {
      if (reportConfig.type === 'unit') return p.unit === reportConfig.value;
      if (reportConfig.type === 'position') return p.position === reportConfig.value;
      if (reportConfig.type === 'workGroup') return p.workGroup === reportConfig.value;
    }
    return true;
  }) : [];

  const count = filteredData.length;
  const avgExp = count > 0 ? filteredData.reduce((acc, p) => acc + (p.experienceYears || 0), 0) / count : 0;
  const avgAge = count > 0 ? filteredData.reduce((acc, p) => acc + (p.age || 0), 0) / count : 0;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 max-w-5xl mx-auto">
      <Card title="گزارش واحد و سمت" icon={FileBarChart} iconColor="text-[#FFB000]">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-wider">مبنا</label>
              <div className="flex bg-[#1C1C1E] p-1 rounded-lg border border-[#2C2C2E]">
                <button onClick={() => setReportConfig({ ...reportConfig, type: 'unit', value: '' })} className={cn("flex-1 py-1 rounded text-[10px] font-bold transition-all", reportConfig.type === 'unit' ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>واحد</button>
                <button onClick={() => setReportConfig({ ...reportConfig, type: 'position', value: '' })} className={cn("flex-1 py-1 rounded text-[10px] font-bold transition-all", reportConfig.type === 'position' ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>سمت</button>
                <button onClick={() => setReportConfig({ ...reportConfig, type: 'workGroup', value: '' })} className={cn("flex-1 py-1 rounded text-[10px] font-bold transition-all", reportConfig.type === 'workGroup' ? "bg-[#FFB000] text-[#0A0A0B]" : "text-[#8E8E93]")}>گروه کاری</button>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-wider">انتخاب {reportConfig.type === 'unit' ? 'واحد' : reportConfig.type === 'position' ? 'سمت' : 'گروه کاری'}</label>
              <select value={reportConfig.value} onChange={(e) => setReportConfig({ ...reportConfig, value: e.target.value })} className="w-full bg-[#1C1C1E] border border-[#2C2C2E] text-[#E0E0E0] p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#FFB000]">
                <option value="">همه</option>
                {[...(reportConfig.type === 'unit' ? stats.unitDistribution : (reportConfig.type === 'position' ? stats.positionDistribution : stats.workGroupStats))].sort((a: any, b: any) => b.value - a.value).map((item: any) => (
                  <option key={item.name} value={item.name}>{item.name} ({item.value})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] text-center"><span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1 block">تعداد</span><span className="text-2xl font-bold text-[#FFB000]">{count}</span></div>
            <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] text-center"><span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1 block">میانگین سابقه</span><span className="text-2xl font-bold text-[#FFFFFF]">{avgExp.toFixed(1)}</span></div>
            <div className="bg-[#0A0A0B] p-4 rounded-xl border border-[#2C2C2E] text-center"><span className="text-[10px] text-[#8E8E93] font-bold uppercase mb-1 block">میانگین سن</span><span className="text-2xl font-bold text-[#FFFFFF]">{avgAge.toFixed(1)}</span></div>
          </div>

          {!reportConfig.value && (
            <div className="mt-4 overflow-hidden rounded-lg border border-[#2C2C2E]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#1C1C1E] text-[#8E8E93] text-[9px] font-bold uppercase tracking-widest">
                    <th className="px-4 py-2 border-b border-[#2C2C2E]">نام</th>
                    <th className="px-4 py-2 border-b border-[#2C2C2E]">نفرات</th>
                    <th className="px-4 py-2 border-b border-[#2C2C2E]">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2E]">
                  {[...(reportConfig.type === 'unit' ? stats.unitDistribution : (reportConfig.type === 'position' ? stats.positionDistribution : stats.workGroupStats))].sort((a: any, b: any) => b.value - a.value).slice(0, 10).map((item: any) => (
                    <tr key={item.name} className="hover:bg-[#1C1C1E] transition-colors">
                      <td className="px-4 py-2 text-xs font-bold text-[#FFFFFF]">{item.name}</td>
                      <td className="px-4 py-2 text-xs text-[#E0E0E0]">{item.value}</td>
                      <td className="px-4 py-2 text-left"><button onClick={() => setReportConfig({...reportConfig, value: item.name})} className="text-[9px] text-[#FFB000] font-bold hover:underline">جزئیات</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reportConfig.value && (
             <button onClick={() => { setSearchTerm(reportConfig.value); setActiveTab('personnel'); setDashboardFilter(null); setFilterType('employees'); }} className="w-full text-center text-xs text-[#FFB000] font-bold hover:underline">مشاهده لیست پرسنل</button>
          )}
        </div>
      </Card>

      <Card title="تحلیل استراتژیک" icon={Lightbulb} iconColor="text-[#FFB000]">
        <div className="space-y-4">
          <p className="text-sm text-[#8E8E93] leading-loose">تحلیل داده‌ها نشان می‌دهد توزیع منابع انسانی در بخش‌های مختلف با تمرکز بر تخصص‌های معدنی و ایمنی صورت گرفته است. پیشنهاد می‌شود برنامه‌های آموزشی کوتاه‌مدت برای نیروهای جدیدالورود در واحدهای پرجمعیت تدوین گردد.</p>
        </div>
      </Card>
    </div>
  );
}

function DetailItem({ label, value, isWarning }: { label: string, value: string | number, isWarning?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-[#8E8E93] font-medium uppercase tracking-wider">{label}</span>
      <span className={cn(
        "text-sm font-bold",
        isWarning ? "text-[#FF453A]" : "text-[#E0E0E0]"
      )}>{String(value) || '-'}</span>
    </div>
  );
}

function Card({ 
  title, 
  children, 
  className, 
  icon: Icon, 
  iconColor = "text-[#FFB000]" 
}: { 
  title: string; 
  children: React.ReactNode; 
  className?: string;
  icon?: any;
  iconColor?: string;
}) {
  return (
    <div className={cn("bg-[#151517] rounded-lg p-6 shadow-sm border border-[#2C2C2E]", className)}>
      <div className="flex items-center gap-3 mb-6">
        {Icon ? <Icon className={iconColor} size={24} /> : <div className="w-1.5 h-5 bg-[#FFB000] rounded-full" />}
        <h3 className="text-lg font-serif-header font-bold text-[#FFFFFF]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SmallStatCard({ title, value, icon: Icon, onClick }: { title: string, value: number, icon: any, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-[#151517] p-3 rounded-lg border border-[#2C2C2E] flex items-center justify-between group hover:border-[#FFB000]/30 transition-all",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-[#FFB000]" />
        <span className="text-[11px] font-bold text-[#8E8E93] group-hover:text-[#E0E0E0] transition-colors">{title}</span>
      </div>
      <span className="text-sm font-bold text-[#FFFFFF] tabular-nums">{value}</span>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  color = "brand"
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  subtitle?: string;
  color?: "brand" | "muted" | "warning"
}) {
  const colorClass = color === 'brand' ? 'text-[#FFB000]' : (color === 'warning' ? 'text-[#FF453A]' : 'text-[#8E8E93]');
  return (
    <div className="bg-[#151517] p-5 rounded-lg shadow-sm border border-[#2C2C2E] flex flex-col justify-between group hover:border-[#FFB000]/30 transition-all h-full min-h-[120px]">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest">{title}</h3>
        <Icon size={18} className={colorClass} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-serif-header font-bold text-[#FFFFFF] tabular-nums">
          {value}
        </span>
        {subtitle && <span className="text-sm text-[#FFB000] font-medium">{subtitle}</span>}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-md text-xs font-bold transition-all uppercase tracking-wider",
        active 
          ? "bg-[#FFB000] text-[#0A0A0B] shadow-md" 
          : "text-[#8E8E93] hover:text-[#FFFFFF]"
      )}
    >
      {label}
    </button>
  );
}
