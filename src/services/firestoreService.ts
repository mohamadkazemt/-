import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PersonnelData } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] at ${path}:`, error);
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: 'Auth context needed' // In real app, pass auth info
  };
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  async getAllPersonnel(): Promise<PersonnelData[]> {
    const path = 'personnel';
    try {
      const q = query(collection(db, path), orderBy('lastName', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        firestoreId: doc.id
      })) as (PersonnelData & { firestoreId: string })[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async addPerson(person: Omit<PersonnelData, 'id'> & { id?: string }): Promise<string> {
    const path = 'personnel';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...person,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async updatePerson(firestoreId: string, person: Partial<PersonnelData>): Promise<void> {
    const path = `personnel/${firestoreId}`;
    try {
      const docRef = doc(db, 'personnel', firestoreId);
      await updateDoc(docRef, {
        ...person,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deletePerson(firestoreId: string): Promise<void> {
    const path = `personnel/${firestoreId}`;
    try {
      const docRef = doc(db, 'personnel', firestoreId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async batchAddPersonnel(personnel: PersonnelData[]): Promise<void> {
    const path = 'personnel';
    try {
      const batch = writeBatch(db);
      personnel.forEach(person => {
        const docRef = doc(collection(db, path));
        batch.set(docRef, {
          ...person,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};
