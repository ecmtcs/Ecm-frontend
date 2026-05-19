const FILES_KEY = 'ecm_files'

export function getFiles() {
  return JSON.parse(localStorage.getItem(FILES_KEY) || '[]')
}

export function saveFile({ name, owner }) {
  const files = getFiles()
  const file = {
    id: crypto.randomUUID(),
    name,
    owner,
    createdAt: new Date().toISOString(),
  }
  files.unshift(file)
  localStorage.setItem(FILES_KEY, JSON.stringify(files))
  return file
}

export function searchFiles(files, { query, filter }) {
  if (!query.trim()) return files

  const q = query.toLowerCase()

  return files.filter((file) => {
    if (filter === 'name') {
      return file.name.toLowerCase().includes(q)
    }
    if (filter === 'owner') {
      return file.owner.toLowerCase().includes(q)
    }
    if (filter === 'date') {
      const dateStr = new Date(file.createdAt).toLocaleDateString()
      return dateStr.includes(q)
    }
    return (
      file.name.toLowerCase().includes(q) ||
      file.owner.toLowerCase().includes(q) ||
      new Date(file.createdAt).toLocaleDateString().includes(q)
    )
  })
}
