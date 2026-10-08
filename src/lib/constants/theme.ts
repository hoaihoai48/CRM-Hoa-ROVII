/**
 * Hệ thống cấu hình Theme Tokens dùng chung cho toàn bộ dự án Tiệm Hoa CRM.
 * Khi cần thay đổi màu sắc nhận diện thương hiệu, chỉ cần chỉnh sửa tại file này hoặc trong globals.css.
 */

export const THEME_CONFIG = {
  brand: {
    name: 'Tiệm Hoa',
    slogan: 'Quản lý đơn hàng & Mini CRM',
    // Mã màu chủ đạo (Primary Hex)
    primaryColor: '#e11d48', // Rose 600
    primaryLight: '#fff1f2', // Rose 50
    primaryDark: '#be123c',  // Rose 700
  },
  statusColors: {
    new: {
      label: 'Mới',
      bgLight: 'bg-rose-50',
      textLight: 'text-rose-700',
      borderLight: 'border-rose-200/70',
      bgDark: 'dark:bg-rose-950/60',
      textDark: 'dark:text-rose-300',
      dot: 'bg-rose-500',
    },
    confirmed: {
      label: 'Đã xác nhận',
      bgLight: 'bg-blue-50',
      textLight: 'text-blue-700',
      borderLight: 'border-blue-200/70',
      bgDark: 'dark:bg-blue-950/60',
      textDark: 'dark:text-blue-300',
      dot: 'bg-blue-500',
    },
    delivering: {
      label: 'Đang giao',
      bgLight: 'bg-amber-50',
      textLight: 'text-amber-700',
      borderLight: 'border-amber-200/70',
      bgDark: 'dark:bg-amber-950/60',
      textDark: 'dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    completed: {
      label: 'Hoàn tất',
      bgLight: 'bg-emerald-50',
      textLight: 'text-emerald-700',
      borderLight: 'border-emerald-200/70',
      bgDark: 'dark:bg-emerald-950/60',
      textDark: 'dark:text-emerald-300',
      dot: 'bg-emerald-500',
    },
    cancelled: {
      label: 'Đã hủy',
      bgLight: 'bg-stone-100',
      textLight: 'text-stone-600',
      borderLight: 'border-stone-200',
      bgDark: 'dark:bg-stone-800',
      textDark: 'dark:text-stone-400',
      dot: 'bg-stone-400',
    },
  },
} as const;
