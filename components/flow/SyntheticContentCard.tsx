"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export interface TavilyPost {
  title: string;
  url: string;
  snippet: string;
  subreddit?: string;
  relevance?: number;
}

export interface SyntheticPayload {
  __synthetic__: true;
  platform: string;
  source_url: string;
  posts: TavilyPost[];
}

export function parseSyntheticPayload(raw: string): SyntheticPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.__synthetic__ === true && Array.isArray(parsed.posts)) {
      return parsed as SyntheticPayload;
    }
  } catch { /* not synthetic */ }
  return null;
}

export default function SyntheticContentCard({ payload }: { payload: SyntheticPayload }) {
  if (payload.platform === "reddit") return <RedditCard payload={payload} />;
  return <GenericCard payload={payload} />;
}

function RedditCard({ payload }: { payload: SyntheticPayload }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-[#ff4500] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-black leading-none">r</span>
        </div>
        <span className="text-[11px] font-bold text-[#ff4500]">Reddit</span>
        <span className="text-[9px] text-slate-500 font-mono truncate max-w-[240px]">{payload.source_url}</span>
        <span className="ml-auto text-[8px] text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 flex-shrink-0">
          via Tavily
        </span>
      </div>

      {/* Posts */}
      {payload.posts.length > 0 ? payload.posts.map((post, i) => (
        <div
          key={i}
          className="bg-[#1a1a1b] border border-[#343536] rounded-lg p-3 hover:border-[#818384] transition-colors"
        >
          {post.subreddit && (
            <div className="text-[9px] text-[#818384] mb-1.5 font-semibold">
              r/{post.subreddit}
            </div>
          )}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1 text-[12px] font-semibold text-[#d7dadc] hover:text-[#ff4500] transition-colors leading-snug mb-1.5"
          >
            <span>{post.title}</span>
            <ExternalLink size={9} className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
          {post.snippet && (
            <p className="text-[10px] text-[#9a9b9b] leading-relaxed line-clamp-3">
              {post.snippet}
            </p>
          )}
        </div>
      )) : (
        <div className="text-[11px] text-slate-500 italic">No posts found.</div>
      )}
    </div>
  );
}

function GenericCard({ payload }: { payload: SyntheticPayload }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-slate-300 capitalize">{payload.platform}</span>
        <span className="text-[8px] text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">
          via Tavily
        </span>
      </div>
      {payload.posts.map((post, i) => (
        <div key={i} className="border border-slate-700 rounded-lg p-3 hover:border-slate-600 transition-colors">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[12px] font-semibold text-slate-200 hover:text-indigo-400 transition-colors mb-1"
          >
            {post.title}
          </a>
          {post.snippet && (
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">{post.snippet}</p>
          )}
        </div>
      ))}
    </div>
  );
}
