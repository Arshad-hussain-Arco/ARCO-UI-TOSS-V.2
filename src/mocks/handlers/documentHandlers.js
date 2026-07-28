import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { DOCUMENT_FILES, DOCUMENT_FOLDER_TREE } from '../data/documents';

export const getDocuments = async () => {
  await delay(env.mockDelay);

  return {
    folderTree: clone(DOCUMENT_FOLDER_TREE),
    files: clone(DOCUMENT_FILES),
  };
};
