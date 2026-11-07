import React from 'react';

interface BookLoadingAnimationProps {
  label?: string;
  stageName?: string;
}

export const BookLoadingAnimation: React.FC<BookLoadingAnimationProps> = ({
  label = 'Menyusun Naskah...',
  stageName = 'Alur SCTF',
}) => {
  return (
    <div
      data-testid="open-book-visual"
      className="flex flex-col items-center justify-center p-6 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4"
    >
      <div className="relative w-24 h-16 flex items-center justify-center">
        {/* Visual Buku Terbuka dengan Halaman Berbalik */}
        <div
          data-testid="open-book-flipping-pages"
          className="w-20 h-14 bg-indigo-950 border border-indigo-500/40 rounded-sm shadow-lg flex justify-between p-2 relative overflow-hidden"
        >
          <div className="w-1/2 border-r border-indigo-500/30 pr-1 space-y-1">
            <div className="h-1 bg-indigo-400/60 rounded w-full"></div>
            <div className="h-1 bg-indigo-400/40 rounded w-3/4"></div>
            <div className="h-1 bg-indigo-400/30 rounded w-5/6"></div>
          </div>
          <div className="w-1/2 pl-1 space-y-1">
            <div className="h-1 bg-indigo-400/60 rounded w-full"></div>
            <div className="h-1 bg-indigo-400/40 rounded w-4/5"></div>
            <div className="h-1 bg-indigo-400/30 rounded w-2/3"></div>
          </div>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-bold text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-400 font-mono">{stageName}</p>
      </div>
    </div>
  );
};
