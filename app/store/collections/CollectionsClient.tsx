"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, X, Loader2, Package } from "lucide-react";
import { createCollection } from "@/app/actions/community";
import AgentVisual from "@/components/store/AgentVisual";
import { cn } from "@/lib/utils";

interface CollectionItem {
  id: string;
  flow: { id: string; name: string | null; thumbnail: string | null };
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  _count: { items: number };
  items: CollectionItem[];
}

interface CollectionsClientProps {
  collections: Collection[];
  userId: string | null;
}

function CreateCollectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Collection) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError(null);
    const result = await createCollection(name.trim(), description.trim() || undefined);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onCreated(result.collection as Collection);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <p className="text-sm font-black text-foreground flex items-center gap-2">
            <FolderOpen size={13} className="text-violet-500" />
            New Collection
          </p>
          <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My awesome collection"
              maxLength={80}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this collection about?"
              rows={3}
              maxLength={500}
              className="w-full resize-none px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          {error && <p className="text-[10px] text-rose-400">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-[10px] font-bold text-violet-500 hover:bg-violet-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionsClient({ collections: initial, userId }: CollectionsClientProps) {
  const [collections, setCollections] = useState<Collection[]>(initial);
  const [showModal, setShowModal] = useState(false);

  const handleCreated = (c: Collection) => {
    setCollections(prev => [c, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Collections</h1>
          <p className="text-[11px] text-muted-foreground mt-1">Curated agent collections from the community</p>
        </div>
        {userId ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-[10px] font-bold text-violet-500 hover:bg-violet-500/20 transition-all"
          >
            <Plus size={10} />
            Create Collection
          </button>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            <Link href="/login" className="text-violet-500 hover:underline font-semibold">Sign in</Link> to create collections
          </p>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
          <FolderOpen size={36} className="text-muted-foreground opacity-30" />
          <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No collections yet</p>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Be the first to create a curated collection of agents!
          </p>
          {userId && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-[10px] font-bold text-violet-500 hover:bg-violet-500/20 transition-all"
            >
              Create your first collection
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map(col => (
            <Link
              key={col.id}
              href={`/store/collections/${col.id}`}
              className="flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/40 transition-all group"
            >
              {/* Preview thumbnails grid */}
              <div className="h-28 grid grid-cols-2 border-b border-border overflow-hidden bg-muted/30">
                {col.items.length === 0 ? (
                  <div className="col-span-2 flex items-center justify-center">
                    <FolderOpen size={28} className="text-muted-foreground opacity-20" />
                  </div>
                ) : (
                  col.items.slice(0, 4).map(item => (
                    <div key={item.id} className="relative overflow-hidden border-border border-r border-b last:border-r-0">
                      {item.flow.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.flow.thumbnail} alt={item.flow.name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <AgentVisual agentId={item.flow.id} name={item.flow.name ?? ""} width={120} height={56} className="w-full h-full" />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 flex flex-col gap-1.5 flex-1">
                <h3 className="text-sm font-black text-foreground leading-snug truncate group-hover:text-violet-500 transition-colors">
                  {col.name}
                </h3>
                {col.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{col.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-auto pt-2">
                  <Package size={9} />
                  <span className="font-bold">{col._count.items}</span> agent{col._count.items !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateCollectionModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
