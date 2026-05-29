import { resolvePreviewKind } from '../utils/previewTypes'

/**
 * Renders inline preview for PDF, images, text, video, audio, and other browser-supported types.
 */
export default function DocumentPreviewContent({
  url,
  title,
  mimeType,
  filePath = '',
}) {
  const kind = resolvePreviewKind(mimeType, filePath)

  return (
    <div className="doc-preview-content">
      {kind === 'pdf' && (
        <iframe src={url} title={title} className="doc-preview-iframe" />
      )}

      {kind === 'image' && (
        <img
          src={url}
          alt={title}
          className="doc-preview-image"
          loading="lazy"
        />
      )}

      {kind === 'text' && (
        <iframe src={url} title={title} className="doc-preview-iframe doc-preview-iframe--text" />
      )}

      {kind === 'video' && (
        <video src={url} className="doc-preview-media" controls playsInline>
          <track kind="captions" />
          Your browser does not support video playback.
        </video>
      )}

      {kind === 'audio' && (
        <audio src={url} className="doc-preview-audio" controls>
          Your browser does not support audio playback.
        </audio>
      )}

      {kind === 'iframe' && (
        <iframe src={url} title={title} className="doc-preview-iframe" />
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="doc-preview-open-link"
      >
        Open in new tab
      </a>
    </div>
  )
}
