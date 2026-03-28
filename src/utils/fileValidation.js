const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_DOC_SIZE = 10 * 1024 * 1024;   // 10MB

export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) {
    return { valid: false, message: `Tipo de archivo no permitido (${file.type || 'desconocido'}). Usa JPG, PNG, WebP o GIF.` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, message: `La imagen es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 5MB.` };
  }
  return { valid: true };
}

export function validateDocFile(file) {
  if (!DOC_TYPES.includes(file.type)) {
    return { valid: false, message: `Tipo de archivo no permitido (${file.type || 'desconocido'}). Usa PDF, DOC, DOCX, JPG o PNG.` };
  }
  if (file.size > MAX_DOC_SIZE) {
    return { valid: false, message: `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.` };
  }
  return { valid: true };
}
