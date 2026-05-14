import { PersonnelData } from '../types';

const getAuthHeader = () => {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const apiService = {
    async login(email: string, password: string): Promise<{ token: string, email: string }> {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Login failed');
        }
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_email', data.email);
        return data;
    },

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_email');
    },

    async getAllPersonnel(): Promise<PersonnelData[]> {
        const response = await fetch('/api/personnel', {
            headers: getAuthHeader()
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            if (response.status === 403) throw new Error('Forbidden');
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || err.error || 'Failed to fetch personnel');
        }
        const data = await response.json();
        // Map db_id to firestoreId (to keep frontend naming consistent for now)
        return data.map((item: any) => ({
            ...item,
            firstName: item.first_name,
            lastName: item.last_name,
            dependentsCount: item.dependents_count,
            nationalId: item.national_id,
            birthDate: item.birth_date,
            fatherName: item.father_name,
            idNumber: item.id_number,
            relationCode: item.relation_code,
            phoneNumber: item.phone_number,
            diseaseType: item.disease_type,
            experienceYears: item.experience_years,
            workGroup: item.work_group,
            miningExpDays: item.mining_exp_days,
            hireDate: item.hire_date,
            jobTitleKerman: item.job_title_kerman,
            workshopPosition: item.workshop_position,
            firestoreId: item.db_id.toString()
        }));
    },

    async addPersonnel(person: PersonnelData | PersonnelData[]): Promise<void> {
        const response = await fetch('/api/personnel', {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify(person)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || err.error || 'Failed to add personnel');
        }
    },

    async updatePerson(dbId: string, person: Partial<PersonnelData>): Promise<void> {
        // Map frontend camelCase to snake_case for DB
        const mappedPerson = {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            dependentsCount: person.dependentsCount,
            gender: person.gender,
            nationalId: person.nationalId,
            birthDate: person.birthDate,
            age: person.age,
            fatherName: person.fatherName,
            idNumber: person.idNumber,
            status: person.status,
            relationCode: person.relationCode,
            phoneNumber: person.phoneNumber,
            relation: person.relation,
            diseaseType: person.diseaseType,
            experienceYears: person.experienceYears,
            workGroup: person.workGroup,
            unit: person.unit,
            position: person.position,
            jobTitleKerman: person.jobTitleKerman,
            workshopPosition: person.workshopPosition,
            miningExpDays: person.miningExpDays,
            hireDate: person.hireDate
        };

        const response = await fetch(`/api/personnel/${dbId}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify(mappedPerson)
        });
        if (!response.ok) throw new Error('Failed to update person');
    },

    async deletePerson(dbId: string): Promise<void> {
        const response = await fetch(`/api/personnel/${dbId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (!response.ok) throw new Error('Failed to delete person');
    }
};
