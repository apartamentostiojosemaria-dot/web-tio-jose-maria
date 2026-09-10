# Parte de viajeros — cómo se manda y qué falta para poder mandarlo

> Última revisión: **10-sep-2026**.
> Todo lo marcado ✅ está comprobado en fuente oficial o probado contra el
> sistema. Lo marcado 🟡 viene de integradores y **hay que confirmarlo** con
> los papeles reales del alta.

---

## 0. En una línea

El sistema ya genera el parte y sabe mandarlo por el servicio web del
Ministerio del Interior. **No puede mandarlo todavía porque el alojamiento no
está dado de alta** y por tanto no hay credenciales. Mientras tanto genera la
hoja de registro en PDF para que se mande como se venía mandando.

---

## 1. La obligación, en corto ✅

- **Norma**: Real Decreto 933/2021, de 26 de octubre
  ([BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2021-17461)).
  Exigible desde el **2 de diciembre de 2024**.
- **A quién**: a todos los que se alojan. Los **mayores de 14 años firman**
  el parte (art. 4); de los menores de 14 los datos los da el adulto que los
  acompaña.
- **Plazo** (art. 6.3): *«de manera inmediata, y en todo caso en un plazo no
  superior a 24 horas»*, contado desde **dos** momentos distintos: al hacer o
  anular la reserva, y al inicio efectivo del alojamiento.
- **Conservación** (art. 5.3): **tres años** desde el fin del servicio.
- **Territorio** (art. 3): aplica *«en todo el territorio nacional»*. El RD
  **no contiene ninguna exención** para Cataluña ni el País Vasco: lo que hay
  es un reparto competencial (allí se comunica a Mossos y a la Ertzaintza con
  sus propios sistemas). Para Hinojares (Jaén) **manda el Ministerio del
  Interior** y no hay duda.

---

## 2. Qué hay montado

| Pieza | Dónde | Qué hace |
|---|---|---|
| Formulario del huésped | `src/pages/PrecheckinPage.jsx` | `/precheckin?code=TJM-XXXXXX`. Un viajero por pantalla, firma con el dedo, se guarda a medias en el propio móvil. |
| Guardado | RPC `submit_traveler_records` | Valida la reserva y escribe en `traveler_records`. |
| Motor del parte | `supabase/functions/submit-ses-hospedajes/` | Arma el XML, lo comprime, lo manda, guarda el acuse, y genera la hoja en PDF. |
| Pantalla de la madre | `src/components/panel/ParteViajerosPanel.jsx` | Semáforo por reserva, «Recordárselo» y «Mandar el parte». Cero jerga. |
| Pantalla técnica | `src/components/admin/TravelersManager.jsx` | Estados reales, lote, acuse, reintentos, XML e histórico. |
| Cron diario | `tjm-jobs/src/trigger/daily-ses-submit.ts` | 10:00 Europe/Madrid, procesa los pendientes del día anterior. |

### Los ficheros de la edge function

```
supabase/functions/submit-ses-hospedajes/
  index.ts          la puerta: acciones, permisos, estados
  config.ts         ÚNICA fuente de verdad: datos del alojamiento y secretos
  parte-modelo.ts   traduce la base al vocabulario del anexo I; validaciones
  mir.ts            el cliente SOAP del Ministerio (XML, envío, acuse)
  zip.ts            ZIP propio (deflate) sin dependencias externas
  hoja-registro.ts  la hoja de registro en PDF
```

### Acciones de la función

```
POST { }                                    tanda automática (la del cron)
POST { accion:"mandar",           booking_id }
POST { accion:"documento",        booking_id }   hoja de registro en PDF
POST { accion:"ya-lo-he-mandado", booking_id }   lo mandó una persona
POST { accion:"comprobar",        booking_id }   cómo quedó el lote
POST { accion:"estado",           booking_id }   detalle técnico
```

Entra sólo la clave de servicio (el cron) o un usuario con `role` `admin` o
`staff`. La función se despliega con `verify_jwt = false`, así que la
comprobación de «soy el sistema» es una **comparación exacta con la clave de
servicio**: leer el `role` de un JWT sin verificar la firma sería un coladero.

---

## 3. Cómo habla con el Ministerio ✅

Esto corrige lo que asumía la versión anterior del código, que daba por hecho
un **certificado X.509 de cliente**. Es falso: el certificado sólo hace falta
para el alta por navegador.

| Cosa | Cómo es de verdad |
|---|---|
| Protocolo | SOAP 1.1, operación `comunicacion` |
| Endpoint de pruebas | `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion` |
| Endpoint de producción | `https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion` |
| Autenticación | **HTTP Basic** (`Authorization: Basic base64(usuario:contraseña)`). La cabecera SOAP va **vacía** y `SOAPAction` va **vacía**. |
| Namespace | `http://www.soap.servicios.hospedajes.mir.es/comunicacion` |
| Cuerpo | `<peticion>` con **dos** hijos: `<cabecera>` y `<solicitud>` |
| `<cabecera>` | `codigoArrendador`, `aplicacion`, `tipoOperacion` (A alta / B anulación / C consulta) y `tipoComunicacion` (`PV` parte de viajeros), este último **sólo cuando la operación es A** |
| `<solicitud>` | El XML del parte **comprimido en un ZIP de verdad y codificado en Base64**. Si no es un ZIP, contesta el error `10111`. |
| XML interior | Namespace `http://www.neg.hospedajes.mir.es/altaParteHospedaje`; dentro, `codigoEstablecimiento`, y una o varias `<comunicacion>` con un `<contrato>` y N `<persona>` |
| Orden de los campos | **Obligatorio**: los esquemas son `xsd:sequence` |
| Códigos | País y nacionalidad en **ISO 3166-1 alfa-3** (`ESP`); documento `NIF`/`NIE`/`PAS`/`OTRO`; sexo `H`/`M`/`O` |

**Los dos códigos viajan en sitios distintos** y no son lo mismo:
- **código de arrendador** → en `<cabecera>` del sobre SOAP. Identifica al
  titular como empresa de hospedaje.
- **código de establecimiento** → dentro del XML comprimido. Identifica el
  alojamiento concreto.

### El acuse no es la aceptación ⚠️

`codigo` (o `codigoRetorno`, la documentación del propio Ministerio usa los
dos nombres) igual a **0 significa «recibido y encolado»**, no «aceptado». La
validación de contenido es posterior y se consulta con el **lote** (un UUID)
que devuelve la respuesta. Por eso el sistema:

1. guarda el lote en `traveler_records.mir_reference` y el acuse crudo en
   `mir_response_payload.acuse`;
2. deja el estado en `enviado_pendiente_acuse`, no en `aceptado`;
3. sólo pasa a `aceptado` cuando la acción `comprobar` obtiene códigos de
   comunicación del lote.

### Códigos de error que más van a salir

| Código | Qué significa |
|---|---|
| `10103` | El código de arrendador no existe |
| `10107` | Usuario o contraseña incorrectos |
| `10111` | El fichero no va como XML en UTF-8, comprimido en zip y en Base64 |
| `10118` | Error de formato en el XML |
| `10120` | **El arrendador no tiene habilitado el envío por servicio web** (falta marcar la casilla en el alta) |
| `10121` / `10130` / `10131` | Error de validación / valor incorrecto / falta un obligatorio |

Ninguno de estos se reintenta: hay que arreglar algo antes. Los cortes de red
y los 5xx sí se reintentan, tres veces, esperando 1 s y 4 s.

### Fuentes

- Especificación **v3.1.2** (76 págs.):
  `https://seshospedajes.es/wp-content/uploads/2024/12/MIR-HOSPE-DSI-WS-Servicio-de-Hospedajes-Comunicaciones-v3.1.2.pdf`
  (documento del MIR, pero alojado en un tercero).
- Especificación **v3.1.3** + **XSD y WSDL** (copia verificada):
  `https://github.com/ToniIAPro73/anclora-guesthub/tree/main/schemas/ses-hospedajes/v3.1.3`
- Tablas de códigos, dominio oficial del MIR:
  `https://hospedajes.ses.mir.es/hospedajes-sede/assets/docs/Instrucciones.pdf`
- Información y trámites del alta:
  `https://sede.interior.gob.es/portal/sede/informacion_hospedajes`
- Implementación de referencia en Java (la más completa que existe):
  `https://github.com/jlnieto/checkpol`

**No hay XSD ni WSDL público en dominio `mir.es`**: se descargan desde dentro
de la plataforma, ya autenticado (guía visual, §14 «Descargar documentación
del servicio web»).

---

## 4. El alta en el Ministerio — paso a paso

Esto **sólo lo puede hacer Jesús o el titular**: hace falta certificado
digital o Cl@ve del titular.

### Antes de empezar
- **Certificado digital de Jesús Martínez Sánchez (NIF 26433801-Q) vigente**,
  o Cl@ve. En `internal_tasks` hay una tarea abierta: «Renovación certificado
  digital del titular». Si está caducado, **eso es lo primero**.
- Datos del alojamiento a mano: **Apartamentos Rurales Tío José María**,
  Calle Baja 1, 23486 Hinojares (Jaén), registro turístico **VTAR/JA/00044**.

### Los pasos
1. Entrar en **`https://sede.interior.gob.es/portal/sede/informacion_hospedajes`**
   → trámite **«Registro de establecimientos y entidades»**.
2. Identificarse con certificado digital o Cl@ve.
3. Rellenar el formulario de la **entidad** (el titular como arrendador) y el
   de **cada establecimiento**. ⚠️ Antes de esto hay que decidir una cosa de
   negocio: **los cuatro apartamentos comparten el número de registro
   `VTAR/JA/00044`**. Hay que preguntar en el propio trámite si van como UN
   establecimiento o como cuatro. Del resultado depende si `SES_ESTABLECIMIENTO`
   es un solo código o hacen falta cuatro (ver §7).
4. 🟡 **Marcar la casilla «Envío de comunicaciones por servicio web»**, que
   está al final del formulario de alta de la entidad. Si se olvida, el alta
   sale bien pero el servicio web contesta siempre `10120`; se puede activar
   después desde «Mis datos registrados».
5. Firmar y registrar digitalmente. Plazo de resolución: **15 días**.
6. 🟡 Llegan **dos correos** desde `no-reply@hospedajes.mir.es`:
   - uno con el **número de registro**, el **código de arrendador** y los
     **códigos de establecimiento**;
   - otro con el **usuario y la contraseña del servicio web**.
   Son distintos del acceso por navegador. 🟡 Se dice que el usuario deriva
   del NIF con un sufijo `WS`, pero **dos fuentes se contradicen** sobre si
   lleva guion bajo: **fiarse del correo, no de esto**.
7. Ya dentro de la plataforma, **descargar el paquete de documentación del
   servicio web** (guía visual, §14): trae `comunicacion.wsdl` y los XSD.
   Guardarlo en `docs/` del repo (los XSD no son secretos; el usuario y la
   contraseña **no se guardan en el repo jamás**).

⚠️ 🟡 Aviso práctico de integradores: el portal acepta comillas y acentos en
la contraseña del servicio web que luego rompen la autenticación. Si se puede
elegir, **contraseña larga sin acentos ni comillas**.

---

## 5. Dónde se ponen las credenciales

Supabase → proyecto `nmtukksbzbnuzqsksdmw` → **Settings → Edge Functions →
Secrets**. Cinco secretos, ninguno en el repositorio:

| Secreto | Qué es | Ejemplo |
|---|---|---|
| `SES_WS_USER` | Usuario del servicio web (del segundo correo) | `26433801QWS` |
| `SES_WS_PASSWORD` | Contraseña del servicio web | — |
| `SES_ARRENDADOR` | Código de arrendador (10 caracteres) | `0000000001` |
| `SES_ESTABLECIMIENTO` | Código del establecimiento | `1234567890` |
| `SES_ENDPOINT` | URL del servicio | pruebas: `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion` · producción: `https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion` |

**Mientras falte cualquiera de los cinco**, la función trabaja en *modo
preparado*: genera el XML y la hoja en PDF, deja el parte como
`pendiente_de_alta` y **no marca nada como mandado**. No hay que tocar código
para activarlo: en cuanto estén los cinco secretos, el siguiente envío va de
verdad.

---

## 6. Cómo se comprueba que el primer envío real ha sido aceptado

Hazlo **primero contra pruebas** (`SES_ENDPOINT` apuntando a `pre-ses`).

1. **Las credenciales valen.** Sin mandar ningún parte real: en el panel de
   Jesús, «Parte de viajeros» → «Procesar pendientes». Si no hay
   credenciales, el aviso ámbar dice exactamente qué secretos faltan.
   Con credenciales malas saldrá `Usuario o contraseña incorrectos (10107)`.
2. **Manda un parte.** Ficha de la reserva → «Mandar». Debe contestar
   `Recibido. Lote <uuid>`.
3. **Mira el acuse.** «Detalle» de esa reserva: aparece el **lote**, el acuse
   crudo del Ministerio y el histórico. El XML exacto que se mandó se
   descarga con el botón «XML» — guárdalo, es la prueba de qué se transmitió.
4. **Confirma la aceptación.** Botón **«Comprobar lote»**. Sólo cuando
   devuelve códigos de comunicación el estado pasa a **`Aceptado por el MIR`**.
   Si sale rechazado, el motivo queda escrito y el semáforo de la pantalla de
   la madre se pone en rojo («El parte no se pudo mandar. Avisa a Jesús»).
5. **El Ministerio también avisa por correo** de los errores de un lote.
   Revisa el correo del alta.
6. **Sólo entonces**, cambia `SES_ENDPOINT` a producción y repite 2–4 con una
   estancia real.

⚠️ **Lo primero que hay que confirmar con el WSDL real**: la operación
`consultaLote` está construida **por simetría** con `comunicacion`, no
verificada contra el WSDL (que sólo se descarga autenticado). Al abrir
`comunicacion.wsdl` del paquete, comprueba el nombre del elemento de petición
y sus hijos, y ajusta `sobreConsultaLote()` en `mir.ts` si no coincide. Está
escrito para **fallar en blando**: si no puede consultar, no cambia ningún
estado.

---

## 7. Lo que hay que decidir (no es código)

1. **¿Uno o cuatro establecimientos?** Los cuatro apartamentos comparten
   `VTAR/JA/00044`. Si el Ministerio da **cuatro** códigos, hay que cambiar
   `SES_ESTABLECIMIENTO` por un código **por apartamento** (lo natural:
   una columna `ses_codigo_establecimiento` en `apartments`) y leerlo en
   `aContrato()`. Con **uno** solo, se queda como está.
2. **¿Quién manda hoy el parte y por dónde?** Jesús dice que normalmente lo
   manda su madre, cree que por correo. Hasta saberlo, el botón «Mandar el
   parte» le prepara el papel y ella confirma con un toque que lo ha mandado.
   Si resulta que hoy va por correo al puesto de la Guardia Civil,
   **probablemente ya no cuenta como cumplida** desde el 2-dic-2024 y el alta
   pasa a urgente.
3. **Hora de entrada y de salida.** El esquema pide fecha **y hora**. Ahora
   mismo se mandan las del alojamiento (entrada 16:00, salida 12:00), que es
   lo razonable mientras nadie apunte la hora real de llegada.

---

## 8. Los 18 campos del anexo I, y dónde está cada uno

| Anexo I (RD 933/2021) | Columna de `traveler_records` | En el formulario | En el XML |
|---|---|---|---|
| Nombre | `nombre` | sí | `nombre` |
| Primer apellido | `apellido_primero` | sí | `apellido1` |
| Segundo apellido | `apellido_segundo` | sí (obligatorio con DNI/NIE) | `apellido2` |
| Sexo | `sexo` | sí | `sexo` |
| Tipo de documento | `tipo_documento` | sí | `tipoDocumento` |
| Nº de documento | `numero_documento` | sí (no a menores sin documento) | `numeroDocumento` |
| **Nº de soporte** | `soporte_documento` | sí (obligatorio con DNI/NIE) | `soporteDocumento` |
| Nacionalidad | `nacionalidad` | sí, ISO-3 | `nacionalidad` |
| Fecha de nacimiento | `fecha_nacimiento` | sí | `fechaNacimiento` |
| Domicilio (vía) | `direccion_via` | sí | `direccion/direccion` |
| Domicilio (localidad) | `direccion_municipio` | sí | `direccion/nombreMunicipio` |
| Domicilio (CP) | `direccion_cp` | sí | `direccion/codigoPostal` |
| Domicilio (país) | `direccion_pais` | sí, ISO-3 | `direccion/pais` |
| Teléfono fijo | `telefono_fijo` | sí | `telefono2` |
| Teléfono móvil | `telefono_movil` | sí | `telefono` |
| Correo electrónico | `email` | sí | `correo` |
| Nº de viajeros | `guest_bookings.pax_count` | — | `contrato/numPersonas` |
| **Parentesco (si hay menor)** | `parentesco` | sí, sólo si es menor | `parentesco` |
| **Firma** (art. 4, >14 años) | `firma_base64` | sí, con el dedo | va en la hoja de registro; el servicio web no transporta imagen |
| Datos de la transacción | `guest_bookings` | — | `contrato` + `pago` |

**Lo que el Ministerio exige además del esquema** (y el sistema comprueba
antes de mandar, para no comerse un rechazo): con NIF o NIE son obligatorios
el **segundo apellido** y el **número de soporte**; todo viajero adulto
necesita **al menos un teléfono o un correo**; y si hay un menor, **al menos
un adulto declara su parentesco** con él.

---

## 9. Escáner de la banda del pasaporte (MRZ): descartado a propósito

Se ha valorado y **no se ha hecho**. Leer la MRZ de verdad necesita OCR en el
navegador (`tesseract.js`, ~10 MB de wasm) y con la cámara de un móvil normal
falla más de lo que acierta. Media banda mal leída da **un número de documento
equivocado en un parte policial**, que es peor que teclearlo. Si algún día
interesa, el camino serio es una librería de MRZ dedicada probada con
documentos reales, no OCR genérico.

---

## 10. Estados, para entender el panel

| `mir_response_status` | Pantalla de Jesús | Pantalla de la madre |
|---|---|---|
| *(vacío)* | Sin comunicar | según los datos que falten |
| `faltan_datos` | Faltan datos del huésped | «Faltan 2 de 4» |
| `pendiente_de_alta` | Preparado · sin credenciales | «Todos han rellenado sus datos» |
| `enviado_pendiente_acuse` | Enviado · esperando validación | «Parte mandado el …» |
| `aceptado` | Aceptado por el MIR | «Parte mandado el …» |
| `enviado_a_mano` | Enviado a mano | «Parte mandado el …» |
| `retry` | Sin respuesta · reintentar | «El parte no se pudo mandar. Avisa a Jesús» |
| `error` | Rechazado / error | «El parte no se pudo mandar. Avisa a Jesús» |

Un parte **rechazado** por el Ministerio se guarda como `error` y se le quita
la fecha de envío, para que el semáforo no diga «mandado» de algo que no está
mandado.
