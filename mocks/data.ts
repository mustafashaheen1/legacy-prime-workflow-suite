import { Project, Client, Expense, Photo, Task, DailyLog, User } from '@/types';
import { fixtureProjects, fixtureClients, fixtureExpenses, fixturePhotos } from './fixtures';

export const mockProjects: Project[] = fixtureProjects;

export const mockClients: Client[] = fixtureClients;

export const mockExpenses: Expense[] = fixtureExpenses;

export const mockPhotos: Photo[] = fixturePhotos;

export const mockTasks: Task[] = [
  {
    id: '1',
    projectId: '1',
    name: 'Framing',
    date: '2023-10-25',
    reminder: '1 day before',
    completed: false,
  },
  {
    id: '2',
    projectId: '1',
    name: 'Painting',
    date: '2023-10-26',
    reminder: '2 days before',
    completed: false,
  },
  {
    id: '3',
    projectId: '1',
    name: 'Electrical Setup',
    date: '2023-10-27',
    reminder: '3 days before',
    completed: false,
  },
];

export const mockDailyLogs: DailyLog[] = [];

export const mockUsers: User[] = [];

export const expenseCategories = [
  'Material',
  'Labor',
  'Equipment',
  'Permits',
  'Utilities',
  'Other',
];

export const expenseSubcategories = [
  'Preconstruction',
  'Foundation',
  'Framing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Finishing',
];

export const photoCategories = [
  'Foundation',
  'Framing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Drywall',
  'Painting',
  'Flooring',
  'Exterior',
  'Landscaping',
  'Other',
];
