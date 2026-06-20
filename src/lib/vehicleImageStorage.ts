import { uploadVehicleImageFile } from './api';

export const uploadVehicleImage = async (file: File) => {
  return uploadVehicleImageFile(file);
};

export const getVehicleImagesBucket = () => 'vehicle-images';
