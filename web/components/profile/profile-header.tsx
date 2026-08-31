"use client";

import { useState } from "react";
import { useSession } from "@/components/wallet/session-context";
import { EditProfileForm } from "./edit-profile-form";
import { shortAddress, relativeTime } from "@/lib/format";
import type { Badge } from "@/lib/badges";

interface Props {
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  memberSince: number | null;
  badges: Badge[];
}

export function ProfileHeader(props: Props) {
  const { sessionAddress } = useSession();
  const [editing, setEditing] = useState(false);
  const isOwner = sessionAddress?.toLowerCase() === props.address.toLowerCase();

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-neutral-800 bg-neutral-900">
          {props.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-black text-neutral-600">
              {(props.displayName || props.address).slice(props.displayName ? 0 : 2, props.displayName ? 2 : 4).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-neutral-50">{props.displayName || shortAddress(props.address)}</h1>
            {isOwner && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-300 hover:border-lime-400"
              >
                Edit profile
              </button>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{props.address}</p>
          {props.bio && <p className="mt-2 max-w-xl text-sm text-neutral-300">{props.bio}</p>}
          {props.memberSince && (
            <p className="mt-1 text-xs text-neutral-600" suppressHydrationWarning>
              Member since {relativeTime(props.memberSince)}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {props.twitter && <SocialLink href={props.twitter} label="Twitter/X" />}
            {props.telegram && <SocialLink href={props.telegram} label="Telegram" />}
            {props.website && <SocialLink href={props.website} label="Website" />}
          </div>
        </div>
      </div>

      {props.badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {props.badges.map((b) => (
            <span
              key={b.id}
              title={b.description}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs font-medium text-neutral-300"
            >
              <span>{b.icon}</span>
              {b.label}
            </span>
          ))}
        </div>
      )}

      {isOwner && editing && (
        <EditProfileForm
          initial={{
            displayName: props.displayName,
            bio: props.bio,
            twitter: props.twitter,
            telegram: props.telegram,
            website: props.website,
            avatarUrl: props.avatarUrl,
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-600"
    >
      {label}
    </a>
  );
}
