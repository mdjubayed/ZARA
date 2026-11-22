import { useState } from 'react';

const MODEL_URL = 'https://sketchfab.com/models/e16bf07a62e54b8ea99ca2653675bb41/embed?autostart=1&ui_infos=0&ui_controls=1&ui_theme=dark&dnt=1&transparent=1';

export default function SketchfabAvatar() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="zara-3d-character">
      {!failed ? (
        <iframe
          title="ZARA interactive 3D anime sci-fi character"
          src={MODEL_URL}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          loading="eager"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="zara-3d-fallback">
          <strong>3D character viewer unavailable</strong>
          <span>Check your internet connection and reload ZARA.</span>
        </div>
      )}
      <a
        className="zara-model-credit"
        href="https://sketchfab.com/3d-models/elle-sci-fi-anime-girl-e16bf07a62e54b8ea99ca2653675bb41"
        target="_blank"
        rel="noreferrer"
      >
        3D character: Elle · Kai Sama · CC BY
      </a>
    </div>
  );
}
