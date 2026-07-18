import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node(Vitest)向けの MSW サーバー。vitest.setup.ts から起動する。
export const server = setupServer(...handlers);
