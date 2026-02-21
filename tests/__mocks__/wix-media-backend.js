export const mediaManager = {
  listFiles: async () => ({ files: [] }),
  listFolders: async () => ({ folders: [] }),
  getFileUrl: async (fileUrl) => `https://static.wixstatic.com/media/${fileUrl}`,
  getDownloadUrl: async (fileUrl) => `https://static.wixstatic.com/media/${fileUrl}`,
  getFileInfo: async () => ({}),
  upload: async (path, content, name) => ({ fileName: name }),
  importFile: async (url) => ({ fileName: 'imported.jpg' }),
  getUploadUrl: async () => ({ uploadUrl: 'https://upload.example.com' }),
};
