import { User, StoreSettings } from '@/types';

export const mockCurrentUser: User = {
  id: 'USER-001',
  name: 'Thu Ngân Mai',
  email: 'thungan@tiemhoa.vn',
  role: 'staff',
};

export const mockStoreSettings: StoreSettings = {
  storeName: 'Tiệm Hoa Tươi Họa Mi',
  phone: '0909888999',
  address: '158 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP.HCM',
  zaloUrl: '#', // Placeholder for phase 2 real Zalo config
  email: 'lienhe@tiemhoa.vn',
  notificationEnabled: true,
};
