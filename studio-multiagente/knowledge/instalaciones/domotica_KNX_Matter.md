# Domótica — KNX, Matter, Home Assistant y ecosistemas

## Estado

- **Mantiene:** Claude
- **Última revisión:** 2026-04-24

## Ecosistemas actuales (2025)

### KNX — El estándar profesional europeo

**Qué es**: protocolo abierto, certificado, maduro (desde 1990s). Instalado en proyectos de alta gama.

**Ventajas**:
- Fiable a largo plazo (existe desde hace >25 años, retrocompatible).
- Ampliable sin reprogramar la instalación base.
- Independiente de fabricantes específicos — mezcla productos.
- Cableado dedicado independiente del eléctrico (bus KNX).

**Inconvenientes**:
- Inversión inicial alta (4-8× el coste de smart home de consumo).
- Requiere **integrador certificado** — no es plug-and-play.
- Cableado nuevo obligatorio (no se puede adaptar sobre eléctrica existente sin convertidores).

**Aplicación típica** en reforma integral alta gama: iluminación escenas, climatización por estancias, persianas motorizadas, detección presencia, alarmas.

**Coste orientativo en piso 90 m² con KNX completo**: 6.000 - 15.000 € (hardware + integrador).

### Matter — El estándar de consumo emergente

**Qué es**: estándar abierto lanzado 2022 por Apple, Google, Amazon, Samsung. Unifica Apple HomeKit, Google Home, Amazon Alexa, SmartThings.

**Ventajas**:
- Compatible multi-marca sin propietario.
- Sobre WiFi/Thread → sin cable extra.
- Dispositivos relativamente baratos (50-200 € unidad).
- Se puede ampliar progresivamente (empieza con 2 bombillas, añade más).

**Inconvenientes**:
- Tecnología joven (pocos años) — evolución rápida.
- Funcionalidad más limitada que KNX en control profesional (escenas complejas, lógica condicional).
- Dependencia de red WiFi local (si se cae, menos funcional).

**Aplicación típica**: cliente interesado en smart home pero sin presupuesto KNX. Bombillas inteligentes, termostato Nest, asistente de voz.

**Coste orientativo en piso 70 m²**: 500 - 2.500 € según cobertura.

### Home Assistant — Plataforma de código abierto

**Qué es**: software libre que corre en Raspberry Pi u otro servidor. Integra CUALQUIER dispositivo (KNX, Zigbee, Z-Wave, WiFi, Matter, APIs).

**Ventajas**:
- **Máxima flexibilidad** — integra lo que no se integra.
- Control local (no depende de nube).
- Sin coste de licencia.
- Comunidad enorme (add-ons gratis).

**Inconvenientes**:
- Requiere conocimiento técnico del usuario o instalación por integrador.
- Sin soporte profesional.
- Si algo falla, es trabajo del usuario diagnosticar.

**Aplicación típica**: cliente "tech" que quiere máxima libertad. Familia que ya tiene dispositivos de distintas marcas y quiere unificar.

**Coste orientativo**: Raspberry Pi (100 €) + configuración (si la hace integrador: 500-1.500 €). Hardware de dispositivos aparte.

### Zigbee / Z-Wave — Protocolos ocultos tras los ecosistemas

**Zigbee** y **Z-Wave** son protocolos de malla inalámbrica que muchos dispositivos "Matter" o "Home Assistant" usan por debajo. Son fiables y consumen poca batería.

**En reforma**: no es necesario pensar en ello como tecnología principal. Es relevante si el cliente ya tiene dispositivos de ecosistemas específicos que usan Zigbee (ej. Philips Hue).

## Qué se puede controlar

Categorías típicas ordenadas por valor percibido:

1. **Iluminación**: escenas por estancia, atenuación, programaciones horarias, detección presencia → apagado automático.
2. **Climatización**: termostato por estancia, programación, control remoto, integración con meteorología.
3. **Persianas/toldos motorizados**: apertura/cierre por horario, temperatura, sol.
4. **Seguridad**: alarma, sensores apertura puerta/ventana, sensores movimiento, cámaras.
5. **Control acceso**: cerradura inteligente, videoportero IP.
6. **Audio multiroom**: Sonos, Denon HEOS, sistemas KNX de audio.
7. **Cortinas automáticas**: tipo hotel premium.
8. **Riego jardín**: relevante en vivienda unifamiliar.

## Preinstalación necesaria según sistema

### Con KNX

**Obligatorio durante la fase de electricidad** (antes de tapar paredes):

- **Cable bus KNX** independiente del cableado eléctrico. Va en tubo corrugado separado.
- **Cajas de mecanismos de 50 mm de profundidad** (los mecanismos KNX son más grandes).
- **Cuadro secundario KNX** en patinillo o armario dedicado.
- **Motores para persianas**: cajón registrable con motor tubular.
- **Tomas de red RJ45** en salón, despacho, zonas donde pueda ir pantalla de control.

### Con Matter / Home Assistant

**Preinstalación más ligera**:

- **Buena cobertura WiFi** en toda la vivienda (AP adicional si hace falta).
- **Tomas de corriente cerca de puntos clave** para conectar bridges, concentradores.
- **Cajón de persiana accesible** si se va a motorizar después.

**Menor inversión inicial, más flexibilidad para añadir después**.

## Recomendación del arquitecto técnico

En reforma, la **decisión domótica debe tomarse al principio del proyecto** porque afecta al cableado eléctrico. Si el cliente duda, la solución segura es:

- **Hacer preinstalación básica** (cableado adicional en tubo corrugado + cajas profundas) aunque no se instalen los dispositivos.
- **Coste adicional ~3-5% sobre eléctrica estándar**.
- Permite que el cliente **amplíe progresivamente** sin romper obra terminada.

## Integradores y proveedores en España

| Integrador | Especialidad | Zona |
|---|---|---|
| Simon, Jung, Gira, Niko | Mecanismos KNX de gama media-alta | Todo España |
| ABB, Schneider | Sistemas KNX completos + integración | Todo España |
| Control4 | Sistema propietario US alta gama | Madrid, Barcelona (integradores certificados) |
| Fibaro (Z-Wave) | Consumo medio-alto | Online, integradores |

**Damián, añade tus integradores de confianza:**
```
## Integradores de confianza (Damián)

- Integrador KNX zona Madrid: ...
- Integrador Home Assistant: ...
- ...
```

## Decisión para `agent_home_automation` (futuro)

Lógica que implementaría un agente futuro para proponer ecosistema según cliente:

```
IF cliente.budget_extra_domotica > 10.000 € AND cliente.interes_alta_gama:
    RECOMENDAR KNX
ELSE IF cliente.tiene_equipos_ya Y cliente.nivel_tecnico_alto:
    RECOMENDAR Home_Assistant
ELSE IF cliente.quiere_empezar_simple:
    RECOMENDAR Matter (Apple/Google/Amazon según preferencia)
ELSE:
    RECOMENDAR Preinstalación_KNX_sin_activar (futuro-proof más económico)
```

## Cómo usa ArquitAI

- `agent_design` incluye la decisión de domótica al plantear opciones (afecta a cableado).
- `agent_costs` presupuesta la preinstalación o sistema completo según el escenario elegido.
- `agent_home_automation` (futuro, sec 3.16) gestiona la selección detallada con el cliente.
