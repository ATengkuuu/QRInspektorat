import { useState, useEffect } from "react";
import { Save, Package, Trash2, QrCode, Squircle, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { saveAs } from "file-saver";
import ProductForm from "./ProductForm";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { apiRequest } from "../lib/api";
import { v4 as uuidv4 } from 'uuid'

interface Product {
  id: string;
  name: string;
  location: string;
  quantity: number;
  image: string;
  timestamp: number;
}

function generateUUID() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : uuidv4();
}

const ProductList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setProducts(await apiRequest<Product[]>("/products"));
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to fetch products. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveProduct = async (
    productData: Omit<Product, "id" | "timestamp">
  ) => {
    try {
      setError(null);
      const timestamp = Date.now();

      if (editingProduct) {
        // If image has changed, delete the old one
        if (
          editingProduct.image &&
          editingProduct.image !== productData.image
        ) {
        }

        // Update existing product
        await apiRequest(`/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: productData.name,
            location: productData.location,
            quantity: productData.quantity,
            image: productData.image, // Ensure image URL is included
            timestamp,
          }),
        });
      } else {
        // Add new product
        await apiRequest("/products", {
          method: "POST",
          body: JSON.stringify({
            id: generateUUID(),

            name: productData.name,
            location: productData.location,
            quantity: productData.quantity,
            image: productData.image, // Ensure image URL is included
            timestamp,
          }),
        });
      }

      await fetchProducts(); // Refresh the list
      setShowForm(false);
      setEditingProduct(null);
    } catch (err) {
      console.error("Error saving product:", err);
      setError("Failed to save product. Please try again.");
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const deleteProduct = async () => {
    if (!productToDelete) return;

    try {
      setError(null);

      if (productToDelete.image) {
      }

      await apiRequest(`/products/${productToDelete.id}`, { method: "DELETE" });

      await fetchProducts(); // Refresh the list
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (err) {
      console.error("Error deleting product:", err);
      setError("Failed to delete product. Please try again.");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleShowQR = (product: Product) => {
    setSelectedProduct(product);
    setShowQRModal(true);
  };

  const downloadQR = () => {
    if (!selectedProduct) return;

    const canvas = document.createElement("canvas");
    const qrCode = document.getElementById("product-qr");
    if (!qrCode) return;

    const svgData = new XMLSerializer().serializeToString(qrCode);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `qr-${selectedProduct.name}.png`);
        }
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="page-pad flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="page-pad">
      <h1 className="text-[11px] font-bold mb-2">Product List</h1>

      {error && (
        <div className="auth-message error">
          <p>{error}</p>
        </div>
      )}

      <div className="mb-2 relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search size={20} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mock-input w-full pl-8"
        />
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="primary-button w-full flex items-center justify-center gap-1 mb-2"
      >
        <Save size={14} />
        Add Product
      </button>

      {filteredProducts.length === 0 ? (
        <div className="px-4 py-16 text-center text-gray-500">
          {products.length === 0 ? (
            <>
              <Package size={48} className="mx-auto mb-3 text-gray-400" />
              <h2 className="mb-1 text-[11px] font-semibold">No Products Yet</h2>
              <p className="text-[9px] text-gray-500">
                Start by adding your first product using the button above.
              </p>
            </>
          ) : (
            <>
              <Search size={48} className="mx-auto mb-3 text-gray-400" />
              <h2 className="mb-1 text-[11px] font-semibold">No Products Found</h2>
              <p className="text-[9px] text-gray-500">Try adjusting your search query.</p>


            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="product-card mb-2">



              <div className="flex items-center gap-4">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-thumb"
                  />
                ) : (
                  <div className="product-thumb bg-gray-100">
                    <Package size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-gray-600">{product.location}</p>
                  <p className="text-sm text-gray-600">
                    Qty: {product.quantity}
                  </p>
                </div>
                <div className="product-actions">
                  <button
                    onClick={() => handleShowQR(product)}
                    className="icon-action bg-blue-500"
                  >
                    <QrCode size={20} />
                  </button>
                  <button
                    onClick={() => handleEdit(product)}
                    className="icon-action bg-green-500"
                  >
                    <Squircle size={20} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(product)}
                    className="icon-action bg-red-500"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <ProductForm
            onSave={saveProduct}
            onCancel={() => {
              setShowForm(false);
              setEditingProduct(null);
            }}
            initialData={editingProduct}
          />
        </div>
      )}

      {showQRModal && selectedProduct && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="modal-title">
              QR Code Product
            </h2>
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                id="product-qr"
                value={`${window.location.origin}/product/${selectedProduct.id}`}
                size={155}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadQR}
                className="primary-button flex-1"
              >
                Download QR
              </button>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedProduct(null);
                }}
                className="secondary-button flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && productToDelete && (
        <DeleteConfirmationModal
          productName={productToDelete.name}
          onConfirm={deleteProduct}
          onCancel={() => {
            setShowDeleteModal(false);
            setProductToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default ProductList;
