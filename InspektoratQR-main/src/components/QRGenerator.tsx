import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Save, Trash2 } from 'lucide-react';

interface SavedQR {
  id: string;
  data: string;
  timestamp: number;
}

const QRGenerator = () => {
  const [inputData, setInputData] = useState('');
  const [savedQRs, setSavedQRs] = useState<SavedQR[]>(() => {
    const saved = localStorage.getItem('qrcodes');
    return saved ? JSON.parse(saved) : [];
  });

  const saveQRCode = () => {
    if (!inputData.trim()) return;

    const newQR: SavedQR = {
      id: Date.now().toString(),
      data: inputData,
      timestamp: Date.now(),
    };

    const updatedQRs = [...savedQRs, newQR];
    setSavedQRs(updatedQRs);
    localStorage.setItem('qrcodes', JSON.stringify(updatedQRs));
    setInputData('');
  };

  const deleteQRCode = (id: string) => {
    const updatedQRs = savedQRs.filter(qr => qr.id !== id);
    setSavedQRs(updatedQRs);
    localStorage.setItem('qrcodes', JSON.stringify(updatedQRs));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-6">QR Code Generator</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder="Enter text or URL to generate QR code"
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveQRCode}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Save size={20} />
            Save QR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedQRs.map((qr) => (
          <div key={qr.id} className="border rounded-lg p-4 flex flex-col items-center bg-white">
            <QRCodeSVG value={qr.data} size={200} />
            <div className="mt-4 w-full">
              <p className="text-sm text-gray-600 break-all mb-2">{qr.data}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {new Date(qr.timestamp).toLocaleDateString()}
                </span>
                <button
                  onClick={() => deleteQRCode(qr.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {savedQRs.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No saved QR codes. Create one by entering text above!
        </div>
      )}
    </div>
  );
};

export default QRGenerator;
