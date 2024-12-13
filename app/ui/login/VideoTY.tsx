'use client';
import '@justinribeiro/lite-youtube';
export default function VideoTY() {
  return (
    <div className="videoyt">
      {/* @ts-expect-error esto es de la libreria de lite-youtube */}
      <lite-youtube videoid="0MapRprRh24"></lite-youtube>
    </div>
  );
}
