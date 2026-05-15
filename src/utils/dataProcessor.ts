/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import moment from 'jalali-moment';
import { PersonnelData, PersonnelStats } from '../types';

const toEnglishDigits = (str: string) => {
  return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
};

const calculateAgeFromJalali = (birthDateStr: string): number => {
  if (!birthDateStr) return 0;
  try {
    const cleanDate = toEnglishDigits(String(birthDateStr)).trim();
    // Support formats like YYYY/MM/DD, YYYY-MM-DD, YYYYMMDD
    const birth = moment(cleanDate, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD', 'jYYYYjMMjDD']);
    if (!birth.isValid()) return 0;
    return moment().diff(birth, 'years');
  } catch (e) {
    return 0;
  }
};

export const parseExcelData = (file: File): Promise<PersonnelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        const findValue = (row: any, aliases: string[]) => {
          const rowKeys = Object.keys(row);
          for (const alias of aliases) {
            // Direct match
            if (row[alias] !== undefined) return row[alias];
            
            // Fuzzy match (ignore spaces and invisible characters)
            const normalizedAlias = alias.replace(/\s/g, '').replace(/\u200c/g, '');
            const match = rowKeys.find(k => {
              const normalizedK = k.toString().replace(/\s/g, '').replace(/\u200c/g, '');
              return normalizedK === normalizedAlias;
            });
            if (match) return row[match];
          }
          return undefined;
        };

        const processedData: PersonnelData[] = json.map((row, index) => {
          const rel = String(findValue(row, ['نسبت', 'نوع نسبت', 'شرح نسبت', 'نسبت با سرپرست']) || '');
          const relCode = String(findValue(row, ['کد نسبت', 'کد قرابت']) || '');
          const birthStr = String(findValue(row, ['تاریخ تولد', 'تاريخ تولد']) || '');
          const hireDateStr = String(findValue(row, ['تاریخ استخدام', 'تاریخ شروع به کار', 'تاريخ استخدام', 'Hire Date']) || '');
          
          // Persian to English digits for numbers
          const cleanNum = (val: any) => {
            if (val === undefined || val === null) return 0;
            const str = toEnglishDigits(String(val)).replace(/[^0-9.]/g, '');
            return parseFloat(str) || 0;
          };

          const daysExp = cleanNum(findValue(row, ['سابقه کار معدنی (روز)', 'سابقه معدنی', 'سابقه معدن', 'سابقه (روز)']));
          let yearsExp = cleanNum(findValue(row, ['سابقه', 'سابقه کار']));

          // If experience is suspiciously high (e.g. > 1000), it might be days instead of years
          if (yearsExp > 100) {
            yearsExp = Math.round((yearsExp / 365) * 10) / 10;
          }

          // If day-based experience is provided, convert it to years for the main field
          let finalYears = daysExp > 0 ? Math.round((daysExp / 365) * 10) / 10 : yearsExp;
          
          // If we have hire date, we can optionally calculate experience if it's missing or to verify
          if (finalYears === 0 && hireDateStr) {
            const hire = moment(toEnglishDigits(hireDateStr), ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD', 'jYYYYjMMjDD']);
            if (hire.isValid()) {
                finalYears = Math.round(moment().diff(hire, 'years', true) * 10) / 10;
            }
          }
          
          const normalizePersian = (str: string) => {
            if (!str) return '';
            return str
              .trim()
              .replace(/ی/g, 'ی') // Standard Farsi Ye
              .replace(/ي/g, 'ی') // Arabic Ye to Farsi
              .replace(/ک/g, 'ک') // Standard Farsi Ke
              .replace(/ك/g, 'ک') // Arabic Ke to Farsi
              .replace(/\u200c/g, ' ') // ZWNJ to space for better grouping
              .replace(/\s+/g, ' '); // Multiple spaces to single
          };

          const unit = normalizePersian(String(findValue(row, ['واحد', 'واحد سازمانی', 'نام واحد', 'محل خدمت', 'قسمت', 'بخش', 'Unit']) || ''));
          const positionValue = normalizePersian(String(findValue(row, ['سمت', 'عنوان شغلی', 'پست سازمانی', 'شغل', 'Position']) || ''));
          const jobTitleKerman = normalizePersian(String(findValue(row, ['عنوان شغل کرمان', 'شغل کرمان']) || ''));
          const workshopPosition = normalizePersian(String(findValue(row, ['سمت کارگاه', 'سمت کارگاهی']) || ''));
          
          let finalPosition = positionValue || 'نامشخص';
          if ((finalPosition === 'نامشخص' || !finalPosition) && jobTitleKerman && workshopPosition && jobTitleKerman === workshopPosition) {
            finalPosition = jobTitleKerman;
          }
          
          return {
            id: String(findValue(row, ['کد پرسنلی', 'شماره پرسنلی', 'کد']) || index),
            firstName: String(findValue(row, ['نام', 'نام شخص']) || ''),
            lastName: String(findValue(row, ['نام خانوادگی', 'نام خانوادگي']) || ''),
            dependentsCount: cleanNum(findValue(row, ['تعداد تحت تکفل', 'تعداد فرزندان'])),
            gender: String(findValue(row, ['جنسیت', 'جنسيت']) || 'نامشخص'),
            nationalId: String(findValue(row, ['کد ملی', 'کد ملي', 'کدملی']) || ''),
            birthDate: birthStr,
            age: calculateAgeFromJalali(birthStr),
            fatherName: String(findValue(row, ['نام پدر', 'نام پدر شخص']) || ''),
            idNumber: String(findValue(row, ['شماره شناسنامه', 'شماره شناسنامه شخص']) || ''),
            status: String(findValue(row, ['وضعیت', 'وضعیت فعالیت']) || ''),
            relationCode: relCode,
            phoneNumber: String(findValue(row, ['شماره تماس', 'تلفن', 'موبایل']) || ''),
            relation: rel,
            diseaseType: String(findValue(row, ['نوع بیماری', 'بیماری']) || 'سالم'),
            experienceYears: finalYears,
            workGroup: String(findValue(row, ['گروه کاری', 'گروه']) || 'سایر'),
            unit: unit || 'نامشخص',
            position: finalPosition,
            jobTitleKerman: jobTitleKerman,
            workshopPosition: workshopPosition,
            miningExpDays: daysExp,
            hireDate: hireDateStr,
          };
        });

        resolve(processedData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const isEmployee = (p: PersonnelData): boolean => {
  const rel = (p.relation || '').trim();
  const relCode = (p.relationCode || '').trim();
  
  // Common terms for the primary employee
  const employeeTerms = ['خودش', 'اصلی', 'پرسنل', 'شاغل', 'سرپرست', 'کارمند', 'کارگر'];
  if (employeeTerms.includes(rel)) return true;
  
  // Common codes for the primary employee
  const employeeCodes = ['1', '01', '0', '1.0', 'اصلی'];
  if (employeeCodes.includes(relCode)) return true;

  // Known dependent terms/codes
  const dependentTerms = ['همسر', 'فرزند', 'مادر', 'پدر', 'خواه', 'برادر', 'نوه', 'خانواده', 'تحت تکفل', 'غیر اصلی'];
  if (rel && dependentTerms.some(term => rel.includes(term))) return false;
  
  // If we have a relation code that is NOT an employee code, it's likely a dependent
  if (relCode && !employeeCodes.includes(relCode)) return false;

  // Fallback: if both are empty, assume employee (usually the case for simple lists)
  return !rel && !relCode;
};

export const calculateStats = (data: PersonnelData[]): PersonnelStats => {
  const totalRecords = data.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      totalEmployees: 0,
      totalDependents: 0,
      genderStats: [],
      ageDistribution: [],
      unitDistribution: [],
      positionDistribution: [],
      experienceStats: { avgTotal: 0, avgMining: 0, categories: [] },
      healthStats: [],
      familyStats: { 
        avgDependents: 0,
        breakdown: { children: 0, childrenOver18: 0, spouse: 0, mother: 0, father: 0, other: 0 }
      },
      avgAge: 0,
      avgExperienceByUnit: [],
      workGroupStats: [],
      mismatch: 0,
    };
  }

  const employees = data.filter(isEmployee);
  const dependents = data.filter(p => !isEmployee(p));
  
  const totalEmployees = employees.length;
  const totalDependents = dependents.length;

  // Working Group Distribution
  const workGroups: Record<string, number> = {};
  employees.forEach(p => {
    const wg = p.workGroup || 'سایر';
    workGroups[wg] = (workGroups[wg] || 0) + 1;
  });

  // Use only employees for main demographics
  const genderStatsMap: Record<string, number> = {};
  employees.forEach(p => {
    genderStatsMap[p.gender] = (genderStatsMap[p.gender] || 0) + 1;
  });

  // Age Distribution (Employees only)
  const ageDistribution: Record<string, number> = {
    'زیر ۳۰': 0,
    '۳۰ تا ۴۰': 0,
    '۴۰ تا ۵۰': 0,
    '۵۰ به بالا': 0,
  };
  let totalAge = 0;
  let ageCount = 0;
  employees.forEach(p => {
    if (p.age > 0) {
      const age = p.age;
      totalAge += age;
      ageCount++;
      if (age < 30) ageDistribution['زیر ۳۰']++;
      else if (age < 40) ageDistribution['۳۰ تا ۴۰']++;
      else if (age < 50) ageDistribution['۴۰ تا ۵۰']++;
      else ageDistribution['۵۰ به بالا']++;
    }
  });
  const avgAge = ageCount > 0 ? totalAge / ageCount : 0;

  // Unit and Position Distribution (Employees only)
  const units: Record<string, number> = {};
  const positions: Record<string, number> = {};
  const unitExperienceSum: Record<string, number> = {};
  const unitExperienceCount: Record<string, number> = {};

  employees.forEach(p => {
    units[p.unit] = (units[p.unit] || 0) + 1;
    
    // Apply position inference logic for stats as well
    let effectivePosition = p.position;
    if ((effectivePosition === 'نامشخص' || !effectivePosition) && p.jobTitleKerman && p.workshopPosition && p.jobTitleKerman === p.workshopPosition) {
      effectivePosition = p.jobTitleKerman;
    }
    positions[effectivePosition] = (positions[effectivePosition] || 0) + 1;
    
    unitExperienceSum[p.unit] = (unitExperienceSum[p.unit] || 0) + p.experienceYears;
    unitExperienceCount[p.unit] = (unitExperienceCount[p.unit] || 0) + 1;
  });

  const avgExperienceByUnit = Object.keys(units).map(unit => ({
    name: unit,
    value: Number((unitExperienceSum[unit] / unitExperienceCount[unit]).toFixed(1))
  }));

  // Experience Stats (Employees only)
  const avgTotal = totalEmployees > 0 ? employees.reduce((acc, p) => acc + p.experienceYears, 0) / totalEmployees : 0;
  const avgMining = totalEmployees > 0 ? employees.reduce((acc, p) => acc + p.miningExpDays, 0) / totalEmployees : 0;
  
  const expCategories = {
    'کم (زیر ۵ سال)': 0,
    'متوسط (۵ تا ۱۵)': 0,
    'زیاد (بالای ۱۵)': 0,
  };
  employees.forEach(p => {
    if (p.experienceYears < 5) expCategories['کم (زیر ۵ سال)']++;
    else if (p.experienceYears < 15) expCategories['متوسط (۵ تا ۱۵)']++;
    else expCategories['زیاد (بالای ۱۵)']++;
  });

  // Health (All records or employees? Usually employees are most critical for safety)
  const healthIssues: Record<string, number> = {};
  employees.forEach(p => {
    if (p.diseaseType && p.diseaseType !== 'سالم' && p.diseaseType !== '') {
      healthIssues[p.diseaseType] = (healthIssues[p.diseaseType] || 0) + 1;
    }
  });

  // Family
  const avgDependents = totalEmployees > 0 ? employees.reduce((acc, p) => acc + p.dependentsCount, 0) / totalEmployees : 0;
  
  const dependentBreakdown = {
    children: 0,
    childrenOver18: 0,
    spouse: 0,
    mother: 0,
    father: 0,
    other: 0,
  };

  dependents.forEach(d => {
    const rel = (d.relation || '').trim();
    if (rel.includes('فرزند') || rel.includes('پسر') || rel.includes('دختر')) {
      dependentBreakdown.children++;
      if (d.age >= 18) {
        dependentBreakdown.childrenOver18++;
      }
    } else if (rel.includes('همسر')) {
      dependentBreakdown.spouse++;
    } else if (rel.includes('مادر')) {
      dependentBreakdown.mother++;
    } else if (rel.includes('پدر')) {
      dependentBreakdown.father++;
    } else {
      dependentBreakdown.other++;
    }
  });

  // Mismatch Count
  const mismatch = employees.filter(p => {
    const titleK = (p.jobTitleKerman || '').trim();
    const titleW = (p.workshopPosition || '').trim();
    return !!titleK && !!titleW && titleK !== titleW;
  }).length;

  return {
    totalRecords,
    totalEmployees,
    totalDependents,
    genderStats: Object.entries(genderStatsMap).map(([name, value]) => ({ name, value })),
    ageDistribution: Object.entries(ageDistribution).map(([range, count]) => ({ range, count })),
    unitDistribution: Object.entries(units).map(([name, value]) => ({ name, value })),
    positionDistribution: Object.entries(positions).map(([name, value]) => ({ name, value })),
    experienceStats: {
      avgTotal,
      avgMining,
      categories: Object.entries(expCategories).map(([name, count]) => ({ name, count })),
    },
    healthStats: Object.entries(healthIssues).map(([name, count]) => ({ name, count })),
    familyStats: {
      avgDependents,
      breakdown: dependentBreakdown,
    },
    avgAge,
    avgExperienceByUnit,
    workGroupStats: Object.entries(workGroups).map(([name, value]) => ({ name, value })),
    mismatch,
  };
};
