export const roleNames=Object.freeze({
 PERSONAL:'Personal de área',
 JEFE_AREA:'Encargado de área',
 PRESTAMOS:'Encargado de préstamos / Control archivístico',
 ADMIN:'Administrador / Coordinador',
});
export function passwordValid(password){
 return typeof password==='string' && password.length>=8 && password.length<=128 &&
 /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}
export function hasRole(user,role){
 return Boolean(user&&Array.isArray(user.roles)&&user.roles.includes(role));
}
