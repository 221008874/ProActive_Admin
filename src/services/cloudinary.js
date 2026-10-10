// src/lib/cloudinary.js
const CLOUD_NAME = 'dygzu9n6i'; // ← Replace with your Cloudinary cloud name
const UPLOAD_PRESET = 'product_images'; // ← Must match your unsigned preset name

export const uploadImage = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please select an image.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Upload failed');
  }
  return data.secure_url;
};