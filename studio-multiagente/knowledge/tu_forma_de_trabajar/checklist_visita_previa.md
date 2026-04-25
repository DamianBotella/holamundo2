# Checklist de visita previa — TU versión profesional

## Estado

- **Pendiente:** Damián debe rellenar con su checklist real de visita.
- **Consumido por:** `agent_briefing` (para estructurar observaciones), `agent_pathology` (futuro), `agent_design` (para tener en cuenta lo detectado).

---

## Cómo rellenar este archivo

Estructura sugerida: al entrar a un piso la primera vez, ¿qué miras tú? Divide por zonas y por categorías. Incluye:

- Qué revisas sí o sí.
- Qué preguntas haces al cliente/propietario.
- Qué fotografías tomas por defecto.
- Qué te hace "cancelar" el proyecto y remitir a especialista.

### Plantilla propuesta

```markdown
## Antes de entrar

- [ ] Pedir plano del piso (si existe, IBI, nota simple, plano catastral).
- [ ] Preguntar edad del edificio.
- [ ] Preguntar si ha habido reformas previas.
- [ ] Revisar si el edificio está o no en zona protegida urbanísticamente.

## Al entrar — vestíbulo / recibidor

- [ ] ...
- [ ] ...

## Cocina

- [ ] Estado de la campana extractora (¿sale al exterior?).
- [ ] Certificado de gas del edificio si aplica.
- [ ] Fregadero: estado del desagüe.
- [ ] Encimera: material, estado.
- [ ] Electrodomésticos que el cliente quiere mantener o cambiar.
- [ ] ...

## Baños

- [ ] Estado del suelo (humedades ocultas bajo bañera).
- [ ] Funcionamiento inodoro y cisterna.
- [ ] Ventilación (shunt o ventana).
- [ ] Presión de agua (abrir ducha).
- [ ] ...

## Dormitorios

- [ ] ...

## Salón

- [ ] ...

## Instalaciones

### Eléctrica
- [ ] Cuadro general: tipo (fusibles / pastillas / moderno con diferenciales).
- [ ] Toma de tierra (probar con un medidor).
- [ ] Número de circuitos aproximado.
- [ ] ...

### Fontanería
- [ ] Contador (interior / exterior / comunitario).
- [ ] Tipo de tubería visible (cobre / multicapa / acero).
- [ ] Llave de paso general: localización, funcionamiento.
- [ ] ...

### Climatización
- [ ] Tipo de calefacción existente.
- [ ] Caldera: marca, edad, última revisión.
- [ ] Aire acondicionado existente.
- [ ] ...

## Estructura y envolvente

- [ ] Fisuras visibles (fotografiar y medir ancho si > 1 mm).
- [ ] Humedades (manchas, olor, desconchado).
- [ ] Estado de la carpintería exterior.
- [ ] Orientación del piso (usar brújula).
- [ ] ...

## Administración / edificio

- [ ] Pedir contacto del administrador de la finca.
- [ ] Preguntar por ITE del edificio (Inspección Técnica de Edificios).
- [ ] Verificar si el edificio ha pasado inspección de aluminosis (construidos años 50-70).
- [ ] ...

## Preguntas al cliente

- [ ] ¿Qué habitación es prioritaria para reformar?
- [ ] ¿Cuál es el presupuesto máximo real (no ideal)?
- [ ] ¿Fecha objetivo de entrada? ¿Hay flexibilidad?
- [ ] ¿Tiene alquiler alternativo durante obra?
- [ ] ¿Quiere vender el piso en los próximos 3 años? (afecta decisiones de calidad/estética).
- [ ] ¿Niños pequeños en casa? (accesibilidad, acabados resistentes).
- [ ] ¿Preferencia de estilo? Mostrar ejemplos visuales.
- [ ] ¿Quiere estar involucrado en cada decisión o prefiere que el arquitecto decida?
- [ ] ...

## Banderas rojas (remitir a arquitecto superior o estructura)

- [ ] Fisura estructural > 1 mm con signos de movimiento.
- [ ] Signos de aluminosis (edificios años 50-70 sin ITE reciente).
- [ ] Humedades persistentes en pared común con vecino (requiere gestión comunitaria).
- [ ] Cambio de uso (local → vivienda): tramitación compleja.
- [ ] Edificio protegido urbanísticamente: requiere autorización Bellas Artes.
- [ ] ...

## Qué documentar con fotos (siempre)

1. Vista general de cada estancia desde la puerta.
2. Fachada exterior desde calle.
3. Cuadro eléctrico abierto.
4. Contador de agua.
5. Caldera/sistema calefacción.
6. Detalles de cualquier patología visible.
7. Estado actual de carpintería exterior.
8. Techos (viguetas, manchas).
9. Suelos en detalle.

---

## Ejemplo de checklist personal (placeholder)

```
## Checklist personal de Damián

**Secuencia recomendada** (20-30 min por visita):

1. **Entrada + planos** (5 min)
   - Consigo plano
   - Anoto edad edificio, reformas previas

2. **Recorrido general** (10 min)
   - Foto por estancia
   - Identifico patologías visibles

3. **Inspección detallada** (10 min)
   - Cuadro eléctrico
   - Contador agua
   - Pruebas básicas (agua, grifos, desagües)

4. **Conversación con cliente** (10 min)
   - Necesidades, presupuesto, tiempos
   - Preferencias estéticas

5. **Fin: resumen verbal**
   - Le adelanto 2-3 cosas importantes
   - Prometo propuesta por escrito en X días
```

---

## Cuando hayas rellenado esto

Avísame y yo:
1. Integro tu checklist en el prompt de `agent_briefing` como contexto.
2. El agente cuando reciba tus notas de visita, las cruzará con tu checklist para detectar "información que falta" y la incluirá en `missing_info`.

Media página de checklist real tuyo es más valioso que 10 páginas de plantillas genéricas.
