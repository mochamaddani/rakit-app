export interface DocumentIssue {
  /** Dot-joined location, e.g. 'sections.0.blocks.0.props.headline'. */
  path: string;
  message: string;
}

export class DocumentValidationError extends Error {
  override name = 'DocumentValidationError';

  constructor(
    message: string,
    readonly issues: readonly DocumentIssue[] = [],
  ) {
    super(message);
  }
}
