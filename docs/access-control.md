# Control de acceso RBAC

Cada cuenta tiene exactamente un rol fijo. Las comprobaciones se realizan en el API y nunca dependen únicamente de la interfaz.

| Capacidad                         | Administrador | Operador | Paciente                |
| --------------------------------- | ------------- | -------- | ----------------------- |
| Gestionar cuentas y asignar roles | Sí            | No       | No                      |
| Consultar y exportar auditoría    | Sí            | No       | No                      |
| Consultar metadatos globales      | Sí            | Sí       | No                      |
| Consultar contenido clínico       | No            | Sí       | Solo propio y publicado |
| Cargar documentos                 | No            | Sí       | No                      |
| Editar borradores                 | No            | Sí       | No                      |
| Publicar documentos               | No            | Sí       | No                      |
| Reintentar procesamiento fallido  | No            | Sí       | No                      |
| Eliminar borradores o fallidos    | No            | Sí       | No                      |
| Anular documentos publicados      | Sí            | No       | No                      |
| Descargar PDF protegido           | No            | Sí       | Solo propio y vigente   |
| Consultar vista previa procesada  | No            | Sí       | Solo propio y publicado |
| Revelar o copiar contraseña PDF   | No            | No       | Solo propio y publicado |

Un documento publicado es inmutable. La corrección exige anularlo con una justificación y cargar un reemplazo enlazado. El paciente puede ver el historial, pero no abrir ni descargar documentos anulados. El Administrador puede inspeccionar metadatos y eventos sin acceder al contenido clínico.

La vista previa, la descarga, la revelación y la copia de contraseña pasan siempre por el API y generan eventos de auditoría. Las respuestas de contenido usan caché privada deshabilitada; los objetos S3 nunca se exponen directamente al navegador.
