import SimulatorPage from './pages/SimulatorPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: '3D Robotic Arm Simulator',
    path: '/',
    element: <SimulatorPage />,
    public: true,
  }
];

