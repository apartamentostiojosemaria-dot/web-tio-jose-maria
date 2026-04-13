export const WP = 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website/general';

const WHATSAPP_PHONE = import.meta.env.VITE_WHATSAPP_PHONE || '34676344675';
export const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=Hola,%20estoy%20viendo%20la%20web%20y%20quer%C3%ADa%20consultar%20una%20duda.`;
export const whatsappLink = (text) => `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`;
