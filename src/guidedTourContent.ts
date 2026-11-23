export const homeTour = [
  [".home-greeting", "Inicio", "Este tablero muestra tu sesión y los movimientos que puedes consultar con tu rol activo."],
  [".sidebar__top", "Menú lateral", "El menú lateral reúne los módulos del sistema. Solo aparecen los que están habilitados para tu rol."],
  [".mobile-menu", "Abrir navegación", "Abre el menú lateral para cambiar de módulo desde una pantalla pequeña."],
  [".sidebar__nav button", "Módulos disponibles", "Selecciona un módulo para abrirlo. El botón activo indica dónde estás."],
  [".sidebar__bottom button:not(.collapse-button)", "Cerrar sesión", "Termina tu sesión cuando dejes de usar el sistema."],
  [".collapse-button", "Contraer o expandir el menú", "Reduce el menú a iconos para ganar espacio o vuelve a mostrar los nombres."],
  [".app-header__page", "Barra superior", "Aquí aparece el nombre del módulo que tienes abierto."],
  ['[aria-label="Búsqueda global"]', "Búsqueda global", "Busca un expediente o folio entre los registros disponibles para tu cuenta. Selecciona un resultado para abrirlo."],
  ['[aria-label="Manual de usuario"]', "Manual de usuario", "El libro abre las instrucciones de los módulos y acciones disponibles para tu rol activo. Desde el manual puedes descargar una copia en PDF."],
  ['[aria-label^="Notificaciones"]', "Notificaciones", "Consulta avisos y pendientes relacionados con tu cuenta. Abre un aviso para revisar el registro asociado."],
  [".profile-trigger", "Perfil y rol activo", "Consulta tu cuenta. Desde aquí puedes cambiar entre tus roles asignados, cambiar tu contraseña o cerrar sesión."],
  [".dashboard-grid > *:first-child", "Actividad reciente", "Aquí aparecen tus últimos cinco movimientos registrados. Selecciona un movimiento disponible para abrir el módulo correspondiente."],
  [".dashboard-grid > *:nth-child(2)", "Pendientes operativos", "Revisa las tareas disponibles para tu rol y abre el registro desde su acceso."],
] as const;

export const moduleTour: Record<string, [string, string]> = {
  manual: ["Manual de usuario", "Selecciona un tema del índice para ir a sus pasos. Usa Descargar PDF para guardar la guía del rol activo."],
  tramite: ["Archivo de trámite", "Consulta los inventarios de trámite o registra un inventario con sus expedientes. Usa los filtros y las acciones disponibles en cada fila."],
  concentracion: ["Archivo de concentración", "Consulta inventarios transferidos y abre sus expedientes. El detalle muestra su disponibilidad y ubicación física cuando están registradas."],
  transferencias: ["Transferencias documentales", "Consulta el estado de una transferencia y abre el folio para ver su inventario e historial. Las acciones disponibles dependen de tu rol y de la etapa."],
  prestamos: ["Préstamos y devoluciones", "Consulta préstamos y vencimientos. Desde el seguimiento puedes revisar la entrega y registrar una devolución si tu rol lo permite."],
  inventarios: ["Inventarios documentales", "Elige el tipo de formato que necesitas, configura la selección y revisa la vista previa antes de descargar el Excel."],
  administracion: ["Administración", "Usa las pestañas para gestionar usuarios, áreas, roles, seguimiento o bajas documentales según la vista activa."],
  "control-area": ["Seguimiento por área", "Busca al personal del área y abre su seguimiento para consultar inventarios, expedientes, transferencias y movimientos."],
};

const fieldHelp: [RegExp, string][] = [
  [/folio.*agn|fecha.*(dictamen|acta.*agn)/, "Copia el folio o la fecha del documento original emitido por el Archivo General de la Nación."],
  [/inventario autorizado/, "Indica la referencia del inventario autorizado para la baja. Verifica el folio propuesto contra el documento autorizado."],
  [/unidad administrativa/, "Escribe el nombre de la unidad administrativa a la que pertenece el área generadora."],
  [/cargo.*responsable/, "Indica el cargo institucional que ocupa la persona responsable del área generadora."],
  [/responsable.*area generadora/, "Escribe el nombre completo de la persona responsable del área que generó los expedientes."],
  [/area generadora|area productora/, "Selecciona el área de SEMARNAT que produjo y organizó los expedientes."],
  [/area solicitante/, "Selecciona el área que solicita el préstamo o el movimiento, según el registro abierto."],
  [/fondo documental/, "Verifica el nombre completo del fondo: Secretaría de Medio Ambiente y Recursos Naturales."],
  [/edicion cadido/, "Elige la edición del catálogo que corresponde a la clasificación de estos expedientes."],
  [/seccion documental/, "Elige la clave y el nombre de la sección que corresponde a la función que generó los expedientes."],
  [/serie documental|codigo cadido/, "Selecciona la serie que corresponde al asunto, dentro de la sección documental seleccionada."],
  [/numero inicial de hoja/, "Anota el número de la primera hoja del inventario, por ejemplo, 1. El formato impreso muestra la relación de hojas."],
  [/fecha de elaboracion/, "Indica la fecha en que se elaboró el inventario. El formato institucional la presenta como día, mes y año."],
  [/numero consecutivo/, "Usa un número por expediente, en orden y sin saltos. Comienza en 1."],
  [/numero de caja/, "Captura el número del contenedor físico cuando el expediente se guarda en caja."],
  [/ano del codigo/, "Elige el año que forma parte de la clave archivística del expediente."],
  [/numero de expediente/, "Escribe el número asignado al expediente en su identificación archivística."],
  [/codigo de clasificacion/, "Revisa la clave completa: fondo, sección, serie, número de expediente y año, separados por puntos."],
  [/titulo|descripcion del asunto/, "Describe de forma concreta el asunto del expediente. Evita siglas y títulos genéricos como «Varios» o «Generalidades»."],
  [/inicio.*apertura|fecha de apertura/, "Selecciona la fecha en que se abrió el expediente."],
  [/fecha de cierre/, "Indica la fecha de cierre registrada. En un expediente, esta fecha inicia el cómputo de la vigencia documental."],
  [/numero de legajos/, "Anota cuántas divisiones o piezas físicas integran el expediente, cuando aplique."],
  [/numero de folios/, "Anota el total de hojas. Cuenta cada hoja una vez aunque tenga información en ambos lados."],
  [/soporte documental/, "Selecciona físico, electrónico o mixto según los documentos que contiene el expediente."],
  [/valor documental/, "Marca los valores primarios que correspondan a la serie según el catálogo aplicable."],
  [/anos en archivo|vigencia documental/, "Revisa los años de conservación establecidos en CADIDO para cada etapa. La vigencia total suma Trámite y Concentración."],
  [/domicilio|ubicacion topografica/, "Indica la dirección completa del inmueble donde se resguardan los expedientes."],
  [/estante|anaquel|nivel|pasillo|zona|posicion|caja/, "Captura la referencia física que permite localizar el expediente o la caja en el área de resguardo."],
  [/solicitante/, "Selecciona a la persona que solicita el préstamo dentro del área elegida."],
  [/fecha prevista/, "Indica la fecha acordada para devolver lo prestado. Debe ser igual o posterior a la fecha del préstamo."],
  [/fecha real de devolucion/, "Revisa la fecha en que se recibe físicamente el expediente."],
  [/persona que recibe|recibio/, "Escribe el nombre de quien recibe físicamente los documentos."],
  [/persona que entrega|entregador/, "Selecciona a la persona autorizada que realiza la entrega física."],
  [/metodo de disposicion/, "Revisa el método de disposición y captura el que se aplicó en la ejecución de la baja."],
  [/referencia de evidencia/, "Captura el folio o la referencia de la constancia de ejecución de la baja."],
  [/observaciones/, "Agrega solo información pertinente, como incidencias, faltantes o el estado físico del expediente."],
  [/correo/, "Escribe la dirección institucional completa de la persona usuaria."],
  [/contrasena/, "Captura la contraseña solicitada y revisa los requisitos que muestra el formulario."],
  [/fecha/, "Selecciona la fecha que corresponde al dato indicado en el formulario."],
];

const contextHelp: [RegExp, string][] = [
  [/recepcion por expediente/, "Marca cada expediente recibido y selecciona su estado. Si faltan expedientes, la devolución es parcial y el préstamo queda activo."],
  [/expedientes prestados/, "El listado conserva todos los expedientes entregados en el préstamo de inventario completo. Revisa cuáles siguen pendientes y cuáles ya se devolvieron."],
  [/ubicacion fisica/, "Revisa o registra la ubicación física. Usa las referencias del inmueble y del mobiliario que correspondan al inventario."],
  [/expedientes y revision/, "Completa un expediente por fila. Continúa en la siguiente línea del mismo expediente para capturar las fechas, el soporte, la vigencia y las observaciones. Puedes agregar filas, revisar la vista previa y guardar desde este paso."],
  [/paso 4.*vista previa/, "Revisa todo el inventario antes de guardarlo. Coteja las hojas, el total de expedientes y los años extremos con el documento de respaldo."],
  [/vista previa/, "Comprueba los datos y los expedientes que aparecen en el documento antes de confirmar o descargar."],
  [/bajas|baja documental/, "Selecciona un inventario completo. Revisa los datos del acta y confirma únicamente cuando corresponda registrar la baja."],
  [/recepcion fisica/, "Registra la recepción cuando el inventario haya llegado físicamente a Concentración. Comprueba sus cajas y ubicación."],
  [/historial|linea de tiempo|bitacora/, "Revisa los movimientos en orden cronológico y quién realizó cada uno."],
  [/inventarios completos/, "Cada fila representa un inventario. Selecciona esta opción si vas a entregar todos sus expedientes."],
  [/expedientes en concentracion/, "Selecciona el expediente específico que se entregará de forma individual."],
  [/confirmar devolucion/, "Comprueba el alcance de la devolución antes de confirmarla. Los expedientes que no se recibieron siguen prestados."],
  [/confirmar entrega|confirmar envio/, "Comprueba el folio y el alcance de la operación. Usa la confirmación cuando la información sea correcta."],
  [/autorizacion documental/, "Reúne los datos del dictamen, el acta del AGN y el inventario autorizado que respalda la baja."],
];

export const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const contextDescription = (title: string) => contextHelp.find(([match]) => match.test(normalize(title)))?.[1];
export const fieldDescription = (title: string, input: HTMLElement) => {
  const guide = fieldHelp.find(([match]) => match.test(normalize(title)))?.[1];
  if (input.matches(":disabled,[readonly]"))
    return guide ? "Dato de consulta. " + guide : "Revisa este dato. El sistema lo obtiene del registro o de tu sesión.";
  if (guide) return guide;
  if (input.matches("select")) return "Elige la opción de «" + title + "» que corresponda al registro.";
  if (input.matches('[type="checkbox"],[type="radio"]')) return "Marca esta opción cuando corresponda al registro que revisas.";
  return "Captura el dato de «" + title + "» tal como figura en el expediente o documento de respaldo.";
};
