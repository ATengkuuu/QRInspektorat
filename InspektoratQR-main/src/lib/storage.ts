export async function uploadImage(file: File): Promise<string | null> {
  try {
    if (!file) {
      throw new Error('No file provided')
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB')
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please upload an image.')
    }

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.')
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })
  } catch (error) {
    console.error('Error in uploadImage:', error)
    throw error
  }
}

export async function deleteImage(url: string) {
  return url
}
