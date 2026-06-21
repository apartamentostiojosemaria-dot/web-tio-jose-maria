# Protocolo de notificación de brecha de seguridad de datos

**Responsable**: Apartamentos Rurales Tío José María — Calle Baja 1, 23486 Hinojares (Jaén) — info@tiojosemaria.com
**Marco legal**: artículos 33 y 34 del Reglamento (UE) 2016/679 (RGPD), LO 3/2018 (LOPDGDD), guías AEPD sobre notificación de brechas.
**Vigencia**: 2026-06-21 · Revisión mínima anual.

---

## 1. ¿Qué es una brecha de seguridad?

Cualquier incidente que cause, de forma accidental o ilícita, la **destrucción, pérdida o alteración** de datos personales, o la **comunicación o acceso no autorizado** a los mismos. Ejemplos en este negocio:

- Acceso indebido al panel de administración (`/admin`) o al área de clientes (`/clientes`).
- Robo, pérdida o extravío de un dispositivo (móvil, portátil) con datos de huéspedes.
- Fuga de la base de datos Supabase (claves expuestas, RLS mal configurado, SQL injection).
- Envío masivo accidental de un email revelando direcciones a otros destinatarios.
- Compromiso de cuentas de Stripe, Resend, WhatsApp Business o cualquier subencargado.
- Ransomware o cifrado malicioso de copias de seguridad.

> **El plazo de 72 horas empieza a contar desde que se tiene conocimiento de la brecha**, no desde que se confirma.

---

## 2. Fases de actuación

### Fase 1 — Detección y contención (0–4 horas)

1. **Identificar el incidente**: quién detecta, cuándo, cómo, qué sistema afectado.
2. **Contener**: cortar el acceso (revocar tokens, rotar claves Supabase / Stripe / Resend, deshabilitar usuario comprometido, aislar dispositivo).
3. **Preservar evidencia**: capturas, logs, exports de Supabase, registros de auditoría. No borrar nada.
4. **Comunicar internamente** al responsable (Jesús / titular) por canal seguro.

### Fase 2 — Evaluación de riesgo (4–24 horas)

Para decidir si hay que notificar a la AEPD, evaluar:

- **Tipo de datos** afectados (identificativos, contacto, DNI/pasaporte por SES.HOSPEDAJES, pago, salud, menores).
- **Volumen** de personas afectadas.
- **Facilidad de identificación** (datos cifrados, seudonimizados, en claro).
- **Consecuencias** para las personas (fraude, suplantación, daño reputacional, daño físico).
- **Origen** (interno, externo, accidental, doloso).

Niveles:

- **Bajo / nulo riesgo** → registrar internamente, no notificar.
- **Riesgo para derechos y libertades** → notificar a la AEPD en 72 h.
- **Alto riesgo** → además, comunicar a las personas afectadas sin dilación indebida.

### Fase 3 — Notificación a la AEPD (antes de las 72 horas)

Canal oficial: sede electrónica AEPD → "Notificación de brechas de seguridad de datos personales": <https://sedeagpd.gob.es/sede-electronica-web/vistas/formBrechaSeguridad/procedimientoBrechaSeguridad.jsf>

Contenido mínimo (Art. 33.3 RGPD):

- Naturaleza de la brecha, categorías y número aproximado de afectados y de registros.
- Datos de contacto del responsable.
- Consecuencias probables.
- Medidas adoptadas o propuestas para remediar la brecha y mitigar efectos.

Si en 72 h no se dispone de toda la información, se notifica de forma escalonada justificándolo.

### Fase 4 — Comunicación a personas afectadas (si aplica)

Cuando hay alto riesgo. Debe ser:

- **Directa** (email, SMS, llamada) salvo que requiera esfuerzo desproporcionado, en cuyo caso comunicación pública.
- **En lenguaje claro y sencillo**.
- Incluyendo: naturaleza, contacto del responsable, consecuencias probables, medidas adoptadas, recomendaciones para que la persona afectada se proteja.

No es necesaria comunicación si los datos estaban cifrados con clave no comprometida o si se han adoptado medidas posteriores que neutralicen el riesgo.

### Fase 5 — Registro interno y cierre

Toda brecha (notificable o no) se registra en `docs/seguridad/registro-brechas.md` con:

- Fecha y hora de detección / contención / notificación.
- Descripción, datos afectados, número de personas.
- Acciones tomadas y lecciones aprendidas.
- Documentación de soporte (logs, capturas, correos AEPD).

Conservación del registro: **mínimo 3 años**.

---

## 3. Roles y contactos

| Rol | Persona | Contacto |
|---|---|---|
| Responsable del tratamiento | Titular Apartamentos Tío José María | info@tiojosemaria.com |
| Operador técnico / DPO informal | Jesús Martínez Padrón | jesusmartinezpadron@gmail.com |
| Proveedor BD | Supabase | <https://supabase.com/support> |
| Proveedor pagos (cuando se integre) | Stripe | <https://support.stripe.com> |
| Proveedor email (cuando se integre) | Resend | <https://resend.com/support> |
| Autoridad de control | AEPD | <https://www.aepd.es> · +34 901 100 099 |

---

## 4. Acciones preventivas en marcha

- Rotación periódica de claves Supabase y revisión de RLS.
- Cifrado de copias de seguridad.
- 2FA obligatorio en todas las cuentas de admin y proveedores.
- Logs de acceso al panel de administración.
- Auditoría trimestral de subencargados (DPAs firmadas, ubicación de servidores, SCC vigentes).
- Formación al equipo en señales de phishing y manejo de datos.

---

## 5. Documentos relacionados

- `src/pages/PrivacyPolicy.jsx` — política de privacidad pública
- `src/pages/LegalNotice.jsx` — aviso legal
- `docs/seguridad/registro-brechas.md` — registro interno (crear al primer incidente)
- DPAs firmadas con subencargados (carpeta `docs/legal/dpa/` cuando se firmen)
