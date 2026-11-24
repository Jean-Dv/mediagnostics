# Hardening del sistema operativo y los contenedores

Mediagnostics utiliza el Security Group de EC2 como firewall principal y aplica defensa en profundidad sobre Ubuntu, Docker y cada contenedor. El acceso administrativo se limita al usuario `ubuntu` mediante llave pública.

## Acceso administrativo SSH

La política versionada se encuentra en `infrastructure/ssh/00-mediagnostics-hardening.conf`. El prefijo `00` es necesario porque OpenSSH utiliza el primer valor encontrado y procesa los archivos incluidos en orden léxico; así la política precede a configuraciones como `50-cloud-init.conf`. Sus controles principales son:

- acceso exclusivo para `ubuntu` mediante llave pública;
- inicio de sesión de `root`, contraseñas y autenticación interactiva bloqueados;
- reenvío de puertos, agente, X11 y túneles deshabilitados;
- tres intentos por conexión y 30 segundos para autenticarse;
- cierre de conexiones sin respuesta después de aproximadamente diez minutos;
- registro detallado de autenticaciones mediante `LogLevel VERBOSE`.

### Instalación segura

Mantén abierta la sesión SSH actual durante todo el procedimiento. Instala la política sin editar la configuración principal de OpenSSH:

```bash
cd /opt/mediagnostics

sudo install \
  --owner=root \
  --group=root \
  --mode=0644 \
  infrastructure/ssh/00-mediagnostics-hardening.conf \
  /etc/ssh/sshd_config.d/00-mediagnostics-hardening.conf
```

Valida la sintaxis antes de recargar el servicio:

```bash
sudo sshd -t
sudo sshd -T | grep -E \
  '^(allowusers|authenticationmethods|passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication|x11forwarding|allowagentforwarding|allowtcpforwarding|permittunnel|maxauthtries|maxsessions|logingracetime|clientaliveinterval|clientalivecountmax|loglevel) '
```

Si `sshd -t` no produce salida, la sintaxis es válida. Después recarga, sin reiniciar, OpenSSH:

```bash
sudo systemctl reload ssh
sudo systemctl status ssh --no-pager
```

Sin cerrar la primera sesión, abre una segunda terminal y comprueba que la llave continúa funcionando:

```bash
ssh -i PATH_TO_KEY.pem ubuntu@EC2_PUBLIC_IP
```

Solo después de validar la segunda conexión debe cerrarse la sesión original.

### Reversión

Si la segunda conexión falla, usa la sesión que permanece abierta:

```bash
sudo mv \
  /etc/ssh/sshd_config.d/00-mediagnostics-hardening.conf \
  /etc/ssh/sshd_config.d/00-mediagnostics-hardening.disabled
sudo sshd -t
sudo systemctl reload ssh
```

## Cuenta no privilegiada y Docker

La aplicación no se ejecuta como `root`:

- API y Worker usan el usuario `node`;
- Caddy usa el usuario `caddy` y escucha en 8080/8443 dentro del contenedor;
- las imágenes oficiales de PostgreSQL y Redis deben verificarse en ejecución;
- ningún contenedor recibe el socket de Docker ni utiliza modo privilegiado.

El grupo `docker` permite controlar el daemon y equivale a privilegios administrativos. Su membresía debe limitarse al usuario `ubuntu`:

```bash
getent group docker
ls -l /var/run/docker.sock
```

No deben añadirse cuentas de aplicación, usuarios compartidos ni servicios HTTP al grupo `docker`.

## Evidencia de aislamiento de contenedores

Comprueba los usuarios efectivos:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T api id
docker compose --env-file .env.production -f compose.production.yaml exec -T worker id
docker compose --env-file .env.production -f compose.production.yaml exec -T web id
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres id
docker compose --env-file .env.production -f compose.production.yaml exec -T redis id
```

Comprueba el filesystem, capabilities, escalamiento y límites sin imprimir variables de entorno:

```bash
for service in api worker web; do
  container_id=$(docker compose \
    --env-file .env.production \
    -f compose.production.yaml \
    ps -q "$service")

  docker inspect --format \
    'service='"$service"' user={{.Config.User}} readonly={{.HostConfig.ReadonlyRootfs}} security={{json .HostConfig.SecurityOpt}} cap_drop={{json .HostConfig.CapDrop}} memory={{.HostConfig.Memory}} nano_cpus={{.HostConfig.NanoCpus}}' \
    "$container_id"
done
```

Una escritura fuera de `tmpfs` debe fallar:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T api sh -c 'touch /app/should-fail'
```

## Red y Security Group

El Security Group permite únicamente:

| Puerto    | Origen                  | Uso                     |
| --------- | ----------------------- | ----------------------- |
| `22/tcp`  | IP administrativa `/32` | SSH mediante llave      |
| `80/tcp`  | Internet                | Redirección hacia HTTPS |
| `443/tcp` | Internet                | Aplicación HTTPS        |

PostgreSQL, Redis, API y Worker no publican puertos del host. La red `edge` contiene Caddy y el API; la red `data` contiene API, Worker, PostgreSQL y Redis.

La evidencia se obtiene desde la consola de AWS Academy y desde Ubuntu:

```bash
sudo ss -lntup
docker compose --env-file .env.production -f compose.production.yaml ps
```

## Permisos de archivos

El directorio de despliegue debe ser accesible únicamente por su propietario y grupo; el archivo de secretos solo por su propietario:

```bash
sudo chown -R ubuntu:ubuntu /opt/mediagnostics
sudo chmod 0750 /opt/mediagnostics
sudo chmod 0600 /opt/mediagnostics/.env.production

stat -c '%A %a %U:%G %n' \
  /opt/mediagnostics \
  /opt/mediagnostics/.env.production
```

No ejecutes un `chmod` recursivo: los directorios y archivos del repositorio requieren permisos diferentes.

## Auditoría de servicios y mantenimiento

Ubuntu mantiene activados `unattended-upgrades`, `apt-daily.timer` y `apt-daily-upgrade.timer`. Antes de un mantenimiento manual se ejecuta y verifica el respaldo de PostgreSQL:

```bash
sudo systemctl start mediagnostics-backup.service
sudo systemctl status mediagnostics-backup.service --no-pager
```

El servicio es de tipo `oneshot`, por lo que `inactive (dead)` es normal después de terminar; la ejecución debe mostrar `status=0/SUCCESS` y la carga del respaldo a S3.

El procedimiento de mantenimiento es:

```bash
sudo apt update
apt list --upgradable
sudo apt upgrade

if [ -f /var/run/reboot-required ]; then
  cat /var/run/reboot-required
else
  echo "No reboot required"
fi

docker compose --env-file .env.production -f compose.production.yaml ps
curl --fail --silent --show-error \
  https://mediagnostics.moonshard-wow.com/api/v1/health/ready
```

Los paquetes diferidos por actualizaciones graduales de Ubuntu no se fuerzan; `unattended-upgrades` los instalará cuando corresponda. Los registros se consultan en `/var/log/unattended-upgrades/`.

Para completar la auditoría del host, se revisan servicios habilitados y AppArmor:

```bash
systemctl --type=service --state=running --no-pager
systemctl list-unit-files --state=enabled --no-pager
sudo aa-status
systemctl is-enabled unattended-upgrades
systemctl status apt-daily.timer apt-daily-upgrade.timer --no-pager
```

No se debe deshabilitar un servicio solo por desconocer su nombre. Primero se identifica su función y dependencia con EC2, red, SSH, Docker, sincronización horaria o monitoreo.
