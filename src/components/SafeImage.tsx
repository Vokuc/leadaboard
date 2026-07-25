'use client';

import Image from 'next/image';

interface SafeImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
}

function shouldDisableOptimization(src: string): boolean {
  return src.startsWith('data:') || src.endsWith('.svg') || src.includes('/svg?');
}

export default function SafeImage({ src, alt, width, height, className, sizes }: SafeImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      unoptimized={shouldDisableOptimization(src)}
    />
  );
}