/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PersonnelData {
  id: string; // کد پرسنلی
  firstName: string; // نام
  lastName: string; // نام خانوادگی
  dependentsCount: number; // تعداد تحت تکفل
  gender: string; // جنسیت
  nationalId: string; // کد ملی
  birthDate: string; // تاریخ تولد (Jalali or String)
  age: number; // سن محاسبه شده
  fatherName: string; // نام پدر
  idNumber: string; // شماره شناسنامه
  status: string; // وضعیت
  relationCode: string; // کد نسبت
  phoneNumber: string; // شماره تماس
  relation: string; // نسبت
  diseaseType: string; // نوع بیماری
  experienceYears: number; // سابقه
  workGroup: string; // گروه کاری
  unit: string; // واحد
  position: string; // سمت
  miningExpDays: number; // سابقه کار معدنی (روز)
}

export interface PersonnelStats {
  totalRecords: number;
  totalEmployees: number;
  totalDependents: number;
  genderStats: { name: string; value: number }[];
  ageDistribution: { range: string; count: number }[];
  unitDistribution: { name: string; value: number }[];
  positionDistribution: { name: string; value: number }[];
  experienceStats: {
    avgTotal: number;
    avgMining: number;
    categories: { name: string; count: number }[];
  };
  healthStats: { name: string; count: number }[];
  familyStats: {
    avgDependents: number;
  };
  avgAge: number;
  avgExperienceByUnit: { name: string; value: number }[];
}
