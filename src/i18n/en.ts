export const en = {
  'common.cancel': 'Cancel',
  'common.reset': 'Reset',
  'common.save': 'Save',
  'common.enabled': 'Enabled',
  'settings.general': 'General',
  'settings.debug': 'Debug logging',
  'settings.debugDesc': 'Write extra diagnostics to the developer console.',
  'settings.feature.enabled': 'Enabled',
  'settings.feature.reset': 'Reset this feature',
  'settings.feature.resetDesc': 'Restore this feature to its default settings.',
  'settings.feature.resetTitle': 'Reset feature settings',
  'settings.feature.resetConfirm':
    'Reset all settings for “{name}”? This cannot be undone.',
  'notice.featureEnableFailed':
    'Failed to enable “{name}”. See the developer console for details.',
  'notice.settingsSaveFailed':
    'Failed to save plugin settings. See the developer console for details.',

  'features.attachments.name': 'Attachment Manager',
  'features.attachments.description':
    'Save pasted images and uploaded files under the configured assets folder while preserving the note folder structure.',
  'features.attachments.assetsRoot': 'Assets root folder',
  'features.attachments.assetsRootDesc':
    'Vault-relative folder for attachments. A note at dir/dirb/note.md saves to assets/dir/dirb/. Entering /assets is normalized to assets.',
  'features.attachments.filenamePattern': 'Pasted image filename pattern',
  'features.attachments.filenamePatternDesc':
    'Tokens: {note}, {suffix}, {timestamp}. For pasted images, {suffix} is the millisecond timestamp and {timestamp} is local time as YYYYMMDD-HHmmss. The extension is appended automatically.',
  'features.attachments.uploadFilenamePattern': 'Upload filename pattern',
  'features.attachments.uploadFilenamePatternDesc':
    'Used for uploaded files. {suffix} is the original file name (sanitized, without its extension). The default keeps only the original name, with no note prefix. The extension is appended automatically.',
  'features.attachments.embedImages': 'Embed images',
  'features.attachments.embedImagesDesc':
    'Insert image attachments as embeds (![[...]] or ![...](...)). Turn off to insert plain links.',
  'features.attachments.command.upload':
    'Upload attachment and insert link',

  'features.attachments.notice.noActiveNote':
    'Open a saved Markdown note before pasting an attachment.',
  'features.attachments.notice.noActiveEditor':
    'Switch to Markdown editing mode before uploading an attachment.',
  'features.attachments.notice.busy':
    'Finish naming the current attachment before starting another one.',
  'features.attachments.notice.cancelled': 'Attachment paste cancelled.',
  'features.attachments.notice.invalidSettings':
    'Invalid attachment settings: {message}',
  'features.attachments.notice.saveFailed':
    'Failed to save attachment: {message}',
  'features.attachments.notice.linkFailed':
    'The attachment was saved, but the link could not be inserted: {message}. Insert it manually.',
  'features.attachments.notice.uploadFailed':
    'Failed to upload attachment: {message}',
  'features.attachments.notice.noFiles': 'No files were selected.',

  'features.attachments.rename.title': 'Save attachment',
  'features.attachments.rename.position': 'Image {index} of {total}',
  'features.attachments.rename.folder': 'Save to: {folder}',
  'features.attachments.rename.label': 'File name',
  'features.attachments.rename.save': 'Save',
  'features.attachments.rename.errorEmpty': 'Enter a file name.',
  'features.attachments.rename.errorSeparator':
    'The file name cannot contain / or \\.',
  'features.attachments.rename.errorInvalid':
    'The file name contains characters that are not allowed.',
  'features.attachments.rename.errorTooLong': 'The file name is too long.',
  'features.attachments.rename.errorReserved':
    'This name is reserved by the operating system.',
  'features.attachments.rename.errorExists':
    'A file or folder with this name already exists.',
  'features.attachments.rename.errorDuplicate':
    'This name is already used by another attachment in this paste.',

  'features.attachments.validation.assetsRootEmpty':
    'The assets root folder cannot be empty.',
  'features.attachments.validation.assetsRootAbsolute':
    'Enter a vault-relative folder, not an absolute or drive path.',
  'features.attachments.validation.assetsRootInvalid':
    'The assets root folder must not contain “.” or “..” segments.',
  'features.attachments.validation.patternEmpty':
    'The filename pattern cannot be empty.',
  'features.attachments.validation.patternSeparator':
    'The filename pattern must not contain / or \\.',
  'features.attachments.validation.patternToken':
    'Unknown token in the filename pattern. Allowed tokens: {note}, {suffix}, {timestamp}.',
  'features.attachments.validation.patternInvalid':
    'The filename pattern does not produce a usable file name.',

  'features.note-roaming.name': 'Note Roaming',
  'features.note-roaming.description':
    'Open a random Markdown note from selected folders, or from the whole vault when no path is configured.',
  'features.note-roaming.roamPaths': 'Roaming paths',
  'features.note-roaming.roamPathsDesc':
    'One vault-relative folder or Markdown file per line. Folders include all subfolders; leave empty to roam the whole vault.',
  'features.note-roaming.roamPathsPlaceholder':
    'e.g. daily-notes / projects/archive',
  'features.note-roaming.command.roam': 'Roam to a random note',
  'features.note-roaming.ribbon': 'Roam to a random note',
  'features.note-roaming.validation.pathInvalid':
    'Invalid roaming path: {path}. Enter a vault-relative path without “.” or “..” segments.',
  'features.note-roaming.notice.noNotes':
    'No Markdown notes to roam. Check the roaming paths.',
  'features.note-roaming.notice.openFailed':
    'Failed to open a random note: {message}',
} as const;

export type MessageKey = keyof typeof en;
