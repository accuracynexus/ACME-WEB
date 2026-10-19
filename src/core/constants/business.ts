/**
 * Datos legales del negocio. Culqi exige que la identidad del comercio y sus
 * politicas sean visibles, y la ley peruana obliga a publicar razon social y
 * RUC. Todo lo que aparezca aqui se refleja en el pie de pagina y en las
 * paginas legales.
 *
 * PENDIENTE: reemplazar los valores marcados como PENDIENTE por los reales
 * antes de enviar la web a validacion de Culqi.
 */
export const BusinessInfo = {
  brand: 'ACME Pedidos',
  legalName: 'ACME COURIER S.A.C.',
  ruc: '20601466377',
  address: 'Prolg. Manchego Muñoz N° 134, Santa Ana, Huancavelica, Perú',
  email: 'soporte@acmepedidos.com',
  phone: '914 960 649 / 986 292 395',
  supportHours: 'Todos los días de 8:00 a 22:00',
  city: 'Huancavelica',
  /**
   * Codigo con el que la ANPD (Autoridad Nacional de Proteccion de Datos
   * Personales) inscribio el banco de datos de clientes. Se tramita en el
   * Registro Nacional de Proteccion de Datos Personales del MINJUSDH.
   */
  dataBankName: 'Clientes y usuarios de ACME Pedidos',
  dataBankCode: 'PENDIENTE: código de inscripción ante la ANPD',
  /** Plazo para reclamar un pedido con problemas, en horas. */
  claimWindowHours: 24,
  /** Plazo de acreditación de reembolsos, en días hábiles. */
  refundBusinessDays: '5 a 15',
} as const;

/** true cuando faltan datos legales por completar. */
export const hasPendingLegalData = Object.values(BusinessInfo).some(
  (value) => typeof value === 'string' && value.startsWith('PENDIENTE'),
);
