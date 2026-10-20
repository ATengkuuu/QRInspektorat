import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { uploadImage } from '../lib/storage';

interface Product {
  name: string;
  location: string;
  quantity: number;
  image: string;
}

interface ProductFormProps {
  onSave: (product: Product) => void;
  onCancel: () => void;
  initialData?: Product | null;
}

const ProductForm = ({ onSave, onCancel, initialData }: ProductFormProps) => {
  const [formData, setFormData] = useState<Product>({
    name: '',
    location: '',
    quantity: 0,
    image: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setImageFile(file);
    setError(null);

    try {
      setIsUploading(true);
      const imageUrl = await uploadImage(file);
      
      if (!imageUrl) {
        throw new Error('Failed to get image URL');
      }

      setFormData(prev => ({ ...prev, image: imageUrl }));
      setError(null);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.name.trim() !== '' &&
      formData.location.trim() !== '' &&
      formData.quantity >= 0 &&
      formData.image !== ''
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      setError('Please fill in all fields and upload an image');
      return;
    }

    try {
      setError(null);
      await onSave(formData);
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Failed to save product. Please try again.');
    }
  };

  return (
    <div className="modal-card">
      <div className="flex justify-between items-center">
        <h2 className="modal-title">
          {initialData ? 'Edit Product' : 'Add New Product'}
        </h2>
        <button 
          onClick={onCancel} 
          className="text-gray-500"
          type="button"
        >
          <X size={24} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="modal-label">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mock-input w-full"
            placeholder="Enter product name"
          />
        </div>

        <div>
          <label className="modal-label">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            className="mock-input w-full"
            placeholder="Enter location"
          />
        </div>

        <div>
          <label className="modal-label">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            required
            min="0"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
            className="mock-input w-full"
            placeholder="Enter quantity"
          />
        </div>

        <div>
          <label className="modal-label">
            Product Image <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
            className="mock-input w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Max file size: 5MB</p>
          
          {isUploading && (
            <div className="mt-2">
              <div className="animate-pulse flex items-center space-x-2">
                <div className="h-2 w-full bg-blue-200 rounded"></div>
                <span className="text-sm text-blue-500">Uploading...</span>
              </div>
            </div>
          )}
          
          {formData.image && (
            <div className="mt-2">
              <img
                src={formData.image}
                alt="Preview"
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-3">
          <button
            type="submit"
            disabled={isUploading || !isFormValid()}
            className={`primary-button flex-1
              ${isUploading || !isFormValid()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
          >
            {isUploading ? 'Uploading...' : initialData ? 'Update' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="secondary-button flex-1 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
