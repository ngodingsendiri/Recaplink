export interface Employee {
  id: string;
  name: string;
  nip: string;
  bidang?: string;
  igUsername?: string;
  fbName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DailyEngagement {
  id: string; // YYYY-MM-DD
  date: string;
  igRawText: string;
  fbRawText: string;
  igEngagedEmployeeIds: string[];
  fbEngagedEmployeeIds: string[];
  igLinks?: string[];
  fbLinks?: string[];
  updatedAt: any;
}
