# INE — Encuesta mensual de ocupación (EOTR)

> Qué se envía, cuándo, quién, cómo, y qué **no** sale del sistema.
> Paquete P5.1–P5.2 del plan «sustituir MisterPlan».
> Escrito el 10-sep-2026 contra el cuestionario en vigor **Mod. EOTR-21**.

---

## 1. Qué es y por qué nos toca

El INE hace todos los meses la **Encuesta de Ocupación en Alojamientos de Turismo
Rural (EOTR)**. Es de **cumplimentación obligatoria** para los establecimientos
que están en la muestra: el propio cuestionario recuerda que la Ley 12/1989
obliga a facilitar los datos y que no hacerlo se sanciona.

Hoy la rellenamos porque **MisterPlan trae el formulario prellenado**. Al apagar
MisterPlan perdemos ese prellenado — no la obligación. Esta pantalla lo sustituye.

**Ojo, esto no es opcional pero tampoco es universal**: la EOTR es una encuesta
**por muestreo** (~1.200 establecimientos, la muestra se renueva cada 4 años).
Solo hay que contestar si el INE ha incluido a Tío José María en la muestra y ha
mandado el cuestionario con su etiqueta y sus credenciales. Si algún mes deja de
llegar, no se inventa un envío: se comprueba.

**Datos del alojamiento**: Apartamentos Rurales Tío José María, Hinojares (Jaén),
4 apartamentos, 12 plazas (2 + 4 + 4 + 2), registro `VTAR/JA/00044`.

---

## 2. Cuándo

- **Periodicidad**: mensual.
- **Periodo de referencia**: el **mes completo** indicado en la etiqueta del
  cuestionario. (El Mod. EOTR-21 pregunta por «el mes de referencia» en todos sus
  apartados; la vieja metodología de 7 días consecutivos ya no aplica a este
  modelo.)
- **Plazo**: *«se enviará, una vez cumplimentado, en los **cinco días naturales
  siguientes** a los que se refieren los datos»*. Es decir, el mes de septiembre
  se envía entre el 1 y el 5 de octubre.
- **Recordatorio**: hay una tarea recurrente mensual en `internal_tasks`
  («Enviar la encuesta del INE…», `recurrence='monthly'`, prioridad alta), que se
  ve en el panel → *Calendario de mantenimiento*. Ver §7.

---

## 3. Quién

Es **trabajo nuestro, no de la madre** (plan §4.0: «INE (cálculo y envío)» está
en la columna de lo técnico). La pantalla vive en el panel completo de Jesús y
**no aparece en el modo sencillo**.

Pendiente de F0: **quién tiene hoy el usuario de IRIA** y si sigue vigente.
Hasta que eso se confirme, esta pantalla calcula pero no se puede enviar.

---

## 4. Cómo se entra: IRIA

El envío se hace por **IRIA**, el sistema de cumplimentación por internet del INE
(`https://iria.ine.es` — la propia portada del cuestionario lo dice en el lateral).
La metodología admite tres vías: cuestionario en papel, fichero XML, o IRIA en
pantalla. Nosotros usamos IRIA.

Las credenciales van **asociadas al establecimiento**, no a una persona, y llegan
en la carta/cuestionario que el INE manda. No son el certificado digital ni las
credenciales de SES.HOSPEDAJES: son otras.

Pasos, resumidos (los mismos que salen en la pantalla):

1. Entrar en `iria.ine.es` con usuario y contraseña del establecimiento.
2. Elegir la encuesta de turismo rural y el mes de referencia.
3. **Apdo 1** – identificación: solo se toca si ha cambiado algo (nombre,
   dirección, plazas, temporadas de apertura).
4. **Apdo 2** – días abiertos.
5. **Apdo 3** – tipo «dividido en unidades de alojamiento», 4 alojamientos
   independientes; modalidad **3.2 uso completo**.
6. **Apdo 4.2** – total mensual de alojamientos ocupados. El **4.1 se deja vacío**
   (no alquilamos por habitaciones).
7. **Apdo 5** – personal ocupado. **A mano.**
8. **Apdo 6** – casilla por casilla.
9. **Apdo 6.1** – pernoctaciones de viernes y sábado.
10. **Apdo 7.2** – precios sin IVA.
11. Grabar, enviar y **guardar el justificante**.

---

## 5. Qué pide exactamente el cuestionario

Modelo **EOTR-21**. Estas son todas sus casillas:

| Apdo | Qué pide | ¿Sale del sistema? |
|---|---|---|
| 1 | Identificación (solo modificaciones): nombre, NIF, dirección, habitaciones, plazas, tipo, categoría, teléfono, temporadas de apertura | No hace falta salvo cambio |
| 2 | **Días abiertos** en el mes (días en que *sería posible alojarse*, haya habido o no ocupación) | ✅ |
| 3 | Tipo de establecimiento (vivienda única / dividido en unidades → nº de alojamientos independientes) y modalidad de alquiler (3.1 por habitaciones · 3.2 uso completo · 3.3 ambas) | ✅ fijo: dividido, 4, uso completo |
| 4.1 | Nº total mensual de **habitaciones ocupadas** (suma diaria) | — no aplica |
| 4.2 | Nº total mensual de **alojamientos independientes ocupados** (suma diaria) | ✅ con salvedad (§6) |
| 4.3 | **Plazas supletorias** utilizadas | ❌ **a mano** |
| 5 | **Personal ocupado**: no remunerado · remunerado fijo · remunerado eventual | ❌ **a mano** |
| 6 | **Entrada de viajeros y pernoctaciones por lugar de residencia** | ✅ con salvedad (§6) |
| 6.1 | Pernoctaciones **en fin de semana** (viernes y/o sábado) | ✅ |
| 7.1 | Precios por habitación doble (normal dom–jue / fin de semana / otras) y % de habitaciones ocupadas | — no aplica |
| 7.2 | Precios de la **vivienda completa** por día, **sin IVA** (normal dom–jue / fin de semana / otras tarifas >1 mes) y % de alojamientos ocupados por cada tarifa | ✅ parcial |

### El apartado 6 NO va por provincia

**Corrección importante.** El apartado 6 tiene **32 casillas cerradas**, no texto
libre:

- **España — 19 casillas por Comunidad o Ciudad Autónoma**, no por provincia:
  1.1 Andalucía · 1.2 Aragón · 1.3 Asturias, Principado de · 1.4 Balears, Illes ·
  1.5 Canarias · 1.6 Cantabria · 1.7 Castilla y León · 1.8 Castilla-La Mancha ·
  1.9 Cataluña · 1.10 Comunitat Valenciana · 1.11 Extremadura · 1.12 Galicia ·
  1.13 Madrid, Comunidad de · 1.14 Murcia, Región de · 1.15 Navarra, Comunidad
  Foral de · 1.16 País Vasco · 1.17 Rioja, La · 1.18 Ceuta · 1.19 Melilla.

  La metodología lo confirma (5.3): *«En el caso de los residentes en España se
  solicita información sobre la Comunidad o Ciudad Autónoma de procedencia»*.

- **Extranjero — 13 casillas**, tampoco país libre:
  2 Alemania · 3 Bélgica · 4 Francia · 5 Italia · 6 Países Bajos · 7 Portugal ·
  8 Resto de la UE · 9 Reino Unido · 10 Rusia · 11 Suiza · 12 Resto de Europa ·
  13 Estados Unidos · 14 Resto del mundo.

  «Resto de la UE» está definido literalmente en la nota al pie del cuestionario:
  Austria, Bulgaria, Chipre, Croacia, Dinamarca, Eslovaquia, Eslovenia, Estonia,
  Finlandia, Grecia, Hungría, Irlanda, Letonia, Lituania, Luxemburgo, Malta,
  Polonia, República Checa, Rumanía y Suecia.

Y es **residencia**, no nacionalidad. Se saca del **domicilio del parte de
viajeros** (`traveler_records.direccion_pais` + `direccion_cp`), nunca de
`nacionalidad`: un francés que vive en Sevilla es «1.1 Andalucía».

---

## 6. Qué calcula el sistema y con qué criterio

Todo está en `supabase/migrations/_pendiente_ine.sql`:

| Función | Qué devuelve |
|---|---|
| `v_ine_mes(año, mes)` | 1 fila: las casillas de establecimiento (apdos 2, 3, 4, 6 totales, 6.1, 7.2) + indicadores de control |
| `v_ine_mes_residencia(año, mes)` | 33 filas: las 32 casillas del apdo 6 en su orden + «Sin determinar» |
| `v_ine_mes_detalle(año, mes)` | Reserva a reserva y bloqueo a bloqueo, para comprobar el número a mano |

Fuente: `guest_bookings` con `status` en `confirmed`/`completed`,
`traveler_records`, `apartments` (activos) y `blocked_dates`.

**Las reservas de prueba quedan fuera.** El plan (§7) manda marcar las pruebas
con `source='test'`, y las tres funciones las excluyen
(`AND COALESCE(gb.source,'') <> 'test'`). No es teórico: el 10-sep-2026, mientras
se escribía esto, otra sesión insertó `TJM-PRUEB1` («Carmen Prueba Facturas»,
Albahaca, 25–27 sep, 2 personas) para probar las facturas. Sin ese filtro se
habrían declarado al INE 2 viajeros y 4 pernoctaciones inventados. Si algún día
aparece otra convención de prueba, hay que añadirla aquí.

### 6.1 El solape de mes — el criterio, explicado

Es la parte que más fácil se hace mal. Las definiciones del INE (metodología 5.3
y 5.4, y el ejemplo del apdo 6) dicen dos cosas **distintas**:

- **Viajero entrado** = *«toda persona que llega y se aloja»*, y se anotan *«todas
  las personas que han entrado a lo largo del mes de referencia»*.
  → Se cuenta **una sola vez, en el mes del check-in**.
- **Pernoctación** = *«cada noche que un viajero se aloja»*.
  → Se cuenta **noche a noche**, en el mes en el que cae cada noche.

Ejemplo real, una estancia de **3 personas del 28 de septiembre al 3 de octubre**:

| | Septiembre | Octubre |
|---|---|---|
| Viajeros entrados | **3** | **0** |
| Noches dentro del mes | 3 (28, 29, 30) | 2 (1, 2) |
| Pernoctaciones | **9** | **6** |

Consecuencia buscada: **en octubre hay pernoctaciones con cero viajeros
entrados**. Eso es correcto, no es un error del cálculo. Quien "arregle" ese cero
estará declarando de más.

Convenios del esquema TJM, verificados contra `check_availability` y
`sync-ical-imports`:

- `guest_bookings.check_out` es **exclusivo** → noches = `[check_in, check_out-1]`.
- `blocked_dates.end_date` es **inclusivo** → noches = `[start_date, end_date]`.

### 6.2 Días abiertos (apdo 2)

El cuestionario define el apdo 2 como *«nº de días que sería posible alojarse en
su establecimiento, haya tenido o no plazas ocupadas»*. Por tanto:

- Un día **solo cuenta como cerrado si están cerrados los 4 apartamentos a la
  vez** por un cierre del establecimiento (`blocked_dates` con `source='cierre'`
  o `reason` que empieza por «cierre»).
- Que un apartamento esté **ocupado** no cierra el establecimiento.
- Que un apartamento esté bloqueado a mano (p. ej. «Vacaciones familiares») **no
  cierra el establecimiento** mientras los otros tres se puedan alquilar.

Hoy no existe ningún `blocked_dates` con `source='cierre'` — vendrá con el
paquete P1.2 («Cerrar ventas»). Hasta entonces, días abiertos = días del mes.

### 6.3 Reparto de personas dentro de una reserva

- Cada `traveler_records` del precheckin aporta **1 viajero** con su residencia.
- Si la reserva tiene **menos partes que `pax_count`**, las personas que faltan
  van a **«Sin determinar»**. No se reparten por proximidad ni se les asigna la
  provincia del titular: se dejan a la vista.
- Las pernoctaciones de cada persona = nº de noches **de esa reserva** que caen
  dentro del mes.

### 6.4 Indicadores de control (no son casillas)

El INE calcula los grados de ocupación por su cuenta; nosotros los sacamos solo
para detectar disparates antes de enviar. Fórmulas de la metodología:

- **Grado de ocupación por plazas** (5.7) = pernoctaciones / (plazas × días) × 100.
  Usamos **días abiertos** como denominador porque medimos un establecimiento,
  no el agregado provincial.
- **Grado de ocupación por alojamientos** = alojamientos-noche ocupados /
  (4 alojamientos × días abiertos) × 100.
- **Estancia media** (5.5) = pernoctaciones / viajeros.

---

## 7. Recordatorio automático

**Aplicado con el SQL** (es una fila de datos, idempotente): una tarea recurrente
en `internal_tasks`:

- `title`: «Enviar la encuesta del INE (turismo rural) del mes anterior»
- `recurrence`: `monthly` · `category`: `legal` · `priority`: `high`
- `scheduled_date`: día 1 del mes siguiente · `auto_reschedule`: `true`

Se ve en el panel → **Calendario de mantenimiento** (`InternalTasksManager`), que
ya sabe pintar y reprogramar tareas mensuales. No hace falta cron nuevo para que
el aviso exista.

**Propuesto y NO aplicado** (va con F6/P6.1, cuando exista el canal de avisos):
un `cron.schedule('monthly-ine-reminder', '0 9 1 * *', …)` que empuje el aviso a
Slack/WhatsApp, o —más barato— añadir un bloque «INE de \<mes\>» al
`monthly-owner-report` que ya se envía. Está escrito y comentado al final del
SQL.

Aviso aprendido en otros proyectos: **un cron en verde no prueba que el aviso
llegue**. Si se monta, que la función falle ruidosamente cuando el POST no sea
2xx, y que se vigile la frescura del último aviso, no que el proceso corra.

---

## 8. Qué NO sale del sistema

Esto es lo que hay que poner a mano, y la pantalla lo dice en amarillo cada mes:

1. **Apdo 5 — Personal ocupado.** El sistema no lleva nóminas ni horas. Hay que
   poner personal no remunerado, remunerado fijo y remunerado eventual.
2. **Apdo 4.3 — Plazas supletorias.** No se registran camas supletorias ni cunas
   en ninguna tabla. Si se han usado, se suman a mano.
3. **Las estancias de Airbnb.** ⚠️ **Este es el hueco gordo.** El iCal de Airbnb
   entra como **bloqueo mudo** en `blocked_dates`: ocupa el apartamento pero
   llega **sin nombre, sin nº de personas y sin domicilio**. Resultado:
   - cuentan en el apdo **4.2** (alojamientos ocupados),
   - y **no** cuentan en el apdo **6** (viajeros ni pernoctaciones).

   Enviado tal cual, el INE ve apartamentos ocupados con cero personas
   durmiendo. En **septiembre de 2026 son 56 noches de apartamento**; en octubre,
   111. Mientras esto siga así, cada mes hay que abrir Airbnb, mirar cuántas
   personas eran y de dónde, y sumarlas al apartado 6 a mano.

   Lo arregla de raíz el paquete **P2.1** (que el importador cree una *reserva*
   con nombre cuando el evento lo traiga) y, para Airbnb en concreto, activar en
   su panel que el iCal incluya los datos del huésped, o dar de alta esas
   reservas a mano.
4. **La fila «Sin determinar».** No existe en el cuestionario. Sale cuando una
   reserva no tiene parte de viajeros relleno. Hay que repartirla entre las
   casillas reales antes de enviar. Con `traveler_records` vacía (hoy: 0 filas),
   **todos** los viajeros caen ahí.
5. **Precios (7.2) sin reservas propias.** Si un mes solo tuvo estancias de canal,
   no hay precio aplicado que promediar y las casillas vienen vacías: se pone la
   tarifa de catálogo.
6. **El usuario de IRIA.** Pendiente de F0.

---

## 9. Comprobación hecha el 10-sep-2026

Contra la base de producción (`nmtukksbzbnuzqsksdmw`), con los datos reales:

**Julio 2026** — 1 reserva confirmada (Romero, 20→22 jul, 2 personas, 260 €):

| Casilla | Calculado | A mano |
|---|---|---|
| Apdo 2 · días abiertos | 31 | 31 (sin cierres) ✔ |
| Apdo 3 · alojamientos | 4 | 4 ✔ |
| Apdo 4.2 · alojamientos ocupados | 2 | noches 20 y 21 × 1 apartamento = 2 ✔ |
| Apdo 6 · viajeros | 2 | check-in en julio, 2 personas ✔ |
| Apdo 6 · pernoctaciones | 4 | 2 personas × 2 noches ✔ |
| Apdo 6.1 · fin de semana | 0 | 20-jul lunes, 21-jul martes ✔ |
| Apdo 7.2 · precio normal | 130 € | 260 / 2 noches ✔ |
| Estancia media | 2,00 | 4 / 2 ✔ |
| Ocupación por plazas | 1,08 % | 4 / (12 × 31) ✔ |

**Solape de mes** (estancia sintética, 3 personas, 28-sep → 3-oct):
septiembre 3 viajeros y 9 pernoctaciones (noches 28, 29, 30); octubre 0 viajeros
y 6 pernoctaciones (noches 1, 2). ✔

**Bloqueos de canal**: septiembre 2026 = **56** noches de apartamento de Airbnb,
octubre = **111**, contadas a mano bloque a bloque. El bloqueo manual del 14-oct
(«Vacaciones familiares») queda **fuera**, como debe. ✔

**Reserva de prueba**: con `TJM-PRUEB1` (`source='test'`) en la base, septiembre
sale **0 viajeros y 0 pernoctaciones** frente a **56 noches de alojamiento
ocupadas por Airbnb**. Es el retrato exacto del hueco del §8.3: el mes está lleno
y el apartado 6 está vacío. Septiembre de 2026 **no se puede enviar** sin sacar
antes de Airbnb quién durmió y de dónde venía. ✔

---

## Fuentes

- [Cuestionario Mod. EOTR-21 (PDF)](https://www.ine.es/daco/daco42/ocuptr/eotr_21.pdf)
- [Metodología EOTR, año 2025 (PDF)](https://www.ine.es/daco/daco42/ocuptr/meto_eotr.pdf)
- [INEbase — Alojamientos de turismo rural: encuesta de ocupación e índice de precios](https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176963&menu=metodologia&idp=1254735576863)
- [Informe metodológico estandarizado (oe=30238)](https://ine.es/dynt3/metadatos/es/RespuestaDatos.htm?oe=30238)
- IRIA (cumplimentación por internet): `https://iria.ine.es`
