import JSZip from 'jszip';

const documentTypes={
 SOLICITUD:['Atenta Nota de solicitud de transferencia','Titular del área generadora','Solicitud y relación de expedientes'],
 AUTORIZACION:['Autorización del área generadora','Responsable del Archivo de trámite','Autorización y relación de expedientes'],
 DICTAMEN_FAVORABLE:['Dictamen favorable de transferencia primaria','Área generadora y Archivo de trámite','Fundamento y resultado de la revisión'],
 DICTAMEN_DESFAVORABLE:['Dictamen desfavorable de transferencia primaria','Área generadora y Archivo de trámite','Observaciones y correcciones requeridas'],
 CORRECCION_FORMATO:['Corrección del formato de transferencia primaria','Archivo de concentración','Correcciones y reenvío a dictamen'],
 OBSERVACION_AREA:['Observaciones del área generadora','Solicitante','Observaciones'],
 SOLICITUD_AMPLIACION:['Solicitud de ampliación de plazo','Área coordinadora de archivos','Motivo y datos de la solicitud'],
 NOTA_TRASLADO:['Atenta Nota de solicitud de traslado','Enlace Administrativo','Datos del traslado y solicitud de vehículo'],
 ENTREGA:['Registro de entrega física','Archivo de concentración','Entrega y representante del área generadora'],
 RECEPCION:['Constancia interna de recepción','Área generadora','Resultado del cotejo, ubicación y evidencia'],
 DIFERENCIAS:['Registro de diferencias en la recepción','Área generadora','Diferencias observadas'],
};
const escapeXml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')
 .replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const paragraph=(value,bold=false)=>'<w:p><w:r>'+(bold?'<w:rPr><w:b/></w:rPr>':'')+
 '<w:t xml:space="preserve">'+escapeXml(value)+'</w:t></w:r></w:p>';

export async function makeTransferDocument({folio,area,kind,detail,date,actor,copy,recordCount}){
 const [title,recipient,subject]=documentTypes[kind]||['Registro documental de transferencia','Área generadora','Detalle'];
 const lines=[
  paragraph('Secretaría de Medio Ambiente y Recursos Naturales',true),
  paragraph('Oficina de Representación en Nayarit'),
  paragraph(title,true),
  paragraph(copy?'Copia para control y acuse':'Documento generado por el sistema · pendiente de firma cuando corresponda'),
  paragraph('Folio de transferencia: '+folio),
  paragraph('Área generadora: '+area),
  paragraph('Fecha de registro: '+date),
  paragraph('Registró: '+(actor||'____________________')),
  paragraph('Destinatario: '+recipient),
  paragraph(subject,true),
  ...String(detail||'').split(/\r?\n/).map(line=>paragraph(line)),
  paragraph('Anexo: relación de '+recordCount+' expediente(s) del folio '+folio),
  paragraph('Nombre, cargo y firma: ___________________________________'),
  ...(copy?[paragraph('Recibió / fecha / sello: ___________________________________')]:[]),
 ].join('');
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines+'<w:sectPr/></w:body></w:document>');
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
