# Conectar los canales — guía paso a paso

> Para Jesús. Verificado el **10-sep-2026** contra la documentación viva de cada portal
> (fuentes al final). Cada frecuencia y cada ruta de menú sale de ahí, no de memoria.
>
> Lo de esta página **no lo ve la madre**. Los canales son cosa nuestra: ella solo ve
> «Carmen, Albahaca, 25–27 sep, ha venido por Booking».

---

## 0. Cómo funciona, en dos frases

TJM es el centro. Cada portal le manda su ocupación, TJM la junta, y le devuelve a
cada portal **todo lo ocupado menos lo que ese mismo portal le mandó**.

Por eso hay **un enlace distinto por canal**. No se pega el mismo en los cuatro.

| Apartamento | Para Airbnb | Para Booking | Para Escapada Rural | Para CasasRurales.net |
|---|---|---|---|---|
| Albahaca | `https://tiojosemaria.com/ical/albahaca-airbnb.ics` | `…/albahaca-booking.ics` | `…/albahaca-escapada.ics` | `…/albahaca-casasrurales.ics` |
| Lavanda | `…/lavanda-airbnb.ics` | `…/lavanda-booking.ics` | `…/lavanda-escapada.ics` | `…/lavanda-casasrurales.ics` |
| Romero | `…/romero-airbnb.ics` | `…/romero-booking.ics` | `…/romero-escapada.ics` | `…/romero-casasrurales.ics` |
| Tomillo | `…/tomillo-airbnb.ics` | `…/tomillo-booking.ics` | `…/tomillo-escapada.ics` | `…/tomillo-casasrurales.ics` |

En el panel (**Canales**) cada canal de cada apartamento tiene su botón «Copiar»: no hace
falta escribir esto a mano. `https://tiojosemaria.com/ical/albahaca.ics` (sin sufijo) es el
calendario completo, útil para mirarlo tú en Google Calendar, **no para pegarlo en un canal**.

### Si pegas el enlace equivocado

Si a Airbnb le das el enlace sin sufijo, Airbnb se ve a sí mismo: sus propias reservas le
vuelven como «bloqueo externo». No se rompe nada al momento, pero su calendario se llena de
duplicados que él no controla y que no se van cuando la reserva se cancela.

---

## 1. Lo que iCal **no** hace (léelo antes de conectar nada)

Vale para los cuatro portales:

- **No viajan los precios.** Ni las estancias mínimas, ni las reglas de reserva. Solo
  «ocupado / libre». Los precios se siguen poniendo en cada portal.
- **No es instantáneo.** Cada portal mira los calendarios ajenos cada 2–3 horas. **Esa es la
  ventana en la que se puede colar una doble reserva**, y no depende de nosotros. Booking lo
  reconoce por escrito en su propia ayuda.
- **No siempre viaja el nombre del huésped.** Airbnb no lo manda nunca. De Booking, la
  documentación oficial no dice qué manda, y los integradores externos coinciden en que
  **no manda nada del cliente**. Nuestro importador está preparado: si el nombre viene, crea
  la reserva con nombre y localizador; si no viene, deja el bloqueo mudo, como hasta hoy.
  Se sabrá con certeza el día que se conecte Booking de verdad y se mire el `.ics`.

Lo que sí controlamos es **cuánto tardamos en enterarnos**: el cron de TJM pasó de 30 a
**15 minutos** (`tjm-jobs/src/trigger/sync-ical-channels.ts`).

---

## 2. Airbnb

**Estado hoy: ya importa** (los cuatro apartamentos, 42 bloqueos hasta agosto de 2027).
**Falta la otra mitad: darle nuestro enlace.**

### a) Copiar el enlace de Airbnb (ya está hecho, por si hay que rehacerlo)

1. Entra en Airbnb como anfitrión.
2. **Calendario** → elige el anuncio.
3. **Disponibilidad**.
4. Baja hasta **Vincula los calendarios** → **Conéctate a una web externa**.
5. Ahí copias el enlace del calendario de Airbnb.
6. Pégalo en el panel de TJM, en **Canales** → el apartamento → *Enlace del calendario de Airbnb*.

### b) Darle nuestro enlace a Airbnb ← **esto es lo que falta**

1. Misma pantalla: **Calendario → Disponibilidad → Vincula los calendarios → Conéctate a una web externa**.
2. Pega `https://tiojosemaria.com/ical/<apartamento>-airbnb.ics`.
3. Ponle un nombre (por ejemplo «Web Tío José María») y pulsa **Añade el calendario**.
4. Repite en los cuatro anuncios, cada uno con SU enlace.

**Frecuencia:** Airbnb se actualiza **cada 3 horas**. Para forzarlo: misma pantalla,
selecciona el calendario importado → **Actualiza el calendario** (hay un límite de veces).

**Avisos:**
- Airbnb importa **como mucho 2 años** por delante.
- Los calendarios importados no se pueden pausar: hay que desvincular y volver a vincular.
- La URL tiene que acabar en `.ics`. Las nuestras acaban en `.ics`.
- Hazlo **desde el ordenador**. En la app puede que exista, pero no está confirmado.

---

## 3. Booking.com

**Estado hoy: sin conectar** (`booking_ical_url` vacío en los cuatro). Es el hueco que más
importa: en MisterPlan es de donde viene el 56 % de la facturación.

### Antes de empezar — cinco condiciones de Booking

La sincronización por iCal solo está disponible si:

1. El alojamiento está **abierto**.
2. Tu usuario tiene permisos de **Tarifas y disponibilidad**.
3. El alojamiento tiene **20 tipos de habitación o menos**.
4. Cada tipo de habitación tiene **una sola unidad**.
5. **No usas un proveedor de conectividad** (channel manager).

⚠️ **El punto 5 choca de frente con MisterPlan.** Mientras MisterPlan siga siendo el channel
manager de Booking, la extranet probablemente **no deje** activar iCal. El orden correcto es:
primero quitar Booking de MisterPlan, luego conectar iCal aquí. Eso convierte la convivencia
en paralelo (fase F2 del plan) en algo que **no se puede hacer con Booking**: con Booking hay
salto, no solape. Conviene dejarlo para el final y hacerlo un día tranquilo.

### a) Copiar el enlace de Booking

1. Entra en la extranet.
2. **Tarifas y disponibilidad** → **Sincronizar calendarios**.
3. **Conectar un calendario** → **Saltar a exportar**.
4. Ponle un nombre a la conexión.
5. **Copiar enlace**. Ese es el que pegas en el panel de TJM.
6. Repite por cada unidad (es por habitación/unidad, no por alojamiento).

### b) Darle nuestro enlace a Booking

1. **Tarifas y disponibilidad** → **Sincronizar calendarios**.
2. Busca la **habitación o unidad** concreta → **Conectar un calendario**.
3. Pega `https://tiojosemaria.com/ical/<apartamento>-booking.ics`.
4. Ponle nombre («Tío José María») → **Siguiente** → **Listo**.
5. Repite en las cuatro unidades.

Si te saltas la importación, se retoma con **Completar configuración** en la misma página.

**Frecuencia:** Booking importa **cada 2 horas**. Botón manual: **Importar ahora**.

**Avisos:**
- La URL correcta de Booking lleva `/ical/`. Es su propia forma de comprobar que no te has
  equivocado de portal.
- Booking avisa por escrito de que **esto puede generar reservas duplicadas** porque no es
  en tiempo real.
- Estados que verás: *Activando*, *OK*, *Solo importar*, *Exportar solo*, *Error del servicio*.
- No hay sincronización con Google Calendar.

---

## 4. Escapada Rural

**Estado hoy: nada conectado.** Sí admite iCal.

### a) Copiar el enlace de Escapada Rural

1. Menú de propietario → **Calendario**.
2. **Sincronizar calendarios** → **Gestionar iCal**.
3. En **Exportar calendarios**, pulsa **Generar URL**.
   (El enlace **no existe hasta que pulsas ese botón**: no lo busques antes.)
4. Cópialo y pégalo en el panel de TJM.

### b) Darle nuestro enlace a Escapada Rural

1. **Calendario → Sincronizar calendarios → Gestionar iCal**.
2. Marca **Vincular** y pega `https://tiojosemaria.com/ical/<apartamento>-escapada.ics`
   **con un nombre identificativo** (lo pide).
3. Guarda. Aparece en **Calendarios vinculados**.
4. Pulsa **Sincronizar ahora** para arrancar.
5. Se pueden vincular tantos enlaces como haga falta: repite por cada portal.

**Frecuencia: cada 3 horas** (+ botón **Sincronizar ahora**).
⚠️ El plan del proyecto decía «cada 12 h»: **ese dato es de la versión retirada de su ayuda**.
Son 3 horas.

**Avisos:**
- Los bloqueos que entran por iCal salen **en rojo** y **no se pueden desbloquear desde
  Escapada Rural**: hay que quitarlos en el origen y volver a pulsar **Sincronizar ahora**.
- **Los precios no viajan por iCal.** Hay que tenerlos puestos en Escapada Rural.
- Su fallo número uno: pegar **la URL de la propia Escapada Rural** en el campo de importar.
  No lo hagas; ahí va la nuestra.
- **O iCal, o AvaiBook.** Si algún día se conecta AvaiBook, «se eliminará cualquier ocupación
  previamente importada por iCal».
- Si pasan más de 15 días sin tocar el calendario, dejas de salir en las búsquedas por fechas.
  Hay un botón **«Actualizar sin tocar ocupación»** al pie de la pantalla de Calendario. Que
  la sincronización automática cuente como actualización **no está confirmado en su ayuda**.

---

## 5. CasasRurales.net

**Estado hoy: nada conectado. Y es el portal de riesgo del proyecto.**

### Lo que sí está confirmado

1. Entra en `https://www.casasrurales.net/emp-Acceso.php`.
2. Ve a **Disponibilidad**.
3. Pulsa **Importar calendario**.
4. Se elige la **fuente de sincronización**.

La conexión antigua **por XML está muerta**: el artículo que la documentaba fue reescrito
como conexión por API en diciembre de 2025 y ya no menciona XML.

### Lo que NO está confirmado — y hay que mirarlo con los ojos

- **Si ese botón acepta una URL iCal cualquiera** (la nuestra), o solo deja elegir fuentes
  cerradas tipo AvaiBook. La documentación viva solo describe la opción AvaiBook, que va por
  API con usuario y contraseña, no por iCal.
- **Si CasasRurales.net exporta su propio iCal.** No hay ni una fuente que lo diga.
- **Cada cuánto sincroniza.** No lo declara nadie.

CasasRurales.net **no tiene ayuda pública para propietarios**: sus páginas de ayuda devuelven
error. Todo lo que se sabe viene de channel managers de terceros.

> **Qué hacer:** entra en Disponibilidad → Importar calendario y **mira la pantalla**. Es un
> minuto con la cuenta delante e imposible desde fuera. Si hay un campo para pegar una URL,
> pega `https://tiojosemaria.com/ical/<apartamento>-casasrurales.ics` y avisa. Si solo hay
> fuentes cerradas, este portal se queda fuera del plan de iCal y hay que decidir otra cosa.

**Aviso:** desconectar solo desde AvaiBook **no** desconecta el portal. La baja se pide
primero en CasasRurales.net.

---

## 6. Cuando ya esté conectado

### Comprobar que funciona, en los dos sentidos

1. **De ellos a nosotros:** bloquea un día suelto en el portal. Espera a la siguiente pasada
   (máximo 15 min) o pulsa **Sincronizar ahora** en el panel. Ese día tiene que aparecer
   ocupado en el calendario de TJM y desaparecer de la web pública.
2. **De nosotros a ellos:** bloquea un día en TJM. Espera el refresco del portal (2–3 h) o
   fuerza la actualización desde su panel. Tiene que aparecer ocupado allí.
3. **Deshaz las dos pruebas.**

### Qué hay que mirar de vez en cuando

En el panel, arriba del todo:

- **Semáforo por canal**: verde si se miró en las últimas 2 horas, rojo si no. Un canal
  configurado que **nunca** ha sincronizado sale en rojo también: es el caso más peligroso
  y no puede desaparecer de la lista.
- **Solapes**: si un canal ocupa unas fechas que ya tenían reserva propia, sale ahí en rojo.
  Las fechas **sí** se bloquean (bloquear es el lado seguro); lo que hay que decidir es qué
  reserva se mantiene.
- **Últimas sincronizaciones**: la lista cruda. Sirve para lo que el semáforo no dice: si el
  proceso corre pero **no escribe**, aquí se ve.

Y no hace falta mirarlo: **si un canal lleva más de 2 horas sin sincronizar bien, o si sale
un solape, llega un aviso**. Si algún día el aviso deja de llegar cuando debería, el
problema es el vigilante, no el canal.

---

## 7. Orden recomendado

1. **Airbnb**: darle nuestro enlace (lo demás ya está). Sin riesgo, ya está en marcha.
2. **Escapada Rural**: los dos sentidos. En MisterPlan no mueve dinero (última opinión de
   2022), así que si algo sale torcido no duele.
3. **CasasRurales.net**: mirar la pantalla y decidir.
4. **Booking, el último y con calma**: primero quitarlo de MisterPlan, luego conectar iCal
   aquí, comprobar en el mismo rato. No se puede tener las dos cosas a la vez.

---

## Fuentes (todas consultadas el 10-sep-2026)

- Airbnb — [Sincronizar el calendario del anuncio con otros sitios web](https://www.airbnb.es/help/article/99)
- Booking.com for Partners — [Cómo sincronizar tus calendarios en todos los canales](https://partner.booking.com/es/ayuda/tarifas-disponibilidad/calendario-extranet/c%C3%B3mo-sincronizar-tus-calendarios-en-todos-los)
- EscapadaRural — [Preguntas frecuentes sobre calendario](https://ayuda.escapadarural.com/support/solutions/articles/205000064897-preguntas-frecuentes-sobre-calendario) (modificado 22-jun-2026)
- AvaiBook — [Casasrurales.net: cómo sincronizar tus calendarios [API]](https://helpcenter.avaibook.com/es/articles/4277438-casasrurales-net-como-sincronizar-tus-calendarios-api) (5-dic-2025)
- AvaiBook — [EscapadaRural: cómo conectar tus alojamientos](https://helpcenter.avaibook.com/es/articles/9588005-escapadarural-como-conectar-tus-alojamientos)
- CasasRurales.net — [Acceso a propietarios](https://www.casasrurales.net/emp-Acceso.php)
- Anytime Booking — [Connecting to Booking.com by iCal](https://knowledgebase.anytimebooking.co.uk/knowledge/booking.comical) (fuente secundaria, sobre qué lleva el feed de Booking)

**Enlace que estaba en el plan y ya no existe:** el artículo de EscapadaRural en
`ayuda.escapadarural.com/hc/es/articles/10849656286749…` devuelve 404 — su ayuda migró de
plataforma. De ahí venía el dato equivocado de las 12 horas.
