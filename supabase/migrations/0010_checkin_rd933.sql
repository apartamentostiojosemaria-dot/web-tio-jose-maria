-- =====================================================================
--  0010 — Check-in del RD 933/2021: los huecos de backend
--
--  Cierra los huecos numerados en `docs/CHECKIN-LEGAL.md` que dependen
--  del esquema: 2 (comunicacion de reserva y anulacion), 3 (datos del
--  pago), 4 (libro-registro archivado), 5 (horas reales), 6 (numero de
--  habitaciones), 7 (parentesco en el adulto), 9 (URL de los anuncios),
--  11 (los quince parentescos), 13 (disparador de la purga) y 14
--  (`consent_privacy_at` mal nombrado).
--
--  Aplicado contra produccion (nmtukksbzbnuzqsksdmw) el 10-sep-2026.
--
--  Todo es ADITIVO o ENSANCHA. No hay DROP de tabla ni de columna con
--  datos, no hay TRUNCATE y no se estrecha ningun CHECK existente.
--  La unica operacion destructiva-en-apariencia es el RENAME de
--  `traveler_records.consent_privacy_at`, y se hace sabiendo que:
--    · la tabla tiene 0 filas el dia de aplicarla;
--    · el nombre viejo no aparece en `src/`, `supabase/functions/`,
--      `tjm-jobs/` ni en ninguna funcion, politica o vista de la base
--      (comprobado con grep sobre el repo y con pg_get_functiondef
--      sobre las funciones que tocan `traveler_records`).
--  Un RENAME arrastra solo las dependencias internas de la base; el
--  codigo que no la nombre no se entera. Aqui nadie la nombra.
--
--  Fuentes verificadas el 10-sep-2026 (las dos del propio Ministerio):
--    · «MIR-HOSPE-DSI-WS — Servicio de Hospedajes · Comunicaciones»
--      v3.1.2. Apartados 3.1.1.1 (alta de partes, tipoComunicacion PV),
--      3.1.1.2 (alta de reservas, tipoComunicacion RH), anexos II y III
--      (ejemplos de XML de alta y de anulacion).
--    · «Instrucciones para el alta masiva de comunicaciones» v1.1.0,
--      apartados 3 y 4 (plantillas), 7.1 (bloque direccion), 7.2 (bloque
--      pago) y 8.3/8.4/8.5/8.6/8.7 (tablas de codigos).
--      https://hospedajes.ses.mir.es/hospedajes-sede/assets/docs/Instrucciones.pdf
--    · RD 933/2021, anexo I y arts. 4, 5.3 y 6.3:
--      https://www.boe.es/buscar/act.php?id=BOE-A-2021-17461
--    · Orden INT/1922/2003, apartado segundo (libro-registro):
--      https://www.boe.es/buscar/act.php?id=BOE-A-2003-13865
-- =====================================================================


-- =====================================================================
-- 1. `guest_bookings` — contrato, ejecucion y pago del anexo I A.4
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.a Fecha Y HORA de entrada y de salida (hueco 5)
-- ---------------------------------------------------------------------
-- `check_in` y `check_out` son `date`: no llevan hora. Hasta ahora
-- `mir.ts` les pegaba 16:00 y 12:00 fijas, que es afirmar una hora que
-- nadie ha medido. El Ministerio admite `AAAA-MM-DDT00:00:00` cuando la
-- hora se desconoce, asi que la regla pasa a ser: si la sabemos, se
-- manda; si no, se manda medianoche y no se inventa nada.
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS checkin_at  timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz;

COMMENT ON COLUMN public.guest_bookings.checkin_at IS
  'Momento REAL de entrada (fecha y hora), cuando se conoce. Lo apunta la persona que entrega la llave. Si es NULL el parte manda AAAA-MM-DDT00:00:00, que es lo que el MIR pide cuando se desconoce la hora. NUNCA se rellena con una hora supuesta.';
COMMENT ON COLUMN public.guest_bookings.checkout_at IS
  'Momento REAL de salida (fecha y hora), cuando se conoce. Mismas reglas que checkin_at.';

-- Coherencia minima: si estan las dos, la salida es posterior.
ALTER TABLE public.guest_bookings DROP CONSTRAINT IF EXISTS guest_bookings_estancia_coherente_check;
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_estancia_coherente_check
  CHECK (checkin_at IS NULL OR checkout_at IS NULL OR checkout_at > checkin_at);

-- ---------------------------------------------------------------------
-- 1.b Datos del pago (anexo I A.4.d — hueco 3)
-- ---------------------------------------------------------------------
-- El anexo pide cinco cosas: tipo, identificacion del medio, titular,
-- caducidad y fecha. El servicio del Ministerio solo exige `tipoPago`
-- (Instrucciones §7.2), pero el REGISTRO DOCUMENTAL del art. 5 pide
-- todos los que se recaben, y es el registro lo que mira una inspeccion.
--
-- Regla que manda sobre todo lo demas: NUNCA el numero completo de la
-- tarjeta, ni el CVV. Se guarda lo que IDENTIFICA el pago, no lo que
-- permitiria volver a cobrarlo. Ni la ley lo pide con esa literalidad
-- (art. 5.2: «que recaben»), ni las reglas de las marcas se lo permiten
-- a un comercio que no esta certificado en PCI-DSS.
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS payment_type       text,
  ADD COLUMN IF NOT EXISTS payment_instrument text,
  ADD COLUMN IF NOT EXISTS payment_holder     text,
  ADD COLUMN IF NOT EXISTS payment_expiry     text,
  ADD COLUMN IF NOT EXISTS payment_date       date;

-- Codigos de la tabla 8.7 del Ministerio. Ojo: NO son los mismos
-- valores que `payment_method` (transferencia/bizum/efectivo/tarjeta/
-- stripe/booking), que es vocabulario de casa. `payment_type` es el
-- vocabulario del MIR y es el que viaja en el XML.
ALTER TABLE public.guest_bookings DROP CONSTRAINT IF EXISTS guest_bookings_payment_type_check;
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_payment_type_check
  CHECK (
    payment_type IS NULL
    OR payment_type = ANY (ARRAY['EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','DESTI','OTRO'])
  );

-- MM/AA (lo que pinta el panel) o MM/AAAA (lo que pide el MIR,
-- Instrucciones §7.2). Se admiten los dos y se normaliza al enviar.
ALTER TABLE public.guest_bookings DROP CONSTRAINT IF EXISTS guest_bookings_payment_expiry_check;
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_payment_expiry_check
  CHECK (
    payment_expiry IS NULL
    OR payment_expiry ~ '^(0[1-9]|1[0-2])/([0-9]{2}|[0-9]{4})$'
  );

-- Cinturon contra el error que mas caro sale: guardar un PAN entero.
-- Un numero de tarjeta son 13-19 digitos; `payment_instrument` guarda
-- «VISA ****4242», un IBAN o un telefono, nunca eso.
ALTER TABLE public.guest_bookings DROP CONSTRAINT IF EXISTS guest_bookings_payment_instrument_sin_pan_check;
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_payment_instrument_sin_pan_check
  CHECK (
    payment_instrument IS NULL
    OR regexp_replace(payment_instrument, '[^0-9]', '', 'g') !~ '^[0-9]{13,19}$'
  );

COMMENT ON COLUMN public.guest_bookings.payment_type IS
  'Tipo de pago en el catalogo del MIR (tabla 8.7): EFECT, TARJT, PLATF, TRANS, MOVIL, TREG, DESTI, OTRO. Anexo I A.4.d del RD 933/2021. Distinto de payment_method, que es vocabulario interno.';
COMMENT ON COLUMN public.guest_bookings.payment_instrument IS
  'Identificacion del medio de pago (anexo I A.4.d): marca y ultimos cuatro digitos («VISA ****4242»), IBAN del ordenante, telefono del Bizum o localizador de la plataforma. PROHIBIDO el numero completo de la tarjeta y el CVV: hay un CHECK que lo impide.';
COMMENT ON COLUMN public.guest_bookings.payment_holder IS
  'Titular del medio de pago (anexo I A.4.d). NO se supone nunca: si no se sabe quien pago, se queda vacio y el parte omite el elemento, antes que afirmar que pago el huesped cuando pudo pagar una tarjeta virtual de Booking.';
COMMENT ON COLUMN public.guest_bookings.payment_expiry IS
  'Caducidad de la tarjeta (anexo I A.4.d). Se admite MM/AA y MM/AAAA; el MIR quiere MM/AAAA (Instrucciones §7.2) y la edge function normaliza al enviar. Solo tiene sentido con tarjeta del cliente.';
COMMENT ON COLUMN public.guest_bookings.payment_date IS
  'Fecha en que se efectuo el pago (anexo I A.4.d). Se rellena sola desde el webhook de Stripe o desde el primer apunte de booking_payments.';

-- ---------------------------------------------------------------------
-- 1.c Referencia del contrato (anexo I A.4.a)
-- ---------------------------------------------------------------------
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS contract_reference text;

COMMENT ON COLUMN public.guest_bookings.contract_reference IS
  'Numero de referencia del contrato (anexo I A.4.a) que viaja como <referencia>. Por defecto el booking_code; se separa por si algun dia el localizador del canal es lo que hay que declarar.';

-- Arranca igualada al codigo de reserva, que es lo que ya se mandaba.
UPDATE public.guest_bookings
   SET contract_reference = booking_code
 WHERE contract_reference IS NULL
   AND booking_code IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1.d Sellos de las dos comunicaciones del art. 6.3.a (hueco 2)
-- ---------------------------------------------------------------------
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS reserva_comunicada_at   timestamptz,
  ADD COLUMN IF NOT EXISTS anulacion_comunicada_at timestamptz;

COMMENT ON COLUMN public.guest_bookings.reserva_comunicada_at IS
  'Cuando se comunico la RESERVA al Ministerio (art. 6.3.a RD 933/2021, plazo 24 h desde la reserva). NULL = todavia no. El detalle tecnico de cada intento vive en ses_comunicaciones.';
COMMENT ON COLUMN public.guest_bookings.anulacion_comunicada_at IS
  'Cuando se comunico la ANULACION al Ministerio (art. 6.3.a, mismo plazo de 24 h). Solo procede si la reserva llego a comunicarse: no se anula ante el MIR algo que el MIR nunca vio.';

-- ---------------------------------------------------------------------
-- 1.e Libro-registro archivado (hueco 4)
-- ---------------------------------------------------------------------
-- La Orden INT/1922/2003 (apartado segundo.3 y 2.4) obliga a CONFECCIONAR
-- un libro-registro y a EXHIBIRLO cuando lo requieran. Un PDF que se
-- regenera bajo demanda no es un libro: si el dia que lo piden la funcion
-- esta caida o la maqueta ha cambiado, lo que se enseña no es lo que se
-- firmo. Se archiva una vez y se conserva.
ALTER TABLE public.guest_bookings
  ADD COLUMN IF NOT EXISTS libro_registro_path         text,
  ADD COLUMN IF NOT EXISTS libro_registro_archivado_at timestamptz;

COMMENT ON COLUMN public.guest_bookings.libro_registro_path IS
  'Ruta del PDF firmado dentro del cubo privado `libro-registro`, con la forma AAAA/AAAA-MM-DD-TJM-XXXXXX.pdf. Es el libro-registro del apartado segundo.3 de la Orden INT/1922/2003.';
COMMENT ON COLUMN public.guest_bookings.libro_registro_archivado_at IS
  'Cuando se archivo el PDF firmado. Con esta fecha empieza a contar el plazo de tres anos del apartado segundo.5 de la Orden INT/1922/2003.';

-- El barrido de reservas filtra por este sello.
CREATE INDEX IF NOT EXISTS guest_bookings_reserva_sin_comunicar_idx
  ON public.guest_bookings (status, created_at)
  WHERE reserva_comunicada_at IS NULL;


-- =====================================================================
-- 2. `apartments` — datos del inmueble (anexo I A.4.c y A.1.h)
-- =====================================================================

ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS num_habitaciones integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tiene_internet   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS anuncio_urls     jsonb   NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.apartments DROP CONSTRAINT IF EXISTS apartments_num_habitaciones_check;
ALTER TABLE public.apartments ADD CONSTRAINT apartments_num_habitaciones_check
  CHECK (num_habitaciones >= 1 AND num_habitaciones <= 20);

ALTER TABLE public.apartments DROP CONSTRAINT IF EXISTS apartments_anuncio_urls_check;
ALTER TABLE public.apartments ADD CONSTRAINT apartments_anuncio_urls_check
  CHECK (jsonb_typeof(anuncio_urls) = 'array');

COMMENT ON COLUMN public.apartments.num_habitaciones IS
  'Numero de DORMITORIOS del apartamento. Viaja como <numHabitaciones> del anexo I A.4.c. Hasta 0010 iba a fuego a 1 para los cuatro, que era falso en dos de ellos.';
COMMENT ON COLUMN public.apartments.tiene_internet IS
  'Conexion a internet en el alojamiento (anexo I A.4.c). Hoy los cuatro tienen wifi, pero es un dato de cada apartamento, no un literal en el codigo.';
COMMENT ON COLUMN public.apartments.anuncio_urls IS
  'URL de los anuncios del apartamento (anexo I A.1.h): web propia, Booking, Airbnb, Escapada Rural, CasasRurales.net. Array de objetos {canal, url}. El art. 6.1 in fine obliga a una NUEVA comunicacion previa cada vez que una de estas URL cambia, se da de baja o se abre otra.';

-- Habitaciones reales, DEDUCIDAS de `bed_config` y de la descripcion
-- (10-sep-2026). No hay columna de dormitorios en ningun sitio, asi que
-- la lectura es esta y se dice en voz alta:
--   · Albahaca — «1 cama de matrimonio», 2 plazas, 1 bano  → 1 dormitorio
--   · Tomillo  — «1 cama de matrimonio», 2 plazas, 1 bano  → 1 dormitorio
--   · Lavanda  — «1 matrimonio + 2 individuales», 4 plazas, 2 banos → 2
--   · Romero   — «1 matrimonio + 2 individuales», 4 plazas, 2 banos → 2
-- Las dos camas individuales se leen como UN dormitorio compartido, que
-- es lo normal en un apartamento de cuatro plazas. Si en Lavanda o en
-- Romero van en cuartos separados, son 3 y se cambia con un UPDATE de una
-- linea. NO se ha medido: se ha deducido, y hay que confirmarlo.
UPDATE public.apartments SET num_habitaciones = 1 WHERE slug IN ('albahaca','tomillo');
UPDATE public.apartments SET num_habitaciones = 2 WHERE slug IN ('lavanda','romero');


-- =====================================================================
-- 3. `traveler_records` — el parentesco, en la ficha del ADULTO (hueco 7)
-- =====================================================================
-- El Ministerio es inequivoco (Instrucciones, campo `parentesco`): «Si
-- alguna de las personas es menor de edad, AL MENOS UNA DE LAS PERSONAS
-- MAYORES DE EDAD ha de tener informada su relacion de parentesco con
-- esta persona menor de edad». Hasta ahora se guardaba al reves: en la
-- fila del niño. El texto que ve el huesped («Soy su padre o su madre»)
-- ya estaba escrito desde el punto de vista del adulto; lo unico que
-- estaba mal era donde se guardaba.
--
-- Se añade el puntero: `parentesco` (que ya existia) dice QUE es, y
-- `parentesco_menor_id` dice DE QUIEN.
ALTER TABLE public.traveler_records
  ADD COLUMN IF NOT EXISTS parentesco_menor_id uuid;

ALTER TABLE public.traveler_records DROP CONSTRAINT IF EXISTS traveler_records_parentesco_menor_fk;
ALTER TABLE public.traveler_records ADD CONSTRAINT traveler_records_parentesco_menor_fk
  FOREIGN KEY (parentesco_menor_id) REFERENCES public.traveler_records(id) ON DELETE SET NULL;

-- Nadie es pariente de si mismo. Se admite el caso heredado (parentesco
-- sin puntero) para no invalidar filas viejas: la edge function lo
-- resuelve al enviar.
ALTER TABLE public.traveler_records DROP CONSTRAINT IF EXISTS traveler_records_parentesco_menor_check;
ALTER TABLE public.traveler_records ADD CONSTRAINT traveler_records_parentesco_menor_check
  CHECK (parentesco_menor_id IS NULL OR parentesco_menor_id <> id);

CREATE INDEX IF NOT EXISTS traveler_records_parentesco_menor_idx
  ON public.traveler_records (parentesco_menor_id)
  WHERE parentesco_menor_id IS NOT NULL;

COMMENT ON COLUMN public.traveler_records.parentesco_menor_id IS
  'Fila del MENOR sobre el que esta persona declara su parentesco. Se rellena en la ficha del ADULTO: el adulto dice que es del menor (PM padre/madre, AB abuelo/a, HR hermano/a...). Instrucciones del MIR, campo parentesco.';

-- El CHECK de `parentesco` ya admite los quince codigos del MIR desde
-- `0008` (mas el heredado 'PA'); no se toca — hueco 11 cerrado en la
-- base, lo que faltaba era el formulario. Se reescribe el comentario
-- para que diga de quien es el dato ahora.
COMMENT ON COLUMN public.traveler_records.parentesco IS
  'Que es esta persona del menor al que acompaña (tabla 8.3 del MIR: AB BA BN CD CY HJ HR NI PM SB SG TI YN TU OT; PA es heredado y equivale a PM). Va en la ficha del ADULTO, junto con parentesco_menor_id. Anexo I A.3.o del RD 933/2021.';

-- ---------------------------------------------------------------------
-- 3.b Migracion de los datos que hubiera al reves
-- ---------------------------------------------------------------------
-- Hoy la tabla tiene 0 filas, asi que esto no mueve nada. Se deja escrito
-- igualmente para que sea la migracion la que enderece el dato y no un
-- apaño en el codigo: si mañana se restaura un respaldo con filas viejas,
-- vuelve a correr y las endereza.
--
-- Regla: el parentesco que estuviera en la fila de un MENOR pasa a la
-- fila del adulto responsable (el titular si es mayor de edad; si no, el
-- adulto mas antiguo de la reserva), apuntando al menor.
WITH menores AS (
    SELECT tr.id          AS menor_id,
           tr.booking_id,
           tr.parentesco
      FROM public.traveler_records tr
      JOIN public.guest_bookings   gb ON gb.id = tr.booking_id
     WHERE tr.parentesco IS NOT NULL
       AND tr.parentesco_menor_id IS NULL
       AND date_part('year', age(gb.check_in::timestamp, tr.fecha_nacimiento::timestamp)) < 18
), adulto AS (
    SELECT DISTINCT ON (m.menor_id)
           m.menor_id, m.parentesco, a.id AS adulto_id
      FROM menores m
      JOIN public.traveler_records a ON a.booking_id = m.booking_id
      JOIN public.guest_bookings   g ON g.id = a.booking_id
     WHERE a.id <> m.menor_id
       AND date_part('year', age(g.check_in::timestamp, a.fecha_nacimiento::timestamp)) >= 18
     ORDER BY m.menor_id, a.is_titular DESC, a.created_at ASC
)
UPDATE public.traveler_records tr
   SET parentesco          = adulto.parentesco,
       parentesco_menor_id = adulto.menor_id,
       updated_at          = now()
  FROM adulto
 WHERE tr.id = adulto.adulto_id;

-- Y al menor se le quita, que es donde no le tocaba estar.
UPDATE public.traveler_records tr
   SET parentesco = NULL,
       updated_at = now()
 WHERE tr.parentesco IS NOT NULL
   AND tr.parentesco_menor_id IS NULL
   AND EXISTS (
       SELECT 1 FROM public.traveler_records a
        WHERE a.parentesco_menor_id = tr.id
   );


-- =====================================================================
-- 4. `consent_privacy_at` → `informado_privacidad_at` (hueco 14)
-- =====================================================================
-- La base legal del parte es el art. 6.1.c) RGPD, CUMPLIMIENTO DE UNA
-- OBLIGACION LEGAL. No es consentimiento y no puede serlo: el huesped no
-- puede decir que no, porque si no da los datos no puede alojarse. Un
-- sello llamado «consent» sugiere lo contrario y en una inspeccion eso es
-- una etiqueta que juega en contra. Lo que prueba ese sello es que se le
-- INFORMO (art. 13 RGPD) antes de recoger nada.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'traveler_records'
           AND column_name = 'consent_privacy_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'traveler_records'
           AND column_name = 'informado_privacidad_at'
    ) THEN
        ALTER TABLE public.traveler_records
          RENAME COLUMN consent_privacy_at TO informado_privacidad_at;
    END IF;
END $$;

COMMENT ON COLUMN public.traveler_records.informado_privacidad_at IS
  'Cuando se le mostro al viajero la informacion del art. 13 RGPD, antes de recoger nada. NO es un consentimiento: la base legal del parte es el art. 6.1.c RGPD (obligacion legal del RD 933/2021) y por eso no cabe oponerse ni pedir la supresion antes de los tres anos (art. 17.3.b RGPD). Se llamaba consent_privacy_at hasta la migracion 0010.';


-- =====================================================================
-- 5. `ses_comunicaciones` — el diario de las dos comunicaciones nuevas
-- =====================================================================
-- El parte de viajeros deja su rastro en `traveler_records`. La reserva y
-- la anulacion no tienen donde dejarlo: pasan antes de que exista ni una
-- fila de viajero. Esta tabla es su diario, y es lo que hace posible el
-- reintento: el estado no se deduce de que un evento haya ocurrido, se
-- LEE.
CREATE TABLE IF NOT EXISTS public.ses_comunicaciones (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id           bigint  NOT NULL REFERENCES public.guest_bookings(id) ON DELETE CASCADE,
    tipo                 text    NOT NULL,
    estado               text    NOT NULL DEFAULT 'pendiente',
    intentos             integer NOT NULL DEFAULT 0,
    ultimo_intento_at    timestamptz,
    proximo_intento_at   timestamptz,
    lote                 text,
    codigos_comunicacion text[]  NOT NULL DEFAULT '{}',
    mensaje              text,
    xml                  text,
    acuse                text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ses_comunicaciones_tipo_check
        CHECK (tipo = ANY (ARRAY['reserva','anulacion'])),
    CONSTRAINT ses_comunicaciones_estado_check
        CHECK (estado = ANY (ARRAY[
            'pendiente',                    -- todavia no se ha intentado
            'pendiente_de_alta',            -- sin credenciales: documento preparado
            'enviado_pendiente_acuse',      -- el MIR lo recibio; falta su validacion
            'aceptado',                     -- el lote se valido y quedo grabado
            'rechazado',                    -- el MIR lo rechazo por contenido
            'retry',                        -- fallo de red o 5xx: se vuelve a intentar
            'no_procede',                   -- anulacion de algo que el MIR nunca vio
            'enviado_a_mano'                -- lo mando una persona por su via
        ])),
    CONSTRAINT ses_comunicaciones_una_por_tipo UNIQUE (booking_id, tipo)
);

COMMENT ON TABLE public.ses_comunicaciones IS
  'Diario de las comunicaciones de RESERVA y de ANULACION del art. 6.3.a del RD 933/2021 (plantilla RH del MIR). Una fila por reserva y tipo. El parte de viajeros (PV) NO vive aqui: su rastro esta en traveler_records.';
COMMENT ON COLUMN public.ses_comunicaciones.tipo IS
  'reserva (alta, tipoOperacion A + tipoComunicacion RH) o anulacion (tipoOperacion B, sin tipoComunicacion).';
COMMENT ON COLUMN public.ses_comunicaciones.codigos_comunicacion IS
  'Codigos de comunicacion que devuelve el MIR al validar el lote. Hacen falta para poder ANULAR despues: el XML de anulacion es una lista de codigoComunicacion (anexo III de la especificacion v3.1.2).';
COMMENT ON COLUMN public.ses_comunicaciones.proximo_intento_at IS
  'Cuando vuelve a intentarlo el barrido. Crece con cada fallo para no machacar un servicio caido.';
COMMENT ON COLUMN public.ses_comunicaciones.xml IS
  'El XML que se mando, tal cual, para poder auditarlo. La reserva solo declara el titular del contrato, sin numero de documento.';

CREATE INDEX IF NOT EXISTS ses_comunicaciones_booking_idx
  ON public.ses_comunicaciones (booking_id);
CREATE INDEX IF NOT EXISTS ses_comunicaciones_por_hacer_idx
  ON public.ses_comunicaciones (estado, proximo_intento_at);

DROP TRIGGER IF EXISTS ses_comunicaciones_set_updated_at ON public.ses_comunicaciones;
CREATE TRIGGER ses_comunicaciones_set_updated_at
  BEFORE UPDATE ON public.ses_comunicaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ses_comunicaciones ENABLE ROW LEVEL SECURITY;

-- Escribe solo la infraestructura. Miran admin y staff: aqui no hay ni un
-- dato de documento, solo el estado del tramite.
DROP POLICY IF EXISTS ses_comunicaciones_service_all ON public.ses_comunicaciones;
CREATE POLICY ses_comunicaciones_service_all
    ON public.ses_comunicaciones FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ses_comunicaciones_staff_read ON public.ses_comunicaciones;
CREATE POLICY ses_comunicaciones_staff_read
    ON public.ses_comunicaciones FOR SELECT TO authenticated
    USING (public.is_staff());

REVOKE ALL ON public.ses_comunicaciones FROM PUBLIC;
REVOKE ALL ON public.ses_comunicaciones FROM anon;
GRANT SELECT ON public.ses_comunicaciones TO authenticated;
GRANT ALL    ON public.ses_comunicaciones TO service_role;


-- =====================================================================
-- 6. Que esta pendiente de comunicar — una sola verdad
-- =====================================================================
-- El barrido y la pantalla leen de aqui. Si se dedujera en dos sitios
-- distintos acabarian discrepando, y ganaria el que no mira nadie.
CREATE OR REPLACE FUNCTION public.tjm_ses_pendientes()
 RETURNS TABLE(
    booking_id     bigint,
    booking_code   text,
    tipo           text,
    estado         text,
    intentos       integer,
    desde          timestamptz,
    limite_24h     timestamptz,
    fuera_de_plazo boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    -- RESERVAS confirmadas que todavia no se han comunicado.
    SELECT gb.id, gb.booking_code, 'reserva'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.created_at,
           gb.created_at + INTERVAL '24 hours',
           now() > gb.created_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'reserva'
     WHERE public.tjm_puede_gestionar()
       AND gb.status IN ('confirmed','completed')
       AND gb.reserva_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede')

    UNION ALL

    -- ANULACIONES de reservas que SI se llegaron a comunicar. Si el MIR
    -- nunca vio la reserva no hay nada que anular: eso se marca como
    -- 'no_procede' y no se manda, antes que mandar la baja de algo
    -- inexistente y comerse un rechazo.
    SELECT gb.id, gb.booking_code, 'anulacion'::text,
           COALESCE(c.estado, 'pendiente'),
           COALESCE(c.intentos, 0),
           gb.updated_at,
           gb.updated_at + INTERVAL '24 hours',
           now() > gb.updated_at + INTERVAL '24 hours'
      FROM public.guest_bookings gb
      LEFT JOIN public.ses_comunicaciones c
             ON c.booking_id = gb.id AND c.tipo = 'anulacion'
     WHERE public.tjm_puede_gestionar()
       AND gb.status = 'cancelled'
       AND gb.reserva_comunicada_at IS NOT NULL
       AND gb.anulacion_comunicada_at IS NULL
       AND COALESCE(c.estado, 'pendiente') NOT IN ('enviado_a_mano','no_procede');
$function$;

COMMENT ON FUNCTION public.tjm_ses_pendientes() IS
  'Que comunicaciones del art. 6.3.a estan por mandar y a cuales se les ha pasado el plazo de 24 h. Devuelve 0 filas si quien llama no es staff, admin ni la propia infraestructura. Sin datos personales.';

CREATE OR REPLACE VIEW public.v_ses_pendientes WITH (security_invoker = true) AS
  SELECT booking_id, booking_code, tipo, estado, intentos, desde, limite_24h, fuera_de_plazo
    FROM public.tjm_ses_pendientes();

COMMENT ON VIEW public.v_ses_pendientes IS
  'Comunicaciones de reserva y anulacion pendientes. Es lo que mira el barrido y lo que pinta el panel.';

REVOKE ALL ON FUNCTION public.tjm_ses_pendientes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_ses_pendientes() FROM anon;
GRANT EXECUTE ON FUNCTION public.tjm_ses_pendientes() TO authenticated, service_role;

REVOKE ALL ON public.v_ses_pendientes FROM PUBLIC;
REVOKE ALL ON public.v_ses_pendientes FROM anon;
GRANT SELECT ON public.v_ses_pendientes TO authenticated, service_role;


-- =====================================================================
-- 7. `set_payment_details` — apuntar el pago desde el panel
-- =====================================================================
-- Para Stripe esto lo rellena solo el webhook. Esta RPC es para lo otro:
-- transferencia, Bizum, efectivo y la tarjeta virtual de Booking.
--
-- Dos reglas duras dentro:
--   · el titular NO se supone. Si llega vacio, se queda como estaba.
--   · no entra un numero de tarjeta completo. El CHECK de la tabla lo
--     impediria igual, pero aqui se contesta con un mensaje que se
--     entiende en vez de con un error de restriccion.
CREATE OR REPLACE FUNCTION public.set_payment_details(
    p_booking_id bigint,
    p_type       text,
    p_instrument text DEFAULT NULL,
    p_holder     text DEFAULT NULL,
    p_expiry     text DEFAULT NULL,
    p_date       date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_tipo       text := upper(btrim(COALESCE(p_type, '')));
    v_instrument text := NULLIF(btrim(COALESCE(p_instrument, '')), '');
    v_holder     text := NULLIF(btrim(COALESCE(p_holder, '')), '');
    v_expiry     text := NULLIF(btrim(COALESCE(p_expiry, '')), '');
    v_code       text;
BEGIN
    IF NOT public.tjm_puede_gestionar() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'sin_permiso');
    END IF;

    IF v_tipo NOT IN ('EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','DESTI','OTRO') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tipo_de_pago_no_valido',
            'mensaje', 'El tipo de pago tiene que ser uno del catalogo del Ministerio.');
    END IF;

    IF v_instrument IS NOT NULL
       AND regexp_replace(v_instrument, '[^0-9]', '', 'g') ~ '^[0-9]{13,19}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'parece_una_tarjeta_entera',
            'mensaje', 'Ahi no va el numero completo de la tarjeta. Marca y ultimos cuatro: «VISA ****4242».');
    END IF;

    IF v_expiry IS NOT NULL AND v_expiry !~ '^(0[1-9]|1[0-2])/([0-9]{2}|[0-9]{4})$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'caducidad_no_valida',
            'mensaje', 'La caducidad va como MM/AA o MM/AAAA.');
    END IF;

    UPDATE public.guest_bookings
       SET payment_type       = v_tipo,
           payment_instrument = v_instrument,
           -- El titular no se inventa: si no viene, se queda como estaba.
           payment_holder     = COALESCE(v_holder, payment_holder),
           payment_expiry     = v_expiry,
           payment_date       = COALESCE(p_date, payment_date),
           updated_at         = now()
     WHERE id = p_booking_id
    RETURNING booking_code INTO v_code;

    IF v_code IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserva_no_encontrada');
    END IF;

    RETURN jsonb_build_object('ok', true, 'booking_code', v_code, 'payment_type', v_tipo);
END $function$;

COMMENT ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) IS
  'Apunta los datos de pago del anexo I A.4.d desde el panel (transferencia, Bizum, efectivo, tarjeta virtual de Booking). Lo de Stripe lo rellena solo el webhook. Rechaza un numero de tarjeta completo y nunca supone el titular.';

REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_payment_details(bigint, text, text, text, text, date) TO authenticated, service_role;


-- =====================================================================
-- 8. El titular del pago de un canal es la PLATAFORMA, no el huesped
-- =====================================================================
-- Con Booking paga una tarjeta virtual de Booking. Poner ahi el nombre
-- del huesped es afirmar algo falso, y un registro que afirma algo falso
-- es peor que uno incompleto. Se rellena solo, al confirmar, y solo
-- cuando el canal lo dice.
CREATE OR REPLACE FUNCTION public.tjm_pago_por_plataforma()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_titular text;
BEGIN
    IF NEW.status NOT IN ('confirmed','completed') THEN
        RETURN NEW;
    END IF;

    v_titular := CASE NEW.channel
        WHEN 'booking'      THEN 'Booking.com B.V.'
        WHEN 'airbnb'       THEN 'Airbnb Ireland UC'
        WHEN 'escapada'     THEN 'Escapada Rural'
        WHEN 'casasrurales' THEN 'CasasRurales.net'
        ELSE NULL
    END;

    IF v_titular IS NULL THEN
        RETURN NEW;
    END IF;

    -- Nunca se pisa lo que ya haya puesto una persona a mano.
    IF NEW.payment_type IS NULL THEN
        NEW.payment_type := 'PLATF';
    END IF;
    IF NEW.payment_holder IS NULL THEN
        NEW.payment_holder := v_titular;
    END IF;
    IF NEW.payment_instrument IS NULL AND NEW.channel = 'booking' THEN
        -- Tarjeta virtual de Booking. Los cuatro ultimos digitos salen de
        -- la extranet y los apunta una persona; hasta entonces se dice lo
        -- que se sabe y nada mas.
        NEW.payment_instrument := 'Tarjeta virtual Booking'
            || COALESCE(' · localizador ' || NEW.external_locator, '');
    ELSIF NEW.payment_instrument IS NULL AND NEW.external_locator IS NOT NULL THEN
        NEW.payment_instrument := 'Cobro de la plataforma · localizador ' || NEW.external_locator;
    END IF;

    RETURN NEW;
END $function$;

COMMENT ON FUNCTION public.tjm_pago_por_plataforma() IS
  'Rellena tipo, titular e identificacion del medio de pago cuando la reserva viene de un canal que cobra el. El titular es la plataforma, NO el huesped (anexo I A.4.d). No pisa nada apuntado a mano.';

DROP TRIGGER IF EXISTS guest_bookings_pago_por_plataforma ON public.guest_bookings;
CREATE TRIGGER guest_bookings_pago_por_plataforma
  BEFORE INSERT OR UPDATE OF status, channel ON public.guest_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tjm_pago_por_plataforma();

REVOKE ALL ON FUNCTION public.tjm_pago_por_plataforma() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_pago_por_plataforma() FROM anon;
REVOKE ALL ON FUNCTION public.tjm_pago_por_plataforma() FROM authenticated;

-- Y la fecha del pago sale sola del primer apunte de cobro, que ya
-- existe. Hasta ahora `fechaPago` se mandaba vacio a proposito teniendo
-- el dato al lado.
CREATE OR REPLACE FUNCTION public.tjm_fecha_de_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    UPDATE public.guest_bookings gb
       SET payment_date = NEW.paid_on,
           updated_at   = now()
     WHERE gb.id = NEW.booking_id
       AND (gb.payment_date IS NULL OR gb.payment_date > NEW.paid_on);
    RETURN NEW;
END $function$;

COMMENT ON FUNCTION public.tjm_fecha_de_pago() IS
  'Deja en guest_bookings.payment_date la fecha del PRIMER cobro apuntado (anexo I A.4.d). Se dispara con cada apunte de booking_payments.';

DROP TRIGGER IF EXISTS booking_payments_fecha_de_pago ON public.booking_payments;
CREATE TRIGGER booking_payments_fecha_de_pago
  AFTER INSERT ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.tjm_fecha_de_pago();

REVOKE ALL ON FUNCTION public.tjm_fecha_de_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_fecha_de_pago() FROM anon;
REVOKE ALL ON FUNCTION public.tjm_fecha_de_pago() FROM authenticated;


-- =====================================================================
-- 9. El cubo del libro-registro (hueco 4)
-- =====================================================================
-- PRIVADO, y que no se le ocurra a nadie hacerlo publico: dentro hay
-- nombre, numero de documento, direccion y firma de cada viajero.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('libro-registro', 'libro-registro', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Lo escribe la infraestructura (la edge function, con clave de servicio,
-- que no pasa por estas politicas). Lo LEEN admin y staff, porque el
-- apartado segundo.4 de la Orden INT/1922/2003 obliga a exhibirlo cuando
-- lo requieran las Fuerzas y Cuerpos de Seguridad, y quien esta delante
-- cuando lo piden es la persona del alojamiento.
DROP POLICY IF EXISTS libro_registro_staff_read ON storage.objects;
CREATE POLICY libro_registro_staff_read
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'libro-registro' AND public.is_staff());

-- Consulta por rango de fechas: es lo que se pide en una inspeccion
-- («enseñeme el libro de agosto»).
CREATE OR REPLACE FUNCTION public.tjm_libro_registro(p_desde date, p_hasta date)
 RETURNS TABLE(
    booking_id   bigint,
    booking_code text,
    apartamento  text,
    check_in     date,
    check_out    date,
    viajeros     integer,
    ruta         text,
    archivado_at timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT gb.id, gb.booking_code, a.name, gb.check_in, gb.check_out,
           (SELECT count(*)::int FROM public.traveler_records tr WHERE tr.booking_id = gb.id),
           gb.libro_registro_path, gb.libro_registro_archivado_at
      FROM public.guest_bookings gb
      JOIN public.apartments a ON a.id = gb.apartment_id
     WHERE public.tjm_puede_gestionar()
       AND gb.check_in >= p_desde
       AND gb.check_in <= p_hasta
       AND gb.status IN ('confirmed','completed')
     ORDER BY gb.check_in, gb.booking_code;
$function$;

COMMENT ON FUNCTION public.tjm_libro_registro(date, date) IS
  'Libro-registro por rango de fechas (Orden INT/1922/2003, apartado segundo). Devuelve la RUTA del PDF archivado en el cubo privado libro-registro, no el PDF: el panel pide una URL firmada. Una fila sin ruta es una estancia cuyo parte todavia no se ha archivado, y eso hay que verlo.';

REVOKE ALL ON FUNCTION public.tjm_libro_registro(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_libro_registro(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.tjm_libro_registro(date, date) TO authenticated, service_role;


-- =====================================================================
-- 10. Que todo esto ocurra SOLO (huecos 2 y 13)
-- =====================================================================
-- POR QUE UN BARRIDO Y NO UN TRIGGER QUE LLAME AL MINISTERIO
-- ----------------------------------------------------------
-- Un trigger que dispara HTTP al confirmar una reserva parece mas
-- inmediato, y es peor por cuatro motivos concretos:
--   1. Dispara UNA vez. Si el servicio del MIR esta caido en ese
--      segundo, no hay segunda oportunidad: el evento ya paso.
--   2. Si el envio va dentro de la transaccion, un fallo del Ministerio
--      tumba la reserva del cliente. Si va fuera (pg_net), el resultado
--      no se mira y el fallo se pierde en silencio — que es exactamente
--      como estuvo la factura sin emitirse durante semanas.
--   3. Un trigger no cubre lo que ya paso: las reservas confirmadas
--      antes de desplegarlo se quedan fuera para siempre.
--   4. El estado se vuelve un rastro de eventos, no un hecho. El barrido
--      pregunta «que sigue sin comunicar», que es un hecho comprobable en
--      la base y se cura solo despues de una caida.
-- El plazo legal es de 24 horas (art. 6.3), asi que barrer cada hora deja
-- veinticuatro oportunidades dentro de plazo. La inmediatez no aporta
-- nada y la resistencia lo aporta todo.
--
-- COMO SE AUTENTICA EL BARRIDO
-- ----------------------------
-- `submit-ses-hospedajes` maneja documentos de identidad, asi que NO
-- puede aceptar la clave publicable con la que llaman los otros crones.
-- Se usa una llave propia guardada en Vault (`ses_cron_token`) y puesta
-- tambien como secreto de la edge function. Mientras la llave no exista
-- en los dos sitios, el disparador NO llama y deja una tarea en el panel:
-- un vigilante que falla en silencio ocupa el sitio del que funcionaria.
CREATE OR REPLACE FUNCTION public.tjm_disparar_ses(p_accion text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_llave text;
    v_id    bigint;
BEGIN
    SELECT decrypted_secret INTO v_llave
      FROM vault.decrypted_secrets
     WHERE name = 'ses_cron_token'
     LIMIT 1;

    IF COALESCE(btrim(v_llave), '') = '' THEN
        -- Ni una llamada a ciegas. Se deja constancia UNA vez, no una por
        -- pasada: una alerta repetida cada hora se convierte en ruido y
        -- deja de leerse.
        INSERT INTO public.internal_tasks (title, description, category, priority, status, scheduled_date, auto_reschedule)
        SELECT
            'El parte de viajeros no puede salir solo: falta la llave del sistema',
            'El barrido automatico del RD 933/2021 (reservas, anulaciones y parte de viajeros) esta programado pero NO puede llamar a la funcion, porque falta la llave compartida.' || chr(10) || chr(10)
            || 'Se arregla en dos pasos, los dos en Supabase:' || chr(10)
            || '  1. SQL Editor: select decrypted_secret from vault.decrypted_secrets where name = ''ses_cron_token'';' || chr(10)
            || '  2. Settings -> Edge Functions -> Secrets: crear SES_CRON_TOKEN con ese valor.' || chr(10) || chr(10)
            || 'Hasta entonces el parte hay que mandarlo a mano desde el panel.',
            'legal', 'high', 'pending', current_date, false
        WHERE NOT EXISTS (
            SELECT 1 FROM public.internal_tasks
             WHERE title = 'El parte de viajeros no puede salir solo: falta la llave del sistema'
               AND status = 'pending'
        );
        RETURN NULL;
    END IF;

    SELECT net.http_post(
        url     := 'https://nmtukksbzbnuzqsksdmw.supabase.co/functions/v1/submit-ses-hospedajes',
        headers := jsonb_build_object(
                       'Content-Type',  'application/json',
                       'Authorization', 'Bearer ' || v_llave),
        body    := jsonb_build_object('accion', p_accion)
    ) INTO v_id;

    RETURN v_id;
END $function$;

COMMENT ON FUNCTION public.tjm_disparar_ses(text) IS
  'Llama a submit-ses-hospedajes con la llave del sistema guardada en Vault (ses_cron_token). Si la llave no esta, NO llama y deja una tarea en el panel en vez de fallar en silencio. Es lo que usan los crones del RD 933/2021.';

REVOKE ALL ON FUNCTION public.tjm_disparar_ses(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tjm_disparar_ses(text) FROM anon;
REVOKE ALL ON FUNCTION public.tjm_disparar_ses(text) FROM authenticated;

-- La llave: se crea aqui con un valor aleatorio para que exista desde el
-- primer minuto. Nadie la teclea y no aparece en claro en ningun sitio.
-- Se lee una sola vez, desde el SQL Editor, para copiarla al secreto de
-- la edge function.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ses_cron_token') THEN
        PERFORM vault.create_secret(
            encode(extensions.gen_random_bytes(32), 'hex'),
            'ses_cron_token',
            'Llave compartida entre los crones del RD 933/2021 y la edge function submit-ses-hospedajes. Debe existir tambien como secreto SES_CRON_TOKEN de la funcion.'
        );
    END IF;
END $$;

-- Barrido de reservas y anulaciones: cada hora, veinticuatro
-- oportunidades dentro del plazo de 24 h del art. 6.3.a.
SELECT cron.unschedule('tjm-ses-reservas') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-ses-reservas');
SELECT cron.schedule('tjm-ses-reservas', '23 * * * *', $cron$SELECT public.tjm_disparar_ses('barrido-reservas');$cron$);

-- El parte de viajeros: a las 08:00 UTC (10:00 en España en verano,
-- 09:00 en invierno) del dia siguiente a cada entrada. Con check-in real
-- entre las 16:00 y las 20:00 siempre cae dentro de las 24 h del
-- art. 6.3.b. Esto NO existia: la tanda solo salia si alguien tocaba el
-- boton del panel.
SELECT cron.unschedule('tjm-parte-viajeros') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-parte-viajeros');
SELECT cron.schedule('tjm-parte-viajeros', '0 8 * * *', $cron$SELECT public.tjm_disparar_ses('tanda');$cron$);

-- Purga del art. 5.3: `prune-traveler-records` (jobid 6) ya borra a los
-- 3 anos + 30 dias y esta ACTIVO — comprobado en `cron.job` el
-- 10-sep-2026. El hueco 13 estaba cerrado y la auditoria no lo habia
-- mirado. Lo que si estaba sin disparador era la anonimizacion de `0008`,
-- que entra 30 dias antes y deja el rastro de que el parte existio.
SELECT cron.unschedule('tjm-purgar-partes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tjm-purgar-partes');
SELECT cron.schedule('tjm-purgar-partes', '40 3 1 * *', $cron$SELECT public.tjm_purgar_partes_caducados();$cron$);
