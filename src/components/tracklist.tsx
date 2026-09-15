import type { Track } from "@/content/types";
import { PreviewPlayer } from "./preview-player";

export function Tracklist({ tracks }: { tracks?: Track[] }) {
  if (!tracks?.length) return null;
  return (
    <ol className="divide-y divide-current/15 border-y border-current/15">
      {tracks.map((track, i) => (
        <li key={`${track.title}-${i}`} className="flex items-center gap-4 py-3">
          <span className="label w-7 shrink-0 text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          {track.previewUrl ? <PreviewPlayer src={track.previewUrl} title={track.title} /> : null}
          <span className="min-w-0 flex-1 text-base font-medium leading-snug sm:text-lg">
            {track.title}
            {track.featuring ? <span className="text-muted"> feat. {track.featuring}</span> : null}
          </span>
          {track.duration ? <span className="label shrink-0 text-muted tabular-nums">{track.duration}</span> : null}
        </li>
      ))}
    </ol>
  );
}
