// src/components/ProductForm.jsx
import { useState } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { uploadImage } from '../services/cloudinary'

export default function ProductForm({ product = null, onSuccess, currency, collectionName }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || '',
    piecesPerBox: product?.piecesPerBox || '',
    description: product?.description || '',
    flavors: product?.flavors?.join(', ') || '',
    imageUrl: product?.imageUrl || '',
    stock: product?.stock || 0
  })

  const [imageFile, setImageFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }
    setError('')
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setFormData(prev => ({ ...prev, imageUrl: url }))
      setImageFile(file)
      setSuccess('Image uploaded successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to upload image: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    const data = {
      name: formData.name.trim(),
      price: parseFloat(formData.price) || 0,
      piecesPerBox: parseInt(formData.piecesPerBox) || 0,
      flavors: formData.flavors.split(',').map(f => f.trim()).filter(Boolean),
      description: formData.description.trim(),
      imageUrl: formData.imageUrl,
      stock: parseInt(formData.stock) || 0,
      currency: currency,
      updatedAt: serverTimestamp()
    }

    try {
      if (product) {
        await updateDoc(doc(db, collectionName, product.id), data)
      } else {
        await addDoc(collection(db, collectionName), {
          ...data,
          createdAt: serverTimestamp()
        })
      }
      setSuccess(product ? 'Product updated successfully!' : 'Product added successfully!')
      setTimeout(() => onSuccess(), 500)
    } catch (err) {
      setError(err.message || 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currencySymbol = currency === 'PI' ? 'π' : currency === 'EGP' ? '£' : '$'
  const stockVal = parseInt(formData.stock)

  return (
    <form onSubmit={handleSubmit} className="pf-form">
      <style>{`
        .pf-form {
          display: flex;
          flex-direction: column;
          gap: 28px;
          color: #e8e8f0;
        }

        /* Collection badge */
        .pf-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
        }
        .pf-badge strong { color: rgba(255,255,255,0.90); }

        /* Alerts */
        .pf-alert {
          padding: 14px 16px;
          border-radius: 10px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: pf-slide 0.3s ease-out;
        }
        .pf-alert-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.30);
          color: #fca5a5;
        }
        .pf-alert-success {
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.30);
          color: #6ee7b7;
        }
        @keyframes pf-slide {
          from { opacity:0; transform: translateY(-8px); }
          to   { opacity:1; transform: translateY(0); }
        }

        /* Image section */
        .pf-image-section { display: flex; flex-direction: column; gap: 16px; }
        .pf-section-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .pf-image-row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }

        .pf-preview-box {
          width: 130px;
          height: 130px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pf-preview-box img { width:100%; height:100%; object-fit:cover; }
        .pf-preview-placeholder { font-size: 3rem; opacity: 0.4; }

        .pf-upload-controls { display: flex; flex-direction: column; gap: 12px; flex: 1; min-width: 180px; }

        .pf-file-input { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); }
        .pf-file-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.88rem;
          color: rgba(255,255,255,0.85);
          cursor: pointer;
          transition: all 0.2s ease;
          width: fit-content;
        }
        .pf-file-label:hover {
          background: rgba(255,255,255,0.13);
          border-color: rgba(255,255,255,0.28);
          color: #fff;
        }

        .pf-uploading {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.28);
          border-radius: 8px;
          color: #93c5fd;
          font-size: 0.85rem;
        }
        .pf-spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(147,197,253,0.35);
          border-top-color: #93c5fd;
          border-radius: 50%;
          animation: pf-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes pf-spin { to { transform: rotate(360deg); } }

        .pf-hint {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.45);
          line-height: 1.5;
        }
        .pf-hint strong { color: rgba(255,255,255,0.65); }

        /* Grid */
        .pf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }
        .pf-group { display: flex; flex-direction: column; gap: 7px; }
        .pf-group-full { grid-column: 1 / -1; }

        .pf-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(255,255,255,0.70);
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .pf-required { color: #f87171; }

        .pf-input-wrap { position: relative; }
        .pf-prefix {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.50);
          font-weight: 600;
          pointer-events: none;
          font-size: 0.95rem;
        }

        .pf-input,
        .pf-textarea {
          width: 100%;
          padding: 11px 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          font-size: 0.92rem;
          color: #f0f0f8;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .pf-input::placeholder,
        .pf-textarea::placeholder { color: rgba(255,255,255,0.28); }
        .pf-input:focus,
        .pf-textarea:focus {
          border-color: rgba(255,255,255,0.30);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.08);
        }
        .pf-input-prefix { padding-left: 30px; }

        .pf-textarea {
          resize: vertical;
          min-height: 110px;
        }

        /* Stock badge overlay */
        .pf-stock-badge {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          pointer-events: none;
        }
        .pf-stock-ok   { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.25); }
        .pf-stock-low  { background: rgba(245,158,11,0.15);  color: #fcd34d; border: 1px solid rgba(245,158,11,0.25); }
        .pf-stock-zero { background: rgba(239,68,68,0.15);   color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }

        .pf-field-hint {
          font-size: 0.76rem;
          color: rgba(255,255,255,0.42);
          margin-top: 2px;
        }

        /* Actions */
        .pf-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
        .pf-submit {
          padding: 12px 30px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 9px;
          font-weight: 700;
          font-size: 0.92rem;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 0.2px;
        }
        .pf-submit:hover:not(:disabled) {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.28);
          transform: translateY(-1px);
        }
        .pf-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type="number"] { -moz-appearance: textfield; }

        @media (max-width: 600px) {
          .pf-image-row { flex-direction: column; }
          .pf-preview-box { width: 100%; max-width: 130px; }
          .pf-grid { grid-template-columns: 1fr; }
          .pf-actions { flex-direction: column; }
          .pf-submit { width: 100%; justify-content: center; }
        }
      `}</style>

      {/* Collection badge */}
      <div className="pf-badge">
        🗄️ Saving to: <strong>{collectionName}</strong>
      </div>

      {error   && <div className="pf-alert pf-alert-error">  ⚠️ {error}  </div>}
      {success && <div className="pf-alert pf-alert-success"> ✓ {success} </div>}

      {/* Image upload */}
      <div className="pf-image-section">
        <span className="pf-section-label">Product Image</span>
        <div className="pf-image-row">
          <div className="pf-preview-box">
            {formData.imageUrl
              ? <img src={formData.imageUrl} alt="Preview" />
              : <div className="pf-preview-placeholder">📸</div>}
          </div>
          <div className="pf-upload-controls">
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="pf-img-upload"
                className="pf-file-input"
                disabled={uploading}
              />
              <label htmlFor="pf-img-upload" className="pf-file-label">
                📁 {uploading ? 'Uploading…' : 'Choose Image'}
              </label>
            </div>
            {uploading && (
              <div className="pf-uploading">
                <div className="pf-spinner" />
                Uploading image…
              </div>
            )}
            <p className="pf-hint">
              <strong>Recommended:</strong> Square 1:1, min 600×600 px, under 5 MB
            </p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="pf-grid">

        {/* Name */}
        <div className="pf-group">
          <label className="pf-label">Product Name <span className="pf-required">*</span></label>
          <input
            type="text"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g., Dark Chocolate Truffles"
            className="pf-input"
            required
          />
        </div>

        {/* Price */}
        <div className="pf-group">
          <label className="pf-label">Price ({currency}) <span className="pf-required">*</span></label>
          <div className="pf-input-wrap">
            <span className="pf-prefix">{currencySymbol}</span>
            <input
              type="number"
              value={formData.price}
              onChange={e => handleChange('price', e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="pf-input pf-input-prefix"
              required
            />
          </div>
        </div>

        {/* Pieces per box */}
        <div className="pf-group">
          <label className="pf-label">Pieces per Box <span className="pf-required">*</span></label>
          <input
            type="number"
            value={formData.piecesPerBox}
            onChange={e => handleChange('piecesPerBox', e.target.value)}
            placeholder="e.g., 12"
            min="1"
            className="pf-input"
            required
          />
        </div>

        {/* Stock */}
        <div className="pf-group">
          <label className="pf-label">Available Stock <span className="pf-required">*</span></label>
          <div className="pf-input-wrap">
            <input
              type="number"
              value={formData.stock}
              onChange={e => handleChange('stock', e.target.value)}
              placeholder="e.g., 100"
              min="0"
              className="pf-input"
              style={{ paddingRight: 100 }}
              required
            />
            <span className={`pf-stock-badge ${
              stockVal === 0 ? 'pf-stock-zero' : stockVal < 10 ? 'pf-stock-low' : 'pf-stock-ok'
            }`}>
              {stockVal === 0 ? 'Out of Stock' : stockVal < 10 ? 'Low Stock' : 'In Stock'}
            </span>
          </div>
          <p className="pf-field-hint">Current inventory available for sale</p>
        </div>

        {/* Flavors */}
        <div className="pf-group">
          <label className="pf-label">Flavors <span className="pf-required">*</span></label>
          <input
            type="text"
            value={formData.flavors}
            onChange={e => handleChange('flavors', e.target.value)}
            placeholder="e.g., Dark Chocolate, Mint, Raspberry"
            className="pf-input"
            required
          />
          <p className="pf-field-hint">Separate with commas</p>
        </div>

        {/* Description */}
        <div className="pf-group pf-group-full">
          <label className="pf-label">Description <span className="pf-required">*</span></label>
          <textarea
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Describe the product in detail…"
            className="pf-textarea"
            required
          />
        </div>

      </div>

      {/* Submit */}
      <div className="pf-actions">
        <button type="submit" disabled={uploading || isSubmitting} className="pf-submit">
          {uploading || isSubmitting ? '⏳ Processing…' : product ? '💾 Update Product' : '💾 Add Product'}
        </button>
      </div>
    </form>
  )
}