import { supabase } from './supabase'

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

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    
    if (!fileExt || !validExtensions.includes(fileExt)) {
      throw new Error('Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.')
    }

    // Create a unique filename with timestamp
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${fileName}`

    // Upload to 'image' bucket
    const { data, error: uploadError } = await supabase.storage
      .from('image')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error('Failed to upload image')
    }

    if (!data) {
      throw new Error('Upload successful but no data returned')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('image')
      .getPublicUrl(filePath)

    if (!publicUrl) {
      throw new Error('Failed to get public URL')
    }

    return publicUrl
  } catch (error) {
    console.error('Error in uploadImage:', error)
    throw error
  }
}

export async function deleteImage(url: string) {
  try {
    const path = url.split('/').pop()
    if (!path) {
      console.error('Invalid image URL')
      return
    }

    const { error } = await supabase.storage
      .from('image')
      .remove([path])

    if (error) {
      console.error('Delete error:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in deleteImage:', error)
    throw error
  }
}
