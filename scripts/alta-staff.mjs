// Da de alta (o cambia a) una persona de la casa en el panel de ella.
// ----------------------------------------------------------------------
//   node scripts/alta-staff.mjs <correo> "<nombre>" [staff|admin]
//
// Crea el usuario en auth (correo confirmado, sin contraseña: entra por
// código al correo) y su ficha en `profiles` con rol `staff`. Si el usuario
// ya existe, solo ajusta la ficha. Idempotente. Lee el .env.local del proyecto
// (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// `staff` = el panel sencillo (/panel) y nada más. `admin` = además la vista
// completa (/admin). La madre va como staff (plan §4.6).

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1); }

const [correo, nombre, rol = 'staff'] = process.argv.slice(2);
if (!correo || !nombre) { console.error('Uso: node scripts/alta-staff.mjs <correo> "<nombre>" [staff|admin]'); process.exit(1); }
if (!['staff', 'admin'].includes(rol)) { console.error('El rol es staff o admin'); process.exit(1); }

const email = correo.trim().toLowerCase();
const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) Usuario en auth: se busca por correo; si no está, se crea confirmado.
let userId = null;
for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error('listUsers:', error.message); process.exit(1); }
    userId = data.users.find((u) => (u.email || '').toLowerCase() === email)?.id || null;
    if (data.users.length < 200) break;
}
if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: nombre } });
    if (error) { console.error('createUser:', error.message); process.exit(1); }
    userId = data.user.id;
    console.log(`Usuario creado: ${email}`);
} else {
    console.log(`Usuario ya existía: ${email}`);
}

// 2) Ficha en profiles: es lo que mira request-otp (deja pasar) e is_staff() (permisos).
const { error: pErr } = await sb.from('profiles').upsert({
    id: userId, email, full_name: nombre, role: rol, is_active: true, updated_at: new Date().toISOString(),
}, { onConflict: 'id' });
if (pErr) { console.error('profiles:', pErr.message); process.exit(1); }

const { data: ficha } = await sb.from('profiles').select('email, full_name, role, is_active').eq('id', userId).single();
console.log('Ficha:', ficha);
console.log(`Listo. Entra en https://tiojosemaria.com/panel con ${email}: le llega un código de 6 números al correo.`);
