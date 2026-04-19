import type { Car } from '../../../types';

export type VehicleFormValues = {
  bond: number;
  image: string;
  model_year: number;
  name: string;
  status: Car['status'];
  weekly_price: number;
};

export type VehicleDialogMode = 'archive' | 'delete' | 'discard' | 'restore';
