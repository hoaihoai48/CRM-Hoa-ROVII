'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  PlusCircle, 
  Flower2, 
  Edit3
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, EmptyState } from '@/components/common/Cards';
import { SearchInput } from '@/components/common/Input';
import { products } from '@/lib/services';
import { formatVND } from '@/lib/utils/format';

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      if (statusFilter === 'active' && !product.isActive) return false;
      if (statusFilter === 'inactive' && product.isActive) return false;
      if (!searchTerm.trim()) return true;
      return product.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [searchTerm, statusFilter]);

  return (
    <AppShell>
      <PageHeader
        title="Sản phẩm"
        subtitle="Quản lý danh mục hoa, bảng giá và mẫu hoa của tiệm"
        action={
          <Link
            href="/products/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm sản phẩm</span>
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 mb-6 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên sản phẩm hoa..."
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Tất cả ({mockProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Đang bán
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Ngừng bán
            </button>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title="Không tìm thấy mẫu hoa nào"
          description="Thử tìm với tên hoa khác hoặc thêm sản phẩm hoa mới."
          icon={Flower2}
          action={
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm sản phẩm</span>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden flex flex-col justify-between hover:border-stone-300 transition-colors group"
            >
              {/* Product Card Header Image */}
              <div
                className="h-36 relative flex items-center justify-center p-4 bg-gradient-to-tr from-rose-100 via-pink-50 to-amber-50 bg-cover bg-center"
                style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}
              >
                {!product.imageUrl && (
                  <Flower2 className="w-12 h-12 text-rose-300 group-hover:scale-110 transition-transform duration-300" />
                )}
                {product.imageUrl && (
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" aria-hidden="true" />
                )}
                <span
                  className={`absolute top-3 right-3 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    product.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}
                >
                  {product.isActive ? 'Đang bán' : 'Ngừng bán'}
                </span>
                {product.category && (
                  <span className="absolute bottom-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-white backdrop-blur-xs">
                    {product.category}
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm group-hover:text-rose-600 transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  {product.note && (
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      {product.note}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-stone-400 block font-medium">Giá bán</span>
                    <span className="text-base font-bold text-rose-600">
                      {formatVND(product.price)}{' '}
                      <span className="text-xs text-stone-500 font-normal">/ {product.unit}</span>
                    </span>
                  </div>

                  <Link
                    href={`/products/${product.id}`}
                    className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
