'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function PhotoUploadButton({ productId }: { productId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/upload/products/${productId}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Yükleme başarısız' }));
        throw new Error(body.message ?? 'Yükleme başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Fotoğraf güncellendi');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setUploading(false),
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Ürün fotoğrafı yükle"
        title="Fotoğraf yükle/değiştir"
        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-sm bg-ink/70 text-white backdrop-blur-sm transition-colors duration-150 ease-out-quart hover:bg-ink/85 disabled:opacity-60"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
      </button>
    </>
  );
}
