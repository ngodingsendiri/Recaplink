import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getBidangColor = (bidang?: string) => {
  if (!bidang) return "bg-slate-100 text-slate-400";
  
  // Specific overrides
  if (bidang.toLowerCase() === 'infrastruktur') return "bg-slate-200 text-slate-700";
  if (bidang.toLowerCase() === 'sekretariat') return "bg-white text-slate-900 border border-slate-200";

  const colors = [
    "bg-pink-100 text-pink-600",
    "bg-sky-100 text-sky-600",
    "bg-orange-100 text-orange-600",
    "bg-emerald-100 text-emerald-600",
    "bg-slate-100 text-slate-600",
  ];
  let hash = 0;
  for (let i = 0; i < bidang.length; i++) {
    hash = bidang.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
