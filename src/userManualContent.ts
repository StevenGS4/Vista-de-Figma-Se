import type { Role } from "./data";

export type ManualSection = { id: string; title: string; steps: string[] };

export function manualFor(role: Role, modules: readonly string[], permissions: readonly string[]) {
  const sections: ManualSection[] = [];
  const has = (permission: string) => permissions.includes(permission);
  const admin = role === "Administrador / Coordinador";
  const areaLead = role === "Encargado de área";
  const add = (module: string, id: string, title: string, steps: string[]) => {
    if (modules.includes(module)) sections.push({ id, title, steps });
  };

  add("inicio", "sesion", "Sesión, Inicio y ayuda", [
    "Entra con tu correo institucional y contraseña. Si el sistema solicita cambiarla, completa ese paso para continuar.",
    "En Inicio revisa Actividad reciente y Pendientes operativos. Pulsa un movimiento para abrir el módulo asociado cuando esté disponible.",
    "Abre un módulo desde el menú lateral. Puedes contraer el menú en escritorio o abrirlo desde el botón de navegación en una pantalla pequeña.",
    "Usa la lupa de la barra superior para buscar por folio, código o asunto. Selecciona un resultado autorizado para abrir su módulo.",
    "Abre la campana para revisar avisos. En tu perfil puedes cambiar la contraseña, elegir otro rol asignado o cerrar sesión.",
    "Pulsa el signo de interrogación para la ayuda de la pantalla actual. El libro abre este manual. Descargar PDF guarda una copia de la guía correspondiente a tu rol activo.",
  ]);

  add("tramite", "tramite-consulta", "Archivo de Trámite · Consultar inventarios", [
    "Entra a Archivo de Trámite. Usa los filtros de área, fechas, edición o código CADIDO que aparezcan y ejecuta la búsqueda.",
    "Localiza el inventario por su folio y abre Ver o el expediente que necesitas. Coteja el encabezado, la clasificación y el contenido de cada fila.",
    "Usa la paginación si hay más resultados. Limpia los filtros antes de iniciar una consulta diferente.",
  ]);

  if (has("register-records")) add("tramite", "tramite-captura", "Archivo de Trámite · Registrar un inventario", [
    "Abre la opción de nuevo inventario. En Datos generales revisa la unidad administrativa, el área generadora, el responsable y su cargo, el fondo, la fecha de elaboración y la hoja inicial. Captura los campos habilitados para tu cuenta.",
    "Elige la edición CADIDO, sección y serie que corresponden al origen y asunto de la documentación. Revisa los campos que el sistema completa o bloquea.",
    "En Expedientes y clasificación agrega una fila por expediente. Indica número de expediente, año del código, caja si aplica y consecutivo cuando sea editable. Comprueba la clave formada por fondo, sección, serie, número y año.",
    "Escribe un título concreto y describe el asunto. Evita nombres como Varios o Generalidades. Captura las fechas de apertura y cierre que constan en el expediente.",
    "Indica la cantidad de legajos y folios. Cuenta cada hoja una vez. Selecciona soporte físico, electrónico o mixto y los valores documentales aplicables según CADIDO.",
    "En Control documental verifica los años de conservación en Trámite y Concentración, la vigencia total, el domicilio completo de resguardo y las observaciones pertinentes. Repite la revisión para cada fila del inventario.",
    "En la vista previa comprueba los datos generales, los expedientes, sus códigos y fechas. Corrige lo necesario y guarda cuando el inventario coincida con la documentación.",
  ]);

  if (has("edit-records")) add("tramite", "tramite-edicion", "Archivo de Trámite · Corregir un inventario", [
    "Busca el inventario y abre Editar desde sus acciones. La edición está disponible según el estado del registro y tus permisos.",
    "Selecciona el expediente o la sección que vas a corregir. Revisa el efecto del cambio en la vista previa y guarda.",
    "Si el registro ya está protegido por una transferencia, consulta su estado en Transferencias antes de intentar hacer cambios.",
  ]);

  if (admin || areaLead || role === "Personal de área") add("tramite", "tramite-papelera", "Archivo de Trámite · Papelera", [
    "Abre el menú de acciones de Archivo de Trámite y entra a Papelera si aparece para tu cuenta.",
    "Revisa los registros disponibles. Usa Restaurar para devolver un inventario o expediente a la consulta de Trámite cuando el estado lo permita.",
    "Las acciones definitivas se confirman desde la pantalla de papelera y dependen del estado y de los vínculos del registro. Revisa el folio antes de confirmarlas.",
  ]);

  add("concentracion", "concentracion-consulta", "Archivo de Concentración · Consulta y ubicación", [
    "Entra a Archivo de Concentración. Busca por inventario, expediente o asunto y aplica los filtros disponibles.",
    "Abre un inventario para ver sus expedientes. En Ver detalle revisa clasificación, disponibilidad, recepción y ubicación que tenga registrada.",
    "Un expediente prestado permanece en Concentración y cambia su disponibilidad al registrarse la devolución física.",
    ...(admin && has("update-location") ? ["Para corregir una ubicación, abre Actualizar ubicación en el detalle, completa las referencias físicas y guarda. La recepción física debe estar registrada cuando corresponda."] : []),
  ]);

  add("transferencias", "transferencias-consulta", "Transferencias · Consultar seguimiento", [
    "Abre la bandeja de Transferencias y busca el folio o filtra por estado.",
    "Abre la solicitud. Revisa los inventarios, los expedientes, las observaciones y el Historial administrativo para ubicar la etapa del trámite.",
  ]);
  if (!admin && has("prepare-transfers")) add("transferencias", "transferencias-envio", "Transferencias · Preparar, corregir y enviar", [
    "Abre Nueva transferencia y selecciona inventarios de Trámite que aparezcan disponibles.",
    "Revisa los expedientes, los datos de la solicitud y la vista previa. Confirma el envío para visto bueno del área.",
    "Si la solicitud vuelve con observaciones, abre su folio, lee la indicación, corrige la selección o la información correspondiente y vuelve a enviar.",
  ]);
  if (areaLead && has("approve-area-transfers")) add("transferencias", "transferencias-area", "Transferencias · Visto bueno del área", [
    "Busca la solicitud de tu área pendiente de visto bueno. Abre el folio y verifica que corresponda a los inventarios entregados para revisión.",
    "Revisa la selección y los expedientes. Si procede, da el visto bueno para que avance a revisión administrativa. Si requiere correcciones, utiliza la opción de devolución disponible y explica el motivo.",
  ]);
  if (admin && (has("review-transfers") || has("accept-transfers"))) add("transferencias", "transferencias-admin", "Transferencias · Revisión administrativa", [
    "Selecciona un folio pendiente de revisión administrativa. Coteja los datos de la solicitud y su inventario.",
    ...(has("review-transfers") ? ["Si detectas diferencias, utiliza Devolver con observaciones y anota qué debe corregir el área."] : []),
    ...(has("accept-transfers") ? ["Si la solicitud procede, usa Aceptar transferencia y confirma. Después podrás consultar el estado en la bandeja."] : []),
  ]);
  if (admin && has("update-location")) add("transferencias", "transferencias-recepcion", "Transferencias · Recepción física", [
    "Abre una transferencia aceptada pendiente de recepción y entra a Recepción física.",
    "Verifica lo que se recibió contra el inventario. Registra el resultado de recepción y sus observaciones cuando haya diferencias.",
    "Captura la ubicación del lote en el formulario de recepción y confirma cuando la ubicación coincida con el resguardo físico.",
  ]);

  add("prestamos", "prestamos-seguimiento", "Préstamos · Seguimiento y vencimientos", [
    "Abre Préstamos y usa la bandeja para consultar activos, próximos a vencer, vencidos o devueltos.",
    "Desde las acciones abre Ver seguimiento o Ver historial. En préstamos de inventario completo, revisa abajo todos los expedientes entregados y su estado de devolución.",
  ]);
  if (has("register-loans")) add("prestamos", "prestamos-entrega", "Préstamos · Registrar entrega física", [
    "Abre Nuevo préstamo. Elige Inventarios completos para prestar todo el archivo, o Expedientes para prestar solo uno.",
    "Selecciona un registro disponible de Concentración. Revisa que tenga recepción física y ubicación cuando el sistema lo indique.",
    "Selecciona el área y la persona solicitantes, la persona que entrega y la fecha prevista de devolución. Captura quién recibe físicamente y cualquier observación.",
    "Pulsa Revisar entrega. Confirma cuando la documentación se haya entregado. Abre el folio para comprobar el registro.",
  ]);
  if (has("register-returns")) add("prestamos", "prestamos-devolucion", "Préstamos · Registrar devolución física", [
    "Localiza el préstamo activo y abre Registrar devolución. Revisa la fecha real y quién recibe.",
    "En un préstamo de inventario completo, marca cada expediente recibido e indica Buen estado o Con incidencias. Usa Observaciones para precisar lo ocurrido.",
    "Deja sin marcar los expedientes faltantes. La devolución parcial mantiene el préstamo activo hasta recibir el resto.",
    "Pulsa Revisar devolución y confirma. En un préstamo individual, captura los datos generales de recepción y confirma desde su formulario habitual.",
  ]);

  add("inventarios", "inventarios-excel", "Inventarios Excel · Configurar y descargar", [
    "Abre Inventarios Excel. Elige Archivo de Trámite, Archivo de Concentración o Relación de Transferencia primaria, según las opciones disponibles para tu cuenta.",
    "Configura los filtros de área, fechas y búsqueda que aparezcan. Para Transferencia primaria, selecciona los expedientes autorizados y verifica el resumen.",
    "Abre Vista previa completa. Comprueba el encabezado, claves CADIDO, ubicación, cantidades y expedientes incluidos.",
    "Descarga el Excel y verifica el contenido. En la relación primaria, los expedientes seleccionados se consolidan en la hoja principal.",
    "Al cotejar el formato institucional, revisa también el cierre: total de hojas y expedientes, años extremos, cajas y datos de almacenamiento si aplican. Verifica las firmas correspondientes en la versión que se usará formalmente.",
  ]);

  add("control-area", "control-area", "Seguimiento por área · Consultar actividad del personal", [
    "Abre Seguimiento por área y busca a una persona por nombre o correo. Abre sus acciones y entra a su seguimiento.",
    "Explora las pestañas de inventarios, expedientes, transferencias y bitácora. Usa la paginación cuando corresponda.",
    "Identifica el folio y la fecha del movimiento antes de buscar el registro en el módulo correspondiente.",
  ]);

  if (admin && has("manage-users")) {
    add("administracion", "admin-usuarios", "Administración · Usuarios", [
      "Abre Usuarios. Busca por nombre o correo y revisa área, estado y roles desde el detalle.",
      "Para una cuenta nueva, captura el nombre, apellidos, correo y área. Asigna sus roles y completa los requisitos que muestra el formulario.",
      "Para una cuenta existente, abre Editar o Permisos según la acción necesaria. Revisa los datos y guarda.",
    ]);
    add("administracion", "admin-areas", "Administración · Áreas, permisos y seguimiento", [
      "Abre Áreas para consultar las unidades y su relación. Usa las acciones disponibles si corresponde registrar o actualizar un área.",
      "En Roles y permisos, revisa qué acciones se asignan a cada rol. Guarda los cambios desde la interfaz.",
      "En Seguimiento por área, busca al personal y abre su detalle. Consulta inventarios, expedientes, transferencias o bitácora según la información que necesites.",
    ]);
    add("administracion", "admin-bajas", "Administración · Bajas documentales", [
      "Abre Bajas y filtra por área, usuario o folio. Selecciona el inventario completo y pulsa Dar de baja.",
      "Verifica el prellenado. Captura los folios y fechas de los documentos del AGN, y la referencia de evidencia que corresponda. Coteja ubicación, cantidades, responsables y método de disposición.",
      "Revisa las dos confirmaciones. Al confirmar la definitiva, el sistema registra la baja y descarga el Word con el Anexo A.",
      "Si hay expedientes prestados en ese inventario, el sistema bloquea la baja hasta que se registre la devolución.",
    ]);
  }
  return sections;
}
