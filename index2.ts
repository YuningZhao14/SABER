import Dexie, { Table } from 'dexie';

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentParagraph {
  index: number;
  koText: string;
  viText: string;
  translationMode?: 'natural' | 'literal' | 'literary' | 'manual';
  grammarNotes?: string;
  updatedAt: number;
}

export interface LocalDocument {
  id: string;
  userId: string;
  title: string;
  paragraphs: DocumentParagraph[];
  lastReadIndex: number;
  updatedAt: number;
}

export interface VocabFolder {
  id: string;
  userId: string;
  name: string;
  color: string; // Mã màu Dark Academia / Botanical
  description?: string;
  createdAt: number;
}

export interface VocabItem {
  id: string;
  userId: string;
  folderId: string; // 'default' hoặc ID thư mục riêng
  word: string;
  lemma: string;
  pronunciation: string;
  meaning: string;
  pos: string; // Từ loại
  grammar?: string;
  exampleKo?: string;
  exampleVi?: string;
  sourceDocTitle?: string;
  personalNote?: string;
  masteryLevel: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
  updatedAt: number;
}

export class DiAnTuHaDB extends Dexie {
  users!: Table<LocalUser, string>;
  documents!: Table<LocalDocument, string>;
  vocabFolders!: Table<VocabFolder, string>;
  vocabItems!: Table<VocabItem, string>;

  constructor() {
    super('DiAnTuHa_v2_2');
    this.version(1).stores({
      users: 'id, &username, &email',
      documents: 'id, userId, title, updatedAt',
      vocabFolders: 'id, userId, name',
      vocabItems: 'id, userId, folderId, word, lemma, pos, masteryLevel, createdAt',
    });
  }
}

export const db = new DiAnTuHaDB();