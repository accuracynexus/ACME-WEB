# Qué revisa Culqi para aprobar el comercio

Verificado contra el Contrato de Afiliación al Sistema de Pago Culqi y la
documentación pública (agosto 2026), y contrastado con acmepedidos.com.

## Lo que exige el contrato

La obligación textual del comercio es informar al tarjetahabiente, **"de manera
clara y visible"**:

- los medios de pago autorizados,
- la **política de devoluciones**,
- la **política de cancelaciones**

de los productos o servicios que ofrece. También exige contar con políticas de
prevención de Lavado de Activos y Financiamiento del Terrorismo, y cumplir lo
que la norma peruana o las redes de pago exijan según el rubro.

Para integrar por API (nuestro caso, no plugin) es **obligatorio completar y
enviar el SAQ-D**, el cuestionario de autoevaluación PCI DSS. Sin ese documento
el comercio no puede afiliarse. La validación de la afiliación demora entre 1 y
3 días hábiles.

## Estado de acmepedidos.com

| Requisito | Estado |
|---|---|
| Política de devoluciones y cancelaciones | ✅ `/devoluciones-y-cancelaciones` — **la que el contrato exige literalmente** |
| Términos y condiciones | ✅ `/terminos-y-condiciones` |
| Política de privacidad | ✅ `/politica-de-privacidad` |
| Libro de Reclamaciones | ✅ `/libro-de-reclamaciones` (D.S. 011-2011-PCM) |
| Datos del negocio (razón social, RUC, domicilio) | ✅ En el pie de página y en las páginas legales |
| Medios de pago visibles | ✅ Detallados en términos y condiciones |
| Precios en soles con total desglosado | ✅ Con IGV y comisiones desglosadas |
| Confirmación de pedido al comprador | ✅ `/pedido/:orderId` tras pagar |
| Seguimiento del pedido | ✅ `/mis-pedidos`, en curso e historial separados |
| HTTPS | ✅ |
| Descripción clara del servicio y cobertura | ✅ (Huancavelica) |
| Canal de contacto | ✅ `/contacto` |
| SAQ-D (PCI DSS) | ⏳ Trámite administrativo del negocio, no es código |

## Lo único que queda

**Enviar el SAQ-D a Culqi.** Es el cuestionario de autoevaluación PCI DSS y es
obligatorio para integraciones por API como la nuestra: sin él no se completa la
afiliación. No se resuelve con código, lo llena el negocio.

Y reemplazar las llaves de sandbox por las de producción (ver abajo).

## Nota sobre el estado técnico

El circuito de cobro ya funciona de punta a punta (cotización → pedido → Culqi →
cargo → actualización del pedido), pero las llaves siguen siendo de sandbox
(`pk_test`/`sk_test`). Para producción hay que reemplazarlas por las `pk_live`/
`sk_live` en los proyectos de Vercel `acme-web` y `acme-operacione`.
