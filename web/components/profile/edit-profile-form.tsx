"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  initial: {
    displayName: string | null;
    bio: string | null;
    twitter: string | null;
    telegram: string | null;
    website: string | null;
    avatarUrl: string | null;
  };
  onClose: () => void;
}

export function EditProfileForm({ initial, onClose }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [twitter, setTwitter] = useState(initial.twitter ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [avatarPreview, setAvatarPreview] = useState(initial.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (avatarFile) {
        const body = new FormData();
        body.set("image", avatarFile);
        const res = await fetch("/api/profile/avatar", { method: "POST", body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to upload avatar");
        }
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, twitter, telegram, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save profile");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="flex items-center gap-4">
        <label className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full border border-neutral-700 bg-neutral-800">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">Photo</div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setAvatarFile(file);
              if (file) setAvatarPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          maxLength={32}
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
        />
      </div>

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio"
        maxLength={280}
        rows={3}
        className="mt-3 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
      />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={twitter}
          onChange={(e) => setTwitter(e.target.value)}
          placeholder="Twitter/X"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
        />
        <input
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="Telegram"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
        />
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Website"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
        />
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-900 bg-red-950/50 p-2 text-xs text-red-300">{error}</div>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-lime-400 px-4 py-2 text-xs font-bold text-neutral-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
