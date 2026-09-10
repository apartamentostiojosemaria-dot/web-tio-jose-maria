# Check-in legal — qué exige la ley, qué nos falta y cómo debería hacerse

> **Alojamiento**: Apartamentos Rurales Tío José María · Calle Baja 1, 23486 Hinojares (Jaén).
> 4 apartamentos (2+4+4+2 plazas) · Registro turístico **VTAR/JA/00044** · Titular persona física.
> **Estudio cerrado el 10 de septiembre de 2026.** Todas las fuentes se consultaron ese día.
>
> Marcas usadas en todo el documento:
> ✅ verificado en fuente oficial (BOE, BOJA, AEPD, Ministerio del Interior) ·
> 🟡 verificado pero con matiz, o pendiente de confirmar contra el XSD real ·
> ⚠️ incierto: **no** se ha podido confirmar en fuente oficial y no debe darse por bueno.

---

## 0. En dos párrafos

Desde el **2 de diciembre de 2024** el check-in de este alojamiento ya no es «apuntar el DNI en una
hoja». Son **dos comunicaciones telemáticas distintas** al Ministerio del Interior por cada reserva
—una **al reservar** y otra **al entrar**—, más un **registro documental propio** que hay que
conservar **tres años**, más un **parte firmado** por cada persona mayor de catorce años. Lo que casi
ningún alojamiento tiene es la parte de **datos del pago**, que el anexo del real decreto exige y
prácticamente nadie recoge.

Hoy Tío José María **no manda nada**: el alojamiento no está dado de alta en SES Hospedajes, así que
no hay credenciales y el sistema trabaja en «modo preparado». Todo lo demás que se detalla aquí es
secundario frente a eso.

---

# PARTE 1 — Qué exige la ley hoy

## 1.1 La norma que manda y en qué casilla cae este alojamiento

**Norma principal**: Real Decreto 933/2021, de 26 de octubre, por el que se establecen las
obligaciones de registro documental e información de las personas físicas o jurídicas que ejercen
actividades de hospedaje y alquiler de vehículos a motor.
✅ [BOE-A-2021-17461, texto consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2021-17461)

- **Ámbito** (art. 3): «será de aplicación **en todo el territorio nacional** a las actividades de
  hospedaje […] **sea cual fuere la modalidad, la personalidad del titular o el modelo de
  organización**». No hay exención por ser persona física, ni por ser rural, ni por ser pequeño. ✅
- **Título competencial** (disp. final 1.ª): art. 149.1.29.ª CE, **seguridad pública**, competencia
  exclusiva del Estado. Por eso Andalucía no puede quitar ni añadir campos al parte. ✅
- **Entrada en vigor**: a los seis meses de su publicación; las obligaciones de comunicación
  «producirán efectos a partir del 2 de enero de 2023» (disp. final 3.ª), fecha prorrogada
  administrativamente hasta la exigibilidad efectiva del **2 de diciembre de 2024**.
  ✅ el texto de la disp. final 3.ª · 🟡 la fecha del 2-dic-2024 procede de la implantación de SES
  Hospedajes, no del propio real decreto.

**¿Ejercicio profesional o no profesional?** El anexo I tiene dos apartados y la diferencia importa
mucho:

| | Apartado A) profesional | Apartado B) no profesional |
|---|---|---|
| Registro documental propio | **Sí** (art. 5.1 y 5.2) | **Exento** (art. 5.4) |
| Conservar 3 años | **Sí** | Exento |
| Comunicar | Sí, **telemáticamente** (art. 6.4) | Sí, y puede ser por medios no telemáticos |
| Nº de soporte del documento | **Sí** (A.3.f) | No aparece en la lista |
| Datos del inmueble | Dentro de la transacción (A.4.c) | Bloque propio (B.2) |

**Tío José María es apartado A), ejercicio profesional.** Está inscrito en el Registro de Turismo de
Andalucía con número VTAR/JA/00044, se anuncia en cinco canales, cobra precio y opera los cuatro
apartamentos de forma habitual. Todo lo que sigue usa el **apartado A)**. ✅ (calificación jurídica
propia a partir del art. 5.4; el RD no define «no profesional», lo cual es 🟡 — pero ninguna lectura
razonable deja fuera a un VTAR registrado con cuatro unidades y cinco canales de venta).

---

## 1.2 Lista literal y completa de los campos obligatorios (anexo I, apartado A)

Reproducida del anexo I del RD 933/2021 tal y como aparece en el BOE. ✅

### Grupo 1 — Datos de la empresa arrendadora
*(comunicación **previa** al inicio de la actividad, art. 6.1)*

| # | Campo |
|---|---|
| a | Nombre o razón social del titular |
| b | CIF o NIF |
| c | Municipio |
| d | Provincia |
| e | Teléfono fijo y/o móvil |
| f | Dirección de correo electrónico |
| g | Web de la empresa |
| h | **Url para identificar el anuncio** |

> **Ojo con la letra h.** Este alojamiento se anuncia en **web propia, Booking, Airbnb, Escapada
> Rural y CasasRurales.net**. Y el art. 6.1 in fine dice: «**La modificación de cualquiera de los
> datos señalados dará lugar a la obligación de una nueva comunicación**». Es decir: dar de baja un
> anuncio, abrir uno nuevo o cambiar la URL obliga a volver a comunicar. ✅

### Grupo 2 — Datos del establecimiento
*(también comunicación **previa**, art. 6.1)*

| # | Campo |
|---|---|
| a | Tipo de establecimiento |
| b | Denominación |
| c | Dirección completa |
| d | Código postal |
| e | Localidad y provincia |

> **«Tipo de establecimiento» no admite «VTAR».** El catálogo del Ministerio (tabla 8.6 de las
> *Instrucciones para el alta masiva de comunicaciones*, v1.1.0) contiene: ALBERGUE, APART,
> APARTHOTEL, **AP_RURAL** (apartamento rural), BALNEARIO, CAMPING, CASA_HUESP, CASA_RURAL, HOSTAL,
> HOTEL, H_RURAL, MOTEL, OFIC_VEHIC, OTROS, PARADOR, PENSION, RESIDENCIA. Para este caso el valor
> correcto es **`AP_RURAL`**. ✅
> [Instrucciones del MIR](https://hospedajes.ses.mir.es/hospedajes-sede/assets/docs/Instrucciones.pdf)

### Grupo 3 — Datos de los viajeros
*(comunicación en **24 h**, art. 6.3)*

| # | Campo |
|---|---|
| a | Nombre |
| b | Primer apellido |
| c | Segundo apellido |
| d | Sexo |
| e | Número de documento de identidad |
| f | **Número de soporte del documento** |
| g | Tipo de documento (DNI, pasaporte, TIE) |
| h | Nacionalidad |
| i | Fecha de nacimiento |
| j | Lugar de residencia habitual: **dirección completa · localidad · país** |
| k | Teléfono fijo |
| l | Teléfono móvil |
| m | Correo electrónico |
| n | Número de viajeros |
| o | Relación de parentesco entre los viajeros *(en el caso de que alguno sea menor de edad)* |

### Grupo 4 — Datos de la transacción
*(comunicación en **24 h**, art. 6.3)*

**4.a — Datos del contrato**
- Número de referencia
- Fecha
- **Firmas**

**4.b — Datos de la ejecución del contrato**
- **Fecha y hora de entrada**
- **Fecha y hora de salida**

**4.c — Datos del inmueble**
- Dirección completa
- **Número de habitaciones**
- Conexión a Internet (sí/no)

**4.d — Datos del pago** ← *la parte que casi nadie tiene*
- **Tipo** (efectivo, tarjeta de crédito, plataforma de pago, transferencia…)
- **Identificación del medio de pago**: tipo de tarjeta y número, IBAN cuenta bancaria, solución de
  pago por móvil, otros
- **Titular del medio de pago**
- **Fecha de caducidad de la tarjeta**
- **Fecha del pago**

### ¿Son obligatorios siempre? La respuesta tiene dos capas

**Capa 1 — el real decreto.** El art. 5.2 acota la obligación de registro a «aquellos datos de sus
usuarios, comprendidos en los anexos I y II, **que recaben en el ejercicio de su actividad**». O sea:
se registra lo que se recaba. Si un pago lo cobra íntegramente Booking y el alojamiento nunca ve un
número de tarjeta, no hay obligación de inventárselo. Lo que **sí** se recaba siempre y por tanto
**sí** hay que registrar es: **tipo de pago, titular del medio de pago y fecha del pago**; y en las
transferencias, además, el **IBAN**, que es literalmente uno de los ejemplos que pone el anexo. ✅

**Capa 2 — lo que la plataforma del Ministerio exige de verdad.** El bloque `pago` es de envío
obligatorio, pero dentro sólo un campo lo es:

| Campo del servicio | Tipo | ¿Obligatorio? |
|---|---|---|
| `tipoPago` | String(5) | **Sí** |
| `fechaPago` | Fecha | No |
| `medioPago` — *identificación del medio: tipo de tarjeta y número, IBAN…* | String(50) | No |
| `titular` — *nombre y apellidos del titular del pago* | String(100) | No |
| `caducidadTarjeta` — *sólo en pago con tarjeta* | String(7) | No |

✅ *Instrucciones del MIR*, §7.2 «Bloque pago».

**Conclusión práctica**: el parte **no se rechaza** por no llevar los cuatro campos opcionales, pero
el **registro documental propio** sí queda incompleto frente al art. 5, y eso es lo que mira una
inspección. Los datos de pago son obligatorios **en el registro**, opcionales **en el envío**.

Códigos válidos de `tipoPago` (tabla 8.7): `EFECT` efectivo · `TARJT` tarjeta de crédito ·
`PLATF` plataforma de pago · `TRANS` transferencia · `MOVIL` pago por móvil · `TREG` tarjeta regalo ·
`DESTI` pago en destino · `OTRO`. ✅

---

## 1.3 Plazos: cuándo se recoge, cuándo se comunica, cuánto se guarda

### Son DOS comunicaciones por reserva, no una

El art. 6.3 dice, literal: los datos de los incisos 3 y 4 del apartado A) se transmiten «de manera
inmediata, y en todo caso **en un plazo no superior a 24 horas**, respectivamente, a partir de los
siguientes momentos: **a)** Al realizar la reserva o la formalización del contrato o, en su caso,
**su anulación**. **b)** Al **inicio** de los servicios contratados». ✅

| Momento | Qué se comunica | Plazo |
|---|---|---|
| **Al reservar** (y al anular) | «Reserva de hospedaje»: establecimiento + contrato + pago + titular del contrato | 24 h desde la reserva |
| **Al entrar** | «Parte de viajeros»: contrato + pago + **todas** las personas alojadas | 24 h desde el inicio del alojamiento |

Son dos plantillas distintas en SES Hospedajes: la sección 4 de las *Instrucciones* es «Reservas de
hospedaje» y la sección 3 es el parte de viajeros. ✅ En la reserva, además, es **obligatorio** un
bloque `persona` con **`rol` = `TI` (titular del contrato)**; en el parte de viajeros es obligatorio
al menos un bloque con **`rol` = `VI` (viajero)**. ✅

### Comunicación previa, antes de abrir

Art. 6.1 y 6.2: los datos de los grupos 1 y 2 se comunican **antes del inicio de la actividad**, y
como muy tarde «**antes del transcurso de diez días** desde el cumplimentado de los trámites
administrativos exigibles […] y, en cualquier caso, con anterioridad al ejercicio efectivo de esta».
✅ Esto es el **alta en SES Hospedajes**, y es lo que aquí falta.

### Estancias que empiezan de madrugada

El plazo cuenta desde «el inicio de los servicios contratados», no desde una hora de oficina. Una
entrada a la 01:00 del día D tiene su tope a la 01:00 del día D+1. Con check-in real entre las 16:00
y las 20:00, un envío automático a la mañana siguiente **siempre** cae dentro de plazo. ✅

### Conservación

Art. 5.3: «Los datos del registro informático deberán conservarse durante un plazo de **tres años** a
contar desde la **finalización del servicio** o prestación contratada». ✅
Es un plazo de conservación **obligatoria**, no un máximo optativo: antes de tres años no se pueden
borrar; pasados los tres años **hay que borrarlos**, porque la base legal que los justificaba se ha
agotado.

Para el parte firmado, en papel o digital, la Orden INT/1922/2003 (apartado segundo.5, vigente en lo
que no contradiga al RD) fija los mismos tres años, contados «desde la fecha de la última de las
hojas registro que los integran, o, en su caso, desde la fecha de grabación de la información cuando
se conserve por medios digitales». ✅
[BOE-A-2003-13865, consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2003-13865)

---

## 1.4 A quién hay que registrar, y qué pasa exactamente con los menores

Aquí es donde circulan las versiones contradictorias. La del BOE es esta, y son **dos umbrales
distintos** que la gente mezcla:

**Se registra a TODOS los que se alojan, sin excepción de edad.** Art. 5.1: el registro informático
contendrá los datos del anexo I «**incluidos, en su caso, los datos de las personas menores de
catorce años**». ✅ No hay edad mínima para *estar* en el registro. Un bebé de tres meses va en el
parte.

**Umbral 1 — los 14 años: la FIRMA.** Art. 4.2: «Los partes de entrada […] deberán ser firmados por
**toda persona mayor de catorce años** que haga uso de los mismos […]. En el caso de las personas
**menores de catorce años**, sus datos serán proporcionados por la **persona mayor de edad de la que
vayan acompañados**». ✅

> El número que circula por ahí de «16 años» viene del art. 2 del Decreto 1513/1959, que es el
> antecedente histórico citado en el preámbulo de la Orden INT/1922/2003. Está **superado**: el
> RD 933/2021 es posterior y de rango superior. **Manda 14.** ✅

**Umbral 2 — los 18 años: el DOCUMENTO y el PARENTESCO.**
- El anexo I A.3.o pide la relación de parentesco «en el caso de que alguno sea **menor de edad**»,
  es decir menor de 18. ✅
- El servicio del Ministerio marca `tipoDocumento` y `documento` como «**Obligatorio si la persona es
  mayor de edad**». ✅ Un menor de 18 sin documento propio se comunica **sin bloque de documento**,
  no con el documento de sus padres.

**¿Y qué documento del adulto responsable se anota?** Ninguno *en la ficha del menor*. Lo que exige
el Ministerio es distinto y es un matiz que cuesta ver:

> «Si alguna de las personas es menor de edad, **al menos una de las personas mayores de edad ha de
> tener informada su relación de parentesco** con esta persona menor de edad (padre, madre,
> abuelo/a, hermano/a…)». ✅ *Instrucciones del MIR*, campo `parentesco`.

O sea: **el campo `parentesco` se rellena en la ficha del ADULTO**, diciendo qué es él del menor. No
en la ficha del menor. El adulto ya lleva su propio documento porque es mayor de edad, y esa es la
vía por la que el menor queda enlazado a un adulto identificado.

Códigos de parentesco admitidos (tabla 8.3): `AB` abuelo/a · `BA` bisabuelo/a · `BN` bisnieto/a ·
`CD` cuñado/a · `CY` cónyuge · `HJ` hijo/a · `HR` hermano/a · `NI` nieto/a · `PM` padre o madre ·
`SB` sobrino/a · `SG` suegro/a · `TI` tío/a · `YN` yerno o nuera · `TU` tutor/a · `OT` otro. ✅

---

## 1.5 Documentos admitidos y qué se anota de cada uno

**Lo que dice el anexo I** (A.3.g): «Tipo de documento (**DNI, pasaporte, TIE**)». ✅

**Lo que admite el catálogo del Ministerio** (tabla 8.5): `NIF` · `NIE` · `PAS` · `OTRO`. ✅

**Lo que admite el modelo de parte en papel** de la Orden INT/1922/2003, que sigue vigente en lo que
no contradiga al RD y sirve de guía para saber qué documento se puede aceptar en mostrador: ✅

- **Españoles**: DNI, pasaporte **o permiso de conducir**.
- **Extranjeros**: pasaporte; carta o documento de identidad para ciudadanos de la UE, Andorra,
  Islandia, Suiza, Noruega, Malta, Mónaco y San Marino; permiso de residencia español en vigor para
  extranjeros residentes en España.

En el sistema del Ministerio, el permiso de conducir y el documento de identidad de otro país van
como `OTRO`.

**El número de soporte.** Es el código impreso en el DNI español (`IDESP`, formato tipo `ABC123456`,
en el anverso, bajo la fecha de validez) o en la TIE. El anexo I lo lista como campo propio (A.3.f) y
el Ministerio lo marca como «**Obligatorio si el tipo de documento es NIF, NIE**». ✅ Con pasaporte
extranjero **no** se pide.

Otra regla del Ministerio que conviene tener clara porque afecta a la validación:
**`apellido2` es obligatorio sólo si el tipo de documento es `NIF`**, no si es `NIE`. ✅ Exigir dos
apellidos a un titular de NIE es más estricto de lo que pide la norma y bloquea a extranjeros
residentes con un solo apellido.

---

## 1.6 ¿Hay que firmar algo? ¿Sigue existiendo la hoja-registro?

**Sí, sigue existiendo, y sí, hay que firmar.** El RD 933/2021 **no** sustituyó el parte de entrada:
lo mantiene expresamente y le añade encima la comunicación telemática.

- **RD 933/2021, art. 4.2**: los partes de entrada «deberán ser firmados por toda persona mayor de
  catorce años». ✅
- **RD 933/2021, art. 4.3**: «Los partes y hojas serán **proporcionados por el establecimiento**, los
  cuales serán **responsables de la exactitud de los datos** que se hagan constar en ellos, de modo
  que **coincidan con los documentos o sistemas que acrediten la identidad** de las personas, que
  habrán de ser **exhibidos o facilitados** por los usuarios». ✅ Es la base legal para **pedir que te
  enseñen el DNI** — exhibirlo, no entregarlo ni dejar que lo copies.
- **RD 933/2021, art. 5.1**: obligación de llevar un **registro informático**. ✅
- **Orden INT/1922/2003, apartado segundo**, en su redacción vigente tras la Orden INT/321/2021: ✅
  - «el viajero deberá firmar dicho parte de **manera inexcusable**, pudiendo recogerse la firma **en
    papel o en un soporte digital**» (2.2) — **la firma con el dedo en el móvil es válida**;
  - el impreso firmado «quedará en el establecimiento a efectos de confección de un **libro-registro
    en formato impreso o digital**» (2.3);
  - el libro-registro «estará **en todo momento a disposición** de los miembros de las Fuerzas y
    Cuerpos de Seguridad […] quedando los establecimientos obligados a **exhibirlo** cuando a ello
    sean requeridos» (2.4);
  - se conserva **tres años** (2.5).
- **Orden INT/1922/2003, apartado tercero.2**: usar el envío telemático «**no exime** de la
  obligación de cumplimentar el parte, de su firma por el alojado y de la confección del
  libro-registro correspondiente». ✅

> Traducción: **el envío a SES Hospedajes no sustituye al parte firmado.** Son dos cosas y hacen
> falta las dos. El libro-registro digital debe existir como archivo real, ordenado y exhibible, no
> como un PDF que se regenera si alguien lo pide.

**¿Hay que entregar copia al viajero?** **No.** Ninguna de las dos normas lo exige. La Orden
INT/1922/2003 sólo hablaba de dos copias cuando el envío era físico a comisaría, y la segunda copia
sellada volvía **al establecimiento** como acreditación, no al huésped. ✅
Lo que **sí** hay que darle es la **información de protección de datos** del art. 13 RGPD, antes de
que rellene nada. Entregarle además una copia de su propio parte es buena práctica y cortesía, pero
no es obligación.

---

## 1.7 Andalucía: qué añade y qué no

**Lo que NO añade:** ni Andalucía ni ninguna comunidad autónoma puede añadir campos al parte de
entrada ni cambiar sus plazos. Es competencia exclusiva del Estado (art. 149.1.29.ª CE, invocado por
la disp. final 1.ª del RD 933/2021). ✅ **No existe** un parte de entrada andaluz, ni un libro
registro de viajeros autonómico, ni un plazo distinto. Revisada la Ley 13/2011 del Turismo de
Andalucía, **no hay ninguna mención** a parte de entrada ni a libro registro de viajeros. ✅

**Lo que SÍ añade**, y aplica al momento del check-in porque es cuando se enseña y se entrega:

**a) Ley 13/2011, de 23 de diciembre, del Turismo de Andalucía — art. 24, obligaciones de las
empresas turísticas.** ✅ [BOE-A-2012-876](https://www.boe.es/buscar/act.php?id=BOE-A-2012-876)
Entre otras: publicitar **precios finales completos** con impuestos incluidos; **expedir factura**
desglosada; velar por la seguridad e intimidad de las personas usuarias; informar de riesgos
previsibles; **exhibir los distintivos** acreditativos de la clasificación del establecimiento;
**tener a disposición y facilitar las hojas de quejas y reclamaciones oficiales**.

**b) Decreto 20/2002, de 29 de enero, de Turismo en el Medio Rural y Turismo Activo.** ✅
[BOJA 2002/14](https://www.juntadeandalucia.es/boja/2002/14/1)
Es la norma específica de las VTAR y **sigue vigente** para esta figura; el Decreto 31/2024 regula
las viviendas de uso turístico, que son otra cosa. 🟡 (la vigencia se ha comprobado por su aplicación
práctica y por fuentes secundarias solventes, no por una disposición derogatoria expresa leída en el
BOJA).
- **Art. 19**: define la vivienda turística de alojamiento rural: vivienda de carácter independiente,
  ofertada temporalmente, que presta **únicamente el servicio de alojamiento**, con un máximo de
  **20 plazas** y no más de **3 viviendas en el mismo edificio**. Le son exigibles los requisitos
  mínimos del **anexo II** y las prescripciones del **anexo III, categoría básica** (casas rurales).
- **Título IV, capítulo I — disposiciones comunes**, aplicables a todos los establecimientos del
  decreto:
  - **Art. 35 «Distintivos y publicidad»**: exhibir **placa identificativa en el exterior** y hacer
    constar el **número de inscripción en el Registro de Turismo de Andalucía** en la publicidad.
    Para nosotros: **VTAR/JA/00044** debe aparecer en la web propia y en los anuncios de Booking,
    Airbnb, Escapada Rural y CasasRurales.net.
  - **Art. 36 «Obligaciones de los titulares»**: comunicar a las personas usuarias los **precios
    máximos y mínimos** y **entregar justificante del pago**.
  - **Art. 37 «Facturación y pago de los servicios turísticos»**.

**c) Decreto 82/2022, de 17 de mayo, hojas de quejas y reclamaciones** (en vigor desde el
**17 de junio de 2022**; sustituye la línea del Decreto 472/2019, que a su vez había sustituido al
Decreto 72/2008). ✅ [BOJA 2022/95](https://www.juntadeandalucia.es/boja/2022/95/42)
Obliga a **tener hojas de quejas y reclamaciones a disposición** de las personas usuarias y a
**anunciarlo con el cartel oficial** en sitio visible. 🟡 el detalle del régimen transitorio del
sistema electrónico no se ha podido abrir en la fuente oficial (la página del BOJA devolvió error de
conexión el 10-sep-2026); la obligación de tenerlas y anunciarlas sí está confirmada.

---

## 1.8 Sanciones

El RD 933/2021 **no tiene multas propias**: remite al capítulo V de la Ley Orgánica 4/2015, de 30 de
marzo, de protección de la seguridad ciudadana (art. 8). ✅

**Art. 8.2 — infracciones GRAVES** (por remisión al art. 36.20 LO 4/2015):
- a) La **carencia de los registros documentales** previstos en el real decreto.
- b) La **omisión de las comunicaciones obligatorias**.

**Art. 8.3 — infracciones LEVES** (por remisión al art. 37.9 LO 4/2015):
- a) Las **irregularidades o deficiencias** en la cumplimentación de los registros.
- b) La realización de las comunicaciones obligatorias **fuera del plazo** establecido.

**Art. 8.4**: «La responsabilidad por las infracciones cometidas recaerá **directamente en los
sujetos obligados**». Es decir, en el titular persona física. No se traslada al software ni a la
persona que atiende.

**Cuantías — art. 39.1 LO 4/2015** ✅
[BOE-A-2015-3442](https://www.boe.es/buscar/act.php?id=BOE-A-2015-3442)

| Calificación | Horquilla | Grados (art. 33.2) |
|---|---|---|
| **Grave** | **601 – 30.000 €** | mínimo 601–10.400 · medio 10.401–20.200 · máximo 20.201–30.000 |
| **Leve** | **100 – 600 €** | — |
| *(Muy grave, no aplicable aquí)* | 30.001 – 600.000 € | — |

Léase con calma la diferencia: **no comunicar** es **grave** (601–30.000 €). **Comunicar tarde** es
**leve** (100–600 €). Entre no mandar el parte y mandarlo con dos días de retraso hay un factor de
cincuenta.

---

## 1.9 RGPD: base legal, documentos de identidad, conservación

### Base legal — no es consentimiento

El tratamiento de los datos del parte se ampara en el **art. 6.1.c) RGPD, cumplimiento de una
obligación legal** aplicable al responsable: el propio RD 933/2021. ✅

Consecuencias prácticas, y no son menores:
- **No se pide consentimiento** para el parte. Pedirlo sería engañoso, porque el huésped no puede
  decir que no: si no da los datos, no puede alojarse.
- **No cabe oponerse ni pedir la supresión** de estos datos antes de los tres años (art. 17.3.b
  RGPD): la conservación es obligatoria.
- **Sí hay que informar** (art. 13 RGPD) antes de recoger nada: quién es el responsable, para qué,
  con qué base legal, a quién se comunica (Secretaría de Estado de Seguridad), cuánto se conserva y
  qué derechos hay.
- El destino de los datos está en el **art. 7 del RD 933/2021**: dos ficheros radicados en la
  Secretaría de Estado de Seguridad, tratados **únicamente** por las Fuerzas y Cuerpos de Seguridad
  para prevención, detección e investigación del delito, con acceso de la autoridad judicial y el
  Ministerio Fiscal, y regidos por la **Ley Orgánica 7/2021**. ✅

### ¿Se puede guardar foto o copia del DNI? **NO**

Esto está resuelto y con sanciones detrás. La AEPD publicó nota específica y nota de prensa
(**junio de 2025**): ✅
[Nota de la AEPD sobre el registro de hospedajes (PDF)](https://www.aepd.es/guias/nota-aepd-registro-hospedajes.pdf) ·
[Nota de prensa](https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-informa-de-que-no-esta-permitido-solicitar-copia-dni-o-pasaporte-en-hospedajes)

- «esta recogida de información **no autoriza a solicitar una copia del documento de identidad del
  cliente**, ya que esto **vulneraría el principio de minimización de datos**». ✅
- Motivo: el documento contiene **más datos de los que la norma pide** —fotografía, fecha de
  caducidad, número CAN, nombre de los progenitores— y su tratamiento **aumenta el riesgo de
  suplantación de identidad**. ✅
- **Prohibido igual**: fotocopiar, escanear, fotografiar o guardar imagen del DNI, NIE o pasaporte.
  Da lo mismo el soporte y da lo mismo que se borre luego. ✅
- **Lo que sí vale para verificar**:
  - **presencial**: **comprobación visual** de que los datos facilitados coinciden con el documento
    que el huésped **exhibe**; ✅
  - **a distancia**: certificado digital, verificación del medio de pago, o código de autenticación
    enviado por teléfono o correo. ✅
- La AEPD recomienda expresamente **dar un formulario —en papel o digital— que recoja sólo los datos
  obligatorios**, rellenado por el propio cliente, sin necesidad de entregar ni escanear el
  documento. ✅ Es exactamente el modelo del precheckin que ya tenemos.
- Hay **sanciones** por hacerlo: la AEPD ha multado establecimientos turísticos por recoger copias de
  documentos de identidad. 🟡 la cifra de 9.000 € que circula procede de prensa especializada; no se
  ha localizado la resolución concreta.

### Conservación y borrado

- **Tres años desde la finalización del servicio** (art. 5.3 RD 933/2021), y **borrado después**. ✅
- El borrado tiene que ser **automático y demostrable**. Un borrado que depende de que alguien se
  acuerde no es una medida, es una intención.

---

## 1.10 Lo que NO es obligatorio y se suele hacer de más

| Práctica | Veredicto | Por qué |
|---|---|---|
| **Fotocopia / foto / escaneo del DNI o pasaporte** | ❌ **Prohibido** | AEPD, junio 2025: vulnera minimización. Sancionable. |
| **Escaneo biométrico o reconocimiento facial** | ❌ **Prohibido** de facto | Datos de categoría especial (art. 9 RGPD); ninguna norma de hospedaje lo habilita. |
| **Quedarse el DNI durante la estancia** | ❌ **No** | El art. 4.3 RD 933/2021 dice «**exhibidos o facilitados**», para comprobar. No es una prenda. |
| **Fecha de expedición del documento** | ⭕ **No obligatorio** | Está en el modelo en papel de 2003, pero **no** en el anexo I del RD 933/2021, que es posterior. Y la AEPD lo cita entre los datos excesivos del documento. **No pedirlo.** |
| **Nombre de los progenitores, CAN del DNI, lugar de nacimiento** | ⭕ **No** | No están en el anexo I. Datos excesivos. |
| **Fianza en metálico o retención de tarjeta** | ⭕ **No obligatorio** | Ninguna norma la exige. Es **cláusula contractual**: sólo vale si se anunció antes de reservar y consta en las condiciones. Ni el RD 933/2021 ni el Decreto 20/2002 la contemplan. |
| **Exigir que el titular de la reserva sea quien paga** | ⭕ **No** | El anexo pide el titular del medio de pago, no que coincidan. |
| **Firma de todos los ocupantes** | ⭕ **No** | Sólo **mayores de 14 años** (art. 4.2). |
| **Documento de identidad de los menores de 18** | ⭕ **No** | El Ministerio lo pide sólo «si la persona es mayor de edad». |
| **Segundo apellido a titulares de NIE** | ⭕ **No** | Obligatorio sólo con `NIF`. |
| **Entregar copia del parte al huésped** | ⭕ **No obligatorio** | Ninguna norma lo exige. Cortesía, no deber. |

---

# PARTE 2 — Auditoría: qué tenemos, qué falta, qué sobra

Revisado el 10-sep-2026 sobre: tablas `traveler_records`, `guest_bookings` y `apartments` (Supabase
`nmtukksbzbnuzqsksdmw`), RPC `submit_traveler_records` y `prune_traveler_records`,
`supabase/functions/submit-ses-hospedajes/` (`config.ts`, `parte-modelo.ts`, `mir.ts`,
`hoja-registro.ts`, `index.ts`) y `src/pages/PrecheckinPage.jsx`.

## 2.1 Campo a campo contra el anexo I

### Grupo 1 — Empresa arrendadora

| Anexo I A.1 | Dónde está | Estado |
|---|---|---|
| a) Nombre o razón social | `config.ts` → `ESTABLECIMIENTO.titular` | ✅ |
| b) CIF o NIF | `ESTABLECIMIENTO.nif` | ✅ |
| c) Municipio | `ESTABLECIMIENTO.municipio` | ✅ |
| d) Provincia | dentro de `municipio` («Hinojares (Jaén)») | 🟡 no está como campo propio |
| e) Teléfono | `ESTABLECIMIENTO.telefono` | ✅ |
| f) Correo | `ESTABLECIMIENTO.email` | ✅ |
| g) Web | `ESTABLECIMIENTO.web` | ✅ |
| **h) URL del anuncio** | **en ningún sitio** | ❌ **FALTA** — y son cinco, y cambian |

### Grupo 2 — Establecimiento

| Anexo I A.2 | Dónde está | Estado |
|---|---|---|
| a) **Tipo de establecimiento** | `config.ts` → `TIPO_ESTABLECIMIENTO = "VTAR"` | ❌ **VALOR INVÁLIDO.** No existe en el catálogo del MIR: debe ser `AP_RURAL`. Además la constante **no se usa en ningún fichero**: está declarada y muerta. |
| b) Denominación | `ESTABLECIMIENTO.nombre` | ✅ |
| c) Dirección completa | `ESTABLECIMIENTO.direccion` | ✅ |
| d) Código postal | `ESTABLECIMIENTO.codigoPostal` | ✅ |
| e) Localidad y provincia | `municipio` + `codigoMunicipio` (INE 23044) | ✅ |

### Grupo 3 — Viajeros

| Anexo I A.3 | Columna | Formulario | XML | Estado |
|---|---|---|---|---|
| a) Nombre | `nombre` | sí | `nombre` | ✅ |
| b) Primer apellido | `apellido_primero` | sí | `apellido1` | ✅ |
| c) Segundo apellido | `apellido_segundo` | sí | `apellido2` | 🟡 se exige con NIF **y con NIE**; el MIR sólo lo exige con **NIF**. Sobra rigor: bloquea a extranjeros con un apellido. |
| d) Sexo | `sexo` | sí | `sexo` | ✅ (traduce `X` → `O`) |
| e) Nº de documento | `numero_documento` | sí | `numeroDocumento` | 🟡 el elemento del servicio puede llamarse `documento`, no `numeroDocumento`. **Verificar contra el XSD** antes del primer envío. |
| f) **Nº de soporte** | `soporte_documento` | sí | `soporteDocumento` | ✅ obligatorio con NIF/NIE, correctamente validado |
| g) Tipo de documento | `tipo_documento` | sí | `tipoDocumento` | ✅ traduce D/P/N/C/E/X → NIF/NIE/PAS/OTRO |
| h) Nacionalidad | `nacionalidad` | sí, ISO-3 | `nacionalidad` | ✅ |
| i) Fecha de nacimiento | `fecha_nacimiento` | sí | `fechaNacimiento` | ✅ |
| j) Residencia habitual | `direccion_via`, `direccion_municipio`, `direccion_cp`, `direccion_pais` | sí | bloque `direccion` | ✅ |
| k) Teléfono fijo | `telefono_fijo` | sí | `telefono2` | ✅ |
| l) Teléfono móvil | `telefono_movil` | sí | `telefono` | ✅ |
| m) Correo | `email` | sí | `correo` | ✅ |
| n) Nº de viajeros | `guest_bookings.pax_count` | — | `numPersonas` | ✅ |
| o) **Parentesco (si hay menor)** | `parentesco` | sí | `parentesco` | ❌ **EN LA PERSONA EQUIVOCADA** (ver abajo) |

**El fallo del parentesco, explicado.** `parte-modelo.ts` define
`necesitaParentesco = (edad) => edad < 18` y `pegasDelParte()` exige el parentesco **en la ficha del
menor**; `mir.ts` lo emite dentro del `<persona>` del menor. El Ministerio exige lo contrario:
«al menos una de las personas **mayores de edad** ha de tener informada su relación de parentesco con
esta persona menor de edad». El texto que ve el huésped en el formulario («Soy su padre o su madre»)
está redactado desde el punto de vista del adulto, pero se **guarda en la fila del niño**. Hay que
darle la vuelta: preguntarlo igual, guardarlo en la fila del adulto responsable. 🟡 conviene
confirmarlo contra el XSD real antes de tocar nada, pero las instrucciones del MIR son inequívocas.

Y un detalle menor del mismo bloque: el formulario ofrece **cuatro** parentescos (padre/madre,
abuelo/a, tutor/a, otro) cuando la base ya admite los quince del catálogo. **Falta el más frecuente
de todos: hermano/a (`HR`).**

### Grupo 4 — Transacción

| Anexo I A.4 | Dónde está | Estado |
|---|---|---|
| **a) Contrato — nº de referencia** | `guest_bookings.booking_code` → `<referencia>` | ✅ |
| **a) Contrato — fecha** | `created_at` → `<fechaContrato>` | ✅ |
| **a) Contrato — FIRMAS** | `traveler_records.firma_base64`, pintadas en el PDF | 🟡 se capturan y se guardan bien; el servicio web no transporta imagen (correcto), pero **el PDF firmado no se archiva** (ver 2.3) |
| **b) Fecha y HORA de entrada** | `check_in` es `date`; `mir.ts` le pega `HORA_ENTRADA = "16:00:00"` fija | ❌ **DATO INVENTADO.** El check-in real es entre 16:00 y 20:00. El propio Ministerio dice: «Si se **desconoce** la hora de entrada, enviar `AAAA-MM-DDT00:00:00`». Estamos afirmando una hora que no sabemos. |
| **b) Fecha y HORA de salida** | ídem, `HORA_SALIDA = "12:00:00"` | ❌ mismo problema |
| **c) Inmueble — dirección** | `config.ts` | ✅ |
| **c) Inmueble — nº de habitaciones** | `mir.ts`: `<numHabitaciones>1</numHabitaciones>` **literal, para los cuatro apartamentos** | ❌ **CODIFICADO A FUEGO Y FALSO.** Son apartamentos de 2, 4, 4 y 2 plazas. `apartments` tiene `bathrooms`, `capacity_people` y `bed_config`, pero **no** número de dormitorios. |
| **c) Inmueble — internet** | `aContrato()`: `conexionInternet: true` fijo | 🟡 hoy es cierto (los cuatro tienen wifi), pero es un literal, no un dato |
| **d) Pago — tipo** | `payment_method` / `channel` → `<tipoPago>` | ✅ |
| **d) Pago — identificación del medio** | **nada** | ❌ **FALTA ENTERO.** No hay columna, no hay formulario, y `mir.ts` **ni siquiera emite el elemento**. |
| **d) Pago — titular del medio** | `guest_bookings.guest_name` → `<titular>` | ❌ **DATO SUPUESTO, y falso en el caso más frecuente.** Con Booking paga una tarjeta virtual de Booking; con transferencia puede pagar otra persona. Se afirma algo que nadie ha comprobado. |
| **d) Pago — caducidad de la tarjeta** | **nada** | ❌ **FALTA ENTERO**: ni columna ni elemento XML |
| **d) Pago — fecha del pago** | `aContrato()` devuelve `fechaPago: null` **siempre** | ❌ **Se manda vacío a propósito.** Y encima el dato es alcanzable: hay `payment_status`, `paid_amount` y `payment_intent_id`, pero **ninguna columna con la fecha del cobro**. |

## 2.2 Lo que falta y no es un campo: la comunicación de la RESERVA

**No existe.** El sistema entero —RPC, edge function, cron, paneles— está construido para **una sola
comunicación**: el parte de viajeros al entrar. La comunicación del art. 6.3.a) —**al realizar la
reserva o su anulación, en 24 horas**— no está implementada en ninguna parte, y es una plantilla
distinta en SES Hospedajes («Reservas de hospedaje», sección 4 de las instrucciones).

Es la mitad de la obligación, y es la mitad **fácil**: los campos obligatorios de la reserva son
establecimiento + contrato + pago + **un bloque `persona` con `rol` = `TI`**, con sólo nombre y
primer apellido obligatorios. Todo eso ya está en `guest_bookings` en el momento en que se crea la
fila.

## 2.3 El registro documental: existe el papel, no existe el archivo

La hoja de registro en PDF se genera **bajo demanda** (`accion: "documento"`) y **no se guarda en
ningún sitio**. El libro-registro que exige el apartado segundo.3 de la Orden INT/1922/2003 —«en
formato impreso o digital», ordenado, «en todo momento a disposición» de las Fuerzas y Cuerpos de
Seguridad y exhibible cuando lo requieran— **no existe como artefacto**.

Se puede argumentar que la tabla `traveler_records` **es** el registro informático del art. 5.1 del
RD, y es un argumento razonable. Pero un inspector que pide «el libro» no acepta «se lo regenero»:
pide el archivo. Y si el día que lo piden la edge function está caída o la maqueta del PDF ha
cambiado, lo que se enseña no es lo que se firmó.

## 2.4 Lo que guardamos y no deberíamos

Revisión completa. La noticia es buena.

| Dato | ¿Se guarda? | Veredicto |
|---|---|---|
| Foto / escaneo / copia del DNI | **NO** — no hay `upload`, ni `storage.from`, ni `getUserMedia` en `PrecheckinPage.jsx` | ✅ **Correcto.** Y está decidido a conciencia: el §9 de `PARTE-VIAJEROS.md` descarta el escáner MRZ. |
| Fecha de expedición del documento | Columna **no existe** en `traveler_records`; `parte-modelo.ts` la declara opcional (`fechaExpedicion?`) por herencia del modelo de 2003 | ✅ correcto no pedirla · 🟡 el tipo muerto conviene quitarlo para que nadie lo rellene mañana |
| Nombre de progenitores, CAN, lugar de nacimiento | No | ✅ |
| `firma_base64` | Sí | ✅ **Necesaria** (art. 4.2 RD + apartado segundo.2 Orden INT). No es exceso. |
| `ip_origen_hash`, `user_agent_hash` | Sí, **hasheados** | ✅ Trazabilidad antifraude proporcionada, y hasheados es lo correcto. |
| `consent_privacy_at` | Sí, `NOT NULL DEFAULT now()` | 🟡 **Etiqueta equivocada.** La base legal es **obligación legal** (art. 6.1.c RGPD), **no consentimiento**. Un sello llamado «consent» sugiere que el huésped podría no consentir, y no puede. Debería llamarse `informado_privacidad_at`: prueba de que se le **informó** (art. 13), no de que consintió. |
| `damage_deposit_*` (fianza) en `guest_bookings` | Sí | 🟡 No es dato del parte y no es obligatorio. Legítimo como cláusula contractual **si** consta en las condiciones de reserva antes de reservar. Nada que ver con el check-in legal. |
| Borrado a los 3 años | `prune_traveler_records()` borra a **3 años + 30 días** desde `check_out` | ✅ correcto y bien planteado · ❌ **pero no se ha comprobado que nada lo dispare.** Una función de purga que nadie llama es un borrado que no ocurre. |

## 2.5 Resumen ejecutivo de la auditoría

| # | Qué | Gravedad |
|---|---|---|
| 1 | **No hay alta en SES Hospedajes** → cero comunicaciones desde el 2-dic-2024 | 🔴 |
| 2 | **Comunicación de la reserva (art. 6.3.a) inexistente** | 🔴 |
| 3 | **Datos del pago**: falta identificación del medio, caducidad y fecha; el titular se supone | 🔴 |
| 4 | **Libro-registro no archivado**: el PDF firmado se regenera, no se conserva | 🔴 |
| 5 | **Hora de entrada y salida inventadas** (16:00 / 12:00 fijas) | 🟠 |
| 6 | **`numHabitaciones` = 1 a fuego** para los cuatro apartamentos | 🟠 |
| 7 | **`parentesco` guardado en la ficha del menor**; debe ir en la del adulto | 🟠 |
| 8 | **`TIPO_ESTABLECIMIENTO = "VTAR"`**: valor inexistente en el catálogo (debe ser `AP_RURAL`) y constante muerta | 🟠 |
| 9 | **URL de los anuncios** (A.1.h) no está en ningún sitio, y son cinco que cambian | 🟠 |
| 10 | `apellido2` exigido también con NIE (el MIR sólo lo exige con NIF) | 🟡 |
| 11 | Formulario con 4 parentescos de 15; falta **hermano/a** | 🟡 |
| 12 | `<numeroDocumento>` vs `<documento>`: nombre del elemento sin verificar contra el XSD | 🟡 |
| 13 | `prune_traveler_records()` sin disparador comprobado | 🟡 |
| 14 | `consent_privacy_at` mal nombrado: es información, no consentimiento | 🟡 |

---

# PARTE 3 — Cómo debería ser el check-in en la práctica

**Quien lo hace**: la madre del dueño. Recibe **en persona entre las 16:00 y las 20:00**, entrega la
llave a mano, no hay cerradura electrónica y **no es nada tecnológica**. Muchos huéspedes llegan sin
haber rellenado nada.

**La regla que ordena todo lo demás**: *ella sólo hace tres cosas —mirar el DNI, tocar un botón y dar
la llave—. Todo lo que no sean esas tres cosas lo hace el sistema solo.*

---

## Paso 1 · Antes de llegar — que el 80 % llegue hecho

**Qué se manda, automático, sin que nadie lo pida:**

| Cuándo | Qué |
|---|---|
| Al confirmar la reserva | Correo de confirmación con el enlace `/precheckin?code=TJM-XXXXXX` y una frase: «Rellenadlo antes de llegar y la entrada son dos minutos». |
| 7 días antes | Recordatorio con el mismo enlace. |
| 24 h antes, **sólo si falta gente** | Recordatorio dirigido: «Faltan 2 de 4 personas». Si está completo, **no se manda nada**. |

**Qué se le pide al huésped**: los 15 campos del grupo 3 por persona, su firma con el dedo si tiene
más de 14 años, y nada más. **No** se le pide foto del DNI (está prohibido) ni fecha de expedición.

**Qué hay que añadir a lo que ya existe:**
- Una pregunta al **titular de la reserva**, al final del formulario, en cristiano:
  «¿Quién pagó la reserva?» → *yo mismo / otra persona (nombre) / lo cobró Booking, Airbnb…*
  Con eso se cubre el **titular del medio de pago** sin inventarlo.
- Si hay menores, la pregunta de parentesco se hace **al adulto**: «¿Qué eres de Lucía?» → padre o
  madre / abuelo/a / tío/a / hermano/a / tutor/a. Y se guarda **en la ficha del adulto**.
- Extender la lista de parentescos a los quince códigos del Ministerio.

---

## Paso 2 · Si llega sin rellenar — tres minutos con el DNI delante

Cuando alguien llega en blanco, la madre **no rellena nada**. Hace esto:

1. En su móvil, en la ficha de la reserva, toca **«No lo han rellenado»**.
2. Sale un **código QR grande en pantalla**. El huésped lo escanea con **su propio** móvil y se abre
   el mismo formulario de precheckin, ya con la reserva cargada.
   > Esto no es comodidad, es cumplimiento: la AEPD recomienda expresamente facilitar a los clientes
   > un formulario —en papel o digital— que recoja únicamente los datos obligatorios y que pueda
   > rellenar el propio cliente.
3. Si el huésped no puede o no quiere usar su móvil, la madre le **presta el suyo** con el formulario
   abierto y **se aparta**. Ella no teclea documentos ajenos: ni le corresponde, ni quiere el marrón
   de un número mal copiado en un parte policial.
4. Si de verdad no hay forma —móvil sin batería, persona mayor sola— hay **hojas en papel impresas**
   en la carpeta del recibidor. Se rellenan a mano, se firman, y ella las mete después con el mismo
   formulario. El papel firmado se archiva.

**Cómo se hacen 4 personas en 3 minutos** — lo que ya hace bien el formulario y hay que mantener:
- **una persona por pantalla**, no una tabla;
- teclado numérico para el número de documento y para el código postal;
- **la dirección se copia del primero** con un botón «Vive en la misma casa que Juan» → resuelve
  cuatro campos de golpe en una familia, que es el 90 % de los casos;
- país y nacionalidad con **España, Francia, Reino Unido, Alemania y Portugal arriba del todo**;
- **se guarda solo en el propio móvil**: si entra una llamada y se sale, al volver sigue donde
  estaba;
- **no se valida hasta que se intenta pasar de pantalla**: nada de campos en rojo mientras escribes.

**Lo que ella sí hace, y es lo único que la ley le exige hacer a ella**: cuando le devuelven el
móvil, **mira los DNI y los compara con la pantalla**. El art. 4.3 del RD 933/2021 la hace
responsable de que los datos «coincidan con los documentos […] que habrán de ser exhibidos». Un
vistazo: nombre, apellidos, número. **Mira y devuelve.** No fotografía, no fotocopia, no se queda el
documento. Si algo no coincide, se corrige ahí mismo.

---

## Paso 3 · Qué se firma y cómo

- Firman **todos los mayores de 14 años**, uno por uno, **con el dedo en el móvil**. Es válido: la
  Orden INT/1922/2003, en su redacción vigente, admite la firma «en papel o **en un soporte
  digital**».
- Los **menores de 14 no firman**: sus datos los da el adulto que los acompaña.
- Los de **14 a 17 sí firman**, aunque no tengan documento propio.
- **Al terminar, el sistema archiva el PDF firmado** en almacenamiento privado, con nombre
  `libro-registro/AAAA/AAAA-MM-DD-TJM-XXXXXX.pdf`, y anota la ruta en la reserva. **Eso es el
  libro-registro.** No se regenera: se guarda una vez y se conserva tres años.

---

## Paso 4 · Los datos de pago, caso por caso

Esto es lo que hoy no existe y hay que resolver. La regla de fondo: **nunca se guarda un número de
tarjeta completo.** Ni lo pide la ley con esa literalidad —el art. 5.2 sólo obliga a registrar lo
«que recaben»—, ni lo permiten las reglas de las marcas de tarjeta a un comercio que no está
certificado en PCI-DSS. Se guarda **lo que identifica el pago**, no lo que permitiría volver a
cobrarlo.

| De dónde viene la reserva | Tipo | Identificación del medio | Titular | Caducidad | Fecha del pago |
|---|---|---|---|---|---|
| **Booking, tarjeta virtual** | `PLATF` | `Tarjeta virtual Booking ****1234` (últimos 4) | `Booking.com B.V.` — **no** el huésped | *(en blanco: no es tarjeta del cliente)* | fecha en que se cobró la VCC |
| **Booking / Airbnb, cobrado por la plataforma** | `PLATF` | `Cobro de la plataforma · localizador XYZ` | `Booking.com B.V.` / `Airbnb Ireland UC` | — | fecha del abono de la plataforma |
| **Transferencia** | `TRANS` | **el IBAN del ordenante** — es literalmente el ejemplo del anexo, y lo tenemos en el extracto | nombre del ordenante que figura en el extracto | — | fecha valor de la transferencia |
| **Tarjeta en la web propia (Stripe)** | `TARJT` | `VISA ****4242` (marca + últimos 4, tal cual lo devuelve Stripe) | nombre del titular que devuelve Stripe | `MM/AAAA` de Stripe | fecha del cargo |
| **Bizum** | `MOVIL` | teléfono del ordenante | nombre del ordenante | — | fecha del abono |
| **Efectivo al llegar** | `EFECT` | — | quien paga | — | día del check-in |
| **Aún sin pagar al comunicar** | `DESTI` | — | — | — | *(en blanco)* |

**Lo importante**: casi todo esto **no lo tiene que teclear nadie**. Stripe devuelve marca, últimos
cuatro, caducidad, titular y fecha en el propio webhook. La transferencia sale del extracto. La
tarjeta virtual de Booking sale de la extranet. **Lo único que hay que preguntar** es quién pagó,
cuando la reserva llegó por teléfono o cuando paga alguien distinto del titular. Y eso ya se pregunta
en el paso 1.

**Nunca se guarda**: el número completo de la tarjeta, ni el CVV, ni la banda, ni una foto de nada.

---

## Paso 5 · Qué se le entrega o se le enseña al huésped

**Se le enseña o se le da**, y esto no es del RD 933/2021 sino de Andalucía:

| Qué | Norma | Dónde |
|---|---|---|
| **Placa identificativa** con la categoría | Decreto 20/2002, art. 35 | fijada en el exterior |
| **VTAR/JA/00044** en toda la publicidad | Decreto 20/2002, art. 35 | web propia y **los cuatro portales** |
| **Hojas de quejas y reclamaciones** + cartel anunciador | Decreto 82/2022 · Ley 13/2011 art. 24 | carpeta del recibidor + cartel visible |
| **Precios máximos y mínimos** y **justificante del pago** | Decreto 20/2002, art. 36 | cartel de precios + recibo |
| **Factura** desglosada si la piden | Ley 13/2011, art. 24 · Decreto 20/2002, art. 37 | por correo, automática |
| **Información de protección de datos** (art. 13 RGPD) | RGPD | ya está enlazada en el precheckin ✅ |

**No** hay que darle copia del parte. Si la pide, se le da y ya está.

**Lo que sí conviene entregarle** y no es obligación: la guía del apartamento —wifi, horarios,
teléfono, qué hacer si se corta la luz—. Eso ahorra llamadas a las once de la noche.

---

## Paso 6 · Qué tiene que pasar solo, sin que ella toque nada

| Cuándo | Qué pasa | Ella se entera si… |
|---|---|---|
| Al crear la reserva | Se manda la **comunicación de reserva** al Ministerio (24 h) | falla |
| Si se anula | Se manda la **anulación** (24 h) | falla |
| Al confirmar / 7 días antes / 24 h antes | Correos con el enlace de precheckin | — |
| A las **10:00 del día siguiente** a cada entrada | Se manda el **parte de viajeros** de todas las entradas del día anterior | falla |
| Justo después | Se **archiva el PDF firmado** en el libro-registro | — |
| Unas horas después | Se **comprueba el lote** y el parte pasa a «aceptado» | sale rechazado |
| A los 3 años y 30 días | Se **borran** los datos del viajero | — |

**Lo único que ella ve** es un semáforo por reserva con tres estados y cero jerga:

- 🟢 **«Listo»** — está todo mandado. No hace nada.
- 🟡 **«Faltan 2 de 4»** — toca «Recordárselo» y se manda un SMS o un WhatsApp. Un botón.
- 🔴 **«Avisa a Jesús»** — algo falló. **Ella no arregla nada.** Toca el botón y le llega el aviso a
  Jesús con el motivo.

Y un cuarto botón para el día que llega alguien sin nada: **«No lo han rellenado»** → QR en pantalla.

**Lo que no debe pasar nunca**: que ella tenga que decidir si un dato es obligatorio, teclear un
número de documento ajeno, o elegir un código de un catálogo. Si el sistema necesita eso, el sistema
está mal.

---

# Los tres riesgos legales más serios que tenemos hoy

### 1. Llevamos 21 meses sin comunicar nada 🔴
El alojamiento **no está dado de alta** en SES Hospedajes, así que desde el **2 de diciembre de
2024** no ha salido ni un solo parte por la vía que exige el art. 6.4 (procedimientos telemáticos).
Es **«omisión de las comunicaciones obligatorias»**: infracción **grave** del art. 8.2.b) del
RD 933/2021, sancionable con **601 a 30.000 €** (art. 39.1 LO 4/2015), y la responsabilidad recae
«directamente» en el titular persona física (art. 8.4). Además, el alta previa tenía su propio plazo
—diez días desde los trámites y en todo caso antes del ejercicio efectivo de la actividad (art. 6.2)—
que también está incumplido. **Esto es lo primero y todo lo demás va detrás.**

### 2. La mitad de la obligación ni siquiera está construida 🔴
La comunicación **al reservar y al anular** (art. 6.3.a) no existe en el sistema. No es un campo que
falta: es una comunicación entera, con su propia plantilla en SES Hospedajes, que nunca se ha
diseñado. Aunque mañana llegaran las credenciales y empezara a salir el parte de viajeros, **seguiría
faltando una comunicación por cada reserva y por cada anulación**, y cada una es una omisión
independiente. Es la infracción grave del punto 1, otra vez, multiplicada por el número de reservas.

### 3. El registro documental es incompleto y no se archiva 🔴
Dos cosas a la vez, y ambas caen en «**carencia de los registros documentales**» (art. 8.2.a, grave)
o como poco en «irregularidades o deficiencias en la cumplimentación» (art. 8.3.a, leve):
- **Faltan los datos del pago** del anexo I A.4.d —identificación del medio, caducidad y fecha— y el
  **titular del medio de pago se supone**, poniendo el nombre del huésped incluso cuando quien paga
  es una tarjeta virtual de Booking. Un registro que afirma algo falso es peor que uno incompleto.
- **El libro-registro no existe como archivo**: la hoja firmada se regenera bajo demanda y no se
  conserva. El apartado tercero.2 de la Orden INT/1922/2003 es explícito en que el envío telemático
  «no exime […] de la confección del libro-registro correspondiente», y el apartado segundo.4 obliga
  a **exhibirlo** cuando lo requieran.

A esto se le suman, sin llegar a riesgo mayor pero sí a rechazo del parte o a registro inexacto: la
**hora de entrada inventada** (16:00 fija cuando el check-in va de 16:00 a 20:00 y el Ministerio dice
que si se desconoce se envíe 00:00:00), el **número de habitaciones a fuego en 1** para los cuatro
apartamentos, y el **parentesco guardado en la ficha del menor** en vez de en la del adulto.

---

# Fuentes

Todas consultadas el **10 de septiembre de 2026**.

**Estado**
- Real Decreto 933/2021, de 26 de octubre — texto consolidado.
  https://www.boe.es/buscar/act.php?id=BOE-A-2021-17461
- Orden INT/1922/2003, de 3 de julio, sobre libros-registro y partes de entrada de viajeros — texto
  consolidado, con la modificación de la Orden INT/321/2021.
  https://www.boe.es/buscar/act.php?id=BOE-A-2003-13865
- Orden INT/321/2021, de 31 de marzo (firma en soporte digital, libro-registro digital).
  https://www.boe.es/diario_boe/txt.php?id=BOE-A-2021-5483
- Ley Orgánica 4/2015, de 30 de marzo, de protección de la seguridad ciudadana — arts. 33.2, 36.20,
  37.9 y 39.
  https://www.boe.es/buscar/act.php?id=BOE-A-2015-3442

**Ministerio del Interior — SES Hospedajes**
- *Instrucciones para el alta masiva de comunicaciones*, v1.1.0 (34 págs.). Bloques `contrato`,
  `persona` y `pago`; tablas 8.3 parentesco, 8.4 sexo, 8.5 tipos de documento, 8.6 tipos de
  establecimiento, 8.7 tipos de pago.
  https://hospedajes.ses.mir.es/hospedajes-sede/assets/docs/Instrucciones.pdf
- Información y trámites del alta.
  https://sede.interior.gob.es/portal/sede/informacion_hospedajes

**Protección de datos**
- AEPD — Nota sobre el registro de hospedajes y el RD 933/2021 (junio de 2025).
  https://www.aepd.es/guias/nota-aepd-registro-hospedajes.pdf
- AEPD — Nota de prensa: no está permitido solicitar copia del DNI o pasaporte en los hospedajes
  (17 de junio de 2025).
  https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-informa-de-que-no-esta-permitido-solicitar-copia-dni-o-pasaporte-en-hospedajes

**Andalucía**
- Ley 13/2011, de 23 de diciembre, del Turismo de Andalucía — art. 24.
  https://www.boe.es/buscar/act.php?id=BOE-A-2012-876
- Decreto 20/2002, de 29 de enero, de Turismo en el Medio Rural y Turismo Activo — art. 19 y
  Título IV cap. I (arts. 35, 36 y 37).
  https://www.juntadeandalucia.es/boja/2002/14/1
- Decreto 82/2022, de 17 de mayo, hojas de quejas y reclamaciones.
  https://www.juntadeandalucia.es/boja/2022/95/42

**Interno**
- `docs/PARTE-VIAJEROS.md` — cómo se manda y qué falta para poder mandarlo (alta, credenciales,
  SOAP, códigos de error).

---

## Lo que queda sin confirmar y no doy por bueno

1. **⚠️ Nombre real de los elementos XML del servicio web.** Las *Instrucciones* del MIR describen el
   fichero de **alta masiva**, que puede no coincidir con el XSD del servicio SOAP. Afecta al menos a
   `documento` vs `numeroDocumento`, y a si existen `medioPago` y `caducidadTarjeta` con esos
   nombres. **Se resuelve descargando el WSDL y los XSD desde dentro de la plataforma**, ya
   autenticado, el día del alta. Hasta entonces, ningún cambio de nombres de elemento.
2. **⚠️ Uno o cuatro establecimientos.** Los cuatro apartamentos comparten VTAR/JA/00044. Si el
   Ministerio asigna cuatro códigos de establecimiento, `numHabitaciones` y el código dejan de ser
   constantes y pasan a ser columnas de `apartments`. Se pregunta en el propio trámite del alta.
3. **🟡 Vigencia formal del Decreto 20/2002 para las VTAR.** Confirmada por su aplicación práctica y
   por fuentes solventes, no por una disposición derogatoria expresa leída en el BOJA.
4. **🟡 Régimen transitorio del sistema electrónico de hojas de quejas** del Decreto 82/2022: la
   página del BOJA devolvió error de conexión el día de la consulta.
5. **🟡 Cuantías concretas de sanciones de la AEPD** a hospedajes por copiar documentos de identidad:
   la horquilla legal está confirmada; los importes que circulan proceden de prensa, no de
   resoluciones localizadas.
6. **🟡 La fecha del 2 de diciembre de 2024** como inicio de la exigibilidad efectiva procede de la
   implantación de SES Hospedajes, no del texto del real decreto, cuya disposición final tercera
   habla del 2 de enero de 2023.

---

# PARTE 4 — Qué queda cubierto y qué no

> Escrito el **10 de septiembre de 2026**, después de cerrar los huecos de
> backend. Lo que aquí se marca como cubierto está **aplicado contra
> producción** (`nmtukksbzbnuzqsksdmw`) y probado, salvo donde se dice lo
> contrario con todas las letras.

## 4.1 Los catorce huecos, uno por uno

| # | Hueco | Estado | Dónde |
|---|---|---|---|
| 1 | **No hay alta en SES Hospedajes** | ❌ **Sigue abierto. Es de Jesús, no del sistema.** Todo lo demás está construido y esperando a las credenciales | trámite en la sede del MIR |
| 2 | Comunicación de la reserva y de la anulación | 🟨 **Construido entero**, sin desplegar. Tabla `ses_comunicaciones`, XML de las plantillas `RH` y de anulación (`B`), barrido horario `tjm-ses-reservas`, reintentos con espera creciente, sellos en la reserva | `0010` · `mir.ts` · `index.ts` |
| 3 | Datos del pago | ✅ **Cubierto y probado.** Cinco columnas, RPC `set_payment_details`, la marca y los últimos cuatro **desde Stripe sin teclear nada** (ya desplegado), el titular de Booking puesto solo, y una guardia que no deja guardar un número de tarjeta entero | `0010` · `0013` · `stripe-webhook` v5 |
| 4 | Libro-registro archivado | 🟨 Cubo privado `libro-registro` creado, consulta por fechas (`tjm_libro_registro`), archivado escrito. Falta desplegar la función que lo sube | `0010` · `index.ts` |
| 5 | Hora de entrada y de salida inventadas | 🟨 `checkin_at` / `checkout_at` aplicadas. El XML manda la **hora real** si se conoce y `T00:00:00` si no, que es lo que pide el MIR. Nunca vuelve a inventarse un 16:00. Falta desplegar, y que alguien anote la hora al dar la llave | `0010` · `parte-modelo.ts` |
| 6 | `numHabitaciones` a fuego en 1 | 🟨 `apartments.num_habitaciones` con el valor de cada uno (Albahaca 1, Tomillo 1, Lavanda 2, Romero 2). Falta desplegar. ⚠️ **Los dormitorios están DEDUCIDOS de `bed_config`, no medidos**: si en Lavanda o Romero las dos camas individuales van en cuartos separados son 3, y es un `UPDATE` de una línea | `0010` |
| 7 | Parentesco en la ficha del menor | ✅ **Cubierto y probado en producción.** Ahora lo declara el ADULTO sobre el menor (`parentesco_menor_id`). La RPC del precheckin lo endereza sola aunque el formulario siga mandándolo como antes | `0010` · `0011` |
| 8 | `TIPO_ESTABLECIMIENTO = "VTAR"` | 🟨 Corregido a **`AP_RURAL`** y dejado de estar muerto: vive en `ALTA_MINISTERIO` y la acción `estado` lo devuelve, para que se vea en el panel. Falta desplegar | `config.ts` |
| 9 | URL de los anuncios (A.1.h) | 🟨 El hueco existe: `apartments.anuncio_urls`. **Está vacío**: son cinco URL que sólo Jesús tiene | `0010` |
| 10 | `apellido2` exigido también con NIE | ✅ Cubierto: se exige **sólo con NIF**, que es lo que dice el MIR. Ya no bloquea a un residente con un apellido | `parte-modelo.ts` |
| 11 | Cuatro parentescos de quince | ✅ En la base estaban los quince desde `0008`. Lo que faltaba era el **formulario**, y eso lo lleva el agente del front | `0008` |
| 12 | `<numeroDocumento>` vs `<documento>` | ✅ **Resuelto contra el XSD real.** `personaHospedajeType` de `tiposGenerales.xsd` lo llama `numeroDocumento`. Son los dos correctos en canales distintos: el **servicio web** usa `numeroDocumento` y la **plantilla de carga masiva** usa `documento` (Instrucciones §3). El código hablaba por el servicio web y ya era correcto | `tiposGenerales.xsd` |
| 13 | `prune_traveler_records()` sin disparador | ✅ **Ya lo tenía**: cron `prune-traveler-records`, `30 3 * * *`, activo. La auditoría no lo había mirado. Lo que sí faltaba disparador era la **anonimización** de `0008`, que ahora corre mensual | `0010` |
| 14 | `consent_privacy_at` mal nombrado | ✅ Renombrada a **`informado_privacidad_at`**. Se pudo hacer sin romper nada porque el nombre viejo no aparecía en ningún sitio del código | `0010` |

## 4.2 Tres cosas que la auditoría no había visto y estaban mal

1. **`<internet>` se mandaba como `SI` / `NO`.** El esquema lo declara
   **Booleano** y el ejemplo del anexo II manda `false`. Habría sido un
   rechazo por formato en el primer envío. Ahora va `true` / `false`.
2. **La anulación no es «mandar la reserva con una marca».** Es la operación
   `B`, y lo que viaja es una lista de **`codigoComunicacion`** —los que
   devuelve la consulta del lote cuando se comunicó la reserva—. Sin guardar
   esos códigos no se puede anular nada, así que ahora se guardan.
3. **La reserva usa otra plantilla, no la del parte.** `tipoComunicacion` =
   `RH`, con un `<establecimiento>` propio dentro de cada `<comunicacion>` y
   un bloque `persona` con `rol` = `TI`. No es el parte con otro nombre.
4. **`consultaLote` no se parece a `comunicacion`.** La versión anterior lo
   construía «por simetría», con `<peticion>` y `<cabecera>`. El XSD real dice
   que es directamente `<codigosLote><lote>UUID</lote></codigosLote>`, sin
   cabecera ninguna. Habría fallado en la primera consulta de un lote — que es
   justo el paso que decide si un parte pasa de «mandado» a «aceptado».

## 4.2.bis Lo que dejó de ser una suposición

El 10-sep-2026 se pudieron abrir los **esquemas reales** del servicio
(`comunicacion.wsdl` v3.1.1, `tiposGenerales.xsd`, `altaParteHospedaje.xsd`,
`comunicacion.xsd`, `tipoComunicacion.xsd`), no sólo el PDF. Con ellos:

- el **orden de los campos** de `contratoHospedajeType`, `personaHospedajeType`,
  `pagoType` y `direccionType` está comprobado campo a campo contra lo que
  emite el código, y coincide;
- **`internet` es booleano**: su tipo se llama `siNoType`, que engaña, pero
  tiene `base="xsd:boolean"`. Mandar «SI» habría sido un rechazo por formato.
  El código mandaba «SI» y ahora manda `true`;
- la cabecera (`cabeceraLoteType`) lleva `tipoComunicacion` como **opcional**,
  que es lo que permite omitirlo en la anulación;
- `codigoComunicacion` vive en `resultadoType`, dentro de la respuesta del
  lote: es de donde se sacan los códigos que hacen falta para anular.

**Lo único que sigue sin confirmar** es el `targetNamespace` del XSD de la
**reserva**: el paquete no lo trae. Por eso se puede corregir sin desplegar
nada, con el secreto `SES_NS_RESERVA`.

## 4.3 Lo que sigue dependiendo de que Jesús haga algo

| Qué | Por qué no lo puede hacer el sistema |
|---|---|
| **Alta en SES Hospedajes**, marcando la casilla de comunicación por servicio web | Es un trámite con certificado digital o Cl@ve, a nombre del titular |
| Poner los cinco secretos (`SES_WS_USER`, `SES_WS_PASSWORD`, `SES_ARRENDADOR`, `SES_ESTABLECIMIENTO`, `SES_ENDPOINT`) | Los da el Ministerio al dar de alta |
| Copiar `SES_CRON_TOKEN` de Vault al secreto de la edge function | La llave se generó sola en Vault (migración `0010`); el sistema no puede escribir sus propios secretos |
| Las **cinco URL de los anuncios** | Sólo las tiene él |
| Confirmar los **dormitorios** de Lavanda y Romero (2 ó 3) | No hay ningún dato en la base que lo diga |
| Conseguir el **XSD de la reserva de hospedaje** (`altaReservaHospedaje`) desde dentro de la plataforma | Es lo ÚNICO que sigue sin verificar. Los demás esquemas ya se abrieron el 10-sep y con ellos se corrigieron dos cosas que estaban mal. Si la primera reserva devuelve el error 10118, se arregla poniendo el secreto `SES_NS_RESERVA` — sin desplegar nada |
