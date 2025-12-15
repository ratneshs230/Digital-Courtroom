export enum Role {
  Petitioner = 'Petitioner',
  Respondent = 'Respondent',
  Judge = 'Judge'
}

export enum FileType {
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT = 'text/plain'
}

export interface CaseFile {
  id: string;
  name: string;
  type: string;
  content: string; // In a real app, this would be a URL or blob reference. Here we store text content.
}

export interface Project {
  id: string;
  name: string;
  caseTitle: string;
  description: string;
  userSide: Role.Petitioner | Role.Respondent;
  files: CaseFile[];
  createdAt: number;
  legalContext?: string; // Analysis of laws/acts
}

export interface SimulationMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  references?: string[]; // Legal sections cited
}

export interface Session {
  id: string;
  projectId: string;
  reason: string;
  maxTurns: number;
  currentTurnCount: number;
  status: 'pending' | 'active' | 'completed';
  messages: SimulationMessage[];
  verdict?: string;
  createdAt: number;
  selectedFileIds?: string[]; // IDs of documents selected for this session
}
