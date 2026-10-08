'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Flower2, 
  Check, 
  Eye, 
  Image as ImageIcon 
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/Cards';
import { Input, Textarea } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { formatVND } from '@/lib/utils/format';
import { createProduct } from '@/lib/services';

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>(250000);
  const [unit, setUnit] = useState('bó');
  const [category, setCategory] = useState('Hoa bó');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    createProduct({
      name,
      price: Number(price) || 0,
      unit,
      category,
      note,
      isActive,
    }).then(() => router.push('/products')).finally(() => setIsLoading(false));
  };

  return (
    <AppShell>
      <PageHeader
        title="Thêm mẫu hoa mới"
        subtitle="Tạo mới sản phẩm hoa vào danh mục của tiệm"
        backHref="/products"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Tên mẫu hoa / sản phẩm"
              required
              placeholder="Ví dụ: Bó hoa cẩm chướng kem pastel"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Giá bán (VNĐ)"
                  type="number"
                  required
                  step="5000"
                  placeholder="250000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Đơn vị tính
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="block w-full rounded-lg border border-stone-300 text-sm text-stone-900 bg-white min-h-[42px] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="bó">bó</option>
                  <option value="giỏ">giỏ</option>
                  <option value="hộp">hộp</option>
                  <option value="lẵng">lẵng</option>
                  <option value="bình">bình</option>
                  <option value="cành">cành</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-lg border border-stone-300 text-sm text-stone-900 bg-white min-h-[42px] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Hoa bó">Hoa bó</option>
                <option value="Hoa giỏ">Hoa giỏ</option>
                <option value="Hoa hộp">Hoa hộp</option>
                <option value="Hoa khai trương">Hoa khai trương</option>
                <option value="Hoa chúc mừng">Hoa chúc mừng</option>
                <option value="Hoa bình">Hoa bình</option>
              </select>
            </div>

            {/* Image Placeholder Upload Section */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Hình ảnh sản phẩm (Placeholder UI)
              </label>
              <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:border-rose-300 transition-colors bg-stone-50/50">
                <ImageIcon className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-700">Tải ảnh mẫu hoa lên</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  (Phase 1 dùng gradient placeholder • Firebase Storage sẽ kết nối ở Phase 2)
                </p>
              </div>
            </div>

            <Textarea
              label="Mô tả / Lưu ý cắm hoa"
              rows={3}
              placeholder="Loại hoa phối cùng, phụ kiện giấy gói nơ, tone màu chủ đạo..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {/* Active switch */}
            <div className="pt-2 flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200">
              <div>
                <p className="text-xs font-semibold text-stone-800">Trạng thái bán hàng</p>
                <p className="text-[11px] text-stone-500">Hiển thị trong danh sách chọn khi tạo đơn</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/products')}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                rightIcon={<Check className="w-4 h-4" />}
              >
                Lưu sản phẩm
              </Button>
            </div>
          </form>
        </div>

        {/* Live Preview Column (4 cols) */}
        <div className="lg:col-span-4 sticky top-6">
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Xem trước thẻ sản phẩm
            </h3>

            <div className="rounded-xl border border-stone-200 overflow-hidden shadow-xs">
              <div className="h-32 bg-gradient-to-tr from-rose-200 via-pink-100 to-amber-100 flex items-center justify-center relative">
                <Flower2 className="w-10 h-10 text-rose-400" />
                <span
                  className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isActive ? 'Đang bán' : 'Ngừng bán'}
                </span>
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-black/40 text-white">
                  {category}
                </span>
              </div>

              <div className="p-3">
                <h4 className="font-bold text-sm text-stone-900 line-clamp-1">
                  {name || 'Tên mẫu hoa...'}
                </h4>
                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                  {note || 'Mô tả tóm tắt mẫu hoa và phụ kiện...'}
                </p>
                <div className="mt-3 pt-2 border-t border-stone-100 flex items-baseline justify-between">
                  <span className="text-[11px] text-stone-400">Giá:</span>
                  <span className="text-sm font-bold text-rose-600">
                    {formatVND(Number(price) || 0)} <span className="text-xs font-normal text-stone-500">/ {unit}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
