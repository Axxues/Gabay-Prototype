import React from 'react';
import type { ReferenceItem } from '../../../shared/data/syllabusData';
import { formatApa7ReferenceSegments } from '../../../shared/data/syllabusData';

interface ApaReferenceTextProps {
  reference: ReferenceItem;
  className?: string;
}

/**
 * Renders an APA 7 reference with italics (book/page titles, journal names,
 * volume numbers). References carrying only a legacy flat `citation` string
 * (no structured author/title fields) render as plain text.
 */
export const ApaReferenceText: React.FC<ApaReferenceTextProps> = ({ reference, className }) => {
  if (!reference.authors && !reference.title) {
    return <span className={className}>{reference.citation}</span>;
  }
  return (
    <span className={className}>
      {formatApa7ReferenceSegments(reference).map((seg, i) =>
        seg.italic ? <em key={i}>{seg.text}</em> : <React.Fragment key={i}>{seg.text}</React.Fragment>
      )}
    </span>
  );
};
