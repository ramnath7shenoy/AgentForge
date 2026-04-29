import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Infer AI provider from API key prefix — used by AI Architect modal and walker.
export type ArchitectProvider = 'gemini' | 'groq' | 'openai';

export function detectArchitectProvider(key: string): ArchitectProvider {
  if (/^AIza/.test(key)) return 'gemini';
  if (/^gsk_/.test(key))  return 'groq';
  if (/^sk-/.test(key))   return 'openai';
  return 'gemini'; // safe default
}
